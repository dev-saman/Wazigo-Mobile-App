/**
 * Typed API functions. Every call goes through `network` — never import axios here.
 * IDs in comments refer to the API Reference workbook.
 */
import { API } from './endpoints';
import { network, type RequestOptions, type UploadOptions } from './network';
import type {
  AccountOverview,
  AccountOverviewParams,
  AcknowledgeFollowUpPayload,
  ActionDesk,
  ActionDeskParams,
  AiStatus,
  ArchiveBusinessPayload,
  ArchiveLocationPayload,
  AuthUser,
  BootstrapPayload,
  Business,
  BusinessList,
  BusinessMembers,
  ByNumberParams,
  CancelFollowUpPayload,
  ChooseClientPayload,
  CompleteFollowUpPayload,
  ConversationLocation,
  CreateBusinessPayload,
  CreateFollowUpPayload,
  CreateLocationPayload,
  DashboardParams,
  DeliveryIssues,
  FollowUp,
  FollowUpDetail,
  FollowUpList,
  FollowUpOwners,
  KnowledgeGapPayload,
  MappingPayload,
  MappingPreview,
  NumberReport,
  NumberReportOption,
  NumberReportParams,
  NumberToday,
  NumberTodayParams,
  OrgLocation,
  OrgWorkspace,
  RenameBusinessPayload,
  ReplaceMembersPayload,
  SaveMappingPayload,
  SetConversationLocationPayload,
  SnoozeFollowUpPayload,
  Structure,
  UpdateFollowUpPayload,
  UpdateLocationPayload,
  BroadcastAuthPayload,
  BroadcastAuthResponse,
  CannedMessage,
  ContactNote,
  Conversation,
  ConversationListParams,
  CreateContactNotePayload,
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
  RegisterDevicePayload,
  SendMediaPayload,
  SendTemplatePayload,
  SendTextPayload,
  SessionPayload,
  TemplateListParams,
  UnregisterDevicePayload,
  UpdateLabelsPayload,
  UpdatePreferencesPayload,
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

/**
 * AUTH-11 — mute pushes / sound for this person on every device.
 *
 * Server-side, and shared with the web app's bell mute: this is not a local
 * notification setting. Returns the updated user (AUTH-08 shape).
 */
export const updatePreferences = (payload: UpdatePreferencesPayload) =>
  network.patch<AuthUser>(API.me.preferences, payload);

// --- Push devices ---------------------------------------------------------------

/** Registers this phone's Expo push token for the signed-in user. */
export const registerPushDevice = (payload: RegisterDevicePayload) =>
  network.post<unknown>(API.me.devices, payload);

/**
 * Forgets a push token. Called before AUTH-06 on sign-out, while the bearer
 * token is still valid, and never refreshes: a dead session has nothing to remove.
 */
export const unregisterPushDevice = (payload: UnregisterDevicePayload) =>
  network.delete<unknown>(API.me.devices, { body: payload, skipAuthRefresh: true });

// --- Dashboard ------------------------------------------------------------------

/**
 * DASH-01 / REP-05 — BACKEND BLOCKER: still not scoped to the signed-in user.
 *
 * Since 2026-10-19 it takes a number: with `whatsapp_account_id` the figures are
 * that number's, and without it they are the combined view plus a `workspaces`
 * row per number. Those rows must never be added together as if they were
 * unique people.
 */
export const getDashboardOverview = (params: DashboardParams = {}) =>
  network.get<DashboardOverview>(API.dashboard.overview, { params });

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

/**
 * CHAT-13 — labels belong to one number (2026-10-19), so pass the chat's own
 * `conversation.number.id` and cache the answer per number.
 */
export const getLabels = (params: ByNumberParams = {}) =>
  network.get<Label[]>(API.labels.list, { params });

/**
 * CHAT-20 — quick replies for the composer. Team + own, unpaged, read-only.
 * Team bodies may contain `{{contact.name}}`-style variables; substitute them
 * or let the person edit before sending through CHAT-03.
 */
export const getCannedMessages = (params: ByNumberParams = {}) =>
  network.get<CannedMessage[]>(API.cannedMessages.list, { params });

/** CHAT-21 — internal notes on the contact of a chat the person can already see. */
export const getContactNotes = (contactId: Id) =>
  network.get<ContactNote[]>(API.contacts.notes(contactId));

/** CHAT-22 — add an internal note. Never reaches the customer. body max 2000. */
export const createContactNote = (contactId: Id, payload: CreateContactNotePayload) =>
  network.post<ContactNote>(API.contacts.notes(contactId), payload);

/** Optional in phase 1. The server re-checks that only the author or an admin may delete. */
export const deleteContactNote = (noteId: Id) => network.delete<null>(API.contacts.note(noteId));

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

/**
 * LIVE-01 — Pusher-style auth response, not the JSON envelope. The server
 * decides here whether this user may listen on a channel.
 */
export const authorizeBroadcastChannel = (payload: BroadcastAuthPayload) =>
  network.post<BroadcastAuthResponse>(API.broadcasting.auth, payload, { envelope: false });

/**
 * A query string for the downloads that do not go through axios (REP-08).
 * Arrays are written as `key[]=a&key[]=b`, the form axios sends and the API
 * expects; empty values are left out.
 */
const withQuery = (path: string, params: Record<string, unknown>): string => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(`${key}[]`, String(item)));
      return;
    }
    search.append(key, String(value));
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
};

