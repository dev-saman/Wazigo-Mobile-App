import { createPresenceMonitor, HEARTBEAT_MS, presenceForAppState } from '../presenceMonitor';

/** Enough microtask turns for a then/catch/finally chain to finish. */
const flush = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

const build = (offline = false) => {
  const deps = {
    setStatus: jest.fn(async () => undefined),
    heartbeat: jest.fn(async () => undefined),
    isOffline: jest.fn(() => offline),
  };
  return { deps, monitor: createPresenceMonitor(deps) };
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('presenceForAppState', () => {
  it('is online only while the app is in front of the user', () => {
    expect(presenceForAppState('active')).toBe('online');
    expect(presenceForAppState('background')).toBe('away');
    expect(presenceForAppState('inactive')).toBe('away');
  });
});

describe('createPresenceMonitor', () => {
  it('sends the status once and then heartbeats every minute', async () => {
    const { deps, monitor } = build();

    monitor.setStatus('online');
    await flush();
    expect(deps.setStatus).toHaveBeenCalledWith('online');

    jest.advanceTimersByTime(HEARTBEAT_MS * 3);
    expect(deps.heartbeat).toHaveBeenCalledTimes(3);
    expect(deps.setStatus).toHaveBeenCalledTimes(1);
  });

  it('stops heartbeating as soon as the app leaves the foreground', async () => {
    const { deps, monitor } = build();

    monitor.setStatus('online');
    await flush();
    monitor.setStatus('away');
    await flush();

    jest.advanceTimersByTime(HEARTBEAT_MS * 2);
    expect(deps.heartbeat).not.toHaveBeenCalled();
    expect(deps.setStatus).toHaveBeenLastCalledWith('away');
  });

  it('does not repeat a status the server has already accepted', async () => {
    const { deps, monitor } = build();

    monitor.setStatus('online');
    await flush();
    monitor.setStatus('online');
    monitor.sync();
    await flush();

    expect(deps.setStatus).toHaveBeenCalledTimes(1);
  });

  it('sends nothing at all while the device is offline', async () => {
    const { deps, monitor } = build(true);

    monitor.setStatus('online');
    await flush();
    jest.advanceTimersByTime(HEARTBEAT_MS * 2);

    expect(deps.setStatus).not.toHaveBeenCalled();
    expect(deps.heartbeat).not.toHaveBeenCalled();
  });

  it('re-sends a status the server never accepted, without ever throwing', async () => {
    const { deps, monitor } = build();
    deps.setStatus.mockRejectedValueOnce(new Error('offline'));

    monitor.setStatus('online');
    await flush();
    await flush();
    expect(deps.setStatus).toHaveBeenCalledTimes(1);

    // A reconnect (or the next heartbeat) tries the same status again.
    monitor.sync();
    await flush();
    expect(deps.setStatus).toHaveBeenCalledTimes(2);
  });

  it('re-asserts the status instead of heartbeating one the server never took', async () => {
    const { deps, monitor } = build();
    deps.setStatus.mockRejectedValueOnce(new Error('timeout'));

    monitor.setStatus('online');
    await flush();
    await flush();

    jest.advanceTimersByTime(HEARTBEAT_MS);
    expect(deps.heartbeat).not.toHaveBeenCalled();
    expect(deps.setStatus).toHaveBeenCalledTimes(2);
  });

  it('sends a status that changed while the previous call was still in flight', async () => {
    const { deps, monitor } = build();

    // Backgrounded before the "online" call came back: "away" must still go.
    monitor.setStatus('online');
    monitor.setStatus('away');
    await flush();

    expect(deps.setStatus).toHaveBeenNthCalledWith(1, 'online');
    expect(deps.setStatus).toHaveBeenNthCalledWith(2, 'away');
  });

  it('stops everything when the signed-in area goes away', async () => {
    const { deps, monitor } = build();

    monitor.setStatus('online');
    await flush();
    monitor.stop();

    jest.advanceTimersByTime(HEARTBEAT_MS * 5);
    expect(deps.heartbeat).not.toHaveBeenCalled();
  });
});
