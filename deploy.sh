#!/bin/bash
set -e

# Build and export static site
GITHUB_PAGES=true npm run export

# Deploy to gh-pages branch
if ! command -v gh-pages &> /dev/null; then
  npm install -g gh-pages
fi

gh-pages -d out

echo "Deployed to GitHub Pages!" 