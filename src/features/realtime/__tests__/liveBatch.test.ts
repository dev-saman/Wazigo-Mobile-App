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
  expect(flush).toHaveBeenCalledWith({ conversationIds: [42, 7], lists: true, everything: false });
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
  expect(flush).toHaveBeenCalledWith({ conversationIds: [3], lists: false, everything: false });
});

it('a catch-up asks for everything on screen', () => {
  const flush = jest.fn();
  const batcher = createLiveBatcher(flush);
  batcher.pushEverything();
  jest.runAllTimers();
  expect(flush).toHaveBeenCalledWith({ conversationIds: [], lists: true, everything: true });
});

it('cancel drops what was pending', () => {
  const flush = jest.fn();
  const batcher = createLiveBatcher(flush);
  batcher.push({ conversationId: 3, affectsLists: true });
  batcher.cancel();
  jest.runAllTimers();
  expect(flush).not.toHaveBeenCalled();
});
