import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import useAuth from '../../../hooks/useAuth';
import ClockArrowLeft from 'lucide-react-native/icons/clock-arrow-left';
import GlassCard from '../../../components/GlassCard';
import { SkeletonBox, SkeletonCircle, SkeletonText } from '../../../components/Skeleton';
import { loadClothingItems, loadStyleHistory } from '../stylePantryStore';
import { getMoodIconComponent } from '../moods';
import { useFocusLoad, useLocaleRerender } from '../hooks';
import { dateLabel, eventTypeLabel, moodLabel } from '../format';
import WardrobeHeader from '../components/WardrobeHeader';
import ItemThumb from '../components/ItemThumb';
import OfflineBanner from '../components/OfflineBanner';
import type { ClothingItem, OutfitRecommendation, WornOutfitEntry } from '../types';
import { t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'StyleLog'>;

export function entryToOutfit(entry: WornOutfitEntry, itemsById: Map<string, ClothingItem>): OutfitRecommendation {
  return {
    id: entry.id,
    title: entry.outfitTitle,
    occasion: entry.occasion,
    eventTitle: entry.eventTitle,
    weatherSuitability: '',
    occasionSuitability: '',
    items: entry.itemIds.map(id => itemsById.get(id)).filter((i): i is ClothingItem => Boolean(i)),
    stylistNote: t('style_calendar.worn_on', { date: dateLabel(entry.date) }),
    mood: entry.mood,
    isSaved: false,
  };
}

export default function StyleLogScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { getAccessToken } = useAuth();
  useLocaleRerender();

  const [history, setHistory] = useState<WornOutfitEntry[]>([]);
  const [items, setItems] = useState<ClothingItem[]>([]);

  const { loading, refreshing, offline, refresh } = useFocusLoad(
    useCallback(async () => {
      const token = await getAccessToken();
      const [h, i] = await Promise.all([loadStyleHistory(token), loadClothingItems(token)]);
      setHistory(h.data);
      setItems(i.data);
      return { offline: h.offline || i.offline };
    }, [getAccessToken]),
  );

  const itemsById = new Map(items.map(item => [item.id, item]));

  return (
    <View style={styles.root}>
      <WardrobeHeader title={t('style_pantry.style_log_title')} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={styles.tint.color} colors={[styles.tint.color]} />
        }>
        <OfflineBanner visible={offline} />
        {loading ? (
          <View>
            {[0, 1, 2].map(i => (
              <View key={i} style={styles.logCard}>
                <View style={styles.logHeaderRow}>
                  <SkeletonCircle size={36} style={styles.skelGap} />
                  <View style={styles.flex}>
                    <SkeletonText width="40%" style={styles.skelLine} />
                    <SkeletonText width="60%" height={11} />
                  </View>
                </View>
                <SkeletonBox width="100%" height={44} borderRadius={12} style={styles.skelBox} />
              </View>
            ))}
          </View>
        ) : history.length === 0 ? (
          <View style={styles.emptyCard}>
            <ClockArrowLeft size={36} color={styles.placeholder.color} />
            <Text style={styles.emptyTitle}>{t('style_pantry.style_log_empty_title')}</Text>
            <Text style={styles.emptySub}>{t('style_pantry.style_log_empty_sub')}</Text>
          </View>
        ) : (
          history.map(entry => {
            const MoodIcon = getMoodIconComponent(entry.mood);
            const entryItems = entry.itemIds.map(id => itemsById.get(id)).filter((i): i is ClothingItem => Boolean(i));
            const missing = entry.itemIds.length - entryItems.length;
            return (
              <GlassCard
                key={entry.id}
                variant="default"
                style={styles.logCard}
                onPress={() => navigation.navigate('OutfitDetails', { outfit: entryToOutfit(entry, itemsById), readOnly: true })}>
                <View style={styles.logHeaderRow}>
                  <Text style={styles.logDate}>{dateLabel(entry.date)}</Text>
                  {entry.mood ? (
                    <View style={styles.moodBadge}>
                      {MoodIcon ? <MoodIcon size={12} color={styles.tint.color} style={styles.moodIcon} /> : null}
                      <Text style={styles.moodBadgeText}>{moodLabel(entry.mood)}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.logTitle}>{entry.outfitTitle}</Text>
                <Text style={styles.logSub}>
                  {eventTypeLabel(entry.occasion)} · {entry.eventTitle}
                </Text>
                {entryItems.length > 0 || missing > 0 ? (
                  <View style={styles.itemsRow}>
                    {entryItems.map(item => (
                      <ItemThumb key={item.id} item={item} size={36} />
                    ))}
                    {missing > 0 ? <Text style={styles.missingText}>{t('style_pantry.removed_items_count', { count: missing })}</Text> : null}
                  </View>
                ) : null}
              </GlassCard>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    tint: { color: colors.primary },
    placeholder: { color: colors.textSecondary },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    skelGap: { marginRight: 12 },
    skelLine: { marginBottom: 6 },
    skelBox: { marginTop: 12 },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: spacing.md,
    },
    emptyTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.textPrimary, marginTop: spacing.md },
    emptySub: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
    logCard: { marginBottom: spacing.md },
    logHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
    logDate: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    moodBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    moodIcon: { marginRight: 4 },
    moodBadgeText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.primary },
    logTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.textPrimary },
    logSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    itemsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
    missingText: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginLeft: spacing.xs },
  });
