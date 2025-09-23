const fs = require('fs');
const path = require('path');

function isLikelyFlipkartProductImage(imageUrl, altText) {
    try {
        if (!imageUrl) return true;
        const lowerUrl = imageUrl.toLowerCase();
        const lowerAlt = (altText || '').toLowerCase();
        const thumbnailPatterns = [
            '/image/150/150/', '/image/170/170/', '/image/128/128/',
            '/image/200/200/', '/image/250/250/', '/image/312/312/',
            '/image/416/416/', 'q=70', 'xif0q'
        ];
        if (thumbnailPatterns.some(p => lowerUrl.includes(p))) return true;
        const productWords = [
            'men ', 'women ', 'boys ', 'girls ', 'shirt', 't-shirt', 'jeans', 'trouser', 'track pant',
            'shoe', 'sandal', 'watch', 'dress', 'saree', 'lehenga', 'kurta', 'mobile', 'phone', 'case',
            'back cover', 'headphone', 'earbud', 'camera', 'laptop', 'router', 'mixer', 'refrigerator'
        ];
        if (productWords.some(w => lowerAlt.includes(w))) return true;
        if (lowerUrl.includes('rukminim2.flixcart.com/image/')) return true;
        return false;
    } catch (_) {
        return false;
    }
}

function sanitizeJsonText(text) {
    let sanitized = text;
    // Specifically remove inline markers added after id lines like:
    // "id": "...", - invalid - product image
    sanitized = sanitized.replace(/(\"id\"\s*:\s*\"[^\"]+\")\s*,\s*-\s*invalid[^\r\n]*/gi, '$1,');
    // Also handle cases where there's no trailing comma after replacement
    sanitized = sanitized.replace(/(\"id\"\s*:\s*\"[^\"]+\")\s*-\s*invalid[^\r\n]*/gi, '$1');
    return sanitized;
}

function cleanReport(inputPath, outputPath) {
    const raw = fs.readFileSync(inputPath, 'utf-8');
    const json = JSON.parse(sanitizeJsonText(raw));
    const banners = Array.isArray(json) ? json : (json.data || []);

    const cleaned = banners.filter(b => {
        if (b.platform === 'flipkart') {
            return !isLikelyFlipkartProductImage(b.url, b.title || b.description || '');
        }
        return true;
    });

    const payload = Array.isArray(json)
        ? cleaned
        : { ...json, total: cleaned.length, data: cleaned };

    fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
}

(function main() {
    const input = path.join(process.cwd(), 'extraction_report.json');
    const output = path.join(process.cwd(), 'extraction_report.cleaned.json');
    if (!fs.existsSync(input)) {
        console.error('extraction_report.json not found');
        process.exit(1);
    }
    cleanReport(input, output);
    console.log('Cleaned report written to:', output);
})();