// --- One chat by id (CHAT-23) ---------------------------------------------------

/**
 * CHAT-23 — open a chat straight from a push tap or a link, before loading its
 * messages. A 404 means the person may no longer open it: say so, and never
 * quietly open a different chat instead.
 */
export const getConversation = (conversationId: Id) =>
  network.get<Conversation>(API.conversations.show(conversationId));

// --- AI on a chat (CHAT-24 to CHAT-27) ------------------------------------------

/** CHAT-24 — what the AI is doing here, why it paused, and its last decisions. */
export const getConversationAi = (conversationId: Id) =>
  network.get<AiStatus>(API.conversations.ai(conversationId));

/** CHAT-25 — take over. Sending a human reply pauses the AI too. */
export const pauseConversationAi = (conversationId: Id) =>
  network.post<AiStatus>(API.conversations.aiPause(conversationId));

/** CHAT-26 — hand the chat back. Offer only when CHAT-24 says it is paused. */
export const resumeConversationAi = (conversationId: Id) =>
  network.post<AiStatus>(API.conversations.aiResume(conversationId));

/**
 * CHAT-27 — which branch the chat is about. Offer it only when CHAT-24 reports
 * `location.required` and `location.can_set`. 409 means someone else changed
 * it: read `data.current` and ask again.
 */
export const setConversationLocation = (
  conversationId: Id,
  payload: SetConversationLocationPayload,
) => network.post<ConversationLocation>(API.conversations.location(conversationId), payload);

/** CHAT-34 — a to-do in the web Knowledge Hub. It never changes a reply. */
export const markKnowledgeGap = (conversationId: Id, payload: KnowledgeGapPayload) =>
  network.post<unknown>(API.conversations.knowledgeGap(conversationId), payload);

// --- Follow-ups (CHAT-28 to CHAT-33) -------------------------------------------

/** CHAT-28 — open ones first, then the last 20 closed. */
export const getFollowUps = (conversationId: Id) =>
  network.get<FollowUpList>(API.followUps.forConversation(conversationId));

/** CHAT-29 — without `follow_ups.assign` this is only the signed-in person. */
export const getFollowUpOwners = (conversationId: Id) =>
  network.get<FollowUpOwners>(API.followUps.owners(conversationId));

/**
 * CHAT-30 — `idempotency_key` must be a fresh uuid per tap. The same key with
 * the same body replays the first answer (`replayed: true`); the same key with
 * a different body is a 409.
 */
export const createFollowUp = (conversationId: Id, payload: CreateFollowUpPayload) =>
  network.post<FollowUp>(API.followUps.forConversation(conversationId), payload);

/** CHAT-31 — only while open, acknowledged or snoozed. 409 = stale `version`. */
export const updateFollowUp = (followUpId: Id, payload: UpdateFollowUpPayload) =>
  network.patch<FollowUp>(API.followUps.show(followUpId), payload);

/** CHAT-32 */
export const acknowledgeFollowUp = (followUpId: Id, payload: AcknowledgeFollowUpPayload) =>
  network.post<FollowUp>(API.followUps.acknowledge(followUpId), payload);

/** CHAT-32 — `until` within 90 days. */
export const snoozeFollowUp = (followUpId: Id, payload: SnoozeFollowUpPayload) =>
  network.post<FollowUp>(API.followUps.snooze(followUpId), payload);

/** CHAT-32 — resolving a chat never closes its follow-ups. */
export const completeFollowUp = (followUpId: Id, payload: CompleteFollowUpPayload) =>
  network.post<FollowUp>(API.followUps.complete(followUpId), payload);

/** CHAT-32 */
export const cancelFollowUp = (followUpId: Id, payload: CancelFollowUpPayload) =>
  network.post<FollowUp>(API.followUps.cancel(followUpId), payload);

/** CHAT-33 — the optional history sheet. */
export const getFollowUp = (followUpId: Id) =>
  network.get<FollowUpDetail>(API.followUps.show(followUpId));

// --- Brands, locations and numbers (ORG-02 to ORG-14) --------------------------

/** ORG-02 — the Locations & Numbers screen. An Agent gets 403; use bootstrap. */
export const getStructure = () => network.get<Structure>(API.structure.all);

/** ORG-04 — agency accounts only; a business account answers 422. */
export const getBusinesses = () => network.get<BusinessList>(API.structure.businesses);

