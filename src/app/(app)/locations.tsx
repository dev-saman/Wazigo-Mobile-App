import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import {
  OrgLimits,
  Permissions,
  type Business,
  type CreateLocationPayload,
  type MappingPreview,
  type OrgLocation,
  type OrgWorkspace,
} from '@/api/types';
import { AppText, Button, IconButton, Screen, Sheet, SheetAction } from '@/components/common';
import { ErrorState, SkeletonList, StateView } from '@/components/feedback';
import { TextField } from '@/components/forms';
import { BrandCard } from '@/components/org';
import { Colors, Layout, Spacing } from '@/constants/theme';
import {
  selectBrandWord,
  selectBusinesses,
  selectLocations,
  selectNumbers,
  usePermission,
} from '@/features/bootstrap';
import { selectIsOffline } from '@/features/connectivity/connectivitySlice';
import {
  chooseNumberClient,
  createBusiness,
  createLocation,
  loadBusinessMembers,
  loadStructure,
  membersClosed,
  orgErrorText,
  previewNumberMapping,
  renameBusiness,
  replaceBusinessMembers,
  saveNumberMapping,
  selectOrgBusyKey,
  selectOrgError,
  selectOrgMembers,
  selectOrgMembersStatus,
  selectOrgStatus,
  selectStructure,
  setBusinessArchived,
  setLocationArchived,
  updateLocation,
  validateLocation,
} from '@/features/org';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { traceWriteIntent } from '@/utils/devTrace';

const Copy = {
  title: 'Locations & numbers',
  back: 'Back',
  failedTitle: 'Could not load your locations and numbers',
  retryLabel: 'Retry loading the structure',
  readOnlyTitle: 'Read only',
  readOnlyBody:
    'Your account can see which brands and branches exist, but changing them is done by an administrator.',
  emptyTitle: 'Nothing to show yet',
  emptyBody: 'No brands, branches or numbers have been set up for this account.',
  offline: 'You are offline.',
  pending: 'Waiting for a brand',
  pendingBody: 'Nothing can be sent from these numbers until they belong to a brand.',
  addBrand: (word: string) => `Add a ${word.toLowerCase()}`,
  rename: 'Rename',
  name: 'Name',
  save: 'Save',
  branchName: 'Branch name',
  address1: 'Address',
  address2: 'Address line 2',
  city: 'City',
  state: 'State',
  pincode: 'Pincode',
  serviceArea: 'Area it serves',
  addBranchTitle: 'Add a branch',
  editBranchTitle: 'Edit branch',
  archiveBranch: 'Archive this branch',
  restoreBranch: 'Restore this branch',
  membersTitle: 'Who works on it',
  membersAccountWide: 'Sees every brand already',
  membersSave: 'Save who works on it',
  mappingTitle: 'Which branches does it serve?',
  mappingWhole: 'The whole brand',
  mappingCheck: 'Check what changes',
  mappingSave: 'Save',
  mappingKept: 'Chats are kept and the number is not reconnected.',
  chooseTitle: 'Which brand is this number for?',
  chooseNew: 'A new brand',
  chooseReason: 'Why (for the record)',
  chooseSave: 'Finish this number',
  confirmArchive: 'Archive this?',
  confirmArchiveBody: 'It stays on the account and can be restored later.',
  cancel: 'Cancel',
  archive: 'Archive',
};

type OpenSheet =
  | { kind: 'none' }
  | { kind: 'renameBrand'; business: Business }
  | { kind: 'addBrand' }
  | { kind: 'members'; business: Business }
  | { kind: 'addLocation'; business: Business }
  | { kind: 'editLocation'; location: OrgLocation }
  | { kind: 'mapping'; workspace: OrgWorkspace }
  | { kind: 'chooseClient'; workspace: OrgWorkspace };

const emptyLocation: CreateLocationPayload = { name: '' };

