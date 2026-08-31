import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Calendar from 'lucide-react-native/icons/calendar';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import Button from '../../../components/Button';
import {
  loadClothingItems,
  MOCK_WEATHER,
  MOCK_EVENTS,
  generateAIOutfit,
} from '../stylePantryStore';
import { getClothingIconComponent, getWeatherIconComponent } from '../clothingIcons';
import type { CalendarEvent, ClothingItem, OutfitRecommendation } from '../types';
import { subscribeToLanguageChanges, t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'StyleMirror'>;

export default function StyleMirrorScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [, setLocaleVersion] = useState(0);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent>(MOCK_EVENTS[0]);
  const [recommendation, setRecommendation] = useState<OutfitRecommendation | null>(null);
  const [generating, setGenerating] = useState(false);
  const WeatherIcon = getWeatherIconComponent(MOCK_WEATHER.condition);

  const initData = async () => {
    setLoading(true);
    const loadedItems = await loadClothingItems();
    setItems(loadedItems);
    if (loadedItems.length > 0) {
      const outfit = generateAIOutfit(MOCK_WEATHER, MOCK_EVENTS[0], loadedItems);
      setRecommendation(outfit);
    }
    setLoading(false);
  };

  useEffect(() => {
    const unsubLang = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    initData();
    return () => {
      unsubLang();
    };
  }, []);

  const handleEventSelect = (evt: CalendarEvent) => {
    setSelectedEvent(evt);
    if (items.length > 0) {
      setGenerating(true);
      setTimeout(() => {
        const outfit = generateAIOutfit(MOCK_WEATHER, evt, items);
        setRecommendation(outfit);
        setGenerating(false);
      }, 300);
    }
  };

  const handleGenerateAnother = () => {
    if (items.length > 0) {
      setGenerating(true);
      setTimeout(() => {
        const outfit = generateAIOutfit(MOCK_WEATHER, selectedEvent, items);
        setRecommendation(outfit);
        setGenerating(false);
      }, 300);
    }
  };

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('style_pantry.mirror_title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Weather Context Banner */}
        <View style={styles.weatherHeroCard}>
          <View style={styles.weatherHeroRow}>
            <View style={styles.sunCircle}>
              <WeatherIcon size={24} color="#B45309" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.weatherTitle}>{t('style_pantry.today_weather')}</Text>
              <Text style={styles.weatherSub}>{MOCK_WEATHER.description}</Text>
            </View>
          </View>
        </View>

        {/* Calendar Events Selector */}
        <Text style={styles.sectionTitle}>{t('style_pantry.upcoming_events')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.eventsScroll}>
          {MOCK_EVENTS.map((evt) => (
            <Pressable
              key={evt.id}
              style={[
                styles.eventCard,
                selectedEvent.id === evt.id && styles.eventCardActive,
              ]}
              onPress={() => handleEventSelect(evt)}>
              <View style={styles.eventTimeBadge}>
                <Calendar size={12} color={selectedEvent.id === evt.id ? '#FFFFFF' : '#004F63'} />
                <Text
                  style={[
                    styles.eventTimeText,
                    selectedEvent.id === evt.id && styles.eventTimeTextActive,
                  ]}>
                  {evt.time}
                </Text>
              </View>
              <Text
                style={[
                  styles.eventTitleText,
                  selectedEvent.id === evt.id && styles.eventTitleTextActive,
                ]}
                numberOfLines={1}>
                {evt.title}
              </Text>
              <Text
                style={[
                  styles.eventTypeTag,
                  selectedEvent.id === evt.id && styles.eventTypeTagActive,
                ]}>
                {evt.eventType.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* AI Outfit Suggestion Card */}
        <View style={styles.aiHeaderRow}>
          <Sparkles size={20} color="#7C3AED" />
          <Text style={styles.aiSectionTitle}>{t('style_pantry.ai_recommendation')}</Text>
        </View>

        {loading || generating ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={styles.loadingText}>AI is styling your outfit...</Text>
          </View>
        ) : recommendation ? (
          <View style={styles.recommendationCard}>
            {/* Badges Row */}
            <View style={styles.badgesRow}>
              <View style={styles.matchBadgePurple}>
                <CheckCircle2 size={12} color="#7C3AED" style={{ marginRight: 4 }} />
                <Text style={styles.matchBadgeTextPurple}>
                  {recommendation.occasionSuitability}
                </Text>
              </View>
              <View style={styles.matchBadgeGreen}>
                <CheckCircle2 size={12} color="#16A34A" style={{ marginRight: 4 }} />
                <Text style={styles.matchBadgeTextGreen}>
                  {recommendation.weatherSuitability}
                </Text>
              </View>
            </View>

            {/* Selected Outfit Items Visual Grid */}
            <Text style={styles.outfitTitle}>{recommendation.title}</Text>
            <Text style={styles.stylistNote}>{recommendation.stylistNote}</Text>

            <View style={styles.itemsPreviewRow}>
              {recommendation.items.map((item) => {
                const ItemIcon = getClothingIconComponent(item.emoji);
                return (
                  <View key={item.id} style={styles.itemMiniCard}>
                    <ItemIcon size={24} color="#004F63" style={styles.itemMiniIcon} />
                    <Text style={styles.itemMiniName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemMiniCat}>{item.category}</Text>
                  </View>
                );
              })}
            </View>

            {/* Actions */}
            <View style={styles.actionRow}>
              <Pressable style={styles.reGenerateBtn} onPress={handleGenerateAnother}>
                <RefreshCw size={16} color="#7C3AED" style={{ marginRight: 6 }} />
                <Text style={styles.reGenerateText}>{t('style_pantry.generate_another')}</Text>
              </Pressable>
            </View>

            <Button
              title={t('style_pantry.view_outfit_details')}
              onPress={() =>
                navigation.navigate('OutfitDetails', { outfit: recommendation })
              }
              style={styles.viewOutfitBtn}
            />
          </View>
        ) : null}
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
    headerTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 18,
      color: colors.textPrimary,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    weatherHeroCard: {
      backgroundColor: '#FEF3C7',
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: '#FDE68A',
      marginBottom: spacing.md,
      ...shadow.soft,
    },
    weatherHeroRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sunCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    weatherTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: '#92400E',
    },
    weatherSub: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: '#B45309',
      marginTop: 2,
    },
    sectionTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    eventsScroll: {
      paddingVertical: spacing.xs,
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    eventCard: {
      width: 160,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: spacing.xs,
      ...shadow.soft,
    },
    eventCardActive: {
      backgroundColor: '#004F63',
      borderColor: '#004F63',
    },
    eventTimeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: spacing.xs,
    },
    eventTimeText: {
      fontFamily: fonts.sansBold,
      fontSize: 11,
      color: '#004F63',
    },
    eventTimeTextActive: {
      color: '#FFFFFF',
    },
    eventTitleText: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    eventTitleTextActive: {
      color: '#FFFFFF',
    },
    eventTypeTag: {
      fontFamily: fonts.sansMedium,
      fontSize: 10,
      color: colors.textSecondary,
    },
    eventTypeTagActive: {
      color: '#E0F2FE',
    },
    aiHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: spacing.xs,
      marginTop: spacing.xs,
    },
    aiSectionTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: '#7C3AED',
    },
    loadingBox: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xxl,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    loadingText: {
      fontFamily: fonts.sansMedium,
      fontSize: 14,
      color: '#7C3AED',
      marginTop: spacing.md,
    },
    recommendationCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: '#DDD6FE',
      ...shadow.soft,
    },
    badgesRow: {
      gap: 6,
      marginBottom: spacing.sm,
    },
    matchBadgePurple: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#F3E8FF',
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.md,
    },
    matchBadgeTextPurple: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: '#6D28D9',
    },
    matchBadgeGreen: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#DCFCE7',
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.md,
    },
    matchBadgeTextGreen: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: '#15803D',
    },
    outfitTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 17,
      color: colors.textPrimary,
      marginTop: spacing.xs,
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
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginVertical: spacing.md,
    },
    itemMiniCard: {
      width: '31%',
      backgroundColor: '#F8FAFC',
      borderRadius: radius.md,
      padding: spacing.sm,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    itemMiniIcon: {
      marginBottom: 2,
    },
    itemMiniName: {
      fontFamily: fonts.sansBold,
      fontSize: 11,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    itemMiniCat: {
      fontFamily: fonts.sans,
      fontSize: 9,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginTop: 2,
    },
    actionRow: {
      marginBottom: spacing.md,
    },
    reGenerateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F3E8FF',
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
    },
    reGenerateText: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: '#7C3AED',
    },
    viewOutfitBtn: {
      backgroundColor: '#7C3AED',
    },
  });
