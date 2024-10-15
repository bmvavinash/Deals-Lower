
// const getWhatsAppRecommendations = require('./recommendationWhatsApp');
// const getEmailRecommendations = require('./recommendationEmail');
// const { upsertInstrumentInDB } = require('./dbUtils');
// const { evaluateBuySellDecision } = require('./decisionEngine');
// const { logError, notify } = require('./notificationHandler');

const getZerodhaData = require('../Stock/Scheduler/getZerodhaData');
const getGoogleSheetRecommendations = require('../Stock/Scheduler/getGoogleSheetRecommendations');

async function processAllInstruments() {
    try {
        // 1. Get list of all instruments from Zerodha
        // const instruments = await getZerodhaData();

        // 2. Fetch recommendations from different sources
        const googleSheetRecs = await getGoogleSheetRecommendations();
        console.log("GGoogle in stock ",googleSheetRecs)
        // const whatsappRecs = await getWhatsAppRecommendations();
        // const emailRecs = await getEmailRecommendations();

        // // 3. Process each instrument
        // for (const instrument of instruments) {
        //     const instrumentId = instrument.Instrument;

        //     // Collect recommendations related to this instrument
        //     const instrumentRecs = [
        //         ...googleSheetRecs.filter(rec => rec.Instrument === instrumentId),
        //         ...whatsappRecs.filter(rec => rec.Instrument === instrumentId),
        //         ...emailRecs.filter(rec => rec.Instrument === instrumentId)
        //     ];

        //     // Build the payload to update in the DB
        //     const payload = {
        //         Instrument: instrumentId,
        //         StockDetails: instrument,
        //         Recommendations: instrumentRecs,
        //         Timestamps: {
        //             LastUpdated: new Date().toISOString()
        //         }
        //     };

        //     // 4. Upsert instrument details and recommendations into DB
        //     const dbResponse = await upsertInstrumentInDB(payload);

        //     if (!dbResponse.success) {
        //         logError(`Error updating DB for ${instrumentId}`, dbResponse.error);
        //         continue;  // Skip to the next instrument on error
        //     }

        //     // 5. Evaluate buy/sell/track decision based on the data
        //     const action = evaluateBuySellDecision(instrument, instrumentRecs);

        //     // 6. Notify the decision (buy/sell/track) - Future: This could trigger automated trades
        //     notify(action, instrumentId);

        // }

    } catch (error) {
        // logError('Error in processing all instruments', error);
    }
}

module.exports = { processAllInstruments };
