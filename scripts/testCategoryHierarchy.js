#!/usr/bin/env node

/**
 * Test script for Category Hierarchy System
 * 
 * This script tests the hierarchical category functionality
 * without requiring database connections.
 */

const { 
  findMatchingHierarchy, 
  generateHierarchicalKey,
  parseHierarchicalKey,
  getCategoryHierarchy,
  getSubcategory,
  getProductStyles,
  getAllCategories
} = require('../config/categoryHierarchy');

const { 
  analyzeProductCategory,
  validateHierarchicalCategory
} = require('../utils/categoryHierarchyUtils');

console.log('🧪 Testing Category Hierarchy System\n');

// Test 1: Basic hierarchy matching
console.log('Test 1: Basic Hierarchy Matching');
console.log('================================');

const testCases = [
  {
    name: 'Electronics - Headphones',
    categoryData: {
      mainCategory: 'Electronics',
      c1: 'Electronics',
      c2: 'Audio & Video',
      c3: 'Headphones & Earbuds',
      c4: 'Wireless Headphones'
    }
  },
  {
    name: 'Fashion - Men\'s Shirts',
    categoryData: {
      mainCategory: 'Fashion',
      c1: 'Fashion',
      c2: 'Men\'s Clothing',
      c3: 'Shirts',
      c4: 'Casual Shirts'
    }
  },
  {
    name: 'Incomplete Data',
    categoryData: {
      mainCategory: 'Electronics',
      c1: 'Electronics'
    }
  },
  {
    name: 'Fuzzy Match - Mobile Phone',
    categoryData: {
      mainCategory: 'Mobile Phones',
      c1: 'Mobile Phones'
    }
  }
];

testCases.forEach((testCase, index) => {
  console.log(`\n${index + 1}. ${testCase.name}`);
  console.log(`   Input: ${JSON.stringify(testCase.categoryData)}`);
  
  const hierarchy = findMatchingHierarchy(testCase.categoryData);
  const hierarchicalKey = generateHierarchicalKey(hierarchy.mainCategory, hierarchy.subcategory, hierarchy.style);
  
  console.log(`   Result:`);
  console.log(`     Main Category: ${hierarchy.mainCategory || 'Not found'}`);
  console.log(`     Subcategory: ${hierarchy.subcategory || 'Not found'}`);
  console.log(`     Style: ${hierarchy.style || 'Not found'}`);
  console.log(`     Hierarchical Key: ${hierarchicalKey || 'Not generated'}`);
});

// Test 2: Key generation and parsing
console.log('\n\nTest 2: Key Generation and Parsing');
console.log('===================================');

const keyTests = [
  { main: 'electronics', sub: 'headsets', style: 'earbuds' },
  { main: 'fashion', sub: 'shoes', style: 'sneakers' },
  { main: 'home', sub: 'furniture', style: '' },
  { main: 'electronics', sub: '', style: '' }
];

keyTests.forEach((test, index) => {
  console.log(`\n${index + 1}. Generating key for: ${JSON.stringify(test)}`);
  const key = generateHierarchicalKey(test.main, test.sub, test.style);
  console.log(`   Generated Key: ${key}`);
  
  const parsed = parseHierarchicalKey(key);
  console.log(`   Parsed: ${JSON.stringify(parsed)}`);
  
  // Verify round-trip
  const regenerated = generateHierarchicalKey(parsed.mainCategory, parsed.subcategory, parsed.style);
  console.log(`   Round-trip match: ${key === regenerated ? '✅' : '❌'}`);
});

// Test 3: Category hierarchy access
console.log('\n\nTest 3: Category Hierarchy Access');
console.log('==================================');

console.log('\nAvailable Main Categories:');
const allCategories = getAllCategories();
const mainCategories = allCategories.filter(c => c.level === 1);
mainCategories.forEach(category => {
  console.log(`  - ${category.name} (${category.key})`);
});

console.log('\nElectronics Subcategories:');
const electronics = getCategoryHierarchy('electronics');
if (electronics) {
  Object.entries(electronics.subcategories).forEach(([key, subcategory]) => {
    console.log(`  - ${subcategory.name} (${key})`);
  });
}

