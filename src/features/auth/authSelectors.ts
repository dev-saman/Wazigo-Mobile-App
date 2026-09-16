import type { RootState } from '@/store/store';

export const selectAuthStatus = (state: RootState) => state.auth.status;
export const selectCurrentUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) => state.auth.status === 'authenticated';
export const selectSessionExpired = (state: RootState) => state.auth.sessionExpired;
/** The login code that has been requested but not yet accepted. */
export const selectOtpChallenge = (state: RootState) => state.auth.otpChallenge;
