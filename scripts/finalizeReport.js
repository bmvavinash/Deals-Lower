const fs = require('fs');
const path = require('path');

function readCleaned() {
    const p = path.join(process.cwd(), 'extraction_report.cleaned.json');
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function readNonDuplicateList() {
    const p = path.join(process.cwd(), 'temp', 'non duplicate banners.md');
    if (!fs.existsSync(p)) return [];
    const lines = fs.readFileSync(p, 'utf-8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const items = [];
    for (const line of lines) {
        const [url, comment] = line.split(' - ');
        if (url) items.push({ url: url.trim(), comment: (comment || '').trim() });
    }
    return items;
}

function normalizeUrl(u) {
    return (u || '').replace(/\?q=\d+(&|$)/, '?').toLowerCase();
}

function inferCategory(url, title, platform) {
    const u = (url || '').toLowerCase();
    const t = (title || '').toLowerCase();
    // domain category keywords
    const slots = [u, t];
    const catMap = [
        { key: 'electronics', kws: ['mobile', 'phone', 'laptop', 'camera', 'electronics', 'headphone', 'earbud', 'router', 'tv'] },
        { key: 'fashion', kws: ['fashion', 'apparel', 'clothing', 't-shirt', 'shirt', 'jeans', 'dress', 'saree', 'lehenga', 'kurta'] },
        { key: 'footwear', kws: ['shoe', 'sandal', 'sneaker', 'footwear'] },
        { key: 'home_kitchen', kws: ['home', 'kitchen', 'cookware', 'gas-stove', 'refrigerator', 'mixer'] },
        { key: 'beauty_grooming', kws: ['beauty', 'groom', 'skin', 'face', 'makeup'] },
        { key: 'travel', kws: ['flight', 'travel'] },
        { key: 'grocery', kws: ['grocery', 'pantry'] }
    ];
    let realCategory = 'general';
    for (const { key, kws } of catMap) {
        if (kws.some(k => slots.some(s => s.includes(k)))) { realCategory = key; break; }
    }

    // promotion level
    const promoKeywords = ['deal', 'deals', 'sale', 'festival', 'offer', 'discount', 'billion days', 'prime'];
    const isPromo = promoKeywords.some(k => slots.some(s => s.includes(k)));
    let promotionLevel = isPromo ? 'promotion' : 'low';

    // subcategory by dimension hints in URL
    let subcategory = 'general';
    if (platform === 'flipkart') {
        if (u.includes('/fk-p-flap/1620/270/')) subcategory = 'hero-strip';
        else if (u.includes('/1800/1800/')) subcategory = 'square';
        else if (u.includes('/50/50/')) subcategory = 'thumbnail';
    } else if (platform === 'amazon') {
        if (u.includes('prime')) subcategory = 'prime';
        else if (u.includes('greatindianfestival') || t.includes('festival')) subcategory = 'festival';
        else if (u.includes('/gp/goldbox') || u.includes('/deals')) subcategory = 'deals';
    }

    // tall banner hint for top-half cropping
    const needsTopHalfCrop = u.includes('/1800/1800/') || t.includes('central header');

    return { category: realCategory, subcategory, promotionLevel, needsTopHalfCrop };
}

function finalize() {
    const cleaned = readCleaned();
    const nonDup = readNonDuplicateList();
    const whitelist = new Set(nonDup.map(i => normalizeUrl(i.url)));
    const urlToComment = new Map(nonDup.map(i => [normalizeUrl(i.url), i.comment]));

    const seen = new Set();
    const unique = [];
    for (const b of cleaned.data) {
        const key = normalizeUrl(b.url);
        if (whitelist.size > 0 && !whitelist.has(key)) continue; // keep only items from your list
        if (seen.has(key)) continue;
        seen.add(key);

        const { category, subcategory, promotionLevel, needsTopHalfCrop } = inferCategory(b.url, b.title, b.platform);
        unique.push({
            ...b,
            category,
            subcategory,
            promotionLevel,
            needsTopHalfCrop,
            reviewerComment: urlToComment.get(key) || ''
        });
    }

    const out = {
        generatedAt: new Date().toISOString(),
        total: unique.length,
        data: unique
    };

    const outPath = path.join(process.cwd(), 'extraction_report.final.json');
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
    console.log('Final report written to:', outPath, 'count:', unique.length);
}

finalize();


