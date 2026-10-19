/**
 * API contract types, taken from "Wazigo Mobile App — API Reference" (reviewed 2026-09-15).
 * Nested relations can be missing or null — code defensively.
 */

// ---------------------------------------------------------------------------
// Envelope, pagination, errors
// ---------------------------------------------------------------------------

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

/** Raw Laravel success envelope: `{status, message, data, meta?}`. */
export type ApiEnvelope<T, M = PaginationMeta> = {
  status: boolean;
  message?: string;
  data: T;
  meta?: M;
};

/** What `network.*` helpers resolve with after unwrapping the envelope. */
export type ApiResponse<T, M = PaginationMeta> = {
  data: T;
  message?: string;
  meta?: M;
  httpStatus: number;
};

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'OFFLINE'
  | 'NETWORK'
  | 'CANCELLED'
  /** A write refused locally because this development build is read-only. */
  | 'UNKNOWN';

/** Normalized error. Screens never inspect raw Axios errors. */
export type ApiError = {
  status?: number;
  code: ApiErrorCode;
  message: string;
  /** Laravel 422 field errors. */
  errors?: Record<string, string[]>;
  /** Seconds from the Retry-After header on 429. */
  retryAfterSeconds?: number;
  isNetworkError?: boolean;
  isOffline?: boolean;
  isTimeout?: boolean;
  /**
   * Super-admin Phase 4: a 403 whose body says the business itself is
   * suspended or deactivated, rather than this user lacking a permission.
   */
  workspace?: WorkspaceUnavailable;
};

export type PageParams = {
  page?: number;
  per_page?: number;
};

// ---------------------------------------------------------------------------
// Support contact (Super-admin Phase 4)
// ---------------------------------------------------------------------------

/**
 * Wazigo support runs on WhatsApp. The server hands the app a finished wa.me
 * link with the customer's name, business and account number already written
 * into the message and already encoded; the app only opens it. That is why the
 * app never composes the link, never hard-codes a number, and never shows the
 * support number as text - only the email is shown as a contact detail. Wazigo
 * can then change the number or the wording from the back office without an app
 * update.
 *
 * Phase 4 is not published yet, so both fields may be absent. Absent and null
 * mean the same thing: nothing is set.
 */
export type SupportContact = {
  email: string | null;
  /** Complete and already encoded. Opened verbatim, never parsed or rebuilt. */
  chat_url: string | null;
};

export type WorkspaceStatus = 'suspended' | 'deactivated';

/**
 * The `data` of a 403 when the business has been suspended or deactivated.
 * Any signed-in call can answer with it, and so can sign-in itself.
 */
export type WorkspaceUnavailable = {
  code: 'workspace_unavailable';
  workspace_status: WorkspaceStatus;
  /** Written for the customer by Wazigo. May be empty. */
  reason: string | null;
  /** Here the pre-typed message says the workspace is suspended. */
  support: SupportContact;
};

// ---------------------------------------------------------------------------
// Auth / bootstrap (AUTH-01 … AUTH-08)
// ---------------------------------------------------------------------------

export type PresenceStatus = 'online' | 'away' | 'offline';

export type RoleName = 'admin' | 'supervisor' | 'agent' | (string & {});

export type AuthUser = {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  has_password?: boolean;
  is_active?: boolean;
  presence_status?: PresenceStatus | null;
  roles?: RoleName[] | { name: RoleName }[];
  /** AUTH-11. Server-side push mute, shared with the web app's bell. */
  mute_notifications?: boolean;
  /** AUTH-11. Silences the notification sound without stopping delivery. */
  mute_sound?: boolean;
  /**
   * AUTH-05 (2026-10-19). How this person's numbers are decided: every number
   * on the account, a chosen set (`number_ids`), or every number of the brands
   * they belong to. Bootstrap already lists the result in `numbers`; this only
   * explains it.
   */
  number_access?: NumberAccessMode | null;
  number_ids?: number[] | null;
  [key: string]: unknown;
};

/** AUTH-05 (2026-10-19). */
export type NumberAccessMode = 'all' | 'selected' | 'businesses' | (string & {});

export type OtpRequestPayload = { phone: string; purpose: 'login' };
export type OtpRequestResult = { test_account: boolean; notice: string | null };
export type OtpNoticePayload = { phone: string };

