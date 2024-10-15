function evaluateBuySellDecision(stockDetails, recommendations) {
    // Example logic for decision making (customize as per your logic)
    let action = 'TRACK'; // Default action

    const buyRecommendations = recommendations.filter(rec => rec.stockMatch && rec.targetMatch);
    const sellRecommendations = recommendations.filter(rec => !rec.stockMatch);

    if (buyRecommendations.length > sellRecommendations.length) {
        action = 'BUY';
    } else if (sellRecommendations.length > buyRecommendations.length) {
        action = 'SELL';
    }

    // Return the action for this stock
    return action;
}

module.exports = { evaluateBuySellDecision };
