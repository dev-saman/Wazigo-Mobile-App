/**
 * Every API path, relative to Config.apiBaseUrl (…/api/v1).
 * Verified against the API Reference workbook; IDs in comments match its sheets.
 */

type Id = string | number;

const conversation = (id: Id) => `/conversations/${encodeURIComponent(String(id))}`;
const message = (conversationId: Id, messageId: Id) =>
  `${conversation(conversationId)}/messages/${encodeURIComponent(String(messageId))}`;
const business = (id: Id) => `/businesses/${encodeURIComponent(String(id))}`;
const location = (id: Id) => `/locations/${encodeURIComponent(String(id))}`;
const followUp = (id: Id) => `/follow-ups/${encodeURIComponent(String(id))}`;
/** A WhatsApp number is a "workspace" in the API; its id is `whatsapp_account_id`. */
const workspace = (numberId: Id) => `/workspaces/${encodeURIComponent(String(numberId))}`;
const whatsappNumber = (numberId: Id) => `/whatsapp/numbers/${encodeURIComponent(String(numberId))}`;

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
    /** CHAT-23. Open one chat by id (push tap, deep link). 404 = no longer available. */
    show: (conversationId: Id) => conversation(conversationId),
    /** CHAT-24 / 25 / 26. AI status, and taking the chat back from the AI. */
    ai: (conversationId: Id) => `${conversation(conversationId)}/ai`,
    aiPause: (conversationId: Id) => `${conversation(conversationId)}/ai/pause`,
    aiResume: (conversationId: Id) => `${conversation(conversationId)}/ai/resume`,
    /** CHAT-27. Which branch the chat is about. Not an Agent action. */
    location: (conversationId: Id) => `${conversation(conversationId)}/location`,
    /** CHAT-34. "The AI could not answer this" - a to-do in the web Knowledge Hub. */
    knowledgeGap: (conversationId: Id) => `${conversation(conversationId)}/knowledge-gap`,
  },

  /** CHAT-28 to CHAT-33. */
  followUps: {
    // CHAT-28 (GET) / CHAT-30 (POST), both on the conversation.
    forConversation: (conversationId: Id) => `${conversation(conversationId)}/follow-ups`,
    // CHAT-29.
    owners: (conversationId: Id) => `${conversation(conversationId)}/follow-up-owners`,
    // CHAT-33 (GET) / CHAT-31 (PATCH), by follow-up id.
    show: (id: Id) => followUp(id),
    // CHAT-32. Every one takes the row's `version`.
    acknowledge: (id: Id) => `${followUp(id)}/acknowledge`,
    snooze: (id: Id) => `${followUp(id)}/snooze`,
    complete: (id: Id) => `${followUp(id)}/complete`,
    cancel: (id: Id) => `${followUp(id)}/cancel`,
  },

  /**
   * ORG-02 to ORG-14: brands (the API calls them businesses), locations and the
   * numbers mapped to them. ORG-15 and ORG-16 stay on the web.
   */
  structure: {
    all: '/structure', // ORG-02. Agent gets 403 - read bootstrap instead.
    businesses: '/businesses', // ORG-04 (GET) / ORG-05 (POST), agency accounts only
    business: (id: Id) => business(id), // ORG-03 (PATCH)
    archiveBusiness: (id: Id) => `${business(id)}/archive`, // ORG-06
    restoreBusiness: (id: Id) => `${business(id)}/restore`, // ORG-06
    members: (id: Id) => `${business(id)}/members`, // ORG-07 (GET) / ORG-08 (PUT)
    locations: (businessId: Id) => `${business(businessId)}/locations`, // ORG-09
    location: (id: Id) => location(id), // ORG-10 (PATCH)
    archiveLocation: (id: Id) => `${location(id)}/archive`, // ORG-11
    restoreLocation: (id: Id) => `${location(id)}/restore`, // ORG-11
    mappingPreview: (numberId: Id) => `${workspace(numberId)}/mapping/preview`, // ORG-12
    mapping: (numberId: Id) => `${workspace(numberId)}/mapping`, // ORG-13
    client: (numberId: Id) => `${workspace(numberId)}/client`, // ORG-14
  },

  /** REP-01 to REP-09. The fourth area; it replaces the personal dashboard. */
  report: {
    overview: '/account/overview', // REP-01
    deliveryIssues: '/account/overview/delivery-issues', // REP-02
    today: (numberId: Id) => `${whatsappNumber(numberId)}/today`, // REP-03
    actionDesk: (numberId: Id) => `${whatsappNumber(numberId)}/action-desk`, // REP-04
    numberOptions: '/reports/numbers/options', // REP-06
    numbers: '/reports/numbers', // REP-07
    numbersExport: '/reports/numbers/export', // REP-08 - CSV, not the JSON envelope
    campaignsExport: '/reports/campaigns/export', // REP-09
    sourcesExport: '/reports/sources/export', // REP-09
    broadcastsExport: '/reports/broadcasts/export', // REP-09
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
