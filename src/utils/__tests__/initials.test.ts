import { getInitials } from '../initials';

describe('getInitials', () => {
  it('takes the first and last initials of a name', () => {
    expect(getInitials('Priya Sharma')).toBe('PS');
    expect(getInitials('akmal')).toBe('A');
    expect(getInitials('  Asha   Devi  Rao ')).toBe('AR');
  });

  it('works for names that are not in Latin script', () => {
    expect(getInitials('प्रिया शर्मा')).toBe('पश');
  });

  it('never turns a phone number into initials', () => {
    // The avatar that read "+8" on the first device run.
    expect(getInitials('+91 90045 83919')).toBe('');
    expect(getInitials('919004583919')).toBe('');
    expect(getInitials('(022) 555-0100')).toBe('');
  });

  it('ignores digits and symbols but keeps the words that are a name', () => {
    expect(getInitials('Store #2 Manager')).toBe('SM');
  });

  it('is empty when there is nothing to use', () => {
    expect(getInitials('')).toBe('');
    expect(getInitials(null)).toBe('');
    expect(getInitials(undefined)).toBe('');
  });
});