/** ORG-05 */
export const createBusiness = (payload: CreateBusinessPayload) =>
  network.post<Business>(API.structure.businesses, payload);

/** ORG-03 — 409 means someone else renamed it: reload and try again. */
export const renameBusiness = (businessId: Id, payload: RenameBusinessPayload) =>
  network.patch<Business>(API.structure.business(businessId), payload);

/** ORG-06 — refused while the brand still owns a live number or location. */
export const archiveBusiness = (businessId: Id, payload: ArchiveBusinessPayload) =>
  network.post<Business>(API.structure.archiveBusiness(businessId), payload);

/** ORG-06 */
export const restoreBusiness = (businessId: Id, payload: ArchiveBusinessPayload) =>
  network.post<Business>(API.structure.restoreBusiness(businessId), payload);

/** ORG-07 */
export const getBusinessMembers = (businessId: Id) =>
  network.get<BusinessMembers>(API.structure.members(businessId));

/**
 * ORG-08 — a full replacement: send every id that should stay. People removed
 * lose access on their next request and are told through LIVE-04.
 */
export const replaceBusinessMembers = (businessId: Id, payload: ReplaceMembersPayload) =>
  network.put<BusinessMembers>(API.structure.members(businessId), payload);

/** ORG-09 */
export const createLocation = (businessId: Id, payload: CreateLocationPayload) =>
  network.post<OrgLocation>(API.structure.locations(businessId), payload);

/** ORG-10 — send only the changed fields plus `expected_version`. */
export const updateLocation = (locationId: Id, payload: UpdateLocationPayload) =>
  network.patch<OrgLocation>(API.structure.location(locationId), payload);

/** ORG-11 — refused while a number still serves the location. */
export const archiveLocation = (locationId: Id, payload: ArchiveLocationPayload) =>
  network.post<OrgLocation>(API.structure.archiveLocation(locationId), payload);

/** ORG-11 */
export const restoreLocation = (locationId: Id, payload: ArchiveLocationPayload) =>
  network.post<OrgLocation>(API.structure.restoreLocation(locationId), payload);

/**
 * ORG-12 — show this before saving ORG-13: nothing is reconnected and no chat
 * is lost. An empty `location_ids` means the whole brand.
 */
export const previewNumberMapping = (numberId: Id, payload: MappingPayload) =>
  network.post<MappingPreview>(API.structure.mappingPreview(numberId), payload);

/** ORG-13 — never touches the number's connection, chats or AI setting. */
export const saveNumberMapping = (numberId: Id, payload: SaveMappingPayload) =>
  network.put<OrgWorkspace>(API.structure.mapping(numberId), payload);

/**
 * ORG-14 — only for a number with `client_choice_pending`. Nothing can be sent
 * from it until this is done.
 */
export const chooseNumberClient = (numberId: Id, payload: ChooseClientPayload) =>
  network.put<OrgWorkspace>(API.structure.client(numberId), payload);

// --- Report (REP-01 to REP-09) --------------------------------------------------

/**
 * REP-01 — all brands, one brand or chosen numbers. A metric with `value: null`
 * is "Not available" and must never be drawn as 0; a section the person may not
 * see is null with a reason in `errors`.
 */
export const getAccountOverview = (
  params: AccountOverviewParams = {},
  options?: Pick<RequestOptions, 'signal'>,
) => network.get<AccountOverview>(API.report.overview, { params, ...options });

/** REP-02 — plain-language failure reasons, top 50, no customer details. */
export const getDeliveryIssues = (
  params: AccountOverviewParams = {},
  options?: Pick<RequestOptions, 'signal'>,
) => network.get<DeliveryIssues>(API.report.deliveryIssues, { params, ...options });

/** REP-03 — one number's Today page. A failed section is null, not missing. */
export const getNumberToday = (numberId: Id, params: NumberTodayParams = {}) =>
  network.get<NumberToday>(API.report.today(numberId), { params });

/** REP-04 — what needs doing now, 25 a page; tap opens the chat (CHAT-23). */
export const getActionDesk = (numberId: Id, params: ActionDeskParams = {}) =>
  network.get<ActionDesk>(API.report.actionDesk(numberId), { params });

/** REP-06 — report choices only; disconnected numbers are included. */
export const getNumberReportOptions = () =>
  network.get<NumberReportOption[]>(API.report.numberOptions);

/** REP-07 — a missing figure means not permitted or not available, never zero. */
export const getNumberReport = (
  params: NumberReportParams = {},
  options?: Pick<RequestOptions, 'signal'>,
) => network.get<NumberReport>(API.report.numbers, { params, ...options });

/**
 * REP-08 — CSV, not the JSON envelope. Returns an authenticated URL and headers
 * for a file-system download, like media does.
 */
export const getNumberReportExportRequest = (params: NumberReportParams = {}) =>
  network.authorizedRequest(withQuery(API.report.numbersExport, params));
