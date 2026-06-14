process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');

async function processRef(ref, refName, batchSize = 1000) {
    console.log(`Processing reference: ${refName}...`);
    let lastKey = null;
    let hasMore = true;
    let totalProcessed = 0;

    while (hasMore) {
        let query = ref.orderByKey().limitToFirst(batchSize);
        if (lastKey) {
            query = query.startAt(lastKey);
        }

        const snapshot = await query.once('value');
        if (!snapshot.exists()) {
            hasMore = false;
            break;
        }

        const updates = {};
        let batchKeysCount = 0;
        let countInSnapshot = 0;

        snapshot.forEach(child => {
            countInSnapshot++;
            const key = child.key;
            const product = child.val();

            // Skip the duplicate first entry from startAt
            if (lastKey && key === lastKey) {
                return; // child iteration continue
            }

            updates[key] = {
                t: product.title ? String(product.title).toLowerCase() : (product.shortText ? String(product.shortText).toLowerCase() : ""),
                b: product.brand ? String(product.brand).toLowerCase() : "",
                c: product.categoryGroup || "",
                s: product.storeType || "",
                p: product.price || ""
            };
            
            lastKey = key;
            batchKeysCount++;
            totalProcessed++;
        });

        if (Object.keys(updates).length > 0) {
            await productDealsDB.searchIndexRef.update(updates);
            console.log(`[${refName}] Processed batch. Total processed so far: ${totalProcessed}`);
        }

        // If we retrieve fewer than batchSize entries, or 0 new keys, we reached the end
        if (batchKeysCount === 0 || countInSnapshot < batchSize) {
            hasMore = false;
        }
    }
    console.log(`Finished processing ${refName}. Total: ${totalProcessed}`);
    return totalProcessed;
}

async function buildIndex() {
    console.log('Starting search index build in batches...');
    try {
        console.log('Clearing search index reference to avoid stale data...');
        await productDealsDB.searchIndexRef.remove();
        
        const dealsCount = await processRef(productDealsDB.dealsRef, 'deals', 1000);
        const productdealsCount = await processRef(productDealsDB.productdealsRef, 'productdeals', 2000);
        
        console.log(`Search index built successfully. Total deals indexed: ${dealsCount + productdealsCount}`);
        
        try {
            console.log('Triggering Cloudflare R2 upload post-build...');
            const { uploadSearchIndexToR2 } = require('./uploadSearchIndexToR2');
            await uploadSearchIndexToR2();
        } catch (r2Err) {
            console.error('⚠️ Failed to upload search index to Cloudflare R2:', r2Err.message);
        }
        
        process.exit(0);
    } catch (err) {
        console.error('Error building search index:', err);
        process.exit(1);
    }
}

buildIndex();
