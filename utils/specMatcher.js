/**
 * Smart color extractor from title and scraped color attribute
 */
function extractColor(title, scrapedColor) {
  if (scrapedColor && scrapedColor.trim()) {
    return scrapedColor.trim().toLowerCase();
  }
  
  const titleText = (title || '').trim();
  if (!titleText) return '';
  
  // Try to find patterns like: "POCO C75 5G (Aqua Bliss, 128 GB)"
  const parenRegex = /\(([^)]+)\)/g;
  let match;
  while ((match = parenRegex.exec(titleText)) !== null) {
    const content = match[1];
    const parts = content.split(',');
    for (let part of parts) {
      part = part.trim();
      // Skip config keywords
      if (/\b\d+\s*(?:gb|tb|ram|ssd|hdd|rom)\b/i.test(part)) {
        continue;
      }
      if (part && part.length > 2 && part.length < 25) {
        return part.toLowerCase();
      }
    }
  }
  
  // Try to find patterns like: "POCO C75 5G, Silver Stardust (4GB, 64GB)"
  const commaParenRegex = /,\s*([^,(]+)\s*\(/;
  const commaParenMatch = titleText.match(commaParenRegex);
  if (commaParenMatch) {
    const part = commaParenMatch[1].trim();
    if (part && part.length > 2 && part.length < 25 && !/\b\d+\s*(?:gb|tb|ram|ssd|hdd|rom)\b/i.test(part)) {
      return part.toLowerCase();
    }
  }
  
  // Fallback to common colors
  const commonColors = ['black', 'white', 'grey', 'gray', 'silver', 'gold', 'blue', 'red', 'green', 'yellow', 'pink', 'purple', 'orange', 'bronze', 'platinum'];
  for (const color of commonColors) {
    const colorRegex = new RegExp(`\\b${color}\\b`, 'i');
    if (colorRegex.test(titleText)) {
      return color;
    }
  }
  
  return '';
}

/**
 * Utility to extract key specifications from title and specifications list
 */
function parseSpecs(title, specs, categoryGroup, scrapedColor) {
  const titleText = (title || '').toLowerCase();
  
  // Convert specs to a combined string for general searching
  let specsText = '';
  if (specs) {
    if (typeof specs === 'object') {
      specsText = JSON.stringify(specs).toLowerCase();
    } else if (Array.isArray(specs)) {
      specsText = specs.map(s => typeof s === 'object' ? JSON.stringify(s) : String(s)).join(' ').toLowerCase();
    } else {
      specsText = String(specs).toLowerCase();
    }
  }
  const combinedText = `${titleText} ${specsText}`;
  const category = (categoryGroup || '').toLowerCase();

  const parsed = {};

  const laptopKeywords = ['laptop', 'notebook', 'macbook', 'vivobook', 'ideapad', 'thinkpad', 'zenbook', 'inspiron', 'pavilion', 'spectre', 'latitude', 'vostro', 'chromebook', 'predator', 'legion', 'rog', 'tuf gaming', 'mac mini'];
  const mobileKeywords = ['mobile', 'phone', 'smartphone', 'poco', 'iphone', 'oneplus', 'redmi', 'realme', 'vivo', 'oppo', 'motorola', 'moto ', 'pixel', 'xiaomi', 'iqoo', 'infinix', 'tecno', 'nothing phone'];
  
  const isLaptop = category.includes('laptop') || category.includes('computer') || laptopKeywords.some(kw => titleText.includes(kw));
  const isMobile = category.includes('mobile') || category.includes('phone') || mobileKeywords.some(kw => titleText.includes(kw));
  const isAC = category.includes('conditioner') || category.includes(' ac') || titleText.includes('conditioner') || titleText.includes(' ac ') || titleText.includes('split ac') || titleText.includes('window ac');
  const isTV = category.includes('television') || category.includes(' tv') || titleText.includes('television') || titleText.includes(' tv ') || titleText.includes('smart tv') || titleText.includes('led tv');
  const isMonitor = category.includes('monitor') || titleText.includes('monitor');
  const isFridge = category.includes('fridge') || category.includes('refrigerator') || titleText.includes('fridge') || titleText.includes('refrigerator');

  const hasSpecsCategory = isLaptop || isMobile || isAC || isTV || isMonitor || isFridge;

  if (isLaptop || isMobile) {
    // RAM parsing
    const ramMatches = combinedText.match(/\b([3468]|12|16|24|32|64)\s*(?:gb|gigabyte)\s*(?:ram|lpddr|ddr|memory)?\b/);
    if (ramMatches) {
      parsed.ram = ramMatches[1] + 'gb';
    }

    // Storage parsing
    const storageMatches = combinedText.match(/\b(16|32|64|128|256|512)\s*(?:gb|gigabyte)\s*(?:ssd|hdd|storage|rom|emmc|nvme)?\b/i) 
                        || combinedText.match(/\b(1|2)\s*(?:tb|terabyte)\s*(?:ssd|hdd|storage|rom)?\b/i);
    if (storageMatches) {
      const unit = storageMatches[0].includes('tb') ? 'tb' : 'gb';
      parsed.storage = storageMatches[1] + unit;
    }
  }

  if (isLaptop) {
    // SSD vs HDD
    if (combinedText.includes('ssd')) parsed.storageType = 'ssd';
    else if (combinedText.includes('hdd')) parsed.storageType = 'hdd';

    // Processor parsing - extract standard processors and also search for specific models like i7-12700H vs i5
    let proc = '';
    
    // Check specific Intel core models (e.g. i7-12700h, i5-12450h)
    const intelModelMatch = combinedText.match(/\b(i3|i5|i7|i9)-?(\d{4,5}[hq]?)\b/);
    if (intelModelMatch) {
      proc = intelModelMatch[1] + '-' + intelModelMatch[2];
    } else {
      // General Intel series
      if (combinedText.includes('i3') || combinedText.includes('core i3') || combinedText.includes('intel core i3')) proc = 'i3';
      else if (combinedText.includes('i5') || combinedText.includes('core i5') || combinedText.includes('intel core i5')) proc = 'i5';
      else if (combinedText.includes('i7') || combinedText.includes('core i7') || combinedText.includes('intel core i7')) proc = 'i7';
      else if (combinedText.includes('i9') || combinedText.includes('core i9') || combinedText.includes('intel core i9')) proc = 'i9';
    }
    
    // Check AMD Ryzen models (e.g. ryzen 5 5600h, ryzen 7 5800u)
    const ryzenModelMatch = combinedText.match(/ryzen\s*(3|5|7|9)\s*(\d{4}[hq]?)\b/);
    if (ryzenModelMatch) {
      proc = 'ryzen ' + ryzenModelMatch[1] + '-' + ryzenModelMatch[2];
    } else if (!proc) {
      // General Ryzen series
      if (combinedText.includes('ryzen 3') || combinedText.includes('r3')) proc = 'ryzen 3';
      else if (combinedText.includes('ryzen 5') || combinedText.includes('r5')) proc = 'ryzen 5';
      else if (combinedText.includes('ryzen 7') || combinedText.includes('r7')) proc = 'ryzen 7';
      else if (combinedText.includes('ryzen 9') || combinedText.includes('r9')) proc = 'ryzen 9';
    }
    
    // Other processors
    if (!proc) {
      if (combinedText.includes('snapdragon x') || combinedText.includes('snapdragon')) proc = 'snapdragon';
      else if (combinedText.includes('m1')) proc = 'm1';
      else if (combinedText.includes('m2')) proc = 'm2';
      else if (combinedText.includes('m3')) proc = 'm3';
    }
    
    if (proc) {
      parsed.processor = proc;
    }

    // Processor Brand
    if (combinedText.includes('intel') || combinedText.includes('core')) parsed.processorBrand = 'intel';
    else if (combinedText.includes('amd') || combinedText.includes('ryzen')) parsed.processorBrand = 'amd';
  }

  if (isAC) {
    // Capacity
    const capacityMatches = combinedText.match(/\b(0\.75|0\.8|1|1\.2|1\.5|2)\s*(?:ton|t)\b/);
    if (capacityMatches) {
      parsed.capacity = capacityMatches[1] + ' ton';
    }

    // Star rating
    const starMatches = combinedText.match(/\b(2|3|4|5)\s*(?:star)\b/);
    if (starMatches) {
      parsed.starRating = starMatches[1] + ' star';
    }

    // Inverter vs Non-inverter
    if (combinedText.includes('inverter')) parsed.acType = 'inverter';
    else parsed.acType = 'non-inverter';
  }

  if (isTV) {
    // Screen size
    const tvSizeMatches = combinedText.match(/\b(32|40|43|50|55|65|75)\s*(?:inch|")\b/)
                       || combinedText.match(/\b(80|100|108|126|138|163)\s*cm\b/);
    if (tvSizeMatches) {
      parsed.screenSize = tvSizeMatches[1];
    }
    // Resolution
    if (combinedText.includes('4k') || combinedText.includes('ultra hd') || combinedText.includes('uhd')) parsed.resolution = '4k';
    else if (combinedText.includes('full hd') || combinedText.includes('fhd') || combinedText.includes('1080p')) parsed.resolution = 'fhd';
    else if (combinedText.includes('hd ready') || combinedText.includes('720p')) parsed.resolution = 'hd';
  }

  if (isMonitor) {
    // Screen size
    const monitorSizeMatches = combinedText.match(/\b(19|21|22|24|27|32|34|38|49)\s*(?:inch|")\b/);
    if (monitorSizeMatches) {
      parsed.screenSize = monitorSizeMatches[1] + ' inch';
    }
    
    // Refresh rate
    const refreshMatches = combinedText.match(/\b(60|75|100|120|144|165|180|240|360)\s*(?:hz|hertz)\b/);
    if (refreshMatches) {
      parsed.refreshRate = refreshMatches[1] + 'hz';
    }
    
    // Resolution
    if (combinedText.includes('4k') || combinedText.includes('uhd') || combinedText.includes('3840x2160')) parsed.resolution = '4k';
    else if (combinedText.includes('qhd') || combinedText.includes('2k') || combinedText.includes('1440p') || combinedText.includes('2560x1440')) parsed.resolution = '2k';
    else if (combinedText.includes('fhd') || combinedText.includes('1080p') || combinedText.includes('1920x1080')) parsed.resolution = '1080p';
  }

  if (isFridge) {
    // Capacity (liters)
    const capacityMatches = combinedText.match(/\b(\d{3})\s*(?:l|liters|litre|litres)\b/);
    if (capacityMatches) {
      parsed.capacity = capacityMatches[1] + ' L';
    }
    
    // Star rating
    const starMatches = combinedText.match(/\b(2|3|4|5)\s*(?:star)\b/);
    if (starMatches) {
      parsed.starRating = starMatches[1] + ' star';
    }
    
    // Fridge type
    if (combinedText.includes('side by side')) parsed.fridgeType = 'side by side';
    else if (combinedText.includes('double door')) parsed.fridgeType = 'double door';
    else if (combinedText.includes('single door')) parsed.fridgeType = 'single door';
    else if (combinedText.includes('triple door')) parsed.fridgeType = 'triple door';
  }

  // Extract color if this is a specs category
  if (hasSpecsCategory) {
    const parsedColor = extractColor(title, scrapedColor);
    if (parsedColor) {
      parsed.color = parsedColor;
    }
  }

  return parsed;
}

/**
 * Checks if two products have matching specs.
 * Returns false only if a critical spec mismatch is found.
 */
function areSpecsMatching(prodA, prodB, categoryGroup) {
  if (!prodA || !prodB) return false;
  
  // If either title is empty, reject the match immediately
  const titleA = (prodA.title || '').trim();
  const titleB = (prodB.title || '').trim();
  if (!titleA || !titleB || titleA.toLowerCase() === 'no title' || titleB.toLowerCase() === 'no title') {
    return false;
  }
  
  // Normal Brand matching
  const brandA = (prodA.brand || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const brandB = (prodB.brand || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (brandA && brandB && brandA !== brandB) {
    if (!brandA.includes(brandB) && !brandB.includes(brandA)) {
      return false; // Brand mismatch!
    }
  }
  
  const specsA = parseSpecs(prodA.title || prodA.urltext || '', prodA.specifications || prodA.productTable || {}, categoryGroup, prodA.color);
  const specsB = parseSpecs(prodB.title || prodB.urltext || '', prodB.specifications || prodB.productTable || {}, categoryGroup, prodB.color);

  // Get common keys
  const keys = Object.keys(specsA).filter(k => k in specsB);
  
  const category = (categoryGroup || '').toLowerCase();
  const titleTextA = titleA.toLowerCase();
  const titleTextB = titleB.toLowerCase();
  
  const laptopKeywords = ['laptop', 'notebook', 'macbook', 'vivobook', 'ideapad', 'thinkpad', 'zenbook', 'inspiron', 'pavilion', 'spectre', 'latitude', 'vostro', 'chromebook', 'predator', 'legion', 'rog', 'tuf gaming', 'mac mini'];
  const mobileKeywords = ['mobile', 'phone', 'smartphone', 'poco', 'iphone', 'oneplus', 'redmi', 'realme', 'vivo', 'oppo', 'motorola', 'moto ', 'pixel', 'xiaomi', 'iqoo', 'infinix', 'tecno', 'nothing phone'];
  
  const hasSpecsCategory = category.includes('laptop') || category.includes('computer') || category.includes('mobile') || category.includes('phone') || category.includes('conditioner') || category.includes(' ac') || category.includes('television') || category.includes(' tv') || category.includes('monitor') || category.includes('fridge') || category.includes('refrigerator')
    || laptopKeywords.some(kw => titleTextA.includes(kw) || titleTextB.includes(kw))
    || mobileKeywords.some(kw => titleTextA.includes(kw) || titleTextB.includes(kw))
    || titleTextA.includes('monitor') || titleTextB.includes('monitor')
    || titleTextA.includes('fridge') || titleTextB.includes('fridge')
    || titleTextA.includes('refrigerator') || titleTextB.includes('refrigerator');
  
  if (hasSpecsCategory) {
    if (keys.length === 0) {
      return false; // No common specifications to verify, reject match
    }
    
    // If we found common specs, they must match exactly!
    for (const key of keys) {
      if (specsA[key] !== specsB[key]) {
        return false; // Spec mismatch!
      }
    }
  }

  return true;
}

module.exports = {
  parseSpecs,
  areSpecsMatching
};
