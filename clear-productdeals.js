const { productDealsDB } = require('./database/firebaseDB/productDealsDB');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function clearProductDeals() {
    try {
        console.log("Clearing productdeals.json...");
        await productDealsDB.productdealsRef.remove();
        console.log("Successfully cleared productdeals.json");
        process.exit(0);
    } catch (e) {
        console.error("Failed to clear:", e);
        process.exit(1);
    }
}

clearProductDeals();
