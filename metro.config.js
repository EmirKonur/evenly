const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle migrations are plain .sql files bundled into the app.
config.resolver.sourceExts.push('sql');

module.exports = config;