export type OtpLoginPayload = { phone: string; code: string; device_name?: string };
export type PasswordLoginPayload = { phone: string; password: string; device_name?: string };
export type RefreshPayload = { refresh_token: string };
/**
 * AUTH-06, plus the 2026-09-18 addition: `device_token` lets the server drop
 * this phone's push token in the same call, so a logout that loses connectivity
 * halfway cannot leave the phone ringing for a signed-out account.
 */
export type LogoutPayload = { refresh_token: string; device_token?: string };

/** Same payload for OTP login, password login and refresh. */
export type SessionPayload = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  /** Access-token lifetime in seconds. */
  expires_in: number;
  user: AuthUser;
};

export type WhatsAppNumber = {
  id: number;
  display_phone_number: string;
  verified_name?: string | null;
  label?: string | null;
  is_primary?: boolean;
  status?: string | null;
  quality_rating?: string | null;
  /**
   * AUTH-05 (2026-10-19). A number belongs to one brand and serves some of that
   * brand's locations - or the whole brand when `business_wide` is true.
   */
  waba_id?: string | number | null;
  /** What to show the person. `label` is the raw name. */
  display_label?: string | null;
  /** Brand colour, for telling one number's chats from another's. */
  color?: string | null;
  business_id?: number | null;
  location_ids?: number[] | null;
  business_wide?: boolean;
  /**
   * ORG-14: an agency number connected before its brand was chosen. Nothing can
   * be sent from it until someone finishes it on the web or through ORG-14.
   */
  client_choice_pending?: boolean;
};

/**
 * AUTH-05 (2026-10-19). What kind of account signed in, which decides the whole
 * layout: an agency has several brands and shows a switcher, a business has one,
 * and `null` means nobody has grouped its numbers yet.
 */
export type AccountType = 'business' | 'agency';

export type AccountInfo = {
  type: AccountType | null;
  classified?: boolean;
  admin_label?: string | null;
  /** What an agency calls a brand, e.g. "Client". Null for a business account. */
  client_word?: string | null;
};

/** AUTH-05 (2026-10-19). A brand; the API calls it a business. */
export type BootstrapBusiness = {
  id: number;
  name: string;
  /** True while the grouping is a guess the account has not confirmed. */
  provisional?: boolean;
  /** Whether the signed-in person is a member of this brand. */
  member?: boolean;
  status?: string | null;
};

/** AUTH-05 (2026-10-19). A branch of one brand. Always Asia/Kolkata. */
export type BootstrapLocation = {
  id: number;
  business_id: number;
  name: string;
};

/**
 * AUTH-05 addition (2026-09-18): the server now hands the app everything it
 * needs to open a socket. Before this, the key was bundled into the build (read
 * off the web login page's `reverb-key` meta tag) and the tenant id was decoded
 * out of the JWT to compose channel names by hand. Both are obsolete: read the
 * connection from here and use `channels.agent` verbatim.
 *
 * `null` means Reverb is not configured for this deployment - fall back to
 * re-fetching on foreground rather than guessing a connection.
 */
export type RealtimeChannels = {
  /** LIVE-02: the ready-made per-person channel, e.g. `tenant.12.agent.34`. */
  agent?: string | null;
  /**
   * LIVE-03 (2026-10-19): every chat this person may open, not just their own.
   * Only a Brand or Location inbox needs it; My Chats is covered by `agent`.
   * Subscribing to both means de-duplicating by message and conversation id.
   */
  inbox?: string | null;
  /**
   * RETIRED 2026-10-19 for customer content: the server now always sends `[]`.
   * Mobile never subscribed to these.
   */
  numbers?: string[] | null;
  tenant?: string | null;
  /** LIVE-04: `App.Models.User.<id>`, which also carries the notification bell. */
  user?: string | null;
};

export type RealtimeConfig = {
  /** PUBLIC app key. Never the Reverb secret. */
  key: string;
  host: string;
  port: number;
  scheme: string;
  /** `/api/v1/broadcasting/auth` on the same host. */
  auth_path: string;
  channels?: RealtimeChannels | null;
  events?: {
    agent?: string[] | null;
    tenant?: string[] | null;
    /** LIVE-03: `contact.updated`, `template.status_updated`. */
    inbox?: string[] | null;
  } | null;
};

/**
 * Mobile uses user, roles, permissions, numbers and `realtime`. `settings.tenant.id`
 * is still read as a fallback for a server that predates the 2026-09-18 block.
 */
