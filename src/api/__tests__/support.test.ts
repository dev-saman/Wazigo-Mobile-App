/**
 * Super-admin Phase 4. What the app is willing to believe about the `support`
 * block and about a 403 that closes the whole business. The block is not
 * published yet, so "absent" has to read exactly like "empty" everywhere.
 */
import { hasSupportContact, NO_SUPPORT, readWorkspaceUnavailable, toSupportContact } from '../support';

const chatUrl =
  'https://wa.me/919999999999?text=Hi%20Wazigo%20support%2C%20this%20is%20Riya%20from%20Sharma%20Traders%20(account%20%2312).%20I%20need%20help%20with%3A%20';

describe('toSupportContact', () => {
  it('reads an absent, null or empty block as nothing set', () => {
    expect(toSupportContact(undefined)).toEqual(NO_SUPPORT);
    expect(toSupportContact(null)).toEqual(NO_SUPPORT);
    expect(toSupportContact({})).toEqual(NO_SUPPORT);
    expect(toSupportContact({ email: '   ', chat_url: null })).toEqual(NO_SUPPORT);
    expect(hasSupportContact(NO_SUPPORT)).toBe(false);
  });

  it('keeps the link exactly as the server sent it, encoding and all', () => {
    const support = toSupportContact({ email: 'support@wazigo.io', chat_url: chatUrl });

    expect(support.chat_url).toBe(chatUrl);
    expect(support.email).toBe('support@wazigo.io');
    expect(hasSupportContact(support)).toBe(true);
  });

  it('shows the email with no number set, and the number with no email set', () => {
    expect(toSupportContact({ email: 'support@wazigo.io', chat_url: null })).toEqual({
      email: 'support@wazigo.io',
      chat_url: null,
    });
    expect(toSupportContact({ chat_url: chatUrl }).chat_url).toBe(chatUrl);
  });

  it('drops a link the phone could not fall back to a browser for', () => {
    expect(toSupportContact({ chat_url: 'whatsapp://send?phone=919999999999' }).chat_url).toBeNull();
    expect(toSupportContact({ chat_url: 'javascript:alert(1)' }).chat_url).toBeNull();
    expect(toSupportContact({ chat_url: 42 }).chat_url).toBeNull();
  });

  it('drops anything that is not plainly an email address', () => {
    expect(toSupportContact({ email: 'mailto:support@wazigo.io' }).email).toBeNull();
    expect(toSupportContact({ email: 'Wazigo Support' }).email).toBeNull();
  });
});

describe('readWorkspaceUnavailable', () => {
  const body = (data: unknown) => ({ status: false, message: 'Forbidden.', data });

  it('reads the suspension, the reason and the support block', () => {
    expect(
      readWorkspaceUnavailable(
        body({
          code: 'workspace_unavailable',
          workspace_status: 'deactivated',
          reason: 'Your subscription ended on 31 August.',
          support: { email: 'support@wazigo.io', chat_url: chatUrl },
        }),
      ),
    ).toEqual({
      code: 'workspace_unavailable',
      workspace_status: 'deactivated',
      reason: 'Your subscription ended on 31 August.',
      support: { email: 'support@wazigo.io', chat_url: chatUrl },
    });
  });

  it('copes with an empty reason and a support block Wazigo has not filled in', () => {
    const workspace = readWorkspaceUnavailable(
      body({ code: 'workspace_unavailable', workspace_status: 'suspended', reason: '', support: null }),
    );

    expect(workspace).toEqual({
      code: 'workspace_unavailable',
      workspace_status: 'suspended',
      reason: null,
      support: NO_SUPPORT,
    });
  });

  it('still explains itself if a status the app has never heard of arrives', () => {
    expect(
      readWorkspaceUnavailable(body({ code: 'workspace_unavailable', workspace_status: 'archived' }))
        ?.workspace_status,
    ).toBe('suspended');
  });

  it('leaves an ordinary 403 alone', () => {
    expect(readWorkspaceUnavailable(body({ code: 'insufficient_permissions' }))).toBeNull();
    expect(readWorkspaceUnavailable({ status: false, message: 'Forbidden.' })).toBeNull();
    expect(readWorkspaceUnavailable(undefined)).toBeNull();
  });
});
