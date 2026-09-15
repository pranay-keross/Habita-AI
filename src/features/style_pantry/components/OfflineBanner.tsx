import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import WifiOff from 'lucide-react-native/icons/wifi-off';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import { t } from '../../../i18n';

/** Shown at the top of a list when the data on screen came from the local cache. */
export default function OfflineBanner({ visible }: { visible: boolean }) {
  const styles = useThemedStyles(makeStyles);
  if (!visible) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <WifiOff size={14} color={styles.text.color} />
      <Text style={styles.text}>{t('style_pantry.offline_banner')}</Text>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.turmericSoft,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.md,
    },
    text: { flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.textPrimary },
  });
