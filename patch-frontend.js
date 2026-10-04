const fs = require('fs');
let content = fs.readFileSync('frontend/src/pages/Banners.jsx', 'utf8');

// Add state
content = content.replace(
  "const [useCacheLive, setUseCacheLive] = useState(false);",
  "const [useCacheLive, setUseCacheLive] = useState(false);\n  const [formCarouselType, setFormCarouselType] = useState('none');\n  const [formCarouselValue, setFormCarouselValue] = useState('');"
);

// handleEditBannerClick
content = content.replace(
  "setFormOrder(String(banner.order || 0));",
  "setFormOrder(String(banner.order || 0));\n    if(banner.carouselConfig) {\n      setFormCarouselType(banner.carouselConfig.type || 'none');\n      setFormCarouselValue(banner.carouselConfig.value || '');\n    } else {\n      setFormCarouselType('none');\n      setFormCarouselValue('');\n    }"
);

// handleCancelEdit
content = content.replace(
  "setFormOrder('0');",
  "setFormOrder('0');\n    setFormCarouselType('none');\n    setFormCarouselValue('');"
);

// handleSaveBanner body (first replacement in fetch body)
content = content.replace(
  "isActive: formIsActive,\n          order: Number(formOrder) || 0",
  "isActive: formIsActive,\n          order: Number(formOrder) || 0,\n          carouselConfig: { type: formCarouselType, value: formCarouselValue }"
);

// UI additions (need to be careful with replace)
const uiAddition = `
              <div className="form-group">
                <label>Carousel Configuration (Deals Overlay)</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select value={formCarouselType} onChange={(e) => setFormCarouselType(e.target.value)}>
                    <option value="none">No Carousel</option>
                    <option value="category">Fetch by Category</option>
                    <option value="platform">Fetch by Platform</option>
                    <option value="search">Fetch by Search Term</option>
                  </select>
                  {formCarouselType !== 'none' && (
                    <input 
                      type="text" 
                      value={formCarouselValue} 
                      onChange={(e) => setFormCarouselValue(e.target.value)} 
                      placeholder="Enter category / platform / term" 
                      style={{ flex: 1 }}
                    />
                  )}
                </div>
              </div>
`;

// There are multiple `<div className="form-group form-group-checkbox">` in Banners.jsx, 
// let's replace the one for `formIsActive` which is in the main edit form.
content = content.replace(
  /<div className="form-group form-group-checkbox">\s*<input \s*type="checkbox" \s*id="formIsActive"/,
  uiAddition + '\n              <div className="form-group form-group-checkbox">\n                <input type="checkbox" id="formIsActive"'
);

fs.writeFileSync('frontend/src/pages/Banners.jsx', content);
console.log('patched');
