import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import useAuth from '../../../hooks/useAuth';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import BottomSheet from '../../../components/BottomSheet';
import { SkeletonBox } from '../../../components/Skeleton';
import { loadClothingItems, loadStyleHistory } from '../stylePantryStore';
import { useFocusLoad, useLocaleRerender } from '../hooks';
import { currentLocale, dateLabel, eventTypeLabel, priceLabel } from '../format';
import { toDateString } from '../../../utils/date';
import WardrobeHeader from '../components/WardrobeHeader';
import ItemThumb from '../components/ItemThumb';
import OfflineBanner from '../components/OfflineBanner';
import { entryToOutfit } from './StyleLogScreen';
import type { ClothingItem, WornOutfitEntry } from '../types';
import { t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'StyleCalendar'>;

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export default function StyleCalendarScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { getAccessToken } = useAuth();
  useLocaleRerender();

  const [history, setHistory] = useState<WornOutfitEntry[]>([]);
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [dayPick, setDayPick] = useState<WornOutfitEntry[] | null>(null);

  const { loading, refreshing, offline, refresh } = useFocusLoad(
    useCallback(async () => {
      const token = await getAccessToken();
      const [h, i] = await Promise.all([loadStyleHistory(token), loadClothingItems(token)]);
      setHistory(h.data);
      setItems(i.data);
      return { offline: h.offline || i.offline };
    }, [getAccessToken]),
  );

  const itemsById = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthPrefix = toDateString(cursor).slice(0, 7);

  const { entriesByDate, monthEntries, mostWorn, mostWornCount, valueWorn } = useMemo(() => {
    const byDate = new Map<string, WornOutfitEntry[]>();
    const inMonth = history.filter(e => e.date.startsWith(monthPrefix));
    inMonth.forEach(e => byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]));

    const counts = new Map<string, number>();
    inMonth.forEach(e => e.itemIds.forEach(id => counts.set(id, (counts.get(id) ?? 0) + 1)));
    let bestId: string | null = null;
    let best = 0;
    counts.forEach((n, id) => {
      if (n > best && itemsById.has(id)) {
        best = n;
        bestId = id;
      }
    });
    const value = Array.from(counts.keys()).reduce((sum, id) => sum + (itemsById.get(id)?.purchasePrice ?? 0), 0);
    return {
      entriesByDate: byDate,
      monthEntries: inMonth,
      mostWorn: bestId ? itemsById.get(bestId) ?? null : null,
      mostWornCount: best,
      valueWorn: value,
    };
  }, [history, monthPrefix, itemsById]);

  const cells: (number | null)[] = [...Array<null>(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const openEntry = (entry: WornOutfitEntry) => {
    setDayPick(null);
    navigation.navigate('OutfitDetails', { outfit: entryToOutfit(entry, itemsById), readOnly: true });
  };

  const handleDayPress = (day: number) => {
    const key = toDateString(new Date(year, month, day));
    const entries = entriesByDate.get(key);
    if (!entries || entries.length === 0) return;
    if (entries.length === 1) openEntry(entries[0]);
    else setDayPick(entries);
  };

  return (
    <View style={styles.root}>
      <WardrobeHeader title={t('calendar.title')} onBack={() => navigation.goBack()} />

      <View style={styles.monthNav}>
        <Pressable onPress={() => setCursor(new Date(year, month - 1, 1))} style={styles.navBtn} accessibilityRole="button">
          <ChevronLeft size={18} color={styles.text.color} />
        </Pressable>
        <Text style={styles.monthTitle}>{cursor.toLocaleDateString(currentLocale(), { month: 'long', year: 'numeric' })}</Text>
        <Pressable onPress={() => setCursor(new Date(year, month + 1, 1))} style={styles.navBtn} accessibilityRole="button">
          <ChevronRight size={18} color={styles.text.color} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={styles.tint.color} colors={[styles.tint.color]} />
        }>
        <OfflineBanner visible={offline} />
        <View style={styles.weekdayRow}>
          {WEEKDAY_KEYS.map(key => (
            <Text key={key} style={styles.weekdayText}>
              {t(`style_calendar.${key}`)}
            </Text>
          ))}
        </View>

        {loading ? (
          <SkeletonBox width="100%" height={280} borderRadius={12} />
        ) : (
          <View style={styles.grid}>
            {cells.map((day, idx) => {
              if (day === null) return <View key={`empty_${idx}`} style={styles.dayCell} />;
              const key = toDateString(new Date(year, month, day));
              const entries = entriesByDate.get(key) ?? [];
              const firstItem = entries[0] ? entries[0].itemIds.map(id => itemsById.get(id)).find(Boolean) : undefined;
              return (
                <Pressable key={key} style={styles.dayCell} onPress={() => handleDayPress(day)} disabled={entries.length === 0}>
                  <Text style={styles.dayNumber}>{day}</Text>
                  {entries.length > 0 ? (
                    firstItem ? (
                      <ItemThumb item={firstItem} size={26} radius={6} />
                    ) : (
                      <View style={styles.dayDot} />
                    )
                  ) : null}
                  {entries.length > 1 ? <Text style={styles.dayMulti}>{t('calendar.multiple_outfits', { count: entries.length })}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        )}

        {!loading && monthEntries.length === 0 ? <Text style={styles.emptyText}>{t('calendar.no_entries_month')}</Text> : null}

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{t('calendar.stat_days_logged')}</Text>
            <Text style={styles.statValue}>{entriesByDate.size}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{t('calendar.stat_most_worn')}</Text>
            {mostWorn ? (
              <>
                <ItemThumb item={mostWorn} size={32} />
                <Text style={styles.statCaption} numberOfLines={1}>
                  {mostWorn.name}
                </Text>
                <Text style={styles.statCaption}>{t('calendar.stat_wears_this_month', { count: mostWornCount })}</Text>
              </>
            ) : (
              <Text style={styles.statValue}>-</Text>
            )}
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{t('calendar.stat_value_worn')}</Text>
            <Text style={styles.statValue}>{priceLabel(valueWorn)}</Text>
            <Text style={styles.statCaption} numberOfLines={3}>
              {t('calendar.stat_value_worn_hint')}
            </Text>
          </View>
        </View>
      </ScrollView>

      <BottomSheet visible={dayPick !== null} onClose={() => setDayPick(null)} title={t('calendar.pick_outfit_title')}>
        {(dayPick ?? []).map(entry => (
          <Pressable key={entry.id} style={styles.pickRow} onPress={() => openEntry(entry)}>
            <View style={styles.flex}>
              <Text style={styles.pickTitle}>{entry.outfitTitle}</Text>
              <Text style={styles.pickSub}>
                {eventTypeLabel(entry.occasion)} · {entry.eventTitle} · {dateLabel(entry.date)}
              </Text>
            </View>
            <ChevronRight size={16} color={styles.placeholder.color} />
          </Pressable>
        ))}
      </BottomSheet>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    tint: { color: colors.primary },
    text: { color: colors.textPrimary },
    placeholder: { color: colors.textSecondary },
    monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingBottom: spacing.xs },
    navBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    monthTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.textPrimary, minWidth: 150, textAlign: 'center' },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    weekdayRow: { flexDirection: 'row', marginTop: spacing.sm, marginBottom: spacing.xs },
    weekdayText: { flex: 1, textAlign: 'center', fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textSecondary },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayCell: { width: `${100 / 7}%`, aspectRatio: 0.85, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 },
    dayNumber: { fontFamily: fonts.sans, fontSize: 12, color: colors.textPrimary, marginBottom: 2 },
    dayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 8 },
    dayMulti: { fontFamily: fonts.sans, fontSize: 9, color: colors.textMuted, marginTop: 1 },
    emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.lg },
    statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
    statBox: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xs,
      alignItems: 'center',
    },
    statLabel: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textSecondary, marginBottom: spacing.xs, textAlign: 'center' },
    statValue: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.primary, textAlign: 'center' },
    statCaption: { fontFamily: fonts.sans, fontSize: 10, color: colors.textMuted, textAlign: 'center', marginTop: 2 },
    pickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    pickTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary },
    pickSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  });
