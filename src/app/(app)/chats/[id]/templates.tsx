import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { MessageLimits, Permissions, type MessageTemplate } from '@/api/types';
import { ChatSearchField, TemplateListItem } from '@/components/chat';
import { AppText, Button, Card, IconButton, Screen } from '@/components/common';
import { ListFooterLoader, SkeletonList, StateView } from '@/components/feedback';
import { TextField } from '@/components/forms';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { RequirePermission, usePermission } from '@/features/bootstrap';
import { sendTemplate } from '@/features/messages';
import {
  loadMoreTemplates,
  loadTemplates,
  parameterLabels,
  renderTemplateText,
  selectHasMoreTemplates,
  selectTemplateSearch,
  selectTemplates,
  selectTemplatesError,
  selectTemplatesStatus,
  templateSearchChanged,
  toParams,
  validateParameters,
  type TemplateParamError,
} from '@/features/templates';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

const SEARCH_DEBOUNCE_MS = 350;

const Copy = {
  title: 'Choose a template',
  back: 'Back',
  emptyTitle: 'No approved templates',
  emptyDescription: 'Templates are created and approved in the Wazigo dashboard.',
  noMatchTitle: 'No matching templates',
  noMatchDescription: 'Try a different search term.',
  offlineTitle: 'You are offline',
  offlineDescription: 'Please check your internet connection and try again.',
  failedTitle: 'We could not load your templates',
  retry: 'Retry',
  preview: 'Preview',
  header: 'Header',
  body: 'Message',
  send: 'Send template',
  changeTemplate: 'Choose a different template',
  noPermission: 'You do not have permission to send templates.',
};

const errorFor = (errors: TemplateParamError[], section: 'header' | 'body', index: number) =>
  errors.find((error) => error.section === section && error.index === index)?.message;

