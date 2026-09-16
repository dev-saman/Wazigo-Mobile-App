/**
 * Typed API functions. Every call goes through `network` — never import axios here.
 * IDs in comments refer to the API Reference workbook.
 */
import { API } from './endpoints';
import { network, type RequestOptions, type UploadOptions } from './network';
import type {
  AuthUser,
  BootstrapPayload,
  BroadcastAuthPayload,
  BroadcastAuthResponse,
  Conversation,
  ConversationListParams,
  DashboardOverview,
  Label,
  LogoutPayload,
  Message,
  MessageListMeta,
  MessageTemplate,
  OtpLoginPayload,
  OtpNoticePayload,
  OtpRequestPayload,
  OtpRequestResult,
  PageParams,
  PaginationMeta,
  PasswordLoginPayload,
  RefreshPayload,
  SendMediaPayload,
  SendTemplatePayload,
  SendTextPayload,
  SessionPayload,
  TemplateListParams,
  UpdateLabelsPayload,
  UpdatePresencePayload,
  UpdatePriorityPayload,
} from './types';

type Id = string | number;

// --- Auth (public) ----------------------------------------------------------

/** AUTH-01 — request or resend the WhatsApp login code. */
export const requestOtp = (payload: OtpRequestPayload) =>
  network.post<OtpRequestResult>(API.auth.requestOtp, payload, { requiresAuth: false });

/** AUTH-07 — optional review-account notice for the login screen. */
export const getOtpNotice = (payload: OtpNoticePayload) =>
  network.post<OtpRequestResult>(API.auth.otpNotice, payload, { requiresAuth: false });

/** AUTH-02 */
export const loginWithOtp = (payload: OtpLoginPayload) =>
  network.post<SessionPayload>(API.auth.loginOtp, payload, { requiresAuth: false });

/** AUTH-03 */
export const loginWithPassword = (payload: PasswordLoginPayload) =>
  network.post<SessionPayload>(API.auth.loginPassword, payload, { requiresAuth: false });

/**
 * AUTH-04 — raw refresh call. Normally NOT needed: network.ts refreshes
 * automatically with a single-flight lock. Prefer `network.refreshSession()`.
 */
export const refreshAccessToken = (payload: RefreshPayload) =>
  network.post<SessionPayload>(API.auth.refresh, payload, { requiresAuth: false, skipAuthRefresh: true });

// --- Session ------------------------------------------------------------------

/** AUTH-06 — revokes this device's refresh token. Never triggers a refresh. */
export const logout = (payload: LogoutPayload) =>
  network.post<null>(API.auth.logout, payload, { skipAuthRefresh: true });

/** AUTH-05 */
export const getBootstrap = () => network.get<BootstrapPayload>(API.me.bootstrap);

/** AUTH-08 (optional; bootstrap is preferred). */
export const getCurrentUser = () => network.get<AuthUser>(API.auth.me);

/** CHAT-16 */
export const updatePresence = (payload: UpdatePresencePayload) =>
  network.patch<AuthUser>(API.me.presence, payload);

/** CHAT-17 */
export const sendPresenceHeartbeat = () => network.post<null>(API.me.presenceHeartbeat);

// --- Dashboard ------------------------------------------------------------------

/** DASH-01 — BACKEND BLOCKER: must be scoped to the signed-in user server-side. */
export const getDashboardOverview = () => network.get<DashboardOverview>(API.dashboard.overview);

// --- Conversations --------------------------------------------------------------

/** CHAT-01 — BACKEND BLOCKER: personal assignment scope must be enforced server-side. */
export const getConversations = (
  params: ConversationListParams = {},
  options?: Pick<RequestOptions, 'signal'>,
) => network.get<Conversation[], PaginationMeta>(API.conversations.list, { params, ...options });

/** CHAT-02 — newest-first page; `meta.conversation` holds the thread. */
export const getConversationMessages = (conversationId: Id, params: PageParams = {}) =>
  network.get<Message[], MessageListMeta>(API.conversations.messages(conversationId), { params });

/** CHAT-03 — request field is `text`; the returned Message uses `text_body`. */
export const sendTextMessage = (conversationId: Id, payload: Omit<SendTextPayload, 'type'>) =>
  network.post<Message>(API.conversations.messages(conversationId), { type: 'text', text: payload.text });

/** CHAT-04 — multipart upload. */
export const sendMediaMessage = (
  conversationId: Id,
  { type, file, caption }: SendMediaPayload,
  options?: Pick<UploadOptions, 'onProgress' | 'signal'>,
) =>
  network.upload<Message>(
    API.conversations.messages(conversationId),
    { file, fields: { type, caption } },
    options,
  );

/**
 * CHAT-05 — binary stream (no JSON envelope). Returns an authenticated URL +
 * headers for a file-system download. Prefer the message's relative `media.url`.
 */
export const getMessageMediaRequest = (conversationId: Id, messageId: Id, mediaUrl?: string | null) =>
  network.authorizedRequest(mediaUrl || API.conversations.media(conversationId, messageId));

/** CHAT-06 */
export const markConversationRead = (conversationId: Id) =>
  network.post<Conversation>(API.conversations.read(conversationId));

/** CHAT-07 */
export const getTemplates = (
  params: TemplateListParams = {},
  options?: Pick<RequestOptions, 'signal'>,
) =>
  network.get<MessageTemplate[], PaginationMeta>(API.templates.list, {
    params: { approved_only: 1, ...params },
    ...options,
  });

/** CHAT-08 */
export const sendTemplate = (conversationId: Id, payload: SendTemplatePayload) =>
  network.post<Message>(API.conversations.template(conversationId), payload);

/** CHAT-09 — 200 can still return status=failed. */
export const retryMessage = (conversationId: Id, messageId: Id) =>
  network.post<Message>(API.conversations.retryMessage(conversationId, messageId));

/** CHAT-10 */
export const resolveConversation = (conversationId: Id) =>
  network.post<Conversation>(API.conversations.resolve(conversationId));

/** CHAT-11 — does not extend the WhatsApp reply window. */
export const reopenConversation = (conversationId: Id) =>
  network.post<Conversation>(API.conversations.reopen(conversationId));

/** CHAT-13 */
export const getLabels = () => network.get<Label[]>(API.labels.list);

/** CHAT-14 — replaces the full label list. */
export const updateConversationLabels = (conversationId: Id, payload: UpdateLabelsPayload) =>
  network.put<Conversation>(API.conversations.labels(conversationId), payload);

/** CHAT-15 */
export const updateConversationPriority = (conversationId: Id, payload: UpdatePriorityPayload) =>
  network.patch<Conversation>(API.conversations.priority(conversationId), payload);

/** CHAT-18 — take over from the chatbot. */
export const stopChatbot = (conversationId: Id) =>
  network.post<Conversation>(API.conversations.stopChatbot(conversationId));

// --- Live updates ---------------------------------------------------------------

/** LIVE-01 — Pusher-style auth response, not the JSON envelope. */
export const authorizeBroadcastChannel = (payload: BroadcastAuthPayload) =>
  network.post<BroadcastAuthResponse>(API.broadcasting.auth, payload, { envelope: false });
