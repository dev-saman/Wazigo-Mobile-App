/**
 * A fresh key per tap for the endpoints that take one (CHAT-30).
 *
 * The server uses it only to recognise the same request twice - a retry after
 * a timeout replays the first answer instead of adding a second follow-up - so
 * it needs to be unique, not unguessable. React Native has no `crypto.randomUUID`
 * and this project has no crypto dependency, so the shape is a v4 UUID built
 * from `Math.random`. Never use this for anything that must resist guessing.
 */
export function idempotencyKey(): string {
  const hex = (length: number) =>
    Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  // Version 4, variant 1, as the server's validator expects a UUID shape.
  const variant = (8 + Math.floor(Math.random() * 4)).toString(16);
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
}
