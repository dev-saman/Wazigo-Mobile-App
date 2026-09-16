import { messageErrorText } from '../messageError';

describe('messageErrorText', () => {
  it('reads the WhatsApp error object the live API actually sends', () => {
    // The shape that crashed the thread on the first device run.
    expect(
      messageErrorText({
        code: 131047,
        title: 'Re-engagement message',
        message: 'Re-engagement message',
        error_data: { details: 'More than 24 hours have passed since the customer last replied.' },
      }),
    ).toBe('More than 24 hours have passed since the customer last replied.');
  });

  it('falls back from details to message to title to the code', () => {
    expect(messageErrorText({ code: 1, title: 'Title', message: 'Message', error_data: {} })).toBe('Message');
    expect(messageErrorText({ code: 1, title: 'Title', message: '  ' })).toBe('Title');
    expect(messageErrorText({ code: 131026 })).toBe('WhatsApp error 131026');
  });

  it('still accepts the plain string the workbook documents', () => {
    expect(messageErrorText('  Recipient is not on WhatsApp  ')).toBe('Recipient is not on WhatsApp');
  });

  it('takes the first readable entry from a list of errors', () => {
    expect(messageErrorText([{}, { message: 'Second one explains it' }])).toBe('Second one explains it');
  });

  it('returns null rather than anything that cannot be rendered as text', () => {
    expect(messageErrorText(null)).toBeNull();
    expect(messageErrorText(undefined)).toBeNull();
    expect(messageErrorText('')).toBeNull();
    expect(messageErrorText({})).toBeNull();
    expect(messageErrorText({ error_data: 'not an object' })).toBeNull();
    expect(messageErrorText(42)).toBeNull();
    expect(messageErrorText([])).toBeNull();
  });
});