/** Step two: fill the variables, see what the customer will get, send it. */
function TemplateForm({
  template,
  conversationId,
  onBack,
}: {
  template: MessageTemplate;
  conversationId: string;
  onBack: () => void;
}) {
  const dispatch = useAppDispatch();
  const canSend = usePermission(Permissions.templatesSend);

  const headerLabels = useMemo(() => parameterLabels(template, 'header'), [template]);
  const bodyLabels = useMemo(() => parameterLabels(template, 'body'), [template]);

  const [headerValues, setHeaderValues] = useState<string[]>(() => headerLabels.map(() => ''));
  const [bodyValues, setBodyValues] = useState<string[]>(() => bodyLabels.map(() => ''));
  const [errors, setErrors] = useState<TemplateParamError[]>([]);

  const headerPreview = renderTemplateText(template.header_text, headerValues, headerLabels);
  const bodyPreview = renderTemplateText(template.body_text, bodyValues, bodyLabels);

  const update = (values: string[], index: number, value: string) =>
    values.map((current, position) => (position === index ? value : current));

  const submit = () => {
    const found = [
      ...validateParameters(headerValues, 'header'),
      ...validateParameters(bodyValues, 'body'),
    ];
    setErrors(found);
    if (found.length > 0) return;

    // Sent like any other message: the thread shows it pending, then sent or
    // failed, so this screen does not need to wait for the response.
    void dispatch(
      sendTemplate({
        conversationId,
        payload: {
          template_id: template.id,
          header_params: toParams(headerValues),
          body_params: toParams(bodyValues),
        },
        preview: bodyPreview || template.body_text?.trim() || '',
      }),
    );
    router.back();
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <AppText variant="h2">{template.name?.trim() || `Template ${template.id}`}</AppText>

        {headerLabels.map((label, index) => (
          <TextField
            key={`header-${label}-${index}`}
            label={`${Copy.header}: ${label}`}
            value={headerValues[index]}
            onChangeText={(value) => setHeaderValues((current) => update(current, index, value))}
            maxLength={MessageLimits.templateParamLengthMax}
            error={errorFor(errors, 'header', index)}
          />
        ))}

        {bodyLabels.map((label, index) => (
          <TextField
            key={`body-${label}-${index}`}
            label={label}
            value={bodyValues[index]}
            onChangeText={(value) => setBodyValues((current) => update(current, index, value))}
            maxLength={MessageLimits.templateParamLengthMax}
            error={errorFor(errors, 'body', index)}
          />
        ))}

        <Card tone="primarySoft">
          <AppText variant="overline" color="deepGreen">
            {Copy.preview}
          </AppText>
          {headerPreview ? (
            <AppText variant="title" style={styles.previewLine}>
              {headerPreview}
            </AppText>
          ) : null}
          <AppText variant="message" style={styles.previewLine}>
            {bodyPreview || template.body_text?.trim() || ''}
          </AppText>
        </Card>

        {canSend ? (
          <Button title={Copy.send} icon="send" onPress={submit} />
        ) : (
          <AppText variant="bodySmall" color="error" align="center">
            {Copy.noPermission}
          </AppText>
        )}

        <Button title={Copy.changeTemplate} variant="ghost" onPress={onBack} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TemplatesScreen({ conversationId }: { conversationId: string }) {
  const dispatch = useAppDispatch();
  const templates = useAppSelector(selectTemplates);
  const status = useAppSelector(selectTemplatesStatus);
  const error = useAppSelector(selectTemplatesError);
  const search = useAppSelector(selectTemplateSearch);
  const hasMore = useAppSelector(selectHasMoreTemplates);

  const [term, setTerm] = useState(search);
  const [selected, setSelected] = useState<MessageTemplate | null>(null);

  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed === search) return;
    const timer = setTimeout(() => dispatch(templateSearchChanged(trimmed)), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [dispatch, search, term]);

  useEffect(() => {
    void dispatch(loadTemplates());
  }, [dispatch, search]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/chats/[id]', params: { id: conversationId } });
  }, [conversationId]);

  const renderItem = useCallback(
    ({ item }: { item: MessageTemplate }) => <TemplateListItem template={item} onPress={setSelected} />,
    [],
  );

  const offline = !!error?.isOffline;
  const narrowed = search.length > 0;

  return (
    <Screen edges={['top', 'bottom']} padded={false}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" accessibilityLabel={Copy.back} onPress={goBack} />
        <AppText variant="h2" accessibilityRole="header" style={styles.headerTitle}>
          {selected ? Copy.title : Copy.title}
        </AppText>
      </View>

      {selected ? (
        <TemplateForm
          template={selected}
          conversationId={conversationId}
          onBack={() => setSelected(null)}
        />
      ) : status === 'loading' ? (
        <View style={styles.skeleton}>
          <SkeletonList rows={6} />
        </View>
      ) : status === 'failed' ? (
        <StateView
          icon={offline ? 'cloud-offline-outline' : 'alert-circle-outline'}
          tone={offline ? 'neutral' : 'error'}
          title={offline ? Copy.offlineTitle : Copy.failedTitle}
          description={offline ? Copy.offlineDescription : error?.message}
          actionLabel={Copy.retry}
          onAction={() => void dispatch(loadTemplates())}
        />
      ) : (
        <>
          <ChatSearchField value={term} onChangeText={setTerm} placeholder="Search templates" />
          <FlatList
            data={templates}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            ItemSeparatorComponent={Separator}
            contentContainerStyle={templates.length === 0 ? styles.emptyContent : styles.listContent}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            onEndReached={() => {
              if (hasMore) void dispatch(loadMoreTemplates());
            }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={<ListFooterLoader visible={status === 'loadingMore'} />}
            refreshControl={
              <RefreshControl
                refreshing={status === 'refreshing'}
                onRefresh={() => void dispatch(loadTemplates({ refresh: true }))}
                tintColor={Colors.primary}
                colors={[Colors.primary]}
              />
            }
            ListEmptyComponent={
              <StateView
                icon="duplicate-outline"
                tone="neutral"
                title={narrowed ? Copy.noMatchTitle : Copy.emptyTitle}
                description={narrowed ? Copy.noMatchDescription : Copy.emptyDescription}
              />
            }
          />
        </>
      )}
    </Screen>
  );
}

const Separator = () => <View style={styles.separator} />;

export default function TemplatesRoute() {
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

  return (
    <RequirePermission permission={Permissions.templatesView}>
      <TemplatesScreen conversationId={String(id)} />
    </RequirePermission>
  );
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
  headerTitle: { flex: 1 },
  skeleton: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.sm },
  listContent: { paddingBottom: Spacing.xxl },
  emptyContent: { flexGrow: 1 },
  form: {
    padding: Layout.screenPadding,
    paddingBottom: Spacing.huge,
    gap: Spacing.lg,
  },
  previewLine: { marginTop: Spacing.sm },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
    marginLeft: Layout.screenPadding,
  },
});
