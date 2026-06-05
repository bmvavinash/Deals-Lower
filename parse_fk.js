
const fs = require("fs");
const cheerio = require("cheerio");
const $ = cheerio.load(fs.readFileSync("fk_page.html"));

const prices = [];
$("div").each((i, el) => {
  const text = $(el).text();
  if (text.includes("?") && text.length < 15 && $(el).children().length === 0) {
    prices.push({ class: $(el).attr("class"), text: text });
  }
});

console.log("Possible prices:", prices.slice(0, 10));

const images = [];
$("img").each((i, el) => {
  const src = $(el).attr("src");
  if (src && src.includes("rukminim2")) {
    images.push({ class: $(el).attr("class"), src: src });
  }
});
console.log("Possible images:", images.slice(0, 5));