export type BootstrapPayload = {
  user: AuthUser;
  roles: RoleName[];
  permissions: string[];
  numbers: WhatsAppNumber[];
  /** AUTH-05 (2026-10-19). Absent on a server that predates the brand work. */
  account?: AccountInfo | null;
  /** AUTH-05 (2026-10-19). Every brand this person may see, and no other. */
  businesses?: BootstrapBusiness[] | null;
  /** AUTH-05 (2026-10-19). Every branch of those brands. */
  locations?: BootstrapLocation[] | null;
  /** AUTH-05 addition. Null or absent when Reverb is not configured. */
  realtime?: RealtimeConfig | null;
  /** Phase 4 addition. Absent until the support block is published. */
  support?: SupportContact | null;
  routes?: unknown;
  menus?: unknown;
  feature_flags?: unknown;
  settings?: { tenant?: { id?: number | string | null } | null; [key: string]: unknown } | null;
  billing?: unknown;
};

/** POST /me/devices — an Expo push token for this phone. */
export type RegisterDevicePayload = {
  token: string;
  platform: 'ios' | 'android';
  provider: 'expo';
  device_name: string;
};

/** DELETE /me/devices — the token to forget. */
export type UnregisterDevicePayload = { token: string };

/**
 * AUTH-11. PATCH /me/preferences. Both fields optional.
 *
 * `mute_notifications` is a SERVER-side check: it stops every push to this
 * person on every phone (see PUSH-01), and is the same switch as the web app's
 * bell mute. It is not a local-only toggle.
 */
export type UpdatePreferencesPayload = {
  mute_notifications?: boolean;
  mute_sound?: boolean;
};

/**
 * CHAT-20. A saved reply the composer can insert. `scope` is "team" (shared,
 * may contain `{{contact.name}}`-style variables the web fills client-side) or
 * "personal". Read-only in phase 1: no create/edit/delete screens.
 */
