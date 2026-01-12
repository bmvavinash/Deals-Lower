# Browser Console Testing Guide

## Prerequisites
1. Ensure both servers are running:
   - Backend: `npm run api` (should be on http://localhost:3001)
   - Frontend: `npm run frontend` (should be on http://localhost:5173)

## Manual Browser Console Testing

### Step 1: Open the Deals Page
1. Open your browser
2. Navigate to: `http://localhost:5173/deals`
3. Open Developer Console (Press F12 or Right-click → Inspect → Console tab)

### Step 2: Test API Endpoints from Console

#### Test Deals API
```javascript
fetch('http://localhost:3001/api/deals?limit=5')
  .then(r => r.json())
  .then(data => {
    console.log('✅ Deals API Response:', data);
    console.log('Deals count:', data.data?.data?.length || 0);
  })
  .catch(err => console.error('❌ Deals API Error:', err));
```

#### Test News API
```javascript
fetch('http://localhost:3001/api/news?limit=5')
  .then(r => r.json())
  .then(data => {
    console.log('✅ News API Response:', data);
    console.log('News count:', data.data?.data?.length || 0);
  })
  .catch(err => console.error('❌ News API Error:', err));
```

#### Test Reviews API
```javascript
fetch('http://localhost:3001/api/news/reviews?limit=5')
  .then(r => r.json())
  .then(data => {
    console.log('✅ Reviews API Response:', data);
    console.log('Reviews count:', data.data?.data?.length || 0);
  })
  .catch(err => console.error('❌ Reviews API Error:', err));
```

### Step 3: Test UI Elements

#### Check View Mode Tabs
```javascript
// Find all tabs
const tabs = document.querySelectorAll('.view-tab');
console.log('Found tabs:', Array.from(tabs).map(t => t.textContent.trim()));

// Check active tab
const activeTab = document.querySelector('.view-tab.active');
console.log('Active tab:', activeTab?.textContent.trim());
```

#### Test News Tab
```javascript
// Click News tab
const newsTab = Array.from(document.querySelectorAll('.view-tab, button'))
  .find(btn => btn.textContent.includes('News'));
if (newsTab) {
  newsTab.click();
  setTimeout(() => {
    const newsContent = document.querySelector('.content-list');
    const newsCards = document.querySelectorAll('.content-card');
    console.log('✅ News tab clicked');
    console.log('News cards found:', newsCards.length);
    console.log('Has content list:', !!newsContent);
  }, 2000);
} else {
  console.log('❌ News tab not found');
}
```

#### Test Reviews Tab
```javascript
// Click Reviews tab
const reviewsTab = Array.from(document.querySelectorAll('.view-tab, button'))
  .find(btn => btn.textContent.includes('Reviews'));
if (reviewsTab) {
  reviewsTab.click();
  setTimeout(() => {
    const reviewsContent = document.querySelector('.content-list');
    const reviewsCards = document.querySelectorAll('.content-card');
    console.log('✅ Reviews tab clicked');
    console.log('Review cards found:', reviewsCards.length);
    console.log('Has content list:', !!reviewsContent);
  }, 2000);
} else {
  console.log('❌ Reviews tab not found');
}
```

#### Test Trigger Buttons
```javascript
// Find all trigger buttons
const triggerButtons = Array.from(document.querySelectorAll('.trigger-button, button'))
  .filter(btn => {
    const text = btn.textContent.trim();
    return text.includes('Trigger') || text.includes('Bulk') || 
           text.includes('Telegram') || text.includes('News');
  });
console.log('Trigger buttons found:', triggerButtons.map(b => b.textContent.trim()));
console.log('Button states:', triggerButtons.map(b => ({ 
  text: b.textContent.trim(), 
  disabled: b.disabled 
})));
```

### Step 4: Test Data Display

#### Check Deals Data
```javascript
// Wait for deals to load, then check
setTimeout(() => {
  const deals = document.querySelectorAll('.deal-card, .expandable-deal-card');
  console.log('Deals displayed:', deals.length);
  
  if (deals.length > 0) {
    const firstDeal = deals[0];
    console.log('First deal:', {
      title: firstDeal.querySelector('.deal-title, h3')?.textContent,
      price: firstDeal.querySelector('.price')?.textContent,
      discount: firstDeal.querySelector('.discount')?.textContent
    });
  }
}, 3000);
```

#### Check News Data (after clicking News tab)
```javascript
// After clicking News tab, wait and check
setTimeout(() => {
  const newsCards = document.querySelectorAll('.content-card');
  console.log('News articles displayed:', newsCards.length);
  
  if (newsCards.length > 0) {
    const firstNews = newsCards[0];
    console.log('First news article:', {
      title: firstNews.querySelector('.content-title')?.textContent,
      category: firstNews.querySelector('.category-badge')?.textContent,
      date: firstNews.querySelector('.date')?.textContent
    });
  } else {
    const emptyState = document.querySelector('.empty-state');
    if (emptyState) {
      console.log('Empty state message:', emptyState.textContent);
    }
  }
}, 3000);
```

#### Check Reviews Data (after clicking Reviews tab)
```javascript
// After clicking Reviews tab, wait and check
setTimeout(() => {
  const reviewCards = document.querySelectorAll('.content-card');
  console.log('Reviews displayed:', reviewCards.length);
  
  if (reviewCards.length > 0) {
    const firstReview = reviewCards[0];
    console.log('First review:', {
      product: firstReview.querySelector('.content-title')?.textContent,
      rating: firstReview.querySelector('.rating-value')?.textContent,
      date: firstReview.querySelector('.date')?.textContent
    });
  } else {
    const emptyState = document.querySelector('.empty-state');
    if (emptyState) {
      console.log('Empty state message:', emptyState.textContent);
    }
  }
}, 3000);
```

### Step 5: Test Filters

#### Test News Filters
```javascript
// After clicking News tab
const categoryFilter = document.querySelector('.content-filters select');
if (categoryFilter) {
  console.log('Category filter options:', 
    Array.from(categoryFilter.options).map(o => o.text));
  
  // Test changing filter
  categoryFilter.value = 'mobile';
  categoryFilter.dispatchEvent(new Event('change'));
  console.log('✅ Category filter changed to mobile');
}
```

#### Test Reviews Filters
```javascript
// After clicking Reviews tab
const productFilter = document.querySelector('.filter-input');
const ratingFilter = document.querySelectorAll('.filter-select')[0];

if (productFilter) {
  productFilter.value = 'iPhone';
  productFilter.dispatchEvent(new Event('input'));
  console.log('✅ Product filter set to iPhone');
}

if (ratingFilter) {
  ratingFilter.value = '4';
  ratingFilter.dispatchEvent(new Event('change'));
  console.log('✅ Rating filter set to 4+');
}
```

### Step 6: Test Pagination

```javascript
// Check if pagination exists
const pagination = document.querySelector('.pagination');
if (pagination) {
  const prevBtn = pagination.querySelector('.pagination-button:first-child');
  const nextBtn = pagination.querySelector('.pagination-button:last-child');
  const info = pagination.querySelector('.pagination-info');
  
  console.log('Pagination found:', {
    hasPrev: !!prevBtn && !prevBtn.disabled,
    hasNext: !!nextBtn && !nextBtn.disabled,
    info: info?.textContent
  });
  
  // Test next page
  if (nextBtn && !nextBtn.disabled) {
    nextBtn.click();
    console.log('✅ Next page clicked');
  }
}
```

### Step 7: Check for Errors

```javascript
// Check console for errors (should be done manually by looking at console)
// Also check network tab for failed requests

// Check for React errors
window.addEventListener('error', (e) => {
  console.error('❌ Global error:', e.error);
});

// Check for unhandled promise rejections
window.addEventListener('unhandledrejection', (e) => {
  console.error('❌ Unhandled promise rejection:', e.reason);
});
```

## Automated Test Script

Run the automated test:
```bash
node test_console_simple.js
```

This will:
1. Wait for servers to be ready
2. Launch a browser
3. Navigate to the Deals page
4. Test all API endpoints from browser console
5. Test UI interactions (tabs, buttons)
6. Report results

## Expected Results

### API Tests
- ✅ Deals API: Should return 200 status with deals data
- ✅ News API: Should return 200 status with news data (may be empty if not scraped yet)
- ✅ Reviews API: Should return 200 status with reviews data (may be empty if not scraped yet)

### UI Tests
- ✅ View mode tabs should be visible (Deals, News, Reviews)
- ✅ Clicking News tab should show news content or empty state
- ✅ Clicking Reviews tab should show reviews content or empty state
- ✅ Trigger buttons should be visible and clickable
- ✅ No console errors should appear

## Troubleshooting

1. **Servers not responding**: 
   - Check if ports 3001 and 5173 are in use
   - Verify servers are running in separate terminals
   - Check for error messages in server terminal windows

2. **CORS errors**:
   - Ensure backend CORS is configured correctly
   - Check `server/api/index.js` for CORS settings

3. **Empty data**:
   - News/Reviews may be empty if scraping hasn't been run
   - Click "Trigger News & Reviews" button to start scraping
   - Wait a few minutes for data to populate

4. **Tabs not found**:
   - Verify `DealsPage.tsx` has the view mode tabs
   - Check browser console for React errors
   - Ensure CSS classes match (`.view-tab`)














