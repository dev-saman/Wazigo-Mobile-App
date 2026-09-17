/**
 * Finds the Pusher class inside whatever `pusher-js/react-native` hands back.
 *
 * Its type declarations say `export default Pusher`, but the React Native
 * bundle (dist/react-native/pusher.js, 8.6.0) actually ends with
 * `module.exports.Pusher = Pusher` - there is no default export. A default
 * import therefore received the module object, and `new Pusher(...)` threw
 * "Object cannot be used as a constructor" on the first device run
 * (2026-09-17), while typecheck and the bundler were both satisfied.
 *
 * Pure so it can be tested against each shape without loading the socket client.
 */
export function resolvePusherConstructor<T>(mod: unknown): T | null {
  const candidates = [
    (mod as { Pusher?: unknown } | null)?.Pusher,
    (mod as { default?: { Pusher?: unknown } } | null)?.default?.Pusher,
    (mod as { default?: unknown } | null)?.default,
    mod,
  ];
  const found = candidates.find((candidate) => typeof candidate === 'function');
  return (found as T | undefined) ?? null;
}
