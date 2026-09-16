import type { RootState } from '@/store/store';

export const selectTemplates = (state: RootState) => state.templates.items;
export const selectTemplatesStatus = (state: RootState) => state.templates.status;
export const selectTemplatesError = (state: RootState) => state.templates.error;
export const selectTemplateSearch = (state: RootState) => state.templates.search;

export const selectHasMoreTemplates = (state: RootState) =>
  state.templates.page > 0 && state.templates.page < state.templates.lastPage;

export const selectTemplateById = (templateId: number) => (state: RootState) =>
  state.templates.items.find((item) => item.id === templateId) ?? null;
