const fs = require('fs');
let content = fs.readFileSync('config/flipkartConfig.js', 'utf8');
content = content.replace(/.*,1.*/g, '    { type: \\'xpath\\', selector: \\'(//div[contains(text(), "₹") and string-length(text()) < 15])[1]\\', validator: validatePrice },');
fs.writeFileSync('config/flipkartConfig.js', content);
