# Error Diagnostics Guide

## Current Issues and Logging

### Issue 1: "Cannot read properties of undefined (reading 'ajio'/'myntra')"

**Location**: This error occurs when trying to access platform configuration from `storeMap`.

**Where it happens**:
- `pageScheduler.js` line 31: `const { getCode, storeType } = storeMap[storeKey];`
- `dataSources/batchProductExtractor.js`: When detecting platform from URL

**Logging Added**:
- ✅ Validation of `storeMap` before access
- ✅ Logging of available platforms when platform not found
- ✅ Error context with URL and categoryKey
- ✅ Stack traces for debugging

**What to Check**:
1. Verify `config/const.js` exports `storeMap` correctly
2. Check if `storeMap` is imported in all files that use it
3. Verify the platform keys match between `PLATFORM_SEEDS` and `storeMap`

### Issue 2: "this.executionHistory.unshift is not a function"

**Location**: `services/executionTracker.js` in `completeBulkExecution` method

**Root Cause**: Firebase listener may overwrite `executionHistory` with a non-array value

**Fixes Applied**:
- ✅ Robust type checking before using `unshift`
- ✅ Conversion of object to array if needed
- ✅ Initialization as empty array if null/undefined
- ✅ Error handling with detailed logging

**What to Check**:
1. Check Firebase database structure for `executionTracking/history`
2. Verify it's stored as an array, not an object
3. Check if Firebase listener is overwriting the array

## Logging Points Added

### Entry Points
- `runBulkUpdateAll`: Logs platform count and list
- `runBulkUpdateForPlatform`: Logs platform being processed
- `runBulkUpdateForCategory`: Logs category and URL count
- `extractAndStoreFromUrl`: Logs URL and platform detection

### Error Points
- StoreMap validation errors
- Config loading failures
- Execution tracker errors (non-blocking)
- Batch processing errors

### Success Points
- Config loaded successfully
- Platform detected
- Execution tracker updated
- Batch completed

## Required Information for Full Fix

If errors persist, please provide:

1. **Full Stack Trace**: Complete error stack from backend logs
2. **Firebase Structure**: Check `executionTracking/history` in Firebase - is it an array or object?
3. **storeMap Verification**: 
   ```javascript
   const { storeMap } = require('./config/const');
   console.log('storeMap:', storeMap);
   console.log('Keys:', Object.keys(storeMap));
   ```
4. **Platform Detection**: Check if URLs contain platform names correctly
5. **Config Files**: Verify all PageConfig files exist and are valid

## Next Steps

1. Restart backend server to apply logging changes
2. Trigger bulk update
3. Check logs for detailed error information
4. Share error logs with full context
















