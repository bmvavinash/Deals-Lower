const extractRam = (text) => {
  // Match RAM-specific patterns: "8GB RAM", "8 GB DDR", "RAM: 8GB"
  const ramSpecific = text.match(/(?:ram|ddr\d?)[:\s]*(\d{1,3})\s*(gb)/i)
    || text.match(/(\d{1,3})\s*(gb)\s*(?:ram|ddr\d?)/i);
  if (ramSpecific) return `${ramSpecific[1]}GB`;

  // Fallback: standard small GB values typical for RAM (4, 6, 8, 12, 16, 32, 64)
  const match = text.match(/\b(4|6|8|12|16|32|64)\s*GB\b/i);
  return match ? `${match[1]}GB` : '';
};

const extractStorage = (text) => {
  // Match storage-specific patterns: "512GB SSD", "1TB HDD", "Storage: 256GB"
  const storageSpecific = text.match(/(?:storage|ssd|hdd|emmc|ufs|rom|internal)[:\s]*(\d{1,4})\s*(gb|tb)/i)
    || text.match(/(\d{1,4})\s*(gb|tb)\s*(?:ssd|hdd|emmc|ufs|rom|storage|internal)/i);
  if (storageSpecific) return `${storageSpecific[1]}${storageSpecific[2].toUpperCase()}`;

  // Known storage sizes
  const storageMatch = text.match(/\b(128|256|512)\s*GB\b|\b[1-4]\s*TB\b/i);
  return storageMatch ? storageMatch[0].toUpperCase().replace(/\s+/g, '') : '';
};

const extractCapacity = (text) => {
  // Matches "1.5 Ton", "2.0 Tons", "1.5T"
  const tonMatch = text.match(/\b(\d(?:\.\d)?\d?)\s*(?:Ton|Tons|T)\b/i);
  if (tonMatch) return `${tonMatch[1]} Ton`;

  // Matches "40L", "40 L", "40 Liters" (for coolers)
  const literMatch = text.match(/\b(\d{2,3})\s*(?:L|Liters|Litres)\b/i);
  if (literMatch) return `${literMatch[1]}L`;

  // Matches "300W", "1000W" for power appliances
  const wattMatch = text.match(/\b(\d{3,4})\s*(?:W|Watt|Watts)\b/i);
  if (wattMatch) return `${wattMatch[1]}W`;

  return '';
};

const extractEnergyRating = (text) => {
  // Matches "5 Star", "3 Stars", "5-star"
  const starMatch = text.match(/\b([1-5])\s*[-  ]*(?:Star|Stars)\b/i);
  if (starMatch) return `${starMatch[1]} Star`;
  return '';
};

const extractScreenSize = (text) => {
  // Matches "55 inch", "55-inch", '15.6"', "15.6 Inch", "43 cm", "108 cm"
  const inchMatch = text.match(/\b(\d{1,3}(?:\.\d)?)\s*[-]?\s*(?:inch|inches|"|in)\b/i);
  if (inchMatch) return `${inchMatch[1]} inch`;

  // Matches cm screen sizes (TVs often listed in cm: 108 cm = 43 inch)
  const cmMatch = text.match(/\b(\d{2,3})\s*cm\b/i);
  if (cmMatch) {
    const inches = Math.round(parseFloat(cmMatch[1]) / 2.54);
    return `${inches} inch`;
  }
  return '';
};

const extractProcessor = (text) => {
  // Intel patterns: "Intel Core i5-1335U", "i7-13700H", "i5 12th Gen"
  const intelMatch = text.match(/(?:intel\s*(?:core\s*)?)?(?:i[3579])\s*[-]?\s*(\d{4,5}[A-Z]*)/i)
    || text.match(/(?:i[3579])\s*(\d{1,2})(?:th|st|nd|rd)\s*gen/i);
  if (intelMatch) {
    const raw = intelMatch[0].trim();
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  // AMD patterns: "Ryzen 5 5600H", "AMD Ryzen 7"
  const amdMatch = text.match(/(?:amd\s*)?ryzen\s*[3579]\s*\d{4}[A-Z]*/i)
    || text.match(/(?:amd\s*)?ryzen\s*[3579]/i);
  if (amdMatch) return amdMatch[0].trim();

  // Apple patterns: "M1", "M2 Pro", "M3 Max", "A17 Pro"
  const appleMatch = text.match(/\b(M[1-4](?:\s*(?:Pro|Max|Ultra))?|A\d{2}\s*(?:Pro|Bionic)?)\b/i);
  if (appleMatch) return appleMatch[0].trim();

  // Snapdragon, MediaTek, Dimensity for phones
  const mobileMatch = text.match(/\b(snapdragon\s*\d{3,4}[+]?|dimensity\s*\d{3,4}[+]?|mediatek\s*helio\s*[a-z]\d{1,2})/i);
  if (mobileMatch) return mobileMatch[0].trim();

  return '';
};

const extractInverterType = (text) => {
  // "Inverter AC", "Dual Inverter", "Non-Inverter"
  if (/non[-\s]*inverter/i.test(text)) return 'Non-Inverter';
  if (/dual\s*inverter/i.test(text)) return 'Dual Inverter';
  if (/triple\s*inverter/i.test(text)) return 'Triple Inverter';
  if (/inverter/i.test(text)) return 'Inverter';
  return '';
};

const extractColor = (text) => {
  // Common color names
  const colors = [
    'black', 'white', 'silver', 'gold', 'blue', 'red', 'green', 'grey', 'gray',
    'navy', 'maroon', 'pink', 'purple', 'orange', 'yellow', 'brown', 'beige',
    'teal', 'ivory', 'charcoal', 'graphite', 'midnight', 'rose gold', 'space grey',
    'starlight', 'pearl', 'champagne', 'bronze', 'copper', 'titanium'
  ];
  const lower = text.toLowerCase();
  for (const color of colors) {
    if (lower.includes(color)) return color.charAt(0).toUpperCase() + color.slice(1);
  }
  return '';
};

const extractModelNumber = (text) => {
  // Try to find model-number-like patterns: alphanumeric sequences with hyphens
  // e.g., "WU-R1035E", "SM-A546E", "MQD83HN/A"
  const modelPatterns = [
    /model\s*(?:no|number|name|#)?[:\s]+([A-Z0-9][\w\-\/]{3,20})/i,
    /\b([A-Z]{1,3}\d{2,5}[A-Z]{0,3}(?:[-\/][A-Z0-9]{1,5})?)\b/,
  ];
  for (const pattern of modelPatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].length >= 4) return match[1].toUpperCase().replace(/\s+/g, '');
  }
  return '';
};

const extractAttributes = (productTitle, productSpecsObj = {}) => {
  const titleText = (productTitle || '').toLowerCase();
  const specsText = JSON.stringify(productSpecsObj || {}).toLowerCase();
  const combinedText = `${titleText} ${specsText}`;

  const attributes = {
    ram: extractRam(combinedText),
    storage: extractStorage(combinedText),
    capacity: extractCapacity(combinedText),
    energyRating: extractEnergyRating(combinedText),
    screenSize: extractScreenSize(combinedText),
    processor: extractProcessor(combinedText),
    inverterType: extractInverterType(combinedText),
    color: extractColor(titleText), // Color from title only to avoid noise
    modelNumber: extractModelNumber(combinedText)
  };

  return attributes;
};

module.exports = {
  extractAttributes,
  extractRam,
  extractStorage,
  extractCapacity,
  extractEnergyRating,
  extractScreenSize,
  extractProcessor,
  extractInverterType,
  extractColor,
  extractModelNumber
};
