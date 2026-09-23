/**
 * Super-admin Phase 4. The app hands the link to the phone and nothing more: it
 * never composes the message, and a phone that cannot open the link leaves the
 * caller a way to say so instead of a dead button.
 */
const mockOpenURL = jest.fn(async (_url: string) => true as const);
jest.mock('expo-linking', () => ({ openURL: (url: string) => mockOpenURL(url) }));

import { openSupportChat, openSupportEmail } from '../openSupport';

const chatUrl =
  'https://wa.me/919999999999?text=Hi%20Wazigo%20support%2C%20this%20is%20Riya%20from%20Sharma%20Traders%20(account%20%2312).%20I%20need%20help%20with%3A%20';

beforeEach(() => {
  jest.clearAllMocks();
  mockOpenURL.mockResolvedValue(true);
});

describe('openSupportChat', () => {
  it('opens the server\u2019s link byte for byte, without re-encoding it', async () => {
    await expect(openSupportChat(chatUrl)).resolves.toBe(true);

    expect(mockOpenURL).toHaveBeenCalledWith(chatUrl);
  });

  it('reports a phone that could not open it, rather than throwing at the screen', async () => {
    mockOpenURL.mockRejectedValue(new Error('No activity found to handle Intent'));

    await expect(openSupportChat(chatUrl)).resolves.toBe(false);
  });

  it('does nothing at all when Wazigo has not set a support number', async () => {
    await expect(openSupportChat(null)).resolves.toBe(false);

    expect(mockOpenURL).not.toHaveBeenCalled();
  });
});

describe('openSupportEmail', () => {
  it('opens the mail app on the support address', async () => {
    await expect(openSupportEmail('support@wazigo.io')).resolves.toBe(true);

    expect(mockOpenURL).toHaveBeenCalledWith('mailto:support@wazigo.io');
  });

  it('reports a phone with no mail app', async () => {
    mockOpenURL.mockRejectedValue(new Error('no handler'));

    await expect(openSupportEmail('support@wazigo.io')).resolves.toBe(false);
  });
});
