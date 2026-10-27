/* global jest */
// Icon fonts are loaded through expo-asset, which has no asset registry under Jest.
// Render icons as plain text so screens that use them can be tested.
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const makeIcon = (family) => {
    const Icon = ({ name }) => React.createElement(Text, null, `${family}:${name}`);
    Icon.displayName = family;
    return Icon;
  };
  return new Proxy(
    {},
    { get: (_target, family) => (family === '__esModule' ? true : makeIcon(String(family))) },
  );
});
