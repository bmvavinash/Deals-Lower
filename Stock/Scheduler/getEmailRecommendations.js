async function getEmailRecommendations() {
    try {
        const emailData = await scrapeEmailData(); // Pre-existing logic
        return emailData.map(rec => ({
            Instrument: rec.instrument,
            stockMatch: rec.stockMatch,
            durationMatch: rec.durationMatch,
            lowPriceMatch: rec.lowPriceMatch,
            targetMatch: rec.targetMatch,
            stoplossMatch: rec.stoplossMatch,
            Platform: 'Email',
            RecommendationScore: rec.score || null,
            CreatedTimestamp: new Date().toISOString(),
            UpdatedTimestamp: new Date().toISOString()
        }));
    } catch (error) {
        throw new Error(`Error fetching Email recommendations: ${error.message}`);
    }
}

module.exports = getEmailRecommendations;
