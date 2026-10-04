const fs = require('fs');
let content = fs.readFileSync('frontend/src/pages/Banners.jsx', 'utf8');

// Add import
if (!content.includes('BannerCarousel')) {
  content = content.replace(
    "import './Banners.css';",
    "import './Banners.css';\nimport BannerCarousel from '../components/Deals/BannerCarousel';"
  );
}

// Modify preview pane
const oldPreview = \<div className=\"preview-image-container\">\;
const newPreview = \<div className=\"preview-image-container\" style={{ display: 'none' }}>\; // Hide old

content = content.replace(oldPreview, newPreview);

// Inject our new Banner Carousel
const newComponent = \
            <div style={{ padding: '20px', width: '100%', overflow: 'hidden' }}>
              <BannerCarousel banner={selectedBanner} />
              
              <div style={{ marginTop: '20px' }}>
                <button 
                  onClick={async () => {
                    const res = await fetch(\\\\/api/banners/with-deals\\\);
                    const data = await res.json();
                    if(data.success) {
                      const updated = data.data.find(b => b.id === selectedBanner.id);
                      if(updated) {
                         alert('Fetched deals! Found: ' + (updated.carouselDeals ? updated.carouselDeals.length : 0));
                         // You could set state here to trigger re-render if you manage carouselDeals in state
                      }
                    }
                  }}
                  style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' }}
                >
                  Test Fetch API Carousel Deals
                </button>
              </div>
            </div>
\;

content = content.replace(
  "<div className=\"preview-image-container\" style={{ display: 'none' }}>",
  newComponent + "\n            <div className=\"preview-image-container\" style={{ display: 'none' }}>"
);

fs.writeFileSync('frontend/src/pages/Banners.jsx', content);

