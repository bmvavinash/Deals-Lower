# API Server

Express.js REST API server for the Deals Dashboard frontend.

## Start Server

```bash
node server/api/index.js
```

Or use npm script:
```bash
npm run api
```

The server will start on port 3001 (configurable in `config/constants.js`).

## Health Check

```bash
curl http://localhost:3001/health
```

## API Documentation

See main README_FRONTEND.md for complete API documentation.

## Dependencies

- express
- cors
- firebase-admin (from main project)
- All existing project dependencies


















