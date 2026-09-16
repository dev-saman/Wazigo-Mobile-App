import { firstName, formatCountdown, greetingForHour, secondsUntil } from '../time';

describe('formatCountdown', () => {
  it('always shows MM:SS', () => {
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(28)).toBe('00:28');
    expect(formatCountdown(60)).toBe('01:00');
    expect(formatCountdown(605)).toBe('10:05');
  });

  it('never shows a negative countdown', () => {
    expect(formatCountdown(-5)).toBe('00:00');
  });
});

describe('secondsUntil', () => {
  it('rounds up and floors at zero', () => {
    const now = 1_000_000;
    expect(secondsUntil(now + 1500, now)).toBe(2);
    expect(secondsUntil(now - 1, now)).toBe(0);
  });
});

describe('greetingForHour', () => {
  it('changes at noon and at 17:00', () => {
    expect(greetingForHour(0)).toBe('Good morning');
    expect(greetingForHour(11)).toBe('Good morning');
    expect(greetingForHour(12)).toBe('Good afternoon');
    expect(greetingForHour(16)).toBe('Good afternoon');
    expect(greetingForHour(17)).toBe('Good evening');
    expect(greetingForHour(23)).toBe('Good evening');
  });
});

describe('firstName', () => {
  it('takes the first word, or nothing at all', () => {
    expect(firstName('Asha Rao')).toBe('Asha');
    expect(firstName('  Vishal   Kumar ')).toBe('Vishal');
    expect(firstName('')).toBe('');
    expect(firstName(null)).toBe('');
    expect(firstName(undefined)).toBe('');
  });
});
