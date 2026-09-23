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
  [key: string]: unknown;
};

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
  /** The web app's per-number channels. Mobile does not need them. */
  numbers?: string[] | null;
  tenant?: string | null;
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
  events?: { agent?: string[] | null; tenant?: string[] | null } | null;
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

export type ConversationListParams = PageParams & {
  status?: ConversationStatus;
  search?: string;
  unread?: 1;
  assigned?: 'mine' | 'unassigned';
  label_id?: number;
  priority?: ConversationPriority;
  number_id?: number;
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
  [key: string]: unknown;
};

export type TemplateListParams = PageParams & {
  approved_only?: 1;
  search?: string;
  category?: string;
};

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
