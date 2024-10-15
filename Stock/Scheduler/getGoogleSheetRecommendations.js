const fetchGoogleSheetData = require("../Recommendations/fetchGoogleSheetData");

async function getGoogleSheetRecommendations() {
    try {
        const googleSheetData = await fetchGoogleSheetData(); // Pre-existing logic
        console.log("Google Sheet Data ",googleSheetData)
        return googleSheetData.map(rec => ({
            Instrument: rec.instrument,
            stockMatch: rec.stockMatch,
            durationMatch: rec.durationMatch,
            lowPriceMatch: rec.lowPriceMatch,
            targetMatch: rec.targetMatch,
            stoplossMatch: rec.stoplossMatch,
            Platform: 'Google Sheet',
            RecommendationScore: rec.score || null,
            CreatedTimestamp: new Date().toISOString(),
            UpdatedTimestamp: new Date().toISOString()
        }));
    } catch (error) {
        throw new Error(`Error fetching Google Sheet recommendations: ${error.message}`);
    }
}

module.exports = getGoogleSheetRecommendations;
