import React, { useEffect, useState, useCallback } from 'react';
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
import FolderOpen from 'lucide-react-native/icons/folder-open';
import Luggage from 'lucide-react-native/icons/luggage';
import Sparkles from 'lucide-react-native/icons/sparkles';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Palette from 'lucide-react-native/icons/palette';
import Ruler from 'lucide-react-native/icons/ruler';
import Star from 'lucide-react-native/icons/star';
import Camera from 'lucide-react-native/icons/camera';
import Plus from 'lucide-react-native/icons/plus';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import GlassCard from '../../../components/GlassCard';
import BottomSheet from '../../../components/BottomSheet';
import Button from '../../../components/Button';
import QuickActionTile from '../../../components/QuickActionTile';
import { SkeletonBox, SkeletonText } from '../../../components/Skeleton';
import {
  loadClothingItems,
  loadWeather,
  generateOutfitRecommendation,
} from '../stylePantryStore';
import { getClothingIconComponent } from '../clothingIcons';
import type {
  CalendarEvent,
  ClothingItem,
  OutfitRecommendation,
} from '../types';
import { subscribeToLanguageChanges, t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'AiStylistHome'>;

function todaysPseudoEvent(): CalendarEvent {
  const today = new Date().toISOString().split('T')[0];
  return {
    id: 'today',
    title: t('ai_stylist.today_outfit_event_title'),
    date: today,
    time: '',
    eventType: 'casual',
  };
}

function greetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'ai_stylist.greeting_morning';
  if (hour < 17) return 'ai_stylist.greeting_afternoon';
  return 'ai_stylist.greeting_evening';
}

