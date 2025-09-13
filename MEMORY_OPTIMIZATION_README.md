# Memory Optimization for Product Extraction

## Overview
The product extraction system has been optimized to prevent JavaScript heap out of memory errors that commonly occur when scraping large e-commerce sites.

## Memory Optimizations Applied

### 1. Page Scheduler Optimizations
- **Reduced scroll iterations**: From 20 to 15 iterations
- **Faster scroll completion**: Reduced stable tick threshold from 4 to 3
- **Smaller scroll distances**: From 1000px to 800px per scroll
- **Reduced sleep times**: From 500ms to 300ms between scrolls
- **Garbage collection**: Added `window.gc()` calls during scrolling
- **Reduced pagination**: From 3 pages to 2 pages maximum
- **Memory cleanup**: Clear element references after use

### 2. Batch Product Extractor Optimizations
- **Chrome flags**: Added memory optimization flags
- **Garbage collection**: Added `window.gc()` calls after each URL
- **Memory cleanup**: Clear memory after each page type attempt
- **Error handling**: Memory cleanup on errors

### 3. Chrome Browser Optimizations
- `--memory-pressure-off`: Disables memory pressure handling
- `--disable-background-timer-throttling`: Prevents background throttling
- `--disable-backgrounding-occluded-windows`: Keeps windows active
- `--disable-renderer-backgrounding`: Prevents renderer backgrounding
- `--disable-features=TranslateUI`: Disables translation UI
- `--disable-ipc-flooding-protection`: Disables IPC protection

## Usage

### Option 1: Use Memory-Optimized Scripts (Recommended)

#### Windows
```bash
# Run with increased heap size
scripts\debugExtractor.bat https://www.myntra.com/men-tshirts searchPage

# Or manually with parameters
node --max-old-space-size=4096 --expose-gc scripts/debugExtractor.js https://www.myntra.com/men-tshirts searchPage
```

#### Unix/Linux/Mac
```bash
# Make script executable first
chmod +x scripts/debugExtractor.sh

# Run with increased heap size
./scripts/debugExtractor.sh https://www.myntra.com/men-tshirts searchPage

# Or manually with parameters
node --max-old-space-size=4096 --expose-gc scripts/debugExtractor.js https://www.myntra.com/men-tshirts searchPage
```

### Option 2: Test Memory Optimization
```bash
# Test if memory optimizations are working
node --expose-gc scripts/testMemoryOptimization.js
```

## Memory Flags Explained

- `--max-old-space-size=4096`: Increases Node.js heap size to 4GB
- `--expose-gc`: Enables manual garbage collection
- `--memory-pressure-off`: Disables Chrome's memory pressure handling

## Troubleshooting

### Still Getting Out of Memory?
1. **Increase heap size further**:
   ```bash
   node --max-old-space-size=8192 --expose-gc scripts/debugExtractor.js [URL] [PAGETYPE]
   ```

2. **Reduce extraction scope**:
   - Use fewer URLs in batch mode
   - Reduce pagination pages (already reduced to 2)
   - Use specific page types instead of trying all

3. **Check system resources**:
   - Ensure you have at least 8GB RAM available
   - Close other memory-intensive applications
   - Monitor memory usage during extraction

### Performance vs Memory Trade-offs
- **Faster extraction**: More memory usage, higher risk of OOM
- **Memory efficient**: Slower extraction, lower risk of OOM
- **Balanced approach**: Current optimizations provide good balance

## Monitoring Memory Usage

The system now logs memory usage and performs automatic cleanup. Watch for:
- Garbage collection messages in logs
- Memory cleanup after each URL/page
- Reduced memory footprint during extraction

## Best Practices

1. **Always use memory-optimized scripts** for production
2. **Monitor system resources** during extraction
3. **Run during off-peak hours** when system has more available memory
4. **Use batch mode sparingly** for very large extractions
5. **Test with small batches first** before running large extractions
