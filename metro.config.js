const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const exclusionList = require('metro-config/private/defaults/exclusionList').default;

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // Native build output holds no JS, but Metro's watcher still descends into
    // it. A Gradle build that removes a watched directory (e.g. dropping an ABI
    // from reactNativeArchitectures) makes the watcher throw ENOENT and kill
    // the dev server. Excluding these also shortens the startup scan.
    //
    // Write separators as plain "/" -- exclusionList rewrites them to the
    // platform separator, and anchors each pattern at the end with "$".
    blockList: exclusionList([
      /.*\/android\/build\/.*/,
      /.*\/android\/\.cxx\/.*/,
      /.*\/ios\/build\/.*/,
      /.*\/ios\/Pods\/.*/,
    ]),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
