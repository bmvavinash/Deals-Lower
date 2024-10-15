const fetchEmailRecommendations = require("../Stock/Recommendations/fetchEmailRecommendations");
const fetchGoogleSheetData = require("../Stock/Recommendations/fetchGoogleSheetData");

async function fetchAndStoreRecommendations() {
  const googleSheetRecs = await fetchGoogleSheetData();
  const emailRecs = await fetchEmailRecommendations();

  // Append or update these in your DB
  const allRecommendations = [...googleSheetRecs, ...emailRecs];

  for (const recommendation of allRecommendations) {
    // Call your DB function to insert/update the record
    await upsertRecommendationInDB(recommendation);
  }
}

// Call the function periodically or based on your needs
fetchAndStoreRecommendations();