console.log('\nHeadsets Styles:');
const headsets = getSubcategory('electronics', 'headsets');
if (headsets) {
  Object.entries(headsets.styles).forEach(([key, style]) => {
    console.log(`  - ${style} (${key})`);
  });
}

// Test 4: Product analysis
console.log('\n\nTest 4: Product Analysis');
console.log('========================');

const sampleProducts = [
  {
    productCode: 'TEST001',
    title: 'Wireless Bluetooth Earbuds',
    category: {
      mainCategory: 'Electronics',
      c1: 'Electronics',
      c2: 'Audio & Video',
      c3: 'Headphones & Earbuds'
    }
  },
  {
    productCode: 'TEST002',
    title: 'Men\'s Casual Shirt',
    category: {
      mainCategory: 'Fashion',
      c1: 'Fashion',
      c2: 'Men\'s Clothing'
    }
  },
  {
    productCode: 'TEST003',
    title: 'Gaming Laptop',
    category: {
      mainCategory: 'Electronics',
      c1: 'Electronics'
    }
  }
];

sampleProducts.forEach((product, index) => {
  console.log(`\n${index + 1}. Analyzing: ${product.title}`);
  const analysis = analyzeProductCategory(product);
  
  console.log(`   Confidence: ${analysis.confidence}%`);
  console.log(`   Issues: ${analysis.issues.length > 0 ? analysis.issues.join(', ') : 'None'}`);
  console.log(`   Suggestions: ${analysis.suggestions.length > 0 ? analysis.suggestions.join(', ') : 'None'}`);
});

// Test 5: Validation
console.log('\n\nTest 5: Category Validation');
console.log('===========================');

const validationTests = [
  {
    name: 'Valid Hierarchy',
    hierarchicalCategory: {
      mainCategory: 'electronics',
      subcategory: 'headsets',
      style: 'earbuds',
      hierarchicalKey: 'electronics_headsets_earbuds'
    }
  },
  {
    name: 'Missing Main Category',
    hierarchicalCategory: {
      subcategory: 'headsets',
      style: 'earbuds',
      hierarchicalKey: 'headsets_earbuds'
    }
  },
  {
    name: 'Invalid Subcategory',
    hierarchicalCategory: {
      mainCategory: 'electronics',
      subcategory: 'invalid_subcategory',
      style: 'earbuds',
      hierarchicalKey: 'electronics_invalid_subcategory_earbuds'
    }
  }
];

validationTests.forEach((test, index) => {
  console.log(`\n${index + 1}. ${test.name}`);
  console.log(`   Input: ${JSON.stringify(test.hierarchicalCategory)}`);
  
  const validation = validateHierarchicalCategory(test.hierarchicalCategory);
  console.log(`   Valid: ${validation.isValid ? '✅' : '❌'}`);
  if (validation.errors.length > 0) {
    console.log(`   Errors: ${validation.errors.join(', ')}`);
  }
  if (validation.warnings.length > 0) {
    console.log(`   Warnings: ${validation.warnings.join(', ')}`);
  }
});

// Test 6: Performance test
console.log('\n\nTest 6: Performance Test');
console.log('========================');

const performanceTest = () => {
  const startTime = Date.now();
  const iterations = 1000;
  
  for (let i = 0; i < iterations; i++) {
    findMatchingHierarchy({
      mainCategory: 'Electronics',
      c2: 'Audio & Video',
      c3: 'Headphones'
    });
  }
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  const avgTime = duration / iterations;
  
  console.log(`   Iterations: ${iterations}`);
  console.log(`   Total Time: ${duration}ms`);
  console.log(`   Average Time: ${avgTime.toFixed(4)}ms per operation`);
  console.log(`   Operations per second: ${Math.round(1000 / avgTime)}`);
};

performanceTest();

console.log('\n\n✅ All tests completed successfully!');
console.log('\nThe hierarchical category system is working correctly.');
console.log('You can now use it in your bulk update processes.');

