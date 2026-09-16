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
  | 'READ_ONLY'
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
};

export type PageParams = {
  page?: number;
  per_page?: number;
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
  [key: string]: unknown;
};

export type OtpRequestPayload = { phone: string; purpose: 'login' };
export type OtpRequestResult = { test_account: boolean; notice: string | null };
export type OtpNoticePayload = { phone: string };

export type OtpLoginPayload = { phone: string; code: string; device_name?: string };
export type PasswordLoginPayload = { phone: string; password: string; device_name?: string };
export type RefreshPayload = { refresh_token: string };
export type LogoutPayload = { refresh_token: string };

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

/** Mobile uses user, roles, permissions and numbers only. */
export type BootstrapPayload = {
  user: AuthUser;
  roles: RoleName[];
  permissions: string[];
  numbers: WhatsAppNumber[];
  routes?: unknown;
  menus?: unknown;
  feature_flags?: unknown;
  settings?: unknown;
  billing?: unknown;
};

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

export type Message = {
  id: number;
  conversation_id: number;
  direction: MessageDirection;
  origin?: string | null;
  type: MessageType;
  status?: MessageStatus | null;
  error_detail?: string | null;
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
