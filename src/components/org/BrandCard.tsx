import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { Business, OrgLocation, OrgWorkspace } from '@/api/types';
import { AppText, IconButton } from '@/components/common';
import { Colors, Layout, Radius, Spacing } from '@/constants/theme';

const Copy = {
  archived: 'Archived',
  provisional: 'Not confirmed yet',
  wholeBrand: 'Serves the whole brand',
  noBranch: 'No branch chosen',
  branches: 'Branches',
  numbers: 'Numbers',
  noBranches: 'No branches yet.',
  addBranch: 'Add a branch',
  members: 'Who works on it',
};

export type BrandCardProps = {
  business: Business;
  locations: OrgLocation[];
  workspaces: OrgWorkspace[];
  /** ORG-00: what an agency calls a brand, for the screen reader. */
  brandWord: string;
  busyKey: string | null;
  canManageLocations: boolean;
  canManageBrand: boolean;
  canManageMembers: boolean;
  canManageMapping: boolean;
  onRename: (business: Business) => void;
  onArchive: (business: Business) => void;
  onMembers: (business: Business) => void;
  onAddLocation: (business: Business) => void;
  onEditLocation: (location: OrgLocation) => void;
  onMapNumber: (workspace: OrgWorkspace) => void;
};

/**
 * ORG-02. One brand: its branches and the numbers that answer for them.
 *
 * Every action is drawn from a permission the server reported, not from a role
 * name, and the ids come only from `/structure` - nothing here is invented.
 */
export function BrandCard({
  business,
  locations,
  workspaces,
  brandWord,
  busyKey,
  canManageLocations,
  canManageBrand,
  canManageMembers,
  canManageMapping,
  onRename,
  onArchive,
  onMembers,
  onAddLocation,
  onEditLocation,
  onMapNumber,
}: BrandCardProps) {
  const archived = business.status === 'archived';
  const busy = busyKey === `business:${business.id}`;

  const branchName = (id: number) => locations.find((location) => location.id === id)?.name;

  const servedBy = (workspace: OrgWorkspace): string => {
    if (workspace.business_wide) return Copy.wholeBrand;
    const names = (workspace.location_ids ?? [])
      .map(branchName)
      .filter((name): name is string => !!name);
    return names.length > 0 ? names.join(', ') : Copy.noBranch;
  };

  return (
    <View style={[styles.card, archived && styles.dim]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="sectionTitle" numberOfLines={2}>
            {business.name}
          </AppText>
          {archived || business.provisional ? (
            <AppText variant="caption" color="textSecondary">
              {archived ? Copy.archived : Copy.provisional}
            </AppText>
          ) : null}
        </View>

        {canManageLocations ? (
          <IconButton
            icon="create-outline"
            accessibilityLabel={`Rename this ${brandWord.toLowerCase()}`}
            color="textSecondary"
            disabled={busy}
            onPress={() => onRename(business)}
          />
        ) : null}
        {canManageMembers ? (
          <IconButton
            icon="people-outline"
            accessibilityLabel={Copy.members}
            color="textSecondary"
            disabled={busy}
            onPress={() => onMembers(business)}
          />
        ) : null}
        {canManageBrand ? (
          <IconButton
            icon={archived ? 'refresh-outline' : 'archive-outline'}
            accessibilityLabel={
              archived ? `Restore this ${brandWord.toLowerCase()}` : `Archive this ${brandWord.toLowerCase()}`
            }
            color="textSecondary"
            disabled={busy}
            onPress={() => onArchive(business)}
          />
        ) : null}
      </View>

      <AppText variant="caption" color="textSecondary" style={styles.groupTitle}>
        {Copy.branches}
      </AppText>
      {locations.length === 0 ? (
        <AppText variant="bodySmall" color="textSecondary" style={styles.rowText}>
          {Copy.noBranches}
        </AppText>
      ) : (
        locations.map((location) => (
          <Pressable
            key={location.id}
            disabled={!canManageLocations || busyKey === `location:${location.id}`}
            onPress={() => onEditLocation(location)}
            accessibilityRole="button"
            accessibilityLabel={`${location.name}. Edit this branch`}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Ionicons name="location-outline" size={18} color={Colors.textSecondary} />
            <View style={styles.rowBody}>
              <AppText variant="label">{location.name}</AppText>
              {location.status === 'archived' ? (
                <AppText variant="caption" color="textSecondary">
                  {Copy.archived}
                </AppText>
              ) : location.city ? (
                <AppText variant="caption" color="textSecondary">
                  {location.city}
                </AppText>
              ) : null}
            </View>
            {canManageLocations ? (
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
            ) : null}
          </Pressable>
        ))
      )}

      {canManageLocations && !archived ? (
        <Pressable
          onPress={() => onAddLocation(business)}
          accessibilityRole="button"
          accessibilityLabel={Copy.addBranch}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={18} color={Colors.primary} />
          <AppText variant="captionMedium" color="primary">
            {Copy.addBranch}
          </AppText>
        </Pressable>
      ) : null}

      <AppText variant="caption" color="textSecondary" style={styles.groupTitle}>
        {Copy.numbers}
      </AppText>
      {workspaces.map((workspace) => (
        <Pressable
          key={workspace.id}
          disabled={!canManageMapping || busyKey === `workspace:${workspace.id}`}
          onPress={() => onMapNumber(workspace)}
          accessibilityRole="button"
          accessibilityLabel={`${workspace.display_label ?? workspace.label ?? workspace.id}. Choose which branches it serves`}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Ionicons name="call-outline" size={18} color={Colors.textSecondary} />
          <View style={styles.rowBody}>
            <AppText variant="label">
              {workspace.display_label || workspace.label || workspace.display_phone_number || ''}
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {servedBy(workspace)}
            </AppText>
          </View>
          {canManageMapping ? (
            <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.xs,
    marginHorizontal: Layout.screenPadding,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.divider,
  },
  dim: { opacity: 0.6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  headerText: { flex: 1, gap: 2 },
  groupTitle: { paddingTop: Spacing.sm, textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  rowBody: { flex: 1, gap: 2 },
  rowText: { paddingVertical: Spacing.xs },
  pressed: { opacity: 0.7 },
});
