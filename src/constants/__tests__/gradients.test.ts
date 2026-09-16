import { Gradients } from '../colors';

// React Native's own parser for `experimental_backgroundImage`. An invalid
// gradient string is dropped without an error, which would leave the splash a
// flat green with nothing to say why - so the parse is checked here.
const processBackgroundImage = require('react-native/Libraries/StyleSheet/processBackgroundImage').default;

describe('Gradients.splash', () => {
  it('parses into the three layers of the design', () => {
    const layers = processBackgroundImage(Gradients.splash);

    expect(layers).toHaveLength(3);
    layers.forEach((layer: { type: string; colorStops: unknown[] }) => {
      expect(layer.type).toBe('linear-gradient');
      expect(layer.colorStops.length).toBeGreaterThanOrEqual(2);
    });
  });
});
