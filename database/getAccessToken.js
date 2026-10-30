var { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

function getAccessToken(env="prod",extract="Telegram",extractData="Telegram") {

  const constants = require('../config/constants.js');
  const config = require('../config/config.js');

  const dbname = constants.postingTypesConfig[constants.type].DB;
  let DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
  const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];

  return new Promise(async (resolve, reject) => {
    try {
      // 1) First check if Firebase Admin SDK is already initialized
      if (admin.apps && admin.apps.length > 0) {
        try {
          const app = admin.app();
          if (app && app.options && app.options.credential && typeof app.options.credential.getAccessToken === 'function') {
            const tokenObj = await app.options.credential.getAccessToken();
            if (tokenObj && tokenObj.access_token) {
              return resolve(tokenObj.access_token);
            }
          }
        } catch (e) {
          console.warn("[getAccessToken] admin.app().options.credential.getAccessToken fallback:", e.message);
        }
      }

      // 2) Resolve serviceAccount credentials object
      let serviceAccount = null;

      // Check environment variables first (Render / Cloud environment)
      if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        try {
          serviceAccount = typeof process.env.FIREBASE_SERVICE_ACCOUNT_JSON === 'object'
            ? process.env.FIREBASE_SERVICE_ACCOUNT_JSON
            : JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        } catch (e) {
          console.error("[getAccessToken] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON env var:", e.message);
        }
      }

      // Check secret file paths (Render secret files or custom path)
      if (!serviceAccount) {
        const potentialSecretPaths = [
          process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
          process.env.GOOGLE_APPLICATION_CREDENTIALS,
          `/etc/secrets/${filePath}.json`,
          `/etc/secrets/FIREBASE_SERVICE_ACCOUNT_JSON`,
          `/etc/secrets/serviceAccountKey.json`,
          path.join(__dirname, '../config', `${filePath}.json`),
          `${constants.pathToFile}/${filePath}.json`
        ].filter(Boolean);

        for (const candidatePath of potentialSecretPaths) {
          try {
            if (fs.existsSync(candidatePath)) {
              serviceAccount = require(candidatePath);
              break;
            }
          } catch (_) {}
        }
      }

      if (!serviceAccount) {
        return reject(new Error(`[getAccessToken] Firebase service account credentials could not be found in environment or paths.`));
      }

      const scopes = [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/firebase.database"
      ];

      // Authenticate a JWT client with the service account.
      const jwtClient = new google.auth.JWT(
        serviceAccount.client_email,
        null,
        serviceAccount.private_key,
        scopes
      );

      jwtClient.authorize(function (error, tokens) {
        if (error) {
          console.error("Error making request to generate access token:", error);
          reject(error);
        } else if (!tokens || !tokens.access_token) {
          console.error("Provided service account does not have permission to generate access tokens");
          reject(new Error("Service account does not have permission"));
        } else {
          resolve(tokens.access_token);
        }
      });
    } catch (err) {
      console.error("[getAccessToken] Fatal error resolving token:", err);
      reject(err);
    }
  });
}

exports.getAccessToken = getAccessToken;
