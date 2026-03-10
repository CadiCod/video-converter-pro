#!/bin/bash
echo ""
echo "  ========================================"
echo "   Video Converter Pro - Starting..."
echo "  ========================================"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "  Installing dependencies..."
    echo ""
    npm install
    echo ""
fi

# Start the application
echo "  Launching application..."
npx electron .
