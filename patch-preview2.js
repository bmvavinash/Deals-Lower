const fs = require('fs');
let content = fs.readFileSync('frontend/src/pages/Banners.jsx', 'utf8');

if (!content.includes('BannerCarousel')) {
  content = content.replace(
    "import './Banners.css';",
    "import './Banners.css';\nimport BannerCarousel from '../components/Deals/BannerCarousel';"
  );
}

// Modify preview pane
const oldPreview = '<div className="preview-image-container">';

const newComponent = `
            <div style={{ padding: '20px', width: '100%', overflow: 'hidden' }}>
              <BannerCarousel banner={selectedBanner} />
              
              <div style={{ marginTop: '20px' }}>
                <button 
                  onClick={async () => {
                    const res = await fetch(\`\${API_BASE_URL}/api/banners/with-deals\`);
                    const data = await res.json();
                    if(data.success) {
                      const updated = data.data.find(b => b.id === selectedBanner.id);
                      if(updated) {
                         alert('Test API fetched deals successfully! Deals found: ' + (updated.carouselDeals ? updated.carouselDeals.length : 0));
                         // We could set selectedBanner.carouselDeals to update the UI
                      }
                    }
                  }}
                  style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' }}
                >
                  Test Fetch API Carousel Deals
                </button>
              </div>
            </div>
            
            <div className="preview-image-container" style={{ display: 'none' }}>
`;

content = content.replace(oldPreview, newComponent);

fs.writeFileSync('frontend/src/pages/Banners.jsx', content);
