import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { dealsAPI, newsAPI } from '../services/api';
import DealList from '../components/Deals/DealList';
import DealFilters from '../components/Deals/DealFilters';
import './DealsPage.css';

type ViewMode = 'deals' | 'news' | 'reviews';

const DealsPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('deals');
  const [filters, setFilters] = useState({ dealType: '', platform: '', limit: 100, offset: 0 });
  const [newsFilters, setNewsFilters] = useState({ limit: 20, offset: 0, category: '', sortBy: 'publishDate', order: 'desc' });
  const [reviewsFilters, setReviewsFilters] = useState({ limit: 20, offset: 0, productName: '', minRating: '', sortBy: 'publishDate', order: 'desc' });
  
  // Deals query
  const { data: dealsData, isLoading: dealsLoading, error: dealsError, refetch: refetchDeals } = useQuery(
    ['deals', filters],
    () => dealsAPI.getAll(filters),
    { keepPreviousData: true, enabled: viewMode === 'deals' }
  );

  // News query
  const { data: newsData, isLoading: newsLoading, error: newsError, refetch: refetchNews } = useQuery(
    ['news', newsFilters],
    () => newsAPI.getAll(newsFilters),
    { keepPreviousData: true, enabled: viewMode === 'news' }
  );

  // Reviews query
  const { data: reviewsData, isLoading: reviewsLoading, error: reviewsError, refetch: refetchReviews } = useQuery(
    ['reviews', reviewsFilters],
    () => newsAPI.getReviews({
      ...reviewsFilters,
      minRating: reviewsFilters.minRating ? parseFloat(reviewsFilters.minRating) : undefined
    }),
    { keepPreviousData: true, enabled: viewMode === 'reviews' }
  );

  const handleFilterChange = (newFilters: any) => {
    setFilters({ ...filters, ...newFilters, offset: 0 });
  };

  const handleNewsFilterChange = (newFilters: any) => {
    setNewsFilters({ ...newsFilters, ...newFilters, offset: 0 });
  };

  const handleReviewsFilterChange = (newFilters: any) => {
    setReviewsFilters({ ...reviewsFilters, ...newFilters, offset: 0 });
  };

  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isTelegramRunning, setIsTelegramRunning] = useState(false);
  const [isNewsScraping, setIsNewsScraping] = useState(false);
  const [showRetriggerModal, setShowRetriggerModal] = useState(false);
  const [isRetriggering, setIsRetriggering] = useState(false);
  const [retriggerFields, setRetriggerFields] = useState({
    price: true,
    links: false,
    discount: false,
    category: false,
    photo: false
  });

  const handleTriggerBulkUpdate = async () => {
    try {
      setIsBulkUpdating(true);
      await dealsAPI.triggerBulkUpdate('website', 'productdeals');
      alert('Bulk update triggered successfully! It will run in the background.');
      refetchDeals();
    } catch (error) {
      alert('Failed to trigger bulk update');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleTriggerTelegramBot = async () => {
    try {
      setIsTelegramRunning(true);
      await dealsAPI.triggerTelegramBot();
      alert('Telegram bot triggered successfully! It will process messages continuously in the background.');
    } catch (error) {
      alert('Failed to trigger Telegram bot');
    } finally {
      setIsTelegramRunning(false);
    }
  };

  const handleTriggerNewsReviews = async () => {
    try {
      setIsNewsScraping(true);
      await newsAPI.triggerScrape({ scrapeNews: true, scrapeReviews: true, maxPages: 5, maxArticles: 50 });
      alert('News & Reviews scraping triggered successfully! It will run in the background and update the database.');
      if (viewMode === 'news') refetchNews();
      if (viewMode === 'reviews') refetchReviews();
    } catch (error) {
      alert('Failed to trigger News & Reviews scraping');
    } finally {
      setIsNewsScraping(false);
    }
  };

  const handleRetriggerToday = async () => {
    try {
      setIsRetriggering(true);
      const selectedFields = Object.entries(retriggerFields)
        .filter(([_, selected]) => selected)
        .map(([field, _]) => field);
      
      if (selectedFields.length === 0) {
        alert('Please select at least one field to retrigger');
        return;
      }

      const response = await dealsAPI.retriggerToday(selectedFields, 'price');
      const data = response.data;
      
      alert(`Retrigger started! Found ${data.stats.toRetrigger} deals to process.\n\nIssues breakdown:\n- Price: ${data.stats.issuesBreakdown.price}\n- Links: ${data.stats.issuesBreakdown.links}\n- Discount: ${data.stats.issuesBreakdown.discount}\n- Category: ${data.stats.issuesBreakdown.category}\n- Photo: ${data.stats.issuesBreakdown.photo}\n\nProducts with price issues are processed first. Check logs for progress.`);
      
      setShowRetriggerModal(false);
      refetchDeals();
    } catch (error: any) {
      alert(`Failed to trigger retrigger: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsRetriggering(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="deals-page">
      <div className="page-header">
        <h1>Deals Management</h1>
        <div className="trigger-buttons">
          <button 
            onClick={handleTriggerBulkUpdate} 
            className="trigger-button"
            disabled={isBulkUpdating}
          >
            {isBulkUpdating ? '⏳ Triggering...' : '🔄 Trigger Bulk Update'}
          </button>
          <button 
            onClick={handleTriggerTelegramBot} 
            className="trigger-button telegram-button"
            disabled={isTelegramRunning}
          >
            {isTelegramRunning ? '⏳ Starting...' : '📱 Trigger Telegram Bot'}
          </button>
          <button 
            onClick={handleTriggerNewsReviews} 
            className="trigger-button news-button"
            disabled={isNewsScraping}
          >
            {isNewsScraping ? '⏳ Scraping...' : '📰 Trigger News & Reviews'}
          </button>
          <button 
            onClick={() => setShowRetriggerModal(true)} 
            className="trigger-button retrigger-button"
            disabled={isRetriggering}
          >
            {isRetriggering ? '⏳ Retriggering...' : '🔄 Retrigger Today\'s Deals'}
          </button>
        </div>
        <div className="trigger-info">
          <p className="info-text">
            <strong>Note:</strong> All processes can run in parallel. 
            They use separate processes and won't interfere with each other.
          </p>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="view-mode-tabs">
        <button 
          className={`view-tab ${viewMode === 'deals' ? 'active' : ''}`}
          onClick={() => setViewMode('deals')}
        >
          🛍️ Deals
        </button>
        <button 
          className={`view-tab ${viewMode === 'news' ? 'active' : ''}`}
          onClick={() => setViewMode('news')}
        >
          📰 News
        </button>
        <button 
          className={`view-tab ${viewMode === 'reviews' ? 'active' : ''}`}
          onClick={() => setViewMode('reviews')}
        >
          ⭐ Reviews
        </button>
      </div>

      {/* Deals View */}
      {viewMode === 'deals' && (
        <>
          <DealFilters filters={filters} onFilterChange={handleFilterChange} />
          {dealsLoading && <div className="loading">Loading deals...</div>}
          {dealsError && <div className="error">Error loading deals: {String(dealsError)}</div>}
          {dealsData && (
            <DealList 
              deals={(dealsData.data as any).data || []} 
              pagination={(dealsData.data as any).pagination}
              onPageChange={(offset) => setFilters({ ...filters, offset })}
            />
          )}
        </>
      )}

      {/* News View */}
      {viewMode === 'news' && (
        <>
          <div className="content-filters">
            <select 
              value={newsFilters.category} 
              onChange={(e) => handleNewsFilterChange({ category: e.target.value })}
              className="filter-select"
            >
              <option value="">All Categories</option>
              <option value="mobile">Mobile</option>
              <option value="tech">Tech</option>
              <option value="gadgets">Gadgets</option>
            </select>
            <select 
              value={newsFilters.sortBy} 
              onChange={(e) => handleNewsFilterChange({ sortBy: e.target.value })}
              className="filter-select"
            >
              <option value="publishDate">Sort by Date</option>
              <option value="title">Sort by Title</option>
            </select>
            <select 
              value={newsFilters.order} 
              onChange={(e) => handleNewsFilterChange({ order: e.target.value })}
              className="filter-select"
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
          {newsLoading && <div className="loading">Loading news...</div>}
          {newsError && <div className="error">Error loading news: {String(newsError)}</div>}
          {newsData && !newsLoading && (
            <>
              {(() => {
                // Handle axios response structure: response.data.data.data
                // axios wraps: { data: { success: true, data: [...], pagination: {...} } }
                const apiResponse = (newsData.data as any)?.data || {};
                const newsArray = apiResponse.data || [];
                console.log('News API Response:', { apiResponse, newsArray, length: newsArray.length });
                return newsArray.length === 0 ? (
                  <div className="empty-state">No news articles found. Click "Trigger News & Reviews" to start scraping.</div>
                ) : (
                  <div className="content-list">
                    {newsArray.map((article: any) => (
                  <div key={article.id} className="content-card">
                    {article.images && article.images.length > 0 && (
                      <div className="content-image">
                        <img src={article.images[0].url} alt={article.images[0].alt || article.title} />
                      </div>
                    )}
                    <div className="content-details">
                      <div className="content-meta">
                        {article.category && <span className="category-badge">{article.category}</span>}
                        {article.publishDate && <span className="date">{formatDate(article.publishDate)}</span>}
                        {article.author && <span className="author">By {article.author}</span>}
                      </div>
                      <h3 className="content-title">{article.title}</h3>
                      <p className="content-excerpt">{article.content?.substring(0, 300)}...</p>
                      {article.tags && article.tags.length > 0 && (
                        <div className="content-tags">
                          {article.tags.slice(0, 3).map((tag: string, idx: number) => (
                            <span key={idx} className="tag">{tag}</span>
                          ))}
                        </div>
                      )}
                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="read-more">
                        Read Full Article →
                      </a>
                    </div>
                  </div>
                    ))}
                  </div>
                );
              })()}
              {(() => {
                const apiResponse = (newsData.data as any)?.data || {};
                const pagination = apiResponse.pagination;
                return pagination ? (
                  <div className="pagination">
                    <button
                      onClick={() => setNewsFilters({ ...newsFilters, offset: Math.max(0, newsFilters.offset - newsFilters.limit) })}
                      disabled={newsFilters.offset === 0}
                      className="pagination-button"
                    >
                      Previous
                    </button>
                    <span className="pagination-info">
                      Showing {newsFilters.offset + 1} - {Math.min(newsFilters.offset + newsFilters.limit, pagination.total)} of {pagination.total}
                    </span>
                    <button
                      onClick={() => setNewsFilters({ ...newsFilters, offset: newsFilters.offset + newsFilters.limit })}
                      disabled={!pagination.hasMore}
                      className="pagination-button"
                    >
                      Next
                    </button>
                  </div>
                ) : null;
              })()}
            </>
          )}
        </>
      )}

      {/* Reviews View */}
      {viewMode === 'reviews' && (
        <>
          <div className="content-filters">
            <input
              type="text"
              placeholder="Search by product name..."
              value={reviewsFilters.productName}
              onChange={(e) => handleReviewsFilterChange({ productName: e.target.value })}
              className="filter-input"
            />
            <select 
              value={reviewsFilters.minRating} 
              onChange={(e) => handleReviewsFilterChange({ minRating: e.target.value })}
              className="filter-select"
            >
              <option value="">All Ratings</option>
              <option value="4">4+ Stars</option>
              <option value="4.5">4.5+ Stars</option>
            </select>
            <select 
              value={reviewsFilters.sortBy} 
              onChange={(e) => handleReviewsFilterChange({ sortBy: e.target.value })}
              className="filter-select"
            >
              <option value="publishDate">Sort by Date</option>
              <option value="rating">Sort by Rating</option>
              <option value="productName">Sort by Product</option>
            </select>
            <select 
              value={reviewsFilters.order} 
              onChange={(e) => handleReviewsFilterChange({ order: e.target.value })}
              className="filter-select"
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
          {reviewsLoading && <div className="loading">Loading reviews...</div>}
          {reviewsError && <div className="error">Error loading reviews: {String(reviewsError)}</div>}
          {reviewsData && !reviewsLoading && (
            <>
              {(() => {
                // Handle axios response structure: response.data.data.data
                // axios wraps: { data: { success: true, data: [...], pagination: {...} } }
                const apiResponse = (reviewsData.data as any)?.data || {};
                const reviewsArray = apiResponse.data || [];
                console.log('Reviews API Response:', { apiResponse, reviewsArray, length: reviewsArray.length });
                return reviewsArray.length === 0 ? (
                  <div className="empty-state">No reviews found. Click "Trigger News & Reviews" to start scraping.</div>
                ) : (
                  <div className="content-list">
                    {reviewsArray.map((review: any) => (
                  <div key={review.id} className="content-card">
                    {review.images && review.images.length > 0 && (
                      <div className="content-image">
                        <img src={review.images[0].url} alt={review.images[0].alt || review.productName} />
                      </div>
                    )}
                    <div className="content-details">
                      <div className="content-header">
                        <h3 className="content-title">{review.productName || review.title}</h3>
                        {review.rating && (
                          <div className="rating-display">
                            {'★'.repeat(Math.floor(review.rating))}
                            <span className="rating-value">{review.rating.toFixed(1)}/5</span>
                          </div>
                        )}
                      </div>
                      <div className="content-meta">
                        {review.publishDate && <span className="date">{formatDate(review.publishDate)}</span>}
                        {review.author && <span className="author">By {review.author}</span>}
                      </div>
                      <p className="content-excerpt">{review.content?.substring(0, 300)}...</p>
                      {review.pros && review.pros.length > 0 && (
                        <div className="pros-cons">
                          <strong>Pros:</strong>
                          <ul>
                            {review.pros.slice(0, 3).map((pro: string, idx: number) => (
                              <li key={idx}>{pro}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {review.cons && review.cons.length > 0 && (
                        <div className="pros-cons">
                          <strong>Cons:</strong>
                          <ul>
                            {review.cons.slice(0, 3).map((con: string, idx: number) => (
                              <li key={idx}>{con}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {review.verdict && (
                        <div className="verdict">
                          <strong>Verdict:</strong> {review.verdict.substring(0, 200)}...
                        </div>
                      )}
                      <a href={review.url} target="_blank" rel="noopener noreferrer" className="read-more">
                        Read Full Review →
                      </a>
                    </div>
                  </div>
                    ))}
                  </div>
                );
              })()}
              {(() => {
                const apiResponse = (reviewsData.data as any)?.data || {};
                const pagination = apiResponse.pagination;
                return pagination ? (
                  <div className="pagination">
                    <button
                      onClick={() => setReviewsFilters({ ...reviewsFilters, offset: Math.max(0, reviewsFilters.offset - reviewsFilters.limit) })}
                      disabled={reviewsFilters.offset === 0}
                      className="pagination-button"
                    >
                      Previous
                    </button>
                    <span className="pagination-info">
                      Showing {reviewsFilters.offset + 1} - {Math.min(reviewsFilters.offset + reviewsFilters.limit, pagination.total)} of {pagination.total}
                    </span>
                    <button
                      onClick={() => setReviewsFilters({ ...reviewsFilters, offset: reviewsFilters.offset + reviewsFilters.limit })}
                      disabled={!pagination.hasMore}
                      className="pagination-button"
                    >
                      Next
                    </button>
                  </div>
                ) : null;
              })()}
            </>
          )}
        </>
      )}

      {/* Retrigger Modal */}
      {showRetriggerModal && (
        <div className="modal-overlay" onClick={() => setShowRetriggerModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Retrigger Today's Deals</h2>
              <button className="modal-close" onClick={() => setShowRetriggerModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                Select which fields to check and retrigger. Only deals with issues in the selected fields will be processed.
                <strong> Priority: Price issues are processed first.</strong>
              </p>
              <div className="retrigger-fields">
                <label className="retrigger-field-item">
                  <input
                    type="checkbox"
                    checked={retriggerFields.price}
                    onChange={(e) => setRetriggerFields({ ...retriggerFields, price: e.target.checked })}
                  />
                  <span className="field-label">
                    <strong>Price</strong> (Highest Priority)
                    <span className="field-description">Missing, N/A, or invalid prices</span>
                  </span>
                </label>
                <label className="retrigger-field-item">
                  <input
                    type="checkbox"
                    checked={retriggerFields.links}
                    onChange={(e) => setRetriggerFields({ ...retriggerFields, links: e.target.checked })}
                  />
                  <span className="field-label">
                    <strong>Links</strong>
                    <span className="field-description">Missing affiliate links or product URLs</span>
                  </span>
                </label>
                <label className="retrigger-field-item">
                  <input
                    type="checkbox"
                    checked={retriggerFields.discount}
                    onChange={(e) => setRetriggerFields({ ...retriggerFields, discount: e.target.checked })}
                  />
                  <span className="field-label">
                    <strong>Discount</strong>
                    <span className="field-description">Missing or invalid discount information</span>
                  </span>
                </label>
                <label className="retrigger-field-item">
                  <input
                    type="checkbox"
                    checked={retriggerFields.category}
                    onChange={(e) => setRetriggerFields({ ...retriggerFields, category: e.target.checked })}
                  />
                  <span className="field-label">
                    <strong>Category</strong>
                    <span className="field-description">Missing or invalid category data</span>
                  </span>
                </label>
                <label className="retrigger-field-item">
                  <input
                    type="checkbox"
                    checked={retriggerFields.photo}
                    onChange={(e) => setRetriggerFields({ ...retriggerFields, photo: e.target.checked })}
                  />
                  <span className="field-label">
                    <strong>Photo</strong>
                    <span className="field-description">Missing product images</span>
                  </span>
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="modal-button cancel" 
                onClick={() => setShowRetriggerModal(false)}
                disabled={isRetriggering}
              >
                Cancel
              </button>
              <button 
                className="modal-button primary" 
                onClick={handleRetriggerToday}
                disabled={isRetriggering || Object.values(retriggerFields).every(v => !v)}
              >
                {isRetriggering ? '⏳ Retriggering...' : '🔄 Start Retrigger'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DealsPage;

