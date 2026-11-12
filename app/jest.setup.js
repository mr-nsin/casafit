/* global jest */
// Lucide icons draw SVG. Under Jest each one renders as an empty view that keeps its props
// (the kit's Icon sets testID="icon:<name>"), so screens can be tested and icons add no text.
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const cache = {};
  const make = (name) => {
    const Glyph = ({ testID }) => React.createElement(View, { testID, accessible: false });
    Glyph.displayName = `Lucide(${name})`;
    return Glyph;
  };
  return new Proxy(
    {},
    { get: (_t, name) => (name === '__esModule' ? true : (cache[name] ??= make(String(name)))) },
  );
});

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
