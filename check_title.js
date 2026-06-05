
const fs = require("fs");
const cheerio = require("cheerio");
const $ = cheerio.load(fs.readFileSync("fk_page.html"));
console.log($("title").text());

