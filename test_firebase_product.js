const { getProductByCode } = require('./database/firebaseDB/productDealsDB');
const { getDatabase } = require('./database/firebaseDB/firebaseConfig');
const config = require('./config/config');
const constants = require('./config/constants');

async function test() {
    try {
        const dbname = constants.postingTypesConfig[constants.type].DB;
        const db = getDatabase(`${dbname}_NAME`, `${dbname}_TOKEN_FILE`);
        const product = await getProductByCode("CPGHNA7SHW3ZJMHY", db);
        console.log(JSON.stringify(product, null, 2));
    } catch (e) {
        console.error(e);
    }
}
test();
