import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { CONTACT_NOTE_MAX_LENGTH, type ContactNote } from '@/api/types';
import { ContactNoteRow } from '@/components/chat';
import { AppText, Button, IconButton, Screen } from '@/components/common';
import { ErrorState, SkeletonList, StaleDataBanner, StateView } from '@/components/feedback';
import { Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import { selectIsOffline } from '@/features/connectivity/connectivitySlice';
import {
  addContactNote,
  contactNotesClosed,
  loadContactNotes,
  selectContactNoteSaveError,
  selectContactNoteSaving,
  selectContactNotes,
  selectContactNotesError,
  selectContactNotesStatus,
} from '@/features/contactNotes';
import { selectThreadConversation } from '@/features/messages';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { traceWriteIntent } from '@/utils/devTrace';

/** Warn before the limit rather than at it, as the message composer does. */
const COUNTER_FROM = CONTACT_NOTE_MAX_LENGTH - 200;
const MAX_INPUT_HEIGHT = 120;

const Copy = {
  title: 'Notes',
  back: 'Back',
  internal: 'Internal only — the customer never sees these.',
  placeholder: 'Add a note',
  add: 'Add note',
  emptyTitle: 'No notes yet',
  emptyDescription: 'Notes are for your team. The customer never sees them.',
  failedTitle: 'We could not load these notes',
  retryLabel: 'Retry loading these notes',
  stale: 'Showing the notes we already loaded',
  offline: 'You need an internet connection to add a note.',
  saveFailed: 'That note was not saved. Try again.',
};

function NotesScreen({ conversationId }: { conversationId: string }) {
  const dispatch = useAppDispatch();
  const conversation = useAppSelector(selectThreadConversation(conversationId));
  const notes = useAppSelector(selectContactNotes);
  const status = useAppSelector(selectContactNotesStatus);
  const error = useAppSelector(selectContactNotesError);
  const saving = useAppSelector(selectContactNoteSaving);
  const saveError = useAppSelector(selectContactNoteSaveError);
  const offline = useAppSelector(selectIsOffline);

  const contactId = typeof conversation?.contact?.id === 'number' ? conversation.contact.id : null;
  const [draft, setDraft] = useState('');
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (contactId === null) return;
    void dispatch(loadContactNotes({ contactId }));
  }, [contactId, dispatch]);

  // Notes belong to the conversation being read; leaving drops them rather than
  // holding another contact's internal notes in memory.
  useEffect(() => () => void dispatch(contactNotesClosed()), [dispatch]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/chats/[id]', params: { id: conversationId } });
  }, [conversationId]);

  const body = draft.trim();
  const tooLong = body.length > CONTACT_NOTE_MAX_LENGTH;
  const canSave = body.length > 0 && !tooLong && !saving && !offline && contactId !== null;

  const submit = () => {
    if (!canSave || contactId === null) return;
    traceWriteIntent('contact note add pressed', { conversationId, contactId });
    void dispatch(addContactNote({ contactId, body }))
      .unwrap()
      // Only clear on success: a rejected note stays in the box to be retried.
      .then(() => setDraft(''))
      .catch(() => undefined);
  };

  const renderItem = useCallback(
    ({ item }: { item: ContactNote }) => <ContactNoteRow note={item} />,
    [],
  );

  if (contactId === null) {
    return (
      <Screen>
        <StateView
          icon="person-circle-outline"
          tone="neutral"
          title="Contact unavailable"
          description="Open the conversation again to see its notes."
          actionLabel="Back"
          onAction={goBack}
        />
      </Screen>
    );
  }

  const inputHeight =
    draft.length === 0 ? Layout.minTouch : Math.min(MAX_INPUT_HEIGHT, Math.max(Layout.minTouch, height));

  return (
    <Screen edges={['top', 'bottom']} padded={false}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" accessibilityLabel={Copy.back} onPress={goBack} />
        <View style={styles.headerText}>
          <AppText variant="h2" accessibilityRole="header">
            {Copy.title}
          </AppText>
          {conversation?.contact?.name ? (
            <AppText variant="caption" color="textSecondary" numberOfLines={1}>
              {conversation.contact.name}
            </AppText>
          ) : null}
        </View>
      </View>

      <AppText variant="caption" color="textMuted" style={styles.internal}>
        {Copy.internal}
      </AppText>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {status === 'loading' ? (
          <View style={styles.skeleton}>
            <SkeletonList rows={4} avatar={false} label="Loading notes" />
          </View>
        ) : status === 'failed' ? (
          <ErrorState
            error={error}
            title={Copy.failedTitle}
            onRetry={() => void dispatch(loadContactNotes({ contactId }))}
            retryAccessibilityLabel={Copy.retryLabel}
          />
        ) : (
          <>
            <View style={styles.stale}>
              <StaleDataBanner error={error} title={Copy.stale} />
            </View>
            <FlatList
              data={notes}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderItem}
              ItemSeparatorComponent={Separator}
              contentContainerStyle={notes.length === 0 ? styles.emptyContent : styles.listContent}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl
                  refreshing={status === 'refreshing'}
                  onRefresh={() => void dispatch(loadContactNotes({ contactId, refresh: true }))}
                  tintColor={Colors.primary}
                  colors={[Colors.primary]}
                />
              }
              ListEmptyComponent={
                <StateView
                  icon="document-text-outline"
                  tone="neutral"
                  title={Copy.emptyTitle}
                  description={Copy.emptyDescription}
                />
              }
            />
          </>
        )}

        <View style={styles.composer}>
          {body.length >= COUNTER_FROM ? (
            <AppText variant="caption" color={tooLong ? 'error' : 'textMuted'} style={styles.counter}>
              {`${body.length} / ${CONTACT_NOTE_MAX_LENGTH}`}
            </AppText>
          ) : null}

          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={Copy.placeholder}
            placeholderTextColor={Colors.textPlaceholder}
            multiline
            editable={!saving}
            accessibilityLabel={Copy.placeholder}
            onContentSizeChange={(event) => setHeight(event.nativeEvent.contentSize.height)}
            style={[styles.input, { height: inputHeight }, tooLong && styles.inputError]}
          />

          {saveError ? (
            <AppText variant="caption" color="error">
              {saveError.message || Copy.saveFailed}
            </AppText>
          ) : null}
          {offline ? (
            <AppText variant="caption" color="textMuted">
              {Copy.offline}
            </AppText>
          ) : null}

          <Button
            title={Copy.add}
            icon="add"
            onPress={submit}
            disabled={!canSave}
            loading={saving}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const Separator = () => <View style={styles.separator} />;

export default function NotesRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return (
      <Screen>
        <StateView
          icon="help-circle-outline"
          tone="neutral"
          title="Conversation unavailable"
          description="This conversation is no longer available."
          actionLabel="Back to chats"
          onAction={() => router.replace('/chats')}
        />
      </Screen>
    );
  }

  return <NotesScreen conversationId={String(id)} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingRight: Layout.screenPadding,
    paddingVertical: Spacing.sm,
  },
  headerText: { flex: 1 },
  internal: { paddingHorizontal: Layout.screenPadding, paddingBottom: Spacing.sm },
  skeleton: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.sm },
  stale: { paddingHorizontal: Layout.screenPadding },
  listContent: { paddingBottom: Spacing.lg },
  emptyContent: { flexGrow: 1 },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
    marginLeft: Layout.screenPadding,
  },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    padding: Layout.screenPadding,
    gap: Spacing.sm,
  },
  counter: { textAlign: 'right' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: Typography.body.fontSize,
    textAlignVertical: 'top',
  },
  inputError: { borderColor: Colors.error },
});
