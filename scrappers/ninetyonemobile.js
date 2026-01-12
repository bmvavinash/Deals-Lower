/**
 * 91Mobile News and Reviews Scraper
 * Scrapes news articles and product reviews from 91mobile.com
 */

const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('ninetyonemobile');

/**
 * Initialize Chrome WebDriver for scraping
 */
async function initializeDriver() {
  const options = new chrome.Options();
  options.addArguments('--headless=new');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--window-size=1920,1080');
  options.addArguments('--disable-blink-features=AutomationControlled');
  options.addArguments('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
  options.excludeSwitches(['enable-automation']);

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  return driver;
}

/**
 * Extract news article data from 91mobile news page
 * @param {Object} driver - Selenium WebDriver instance
 * @param {string} url - URL of the news article
 * @returns {Object} Extracted news data
 */
async function extractNewsArticle(driver, url) {
  try {
    logger.info('Extracting news article', { url });
    await driver.get(url);
    await driver.wait(until.elementLocated(By.css('body')), 10000);

    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    const newsData = {
      url: url,
      type: 'news',
      scrapedAt: new Date().toISOString(),
      source: '91mobile'
    };

    // Extract title
    try {
      const titleElement = await driver.findElement(By.css('h1, .article-title, .post-title, [class*="title"]'));
      newsData.title = await titleElement.getText();
    } catch (e) {
      logger.warn('Title not found', { url });
      newsData.title = '';
    }

    // Extract author
    try {
      const authorSelectors = [
        '.author-name',
        '.by-author',
        '[class*="author"]',
        '[rel="author"]',
        'meta[name="author"]'
      ];
      for (const selector of authorSelectors) {
        try {
          const authorElement = await driver.findElement(By.css(selector));
          newsData.author = await authorElement.getText();
          if (newsData.author) break;
        } catch (e) {
          // Try next selector
        }
      }
      // Fallback to meta tag
      if (!newsData.author) {
        try {
          const metaAuthor = await driver.findElement(By.css('meta[name="author"]'));
          newsData.author = await metaAuthor.getAttribute('content');
        } catch (e) {}
      }
    } catch (e) {
      logger.debug('Author not found', { url });
    }

    // Extract publish date
    try {
      const dateSelectors = [
        'time[datetime]',
        '.publish-date',
        '.post-date',
        '[class*="date"]',
        'meta[property="article:published_time"]'
      ];
      for (const selector of dateSelectors) {
        try {
          const dateElement = await driver.findElement(By.css(selector));
          newsData.publishDate = await dateElement.getAttribute('datetime') || await dateElement.getText();
          if (newsData.publishDate) break;
        } catch (e) {
          // Try next selector
        }
      }
      // Fallback to meta tag
      if (!newsData.publishDate) {
        try {
          const metaDate = await driver.findElement(By.css('meta[property="article:published_time"]'));
          newsData.publishDate = await metaDate.getAttribute('content');
        } catch (e) {}
      }
    } catch (e) {
      logger.debug('Publish date not found', { url });
    }

    // Extract content/description
    try {
      const contentSelectors = [
        '.article-content',
        '.post-content',
        '.entry-content',
        '[class*="content"]',
        'article p',
        'meta[name="description"]'
      ];
      for (const selector of contentSelectors) {
        try {
          const contentElements = await driver.findElements(By.css(selector));
          if (contentElements.length > 0) {
            const texts = await Promise.all(
              contentElements.slice(0, 5).map(el => el.getText())
            );
            newsData.content = texts.join(' ').substring(0, 1000); // Limit to 1000 chars
            if (newsData.content) break;
          }
        } catch (e) {
          // Try next selector
        }
      }
      // Fallback to meta description
      if (!newsData.content) {
        try {
          const metaDesc = await driver.findElement(By.css('meta[name="description"]'));
          newsData.content = await metaDesc.getAttribute('content');
        } catch (e) {}
      }
    } catch (e) {
      logger.debug('Content not found', { url });
    }

    // Extract images
    try {
      const imageElements = await driver.findElements(By.css('article img, .article-content img, .post-content img'));
      newsData.images = [];
      for (let i = 0; i < Math.min(5, imageElements.length); i++) {
        try {
          const imgSrc = await imageElements[i].getAttribute('src');
          const imgAlt = await imageElements[i].getAttribute('alt') || '';
          if (imgSrc && !imgSrc.includes('data:image')) {
            newsData.images.push({
              url: imgSrc.startsWith('http') ? imgSrc : new URL(imgSrc, url).href,
              alt: imgAlt
            });
          }
        } catch (e) {
          // Skip this image
        }
      }
      // Fallback to og:image
      if (newsData.images.length === 0) {
        try {
          const ogImage = await driver.findElement(By.css('meta[property="og:image"]'));
          const ogImageUrl = await ogImage.getAttribute('content');
          if (ogImageUrl) {
            newsData.images.push({ url: ogImageUrl, alt: newsData.title || '' });
          }
        } catch (e) {}
      }
    } catch (e) {
      logger.debug('Images not found', { url });
    }

    // Extract tags/categories
    try {
      const tagElements = await driver.findElements(By.css('.tags a, .categories a, [class*="tag"] a, [rel="tag"]'));
      newsData.tags = [];
      for (const tagEl of tagElements) {
        try {
          const tagText = await tagEl.getText();
          if (tagText) newsData.tags.push(tagText.trim());
        } catch (e) {}
      }
    } catch (e) {
      logger.debug('Tags not found', { url });
    }

    // Extract category
    try {
      const categorySelectors = [
        '.category',
        '.post-category',
        '[class*="category"]',
        'meta[property="article:section"]'
      ];
      for (const selector of categorySelectors) {
        try {
          const catElement = await driver.findElement(By.css(selector));
          newsData.category = await catElement.getText() || await catElement.getAttribute('content');
          if (newsData.category) break;
        } catch (e) {
          // Try next selector
        }
      }
    } catch (e) {
      logger.debug('Category not found', { url });
    }

    // Generate unique ID from URL
    const urlMatch = url.match(/\/([^\/]+)\/?$/);
    newsData.id = urlMatch ? urlMatch[1].replace(/\.html$/, '') : url.split('/').pop().replace(/\.html$/, '');

    logger.info('News article extracted successfully', { url, id: newsData.id });
    return newsData;

  } catch (error) {
    logger.error('Error extracting news article', { url, error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Extract product review data from 91mobile review page
 * @param {Object} driver - Selenium WebDriver instance
 * @param {string} url - URL of the review article
 * @returns {Object} Extracted review data
 */
async function extractReviewArticle(driver, url) {
  try {
    logger.info('Extracting review article', { url });
    await driver.get(url);
    await driver.wait(until.elementLocated(By.css('body')), 10000);

    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    const reviewData = {
      url: url,
      type: 'review',
      scrapedAt: new Date().toISOString(),
      source: '91mobile'
    };

    // Extract product name (usually in title or h1)
    try {
      const titleElement = await driver.findElement(By.css('h1, .product-name, .review-title, [class*="title"]'));
      reviewData.productName = await titleElement.getText();
      reviewData.title = reviewData.productName;
    } catch (e) {
      logger.warn('Product name not found', { url });
      reviewData.productName = '';
      reviewData.title = '';
    }

    // Extract rating
    try {
      const ratingSelectors = [
        '.rating',
        '.review-rating',
        '[class*="rating"]',
        'meta[property="rating:value"]'
      ];
      for (const selector of ratingSelectors) {
        try {
          const ratingElement = await driver.findElement(By.css(selector));
          const ratingText = await ratingElement.getText() || await ratingElement.getAttribute('content');
          const ratingMatch = ratingText.match(/(\d+\.?\d*)\/5/);
          if (ratingMatch) {
            reviewData.rating = parseFloat(ratingMatch[1]);
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }
    } catch (e) {
      logger.debug('Rating not found', { url });
    }

    // Extract pros and cons
    try {
      const prosElements = await driver.findElements(By.css('.pros li, .advantages li, [class*="pro"] li'));
      reviewData.pros = [];
      for (const proEl of prosElements) {
        try {
          const proText = await proEl.getText();
          if (proText) reviewData.pros.push(proText.trim());
        } catch (e) {}
      }
    } catch (e) {
      logger.debug('Pros not found', { url });
    }

    try {
      const consElements = await driver.findElements(By.css('.cons li, .disadvantages li, [class*="con"] li'));
      reviewData.cons = [];
      for (const conEl of consElements) {
        try {
          const conText = await conEl.getText();
          if (conText) reviewData.cons.push(conText.trim());
        } catch (e) {}
      }
    } catch (e) {
      logger.debug('Cons not found', { url });
    }

    // Extract verdict/conclusion
    try {
      const verdictSelectors = [
        '.verdict',
        '.conclusion',
        '.summary',
        '[class*="verdict"]'
      ];
      for (const selector of verdictSelectors) {
        try {
          const verdictElement = await driver.findElement(By.css(selector));
          reviewData.verdict = await verdictElement.getText();
          if (reviewData.verdict) break;
        } catch (e) {
          // Try next selector
        }
      }
    } catch (e) {
      logger.debug('Verdict not found', { url });
    }

    // Extract author, date, content, images (same as news)
    try {
      const authorElement = await driver.findElement(By.css('.author-name, .by-author, [class*="author"], meta[name="author"]'));
      reviewData.author = await authorElement.getText() || await authorElement.getAttribute('content');
    } catch (e) {
      logger.debug('Author not found', { url });
    }

    try {
      const dateElement = await driver.findElement(By.css('time[datetime], .publish-date, meta[property="article:published_time"]'));
      reviewData.publishDate = await dateElement.getAttribute('datetime') || await dateElement.getAttribute('content') || await dateElement.getText();
    } catch (e) {
      logger.debug('Publish date not found', { url });
    }

    try {
      const contentElements = await driver.findElements(By.css('.review-content, .article-content, article p'));
      const texts = await Promise.all(
        contentElements.slice(0, 10).map(el => el.getText())
      );
      reviewData.content = texts.join(' ').substring(0, 2000);
    } catch (e) {
      logger.debug('Content not found', { url });
    }

    try {
      const imageElements = await driver.findElements(By.css('.review-content img, article img'));
      reviewData.images = [];
      for (let i = 0; i < Math.min(5, imageElements.length); i++) {
        try {
          const imgSrc = await imageElements[i].getAttribute('src');
          const imgAlt = await imageElements[i].getAttribute('alt') || '';
          if (imgSrc && !imgSrc.includes('data:image')) {
            reviewData.images.push({
              url: imgSrc.startsWith('http') ? imgSrc : new URL(imgSrc, url).href,
              alt: imgAlt
            });
          }
        } catch (e) {}
      }
    } catch (e) {
      logger.debug('Images not found', { url });
    }

    // Generate unique ID
    const urlMatch = url.match(/\/([^\/]+)\/?$/);
    reviewData.id = urlMatch ? urlMatch[1].replace(/\.html$/, '') : url.split('/').pop().replace(/\.html$/, '');

    logger.info('Review article extracted successfully', { url, id: reviewData.id });
    return reviewData;

  } catch (error) {
    logger.error('Error extracting review article', { url, error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Get list of news/review URLs from 91mobile listing pages
 * @param {Object} driver - Selenium WebDriver instance
 * @param {string} listingUrl - URL of the listing page (e.g., news listing, reviews listing)
 * @param {number} maxPages - Maximum number of pages to scrape
 * @returns {Array<string>} Array of article URLs
 */
async function getArticleUrls(driver, listingUrl, maxPages = 5) {
  try {
    logger.info('Fetching article URLs from listing', { listingUrl, maxPages });
    const articleUrls = [];
    const visitedUrls = new Set();

    for (let page = 1; page <= maxPages; page++) {
      try {
        const pageUrl = listingUrl.includes('?') 
          ? `${listingUrl}&page=${page}` 
          : `${listingUrl}?page=${page}`;

        logger.info('Fetching page', { page, url: pageUrl });
        await driver.get(pageUrl);
        await driver.wait(until.elementLocated(By.css('body')), 10000);
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Find article links
        // Updated to support /hub/ for news and /reviews/ for reviews
        const linkSelectors = [
          'a[href*="/hub/"]',
          'a[href*="/news/"]',
          'a[href*="/reviews/"]',
          'a[href*="/article/"]',
          '.article-link',
          '.post-link',
          'h2 a, h3 a',
          '.news-item a',
          '.review-item a'
        ];

        for (const selector of linkSelectors) {
          try {
            const linkElements = await driver.findElements(By.css(selector));
            for (const linkEl of linkElements) {
              try {
                const href = await linkEl.getAttribute('href');
                if (href) {
                  const fullUrl = href.startsWith('http') ? href : new URL(href, 'https://www.91mobiles.com').href;
                  
                  // Filter out pagination, category, and listing pages
                  const urlLower = fullUrl.toLowerCase();
                  const isPagination = urlLower.includes('?page=') || urlLower.includes('/page/') || urlLower.includes('page=');
                  const isCategoryListing = urlLower.includes('/category/') || urlLower.includes('/hub/category/');
                  const isListingPage = urlLower.endsWith('/hub/') || urlLower.endsWith('/reviews/') || urlLower.endsWith('/news/');
                  const isInvalid = urlLower.includes('?page=1') || urlLower.match(/\/page\/\d+\//);
                  
                  // For reviews, check if URL contains /reviews/ with a slug
                  // For news, check if URL contains /hub/ with a slug
                  const isReviewUrl = isReviewsPage && /\/reviews\/[^\/]+\/?$/.test(fullUrl);
                  const isNewsUrl = !isReviewsPage && (href.includes('/hub/') || href.includes('/news/') || href.includes('/article/'));
                  const hasArticleSlug = isReviewUrl || (isNewsUrl && (/\/hub\/[^\/]+\/?$/.test(fullUrl) || /\/news\/[^\/]+\/?$/.test(fullUrl) || /\/article\/[^\/]+\/?$/.test(fullUrl)));
                  
                  if (!isPagination && !isCategoryListing && !isListingPage && !isInvalid && hasArticleSlug && !visitedUrls.has(fullUrl)) {
                    articleUrls.push(fullUrl);
                    visitedUrls.add(fullUrl);
                  }
                }
              } catch (e) {
                // Skip this link
              }
            }
          } catch (e) {
            // Try next selector
          }
        }

        // Check if there's a next page
        try {
          const nextButton = await driver.findElement(By.css('.next, .pagination-next, [class*="next"]'));
          const isEnabled = await nextButton.isEnabled();
          if (!isEnabled) break;
        } catch (e) {
          // No next button found, assume last page
          break;
        }

      } catch (error) {
        logger.warn('Error fetching page', { page, error: error.message });
        break;
      }
    }

    logger.info('Found article URLs', { count: articleUrls.length });
    return articleUrls;

  } catch (error) {
    logger.error('Error getting article URLs', { listingUrl, error: error.message });
    throw error;
  }
}

module.exports = {
  initializeDriver,
  extractNewsArticle,
  extractReviewArticle,
  getArticleUrls
};