function LocationsScreen() {
  const dispatch = useAppDispatch();
  const offline = useAppSelector(selectIsOffline);
  const structure = useAppSelector(selectStructure);
  const status = useAppSelector(selectOrgStatus);
  const error = useAppSelector(selectOrgError);
  const busyKey = useAppSelector(selectOrgBusyKey);
  const members = useAppSelector(selectOrgMembers);
  const membersStatus = useAppSelector(selectOrgMembersStatus);
  const brandWord = useAppSelector(selectBrandWord);

  // ORG-02 denies an Agent outright; these are what bootstrap already gave.
  const fallbackBusinesses = useAppSelector(selectBusinesses);
  const fallbackLocations = useAppSelector(selectLocations);
  const fallbackNumbers = useAppSelector(selectNumbers);

  const canManageLocations = usePermission(Permissions.locationsManage);
  const canManageBrand = usePermission(Permissions.businessesManage);
  const canManageMembers = usePermission(Permissions.businessesMembers);
  const canManageMapping = usePermission(Permissions.mappingManage);
  const canChooseClient = usePermission(Permissions.whatsappManage);

  const [sheet, setSheet] = useState<OpenSheet>({ kind: 'none' });
  const [name, setName] = useState('');
  const [location, setLocation] = useState<CreateLocationPayload>(emptyLocation);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  /**
   * ORG-08 is a full replacement, so the list starts as whoever is on it and
   * is then edited freely - including down to nobody, which is why this is
   * null-until-loaded rather than "empty means unchanged".
   */
  const [memberIds, setMemberIds] = useState<number[] | null>(null);
  const [preview, setPreview] = useState<MappingPreview | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    void dispatch(loadStructure());
  }, [dispatch]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  }, []);

  const closeSheet = useCallback(() => {
    setSheet({ kind: 'none' });
    setName('');
    setLocation(emptyLocation);
    setFormError(null);
    setSelectedIds([]);
    setMemberIds(null);
    setPreview(null);
    setReason('');
    dispatch(membersClosed());
  }, [dispatch]);

  const serverError = orgErrorText(error);

  const businesses = structure?.businesses ?? [];
  const locationsOf = useCallback(
    (businessId: number) =>
      (structure?.locations ?? []).filter((item) => item.business_id === businessId),
    [structure],
  );
  const workspacesOf = useCallback(
    (businessId: number) =>
      (structure?.workspaces ?? []).filter((item) => item.business_id === businessId),
    [structure],
  );
  const pending = useMemo(
    () => (structure?.workspaces ?? []).filter((item) => item.business_id == null),
    [structure],
  );

  // --- actions ---------------------------------------------------------------

  const onRenameBrand = useCallback(() => {
    if (sheet.kind !== 'renameBrand') return;
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > OrgLimits.nameMax) {
      setFormError(`A name is 1 to ${OrgLimits.nameMax} characters.`);
      return;
    }
    traceWriteIntent('brand rename', { businessId: sheet.business.id });
    void dispatch(
      renameBusiness({
        businessId: sheet.business.id,
        name: trimmed,
        expectedVersion: sheet.business.version,
      }),
    )
      .unwrap()
      .then(closeSheet)
      .catch(() => undefined);
  }, [closeSheet, dispatch, name, sheet]);

  const onAddBrand = useCallback(() => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setFormError('Give it a name.');
      return;
    }
    traceWriteIntent('brand create', { name: trimmed });
    void dispatch(createBusiness({ name: trimmed }))
      .unwrap()
      .then(closeSheet)
      .catch(() => undefined);
  }, [closeSheet, dispatch, name]);

  const onArchiveBrand = useCallback(
    (business: Business) => {
      const archived = business.status === 'archived';
      // ORG-06 is refused while the brand still owns a live number, so the
      // server's own refusal is what the person sees - the app never guesses.
      const run = () => {
        traceWriteIntent('brand archive', { businessId: business.id, archived: !archived });
        void dispatch(
          setBusinessArchived({
            businessId: business.id,
            archived: !archived,
            expectedVersion: business.version,
          }),
        )
          .unwrap()
          .catch(() => undefined);
      };
      if (archived) {
        run();
        return;
      }
      Alert.alert(Copy.confirmArchive, Copy.confirmArchiveBody, [
        { text: Copy.cancel, style: 'cancel' },
        { text: Copy.archive, style: 'destructive', onPress: run },
      ]);
    },
    [dispatch],
  );

  const onSaveLocation = useCallback(() => {
    const problem = validateLocation(location);
    if (problem) {
      setFormError(problem);
      return;
    }
    if (sheet.kind === 'addLocation') {
      traceWriteIntent('branch create', { businessId: sheet.business.id });
      void dispatch(createLocation({ businessId: sheet.business.id, payload: location }))
        .unwrap()
        .then(closeSheet)
        .catch(() => undefined);
      return;
    }
    if (sheet.kind === 'editLocation') {
      traceWriteIntent('branch update', { locationId: sheet.location.id });
      void dispatch(
        updateLocation({
          locationId: sheet.location.id,
          payload: { ...location, expected_version: sheet.location.version },
        }),
      )
        .unwrap()
        .then(closeSheet)
        .catch(() => undefined);
    }
  }, [closeSheet, dispatch, location, sheet]);

  const onArchiveLocation = useCallback(() => {
    if (sheet.kind !== 'editLocation') return;
    const archived = sheet.location.status === 'archived';
    traceWriteIntent('branch archive', { locationId: sheet.location.id, archived: !archived });
    void dispatch(
      setLocationArchived({
        locationId: sheet.location.id,
        archived: !archived,
        expectedVersion: sheet.location.version,
      }),
    )
      .unwrap()
      .then(closeSheet)
      .catch(() => undefined);
  }, [closeSheet, dispatch, sheet]);

  const onPreviewMapping = useCallback(() => {
    if (sheet.kind !== 'mapping') return;
    void dispatch(
      previewNumberMapping({ numberId: sheet.workspace.id, locationIds: selectedIds }),
    )
      .unwrap()
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [dispatch, selectedIds, sheet]);

  const onSaveMapping = useCallback(() => {
    if (sheet.kind !== 'mapping') return;
    traceWriteIntent('number mapping save', { numberId: sheet.workspace.id });
    void dispatch(
      saveNumberMapping({
        numberId: sheet.workspace.id,
        locationIds: selectedIds,
        expectedVersion: sheet.workspace.mapping_version ?? 0,
      }),
    )
      .unwrap()
      .then(closeSheet)
      .catch(() => undefined);
  }, [closeSheet, dispatch, selectedIds, sheet]);

  const onChooseClient = useCallback(
    (businessId: number | null) => {
      if (sheet.kind !== 'chooseClient') return;
      const trimmed = reason.trim();
      if (
        trimmed.length < OrgLimits.chooseClientReasonMin ||
        trimmed.length > OrgLimits.chooseClientReasonMax
      ) {
        setFormError(`Say why, in at least ${OrgLimits.chooseClientReasonMin} characters.`);
        return;
      }
      const newName = name.trim();
      if (businessId === null && newName.length === 0) {
        setFormError('Name the new brand.');
        return;
      }
      traceWriteIntent('number client chosen', { numberId: sheet.workspace.id, businessId });
      void dispatch(
        chooseNumberClient({
          numberId: sheet.workspace.id,
          payload: {
            expected_version: sheet.workspace.mapping_version ?? 0,
            reason: trimmed,
            ...(businessId === null ? { new_client_name: newName } : { business_id: businessId }),
          },
        }),
      )
        .unwrap()
        .then(closeSheet)
        .catch(() => undefined);
    },
    [closeSheet, dispatch, name, reason, sheet],
  );

  // --- render ----------------------------------------------------------------

  const denied = status === 'denied';
  const busy = status === 'loading';
  const failed = status === 'failed';

  const header = (
    <View style={styles.header}>
      <IconButton icon="arrow-back" accessibilityLabel={Copy.back} onPress={goBack} />
      <AppText variant="h2" accessibilityRole="header" style={styles.headerTitle}>
        {Copy.title}
      </AppText>
    </View>
  );

  if (busy) {
    return (
      <Screen edges={['top']} padded={false}>
        {header}
        <View style={styles.skeleton}>
          <SkeletonList rows={4} label="Loading your locations and numbers" />
        </View>
      </Screen>
    );
  }

  if (failed) {
    return (
      <Screen edges={['top']} padded={false}>
        {header}
        <ErrorState
          error={error}
          title={Copy.failedTitle}
          onRetry={() => void dispatch(loadStructure())}
          retryAccessibilityLabel={Copy.retryLabel}
        />
      </Screen>
    );
  }

  // ORG-02: an Agent may not read the structure, so what bootstrap listed is
  // shown instead - the same names, without anything to change.
  if (denied) {
    return (
      <Screen edges={['top']} padded={false}>
        {header}
        <ScrollView contentContainerStyle={styles.content}>
          <AppText variant="bodySmall" color="textSecondary" style={styles.notice}>
            {Copy.readOnlyBody}
          </AppText>
          {fallbackBusinesses.map((business) => (
            <View key={business.id} style={styles.readOnlyCard}>
              <AppText variant="sectionTitle">{business.name}</AppText>
              {fallbackLocations
                .filter((item) => item.business_id === business.id)
                .map((item) => (
                  <AppText key={item.id} variant="bodySmall" color="textSecondary">
                    {item.name}
                  </AppText>
                ))}
              {fallbackNumbers
                .filter((item) => item.business_id === business.id)
                .map((item) => (
                  <AppText key={item.id} variant="bodySmall" color="textSecondary">
                    {item.display_label || item.label || item.display_phone_number}
                  </AppText>
                ))}
            </View>
          ))}
        </ScrollView>
      </Screen>
    );
  }

  const nothing = businesses.length === 0 && pending.length === 0;

  return (
    <Screen edges={['top']} padded={false}>
      {header}

      {serverError ? (
        <AppText variant="caption" color="error" style={styles.notice}>
          {serverError}
        </AppText>
      ) : null}

      {nothing ? (
        <StateView icon="business-outline" title={Copy.emptyTitle} description={Copy.emptyBody} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* ORG-14: nothing can be sent from these until someone answers. */}
          {pending.length > 0 ? (
            <View style={styles.pending}>
              <AppText variant="sectionTitle">{Copy.pending}</AppText>
              <AppText variant="caption" color="textSecondary">
                {Copy.pendingBody}
              </AppText>
              {pending.map((workspace) => (
                <SheetAction
                  key={workspace.id}
                  icon="alert-circle-outline"
                  label={
                    workspace.display_label || workspace.label || workspace.display_phone_number || ''
                  }
                  description={workspace.display_phone_number ?? undefined}
                  disabled={!canChooseClient || offline}
                  onPress={() => {
                    setFormError(null);
                    setSheet({ kind: 'chooseClient', workspace });
                  }}
                />
              ))}
            </View>
          ) : null}

          {businesses.map((business) => (
            <BrandCard
              key={business.id}
              business={business}
              locations={locationsOf(business.id)}
              workspaces={workspacesOf(business.id)}
              brandWord={brandWord}
              busyKey={busyKey}
              canManageLocations={canManageLocations && !offline}
              canManageBrand={canManageBrand && !offline}
              canManageMembers={canManageMembers && !offline}
              canManageMapping={canManageMapping && !offline}
              onRename={(target) => {
                setName(target.name);
                setFormError(null);
                setSheet({ kind: 'renameBrand', business: target });
              }}
              onArchive={onArchiveBrand}
              onMembers={(target) => {
                setSheet({ kind: 'members', business: target });
                void dispatch(loadBusinessMembers({ businessId: target.id }));
              }}
              onAddLocation={(target) => {
                setLocation(emptyLocation);
                setFormError(null);
                setSheet({ kind: 'addLocation', business: target });
              }}
              onEditLocation={(target) => {
                setLocation({
                  name: target.name,
                  address_line1: target.address_line1 ?? undefined,
                  address_line2: target.address_line2 ?? undefined,
                  city: target.city ?? undefined,
                  state: target.state ?? undefined,
                  pincode: target.pincode ?? undefined,
                  service_area: target.service_area ?? undefined,
                });
                setFormError(null);
                setSheet({ kind: 'editLocation', location: target });
              }}
              onMapNumber={(workspace) => {
                setSelectedIds(workspace.location_ids ?? []);
                setPreview(null);
                setFormError(null);
                setSheet({ kind: 'mapping', workspace });
              }}
            />
          ))}

          {/* ORG-05 is agency-only; a business account answers 422, so the
              button is drawn from the permission rather than offered blindly. */}
          {canManageBrand ? (
            <View style={styles.footer}>
              <Button
                title={Copy.addBrand(brandWord)}
                icon="add"
                fullWidth
                disabled={offline}
                onPress={() => {
                  setName('');
                  setFormError(null);
                  setSheet({ kind: 'addBrand' });
                }}
              />
              {offline ? (
                <AppText variant="caption" color="textSecondary">
                  {Copy.offline}
                </AppText>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* --- sheets --- */}

      <Sheet
        visible={sheet.kind === 'renameBrand' || sheet.kind === 'addBrand'}
        title={sheet.kind === 'addBrand' ? Copy.addBrand(brandWord) : Copy.rename}
        onClose={closeSheet}
        notice={offline ? Copy.offline : undefined}
      >
        <View style={styles.form}>
          <TextField
            label={Copy.name}
            value={name}
            onChangeText={setName}
            maxLength={OrgLimits.nameMax}
            error={formError ?? serverError ?? undefined}
          />
          <Button
            title={Copy.save}
            fullWidth
            disabled={offline || busyKey !== null}
            loading={busyKey !== null}
            onPress={sheet.kind === 'addBrand' ? onAddBrand : onRenameBrand}
          />
        </View>
      </Sheet>

      <Sheet
        visible={sheet.kind === 'addLocation' || sheet.kind === 'editLocation'}
        title={sheet.kind === 'editLocation' ? Copy.editBranchTitle : Copy.addBranchTitle}
        onClose={closeSheet}
        notice={offline ? Copy.offline : undefined}
      >
        <View style={styles.form}>
          <TextField
            label={Copy.branchName}
            value={location.name}
            onChangeText={(value) => setLocation((current) => ({ ...current, name: value }))}
            maxLength={OrgLimits.nameMax}
          />
          <TextField
            label={Copy.address1}
            value={location.address_line1 ?? ''}
            onChangeText={(value) =>
              setLocation((current) => ({ ...current, address_line1: value }))
            }
            maxLength={OrgLimits.addressLineMax}
          />
          <TextField
            label={Copy.city}
            value={location.city ?? ''}
            onChangeText={(value) => setLocation((current) => ({ ...current, city: value }))}
            maxLength={OrgLimits.cityStateMax}
          />
          <TextField
            label={Copy.pincode}
            value={location.pincode ?? ''}
            onChangeText={(value) => setLocation((current) => ({ ...current, pincode: value }))}
            keyboardType="number-pad"
            maxLength={OrgLimits.pincodeDigits}
            error={formError ?? serverError ?? undefined}
          />
          <Button
            title={Copy.save}
            fullWidth
            disabled={offline || busyKey !== null}
            loading={busyKey !== null}
            onPress={onSaveLocation}
          />
          {sheet.kind === 'editLocation' ? (
            <SheetAction
              icon={sheet.location.status === 'archived' ? 'refresh-outline' : 'archive-outline'}
              label={
                sheet.location.status === 'archived' ? Copy.restoreBranch : Copy.archiveBranch
              }
              tone={sheet.location.status === 'archived' ? 'default' : 'danger'}
              disabled={offline || busyKey !== null}
              onPress={onArchiveLocation}
            />
          ) : null}
        </View>
      </Sheet>

      {/* ORG-07 / ORG-08: a full replacement, so the list starts from who is
          already on it and the account-wide people are shown but untouchable. */}
      <Sheet visible={sheet.kind === 'members'} title={Copy.membersTitle} onClose={closeSheet}>
        {membersStatus === 'loading' || !members ? (
          <View style={styles.skeleton}>
            <SkeletonList rows={3} label="Loading who works on this brand" />
          </View>
        ) : (
          <View style={styles.form}>
            {members.account_wide.map((person) => (
              <SheetAction
                key={`wide:${person.user_id}`}
                icon="shield-checkmark-outline"
                label={person.name}
                description={Copy.membersAccountWide}
                disabled
                onPress={() => undefined}
              />
            ))}
            {[...members.members, ...members.candidates].map((person) => {
              const on = members.members.some((item) => item.user_id === person.user_id);
              const chosen = memberIds ?? members.members.map((m) => m.user_id);
              const selected = chosen.includes(person.user_id);
              return (
                <SheetAction
                  key={person.user_id}
                  icon="person-outline"
                  label={person.name}
                  selected={selected}
                  disabled={offline || busyKey !== null}
                  onPress={() =>
                    setMemberIds(
                      selected
                        ? chosen.filter((id) => id !== person.user_id)
                        : [...chosen, person.user_id],
                    )
                  }
                  description={on ? undefined : 'Not on it yet'}
                />
              );
            })}
            {serverError ? (
              <AppText variant="caption" color="error">
                {serverError}
              </AppText>
            ) : null}
            <Button
              title={Copy.membersSave}
              fullWidth
              disabled={offline || busyKey !== null}
              loading={busyKey !== null}
              onPress={() => {
                if (sheet.kind !== 'members' || !members) return;
                const userIds = memberIds ?? members.members.map((m) => m.user_id);
                traceWriteIntent('brand members replace', { businessId: sheet.business.id });
                void dispatch(
                  replaceBusinessMembers({
                    businessId: sheet.business.id,
                    userIds,
                    expectedVersion: members.version,
                  }),
                )
                  .unwrap()
                  .then(closeSheet)
                  .catch(() => undefined);
              }}
            />
          </View>
        )}
      </Sheet>

      {/* ORG-12 then ORG-13: the preview answers "what will this do?" before
          anything is saved. */}
      <Sheet visible={sheet.kind === 'mapping'} title={Copy.mappingTitle} onClose={closeSheet}>
        <View style={styles.form}>
          <SheetAction
            icon="business-outline"
            label={Copy.mappingWhole}
            selected={selectedIds.length === 0}
            disabled={offline}
            onPress={() => {
              setSelectedIds([]);
              setPreview(null);
            }}
          />
          {sheet.kind === 'mapping'
            ? locationsOf(sheet.workspace.business_id ?? -1).map((item) => {
                const selected = selectedIds.includes(item.id);
                return (
                  <SheetAction
                    key={item.id}
                    icon="location-outline"
                    label={item.name}
                    selected={selected}
                    disabled={offline || item.status === 'archived'}
                    onPress={() => {
                      setPreview(null);
                      setSelectedIds((current) =>
                        selected ? current.filter((id) => id !== item.id) : [...current, item.id],
                      );
                    }}
                  />
                );
              })
            : null}

          {preview ? (
            <AppText variant="caption" color="textSecondary">
              {`${preview.added.length} added, ${preview.removed.length} removed. ${Copy.mappingKept}`}
            </AppText>
          ) : null}
          {serverError ? (
            <AppText variant="caption" color="error">
              {serverError}
            </AppText>
          ) : null}

          <Button
            title={preview ? Copy.mappingSave : Copy.mappingCheck}
            fullWidth
            disabled={offline || busyKey !== null}
            loading={busyKey !== null}
            onPress={preview ? onSaveMapping : onPreviewMapping}
          />
        </View>
      </Sheet>

      <Sheet visible={sheet.kind === 'chooseClient'} title={Copy.chooseTitle} onClose={closeSheet}>
        <View style={styles.form}>
          <TextField
            label={Copy.chooseReason}
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={OrgLimits.chooseClientReasonMax}
            error={formError ?? serverError ?? undefined}
          />
          {businesses
            .filter((business) => business.status !== 'archived')
            .map((business) => (
              <SheetAction
                key={business.id}
                icon="business-outline"
                label={business.name}
                disabled={offline || busyKey !== null}
                onPress={() => onChooseClient(business.id)}
              />
            ))}
          <TextField
            label={Copy.chooseNew}
            value={name}
            onChangeText={setName}
            maxLength={OrgLimits.nameMax}
          />
          <Button
            title={Copy.chooseSave}
            fullWidth
            disabled={offline || busyKey !== null || name.trim().length === 0}
            loading={busyKey !== null}
            onPress={() => onChooseClient(null)}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

export default function LocationsRoute() {
  return <LocationsScreen />;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing.sm,
  },
  headerTitle: { flex: 1 },
  content: { paddingVertical: Spacing.sm },
  notice: { paddingHorizontal: Layout.screenPadding, paddingBottom: Spacing.sm },
  skeleton: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.md },
  pending: {
    gap: Spacing.xs,
    marginHorizontal: Layout.screenPadding,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: 12,
    backgroundColor: Colors.surfaceMuted,
  },
  readOnlyCard: {
    gap: 2,
    marginHorizontal: Layout.screenPadding,
    marginBottom: Spacing.md,
  },
  footer: { gap: Spacing.xs, paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.sm },
  form: { gap: Spacing.sm, paddingHorizontal: Layout.screenPadding, paddingBottom: Spacing.md },
});
