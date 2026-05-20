const fs = require("fs");
const net = require("net");
const path = require("path");

const results = [];

function log(name, status, detail = "") {
  results.push({ name, status, detail });
  console.log(`${status === "ok" ? "✓" : "✗"} ${name}${detail ? ": " + detail : ""}`);
}

async function checkPort(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection(port, "127.0.0.1");
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.on("connect", () => done(true));
    socket.on("error", () => done(false));
    setTimeout(() => done(false), 2000);
  });
}

async function fetchWithTimeout(url, ms = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  try {
    require("selenium-webdriver");
    require("chromedriver");
    log("npm_dependencies", "ok");
  } catch (e) {
    log("npm_dependencies", "fail", e.message);
  }

  let constants;
  let config;
  try {
    constants = require("../config/constants");
    config = require("../config/config");
    log("config_load", "ok", `env=${constants.env}, type=${constants.type}`);
  } catch (e) {
    log("config_load", "fail", e.message);
    printSummary();
    process.exit(1);
  }

  const tokenFile = config.DATABASE_CONFIG.DB1_TOKEN_FILE;
  const keyFile = path.join(constants.pathToFile, `${tokenFile}.json`);
  if (fs.existsSync(keyFile)) {
    log("firebase_service_account", "ok", keyFile);
  } else {
    log("firebase_service_account", "fail", `Missing ${keyFile}`);
  }

  if (await checkPort(9222)) {
    log("chrome_remote_debugging", "ok", "localhost:9222");
  } else {
    log(
      "chrome_remote_debugging",
      "fail",
      'Chrome not listening on 9222. Start with: chrome.exe --remote-debugging-port=9222'
    );
  }

  const date = new Date();
  const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const telegramExport = `C:/Users/Dell/Downloads/Telegram Desktop/ChatExport_${formattedDate}/result.json`;
  if (fs.existsSync(telegramExport)) {
    log("telegram_export_json", "ok", telegramExport);
  } else {
    log("telegram_export_json", "fail", `Missing ${telegramExport}`);
  }

  if (fs.existsSync(keyFile)) {
    try {
      const { getAccessToken } = require("../database/getAccessToken");
      await getAccessToken(constants.env);
      log("firebase_auth_token", "ok");
    } catch (e) {
      log("firebase_auth_token", "fail", e.message);
    }
  } else {
    log("firebase_auth_token", "skip", "no service account file");
  }

  try {
    const dbname = constants.postingTypesConfig[constants.type].DB;
    const dbName = config.DATABASE_CONFIG[`${dbname}_NAME`];
    const jsonFileName = config.DATABASE_CONFIG.JSON_FILE_NAME;
    const apiUrl = `https://${dbName}-default-rtdb.firebaseio.com/${jsonFileName}.json`;
    const response = await fetchWithTimeout(apiUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const count = data ? Object.keys(data).length : 0;
    log("firebase_realtime_db", "ok", `${count} records at ${dbName}/${jsonFileName}`);
  } catch (e) {
    log("firebase_realtime_db", "fail", e.message);
  }

  printSummary();
  const failed = results.filter((r) => r.status === "fail").length;
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary() {
  const ok = results.filter((r) => r.status === "ok").length;
  const fail = results.filter((r) => r.status === "fail").length;
  const skip = results.filter((r) => r.status === "skip").length;
  console.log(`\nSummary: ${ok} passed, ${fail} failed, ${skip} skipped`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
