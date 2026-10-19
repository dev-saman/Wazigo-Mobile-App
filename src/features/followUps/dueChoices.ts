import { istDayStart } from '@/utils/datetime';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type DueChoice = { key: string; label: string; at: Date };

/**
 * CHAT-30 / CHAT-32 take an exact time. This project has no date-picker
 * dependency - picking one is a native decision nobody has made yet (see
 * REFERENCE.md §17) - so the app offers the times a follow-up on a phone
 * actually gets set to, all inside the 365-day limit.
 *
 * Everything is worked out against Asia/Kolkata, which is the time zone the
 * rest of the app shows and the only one the server reports in.
 */
export function dueChoices(now = Date.now()): DueChoice[] {
  const tomorrowMorning = istDayStart(now + DAY) + 10 * HOUR;
  const nextWeekMorning = istDayStart(now + 7 * DAY) + 10 * HOUR;

  return [
    { key: '1h', label: 'In an hour', at: new Date(now + HOUR) },
    { key: '3h', label: 'In three hours', at: new Date(now + 3 * HOUR) },
    { key: 'tomorrow', label: 'Tomorrow morning', at: new Date(tomorrowMorning) },
    { key: '3d', label: 'In three days', at: new Date(now + 3 * DAY) },
    { key: 'week', label: 'Next week', at: new Date(nextWeekMorning) },
  ].filter((choice) => choice.at.getTime() > now);
}
