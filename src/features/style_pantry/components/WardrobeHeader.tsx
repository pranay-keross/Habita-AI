import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import type { LucideProps } from 'lucide-react-native';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';

interface HeaderAction {
  icon: React.ComponentType<LucideProps>;
  onPress: () => void;
  accessibilityLabel: string;
  /** Filled primary circle instead of the outlined surface button. */
  primary?: boolean;
  disabled?: boolean;
}

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: HeaderAction | HeaderAction[];
}

/** The module's standard top bar: back button, centred title, up to two right actions. */
export default function WardrobeHeader({ title, subtitle, onBack, right }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const actions = right ? (Array.isArray(right) ? right : [right]) : [];

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
      <View style={styles.side}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.btn} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
            <ArrowLeft size={20} color={styles.icon.color} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.side, styles.sideRight]}>
        {actions.map((a, i) => {
          const Icon = a.icon;
          return (
            <Pressable
              key={i}
              onPress={a.onPress}
              disabled={a.disabled}
              accessibilityRole="button"
              accessibilityLabel={a.accessibilityLabel}
              hitSlop={8}
              style={[styles.btn, a.primary && styles.btnPrimary, a.disabled && styles.btnDisabled, i > 0 && styles.btnSpaced]}>
              <Icon size={20} color={a.primary ? styles.iconOnPrimary.color : styles.icon.color} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = ({ colors, fonts, spacing }: ThemeTokens) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      backgroundColor: colors.background,
    },
    side: { minWidth: 40, flexDirection: 'row', alignItems: 'center' },
    sideRight: { justifyContent: 'flex-end' },
    btn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    btnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
    btnDisabled: { opacity: 0.5 },
    btnSpaced: { marginLeft: spacing.sm },
    titleWrap: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.sm },
    title: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.textPrimary, textAlign: 'center' },
    subtitle: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },
    icon: { color: colors.textPrimary },
    iconOnPrimary: { color: colors.textOnPrimary },
  });
