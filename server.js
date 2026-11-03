// Production & Cloud Server Entrypoint
const app = require('./server/api/index.js');
const PORT = process.env.PORT || 3003;

if (!app._listening) {
  app._listening = true;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ API Server listening on 0.0.0.0:${PORT}`);
  });
}

module.exports = app;
