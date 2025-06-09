#!/bin/bash
set -e

# Build static site (Next.js will output to out/ with output: 'export')
NEXT_PUBLIC_BASE_PATH=/world-map-vibe-code GITHUB_PAGES=true npm run export

# Deploy to gh-pages branch
if ! command -v gh-pages &> /dev/null; then
  npm install --save-dev gh-pages
fi

npx gh-pages -d out --dotfiles

echo "Deployed to GitHub Pages!" 
