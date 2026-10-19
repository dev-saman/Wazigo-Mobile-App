# API changes the app has not caught up with — 19 Oct 2026

Source: Google Sheet **"Wazigo Mobile App — API Reference (2026-09-18)"**, tab *What's new
2026-10-19*. The workbook states it covers every Wazigo API change the mobile app can use
between 18 Sep and 19 Oct 2026 (Wazigo `main` at `bef3fff5`).

This file is a gap list, not a contract. The workbook is the contract; `REFERENCE.md` §7
describes what the app implements today.

## What is built

**The API layer** — every path and shape below is in `src/api/endpoints.ts`, `types.ts` and
`apis.ts`.

**The Chat area (§1 and §2 below), end to end:**

- **Templates, labels and quick replies follow the chat's own number** (CHAT-07 / 13 / 20). Each
  cache remembers which number it belongs to and is dropped when the chat is on another one, so
  another brand's template can no longer be offered and then refused with a 404.
- **Brand, branch and number filtering, and sort** (CHAT-01). `ChatScopeBar` on the chats list;
  the numbers come from bootstrap, one number goes as `number_id` and several as `number_ids[]`,
  never both. A scope that covers no number shows an empty list rather than asking for
  everything. `sort` is sent only when it is not the server's own default.
- **CHAT-23 on a push tap.** The chat is read before it is opened: a 404 says "This chat is no
  longer available" and nothing else is opened in its place. A network failure is not treated as
  lost access.
- **The AI bar** (CHAT-24 / 25 / 26): whether the AI is answering, why it paused, its last
  decisions, and Take over / Let AI reply behind `conversations.send`.
- **Follow-ups** (CHAT-28 to CHAT-33) at `/chats/[id]/follow-ups`: list, add, acknowledge,
  snooze, complete, cancel, and the history sheet. Buttons come from `allowed_actions`, every
  change carries `version`, and a 409 re-reads the list instead of resending.
- **The chat's branch** (CHAT-27), in the AI bar behind `conversations.set_location`, offered
  only when CHAT-24 reports both `location.required` and `location.can_set`. The
  `location_version` goes back exactly as it came, and a 409 re-reads the status so the person
  is asked again rather than overwriting a colleague.
- **"The AI could not answer this"** (CHAT-34) on a long-press of a customer's message, behind
  `knowledge.manage`. It only adds a to-do in the web Knowledge Hub.
- **LIVE-04 `number.access_changed`** re-reads `/me/bootstrap` before refreshing anything else.
- **Bootstrap** now keeps `account`, `businesses`, `locations` and the per-number brand, branch
  and colour fields, plus the LIVE-03 inbox channel name.

**Not built:** the two new areas (§4), and LIVE-03 — no Brand or Location inbox view needs the
personal inbox feed yet, and subscribing to it alongside the agent channel would only mean
de-duplicating events for no gain.

Two deliberate gaps worth knowing about:

- **Follow-up times are a short list of choices** (in an hour, tomorrow morning, next week), not
  a date picker. Adding one is a native dependency decision nobody has made (REFERENCE.md §17).
- **The brand/branch choice is not persisted.** ORG-17 wants it kept per account and user; that
  belongs with the brand switcher, which is not built.

The workbook now frames the app as four areas: **1 Login · 2 Agency, Brand & Location ·
3 Chat · 4 Report**. Report replaces the personal Dashboard.

---

## 1. Changed contracts on endpoints the app already calls

These are the ones that can make the current build behave wrongly on a multi-number workspace,
so they are worth more than the new screens.

| ID | What changed | Effect on this app |
| --- | --- | --- |
| AUTH-05 | `/me/bootstrap` gains `account`, `businesses[]`, `locations[]`, `user.number_access`, per-number `waba_id / display_label / color / business_id / location_ids[] / business_wide / client_choice_pending`, `realtime.channels.inbox` and `.user`, `settings.notification_prefs`, `routes[].scope` | Parsed into `BootstrapPayload`, which ignores all of it. `account.type` is what decides the whole layout |
| CHAT-01 | `?number_id=` / `?number_ids[]=` (never both) and `sort=newest\|oldest_waiting\|priority`; each `conversation.number` gains `label`, `display_label`, `color` | No brand / location filter and no sort in the UI |
| CHAT-07 | `/templates` takes `whatsapp_account_id`; response gains `owner_business_id` | **The picker can list templates the chat's number may not send.** CHAT-08 answers 404 for another brand's template |
| CHAT-13 / CHAT-20 | `/labels` and `/canned-messages` take `whatsapp_account_id` — each number has its own | **Labels and quick replies from other numbers are shown today** |
| CHAT-21 / 22 | The same phone on two numbers is two customers with separate notes | Notes must never be merged by phone |
| DASH-01 | `/crm/overview` takes `?whatsapp_account_id`; without it the reply adds `workspaces[]`, one row per number | Dashboard shows a combined figure with no way to pick a number |
| LIVE-02 | Events are re-checked against current number access. Losing a chat this way sends a slim `conversation.assigned` — `{conversation:{id, whatsapp_account_id, assigned_user_id}, previous_assigned_user_id}`, no customer content | `channels.ts` already reduces events to an id, so this should pass through; unverified |
| PUSH-01 | Title is `"<contact> · <number label>"`; `data` gains `number = {id, display_label, display_phone_number, color}`. The server re-checks assignment, active person/account, mute, permission and number access at delivery | The app reads only `conversation_id`, so nothing breaks; the number is simply not shown |
| Number channels | **Retired.** `realtime.channels.numbers` is always `[]` | Already not subscribed to — no action |

