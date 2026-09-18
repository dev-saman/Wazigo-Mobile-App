/**
 * CHAT-20: team replies carry `{{contact.name}}`-style variables that the web
 * app fills client-side. What matters here is that a variable we cannot fill is
 * left visible rather than silently dropped - the person is editing this text
 * in the composer before it goes to a customer.
 */
import type { Contact } from '@/api/types';

import { fillCannedBody, matchesCannedSearch } from '../cannedBody';

const contact = { id: 1, name: 'Asha Menon', phone: '+919876543210' } as Contact;

describe('fillCannedBody', () => {
  it('fills the contact variables the web app fills', () => {
    expect(fillCannedBody('Hi {{contact.name}}, thanks for writing.', contact)).toBe(
      'Hi Asha Menon, thanks for writing.',
    );
    expect(fillCannedBody('Hi {{contact.first_name}}!', contact)).toBe('Hi Asha!');
    expect(fillCannedBody('We will call {{contact.phone}}.', contact)).toBe(
      'We will call +919876543210.',
    );
  });

  it('tolerates the spacing a hand-typed catalogue produces', () => {
    expect(fillCannedBody('Hi {{ contact.name }}', contact)).toBe('Hi Asha Menon');
    expect(fillCannedBody('Hi {{CONTACT.NAME}}', contact)).toBe('Hi Asha Menon');
  });

  it('leaves a variable it cannot fill in place, for the person to edit', () => {
    // Unknown token: not ours to guess at.
    expect(fillCannedBody('Order {{order.number}} shipped', contact)).toBe(
      'Order {{order.number}} shipped',
    );
    // Known token, but this contact has no name on file.
    expect(fillCannedBody('Hi {{contact.name}}', { id: 2 } as Contact)).toBe('Hi {{contact.name}}');
    expect(fillCannedBody('Hi {{contact.name}}', null)).toBe('Hi {{contact.name}}');
  });

  it('handles an empty body', () => {
    expect(fillCannedBody('', contact)).toBe('');
  });
});

describe('matchesCannedSearch', () => {
  const reply = { title: 'Delivery delay', shortcut: 'delay', body: 'Sorry for the wait' };

  it('matches title, shortcut and body, ignoring case', () => {
    expect(matchesCannedSearch(reply, 'DELIVERY')).toBe(true);
    expect(matchesCannedSearch(reply, 'delay')).toBe(true);
    expect(matchesCannedSearch(reply, 'wait')).toBe(true);
    expect(matchesCannedSearch(reply, 'refund')).toBe(false);
  });

  it('accepts the web app\'s "/" shortcut convention', () => {
    expect(matchesCannedSearch(reply, '/delay')).toBe(true);
  });

  it('shows everything for an empty term', () => {
    expect(matchesCannedSearch(reply, '')).toBe(true);
    expect(matchesCannedSearch(reply, '   ')).toBe(true);
  });

  it('does not blow up on missing fields', () => {
    expect(matchesCannedSearch({ title: null, shortcut: null, body: null }, 'x')).toBe(false);
  });
});
