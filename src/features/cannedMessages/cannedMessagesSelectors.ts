import type { RootState } from '@/store/store';

export const selectCannedMessages = (state: RootState) => state.cannedMessages.items;
export const selectCannedMessagesStatus = (state: RootState) => state.cannedMessages.status;
export const selectCannedMessagesError = (state: RootState) => state.cannedMessages.error;