export type CannedMessage = {
  id: number;
  scope: 'team' | 'personal';
  owner_user_id?: number | null;
  title: string;
  shortcut?: string | null;
  body: string;
  created_by?: string | number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/** CHAT-21. An internal note on a contact. Never sent to the customer. */
export type ContactNote = {
  id: number;
  body: string;
  author?: string | null;
  author_id?: number | null;
  created_at?: string | null;
};

/** CHAT-22. `body` max 2000 characters (ContactNote::MAX_LENGTH). */
export type CreateContactNotePayload = { body: string };

/** CHAT-22 server limit, enforced client-side so the composer can show a counter. */
export const CONTACT_NOTE_MAX_LENGTH = 2000;

/** Permission keys referenced by the workbook. */
export const Permissions = {
  conversationsView: 'conversations.view',
  conversationsSend: 'conversations.send',
  conversationsTag: 'conversations.tag',
  templatesView: 'templates.view',
  templatesSend: 'templates.send',
  dashboardView: 'dashboard.view',
  /** CHAT-27 (2026-10-19). Admin and Supervisor by default; not Agent. */
  conversationsSetLocation: 'conversations.set_location',
  /** CHAT-28 to CHAT-33 (2026-10-19). Admin, Supervisor and Agent. */
  followUpsManage: 'follow_ups.manage',
  /** CHAT-29: without it, a follow-up can only be owned by its author. */
  followUpsAssign: 'follow_ups.assign',
  /** CHAT-34 (2026-10-19). Marking what the AI could not answer. */
  knowledgeManage: 'knowledge.manage',
  /** ORG-02 / ORG-04 (2026-10-19). Reading the brand and branch structure. */
  locationsView: 'locations.view',
  /** ORG-03, ORG-09 to ORG-11. Admin by default. */
  locationsManage: 'locations.manage',
  /** ORG-05, ORG-06. Agency accounts, account-wide Admin. */
  businessesManage: 'businesses.manage',
  /** ORG-08. */
  businessesMembers: 'businesses.members',
  /** ORG-12, ORG-13. Which branches a number serves. */
  mappingManage: 'mapping.manage',
  /** ORG-14. Finishing a number that is waiting for a brand. */
  whatsappManage: 'whatsapp.manage',
} as const;

export type PermissionKey = (typeof Permissions)[keyof typeof Permissions];

// ---------------------------------------------------------------------------
// Conversations & messages (CHAT-01 … CHAT-18)
// ---------------------------------------------------------------------------

export type ConversationStatus = 'open' | 'resolved';
export type ConversationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type Contact = {
  id: number;
  name?: string | null;
  phone?: string | null;
  wa_id?: string | null;
  [key: string]: unknown;
};

export type Label = {
  id: number;
  name: string;
  color?: string | null;
};

export type ConversationNumber = {
  id: number;
  display_phone_number: string;
  label?: string | null;
  /** CHAT-01 (2026-10-19). What to show, and the colour that marks the number. */
  display_label?: string | null;
  color?: string | null;
};

export type MessageDirection = 'inbound' | 'outbound';
export type MessageType =
  | 'text'
  | 'image'
  | 'document'
  | 'audio'
  | 'video'
  | 'template'
  | (string & {});
export type MessageStatus = 'pending' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | (string & {});

export type LastMessage = {
  direction: MessageDirection;
  type: MessageType;
  preview?: string | null;
  status?: MessageStatus | null;
};

export type ChatbotState = {
  session_id: number | string;
  name?: string | null;
  status?: string | null;
  is_test?: boolean;
  waiting_for_reply?: boolean;
};

export type Conversation = {
  id: number;
  status: ConversationStatus;
  priority?: ConversationPriority | null;
  unread_count: number;
  assigned_user_id?: number | null;
  assigned_user?: { id: number; name: string } | null;
  contact?: Contact | null;
  labels?: Label[] | null;
  number?: ConversationNumber | null;
  last_message?: LastMessage | null;
  last_message_at?: string | null;
  last_inbound_at?: string | null;
  last_outbound_at?: string | null;
  window_open: boolean;
  window_expires_at?: string | null;
  resolved_at?: string | null;
  created_at?: string | null;
  chatbot?: ChatbotState | null;
};

/**
 * CHAT-01 (2026-10-19). `oldest_waiting` puts the customers who have waited
 * longest for a reply first; `priority` puts urgent first.
 */
export type ConversationSort = 'newest' | 'oldest_waiting' | 'priority';

export type ConversationListParams = PageParams & {
  status?: ConversationStatus;
  search?: string;
  unread?: 1;
  assigned?: 'mine' | 'unassigned';
  label_id?: number;
  priority?: ConversationPriority;
  /** One number. Never send this together with `number_ids`. */
  number_id?: number;
  /**
   * CHAT-01 (2026-10-19). Several numbers - a brand (every number whose
   * `business_id` is that brand) or a location (every number whose
   * `location_ids` include it, plus that brand's `business_wide` numbers).
   */
  number_ids?: number[];
  sort?: ConversationSort;
};

export type MessageRetryState = {
  available: boolean;
  blocked_reason?: string | null;
  may_duplicate?: boolean;
  count?: number;
};

export type MessageMedia = {
  /** Relative, authenticated API path. Never a raw Meta URL. */
  url?: string | null;
  mime?: string | null;
  filename?: string | null;
  pending?: boolean;
};

/**
 * WhatsApp Cloud API's error object, which the live API passes through as a
 * failed message's `error_detail` (the workbook documents a string). Read it
 * with `messageErrorText`, never directly.
 */
export type MessageErrorDetail = {
  code?: number | string | null;
  title?: string | null;
  message?: string | null;
  error_data?: { details?: string | null } | null;
};

export type Message = {
  id: number;
  conversation_id: number;
  direction: MessageDirection;
  origin?: string | null;
  type: MessageType;
  status?: MessageStatus | null;
  /** A string, or WhatsApp's error object(s). Render through `messageErrorText`. */
  error_detail?: string | MessageErrorDetail | MessageErrorDetail[] | null;
  retry?: MessageRetryState | null;
  /** Response field. The send request uses `text`. */
  text_body?: string | null;
  reply_id?: number | null;
  caption?: string | null;
  media?: MessageMedia | null;
  sent_by_user_id?: number | null;
  is_automated?: boolean;
  wa_timestamp?: string | null;
  created_at?: string | null;
};

/** CHAT-02 meta carries pagination and the thread's conversation. */
export type MessageListMeta = PaginationMeta & { conversation?: Conversation };

export const MessageLimits = {
  textMax: 4096,
  captionMax: 1024,
  requestMaxBytes: 50 * 1024 * 1024,
  templateParamsMax: 20,
  templateParamLengthMax: 1024,
} as const;

export type SendTextPayload = { type: 'text'; text: string };

export type MediaMessageType = 'image' | 'document' | 'audio' | 'video';

export type UploadFile = {
  uri: string;
  name: string;
  /** MIME type, e.g. image/jpeg. */
  type: string;
};

export type SendMediaPayload = {
  type: MediaMessageType;
  file: UploadFile;
  caption?: string;
};

// ---------------------------------------------------------------------------
// Templates (CHAT-07, CHAT-08)
// ---------------------------------------------------------------------------

export type MessageTemplate = {
  id: number;
  name?: string;
  language?: string | null;
  category?: string | null;
  status?: string | null;
  is_approved?: boolean;
  header_format?: string | null;
  header_text?: string | null;
  body_text?: string | null;
  variable_counts?: { header?: number; body?: number; [key: string]: number | undefined } | null;
  variable_tokens?: { header?: string[]; body?: string[]; [key: string]: string[] | undefined } | null;
  uses_named_parameters?: boolean;
  /** CHAT-07 (2026-10-19). The brand that owns the template. */
  owner_business_id?: number | null;
  [key: string]: unknown;
};

export type TemplateListParams = PageParams & {
  approved_only?: 1;
  search?: string;
  category?: string;
  /**
   * CHAT-07 (2026-10-19). The chat's own number. Without it the picker can
   * offer templates that number may not send, and CHAT-08 then answers 404.
   */
  whatsapp_account_id?: number;
};

/**
 * CHAT-13 / CHAT-20 (2026-10-19). Labels and quick replies belong to one
 * number, so both lists are fetched and cached per number.
 */
export type ByNumberParams = { whatsapp_account_id?: number };

export type SendTemplatePayload = {
  template_id: number;
  header_params?: string[];
  body_params?: string[];
};

export type UpdateLabelsPayload = { label_ids: number[] };
export type UpdatePriorityPayload = { priority: ConversationPriority };
export type UpdatePresencePayload = { status: PresenceStatus };

// ---------------------------------------------------------------------------
// Dashboard (DASH-01) — only the personal-dashboard fields are typed
// ---------------------------------------------------------------------------

export type DashboardTotals = {
  total: number;
  open: number;
  unread: number;
  window_open: number;
};

export type DashboardActivityDay = {
  date: string;
  label: string;
  weekday: string;
  inbound: number;
  outbound: number;
};

export type DashboardOverview = {
  totals: DashboardTotals & Record<string, number | undefined>;
  by_priority?: { priority: ConversationPriority; count: number }[];
  activity?: {
    days: DashboardActivityDay[];
    inbound_total: number;
    outbound_total: number;
    today: { inbound: number; outbound: number };
    busiest?: { label: string; total: number } | null;
  };
  /** `delivered` already includes `read`. total = delivered + failed + in_flight. */
  delivery?: {
    window_days: number;
    total: number;
    delivered: number;
    read: number;
    failed: number;
    in_flight: number;
  };
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Live updates (LIVE-01)
// ---------------------------------------------------------------------------

export type BroadcastAuthPayload = { socket_id: string; channel_name: string };
export type BroadcastAuthResponse = { auth: string; channel_data?: string };

// --- AI on a chat (CHAT-24 to CHAT-27) ------------------------------------------

/**
 * CHAT-24. What the AI is doing in this chat and why. `active: false` with a
 * `paused_reason` is the paused state; a human reply pauses it too.
 */
export type AiDecision = {
  id: number;
  action: string;
  reason?: string | null;
  message_id?: number | null;
  reply_message_id?: number | null;
  knowledge?: unknown[] | null;
  knowledge_source?: {
    source: 'legacy' | 'hub' | (string & {});
    label?: string | null;
    snapshot_version?: number | string | null;
    items?: unknown[] | null;
  } | null;
  details?: unknown;
  at?: string | null;
};

/** CHAT-24 / CHAT-27. Which branch the chat is about. */
export type AiLocationChoice = {
  location_id: number | null;
  location_version?: number | null;
  name?: string | null;
  /** Offer the picker only when both of these are true. */
  required?: boolean;
  can_set?: boolean;
  candidates?: { id: number; name: string }[] | null;
};

export type AiStatus = {
  enabled_for_number: boolean;
  active: boolean;
  paused_reason?: string | null;
  paused_at?: string | null;
  location?: AiLocationChoice | null;
  /** The last 20. */
  decisions?: AiDecision[] | null;
};

/** CHAT-27. `location_id: null` clears it. 409 hands back `data.current`. */
export type SetConversationLocationPayload = {
  location_id: number | null;
  location_version?: number | null;
};

export type ConversationLocation = {
  location_id: number | null;
  location_version?: number | null;
};

/** CHAT-34. Only creates a to-do in the web Knowledge Hub. */
export type KnowledgeGapPayload = { message_id: number; note?: string };

// --- Follow-ups (CHAT-28 to CHAT-33) -------------------------------------------

export type FollowUpKind = 'callback' | 'follow_up' | 'promise' | 'review' | (string & {});
export type FollowUpStatus =
  | 'open'
  | 'acknowledged'
  | 'snoozed'
  | 'done'
  | 'cancelled'
  | (string & {});
export type FollowUpAction =
  | 'edit'
  | 'acknowledge'
  | 'snooze'
  | 'complete'
  | 'cancel'
  | (string & {});

export type FollowUp = {
  id: number;
  conversation_id: number;
  whatsapp_account_id?: number | null;
  business_id?: number | null;
  contact?: { id: number; name?: string | null } | null;
  kind: FollowUpKind;
  title: string;
  status: FollowUpStatus;
  due_at?: string | null;
  snoozed_until?: string | null;
  /** `due_at`, or `snoozed_until` while snoozed. Asia/Kolkata. */
  effective_due_at?: string | null;
  overdue?: boolean;
  due_today?: boolean;
  owner?: { id: number; name?: string | null } | null;
  created_by?: { id: number; name?: string | null } | null;
  /** Draw buttons only from this list. */
  allowed_actions?: FollowUpAction[] | null;
  /** Optimistic lock: send it back on every change; 409 means stale. */
  version: number;
  [key: string]: unknown;
};

/** CHAT-28. Open ones first, then the last 20 closed. */
export type FollowUpList = {
  follow_ups: FollowUp[];
  can_create: boolean;
  limit?: { open: number; max: number } | null;
};

/** CHAT-29. Without `follow_ups.assign` this holds only the signed-in person. */
export type FollowUpOwners = { owners: { id: number; name: string; is_self?: boolean }[] };

/**
 * CHAT-30. `idempotency_key` is a fresh uuid per tap: the same key and body
 * again replays the first answer instead of adding a second follow-up.
 */
export type CreateFollowUpPayload = {
  kind: FollowUpKind;
  title: string;
  due_at: string;
  owner_user_id?: number;
  idempotency_key: string;
  source_message_id?: number;
  note?: string;
};

/** CHAT-31. Only while open, acknowledged or snoozed. */
export type UpdateFollowUpPayload = {
  version: number;
  title?: string;
  due_at?: string;
  owner_user_id?: number;
};

/** CHAT-32. */
export type AcknowledgeFollowUpPayload = { version: number };
export type SnoozeFollowUpPayload = { version: number; until: string; reason: string };
export type CompleteFollowUpPayload = { version: number; note: string };
export type CancelFollowUpPayload = { version: number; reason: string };

export type FollowUpEvent = {
  id: number;
  action: string;
  from_status?: FollowUpStatus | null;
  to_status?: FollowUpStatus | null;
  actor?: { type: string; id?: number | null; name?: string | null } | null;
  note?: string | null;
  changes?: unknown;
  created_at?: string | null;
};

/** CHAT-33. */
export type FollowUpDetail = { follow_up: FollowUp; events: FollowUpEvent[] };

export const FollowUpLimits = {
  titleMin: 1,
  titleMax: 160,
  /** `due_at` must be in the future and within a year. */
  dueWithinDays: 365,
  snoozeWithinDays: 90,
  reasonMin: 3,
  reasonMax: 500,
  noteMin: 3,
  noteMax: 2000,
} as const;

// --- Brands, locations and numbers (ORG-02 to ORG-14) --------------------------

export type OrgStatus = 'active' | 'archived' | (string & {});

/** ORG-02 / ORG-04. A brand - a "business" in the API, a "Client" in an agency. */
export type Business = {
  id: number;
  name: string;
  status?: OrgStatus;
  provisional?: boolean;
  /** Optimistic lock; send it back as `expected_version`. */
  version: number;
  location_ids?: number[] | null;
  workspace_ids?: number[] | null;
  counts?: { numbers: number; locations: number; members: number } | null;
};

/** ORG-02 / ORG-09. A branch. The time zone is always Asia/Kolkata. */
export type OrgLocation = {
  id: number;
  business_id: number;
  name: string;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  service_area?: string | null;
  status?: OrgStatus;
  version: number;
  workspace_ids?: number[] | null;
};

/** ORG-02. A number; the API calls it a workspace. */
export type OrgWorkspace = {
  id: number;
  label?: string | null;
  display_label?: string | null;
  display_phone_number?: string | null;
  phone_suffix?: string | null;
  status?: string | null;
  business_id?: number | null;
  location_ids?: number[] | null;
  business_wide?: boolean;
  /** Send as `expected_version` on ORG-13 and ORG-14. */
  mapping_version?: number | null;
  ai_replies_on?: boolean;
};

/** ORG-02. The Locations & Numbers screen. An Agent gets 403 - use bootstrap. */
export type Structure = {
  account: {
    type: AccountType | null;
    classified?: boolean;
    source?: string | null;
    admin_label?: string | null;
    provisional_businesses?: unknown;
  };
  businesses: Business[];
  locations: OrgLocation[];
  workspaces: OrgWorkspace[];
  limits?: { max_locations_per_business: number; source?: string | null } | null;
};

/** ORG-04. Agency accounts only; anything else answers 422. */
export type BusinessList = {
  businesses: Business[];
  limits?: { max_businesses_per_account: number; source?: string | null } | null;
  /** Draw Add / Archive / Members only from here. */
  can?: { manage?: boolean; members?: boolean } | null;
};

/** ORG-07 / ORG-08. */
export type BusinessMember = {
  user_id: number;
  name: string;
  role?: RoleName | null;
  access_mode?: 'businesses' | 'selected' | (string & {});
  restricted_number_ids?: number[] | null;
  effective_number_ids?: number[] | null;
};

export type BusinessMembers = {
  version: number;
  members: BusinessMember[];
  /** People who already see every brand; they cannot be removed here. */
  account_wide: { user_id: number; name: string; role?: RoleName | null }[];
  candidates: { user_id: number; name: string; role?: RoleName | null }[];
};

export type RenameBusinessPayload = { name: string; expected_version: number };
export type CreateBusinessPayload = { name: string };
export type ArchiveBusinessPayload = { expected_version: number };
/** ORG-08. A full replacement: send everyone who should stay. */
export type ReplaceMembersPayload = { user_ids: number[]; expected_version: number };

export type CreateLocationPayload = {
  name: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  service_area?: string;
};
export type UpdateLocationPayload = Partial<CreateLocationPayload> & { expected_version: number };
export type ArchiveLocationPayload = { expected_version: number };

/** ORG-12. Shown before saving: nothing reconnects and no chat is lost. */
export type MappingPreview = {
  workspace_id: number;
  business_id: number;
  before_location_ids: number[];
  after_location_ids: number[];
  added: number[];
  removed: number[];
  business_wide_after: boolean;
  conversations_kept: boolean;
  reconnects_number: boolean;
  ai_replies_on?: boolean;
  note?: string | null;
};

/** ORG-12 / ORG-13. An empty list means the whole brand. */
export type MappingPayload = { location_ids: number[] };
export type SaveMappingPayload = MappingPayload & { expected_version: number };

/** ORG-14. Only for a number with `client_choice_pending`. */
export type ChooseClientPayload = { expected_version: number; reason: string } & (
  | { business_id: number }
  | { new_client_name: string }
);

export const OrgLimits = {
  nameMax: 120,
  addressLineMax: 190,
  cityStateMax: 80,
  pincodeDigits: 6,
  serviceAreaMax: 2000,
  chooseClientReasonMin: 5,
  chooseClientReasonMax: 2000,
} as const;

// --- Report (REP-01 to REP-09) --------------------------------------------------

/** REP-01 / REP-03. `value: null` means "Not available" - never draw it as 0. */
export type ReportMetric = {
  key: string;
  label: string;
  kind?: string | null;
  value: number | null;
  denominator?: number | null;
  source?: string | null;
  coverage?: unknown;
  prior_value?: number | null;
  change_pct?: number | null;
  breakdown?: unknown;
  note?: string | null;
};

export type ReportPeriodKey = '7d' | '30d' | '90d' | 'custom';

export type ReportPeriod = {
  key: ReportPeriodKey | (string & {});
  from: string;
  to: string;
  timezone: string;
  days: number;
  previous?: unknown;
};

/** A section the person may not see comes back null and is named here. */
export type ReportSectionErrors = Record<string, 'unavailable' | 'no_permission' | (string & {})>;

export type AccountOverviewParams = {
  period?: ReportPeriodKey;
  /** `custom` only, at most 366 days. */
  from?: string;
  to?: string;
  compare?: 1;
  business_id?: number;
  numbers?: number[];
  /** Anyone but yourself needs `conversations.view_all`. */
  assignee_id?: number;
  message_type?: 'all' | 'templates' | 'chat';
};

/** REP-01. */
export type AccountOverview = {
  as_of: string;
  scope: {
    account_id: number;
    workspace_ids: number[];
    permitted_workspace_ids: number[];
    business_id?: number | null;
    /** True means "Your numbers" - never say "the whole account". */
    partial_access: boolean;
  };
  period: ReportPeriod;
  snapshot_metrics: ReportMetric[];
  period_metrics: ReportMetric[];
  attention_items?: unknown[] | null;
  workspace_comparisons?: unknown[] | null;
  connection_status?: unknown;
  message_timeline?: unknown;
  delivery_cohort?: unknown;
  conversation_health?: unknown;
  team_load?: unknown;
  errors?: ReportSectionErrors | null;
};

/** REP-02. Plain-language failure reasons; no customer names or numbers. */
export type DeliveryIssueGroup = {
  workspace: { id: number; label?: string | null };
  code: string;
  reason_key: string;
  reason: string;
  advice?: string | null;
  resend: 'not_advised' | 'fix_then_send' | 'may_retry' | (string & {});
  count: number;
  chats?: number | null;
  first_at?: string | null;
  last_at?: string | null;
  broadcast?: unknown;
};

export type DeliveryIssues = {
  as_of: string;
  period: ReportPeriod;
  /** Top 50. */
  groups: DeliveryIssueGroup[];
  totals: { failed: number; attempts: number };
};

export type ActionDeskTab =
  | 'all'
  | 'unassigned'
  | 'due_today'
  | 'overdue'
  | 'ai_needs_help'
  | 'waiting_for_staff';

/** REP-04. One row per open follow-up, or per chat that needs attention. */
export type ActionItem = {
  id: string | number;
  type: 'follow_up' | 'conversation' | (string & {});
  priority?: string | null;
  reasons?: string[] | null;
  reason?: string | null;
  next_action?: string | null;
  conversation_id: number;
  contact?: { id: number; name?: string | null } | null;
  follow_up?: FollowUp | null;
  assignee?: { id: number; name?: string | null } | null;
  owner?: { id: number; name?: string | null } | null;
  due_at?: string | null;
  waiting_since?: string | null;
  snippet?: string | null;
  allowed_actions?: FollowUpAction[] | null;
};

export type ActionDesk = {
  as_of?: string;
  counts?: Record<string, number> | null;
  /** 25 a page. */
  items: ActionItem[];
  next_cursor?: string | null;
};

/** REP-03. A null section is explained in `errors`; show the rest. */
export type NumberToday = {
  as_of: string;
  workspace: {
    account_id: number;
    number_id: number;
    business_id?: number | null;
    business_name?: string | null;
    label?: string | null;
    display_phone?: string | null;
    timezone?: string | null;
    connection_state?: string | null;
  };
  capabilities?: unknown;
  permissions?: unknown;
  period: ReportPeriod;
  summary_metrics: ReportMetric[];
  action_desk?: ActionDesk | null;
  ai_health?: unknown;
  knowledge_health?: unknown;
  /** AI tokens, not messages: Meta's charges are separate. */
  token_usage?: unknown;
  messaging_health?: unknown;
  errors?: ReportSectionErrors | null;
};

export type ActionDeskParams = { tab?: ActionDeskTab; cursor?: string };
export type NumberTodayParams = { period?: 'today' | '7d' | '30d' };

/** REP-05. Omit `whatsapp_account_id` for the combined view plus `workspaces`. */
export type DashboardParams = { whatsapp_account_id?: number };

export type DashboardWorkspaceRow = {
  id: number;
  label?: string | null;
  phone?: string | null;
  colour?: string | null;
  total?: number;
  open?: number;
  unassigned?: number;
  unread?: number;
  contacts?: number;
  sent?: number;
  delivered?: number;
  failed?: number;
  window_days?: number;
};

/** REP-06. Includes disconnected numbers so their history still reports. */
export type NumberReportOption = {
  id: number;
  display_label: string;
  display_phone_number?: string | null;
  color?: string | null;
  disconnected?: boolean;
};

/** REP-07. A missing figure means not permitted or not available, never zero. */
export type NumberReportParams = {
  number_id?: number;
  number_ids?: number[];
  from?: string;
  to?: string;
  list_id?: number;
  segment_id?: number;
  campaign_id?: number;
  source_id?: number;
  broadcast_id?: number;
};

export type NumberReport = {
  numbers: unknown[];
  totals?: unknown;
  from: string;
  to: string;
  timezone: string;
  filtered_by?: unknown;
  balance_scope?: unknown;
};
