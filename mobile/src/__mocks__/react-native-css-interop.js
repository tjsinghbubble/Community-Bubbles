const React = require('react');

module.exports = {
  cssInterop: (Component) => Component,
  remapProps: (Component) => Component,
  StyleSheet: {
    create: (styles) => styles,
  },
};
