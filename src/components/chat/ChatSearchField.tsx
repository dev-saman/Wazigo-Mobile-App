import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { IconButton } from '@/components/common';
import { TextField } from '@/components/forms';
import { Colors, Layout, Spacing } from '@/constants/theme';

export type ChatSearchFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
};

/** Search box for the chats list. The term is sent to CHAT-01, never applied locally. */
export function ChatSearchField({
  value,
  onChangeText,
  placeholder = 'Search conversations',
}: ChatSearchFieldProps) {
  return (
    <View style={styles.container}>
      <TextField
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        // Design screen 5: a soft grey search box rather than an outlined form field.
        variant="filled"
        accessibilityLabel="Search conversations"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        inputMode="search"
        clearButtonMode="never"
        leading={<Ionicons name="search" size={18} color={Colors.textMuted} style={styles.icon} />}
        trailing={
          value.length > 0 ? (
            <IconButton
              icon="close-circle"
              accessibilityLabel="Clear search"
              color="textMuted"
              size={18}
              onPress={() => onChangeText('')}
            />
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.sm },
  icon: { marginRight: Spacing.sm },
});
