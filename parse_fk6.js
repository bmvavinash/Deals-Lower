
const fs = require("fs");
const cheerio = require("cheerio");
const $ = cheerio.load(fs.readFileSync("fk_page.html"));
$("*").each((i, el) => {
  const text = $(el).text();
  if (text.includes("59,900") && $(el).children().length === 0) {
    console.log("Tag:", el.tagName, "Class:", $(el).attr("class"));
  }
});

