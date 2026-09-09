import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import useAuth from '../../../hooks/useAuth';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ClockArrowLeft from 'lucide-react-native/icons/clock-arrow-left';
import GlassCard from '../../../components/GlassCard';
import {
  SkeletonBox,
  SkeletonCircle,
  SkeletonText,
} from '../../../components/Skeleton';
import { loadClothingItems, loadStyleHistory } from '../stylePantryStore';
import { getClothingIconComponent } from '../clothingIcons';
import { getMoodIconComponent } from '../moods';
import type { ClothingItem, WornOutfitEntry } from '../types';
import { subscribeToLanguageChanges, t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'StyleLog'>;

function displayDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
}

export default function StyleLogScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuth();
  const [, setLocaleVersion] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<WornOutfitEntry[]>([]);
  const [items, setItems] = useState<ClothingItem[]>([]);

  const fetchData = useCallback(async () => {
    const token = await getAccessToken();
    const [loadedHistory, loadedItems] = await Promise.all([
      loadStyleHistory(token),
      loadClothingItems(token),
    ]);
    setHistory(loadedHistory);
    setItems(loadedItems);
  }, [getAccessToken]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

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

  const itemsById = new Map(items.map(item => [item.id, item]));

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {t('style_pantry.style_log_title')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={styles.headerIcon.color}
            colors={[styles.headerIcon.color]}
          />
        }
      >
        {loading ? (
          <View>
            {[0, 1, 2].map(i => (
              <View key={i} style={styles.logCard}>
                <View style={styles.logHeaderRow}>
                  <SkeletonCircle size={36} style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <SkeletonText width="40%" style={{ marginBottom: 6 }} />
                    <SkeletonText width="60%" height={11} />
                  </View>
                </View>
                <SkeletonBox
                  width="100%"
                  height={44}
                  borderRadius={12}
                  style={{ marginTop: 12 }}
                />
              </View>
            ))}
          </View>
        ) : history.length === 0 ? (
          <View style={styles.emptyCard}>
            <ClockArrowLeft size={36} color={styles.placeholder.color} />
            <Text style={styles.emptyTitle}>
              {t('style_pantry.style_log_empty_title')}
            </Text>
            <Text style={styles.emptySub}>
              {t('style_pantry.style_log_empty_sub')}
            </Text>
          </View>
        ) : (
          history.map(entry => {
            const MoodIcon = getMoodIconComponent(entry.mood);
            const entryItems = entry.itemIds
              .map(id => itemsById.get(id))
              .filter((item): item is ClothingItem => Boolean(item));
            return (
              <GlassCard
                key={entry.id}
                variant="default"
                style={styles.logCard}
              >
                <View style={styles.logHeaderRow}>
                  <Text style={styles.logDate}>{displayDate(entry.date)}</Text>
                  {entry.mood ? (
                    <View style={styles.moodBadge}>
                      {MoodIcon ? (
                        <MoodIcon
                          size={12}
                          color={styles.aiAccent.color}
                          style={{ marginRight: 4 }}
                        />
                      ) : null}
                      <Text style={styles.moodBadgeText}>
                        {t(`style_pantry.mood_${entry.mood}`)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.logTitle}>{entry.outfitTitle}</Text>
                <Text style={styles.logSub}>
                  {entry.occasion} · {entry.eventTitle}
                </Text>
                {entryItems.length > 0 ? (
                  <View style={styles.itemsRow}>
                    {entryItems.map(item => {
                      const ItemIcon = getClothingIconComponent(item.emoji);
                      return (
                        <View key={item.id} style={styles.itemBadge}>
                          <ItemIcon size={16} color={styles.iconTint.color} />
                        </View>
                      );
                    })}
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

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
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
    headerIcon: {
      color: colors.textPrimary,
    },
    iconTint: {
      color: colors.primary,
    },
    aiAccent: {
      color: colors.primary,
    },
    placeholder: {
      color: colors.textSecondary,
    },
    headerTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 18,
      color: colors.textPrimary,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
    },
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
    emptyTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
      marginTop: spacing.md,
    },
    emptySub: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    logCard: {
      marginBottom: spacing.md,
    },
    logHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    logDate: {
      fontFamily: fonts.sansBold,
      fontSize: 12,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    moodBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    moodBadgeText: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: colors.primary,
    },
    logTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
    },
    logSub: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    itemsRow: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginTop: spacing.sm,
    },
    itemBadge: {
      width: 32,
      height: 32,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
