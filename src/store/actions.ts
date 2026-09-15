import { createAction } from '@reduxjs/toolkit';

/** Wipes all session-scoped state (logout, session expiry). */
export const appReset = createAction('app/reset');
