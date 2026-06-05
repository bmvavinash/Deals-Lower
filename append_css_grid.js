
const fs = require("fs");
let css = fs.readFileSync("frontend/src/components/Deals/ExpandableDealCard.css", "utf8");

// Replace .edit-form to be a grid
css = css.replace(/.edit-form {[\s\S]*?}/, `.edit-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px dashed #ccc;
}
.edit-form > h4 {
  grid-column: 1 / -1;
  margin: 0 0 10px 0;
}
.edit-actions {
  grid-column: 1 / -1;
  display: flex;
  gap: 10px;
  margin-top: 10px;
}`);

fs.writeFileSync("frontend/src/components/Deals/ExpandableDealCard.css", css);

