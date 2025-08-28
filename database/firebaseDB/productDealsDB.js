const admin = require('firebase-admin');
const constants = require('../../config/constants.js');
const config = require('../../config/config.js');
const { getModuleLogger } = require("../../logger/logger.js");

const logger = getModuleLogger('productDealsDB');

const dbname = constants.postingTypesConfig[constants.type].DB;
let DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];

const serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);

if (!admin.apps.length) {
	admin.initializeApp({
		credential: admin.credential.cert(serviceAccount),
		databaseURL: `https://${DB_Name}-default-rtdb.firebaseio.com`
	});
}

const db = admin.database();

class ProductDealsDB {
	constructor() {
		this.ref = db.ref('productdeals');
	}

	async bulkUpsertProducts(products) {
		try {
			if (!Array.isArray(products) || products.length === 0) {
				logger.warn('bulkUpsertProducts called with empty products array');
				return { status: 400, message: 'No products to upsert', count: 0 };
			}

			const updates = {};
			for (const product of products) {
				const key = product.productCode || product.id || product.asin || product.title || Math.random().toString(36).slice(2);
				const safeKey = String(key).replace(/[.#$/\[\]]/g, '_');
				const now = new Date().toISOString();
				const normalized = {
					...product,
					updateTimestamp: now,
					creationTimestamp: product.creationTimestamp || now,
				};
				updates[safeKey] = normalized;
			}

			await this.ref.update(updates);
			logger.info(`Bulk upsert completed: ${Object.keys(updates).length} products`);
			return { status: 200, message: 'Bulk upsert successful', count: Object.keys(updates).length };
		} catch (error) {
			logger.error('bulkUpsertProducts error', { error: error.message, stack: error.stack });
			return { status: 500, message: error.message };
		}
	}
}

const productDealsDB = new ProductDealsDB();
module.exports = { productDealsDB };
