const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

// Authenticate the user for Gmail API
async function authorizeGmail() {
  let credentials;
  try {
    credentials = await fs.promises.readFile(CREDENTIALS_PATH);
  } catch (error) {
    throw new Error('Error loading client secret file:', error);
  }

  const { client_secret, client_id, redirect_uris } = JSON.parse(credentials).installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  try {
    const token = await fs.promises.readFile(TOKEN_PATH);
    oAuth2Client.setCredentials(JSON.parse(token));
  } catch (error) {
    return getNewToken(oAuth2Client);
  }

  return oAuth2Client;
}

// Fetch recent emails
async function fetchEmailRecommendations() {
  const auth = await authorizeGmail();
  const gmail = google.gmail({ version: 'v1', auth });

  const response = await gmail.users.messages.list({
    userId: 'me', // 'me' indicates the authenticated user
    q: 'subject:recommendations', // search for recommendations in subject line
    maxResults: 5, // fetch 5 most recent emails
  });

  const messages = response.data.messages || [];

  const recommendations = [];

  for (const message of messages) {
    const msg = await gmail.users.messages.get({
      userId: 'me',
      id: message.id,
    });

    const emailData = msg.data.snippet; // Get a snippet of the email
    const emailRecommendations = parseEmailData(emailData); // Parse the snippet to extract recommendations

    recommendations.push({
      Instrument: emailRecommendations.instrument,
      stockMatch: emailRecommendations.stockMatch,
      durationMatch: emailRecommendations.durationMatch,
      lowPriceMatch: emailRecommendations.lowPriceMatch,
      targetMatch: emailRecommendations.targetMatch,
      stoplossMatch: emailRecommendations.stoplossMatch,
      Platform: 'Email',
      RecommendationScore: emailRecommendations.score || null,
      CreatedTimestamp: new Date().toISOString(),
      UpdatedTimestamp: new Date().toISOString(),
    });
  }

  return recommendations;
}

// Function to parse email content (custom logic depending on email format)
function parseEmailData(emailData) {
  // Example logic to parse the email data and extract stock recommendations
  // This would depend on the structure of your emails
  const parsedData = {
    instrument: 'XYZLIFE',  // Example, parse accordingly
    stockMatch: true,
    durationMatch: false,
    lowPriceMatch: true,
    targetMatch: true,
    stoplossMatch: false,
    score: 85,
  };
  return parsedData;
}

module.exports = fetchEmailRecommendations;
