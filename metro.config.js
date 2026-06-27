const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ── Performance optimizations ──────────────────────────────────────────────

// Trim sourceExts to only what the project actually uses (removes unused parsers)
config.resolver.sourceExts = [
  'tsx', 'ts', 'jsx', 'js', 'json', 'cjs', 'mjs',
];

// Remove asset extensions the project never uses (speeds up asset resolution)
const unusedAssetExts = ['psd', 'sketch', 'ai', 'eps', 'heic', 'cr2', 'tiff'];
config.resolver.assetExts = config.resolver.assetExts.filter(
  ext => !unusedAssetExts.includes(ext)
);

module.exports = config;
