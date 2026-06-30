const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { getModuleLogger } = require('../../../logger/logger');

const logger = getModuleLogger('categoryPriority-route');
const CONFIG_PATH = path.join(__dirname, '../../../config/categoryPriority.json');

// GET /api/category-priority
// Returns the full category priority configuration
router.get('/', async (req, res) => {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.json({ categories: [], defaultPlatforms: ['amazon', 'flipkart'], maxPagesToScrape: 1 });
        } else {
            logger.error('Error reading category priority', { error: error.message });
            res.status(500).json({ error: 'Failed to read category priority configuration' });
        }
    }
});

// PUT /api/category-priority
// Replaces the entire category priority configuration
router.put('/', async (req, res) => {
    try {
        const newData = req.body;
        // Validate structure
        if (!newData.categories || !Array.isArray(newData.categories)) {
            return res.status(400).json({ error: '"categories" array is required' });
        }
        await fs.writeFile(CONFIG_PATH, JSON.stringify(newData, null, 2), 'utf8');
        logger.info('Category priority config updated', { categoryCount: newData.categories.length });
        res.json({ success: true, message: 'Category priority updated successfully' });
    } catch (error) {
        logger.error('Error writing category priority', { error: error.message });
        res.status(500).json({ error: 'Failed to update category priority configuration' });
    }
});

// GET /api/category-priority/summary
// Returns a lightweight summary for quick overview
router.get('/summary', async (req, res) => {
    try {
        const data = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf8'));
        const summary = (data.categories || []).map(cat => ({
            id: cat.id,
            name: cat.name,
            priority: cat.priority,
            platforms: cat.platforms || data.defaultPlatforms || ['amazon', 'flipkart'],
            subcategoryCount: (cat.subcategories || []).length,
            searchTermCount: (cat.subcategories || []).reduce((acc, sub) => {
                return acc + 1 + (Array.isArray(sub.searchTermAlt) ? sub.searchTermAlt.length : 0);
            }, 0)
        }));
        res.json({
            maxPagesToScrape: data.maxPagesToScrape || 1,
            totalCategories: summary.length,
            totalSearchTerms: summary.reduce((a, s) => a + s.searchTermCount, 0),
            categories: summary
        });
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.json({ totalCategories: 0, totalSearchTerms: 0, categories: [] });
        } else {
            logger.error('Error reading category priority summary', { error: error.message });
            res.status(500).json({ error: 'Failed to read category priority' });
        }
    }
});

// POST /api/category-priority/trigger
// Trigger a category scrape via the batch runner (runs in background)
router.post('/trigger', async (req, res) => {
    try {
        const { categoryId, platform } = req.body;
        const { exec } = require('child_process');
        const scriptPath = path.join(__dirname, '../../../scripts/runBatchProducts.js');
        
        let args = categoryId ? `website ${categoryId}` : 'website';
        if (platform && platform !== 'all') {
            args += ` --platform=${platform}`;
        }
        const cmd = `node "${scriptPath}" ${args}`;

        logger.info('Triggering category scrape', { categoryId: categoryId || 'ALL', platform: platform || 'ALL', cmd });

        // Run in background
        const child = exec(cmd, { cwd: path.join(__dirname, '../../..'), maxBuffer: 50 * 1024 * 1024 });

        child.stdout?.on('data', (data) => logger.info('[batch-trigger]', { stdout: data.toString().trim() }));
        child.stderr?.on('data', (data) => logger.warn('[batch-trigger]', { stderr: data.toString().trim() }));
        child.on('exit', (code) => logger.info('[batch-trigger] Process exited', { code, categoryId: categoryId || 'ALL' }));

        res.json({
            success: true,
            message: `Category scrape triggered${categoryId ? ` for "${categoryId}"` : ' for ALL categories'}`,
            pid: child.pid
        });
    } catch (error) {
        logger.error('Error triggering category scrape', { error: error.message });
        res.status(500).json({ error: 'Failed to trigger category scrape' });
    }
});

module.exports = router;
