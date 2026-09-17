/**
 * The first device run crashed with "Object cannot be used as a constructor":
 * pusher-js's React Native bundle exports `{ Pusher }` while its types promise
 * a default export. These are the shapes the socket client must cope with.
 */
// The React Native bundle subscribes to NetInfo as it loads.
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

import { resolvePusherConstructor } from '../resolvePusher';

class FakePusher {}

it('finds the class on the named `Pusher` export (the React Native bundle)', () => {
  expect(resolvePusherConstructor({ Pusher: FakePusher })).toBe(FakePusher);
});

it('finds it through Babel interop wrapping that object in `default`', () => {
  expect(resolvePusherConstructor({ default: { Pusher: FakePusher } })).toBe(FakePusher);
});

it('accepts a real default export or the class itself', () => {
  expect(resolvePusherConstructor({ default: FakePusher })).toBe(FakePusher);
  expect(resolvePusherConstructor(FakePusher)).toBe(FakePusher);
});

it('returns null rather than an object that cannot be constructed', () => {
  expect(resolvePusherConstructor({ default: { Pusher: 'nope' } })).toBeNull();
  expect(resolvePusherConstructor({})).toBeNull();
  expect(resolvePusherConstructor(null)).toBeNull();
});

it('resolves the class from the installed pusher-js React Native bundle', () => {
  // The real file, not a mock: this is the shape that broke on the device.
  const bundle = require('pusher-js/dist/react-native/pusher.js');
  expect(typeof resolvePusherConstructor(bundle)).toBe('function');
});
