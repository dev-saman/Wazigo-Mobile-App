/**
 * Opening the support links. The app sends nothing on WhatsApp by itself: it
 * hands the link to the system and the customer presses send.
 */
import * as Linking from 'expo-linking';

/**
 * Opens the server's `chat_url` verbatim. WhatsApp takes the link and opens the
 * chat with the message already typed; a phone without WhatsApp opens the same
 * `wa.me` link in its browser, which is why no `canOpenURL` check is needed.
 *
 * Returns false when the phone could not open it at all - the caller then shows
 * the support email instead, rather than leaving a dead button.
 */
export async function openSupportChat(url: string | null): Promise<boolean> {
  if (!url) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch (error) {
    if (__DEV__) console.warn('[support] could not open the support chat link', error);
    return false;
  }
}

/** The support email, opened in whatever mail app the phone has. */
export async function openSupportEmail(email: string | null): Promise<boolean> {
  if (!email) return false;
  try {
    await Linking.openURL(`mailto:${email}`);
    return true;
  } catch (error) {
    if (__DEV__) console.warn('[support] could not open the mail app', error);
    return false;
  }
}
