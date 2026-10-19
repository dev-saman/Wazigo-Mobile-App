import { createLiveBatcher, LIVE_BATCH_DELAY_MS } from '../liveBatch';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('answers a burst of events with one refresh', () => {
  const flush = jest.fn();
  const batcher = createLiveBatcher(flush);

  batcher.push({ conversationId: 42, affectsLists: true });
  batcher.push({ conversationId: 42, affectsLists: false });
  batcher.push({ conversationId: 7, affectsLists: false });
  expect(flush).not.toHaveBeenCalled();

  jest.advanceTimersByTime(LIVE_BATCH_DELAY_MS);
  expect(flush).toHaveBeenCalledTimes(1);
  expect(flush).toHaveBeenCalledWith({
    conversationIds: [42, 7],
    assignedAwayIds: [],
    lists: true,
    everything: false,
    accessChanged: false,
  });
});

it('does not keep postponing the refresh while events keep coming', () => {
  const flush = jest.fn();
  const batcher = createLiveBatcher(flush);

  batcher.push({ conversationId: 1, affectsLists: false });
  jest.advanceTimersByTime(LIVE_BATCH_DELAY_MS - 100);
  batcher.push({ conversationId: 2, affectsLists: false });
  jest.advanceTimersByTime(100);

  expect(flush).toHaveBeenCalledTimes(1);
  expect(flush.mock.calls[0][0].conversationIds).toEqual([1, 2]);
});

it('a delivery tick alone does not reload lists', () => {
  const flush = jest.fn();
  const batcher = createLiveBatcher(flush);
  batcher.push({ conversationId: 3, affectsLists: false });
  jest.runAllTimers();
  expect(flush).toHaveBeenCalledWith({
    conversationIds: [3],
    assignedAwayIds: [],
    lists: false,
    everything: false,
    accessChanged: false,
  });
});

it('a catch-up asks for everything on screen', () => {
  const flush = jest.fn();
  const batcher = createLiveBatcher(flush);
  batcher.pushEverything();
  jest.runAllTimers();
  expect(flush).toHaveBeenCalledWith({
    conversationIds: [],
    assignedAwayIds: [],
    lists: true,
    everything: true,
    accessChanged: false,
  });
});

it('carries a chat reassigned away, so the open thread can be closed', () => {
  const flush = jest.fn();
  const batcher = createLiveBatcher(flush);
  batcher.push({ conversationId: 42, affectsLists: true, assignedAway: true });
  batcher.push({ conversationId: 7, affectsLists: true });
  jest.runAllTimers();
  expect(flush.mock.calls[0][0].assignedAwayIds).toEqual([42]);
});

it('cancel drops what was pending', () => {
  const flush = jest.fn();
  const batcher = createLiveBatcher(flush);
  batcher.push({ conversationId: 3, affectsLists: true });
  batcher.cancel();
  jest.runAllTimers();
  expect(flush).not.toHaveBeenCalled();
});

it('LIVE-04: an access change is carried so bootstrap can be read again', () => {
  const flush = jest.fn();
  const batcher = createLiveBatcher(flush);
  batcher.push({ conversationId: null, affectsLists: true, accessChanged: true });
  jest.runAllTimers();
  expect(flush.mock.calls[0][0].accessChanged).toBe(true);
  // The event names no chat, so nothing is refreshed by id.
  expect(flush.mock.calls[0][0].conversationIds).toEqual([]);
});

it('a later batch does not inherit the previous access change', () => {
  const flush = jest.fn();
  const batcher = createLiveBatcher(flush);
  batcher.push({ conversationId: null, affectsLists: true, accessChanged: true });
  jest.runAllTimers();
  batcher.push({ conversationId: 5, affectsLists: true });
  jest.runAllTimers();
  expect(flush.mock.calls[1][0].accessChanged).toBe(false);
});
