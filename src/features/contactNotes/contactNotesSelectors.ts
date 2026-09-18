import type { RootState } from '@/store/store';

export const selectContactNotes = (state: RootState) => state.contactNotes.items;
export const selectContactNotesStatus = (state: RootState) => state.contactNotes.status;
export const selectContactNotesError = (state: RootState) => state.contactNotes.error;
export const selectContactNoteSaving = (state: RootState) => state.contactNotes.saving;
export const selectContactNoteSaveError = (state: RootState) => state.contactNotes.saveError;
export const selectContactNotesCount = (state: RootState) => state.contactNotes.items.length;
