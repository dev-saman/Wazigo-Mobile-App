import type { Contact } from '@/api/types';

import { contactDisplay, UNKNOWN_CONTACT } from '../contactDisplay';

const contact = (fields: Partial<Contact>): Contact => ({ id: 1, ...fields }) as Contact;

describe('contactDisplay', () => {
  it('uses the name first', () => {
    expect(contactDisplay(contact({ name: ' Priya Sharma ', phone: '+919004583919' }))).toEqual({
      title: 'Priya Sharma',
      name: 'Priya Sharma',
      phone: '+91 90045 83919',
    });
  });

  it('falls back to the formatted number, never "Conversation"', () => {
    expect(contactDisplay(contact({ name: '', phone: '+919004583919' }))).toEqual({
      title: '+91 90045 83919',
      name: null,
      phone: '+91 90045 83919',
    });
    expect(contactDisplay(contact({ name: null, wa_id: '919004583919' })).title).toBe('+91 90045 83919');
  });

  it('says Unknown Contact only when there is neither', () => {
    expect(contactDisplay(contact({}))).toEqual({ title: UNKNOWN_CONTACT, name: null, phone: null });
    expect(contactDisplay(null).title).toBe('Unknown Contact');
  });
});
