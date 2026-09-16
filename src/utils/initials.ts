/**
 * `\p{L}` covers Devanagari, Arabic and every other script a customer's name
 * may be written in. Should an engine lack Unicode property escapes, a cased
 * letter is the fallback - it still refuses digits and `+`.
 */
const isLetter = (() => {
  try {
    const letter = new RegExp('^\\p{L}$', 'u');
    return (char: string) => letter.test(char);
  } catch {
    return (char: string) => char.toLowerCase() !== char.toUpperCase();
  }
})();

/**
 * Up to two initials, taken only from words that begin with a letter. A phone
 * number has none: "+91 90045 83919" used to become "+8", which reads like a
 * count. Returns '' when there is nothing honest to show.
 */
export const getInitials = (name?: string | null): string => {
  const letters = (name ?? '')
    .trim()
    .split(/\s+/)
    .map((word) => Array.from(word)[0] ?? '')
    .filter(isLetter);
  if (letters.length === 0) return '';
  const first = letters[0];
  const last = letters.length > 1 ? letters[letters.length - 1] : '';
  return (first + last).toUpperCase();
};
