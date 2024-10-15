const Zerodha = require("../Portal/Zerodha");

async function getZerodhaData() {
    // Scrape Zerodha for the list of instruments
    try {
        const scrapedData = await Zerodha(); // Pre-existing scraping logic

        // Format and return the scraped data
        return scrapedData.map(instrument => ({
            Instrument: instrument.id,
            Qty: instrument.qty,
            AvgCost: instrument.avgCost,
            LTP: instrument.ltp,
            CurVal: instrument.curVal,
            PnL: instrument.pnl,
            NetChg: instrument.netChg,
            DayChg: instrument.dayChg,
            Type: instrument.type || 'Equity', // Assuming default type is Equity
            Sector: instrument.sector || 'Unknown',
            Exchange: instrument.exchange || 'NSE'
        }));

    } catch (error) {
        throw new Error(`Error fetching Zerodha data: ${error.message}`);
    }
}

module.exports = getZerodhaData;
