const { getAccessToken } = require('./database/getAccessToken');
const constants = require('./config/constants');
const config = require('./config/config');

async function run() {
  const token = await getAccessToken(constants.env);
  const DB_Name = config.DATABASE_CONFIG[`${constants.postingTypesConfig[constants.type].DB}_NAME`];
  const baseUrl = DB_Name === 'lowerdealhub' ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app` : `https://${DB_Name}-default-rtdb.firebaseio.com`;
  const url = `${baseUrl}/deals.json?access_token=${token}&limitToFirst=2000&orderBy="$key"`;
  
  const response = await fetch(url);
  const data = await response.json();
  const cats = new Set();
  let count = 0;
  for (const k in data) {
    const p = data[k];
    if (p.categoryGroup) cats.add(p.categoryGroup);
    if (p.hierarchicalCategory && p.hierarchicalCategory.mainCategory) cats.add(p.hierarchicalCategory.mainCategory);
    if (p.category && p.category.mainCategory) cats.add(p.category.mainCategory);
    
    if (count++ < 10) {
      console.log(`[${p.storeType}]`, p.categoryGroup || p.hierarchicalCategory?.mainCategory, p.model, p.brand, p.title?.substring(0, 30));
    }
  }
  console.log('Categories found:', Array.from(cats));
}
run();
