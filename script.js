const fs = require('fs');
let content = fs.readFileSync('frontend/src/pages/BannersPage.tsx', 'utf8');
const searchStr = `<span className="nav-count" style={{ fontWeight: 'bold', fontSize: '1.1em', color: '#2c3e50' }}>Banner {currentIndex + 1} of {visibleBanners.length}</span>`;
const replaceStr = `${searchStr}
                    <button onClick={() => toggleBannerStatus(banner.id, banner.isActive || false)} className={\`trigger-button \${banner.isActive ? 'btn-active' : 'btn-inactive'}\`} style={{ padding: '8px 16px', backgroundColor: banner.isActive ? '#e74c3c' : '#2ecc71', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginLeft: '15px' }}>{banner.isActive ? 'Make Inactive' : 'Make Active'}</button>`;

content = content.replace(searchStr, replaceStr);
fs.writeFileSync('frontend/src/pages/BannersPage.tsx', content);
console.log('Done');
