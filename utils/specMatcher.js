/**
 * Utility to extract key specifications from title and specifications list
 */
function parseSpecs(title, specs, categoryGroup) {
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

  const isLaptop = category.includes('laptop') || category.includes('computer') || titleText.includes('laptop') || titleText.includes('notebook') || titleText.includes('macbook');
  const isMobile = category.includes('mobile') || category.includes('phone') || titleText.includes('mobile') || titleText.includes('phone') || titleText.includes('smartphone');
  const isAC = category.includes('conditioner') || category.includes(' ac') || titleText.includes('conditioner') || titleText.includes(' ac ') || titleText.includes('split ac') || titleText.includes('window ac');
  const isTV = category.includes('television') || category.includes(' tv') || titleText.includes('television') || titleText.includes(' tv ') || titleText.includes('smart tv') || titleText.includes('led tv');

  if (isLaptop || isMobile) {
    // RAM parsing
    // Match patterns: "16gb", "16 gb", "8gb ram", "16 gb lpddr5", "12gb ram", etc.
    const ramMatches = combinedText.match(/\b(4|6|8|12|16|24|32|64)\s*(?:gb|gigabyte)\s*(?:ram|lpddr|ddr|memory)?\b/);
    if (ramMatches) {
      parsed.ram = ramMatches[1] + 'gb';
    }

    // Storage parsing
    // Match patterns: "512gb ssd", "1tb hdd", "256 gb", "128gb", etc.
    const storageMatches = combinedText.match(/\b(128|256|512)\s*(?:gb|gigabyte)\s*(?:ssd|hdd|storage|rom|emmc|nvme)?\b/i) 
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

    // Processor parsing
    if (combinedText.includes('i3') || combinedText.includes('core i3') || combinedText.includes('intel core i3')) parsed.processor = 'i3';
    else if (combinedText.includes('i5') || combinedText.includes('core i5') || combinedText.includes('intel core i5')) parsed.processor = 'i5';
    else if (combinedText.includes('i7') || combinedText.includes('core i7') || combinedText.includes('intel core i7')) parsed.processor = 'i7';
    else if (combinedText.includes('i9') || combinedText.includes('core i9') || combinedText.includes('intel core i9')) parsed.processor = 'i9';
    else if (combinedText.includes('ryzen 3') || combinedText.includes('r3')) parsed.processor = 'ryzen 3';
    else if (combinedText.includes('ryzen 5') || combinedText.includes('r5')) parsed.processor = 'ryzen 5';
    else if (combinedText.includes('ryzen 7') || combinedText.includes('r7')) parsed.processor = 'ryzen 7';
    else if (combinedText.includes('ryzen 9') || combinedText.includes('r9')) parsed.processor = 'ryzen 9';
    else if (combinedText.includes('snapdragon x') || combinedText.includes('snapdragon')) parsed.processor = 'snapdragon';
    else if (combinedText.includes('m1')) parsed.processor = 'm1';
    else if (combinedText.includes('m2')) parsed.processor = 'm2';
    else if (combinedText.includes('m3')) parsed.processor = 'm3';
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

  return parsed;
}

/**
 * Checks if two products have matching specs.
 * Returns false only if a critical spec mismatch is found.
 */
function areSpecsMatching(prodA, prodB, categoryGroup) {
  if (!prodA || !prodB) return false;
  
  const specsA = parseSpecs(prodA.title || prodA.urltext || '', prodA.specifications || prodA.productTable || {}, categoryGroup);
  const specsB = parseSpecs(prodB.title || prodB.urltext || '', prodB.specifications || prodB.productTable || {}, categoryGroup);

  // Get common keys
  const keys = Object.keys(specsA).filter(k => k in specsB);
  
  // For categories where we parse specs, require at least one common key to prevent false matches on empty/missing specs
  const category = (categoryGroup || '').toLowerCase();
  const titleA = (prodA.title || '').toLowerCase();
  const titleB = (prodB.title || '').toLowerCase();
  
  const hasSpecsCategory = category.includes('laptop') || category.includes('computer') || category.includes('mobile') || category.includes('phone') || category.includes('conditioner') || category.includes(' ac') || category.includes('television') || category.includes(' tv') || titleA.includes('laptop') || titleB.includes('laptop');
  
  if (hasSpecsCategory && keys.length === 0) {
    return false; // No common specifications to verify, reject match
  }
  
  // If we found common specs, they must match exactly!
  for (const key of keys) {
    if (specsA[key] !== specsB[key]) {
      return false; // Spec mismatch!
    }
  }

  return true;
}

module.exports = {
  parseSpecs,
  areSpecsMatching
};
