module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
    ],
    plugins: [
      // react-native-reanimated v4 moved its Babel plugin to react-native-worklets
      'react-native-worklets/plugin',
    ],
  };
};