## 2. New endpoints in an area the app already has (Chat)

| ID | Endpoint | Purpose |
| --- | --- | --- |
| CHAT-23 | `GET /conversations/{id}` | Open one chat from a push tap; 404 means "no longer available" |
| CHAT-24 | `GET /conversations/{id}/ai` | AI status, pause reason, location choice, last 20 decisions |
| CHAT-25 / 26 | `POST .../ai/pause`, `.../ai/resume` | Take over from the AI, hand it back |
| CHAT-27 | `POST /conversations/{id}/location` | Which branch the chat is about (`conversations.set_location`; not Agent) |
| CHAT-28 | `GET /conversations/{id}/follow-ups` | Follow-ups on this chat |
| CHAT-29 | `GET /conversations/{id}/follow-up-owners` | Who can own one |
| CHAT-30 | `POST /conversations/{id}/follow-ups` | Add one (idempotency key per tap) |
| CHAT-31 | `PATCH /follow-ups/{id}` | Edit (optimistic `version`) |
| CHAT-32 | `POST /follow-ups/{id}/acknowledge \| snooze \| complete \| cancel` | Change state |
| CHAT-33 | `GET /follow-ups/{id}` | History |
| CHAT-34 | `POST /conversations/{id}/knowledge-gap` | "The AI could not answer this" |

## 3. New live channels

| ID | Channel | Purpose |
| --- | --- | --- |
| LIVE-03 | `private-tenant.<t>.inbox.<user>` (`realtime.channels.inbox`) | Every chat this person may open, plus `contact.updated` and `template.status_updated`. Only needed for Brand / Location inbox views; the agent channel is enough for My Chats. De-duplicate if both are subscribed |
| LIVE-04 | `private-App.Models.User.<user>` (`realtime.channels.user`), event `number.access_changed`, payload `{}` | Re-fetch bootstrap, close screens for numbers or brands that are gone, drop cached chats and filters |

**LIVE-04 is nearly free:** `channelsFor()` in `src/services/socket/channels.ts:41` already
subscribes to `private-App.Models.User.<id>`. Only the event binding and the re-fetch are
missing.

## 4. Two new app areas — not built at all

**Agency, Brand & Location (ORG-00 … ORG-19).** `GET /structure`; brand list, create, rename,
archive/restore; brand members read and replace; location create, edit, archive/restore;
number→location mapping preview and save; finish a number waiting for a brand. Agency accounts
have several brands; `account.type` from AUTH-05 decides whether a brand switcher is shown at
all. ORG-15 (connect a number) and ORG-16 (give old items a brand) stay web-only.

**Report (REP-00 … REP-10)**, replacing the personal Dashboard: `GET /account/overview` and
`/account/overview/delivery-issues`; per-number `/whatsapp/numbers/{id}/today` and
`/action-desk`; `/reports/numbers` with `/options` and `/export`; campaign, source and broadcast
CSV exports. Figures follow the Inbox rule, **not** "only my chats".

## 5. Backend blockers — unchanged

The workbook's *Change-required status* tab, on 2026-10-19:

- CHAT-01 / CHAT-02 personal-only chats: **still not done.** Agent still sees own + unassigned;
  Admin / Supervisor see all on their numbers. Use `assigned=mine` for My Chats.
- DASH-01 personal dashboard: **still not done.** Report is per number / per brand, not per person.
- G03 "start a chat from another number": **not done** — there is still no create-conversation API.
- G01 (number name in push) and G02 (fresh checks before delivery): **done**.

## 6. Not in this workbook

Phase 4 — the support contact shape and the `workspace_unavailable` 403 body — appears in
neither the old sheet nor this one. AUTH-05 lists `support` only as a bootstrap key.

Two further workbooks are referenced and **not** reviewed here: a part-2 sheet (Customers,
Campaigns, Automation, Content, Settings — "every endpoint there is live; none of these screens
exist in the app yet") and a project brief, version 2, dated 2026-10-19.
