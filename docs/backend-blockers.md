# Wazigo Mobile — what the app needs from the backend

For the Wazigo server team. Last updated: 2026-09-16, against the API Reference workbook
(sheets: Start here, Login, Chat, Dashboard, Live updates) as reviewed on 2026-09-15.

The mobile app promises one thing the web dashboard does not: **it is personal.** An agent sees
their own chats, their own numbers and their own figures. Six items below stand between that
promise and what the API returns today.

**Filtering on the device is never the fix.** Dropping other people's rows after they have been
sent would hide the problem, not solve it: the data would still have left the server, still be in
the response, and still be visible to anyone who inspects the traffic. Every item here asks the
server to decide, not the client.

## Summary

| # | What | Endpoint | Risk if unfixed |
| --- | --- | --- | --- |
| 1 | Chat list is not scoped to the agent | CHAT-01 `GET /conversations` | An agent sees conversations that are not theirs |
| 2 | Thread access is wider than assignment | CHAT-02 `GET /conversations/{id}/messages` | Any conversation on a reachable number can be read |
| 3 | Media access follows the same wide rule | CHAT-05 `.../messages/{msg}/media` | Customer photos and documents from other agents' chats |
| 4 | Dashboard counts everyone's chats | DASH-01 `GET /crm/overview` | Every personal figure is wrong |
| 5 | Live events are broadcast per number | LIVE-01 channel | Other assignees' message content pushed to the device |
| 6 | Reassignment does not revoke access | CHAT-02 / CHAT-05 | A former assignee keeps reading a chat that moved |

Items 1, 2, 3 and 6 are access control. Item 4 is correctness. Item 5 is why the app does not
connect to Reverb at all yet.

---

## 1. `GET /conversations` must scope to the caller

**Today.** With `assigned=mine`, an agent receives their own conversations *and* unassigned ones on
every number they can reach.

**The app.** Every filter chip is a server-side query, never a local filter:

| Chip | Params |
| --- | --- |
| Mine (default) | `assigned=mine` |
| Unread | `assigned=mine&unread=1` |
| Open | `assigned=mine&status=open` |
| Urgent | `assigned=mine&priority=urgent` |
| Unassigned | `assigned=unassigned` |

**Fixed looks like.** `assigned=mine` returns conversations assigned to the caller and nothing
else. Unassigned ones are reachable only through `assigned=unassigned`, which is a deliberate
choice the agent makes.

**How to verify.** Agent A and agent B share number N. Assign a conversation to B. `assigned=mine`
as A must not contain it — on any page, with any other filter, and with any search term.

## 2. `GET /conversations/{id}/messages` must authorize by assignment

**Today.** The policy permits any conversation on a number the caller can access, so a thread can
be opened by id even when it belongs to someone else.

**The app.** A 403 is shown as Access Denied, with no retry offered — a refusal is treated as a
real answer rather than a fault. The app never guesses at access; it asks.

**Fixed looks like.** The caller may read a thread only when it is assigned to them (or unassigned,
if that is the product decision — but please say which). Anything else is 403.

**How to verify.** As A, request the id of a conversation assigned to B: 403, with no message
bodies and no `meta.conversation` in the response.

## 3. `GET .../messages/{msg}/media` must use the same rule

**Today.** Media inherits the same wide access as item 2.

**The app.** Media is **never** treated as a public URL. The binary stream is fetched with the
bearer token through the network layer, cached on the device, and the cache is cleared on logout.
Credentials are never sent to a host other than the Wazigo origin.

**Fixed looks like.** The media endpoint answers only for a message in a conversation the caller
may read (item 2), and 403s otherwise. `media.pending = true` stays as it is — the app says the
file is still arriving rather than showing an error, and fetches it again later.

**How to verify.** As A, request a media id from B's conversation: 403, and no bytes.

## 4. `GET /crm/overview` must count only the caller's conversations

