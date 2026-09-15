import type { ReactNode } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, Badge, BrandLogo, Button, Card, IconButton, Screen } from '@/components/common';
import { Banner, ChatRowSkeleton, StateView } from '@/components/feedback';
import { Colors, Radius, Spacing } from '@/constants/theme';

/**
 * Development-only catalogue of the Stage 2 design system, for checking fonts,
 * colours and components on a real device. Not reachable in production builds.
 * Sample values below are static placeholders, not API data.
 */
export default function UiPreview() {
  if (!__DEV__) return <Redirect href="/" />;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <IconButton icon="chevron-back" accessibilityLabel="Go back" onPress={() => router.back()} />
        <AppText variant="h2">UI preview</AppText>
      </View>

      <Section title="Branding">
        <Card style={styles.row}>
          <BrandLogo variant="logoDark" width={130} />
          <BrandLogo variant="iconGreen" width={44} />
          <BrandLogo variant="iconDark" width={44} />
        </Card>
        <View style={[styles.row, styles.darkStrip]}>
          <BrandLogo variant="logoWhite" width={130} />
          <BrandLogo variant="iconWhite" width={44} />
          <BrandLogo variant="appIcon" width={44} />
        </View>
      </Section>

      <Section title="Colours">
        <View style={styles.swatches}>
          {(['deepGreen', 'vividGreen', 'softGreen', 'mintGreen', 'deepNavy'] as const).map((token) => (
            <View key={token} style={styles.swatchItem}>
              <View style={[styles.swatch, { backgroundColor: Colors[token] }]} />
              <AppText variant="caption" color="textSecondary">
                {token}
              </AppText>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Typography">
        <AppText variant="display">Welcome Back</AppText>
        <AppText variant="sectionTitle">My message activity</AppText>
        <AppText variant="metric">124</AppText>
        <AppText variant="label">Labels & buttons</AppText>
        <AppText variant="body" color="textSecondary">
          Sign in to continue to your business account
        </AppText>
        <AppText variant="caption" color="textMuted">
          Caption · 10:24 AM
        </AppText>
      </Section>

      <Section title="Buttons">
        <Button title="Continue with OTP" />
        <Button title="Choose Template" variant="dark" />
        <Button title="Sign In" loading />
        <Button title="Retry" variant="secondary" />
        <Button title="Go Back" variant="outline" />
        <Button title="Disabled" disabled />
      </Section>

      <Section title="Stat cards">
        <View style={styles.grid}>
          {[
            { label: 'Total assigned', value: '—', icon: 'chatbubbles-outline' as const },
            { label: 'Open chats', value: '—', icon: 'mail-open-outline' as const },
            { label: 'Unread chats', value: '—', icon: 'notifications-outline' as const },
            { label: 'Replies allowed', value: '—', icon: 'time-outline' as const },
          ].map((s) => (
            <Card key={s.label} style={styles.stat}>
              <View style={styles.statIcon}>
                <Ionicons name={s.icon} size={18} color={Colors.deepGreen} />
              </View>
              <AppText variant="metric">{s.value}</AppText>
              <AppText variant="caption" color="textSecondary">
                {s.label}
              </AppText>
            </Card>
          ))}
        </View>
      </Section>

      <Section title="Chat row">
        <Card padded={false} style={styles.chatCard}>
          <View style={styles.chatRow}>
            <Avatar name="Sample Customer" />
            <View style={styles.flex}>
              <AppText variant="title" numberOfLines={1}>
                Sample Customer
              </AppText>
              <AppText variant="bodySmall" color="textSecondary" numberOfLines={1}>
                Latest message preview
              </AppText>
            </View>
            <View style={styles.chatMeta}>
              <AppText variant="caption" color="primary">
                2m
              </AppText>
              <Badge label={3} accessibilityLabel="3 unread messages" />
            </View>
          </View>
          <View style={styles.chatRow}>
            <ChatRowSkeleton />
          </View>
        </Card>
      </Section>

      <Section title="Reply window banners">
        <Banner tone="success" title="Replies allowed" description="Remaining time is shown from the server window" />
        <Banner
          tone="error"
          title="24-hour reply window closed"
          description="You can only send an approved WhatsApp template at this time."
        />
      </Section>

      <Section title="Message bubbles">
        <View style={styles.chatBg}>
          <View style={[styles.bubble, styles.inbound]}>
            <AppText variant="message">Inbound message</AppText>
            <AppText variant="caption" color="textMuted" align="right">
              10:24 AM
            </AppText>
          </View>
          <View style={[styles.bubble, styles.outbound]}>
            <AppText variant="message">Outbound message</AppText>
            <AppText variant="caption" color="textMuted" align="right">
              10:25 AM · Read
            </AppText>
          </View>
        </View>
      </Section>

      <Section title="State view">
        <Card padded={false}>
          <StateView
            brandMark
            title="No Conversations Yet"
            description="When conversations are assigned to you, they'll appear here."
          />
        </Card>
        <Card padded={false}>
          <StateView
            icon="cloud-offline-outline"
            tone="neutral"
            title="You're Offline"
            description="Check your internet connection and try again."
            actionLabel="Retry"
            actionVariant="secondary"
            onAction={() => {}}
          />
        </Card>
      </Section>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="overline" color="textMuted">
        {title.toUpperCase()}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginLeft: -Spacing.md },
  section: { gap: Spacing.md, marginTop: Spacing.xxl },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  darkStrip: { backgroundColor: Colors.deepGreen, borderRadius: Radius.lg, padding: Spacing.lg },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  swatchItem: { alignItems: 'center', gap: Spacing.xs },
  swatch: { width: 56, height: 40, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  stat: { flexBasis: '47%', flexGrow: 1, gap: Spacing.xs },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatCard: { paddingHorizontal: Spacing.lg },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  chatMeta: { alignItems: 'flex-end', gap: Spacing.xs },
  chatBg: { backgroundColor: Colors.chatBackground, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  bubble: { maxWidth: '78%', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  inbound: { alignSelf: 'flex-start', backgroundColor: Colors.bubbleInbound, borderTopLeftRadius: Radius.xs },
  outbound: { alignSelf: 'flex-end', backgroundColor: Colors.bubbleOutbound, borderTopRightRadius: Radius.xs },
});