export default function AiStylistHomeScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuth();
  const [, setLocaleVersion] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [recommendation, setRecommendation] =
    useState<OutfitRecommendation | null>(null);
  const [comingSoon, setComingSoon] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const token = await getAccessToken();
    const [list, weather] = await Promise.all([
      loadClothingItems(token),
      loadWeather(token),
    ]);
    setItems(list);
    if (list.length > 0) {
      const outfit = await generateOutfitRecommendation(
        weather,
        todaysPseudoEvent(),
        list,
        token,
      );
      setRecommendation(outfit);
    } else {
      setRecommendation(null);
    }
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
    const unsubFocus = navigation.addListener('focus', () => {
      setLoading(true);
      fetchData().finally(() => setLoading(false));
    });
    return () => {
      unsubLang();
      unsubFocus();
    };
  }, [navigation, fetchData]);

  const recentItems = items.slice(0, 8);

  return (
    <View style={styles.root}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('ai_stylist.hub_title')}</Text>
        <View style={styles.headerRightGroup}>
          <Pressable
            onPress={() => navigation.navigate('Trips')}
            style={styles.headerBtn}
          >
            <Luggage size={18} color={styles.headerIcon.color} />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Wardrobe')}
            style={styles.headerBtn}
          >
            <FolderOpen size={18} color={styles.headerIcon.color} />
          </Pressable>
        </View>
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
        <Text style={styles.greeting}>{t(greetingKey())}</Text>
        <Text style={styles.subGreeting}>{t('ai_stylist.hub_subtitle')}</Text>

        {/* Quick actions */}
        <View style={styles.quickActionsGrid}>
          <QuickActionTile
            label={t('ai_stylist.qa_outfit_suggestion')}
            Icon={Sparkles}
            onPress={() => navigation.navigate('StyleChat')}
            style={styles.quickActionTile}
          />
          <QuickActionTile
            label={t('ai_stylist.qa_style_chat')}
            Icon={MessageCircle}
            onPress={() => navigation.navigate('StyleChat')}
            style={styles.quickActionTile}
          />
          <QuickActionTile
            label={t('ai_stylist.qa_find_color')}
            Icon={Palette}
            onPress={() => setComingSoon(t('ai_stylist.qa_find_color'))}
            style={styles.quickActionTile}
          />
          <QuickActionTile
            label={t('ai_stylist.qa_find_fit')}
            Icon={Ruler}
            onPress={() => setComingSoon(t('ai_stylist.qa_find_fit'))}
            style={styles.quickActionTile}
          />
          <QuickActionTile
            label={t('ai_stylist.qa_rate_style')}
            Icon={Star}
            onPress={() => setComingSoon(t('ai_stylist.qa_rate_style'))}
            style={styles.quickActionTile}
          />
          <QuickActionTile
            label={t('ai_stylist.qa_try_on')}
            Icon={Camera}
            onPress={() => setComingSoon(t('ai_stylist.qa_try_on'))}
            style={styles.quickActionTile}
          />
        </View>

        {/* Today's outfit */}
        <Text style={styles.sectionTitle}>{t('ai_stylist.today_outfit')}</Text>
        {loading ? (
          <View style={styles.loadingBox}>
            <SkeletonBox
              width={40}
              height={40}
              borderRadius={20}
              style={{ marginBottom: 12 }}
            />
            <SkeletonText width="60%" />
          </View>
        ) : recommendation ? (
          <GlassCard
            variant="glow"
            onPress={() =>
              navigation.navigate('OutfitDetails', { outfit: recommendation })
            }
          >
            <Text style={styles.outfitTitle}>{recommendation.title}</Text>
            <Text style={styles.stylistNote} numberOfLines={2}>
              {recommendation.stylistNote}
            </Text>
            <View style={styles.itemsPreviewRow}>
              {recommendation.items.map(item => {
                const ItemIcon = getClothingIconComponent(item.emoji);
                return (
                  <View key={item.id} style={styles.itemMiniCard}>
                    <ItemIcon size={22} color={styles.iconTint.color} />
                  </View>
                );
              })}
            </View>
            <View style={styles.viewMoreRow}>
              <Text style={styles.viewMoreText}>
                {t('ai_stylist.view_full_outfit')}
              </Text>
              <ChevronRight size={16} color={styles.iconTint.color} />
            </View>
          </GlassCard>
        ) : (
          <GlassCard variant="default">
            <Text style={styles.emptyOutfitText}>
              {t('ai_stylist.no_items_yet')}
            </Text>
            <Button
              title={t('style_pantry.add_item_btn')}
              onPress={() => navigation.navigate('AddEditClothing', {})}
              style={{ marginTop: 8 }}
            />
          </GlassCard>
        )}

        {/* Recently added items */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionTitle}>
            {t('ai_stylist.recently_added')}
          </Text>
          <Pressable onPress={() => navigation.navigate('Wardrobe')}>
            <ChevronRight size={18} color={styles.iconTint.color} />
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.recentScroll}
        >
          <Pressable
            style={styles.addRecentTile}
            onPress={() => navigation.navigate('AddEditClothing', {})}
          >
            <Plus size={20} color={styles.iconTint.color} />
          </Pressable>
          {recentItems.map(item => {
            const ItemIcon = getClothingIconComponent(item.emoji);
            return (
              <Pressable
                key={item.id}
                style={styles.recentTile}
                onPress={() =>
                  navigation.navigate('ClothingDetails', { itemId: item.id })
                }
              >
                <ItemIcon size={22} color={styles.iconTint.color} />
              </Pressable>
            );
          })}
        </ScrollView>
      </ScrollView>

      <BottomSheet
        visible={!!comingSoon}
        onClose={() => setComingSoon(null)}
        title={comingSoon || ''}
      >
        <Text style={styles.comingSoonText}>{t('ai_stylist.coming_soon')}</Text>
        <Button
          title={t('ai_stylist.coming_soon_ok')}
          onPress={() => setComingSoon(null)}
          style={{ marginTop: 8 }}
        />
      </BottomSheet>
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
    headerRightGroup: {
      flexDirection: 'row',
      gap: spacing.xs,
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
    headerIcon: { color: colors.textPrimary },
    iconTint: { color: colors.primary },
    headerTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 18,
      color: colors.textPrimary,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    greeting: {
      fontFamily: fonts.sansBold,
      fontSize: 22,
      color: colors.textPrimary,
      marginTop: spacing.sm,
    },
    subGreeting: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
      marginBottom: spacing.lg,
    },
    quickActionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: spacing.lg,
    },
    quickActionTile: {
      width: '33.33%',
    },
    sectionTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    loadingBox: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.lg,
    },
    outfitTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: colors.textPrimary,
    },
    stylistNote: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: spacing.xs,
      lineHeight: 18,
    },
    itemsPreviewRow: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginTop: spacing.md,
    },
    itemMiniCard: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewMoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginTop: spacing.md,
      gap: 2,
    },
    viewMoreText: {
      fontFamily: fonts.sansBold,
      fontSize: 12,
      color: colors.primary,
    },
    emptyOutfitText: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textSecondary,
    },
    listHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    recentScroll: {
      gap: spacing.sm,
      paddingBottom: spacing.xs,
    },
    addRecentTile: {
      width: 56,
      height: 56,
      borderRadius: radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recentTile: {
      width: 56,
      height: 56,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    comingSoonText: {
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: spacing.sm,
    },
  });