**Today.** The figures count every chat on every number the caller can access, so an agent with
three open chats on a busy number sees the number's totals, not their own.

**The app.** Shows `totals.{total, open, unread, window_open}`, the priority breakdown, today's and
the window's inbound/outbound with the busiest day, and delivery. Nothing is recomputed on the
device, because a recomputed figure would only hide the discrepancy.

**Also.** `totals.closed` says `closed` while the conversation lifecycle says `resolved`. The app
ignores that field rather than showing a number whose meaning is unclear. Please align the two, or
say which is authoritative.

**How to verify.** An agent with 3 assigned conversations on a number carrying 500: `totals.total`
must be 3.

## 5. Reverb must deliver personal events

**Today.** The documented channel is `private-tenant.<tenant>.number.<number>`, which broadcasts to
everyone with access to that number, carrying message content.

**The app (since 2026-09-17).** Connects, as a stopgap decided by the product owner. It joins the
number channels the web app joins, plus the user's `App.Models.User.<id>` channel, but **uses
events only as signals**: each event is reduced to a conversation id on arrival, and the list,
dashboard and open thread are re-queried through CHAT-01/02 and DASH-01. Nothing from a payload is
stored or shown. **The gap this item describes is still real**: other assignees' message content
is still delivered to the phone, which is exactly what a personal channel would stop.

**Fixed looks like.** A channel scoped to the recipient — per user, or per conversation with
membership checked at `/broadcasting/auth` — carrying only conversations that recipient may see.
The app then only needs its channel names changed (`src/services/socket/channels.ts`).

**Answered since the first version of this document** (read from the web app and the live API):
the public Reverb key is the login page's `reverb-key` meta tag; auth is
`POST /api/v1/broadcasting/auth`; the tenant id is `settings.tenant.id` in `/me/bootstrap`; the
events are `message.received`, `message.sent`, `message.status`, `conversation.updated` and
`conversation.assigned`.

**Push (same privacy rule).** The app registers Expo push tokens with `POST /me/devices` and removes
them with `DELETE /me/devices` on sign-out. Please confirm the request body - the app sends
`{ token, platform: "ios"|"android", provider: "expo", device_name }` - and send notifications only
to the conversation's assignee, through Expo's push API, with `data.conversation_id` and Android
`channelId: "messages"`. A token Expo reports as `DeviceNotRegistered` should be deleted
server-side, since a session that expires cannot unregister itself.

## 6. Reassignment must revoke the previous assignee immediately

**Today.** When a conversation moves from A to B, A's access is not revoked at once.

**The app.** Already handles the send case: CHAT-03/04 answering **409** is read as "this chat was
reassigned while it was open", so the thread reloads to show the truth and the message that failed
stays on screen. A retry is not offered, because it would only fail again.

**Fixed looks like.** The moment a conversation is reassigned, the previous assignee gets 403 from
CHAT-02 and CHAT-05, and 409 from a send. No cache window, no next-request delay.

**How to verify.** A opens a thread. Reassign it to B. A's next send: 409. A's next thread load: 403.

---

## Values the app is still waiting for

Not all of these are backend work, but nothing ships without them.

| Value | Needed for | Notes |
| --- | --- | --- |
| ~~Reverb app key, `/broadcasting/auth` URL, `tenant_id`, event catalogue~~ | Live updates | Answered 2026-09-17 - see item 5 |
| The `POST /me/devices` request body | Push | The route exists; its field names could not be read without signing in. See item 5 |
| Confirmed OTP length | Login | The backend default is 5 digits and it is deployment-configurable, but no endpoint returns it. The app is built length-configurable and defaults to 5 — please confirm the deployed value |
| Terms of Service and Privacy Policy URLs | Login screen | The design shows both links; they are omitted until real URLs exist |
| A test account | The first real login | Ideally one flagged `test_account`, so AUTH-01 returns the review notice and the code is not delivered |
