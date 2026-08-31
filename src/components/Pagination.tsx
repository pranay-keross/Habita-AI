import React from 'react';
import { View, Text, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import type { ThemeTokens } from '../theme';
import useThemedStyles from '../hooks/useThemedStyles';
import { t } from '../i18n';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  style?: StyleProp<ViewStyle>;
}

export default function Pagination({ currentPage, totalPages, onPageChange, style }: PaginationProps) {
  const styles = useThemedStyles(makeStyles);

  if (totalPages <= 1) return null;

  const atFirst = currentPage <= 1;
  const atLast = currentPage >= totalPages;

  return (
    <View style={[styles.row, style]}>
      <Pressable
        disabled={atFirst}
        onPress={() => onPageChange(currentPage - 1)}
        style={[styles.navBtn, atFirst && styles.navBtnDisabled]}>
        <ChevronLeft size={16} color={atFirst ? styles.iconDisabled.color : styles.icon.color} />
      </Pressable>

      <Text style={styles.label}>
        {t('expenses.page_indicator', { current: currentPage, total: totalPages })}
      </Text>

      <Pressable
        disabled={atLast}
        onPress={() => onPageChange(currentPage + 1)}
        style={[styles.navBtn, atLast && styles.navBtnDisabled]}>
        <ChevronRight size={16} color={atLast ? styles.iconDisabled.color : styles.icon.color} />
      </Pressable>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    navBtn: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navBtnDisabled: {
      opacity: 0.4,
    },
    icon: {
      color: colors.textPrimary,
    },
    iconDisabled: {
      color: colors.textMuted,
    },
    label: {
      fontFamily: fonts.sansMedium,
      fontSize: 12.5,
      color: colors.textSecondary,
      minWidth: 90,
      textAlign: 'center',
    },
  });
