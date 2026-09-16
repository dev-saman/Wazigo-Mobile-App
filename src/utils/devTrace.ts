type TraceDetail = Record<string, string | number | boolean | null | undefined>;

/**
 * Development only: records that a user action is about to change server data,
 * with a wall-clock time that lines up with `adb logcat` and with the
 * `[api:write]` line the request itself produces.
 *
 * Added after a real WhatsApp message left an emulator during inspection and the
 * logs could show the request but not what triggered it. Never log message
 * content here - lengths and ids only.
 */
export function traceWriteIntent(action: string, detail?: TraceDetail) {
  if (!__DEV__) return;
  console.log(`[ui:write] ${new Date().toISOString()} ${action}${detail ? ` ${JSON.stringify(detail)}` : ''}`);
}
