import { MessageLimits, type MessageTemplate } from '@/api/types';

import {
  parameterCount,
  parameterLabels,
  placeholdersIn,
  renderTemplateText,
  templateHasParameters,
  validateParameters,
} from '../templateParams';

const template = (fields: Partial<MessageTemplate>): MessageTemplate =>
  ({ id: 1, name: 'order_update', ...fields }) as MessageTemplate;

describe('placeholdersIn', () => {
  it('finds numbered and named variables, once each, in order', () => {
    expect(placeholdersIn('Hi {{1}}, your order {{2}} ships on {{2}}.')).toEqual(['1', '2']);
    expect(placeholdersIn('Hi {{ name }}, see {{order_id}}')).toEqual(['name', 'order_id']);
    expect(placeholdersIn(null)).toEqual([]);
  });
});

describe('parameterCount', () => {
  it('trusts the server count first', () => {
    const subject = template({ body_text: 'Hi {{1}}', variable_counts: { body: 3 } });
    expect(parameterCount(subject, 'body')).toBe(3);
  });

  it('counts the placeholders when the server sent no count', () => {
    const subject = template({ body_text: 'Hi {{1}}, order {{2}}' });
    expect(parameterCount(subject, 'body')).toBe(2);
    expect(parameterCount(subject, 'header')).toBe(0);
  });

  it('never offers more than the documented maximum', () => {
    const subject = template({ variable_counts: { body: 50 } });
    expect(parameterCount(subject, 'body')).toBe(MessageLimits.templateParamsMax);
  });

  it('knows when a template needs nothing filled in', () => {
    expect(templateHasParameters(template({ body_text: 'Thanks for your order.' }))).toBe(false);
  });
});

describe('parameterLabels', () => {
  it('uses the server tokens when they are names', () => {
    const subject = template({
      body_text: 'Hi {{1}}, order {{2}}',
      variable_tokens: { body: ['customer_name', 'order_id'] },
    });

    expect(parameterLabels(subject, 'body')).toEqual(['customer_name', 'order_id']);
  });

  it('falls back to a numbered label', () => {
    const subject = template({ body_text: 'Hi {{1}}, order {{2}}' });
    expect(parameterLabels(subject, 'body')).toEqual(['Variable 1', 'Variable 2']);
  });
});

describe('renderTemplateText', () => {
  const labels = ['Variable 1', 'Variable 2'];

  it('shows the customer-facing text as values are typed', () => {
    expect(renderTemplateText('Hi {{1}}, order {{2}} is on the way.', ['Asha', 'A-91'], labels)).toBe(
      'Hi Asha, order A-91 is on the way.',
    );
  });

  it('leaves a placeholder visible while its value is still empty', () => {
    expect(renderTemplateText('Hi {{1}}, order {{2}}.', ['Asha', '  '], labels)).toBe(
      'Hi Asha, order {{2}}.',
    );
  });

  it('substitutes named variables by their label', () => {
    expect(renderTemplateText('Hi {{name}}', ['Asha'], ['name'])).toBe('Hi Asha');
  });
});

describe('validateParameters', () => {
  it('refuses an empty variable before WhatsApp does', () => {
    expect(validateParameters(['Asha', '   '], 'body')).toEqual([
      { section: 'body', index: 1, message: 'This value is required.' },
    ]);
  });

  it('refuses a variable over 1024 characters', () => {
    const errors = validateParameters(['x'.repeat(MessageLimits.templateParamLengthMax + 1)], 'header');
    expect(errors[0]).toMatchObject({ section: 'header', index: 0 });
    expect(errors[0].message).toMatch(/1024/);
  });

  it('accepts a filled-in set', () => {
    expect(validateParameters(['Asha', 'A-91'], 'body')).toEqual([]);
  });
});
