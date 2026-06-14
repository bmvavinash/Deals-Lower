require('dotenv').config();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');

/**
 * Uploads the search index to Cloudflare R2 if credentials are configured.
 * Otherwise, logs a warning and returns gracefully.
 * 
 * @returns {Promise<boolean>} True if uploaded successfully, false otherwise.
 */
async function uploadSearchIndexToR2() {
    const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
    const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

    // Check if Cloudflare R2 configuration is complete
    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
        console.warn('⚠️ Cloudflare R2 credentials are not fully configured in the environment (.env). Skipping R2 upload.');
        return false;
    }

    try {
        console.log('Fetching search index from Firebase...');
        const snapshot = await productDealsDB.searchIndexRef.once('value');
        if (!snapshot.exists()) {
            console.error('❌ Search index is empty in Firebase DB. Skipping upload.');
            return false;
        }

        const indexData = snapshot.val();
        const jsonString = JSON.stringify(indexData);
        console.log(`Prepared search index. Size: ${(Buffer.byteLength(jsonString) / (1024 * 1024)).toFixed(2)} MB`);

        console.log('Initializing Cloudflare R2 S3 Client...');
        const s3 = new S3Client({
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId,
                secretAccessKey
            },
            region: 'auto'
        });

        console.log(`Uploading search_index.json to R2 bucket: ${bucketName}...`);
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: 'search_index.json',
            Body: jsonString,
            ContentType: 'application/json',
            CacheControl: 'public, max-age=0, must-revalidate' // Forces revalidation so users get updates instantly while keeping bandwidth free via 304s
        });

        await s3.send(command);
        console.log('✅ Search index successfully uploaded to Cloudflare R2!');
        return true;
    } catch (err) {
        console.error('❌ Failed to upload search index to Cloudflare R2:', err.message);
        return false;
    }
}

// Run immediately if this script is executed directly
if (require.main === module) {
    uploadSearchIndexToR2().then((success) => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { uploadSearchIndexToR2 };
