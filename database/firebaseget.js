const { getformattedDate } = require("../utils/commonUtils");

async function firebaseget(isToday = false, collectionName = null) {
  let len = 0;
  let data = null;
  
  try {
    const config = require("../config/config");
    const constants = require("../config/constants");
    const dbname = constants.postingTypesConfig[constants.type].DB;
    let DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];

    let formattedDate = "";
    let urlappend = "";
    
    // Use provided collection name or default from config
    const jsonFileName = collectionName || config.DATABASE_CONFIG.JSON_FILE_NAME;

    if (isToday) {
      formattedDate = getformattedDate();
      urlappend = `orderBy="date"&equalTo="${formattedDate}"`;
    } else {
      urlappend = `shallow=true`;
    }
    
    const apiUrl = `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app/${jsonFileName}.json?${urlappend}&print=pretty`;
    
    console.log("API URL firebase get is:", apiUrl);
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    data = await response.json();
    const objectCount = data ? Object.keys(data).length : 0;
    console.log(`Success in Firebase Get. Response contains ${objectCount} objects.`);
    len = objectCount;

  } catch (e) {
    console.error("Error in firebaseget:", e);
    // Return empty data on error
    data = null;
    len = 0;
  }
  
  console.log("totalLength:", len);
  return { data: data, len: len };
}
exports.firebaseget = firebaseget;
