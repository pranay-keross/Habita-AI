import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import useAuth from '../../../hooks/useAuth';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { loadStyleHistory, loadClothingItems } from '../stylePantryStore';
import { getClothingIconComponent } from '../clothingIcons';
import type { ClothingItem, OutfitRecommendation, WornOutfitEntry } from '../types';
import { subscribeToLanguageChanges, t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'StyleCalendar'>;

const WEEKDAY_KEYS = [
  'style_calendar.sun',
  'style_calendar.mon',
  'style_calendar.tue',
  'style_calendar.wed',
  'style_calendar.thu',
  'style_calendar.fri',
  'style_calendar.sat',
];

function toDateKey(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export default function StyleCalendarScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuth();
  const [, setLocaleVersion] = useState(0);

  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<WornOutfitEntry[]>([]);
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const fetchData = useCallback(async () => {
    const token = await getAccessToken();
    const [hist, list] = await Promise.all([
      loadStyleHistory(token),
      loadClothingItems(token),
    ]);
    setHistory(hist);
    setItems(list);
  }, [getAccessToken]);

  useEffect(() => {
    const unsubLang = subscribeToLanguageChanges(() =>
      setLocaleVersion(v => v + 1),
    );
    setLoading(true);
    fetchData().finally(() => setLoading(false));
    return () => {
      unsubLang();
    };
  }, [fetchData]);

  const itemsById = new Map(items.map(i => [i.id, i]));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const entriesByDate = new Map<string, WornOutfitEntry>();
  history.forEach(entry => {
    if (!entriesByDate.has(entry.date)) entriesByDate.set(entry.date, entry);
  });

  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthEntries = history.filter(e => e.date.startsWith(monthPrefix));
  const monthItemIds = new Set<string>();
  monthEntries.forEach(e => e.itemIds.forEach(id => monthItemIds.add(id)));
  const monthItems = Array.from(monthItemIds)
    .map(id => itemsById.get(id))
    .filter((i): i is ClothingItem => Boolean(i));
  const mostWorn = monthItems.reduce<ClothingItem | null>((best, cur) => {
    if (!best || cur.wearCount > best.wearCount) return cur;
    return best;
  }, null);
  const expensesTotal = monthItems.reduce(
    (sum, i) => sum + (i.purchasePrice || 0),
    0,
  );

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const handleDayPress = (day: number) => {
    const key = toDateKey(year, month, day);
    const entry = entriesByDate.get(key);
    if (!entry) return;
    const outfitItems = entry.itemIds
      .map(id => itemsById.get(id))
      .filter((i): i is ClothingItem => Boolean(i));
    const outfit: OutfitRecommendation = {
      id: entry.id,
      title: entry.outfitTitle,
      occasion: entry.occasion,
      eventTitle: entry.eventTitle,
      weatherSuitability: '',
      occasionSuitability: '',
      items: outfitItems,
      stylistNote: t('style_calendar.worn_on', { date: entry.date }),
      mood: entry.mood,
      isWornToday: true,
    };
    navigation.navigate('OutfitDetails', { outfit, readOnly: true });
  };

  return (
    <View style={styles.root}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <View style={styles.monthNav}>
          <Pressable
            onPress={() => setCursor(new Date(year, month - 1, 1))}
            style={styles.navBtn}
          >
            <ChevronLeft size={18} color={styles.headerIcon.color} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {cursor.toLocaleDateString(undefined, {
              month: 'long',
              year: 'numeric',
            })}
          </Text>
          <Pressable
            onPress={() => setCursor(new Date(year, month + 1, 1))}
            style={styles.navBtn}
          >
            <ChevronRight size={18} color={styles.headerIcon.color} />
          </Pressable>
        </View>
        <View style={styles.headerBtnPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.weekdayRow}>
          {WEEKDAY_KEYS.map(key => (
            <Text key={key} style={styles.weekdayText}>
              {t(key)}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((day, idx) => {
            if (day === null) {
              return <View key={`empty_${idx}`} style={styles.dayCell} />;
            }
            const key = toDateKey(year, month, day);
            const entry = entriesByDate.get(key);
            const firstItem = entry
              ? itemsById.get(entry.itemIds[0])
              : undefined;
            const DayIcon = firstItem
              ? getClothingIconComponent(firstItem.emoji)
              : null;
            return (
              <Pressable
                key={key}
                style={styles.dayCell}
                onPress={() => handleDayPress(day)}
                disabled={!entry}
              >
                <Text style={styles.dayNumber}>{day}</Text>
                {entry && DayIcon ? (
                  <View style={styles.dayThumb}>
                    <DayIcon size={16} color={styles.iconTint.color} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {!loading && monthEntries.length === 0 ? (
          <Text style={styles.emptyText}>{t('style_calendar.empty')}</Text>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{t('style_calendar.ootd')}</Text>
            <Text style={styles.statValue}>{monthEntries.length}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{t('style_calendar.most_worn')}</Text>
            {mostWorn ? (
              (() => {
                const MostWornIcon = getClothingIconComponent(mostWorn.emoji);
                return <MostWornIcon size={22} color={styles.iconTint.color} />;
              })()
            ) : (
              <Text style={styles.statValue}>-</Text>
            )}
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{t('style_calendar.expenses')}</Text>
            <Text style={styles.statValue}>
              {expensesTotal > 0 ? `$${expensesTotal.toFixed(0)}` : '$0'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      backgroundColor: colors.background,
    },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.soft,
    },
    headerBtnPlaceholder: { width: 40 },
    headerIcon: { color: colors.textPrimary },
    iconTint: { color: colors.primary },
    monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    navBtn: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: colors.textPrimary,
      minWidth: 140,
      textAlign: 'center',
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    weekdayRow: {
      flexDirection: 'row',
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    weekdayText: {
      flex: 1,
      textAlign: 'center',
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.textSecondary,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    dayCell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayNumber: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textPrimary,
    },
    dayThumb: {
      width: 24,
      height: 24,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    emptyText: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.lg,
    },
    statsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xl,
    },
    statBox: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    statLabel: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    statValue: {
      fontFamily: fonts.sansBold,
      fontSize: 18,
      color: colors.primary,
    },
  });
