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
      ')/)',
  ],
  // Concatenated after the preset's own setup files, not replacing them.
  setupFiles: ['<rootDir>/jest.setup.js'],
};
