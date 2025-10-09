#!/bin/bash

# Setup script for Recce Cloud CI/CD Action (TypeScript version)

set -e

echo "🚀 Setting up Recce Cloud CI/CD Action (TypeScript version)..."
echo ""

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or later."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or later is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi

echo "✅ npm $(npm -v) detected"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"
echo ""

# Type check
echo "🔍 Checking TypeScript types..."
npx tsc --noEmit

if [ $? -ne 0 ]; then
    echo "❌ TypeScript type checking failed"
    exit 1
fi

echo "✅ TypeScript types are valid"
echo ""

# Format check
echo "💅 Checking code formatting..."
npm run format-check

if [ $? -ne 0 ]; then
    echo "⚠️  Formatting issues found. Run 'npm run format' to fix."
    echo "    Continuing anyway..."
else
    echo "✅ Code is properly formatted"
fi
echo ""

# Run linter
echo "🔍 Running linter..."
npm run lint

if [ $? -ne 0 ]; then
    echo "⚠️  Linting issues found."
    echo "    You may want to fix these before deploying."
else
    echo "✅ No linting issues"
fi
echo ""

# Run tests
echo "🧪 Running tests..."
npm test

if [ $? -ne 0 ]; then
    echo "❌ Tests failed"
    exit 1
fi

echo "✅ All tests passed"
echo ""

# Build the action
echo "🔨 Building TypeScript action..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Action built successfully"
echo ""

# Verify dist directory
if [ ! -f "dist/index.js" ]; then
    echo "❌ dist/index.js not found after build"
    exit 1
fi

DIST_SIZE=$(du -h dist/index.js | cut -f1)
echo "📊 dist/index.js size: $DIST_SIZE"
echo ""

# Check for uncommitted changes
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    echo "⚠️  You have uncommitted changes:"
    git status --short 2>/dev/null || echo "    (git not initialized)"
    echo ""
    echo "Remember to commit dist/index.js before deploying!"
else
    echo "✅ No uncommitted changes"
fi

echo ""
echo "🎉 Setup complete! Your TypeScript action is ready to use."
echo ""
echo "📋 Summary:"
echo "  ✅ Dependencies installed"
echo "  ✅ TypeScript types checked"
echo "  ✅ Code formatted"
echo "  ✅ Linter passed"
echo "  ✅ Tests passed ($(npm test 2>&1 | grep -o '[0-9]* passed' || echo 'all passed'))"
echo "  ✅ Action built"
echo ""
echo "Next steps:"
echo "  1. Review the TypeScript code in src/"
echo "  2. Run 'npm test' to run tests"
echo "  3. Run 'npm run build' to rebuild"
echo "  4. Commit dist/index.js to Git"
echo "  5. Create a release tag (e.g., v2.0.0)"
echo ""
echo "For more information, see:"
echo "  - README.md for usage"
echo "  - TYPESCRIPT_GUIDE.md for TypeScript details"
echo "  - DEPLOYMENT.md for deployment guide"
echo ""
echo "TypeScript Benefits:"
echo "  ✨ Type safety at compile time"
echo "  ✨ Better IDE support with IntelliSense"
echo "  ✨ Self-documenting code"
echo "  ✨ Easier refactoring"
echo "  ✨ Fewer runtime errors"
echo ""
