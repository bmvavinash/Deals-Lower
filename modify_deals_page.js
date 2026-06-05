
const fs = require("fs");
let content = fs.readFileSync("frontend/src/pages/DealsPage.tsx", "utf8");

content = content.replace(
  /<div className="deals-view-header">[\s\S]*?<DealFilters filters={filters} onFilterChange={handleFilterChange} isLoading={dealsLoading} \/>/,
  `<div className="deals-page-layout">
            <div className="deals-sidebar">
              <DealFilters filters={filters} onFilterChange={handleFilterChange} isLoading={dealsLoading} />
            </div>
            
            <div className="deals-main-content">
              <div className="search-section" style={{ display: "flex", gap: "10px", alignItems: "center", justifyContent: "space-between" }}>
`
);

content = content.replace(
  /<div className="product-code-search" style={{ display: .flex., gap: .10px., alignItems: .center., marginLeft: .20px. }}>/,
  `<div className="product-code-search" style={{ display: "flex", gap: "10px", alignItems: "center" }}>`
);

content = content.replace(
  /\{isSearchingCode \? .\?3.... : .dY"\? Search.\}/g,
  `{isSearchingCode ? (
                    <><span className="spinner">?</span> Searching...</>
                  ) : "?? Search"}`
);

content = content.replace(
  /\{isRetriggering \? .\?3.... : .dY", Retrigger.\}/g,
  `{isRetriggering ? (
                    <><span className="spinner">?</span> Retriggering...</>
                  ) : "?? Retrigger"}`
);

content = content.replace(
  /\{isTriggeringBanners \? .\?3 Loading.... : .dYs\? Display Banners.\}/g,
  `{isTriggeringBanners ? (
                  <><span className="spinner">?</span> Loading...</>
                ) : "??? Display Banners"}`
);

content = content.replace(
  /<\/div>\s*\{dealsLoading && !productCodeResult && <div className="loading">Loading deals...<\/div>\}/,
  `</div>
              {dealsLoading && !productCodeResult && <div className="loading"><span className="spinner">?</span> Loading deals...</div>}`
);

// Close the tags
content = content.replace(
  /onPageChange=\{\(offset\) => setFilters\(\{ ...filters, offset \}\)\}\n\s*\/>\n\s*\)\}\n\s*<\/>/,
  `onPageChange={(offset) => setFilters({ ...filters, offset })}\n              />\n            )}\n            </div>\n          </div>\n          </>`
);

fs.writeFileSync("frontend/src/pages/DealsPage.tsx", content);
console.log("DealsPage.tsx updated successfully.");

