const { getformattedDate } = require("../utils/commonUtils");

async function firebaseget(isToday=false, collectionName=null) {
  let len = 0;
  let data;
  try {
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    const config = require("../config/config");
    const constants = require("../config/constants");
    const dbname = constants.postingTypesConfig[constants.type].DB;
    let DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];

    let formattedDate="";
    
    // Use provided collection name or default from config
    const jsonFileName = collectionName || config.DATABASE_CONFIG.JSON_FILE_NAME;

    if (isToday){
      formattedDate = getformattedDate();
      urlappend = `orderBy="date"&equalTo="${formattedDate}"`
      // urlappend = `orderBy="date"&equalTo="${formattedDate}"&shallow=true`
    } else {
      urlappend = `shallow=true`
    }
    const apiUrl = `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app/${jsonFileName}.json?${urlappend}&print=pretty`;
    // const apiUrl = `https://${DB_Name}-default-rtdb.firebaseio.com/${jsonFileName}.json`;

    var requestOptions = {
      method: "GET",
    };
//check new1
//     try {
//       const response = await fetch(apiUrl, requestOptions);
//       const data = await response.json();
//       const objectCount = Object.keys(data).length;
//       console.log(`Success in Firebase Get. Response contains ${objectCount} objects.`);
//       len = objectCount;
//       // Any operation dependent on `len` should be inside this try block or after it in an async context
//     } catch (error) {
//       console.log("error", error);
//     }
//     console.log("totalLength ", len);
//     return len;
//   } catch (e) {console.log(e);}
// }


//check new2
console.log("Api URL firebase get is ",apiUrl)
const response = await fetch(apiUrl);
if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

data = await response.json();
const objectCount = data ? Object.keys(data).length : 0;
console.log(`Success in Firebase Get. Response contains ${objectCount} objects.`);
len = objectCount;


//check original
//   await fetch(apiUrl, requestOptions  ).then(response => response.json()).then(data => {
//     const objectCount = Object.keys(data).length;
//     console.log(`Success in Firebase Get. Response contains ${objectCount} objects.`);
//     len = objectCount
//   })
//   .catch((error) => console.log("error", error));

//     // len = result
//   console.log("Length Inside Firebase GET is ",Object.keys(data).length)

// output = JSON.parse(result).includes("false");

}
catch(e){
console.log(e);
}
// }
// catch(e){
//   console.log(e);
// }
console.log("totalLength ",len)
return { data: data, len: len };
}
exports.firebaseget = firebaseget;
