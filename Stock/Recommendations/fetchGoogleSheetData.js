const { google } = require('googleapis');
const sheets = google.sheets('v4');
const fs = require('fs');
const path = require('path');
const { authenticate } = require('@google-cloud/local-auth');
const constants = require('../../config/constants');

const filePath = constants.pathToFile;
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
const TOKEN_PATH = path.join(filePath, 'token.json');
const CREDENTIALS_PATH = path.join(filePath, 'client_secret_167904509114-jthnfemnl22t3vfrp5fef75r3k8dt5qh.apps.googleusercontent.com.json');

// Function to authorize and authenticate
console.log('Credentials Path:', CREDENTIALS_PATH);
console.log('Token Path:', TOKEN_PATH);
async function authorize() {
  console.log('Attempting to authorize...');
  try {
    console.log('Attempting to read credentials from', CREDENTIALS_PATH);
    const credentials = await fs.promises.readFile(CREDENTIALS_PATH);
    console.log('Credentials loaded:', credentials.toString());
    const { client_secret, client_id, redirect_uris } = JSON.parse(credentials).installed;

    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Check if token already exists
    try {
      console.log('Checking for existing token at', TOKEN_PATH);
      const token = await fs.promises.readFile(TOKEN_PATH);
      console.log('Token found and loaded:', token.toString());
      oAuth2Client.setCredentials(JSON.parse(token));
      console.log('Token found and loaded.');
    } catch (error) {
      // Token not found or expired, get a new one
      console.log('No token found or token expired. Generating a new token.');
      return await getNewToken(oAuth2Client);
    }

    return oAuth2Client;
  } catch (error) {
    console.error('Error loading client secret file:', error.message);
    throw new Error('Failed to load credentials');
  }
}

// Function to get new token and save it
async function getNewToken(oAuth2Client) {
  try {
    console.log('Generating authorization URL...');
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    console.log('Authorize this app by visiting this URL:', authUrl);

    const { tokens } = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH,
    });

    if (!tokens) {
      throw new Error('No token returned from authentication');
    }

    oAuth2Client.setCredentials(tokens);
    await fs.promises.writeFile(TOKEN_PATH, JSON.stringify(tokens));
    console.log('New token stored at', TOKEN_PATH);
  
    return oAuth2Client;
  } catch (error) {
    console.error('Error obtaining new token:', error.message);
    throw new Error('Failed to obtain new token');
  }
}

// Function to fetch data from Google Sheets
async function fetchGoogleSheetData() {
  try {
    console.log('Authorizing...');
    const auth = await authorize();
    const sheetId = '1isKceMYiaVCcD4SpcWOpZvjM30Unwb7qEBDgZq3_xYM'; // Replace with your Google Sheet ID
    const range = 'Stock list!A6:G'; // Range of data you want to fetch

    console.log(`Fetching data from Google Sheet ID: ${sheetId}, Range: ${range}`);
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: sheetId,
      range,
    });

    console.log('Google Sheets API Response:', JSON.stringify(response.data, null, 2));

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      console.warn('No data found in the specified range.');
      return [];
    }

    console.log('Data fetched successfully, processing rows...');
    
    // Mapping the data from the sheet to desired structure
    const processedRows = rows.map(row => ({
      Instrument: row[0] || 'N/A', // assuming first column is Instrument
      stockMatch: row[1] === 'TRUE', // example for stock match
      durationMatch: row[2] === 'TRUE',
      lowPriceMatch: row[3] === 'TRUE',
      targetMatch: row[4] === 'TRUE',
      stoplossMatch: row[5] === 'TRUE',
      RecommendationScore: parseFloat(row[6]) || 0, // assuming score is in column 6
      Platform: 'Google Sheet',
      CreatedTimestamp: new Date().toISOString(),
      UpdatedTimestamp: new Date().toISOString(),
    }));

    console.log(`Processed ${processedRows.length} rows from Google Sheets.`);
    return processedRows;
  } catch (error) {
    console.error('Error fetching data from Google Sheets:', error.message);
    throw error;
  }
}

// Use this function to fetch the recommendations
module.exports = fetchGoogleSheetData;
