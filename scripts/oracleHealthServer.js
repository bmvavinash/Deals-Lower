const http = require('http');
const os = require('os');

const PORT = process.env.PORT || 3001;

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/health' || url === '/ping' || url === '/' || url === '/api/health') {
    const memTotal = Math.round(os.totalmem() / 1024 / 1024);
    const memFree = Math.round(os.freemem() / 1024 / 1024);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    res.end(JSON.stringify({
      status: 'ok',
      server: 'oracle-cloud',
      uptime: Math.round(process.uptime()),
      loadAvg: os.loadavg(),
      memory: `${memFree}MB free / ${memTotal}MB total`,
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡ Oracle Health Server active and listening on http://0.0.0.0:${PORT}`);
});
