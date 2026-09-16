import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { MessageTemplate } from '@/api/types';
import { AppText, Badge } from '@/components/common';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { parameterCount } from '@/features/templates';

export type TemplateListItemProps = {
  template: MessageTemplate;
  onPress: (template: MessageTemplate) => void;
};

function TemplateListItemComponent({ template, onPress }: TemplateListItemProps) {
  const name = template.name?.trim() || `Template ${template.id}`;
  const variables = parameterCount(template, 'header') + parameterCount(template, 'body');
  const body = template.body_text?.trim();

  return (
    <Pressable
      onPress={() => onPress(template)}
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityHint={variables > 0 ? `${variables} values to fill in` : 'No values to fill in'}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.line}>
        <AppText variant="title" numberOfLines={1} style={styles.name}>
          {name}
        </AppText>
        {variables > 0 ? <Badge label={`${variables}`} tone="soft" accessibilityLabel={`${variables} variables`} /> : null}
      </View>

      {body ? (
        <AppText variant="bodySmall" color="textSecondary" numberOfLines={2}>
          {body}
        </AppText>
      ) : null}

      <View style={styles.meta}>
        {template.category ? (
          <AppText variant="caption" color="textMuted">
            {template.category}
          </AppText>
        ) : null}
        {template.language ? (
          <AppText variant="caption" color="textMuted">
            {template.language}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

export const TemplateListItem = memo(TemplateListItemComponent);

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  pressed: { backgroundColor: Colors.grey50 },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  name: { flex: 1 },
  meta: { flexDirection: 'row', gap: Spacing.md },
});
