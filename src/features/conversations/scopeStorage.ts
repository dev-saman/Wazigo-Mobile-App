import type { ChatScope } from './chatScope';
import { appStorage, StorageKeys } from '@/services/storage/appStorage';

/**
 * ORG-17: the brand, branch or number choice is kept on the phone, per person.
 *
 * It is a UI preference, not data - only ids this device already had from
 * bootstrap - so it lives in `appStorage` rather than secure storage, and is
 * wiped with everything else on sign-out. The user id is stored with it so one
 * person's choice can never be restored into another's session on a shared
 * phone; an account id would add nothing, since a user belongs to one account.
 */
type Stored = { userId: number; scope: ChatScope };

export async function loadStoredScope(userId: number | null): Promise<ChatScope | null> {
  if (userId === null) return null;
  const stored = await appStorage.get<Stored>(StorageKeys.chatScope);
  if (!stored || stored.userId !== userId) return null;
  const scope = stored.scope;
  if (!scope || typeof scope !== 'object') return null;
  const kinds = ['all', 'brand', 'location', 'number'];
  if (!kinds.includes(scope.kind)) return null;
  return scope;
}

export async function saveStoredScope(userId: number | null, scope: ChatScope): Promise<void> {
  if (userId === null) return;
  if (scope.kind === 'all') {
    await appStorage.remove(StorageKeys.chatScope);
    return;
  }
  await appStorage.set<Stored>(StorageKeys.chatScope, { userId, scope });
}

export async function forgetStoredScope(): Promise<void> {
  await appStorage.remove(StorageKeys.chatScope);
}
