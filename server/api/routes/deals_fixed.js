/**
 * POST /api/deals/process-product
 * Process a product URL and save to database
 * Body: { url: string, postProduct: boolean }
 */
router.post('/process-product', async (req, res) => {
  let driver = null;
  try {
    const { url, postProduct = false } = req.body;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Product URL is required',
        error: 'Product URL is required'
      });
    }

    logger.info('Processing product URL', { url, postProduct });

    // Get or create driver - try to use global driver first (same instance as Telegram bot)
    if (global.driver) {
      logger.info('Using existing global driver instance');
      driver = global.driver;
      // Verify driver is still valid
      try {
        await driver.getCurrentUrl();
        logger.info('Global driver is valid');
      } catch (e) {
        logger.warn('Global driver invalid, creating new one', { error: e.message });
        driver = await getOrCreateDriver();
        global.driver = driver;
      }
    } else {
      logger.info('No global driver found, creating new one');
      driver = await getOrCreateDriver();
      global.driver = driver;
    }

    // Resolve URL in browser first (same as handleProductProcessing)
    let resolvedUrl = url;
    try {
      logger.info('Resolving URL in browser', { url, driverSession: driver ? 'exists' : 'null' });
      await driver.get(url);
      // Wait for page to load (same as idleEnrichmentProcessor - 2 seconds)
      await new Promise(resolve => setTimeout(resolve, 2000));
      resolvedUrl = await driver.getCurrentUrl() || url;
      logger.info('URL resolved', { original: url, resolved: resolvedUrl });
      
      // Debug: Check if page loaded correctly
      try {
        const pageTitle = await driver.getTitle();
        logger.info('Page loaded', { title: pageTitle.substring(0, 100), url: resolvedUrl });
      } catch (e) {
        logger.warn('Could not get page title', { error: e.message });
      }
    } catch (navError) {
      logger.error('Failed to resolve URL in browser', { url, error: navError.message, stack: navError.stack });
      // Continue with original URL if navigation fails
    }

    // Get required data (same pattern as working workflows)
    const accessToken = await getAccessToken();
    const jsonDataResult = await firebaseget();
    const jsonData = jsonDataResult?.data || jsonDataResult || {};
    const todayJsonDataResult = await firebaseget(true);
    const todayJsonData = todayJsonDataResult?.data || todayJsonDataResult || {};
    const len = jsonDataResult?.len || 0;

    // Process the product using resolved URL (same as handleProductProcessing -> processProduct -> getProductDetails)
    // getProductDetails expects driver to already be on the page, which we've done above
    logger.info('Calling getProductDetails', { 
      url: resolvedUrl, 
      postProduct, 
      driverOnPage: driver ? 'yes' : 'no',
      jsonDataKeys: Object.keys(jsonData).length,
      todayDataKeys: Object.keys(todayJsonData).length,
      len: len
    });
    
    const result = await getProductDetails(
      driver,
      resolvedUrl, // Use resolved URL
      '', // text
      len,  // Use actual len
      accessToken,
      jsonData,
      todayJsonData,
      postProduct, // postProduct flag
      '', // username
      false, // generateLink
      '' // shortUrl
    );
    
    logger.info('getProductDetails returned', { result, resultType: typeof result });

    // Determine status based on result
    let status = 'success';
    let message = 'Product processed and saved to database successfully';
    let error = null;

    if (result === productStatus.PRODUCT_ERROR) {
      status = 'error';
      message = 'Failed to process product';
      error = 'Product processing encountered an error';
    } else if (result === productStatus.PRODUCT_EXCLUDED) {
      status = 'excluded';
      message = 'Product excluded (Affiliate policy)';
    } else if (result === productStatus.PRODUCT_CREATED || result === productStatus.PRODUCT_UPDATED) {
      status = 'success';
      message = result === productStatus.PRODUCT_CREATED 
        ? 'Product created successfully' 
        : 'Product updated successfully';
    } else {
      status = 'success';
      message = 'Product processed successfully';
    }

    res.json({
      success: status === 'success' || status === 'excluded',
      status,
      message,
      error,
      result: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error processing product', { 
      error: error.message, 
      stack: error.stack,
      url: req.body?.url 
    });
    
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'Failed to process product',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
