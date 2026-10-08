// Browser Console Test Script
// Open http://localhost:3000/dashboard and paste this in the console

console.log('=== Testing Product Processing ===');

// Test 1: Check if Dashboard component is loaded
const dashboardSection = document.querySelector('h2');
if (dashboardSection && dashboardSection.textContent.includes('Process Product')) {
  console.log('✅ Process Product section found');
} else {
  console.error('❌ Process Product section NOT found');
}

// Test 2: Check for API configuration
console.log('API Base URL should be: http://localhost:5174/api');

// Test 3: Check for React errors
window.addEventListener('error', (e) => {
  console.error('❌ JavaScript Error:', e.error);
});

// Test 4: Check for API calls
const originalFetch = window.fetch;
window.fetch = function(...args) {
  console.log('🌐 API Call:', args[0]);
  return originalFetch.apply(this, args);
};

console.log('✅ Test script loaded. Try submitting a product URL.');
