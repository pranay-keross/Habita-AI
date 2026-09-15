import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, TextInput, StyleSheet } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import Search from 'lucide-react-native/icons/search';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import BottomSheet from '../../../components/BottomSheet';
import Button from '../../../components/Button';
import { t } from '../../../i18n';
import ItemThumb from './ItemThumb';
import type { ClothingItem } from '../types';

interface Props {
  visible: boolean;
  title: string;
  items: ClothingItem[];
  selectedIds: string[];
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
  confirmLabel?: string;
  /** Single-select mode returns at most one id. */
  single?: boolean;
}

/**
 * Scrollable multi-select of wardrobe items inside a bottom sheet — replaces the
 * fixed-height `View` lists that made long closets unreachable.
 */
export default function ItemPickerSheet({ visible, title, items, selectedIds, onClose, onConfirm, confirmLabel, single }: Props) {
  const styles = useThemedStyles(makeStyles);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>(selectedIds);

  // Reset the working selection each time the sheet opens.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setSelected(selectedIds);
      setQuery('');
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => i.name.toLowerCase().includes(q) || i.color.toLowerCase().includes(q) || (i.brand ?? '').toLowerCase().includes(q));
  }, [items, query]);

  const toggle = (id: string) => {
    setSelected(prev => {
      if (single) return prev.includes(id) ? [] : [id];
      return prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
    });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} maxHeightPercent={0.85}>
      <View style={styles.searchRow}>
        <Search size={16} color={styles.placeholder.color} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={t('style_pantry.search_placeholder')}
          placeholderTextColor={styles.placeholder.color}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.empty}>{t('style_pantry.no_items_found')}</Text>}
        renderItem={({ item }) => {
          const on = selected.includes(item.id);
          return (
            <Pressable onPress={() => toggle(item.id)} style={[styles.row, on && styles.rowOn]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
              <ItemThumb item={item} size={44} />
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {item.color}
                  {item.brand ? ` · ${item.brand}` : ''}
                </Text>
              </View>
              <View style={[styles.check, on && styles.checkOn]}>{on ? <Check size={14} color={styles.checkIcon.color} /> : null}</View>
            </Pressable>
          );
        }}
      />
      <View style={styles.footer}>
        <Text style={styles.count}>{t('closet.items_selected', { count: selected.length })}</Text>
        <Button title={confirmLabel ?? t('closet.save_closet')} onPress={() => onConfirm(selected)} />
      </View>
    </BottomSheet>
  );
}

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) =>
  StyleSheet.create({
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
    searchInput: { flex: 1, paddingVertical: 10, fontFamily: fonts.sans, fontSize: 14, color: colors.textPrimary },
    placeholder: { color: colors.textMuted },
    list: { maxHeight: 380 },
    empty: { textAlign: 'center', color: colors.textMuted, fontFamily: fonts.sans, paddingVertical: spacing.lg },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
    },
    rowOn: { backgroundColor: colors.blush },
    rowText: { flex: 1 },
    name: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
    sub: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary },
    check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
    checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    checkIcon: { color: colors.textOnPrimary },
    footer: { paddingTop: spacing.md, gap: spacing.sm },
    count: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  });
