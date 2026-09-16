import { describeBody, formatDebugValue, redact } from '../debugLog';

describe('redact', () => {
  it('hides every credential in a login response, at any depth', () => {
    const session = {
      status: true,
      data: {
        access_token: 'eyJ.secret',
        refresh_token: 'refresh-secret',
        token_type: 'bearer',
        user: { id: 7, name: 'Akmal', nested: { Authorization: 'Bearer x' } },
      },
    };

    expect(redact(session)).toEqual({
      status: true,
      data: {
        access_token: '[redacted]',
        refresh_token: '[redacted]',
        token_type: 'bearer',
        user: { id: 7, name: 'Akmal', nested: { Authorization: '[redacted]' } },
      },
    });
  });

  it('hides a login code and password, and leaves the original untouched', () => {
    const body = { phone: '+919876543210', code: '12345', password: 'hunter2' };

    expect(redact(body)).toEqual({ phone: '+919876543210', code: '[redacted]', password: '[redacted]' });
    expect(body.code).toBe('12345');
  });

  it('keeps ordinary data, arrays included', () => {
    expect(redact([{ id: 1, text_body: 'hello' }])).toEqual([{ id: 1, text_body: 'hello' }]);
    expect(redact('plain')).toBe('plain');
    expect(redact(null)).toBeNull();
  });
});

describe('describeBody', () => {
  it('names an uploaded file instead of printing it', () => {
    const form = {
      getParts: () => [
        { fieldName: 'type', string: 'image' },
        { fieldName: 'file', uri: 'file:///cache/photo.jpg', name: 'photo.jpg', type: 'image/jpeg' },
      ],
    };

    expect(describeBody(form)).toEqual({
      type: 'image',
      file: { file: 'photo.jpg', type: 'image/jpeg' },
    });
  });

  it('parses and redacts a JSON string body', () => {
    expect(describeBody('{"refresh_token":"abc","device_name":"Pixel"}')).toEqual({
      refresh_token: '[redacted]',
      device_name: 'Pixel',
    });
  });

  it('reports no body as none', () => {
    expect(describeBody(undefined)).toBeUndefined();
    expect(formatDebugValue(undefined)).toBe('(none)');
  });
});

describe('formatDebugValue', () => {
  it('cuts very long bodies instead of flooding the terminal', () => {
    const text = formatDebugValue({ text: 'x'.repeat(100) }, 50);
    expect(text.startsWith('{')).toBe(true);
    expect(text).toMatch(/… \(\d+ more characters\)$/);
  });
});
