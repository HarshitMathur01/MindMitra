#!/bin/bash

# 🚀 Mind-mate Direct Backend Startup Script
# This script starts both backend and frontend in direct mode (no ngrok!)

set -e  # Exit on error

echo "🎯 =========================================="
echo "🎯 Mind-mate Direct Backend Mode Startup"
echo "🎯 =========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if conda is available
if ! command -v conda &> /dev/null; then
    echo -e "${RED}❌ Conda not found. Please install Miniconda/Anaconda.${NC}"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found. Please install Node.js.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down servers...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

trap cleanup EXIT INT TERM

# 1. Start Backend
echo -e "${YELLOW}🔧 Step 1: Starting Python Backend...${NC}"
cd chatbotAgent

# Activate conda environment
echo "   Activating conda environment 'msd'..."
eval "$(conda shell.bash hook)"
conda activate msd

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ chatbotAgent/.env not found!${NC}"
    echo "   Please create it with SUPABASE_KEY and GOOGLE_API_KEY"
    exit 1
fi

echo "   Starting FastAPI server on port 8000..."
python main.py > ../logs/backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
echo "   Waiting for backend to be ready..."
for i in {1..10}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is ready!${NC}"
        break
    fi
    if [ $i -eq 10 ]; then
        echo -e "${RED}❌ Backend failed to start. Check logs/backend.log${NC}"
        exit 1
    fi
    sleep 1
done

cd ..
echo ""

# 2. Start Frontend
echo -e "${YELLOW}🌐 Step 2: Starting Frontend...${NC}"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env not found in project root!${NC}"
    echo "   Please create it with VITE_BACKEND_URL"
    exit 1
fi

echo "   Starting Vite dev server..."
npm run dev > logs/frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for frontend to start
echo "   Waiting for frontend to be ready..."
sleep 3

echo ""
echo -e "${GREEN}✅ ==========================================${NC}"
echo -e "${GREEN}✅ Both servers are running!${NC}"
echo -e "${GREEN}✅ ==========================================${NC}"
echo ""
echo -e "${YELLOW}📱 Frontend:${NC} http://localhost:5173"
echo -e "${YELLOW}🔧 Backend:${NC}  http://localhost:8000"
echo -e "${YELLOW}📊 Health:${NC}   http://localhost:8000/health"
echo ""
echo -e "${YELLOW}📝 Logs:${NC}"
echo "   Backend:  tail -f logs/backend.log"
echo "   Frontend: tail -f logs/frontend.log"
echo ""
echo -e "${YELLOW}🛑 To stop:${NC} Press Ctrl+C"
echo ""

# Keep script running
wait
