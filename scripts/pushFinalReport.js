const fs = require('fs');
const path = require('path');
const { getModuleLogger } = require('../logger/logger');
const { testBannerDB } = require('../database/firebaseDB/bannerDB');

const logger = getModuleLogger('pushFinalReport');

function loadFinal() {
    const p = path.join(process.cwd(), 'extraction_report.final.json');
    if (!fs.existsSync(p)) {
        throw new Error('extraction_report.final.json not found');
    }
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

async function push() {
    const json = loadFinal();
    const banners = json.data || [];
    if (!Array.isArray(banners) || banners.length === 0) {
        logger.warn('No banners to push');
        return;
    }
    logger.info(`Pushing ${banners.length} banners to test-banners...`);
    const admin = require('firebase-admin');
    try {
        // Batch write using Firebase multi-location update for performance
        const updates = {};
        for (const b of banners) {
            updates[`test-banners/${b.id}`] = b;
        }
        await admin.database().ref().update(updates);
        const ok = banners.length;
        logger.info(`Push complete: ${ok}/${banners.length} stored`);
        console.log(`Push complete: ${ok}/${banners.length} stored`);
    } finally {
        // Cleanly tear down Firebase app so the process can exit
        try { await admin.app().delete(); } catch (_) {}
    }
}

push().then(() => {
    process.exit(0);
}).catch(err => {
    logger.error('Push failed', { error: err.message });
    console.error('Push failed:', err.message);
    process.exit(1);
});


