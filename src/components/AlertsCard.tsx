import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { BellRing, Check, Pill, ReceiptText } from 'lucide-react-native';
import type { ThemeTokens } from '../theme';
import useThemedStyles from '../hooks/useThemedStyles';
import { t } from '../i18n';
import { pushCopy } from '../features/notifications/parse';
import type { PushSection } from '../features/notifications/types';
import type { StoredNotification } from '../features/notifications/notificationStore';

interface AlertsCardProps {
  section: PushSection;
  items: StoredNotification[];
  onDismiss?: (id: string) => void;
  onMarkAllRead?: () => void;
  style?: ViewStyle;
}

/**
 * The alerts a section has received, rendered from the local inbox.
 *
 * Shared between the Medicine Chest and Resources screens because the two
 * sections show the same thing with different copy — the section decides the
 * heading and the icon, the payload decides the text. Every string resolves
 * through `t()` at render, so an alert received in one language re-renders in
 * whichever language is active now (agent.md rule 2).
 *
 * Renders nothing at all when the section has no alerts: an empty "no alerts"
 * card on every screen is noise, and this one is not the screen's main content.
 */
export default function AlertsCard({
  section,
  items,
  onDismiss,
  onMarkAllRead,
  style,
}: AlertsCardProps) {
  const styles = useThemedStyles(makeStyles);

  if (items.length === 0) {
    return null;
  }

  const unread = items.filter((n) => !n.read).length;
  const SectionIcon = section === 'medchest' ? Pill : ReceiptText;
  const titleKey =
    section === 'medchest' ? 'notifications.medchest_title' : 'notifications.utilities_title';

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <BellRing size={16} color={styles.iconTint.color} />
          </View>
          <Text style={styles.title}>{t(titleKey)}</Text>
          {unread > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread}</Text>
            </View>
          ) : null}
        </View>
        {unread > 0 && onMarkAllRead ? (
          <Pressable hitSlop={8} style={styles.markAll} onPress={onMarkAllRead}>
            <Text style={styles.markAllText}>{t('notifications.mark_all_read')}</Text>
          </Pressable>
        ) : null}
      </View>

      {items.map((item) => {
        const copy = pushCopy(item.payload);
        return (
          <Pressable
            key={item.id}
            style={[styles.row, item.read && styles.rowRead]}
            onPress={onDismiss ? () => onDismiss(item.id) : undefined}
            accessibilityRole="button"
            accessibilityLabel={t(copy.titleKey, copy.values)}>
            <View style={styles.rowIcon}>
              <SectionIcon size={14} color={styles.iconTint.color} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{t(copy.titleKey, copy.values)}</Text>
              <Text style={styles.rowBody}>{t(copy.bodyKey, copy.values)}</Text>
            </View>
            {item.read ? (
              <Check size={14} color={styles.readTint.color} />
            ) : (
              <View style={styles.dot} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    headerIcon: {
      width: 28,
      height: 28,
      borderRadius: radius.pill,
      backgroundColor: colors.blush || colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    title: {
      fontFamily: fonts.sansMedium,
      fontSize: 14,
      color: colors.textPrimary,
    },
    badge: {
      minWidth: 18,
      height: 18,
      paddingHorizontal: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: spacing.xs,
    },
    badgeText: {
      fontFamily: fonts.sansMedium,
      fontSize: 10,
      color: colors.textOnPrimary,
    },
    markAll: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    markAllText: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: colors.primary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    rowRead: { opacity: 0.55 },
    rowIcon: {
      width: 26,
      height: 26,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    rowText: { flex: 1 },
    rowTitle: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textPrimary,
      marginBottom: 1,
    },
    rowBody: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textMuted,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    // Read by the component to tint the lucide icons, which take a `color` prop
    // rather than a style — the same trick the other screens use.
    iconTint: { color: colors.primary },
    readTint: { color: colors.textMuted },
  });
