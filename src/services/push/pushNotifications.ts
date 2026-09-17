/**
 * The ONLY module allowed to use expo-notifications (ESLint-enforced).
 *
 * Push uses Expo push tokens: one token and one service (Expo) delivers to both
 * Android (FCM) and iOS (APNs), so the backend talks to one place. The FCM
 * service-account key and the APNs .p8 key live in the EAS project's
 * credentials, never in this repo or the app bundle.
 *
 * Remote push needs a development or store build; Expo Go cannot receive it.
 *
 * LOADED ONLY WHEN ITS NATIVE CODE IS PRESENT. expo-notifications looks up its
 * native modules the moment it is imported, and throws when they are missing -
 * a development build made before this package was added, or Expo Go. That
 * crashed the whole signed-in area on 2026-09-17. So the package is required
 * lazily, behind a check, and push quietly reports `unavailable` instead: the
 * app works without push, never the other way round.
 */
import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { Config } from '@/constants/config';

type NotificationsApi = typeof import('expo-notifications');
type Notification = import('expo-notifications').Notification;
type PermissionsStatus = import('expo-notifications').NotificationPermissionsStatus;

let notifications: NotificationsApi | null | undefined;

/** The expo-notifications API, or null when this build has no native push support. */
function api(): NotificationsApi | null {
  if (notifications !== undefined) return notifications;
  try {
    notifications = requireOptionalNativeModule('ExpoPushTokenManager')
      ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberately lazy, see the header
        (require('expo-notifications') as NotificationsApi)
      : null;
  } catch {
    notifications = null;
  }
  if (!notifications && __DEV__) {
    console.warn('[push] expo-notifications is not in this build - rebuild it (npx expo run:android). Push is off.');
  }
  return notifications;
}

/** Android channel for new-message alerts. The backend should send `channelId: "messages"`. */
export const MESSAGES_CHANNEL_ID = 'messages';

export type PushData = Record<string, unknown>;

export type PushTokenResult =
  | { status: 'token'; token: string }
  /** The user said no (or has not been asked and `ask` was false). */
  | { status: 'denied' }
  /** No EAS project id: run `eas init`, or set EXPO_PUBLIC_EAS_PROJECT_ID. */
  | { status: 'unconfigured' }
  /** This build has no native push support (old development build, Expo Go). */
  | { status: 'unavailable' }
  | { status: 'failed'; reason: string };

const noop = () => undefined;

const dataOf = (notification: Notification | null | undefined): PushData =>
  (notification?.request?.content?.data as PushData | undefined) ?? {};

const projectId = (): string => {
  const fromConfig = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  return fromConfig || Constants.easConfig?.projectId || Config.easProjectId || '';
};

/** Must exist before the permission prompt on Android 13+, and before any token. */
export async function ensureMessagesChannel(): Promise<void> {
  const N = api();
  if (!N || Platform.OS !== 'android') return;
  await N.setNotificationChannelAsync(MESSAGES_CHANNEL_ID, {
    name: 'New messages',
    description: 'Customer messages in your chats',
    importance: N.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#08B74F',
  });
}

/**
 * The Expo push token for this device, asking for permission first when `ask`
 * is true. Never throws: push is an extra, and signing in must not depend on it.
 */
export async function obtainExpoPushToken({ ask }: { ask: boolean }): Promise<PushTokenResult> {
  const N = api();
  if (!N) return { status: 'unavailable' };
  try {
    await ensureMessagesChannel();

    const isGranted = (settings: PermissionsStatus) =>
      settings.granted || settings.ios?.status === N.IosAuthorizationStatus.PROVISIONAL;

    let settings = await N.getPermissionsAsync();
    if (!isGranted(settings) && ask && settings.canAskAgain !== false) {
      settings = await N.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
    }
    if (!isGranted(settings)) return { status: 'denied' };

    const id = projectId();
    if (!id) return { status: 'unconfigured' };

    const { data } = await N.getExpoPushTokenAsync({ projectId: id });
    return data ? { status: 'token', token: data } : { status: 'failed', reason: 'empty token' };
  } catch (error) {
    return { status: 'failed', reason: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * How a notification behaves while the app is open. `shouldShow` gets the
 * notification's data and decides whether a banner appears (e.g. not for the
 * chat the user is already reading).
 */
export function setForegroundPresentation(shouldShow: ((data: PushData) => boolean) | null): void {
  const N = api();
  if (!N) return;
  if (!shouldShow) {
    N.setNotificationHandler(null);
    return;
  }
  N.setNotificationHandler({
    handleNotification: async (notification) => {
      const show = shouldShow(dataOf(notification));
      return {
        shouldShowBanner: show,
        shouldShowList: show,
        shouldPlaySound: show,
        shouldSetBadge: false,
      };
    },
  });
}

/** The OS may rotate the device token; Expo then issues a new push token. */
export function onPushTokenChanged(listener: () => void): () => void {
  const N = api();
  if (!N) return noop;
  const subscription = N.addPushTokenListener(() => listener());
  return () => subscription.remove();
}

/** A notification arrived while the app was running. */
export function onNotificationReceived(listener: (data: PushData) => void): () => void {
  const N = api();
  if (!N) return noop;
  const subscription = N.addNotificationReceivedListener((notification) => listener(dataOf(notification)));
  return () => subscription.remove();
}

/** The user tapped a notification (app running or in the background). */
export function onNotificationOpened(listener: (data: PushData) => void): () => void {
  const N = api();
  if (!N) return noop;
  const subscription = N.addNotificationResponseReceivedListener((response) => {
    if (response.actionIdentifier === N.DEFAULT_ACTION_IDENTIFIER) {
      listener(dataOf(response.notification));
    }
  });
  return () => subscription.remove();
}

/**
 * The notification that launched the app from closed, if any - returned once,
 * then cleared, so it cannot reopen a chat on the next sign-in.
 */
export async function takeLaunchNotification(): Promise<PushData | null> {
  const N = api();
  if (!N) return null;
  try {
    const response = N.getLastNotificationResponse();
    if (!response || response.actionIdentifier !== N.DEFAULT_ACTION_IDENTIFIER) return null;
    await N.clearLastNotificationResponseAsync();
    return dataOf(response.notification);
  } catch {
    return null;
  }
}
