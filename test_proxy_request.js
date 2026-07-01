const http = require('http');

function request(url) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          duration: Date.now() - start,
          dataLength: data.length,
          preview: data.substring(0, 500)
        });
      });
    }).on('error', err => {
      resolve({
        error: err.message,
        duration: Date.now() - start
      });
    });
  });
}

async function run() {
  console.log("Querying through Vite Proxy: http://localhost:5174/api/deals?dealType=hotDeal&limit=100&offset=0...");
  const result = await request("http://localhost:5174/api/deals?dealType=hotDeal&limit=100&offset=0");
  console.log("Result:", result);
}

run();
