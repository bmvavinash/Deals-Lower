# Browser Console Debugging Guide

## Steps to Check Frontend Issues:

1. **Open the Dashboard:**
   - Go to: http://localhost:3000/dashboard (or http://localhost:5173/dashboard if port 3000 didn't work)

2. **Open Browser DevTools:**
   - Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - Or right-click → "Inspect"

3. **Check Console Tab:**
   - Look for RED errors
   - Common errors to check:
     - `Failed to fetch` - API connection issue
     - `404` - Route not found
     - `CORS` - Cross-origin issue
     - React component errors

4. **Check Network Tab:**
   - Filter by "XHR" or "Fetch"
   - Look for API calls to `/api/deals/process-product`
   - Check status codes:
     - `200` = Success
     - `404` = Route not found
     - `500` = Server error
     - `CORS error` = Backend not allowing frontend origin

5. **Paste this in Console to Test:**

```javascript
// Test if Process Product section exists
const section = document.querySelector('h2');
if (section && section.textContent.includes('Process Product')) {
  console.log('✅ Process Product section found');
} else {
  console.error('❌ Process Product section NOT found');
  console.log('Available h2 elements:', Array.from(document.querySelectorAll('h2')).map(h => h.textContent));
}

// Test API configuration
console.log('Expected API URL: http://localhost:5174/api/deals/process-product');

// Check for React errors
window.addEventListener('error', (e) => {
  console.error('❌ JavaScript Error:', e.error);
});

// Monitor API calls
const originalFetch = window.fetch;
window.fetch = function(...args) {
  console.log('🌐 Fetch call:', args[0]);
  const promise = originalFetch.apply(this, args);
  promise.then(response => {
    console.log('✅ Response:', response.status, args[0]);
  }).catch(error => {
    console.error('❌ Fetch error:', error, args[0]);
  });
  return promise;
};
```

6. **Test the Form:**
   - Enter a product URL (e.g., https://www.amazon.in/...)
   - Click Submit
   - Watch the Console for API calls and responses
   - Check the Network tab for the actual request/response

## Common Issues:

- **404 on API call:** Backend route not registered or wrong port
- **CORS error:** Backend needs to allow frontend origin
- **Component not rendering:** Check React errors in console
- **Form not visible:** Check if Dashboard component is loading correctly
