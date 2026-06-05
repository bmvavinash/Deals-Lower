
const fs = require("fs");
const cheerio = require("cheerio");
const $ = cheerio.load(fs.readFileSync("fk_page.html"));
$("*").each((i, el) => {
  const text = $(el).text().trim();
  if (text.startsWith("?") || text.includes("?")) {
    if ($(el).children().length === 0) {
      console.log("Price element text:", text, "class:", $(el).attr("class"));
    }
  }
});

