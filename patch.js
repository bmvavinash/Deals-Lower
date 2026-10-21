const fs = require('fs');
let content = fs.readFileSync('server/api/routes/banners.js', 'utf8');

// POST /add
content = content.replace(
  "const { url, clickRedirectUrl, originalUrl, platform, category = 'general', title, description, isActive = true, order = 0 } = req.body;",
  "const { url, clickRedirectUrl, originalUrl, platform, category = 'general', title, description, isActive = true, order = 0, carouselConfig } = req.body;"
);
content = content.replace(
  "order: Number(order) || 0,\n        creationTimestamp: new Date().toISOString(),\n        updateTimestamp: new Date().toISOString()",
  "order: Number(order) || 0,\n        creationTimestamp: new Date().toISOString(),\n        updateTimestamp: new Date().toISOString(),\n        carouselConfig: carouselConfig || { type: 'none' }"
);

// PUT /:id
content = content.replace(
  "const { url, clickRedirectUrl, originalUrl, platform, category, title, description, isActive, order } = req.body;",
  "const { url, clickRedirectUrl, originalUrl, platform, category, title, description, isActive, order, carouselConfig } = req.body;"
);
content = content.replace(
  "order: order !== undefined ? Number(order) : existing.order",
  "order: order !== undefined ? Number(order) : existing.order,\n        carouselConfig: carouselConfig !== undefined ? carouselConfig : existing.carouselConfig"
);

fs.writeFileSync('server/api/routes/banners.js', content);
