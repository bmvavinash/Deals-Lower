const whatsappLastMessageByHtml = require("../../socialMedia/whatsappLastMsgByHtml");

async function getWhatsAppRecommendations() {
    try {
        const whatsappData = await whatsappLastMessageByHtml(); 
        return whatsappData.map(rec => ({
            Instrument: rec.instrument,
            stockMatch: rec.stockMatch,
            durationMatch: rec.durationMatch,
            lowPriceMatch: rec.lowPriceMatch,
            targetMatch: rec.targetMatch,
            stoplossMatch: rec.stoplossMatch,
            Platform: 'WhatsApp',
            RecommendationScore: rec.score || null,
            CreatedTimestamp: new Date().toISOString(),
            UpdatedTimestamp: new Date().toISOString()
        }));
    } catch (error) {
        throw new Error(`Error fetching WhatsApp recommendations: ${error.message}`);
    }
}

module.exports = getWhatsAppRecommendations;
