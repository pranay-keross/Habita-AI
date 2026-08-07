module.exports = {
  preset: '@react-native/jest-preset',
  // The preset only lets react-native and @react-native* through babel. The
  // smoke test renders the whole App, which pulls in the RN-ecosystem packages
  // below — all of them ship untranspiled ESM and must be transformed too.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?' +
      '|@react-native-async-storage' +
      '|@react-navigation' +
      '|react-native-gesture-handler' +
      '|react-native-safe-area-context' +
      '|react-native-screens' +
      '|react-native-image-picker' +
      '|react-native-reanimated' +
      '|react-native-worklets' +
      '|react-native-svg' +
      '|lucide-react-native' +
      ')/)',
  ],
  // The preset's own `transform` only matches .js/.ts/.tsx, but lucide-react-native's
  // package.json "exports" resolve to .mjs files — add that extension explicitly, or
  // it slips past transformIgnorePatterns (unignored) but is still never run through
  // babel, so Jest hits its raw `import` syntax. Re-declares the preset's asset
  // transform too, since setting our own `transform` key replaces the preset's map.
  transform: {
    '^.+\\.(js|jsx|mjs|ts|tsx)$': 'babel-jest',
    '^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp)$':
      '@react-native/jest-preset/jest/assetFileTransformer.js',
  },
  // Concatenated after the preset's own setup files, not replacing them.
  setupFiles: ['<rootDir>/jest.setup.js'],
};
