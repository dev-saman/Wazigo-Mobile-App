/**
 * Every API path, relative to Config.apiBaseUrl (…/api/v1).
 * Verified against the API Reference workbook; IDs in comments match its sheets.
 */

type Id = string | number;

const conversation = (id: Id) => `/conversations/${encodeURIComponent(String(id))}`;
const message = (conversationId: Id, messageId: Id) =>
  `${conversation(conversationId)}/messages/${encodeURIComponent(String(messageId))}`;

export const API = {
  auth: {
    requestOtp: '/auth/otp/request', // AUTH-01
    loginOtp: '/auth/login', // AUTH-02
    loginPassword: '/auth/login/password', // AUTH-03
    refresh: '/auth/refresh', // AUTH-04
    logout: '/auth/logout', // AUTH-06
    otpNotice: '/auth/otp/notice', // AUTH-07 (optional)
    me: '/auth/me', // AUTH-08 (optional)
  },

  me: {
    bootstrap: '/me/bootstrap', // AUTH-05
    presence: '/me/presence', // CHAT-16
    presenceHeartbeat: '/me/presence/heartbeat', // CHAT-17
    /**
     * Push device tokens: POST registers this phone, DELETE (token in the body)
     * removes it. Confirmed on the live API 2026-09-17 ("Supported methods:
     * POST, DELETE").
     */
    devices: '/me/devices',
    /** AUTH-11: mute_notifications / mute_sound. Server-side push mute. */
    preferences: '/me/preferences',
  },

  dashboard: {
    overview: '/crm/overview', // DASH-01
  },

  conversations: {
    list: '/conversations', // CHAT-01
    messages: (conversationId: Id) => `${conversation(conversationId)}/messages`, // CHAT-02 / 03 / 04
    media: (conversationId: Id, messageId: Id) => `${message(conversationId, messageId)}/media`, // CHAT-05
    read: (conversationId: Id) => `${conversation(conversationId)}/read`, // CHAT-06
    template: (conversationId: Id) => `${conversation(conversationId)}/template`, // CHAT-08
    retryMessage: (conversationId: Id, messageId: Id) => `${message(conversationId, messageId)}/retry`, // CHAT-09
    resolve: (conversationId: Id) => `${conversation(conversationId)}/resolve`, // CHAT-10
    reopen: (conversationId: Id) => `${conversation(conversationId)}/reopen`, // CHAT-11
    labels: (conversationId: Id) => `${conversation(conversationId)}/labels`, // CHAT-14
    priority: (conversationId: Id) => `${conversation(conversationId)}/priority`, // CHAT-15
    stopChatbot: (conversationId: Id) => `${conversation(conversationId)}/chatbot/stop`, // CHAT-18
  },

  templates: {
    list: '/templates', // CHAT-07
  },

  labels: {
    list: '/labels', // CHAT-13
  },

  cannedMessages: {
    // CHAT-20. Returns team + own in one unpaged list.
    list: '/canned-messages',
  },

  contacts: {
    // CHAT-21 (GET) / CHAT-22 (POST). The contact id comes from conversation.contact.id.
    notes: (contactId: Id) => `/contacts/${encodeURIComponent(String(contactId))}/notes`,
    // Optional in phase 1; the server re-checks author-or-admin.
    note: (noteId: Id) => `/contacts/notes/${encodeURIComponent(String(noteId))}`,
  },

  broadcasting: {
    // LIVE-01. Under /api/v1, like everything else: the live API answers
    // "Supported methods: POST" there (2026-09-17), and the web app posts to it
    // through the same API client it uses for every other call.
    auth: '/broadcasting/auth',
  },
} as const;

/** Refresh must never trigger another refresh. */
export const REFRESH_PATH = API.auth.refresh;

/** Public (no bearer token) endpoints. */
export const PUBLIC_PATHS: readonly string[] = [
  API.auth.requestOtp,
  API.auth.loginOtp,
  API.auth.loginPassword,
  API.auth.refresh,
  API.auth.otpNotice,
];
