import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { newsAPI } from '../services/api';
import './ReviewsPage.css';

interface ReviewArticle {
  id: string;
  productName: string;
  title: string;
  content: string;
  rating?: number;
  pros?: string[];
  cons?: string[];
  verdict?: string;
  author?: string;
  publishDate?: string;
  images?: Array<{ url: string; alt: string }>;
  url: string;
  type: 'review';
}

const ReviewsPage: React.FC = () => {
  const [filters, setFilters] = useState({ 
    limit: 20, 
    offset: 0, 
    productName: '', 
    minRating: '', 
    sortBy: 'publishDate', 
    order: 'desc' 
  });
  const [isScraping, setIsScraping] = useState(false);

  const { data, isLoading, error, refetch } = useQuery(
    ['reviews', filters],
    () => newsAPI.getReviews({
      ...filters,
      minRating: filters.minRating ? parseFloat(filters.minRating) : undefined
    }),
    { keepPreviousData: true }
  );

  const handleFilterChange = (newFilters: any) => {
    setFilters({ ...filters, ...newFilters, offset: 0 });
  };

  const handleTriggerScrape = async () => {
    try {
      setIsScraping(true);
      await newsAPI.triggerScrape({ scrapeNews: false, scrapeReviews: true, maxPages: 5, maxArticles: 50 });
      alert('Reviews scraping triggered successfully! It will run in the background.');
      setTimeout(() => refetch(), 5000);
    } catch (error) {
      alert('Failed to trigger reviews scraping');
    } finally {
      setIsScraping(false);
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

  const renderStars = (rating?: number) => {
    if (!rating) return null;
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    return (
      <div className="rating-stars">
        {[...Array(5)].map((_, i) => (
          <span key={i} className={i < fullStars ? 'star filled' : i === fullStars && hasHalfStar ? 'star half' : 'star'}>
            ★
          </span>
        ))}
        <span className="rating-value">{rating.toFixed(1)}/5</span>
      </div>
    );
  };

  return (
    <div className="reviews-page">
      <div className="page-header">
        <h1>Product Reviews</h1>
        <button 
          onClick={handleTriggerScrape} 
          className="trigger-button"
          disabled={isScraping}
        >
          {isScraping ? '⏳ Scraping...' : '🔄 Scrape Reviews'}
        </button>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Search by product name..."
          value={filters.productName}
          onChange={(e) => handleFilterChange({ productName: e.target.value })}
          className="filter-input"
        />
        <select 
          value={filters.minRating} 
          onChange={(e) => handleFilterChange({ minRating: e.target.value })}
          className="filter-select"
        >
          <option value="">All Ratings</option>
          <option value="4">4+ Stars</option>
          <option value="4.5">4.5+ Stars</option>
        </select>
        <select 
          value={filters.sortBy} 
          onChange={(e) => handleFilterChange({ sortBy: e.target.value })}
          className="filter-select"
        >
          <option value="publishDate">Sort by Date</option>
          <option value="rating">Sort by Rating</option>
          <option value="productName">Sort by Product</option>
        </select>
        <select 
          value={filters.order} 
          onChange={(e) => handleFilterChange({ order: e.target.value })}
          className="filter-select"
        >
          <option value="desc">Newest First</option>
          <option value="asc">Oldest First</option>
        </select>
      </div>

      {isLoading && <div className="loading">Loading reviews...</div>}
      {error && <div className="error">Error loading reviews: {String(error)}</div>}

      {data && (
        <>
          <div className="reviews-list">
            {(data.data as any)?.data?.map((review: ReviewArticle) => (
              <div key={review.id} className="review-card">
                {review.images && review.images.length > 0 && (
                  <div className="review-image">
                    <img src={review.images[0].url} alt={review.images[0].alt || review.productName} />
                  </div>
                )}
                <div className="review-content">
                  <div className="review-header">
                    <h2 className="review-product-name">{review.productName || review.title}</h2>
                    {renderStars(review.rating)}
                  </div>
                  <div className="review-meta">
                    {review.publishDate && <span className="date">{formatDate(review.publishDate)}</span>}
                    {review.author && <span className="author">By {review.author}</span>}
                  </div>
                  <p className="review-excerpt">
                    {review.content?.substring(0, 300)}...
                  </p>
                  {review.pros && review.pros.length > 0 && (
                    <div className="pros-cons">
                      <div className="pros">
                        <strong>Pros:</strong>
                        <ul>
                          {review.pros.slice(0, 3).map((pro, idx) => (
                            <li key={idx}>{pro}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  {review.cons && review.cons.length > 0 && (
                    <div className="pros-cons">
                      <div className="cons">
                        <strong>Cons:</strong>
                        <ul>
                          {review.cons.slice(0, 3).map((con, idx) => (
                            <li key={idx}>{con}</li>
                          ))}
                        </ul>
                      </div>
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

          {(data.data as any)?.pagination && (
            <div className="pagination">
              <button
                onClick={() => setFilters({ ...filters, offset: Math.max(0, filters.offset - filters.limit) })}
                disabled={filters.offset === 0}
                className="pagination-button"
              >
                Previous
              </button>
              <span className="pagination-info">
                Showing {filters.offset + 1} - {Math.min(filters.offset + filters.limit, (data.data as any).pagination.total)} of {(data.data as any).pagination.total}
              </span>
              <button
                onClick={() => setFilters({ ...filters, offset: filters.offset + filters.limit })}
                disabled={!((data.data as any).pagination.hasMore)}
                className="pagination-button"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReviewsPage;














