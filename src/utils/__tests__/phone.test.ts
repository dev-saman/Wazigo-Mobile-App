import {
  formatNationalNumber,
  formatPhoneForDisplay,
  isValidNationalNumber,
  toE164,
  toNationalDigits,
} from '../phone';

describe('toNationalDigits', () => {
  it('strips formatting, the country code and trunk zeros', () => {
    expect(toNationalDigits('+91 98765 43210')).toBe('9876543210');
    expect(toNationalDigits('919876543210')).toBe('9876543210');
    expect(toNationalDigits('09876543210')).toBe('9876543210');
    expect(toNationalDigits('(98765) 43210')).toBe('9876543210');
  });

  it('keeps a valid number that happens to start with 91', () => {
    expect(toNationalDigits('9100000000')).toBe('9100000000');
  });

  it('never returns more than 10 digits', () => {
    expect(toNationalDigits('98765432109999')).toHaveLength(10);
  });
});

describe('isValidNationalNumber', () => {
  it('accepts the Indian mobile series only', () => {
    expect(isValidNationalNumber('9876543210')).toBe(true);
    expect(isValidNationalNumber('6012345678')).toBe(true);
    expect(isValidNationalNumber('5876543210')).toBe(false);
    expect(isValidNationalNumber('98765432')).toBe(false);
  });
});

describe('formatting', () => {
  it('groups the national number as it is typed', () => {
    expect(formatNationalNumber('98765')).toBe('98765');
    expect(formatNationalNumber('987654')).toBe('98765 4');
    expect(formatNationalNumber('9876543210')).toBe('98765 43210');
  });

  it('displays E.164 with the country code', () => {
    expect(formatPhoneForDisplay('+919876543210')).toBe('+91 98765 43210');
  });
});

describe('toE164', () => {
  it('normalizes anything valid to +91XXXXXXXXXX', () => {
    expect(toE164('98765 43210')).toBe('+919876543210');
    expect(toE164('+91 98765 43210')).toBe('+919876543210');
  });

  it('returns null for numbers the API would reject', () => {
    expect(toE164('12345')).toBeNull();
    expect(toE164('5876543210')).toBeNull();
  });
});
