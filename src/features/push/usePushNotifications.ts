import { router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Alert, AppState, Platform } from 'react-native';

import { selectCurrentUser } from '@/features/auth/authSelectors';
import { checkChatBeforeOpening } from '@/features/messages';
import { liveSignalBus } from '@/features/realtime/liveSignalBus';
import { selectActiveConversationId } from '@/features/realtime/realtimeSlice';
import {
  obtainExpoPushToken,
  onNotificationOpened,
  onNotificationReceived,
  onPushTokenChanged,
  setForegroundPresentation,
  takeLaunchNotification,
  type PushData,
} from '@/services/push/pushNotifications';
import { registerSessionCleanup } from '@/services/session/sessionCleanup';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

import { forgetPushToken, registerPushToken } from './pushRegistration';
import { conversationIdFromPushData } from './pushTarget';

const platform = Platform.OS === 'ios' ? 'ios' : 'android';

const Copy = {
  goneTitle: 'This chat is no longer available',
  goneBody: 'It may have been reassigned, or your access to its number has changed.',
};

/**
 * Push notifications for the signed-in area (mounted below `BootstrapGate`):
 *
 * - asks for permission once the user is signed in, gets this phone's Expo push
 *   token and registers it (POST /me/devices); again if the token changes;
 * - opens the chat a tapped notification is about, including the one that
 *   launched the app from closed;
 * - while the app is open, does not show a banner for the chat on screen, and
 *   treats any arriving notification as a live signal so screens catch up.
 *
 * Unregistering happens in the sign-out thunk, before the session is revoked.
 */
export function usePushNotifications() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectCurrentUser);
  const activeConversationId = useAppSelector(selectActiveConversationId);
  const userId = typeof user?.id === 'number' ? user.id : null;

  // Read at notification time, so the handler is installed once.
  const activeRef = useRef(activeConversationId);
  useEffect(() => {
    activeRef.current = activeConversationId;
  }, [activeConversationId]);

  /**
   * CHAT-23: ask the server for the chat before opening it. The push was
   * composed before delivery, and the person's access can have changed since -
   * a 404 means this chat is not theirs to open any more, and nothing else is
   * opened in its place.
   */
  const openConversation = useCallback(
    async (data: PushData) => {
      const id = conversationIdFromPushData(data);
      if (!id) {
        router.navigate('/chats');
        return;
      }
      const outcome = await dispatch(checkChatBeforeOpening({ conversationId: id })).unwrap();
      if (outcome === 'gone') {
        Alert.alert(Copy.goneTitle, Copy.goneBody);
        return;
      }
      // 'unknown' is a network or server problem, which says nothing about
      // access: open the chat and let the thread report it where it belongs.
      router.push({ pathname: '/chats/[id]', params: { id } });
    },
    [dispatch],
  );

  useEffect(() => {
    setForegroundPresentation((data) => {
      const id = conversationIdFromPushData(data);
      const reading = AppState.currentState === 'active' && id !== null && id === activeRef.current;
      return !reading;
    });
    const stopReceived = onNotificationReceived((data) => {
      const id = conversationIdFromPushData(data);
      if (id) liveSignalBus.emit({ conversationId: Number(id), affectsLists: true });
      else liveSignalBus.emitEverything();
    });
    const stopOpened = onNotificationOpened((data) => void openConversation(data));
    const unregisterCleanup = registerSessionCleanup(forgetPushToken);

    void takeLaunchNotification().then((data) => {
      if (data) void openConversation(data);
    });

    return () => {
      stopReceived();
      stopOpened();
      unregisterCleanup();
      // Signed out: nothing may surface as a banner for the previous user.
      setForegroundPresentation(null);
    };
  }, [openConversation]);

  useEffect(() => {
    if (userId === null) return;
    let cancelled = false;

    const register = async (ask: boolean) => {
      const result = await obtainExpoPushToken({ ask });
      if (cancelled) return;
      if (result.status === 'token') {
        // Development only: the token lets anyone who has it send this phone a
        // notification, so it never reaches a release build's logs. Paste it into
        // https://expo.dev/notifications to test the phone side without the backend.
        if (__DEV__) console.log(`[push] Expo push token: ${result.token}`);
        const registered = await registerPushToken(result.token, userId, platform);
        if (__DEV__ && registered) console.log('[push] device registered with the server (POST /me/devices)');
      } else if (__DEV__ && result.status === 'denied') {
        console.log('[push] notification permission not granted; push is off for this device');
      } else if (__DEV__ && result.status === 'unconfigured') {
        console.warn('[push] no EAS project id - run `eas init` (or set EXPO_PUBLIC_EAS_PROJECT_ID); push is off');
      } else if (__DEV__ && result.status === 'failed') {
        console.warn(`[push] could not get a push token: ${result.reason}`);
      }
      // 'denied' is the user's choice; 'unavailable' was already reported once by the push service.
    };

    void register(true);
    const stopTokenListener = onPushTokenChanged(() => void register(false));
    return () => {
      cancelled = true;
      stopTokenListener();
    };
  }, [userId]);
}
