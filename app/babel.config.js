module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo adds the Reanimated 4 / react-native-worklets plugin itself.
    presets: ['babel-preset-expo'],
    plugins: [['module-resolver', { alias: { '@': './src' } }]],
  };
};
