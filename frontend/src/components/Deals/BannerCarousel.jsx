import React, { useState, useEffect } from 'react';
import './BannerCarousel.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const BannerCarousel = ({ banner }) => {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (banner && banner.id) {
      fetchDeals();
    }
  }, [banner?.id, banner?.carouselConfig?.type, banner?.carouselConfig?.value]);

  const fetchDeals = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/banners/with-deals`);
      const data = await res.json();
      if (data.success) {
        const updated = data.data.find(b => b.id === banner.id);
        if (updated && updated.carouselDeals) {
          setDeals(updated.carouselDeals);
        } else {
          setDeals([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch banner deals for preview', err);
    } finally {
      setLoading(false);
    }
  };

  if (!banner) return null;

  const { title, description, url, clickRedirectUrl } = banner;
  // If the component gets passed carouselDeals directly (e.g. from client app), use it, otherwise use fetched state
  const displayDeals = banner.carouselDeals || deals;

  const handleBannerClick = () => {
    if (clickRedirectUrl) {
      window.open(clickRedirectUrl, '_blank');
    }
  };

  const handleDealClick = (deal, e) => {
    e.stopPropagation();
    if (deal.sourceUrl) {
      window.open(deal.sourceUrl, '_blank');
    }
  };

  return (
    <div className="banner-carousel-container">
      {/* Banner Background/Left Image */}
      <div className="banner-section" onClick={handleBannerClick} style={{ cursor: clickRedirectUrl ? 'pointer' : 'default' }}>
        <img src={url} alt={title} className="banner-image" onError={(e) => e.target.src = 'https://via.placeholder.com/400x600'} />
        <div className="banner-overlay">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      {/* Deals Carousel Overlapping */}
      {loading ? (
        <div className="deals-carousel-empty">
          <p>Loading deals preview...</p>
        </div>
      ) : displayDeals.length > 0 ? (
        <div className="deals-carousel-section">
          <div className="deals-carousel-scroll">
            {displayDeals.map((deal, idx) => (
              <div key={deal.id || idx} className="deal-card" onClick={(e) => handleDealClick(deal, e)}>
                <div className="deal-image-container">
                  <img src={deal.photo || deal.images || 'https://via.placeholder.com/150'} alt={deal.title} />
                </div>
                <div className="deal-info">
                  <h4 className="deal-title">{deal.title || 'Amazing Deal'}</h4>
                  <div className="deal-price">
                    <span className="current-price">₹{deal.price || 'N/A'}</span>
                    {deal.mrp && <span className="mrp-price">₹{deal.mrp}</span>}
                  </div>
                  {deal.discount && <div className="deal-discount">{deal.discount} OFF</div>}
                  <div className="deal-store">{deal.storeType}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="deals-carousel-empty">
          <p>No deals match the configured carousel rule. Edit configuration or start scraper.</p>
        </div>
      )}
    </div>
  );
};

export default BannerCarousel;
