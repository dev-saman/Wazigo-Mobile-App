/**
 * Drafts live in the store so the CHAT-20 picker - a separate route, mounted
 * while the thread screen is not - can write into the composer directly.
 */
import { composerReducer, draftAppended, draftChanged, draftCleared } from '../composerSlice';

const empty = { drafts: {} };

describe('composerSlice', () => {
  it('keeps a draft per conversation', () => {
    let state = composerReducer(empty, draftChanged({ conversationId: '1', text: 'Hello' }));
    state = composerReducer(state, draftChanged({ conversationId: '2', text: 'Other' }));
    expect(state.drafts).toEqual({ '1': 'Hello', '2': 'Other' });
  });

  it('forgets a draft that was emptied, rather than storing ""', () => {
    let state = composerReducer(empty, draftChanged({ conversationId: '1', text: 'Hello' }));
    state = composerReducer(state, draftChanged({ conversationId: '1', text: '' }));
    expect(state.drafts).toEqual({});
  });

  it('appends a quick reply to what was already typed', () => {
    let state = composerReducer(empty, draftChanged({ conversationId: '1', text: 'Hi there ' }));
    state = composerReducer(state, draftAppended({ conversationId: '1', text: 'we ship tomorrow.' }));
    expect(state.drafts['1']).toBe('Hi there we ship tomorrow.');
  });

  it('uses the quick reply alone when nothing was typed', () => {
    const state = composerReducer(empty, draftAppended({ conversationId: '1', text: 'Thanks!' }));
    expect(state.drafts['1']).toBe('Thanks!');
  });

  it('ignores an empty append rather than adding a stray space', () => {
    let state = composerReducer(empty, draftChanged({ conversationId: '1', text: 'Hi' }));
    state = composerReducer(state, draftAppended({ conversationId: '1', text: '' }));
    expect(state.drafts['1']).toBe('Hi');
  });

  it('clears one conversation without touching the others', () => {
    let state = composerReducer(empty, draftChanged({ conversationId: '1', text: 'Hello' }));
    state = composerReducer(state, draftChanged({ conversationId: '2', text: 'Other' }));
    state = composerReducer(state, draftCleared('1'));
    expect(state.drafts).toEqual({ '2': 'Other' });
  });
});
