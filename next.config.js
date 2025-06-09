/** @type {import('next').NextConfig} */
const isGithubPages = process.env.GITHUB_PAGES === 'true';

const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  basePath: isGithubPages ? '/world-map-vibe-code' : '',
  assetPrefix: isGithubPages ? '/world-map-vibe-code/' : '',
};

module.exports = nextConfig; 