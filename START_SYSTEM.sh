#!/bin/bash

echo "Starting Frontend Dashboard System..."
echo ""

echo "[1/2] Starting API Server on port 3001..."
node server/api/index.js &
API_PID=$!

sleep 3

echo "[2/2] Starting Frontend on port 3000..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "========================================"
echo "System Started!"
echo "========================================"
echo "Frontend: http://localhost:3000"
echo "API: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for user interrupt
trap "kill $API_PID $FRONTEND_PID; exit" INT
wait


















