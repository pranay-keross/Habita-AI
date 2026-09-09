import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import useAuth from '../../../hooks/useAuth';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Calendar from 'lucide-react-native/icons/calendar';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import Plus from 'lucide-react-native/icons/plus';
import ClockArrowLeft from 'lucide-react-native/icons/clock-arrow-left';
import Button from '../../../components/Button';
import GlassCard from '../../../components/GlassCard';
import BottomSheet from '../../../components/BottomSheet';
import { SkeletonBox, SkeletonText } from '../../../components/Skeleton';
import {
  loadClothingItems,
  loadWeather,
  loadOccasions,
  createOccasionEntry,
  generateOutfitRecommendation,
} from '../stylePantryStore';
import {
  getClothingIconComponent,
  getWeatherIconComponent,
} from '../clothingIcons';
import { MOODS, getMoodIconComponent } from '../moods';
import type {
  CalendarEvent,
  ClothingItem,
  EventType,
  Mood,
  OutfitRecommendation,
  WeatherContext,
} from '../types';
import { subscribeToLanguageChanges, t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'StyleMirror'>;

const EVENT_TYPES: EventType[] = [
  'office',
  'formal',
  'meeting',
  'party',
  'casual',
  'workout',
];

// Label keys follow `style_pantry.mood_{mood}` — see MOODS in `../moods.ts`.
function moodLabelKey(mood: Mood): string {
  return `style_pantry.mood_${mood}`;
}

function formatTimeLabel(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(
    2,
    '0',
  )} ${period}`;
}

export default function StyleMirrorScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuth();
  const [, setLocaleVersion] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [weather, setWeather] = useState<WeatherContext | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );
  const [recommendation, setRecommendation] =
    useState<OutfitRecommendation | null>(null);
  const [generating, setGenerating] = useState(false);

  const [selectedMood, setSelectedMood] = useState<Mood>('confident');

  const [showAddSheet, setShowAddSheet] = useState(false);
  const [savingOccasion, setSavingOccasion] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newTimeDate, setNewTimeDate] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [newLocation, setNewLocation] = useState('');
  const [newType, setNewType] = useState<EventType>('office');

  const WeatherIcon = getWeatherIconComponent(weather?.condition);

  const generateFor = useCallback(
    async (
      evt: CalendarEvent,
      w: WeatherContext,
      list: ClothingItem[],
      mood?: Mood,
    ) => {
      setGenerating(true);
      try {
        const token = await getAccessToken();
        const outfit = await generateOutfitRecommendation(
          w,
          evt,
          list,
          token,
          mood,
        );
        setRecommendation(outfit);
      } catch {
        setRecommendation(null);
      } finally {
        setGenerating(false);
      }
    },
    [getAccessToken],
  );

  const initData = useCallback(async () => {
    const token = await getAccessToken();
    const [loadedItems, loadedWeather, loadedEvents] = await Promise.all([
      loadClothingItems(token),
      loadWeather(token),
      loadOccasions(token),
    ]);
    setItems(loadedItems);
    setWeather(loadedWeather);
    setEvents(loadedEvents);
    const firstEvent = loadedEvents[0] || null;
    setSelectedEvent(firstEvent);
    if (firstEvent && loadedItems.length > 0) {
      await generateFor(firstEvent, loadedWeather, loadedItems, selectedMood);
    }
    // `selectedMood` deliberately excluded: this only drives the one-time initial
    // generation on mount, using whatever mood is selected at that moment — later mood
    // changes regenerate via `handleMoodSelect` instead, so this effect doesn't need to
    // (and shouldn't) re-run and re-fetch weather/items/events on every mood tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAccessToken, generateFor]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await initData();
    setRefreshing(false);
  }, [initData]);

  useEffect(() => {
    const unsubLang = subscribeToLanguageChanges(() =>
      setLocaleVersion(v => v + 1),
    );
    setLoading(true);
    initData().finally(() => setLoading(false));
    return () => {
      unsubLang();
    };
  }, [initData]);

  const handleEventSelect = (evt: CalendarEvent) => {
    setSelectedEvent(evt);
    if (weather && items.length > 0) {
      generateFor(evt, weather, items, selectedMood);
    }
  };

  const handleGenerateAnother = () => {
    if (selectedEvent && weather && items.length > 0) {
      generateFor(selectedEvent, weather, items, selectedMood);
    }
  };

  const handleMoodSelect = (mood: Mood) => {
    setSelectedMood(mood);
    if (selectedEvent && weather && items.length > 0) {
      generateFor(selectedEvent, weather, items, mood);
    }
  };

  const resetAddForm = () => {
    setNewTitle('');
    setNewTime('');
    setNewTimeDate(null);
    setShowTimePicker(false);
    setNewLocation('');
    setNewType('office');
  };

  const handleTimeChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowTimePicker(false);
    if (event.type === 'set' && selected) {
      setNewTimeDate(selected);
      setNewTime(formatTimeLabel(selected));
    }
  };

  const handleSaveOccasion = async () => {
    if (!newTitle.trim() || !newTime.trim()) {
      Alert.alert(
        t('style_pantry.missing_occasion_title'),
        t('style_pantry.enter_occasion_title_msg'),
      );
      return;
    }
    setSavingOccasion(true);
    const token = await getAccessToken();
    const { occasion } = await createOccasionEntry(
      {
        title: newTitle.trim(),
        date: new Date().toISOString().split('T')[0],
        time: newTime.trim(),
        eventType: newType,
        location: newLocation.trim() || undefined,
      },
      token,
    );
    setSavingOccasion(false);
    setShowAddSheet(false);
    resetAddForm();
    setEvents(prev => [occasion, ...prev]);
    setSelectedEvent(occasion);
    if (weather && items.length > 0) {
      generateFor(occasion, weather, items, selectedMood);
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
        <Pressable
          onPress={() => navigation.navigate('StyleLog')}
          style={styles.headerBtn}
        >
          <ClockArrowLeft size={18} color={styles.headerIcon.color} />
        </Pressable>
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
        {/* Weather Context Banner */}
        {loading || !weather ? (
          <View style={styles.weatherHeroCard}>
            <View style={styles.weatherHeroRow}>
              <SkeletonBox
                width={44}
                height={44}
                borderRadius={22}
                style={{ marginRight: 12 }}
              />
              <View style={{ flex: 1 }}>
                <SkeletonText width="40%" style={{ marginBottom: 6 }} />
                <SkeletonText width="65%" height={12} />
              </View>
            </View>
          </View>
        ) : (
          <GlassCard variant="elevated" style={styles.weatherHeroCard}>
            <View style={styles.weatherHeroRow}>
              <View style={styles.sunCircle}>
                <WeatherIcon size={24} color={styles.weatherIconColor.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.weatherTitle}>
                  {weather.city
                    ? t('style_pantry.weather_location', { city: weather.city })
                    : t('style_pantry.today_weather')}
                </Text>
                <Text style={styles.weatherSub}>{weather.description}</Text>
              </View>
            </View>
          </GlassCard>
        )}

        {/* Mood Selector — feeds the outfit pick alongside weather + occasion */}
        <Text style={styles.sectionTitle}>{t('style_pantry.mood_prompt')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.moodScroll}
        >
          {MOODS.map(mood => {
            const MoodIcon = getMoodIconComponent(mood);
            const active = selectedMood === mood;
            return (
              <Pressable
                key={mood}
                style={[styles.moodChip, active && styles.moodChipActive]}
                onPress={() => handleMoodSelect(mood)}
              >
                {MoodIcon ? (
                  <MoodIcon
                    size={14}
                    color={
                      active
                        ? styles.headerIconOnPrimary.color
                        : styles.iconTint.color
                    }
                    style={styles.moodChipIcon}
                  />
                ) : null}
                <Text
                  style={[
                    styles.moodChipText,
                    active && styles.moodChipTextActive,
                  ]}
                >
                  {t(moodLabelKey(mood))}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Calendar Events Selector */}
        <Text style={styles.sectionTitle}>
          {t('style_pantry.upcoming_events')}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.eventsScroll}
        >
          {events.map(evt => (
            <Pressable
              key={evt.id}
              style={[
                styles.eventCard,
                selectedEvent?.id === evt.id && styles.eventCardActive,
              ]}
              onPress={() => handleEventSelect(evt)}
            >
              <View style={styles.eventTimeBadge}>
                <Calendar
                  size={12}
                  color={
                    selectedEvent?.id === evt.id
                      ? styles.headerIconOnPrimary.color
                      : styles.iconTint.color
                  }
                />
                <Text
                  style={[
                    styles.eventTimeText,
                    selectedEvent?.id === evt.id && styles.eventTimeTextActive,
                  ]}
                >
                  {evt.time}
                </Text>
              </View>
              <Text
                style={[
                  styles.eventTitleText,
                  selectedEvent?.id === evt.id && styles.eventTitleTextActive,
                ]}
                numberOfLines={1}
              >
                {evt.title}
              </Text>
              <Text
                style={[
                  styles.eventTypeTag,
                  selectedEvent?.id === evt.id && styles.eventTypeTagActive,
                ]}
              >
                {evt.eventType.toUpperCase()}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={styles.addEventCard}
            onPress={() => setShowAddSheet(true)}
          >
            <Plus size={18} color={styles.iconTint.color} />
            <Text style={styles.addEventText}>
              {t('style_pantry.add_occasion_short')}
            </Text>
          </Pressable>
        </ScrollView>

        {/* AI Outfit Suggestion Card */}
        <View style={styles.aiHeaderRow}>
          <Sparkles size={20} color={styles.aiAccent.color} />
          <Text style={styles.aiSectionTitle}>
            {t('style_pantry.ai_recommendation')}
          </Text>
        </View>

        {loading || generating ? (
          <View style={styles.loadingBox}>
            <SkeletonBox
              width={40}
              height={40}
              borderRadius={20}
              style={{ marginBottom: 12 }}
            />
            <Text style={styles.loadingText}>
              {t('style_pantry.ai_styling_text')}
            </Text>
          </View>
        ) : recommendation ? (
          <GlassCard variant="glow">
            {/* Badges Row */}
            <View style={styles.badgesRow}>
              <View style={styles.matchBadgePrimary}>
                <CheckCircle2
                  size={12}
                  color={styles.aiAccent.color}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.matchBadgeTextPrimary}>
                  {recommendation.occasionSuitability}
                </Text>
              </View>
              <View style={styles.matchBadgeGreen}>
                <CheckCircle2
                  size={12}
                  color={styles.successColor.color}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.matchBadgeTextGreen}>
                  {recommendation.weatherSuitability}
                </Text>
              </View>
            </View>

            {/* Selected Outfit Items Visual Grid */}
            <Text style={styles.outfitTitle}>{recommendation.title}</Text>
            <Text style={styles.stylistNote}>{recommendation.stylistNote}</Text>

            <View style={styles.itemsPreviewRow}>
              {recommendation.items.map(item => {
                const ItemIcon = getClothingIconComponent(item.emoji);
                return (
                  <View key={item.id} style={styles.itemMiniCard}>
                    <ItemIcon
                      size={24}
                      color={styles.iconTint.color}
                      style={styles.itemMiniIcon}
                    />
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
              <Pressable
                style={styles.reGenerateBtn}
                onPress={handleGenerateAnother}
              >
                <RefreshCw
                  size={16}
                  color={styles.aiAccent.color}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.reGenerateText}>
                  {t('style_pantry.generate_another')}
                </Text>
              </Pressable>
            </View>

            <Button
              title={t('style_pantry.view_outfit_details')}
              onPress={() =>
                navigation.navigate('OutfitDetails', { outfit: recommendation })
              }
            />
          </GlassCard>
        ) : null}
      </ScrollView>

      <BottomSheet
        visible={showAddSheet}
        onClose={() => {
          setShowAddSheet(false);
          resetAddForm();
        }}
        title={t('style_pantry.add_occasion')}
      >
        <Text style={styles.inputLabel}>
          {t('style_pantry.occasion_title_label')}
        </Text>
        <TextInput
          style={styles.textInput}
          value={newTitle}
          onChangeText={setNewTitle}
          placeholder={t('style_pantry.occasion_title_placeholder')}
          placeholderTextColor={styles.placeholder.color}
        />
        <Text style={styles.inputLabel}>
          {t('style_pantry.occasion_time_label')}
        </Text>
        <Pressable
          style={styles.textInput}
          onPress={() => setShowTimePicker(true)}
        >
          <Text
            style={newTime ? styles.timeValueText : styles.timePlaceholderText}
          >
            {newTime || t('style_pantry.occasion_time_placeholder')}
          </Text>
        </Pressable>
        {showTimePicker ? (
          <DateTimePicker
            value={newTimeDate ?? new Date()}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        ) : null}
        <Text style={styles.inputLabel}>
          {t('style_pantry.occasion_type_label')}
        </Text>
        <View style={styles.typeWrap}>
          {EVENT_TYPES.map(type => (
            <Pressable
              key={type}
              style={[
                styles.typeChip,
                newType === type && styles.typeChipActive,
              ]}
              onPress={() => setNewType(type)}
            >
              <Text
                style={[
                  styles.typeChipText,
                  newType === type && styles.typeChipTextActive,
                ]}
              >
                {type.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.inputLabel}>
          {t('style_pantry.occasion_location_label')}
        </Text>
        <TextInput
          style={styles.textInput}
          value={newLocation}
          onChangeText={setNewLocation}
          placeholder={t('style_pantry.occasion_location_placeholder')}
          placeholderTextColor={styles.placeholder.color}
        />
        <Button
          title={t('style_pantry.save_occasion')}
          onPress={handleSaveOccasion}
          loading={savingOccasion}
          style={{ marginTop: 8 }}
        />
      </BottomSheet>
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
    headerIconOnPrimary: {
      color: colors.textOnPrimary,
    },
    iconTint: {
      color: colors.primary,
    },
    aiAccent: {
      color: colors.primary,
    },
    successColor: {
      color: colors.forest,
    },
    weatherIconColor: {
      color: colors.turmeric,
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
      marginBottom: spacing.md,
      padding: spacing.md,
    },
    weatherHeroRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sunCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.turmericSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    weatherTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.textPrimary,
    },
    weatherSub: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    sectionTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    moodScroll: {
      paddingVertical: spacing.xs,
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    moodChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 6,
    },
    moodChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    moodChipIcon: {
      marginRight: 6,
    },
    moodChipText: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textSecondary,
    },
    moodChipTextActive: {
      color: colors.textOnPrimary,
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
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    addEventCard: {
      width: 88,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.blush,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    addEventText: {
      fontFamily: fonts.sansBold,
      fontSize: 12,
      color: colors.primary,
      marginTop: 4,
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
      color: colors.primary,
    },
    eventTimeTextActive: {
      color: colors.textOnPrimary,
    },
    eventTitleText: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    eventTitleTextActive: {
      color: colors.textOnPrimary,
    },
    eventTypeTag: {
      fontFamily: fonts.sansMedium,
      fontSize: 10,
      color: colors.textSecondary,
    },
    eventTypeTagActive: {
      color: colors.textOnPrimaryMuted,
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
      color: colors.textPrimary,
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
      color: colors.textSecondary,
      marginTop: spacing.md,
    },
    badgesRow: {
      gap: 6,
      marginBottom: spacing.sm,
    },
    matchBadgePrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.md,
    },
    matchBadgeTextPrimary: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: colors.primary,
    },
    matchBadgeGreen: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.blush,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.md,
    },
    matchBadgeTextGreen: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: colors.forest,
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
      backgroundColor: colors.surfaceElevated,
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
      backgroundColor: colors.blush,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
    },
    reGenerateText: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.primary,
    },
    inputLabel: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
      marginTop: spacing.sm,
    },
    textInput: {
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.textPrimary,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    placeholder: {
      color: colors.textSecondary,
    },
    timeValueText: {
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.textPrimary,
    },
    timePlaceholderText: {
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.textSecondary,
    },
    typeWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    typeChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    typeChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    typeChipText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.textSecondary,
    },
    typeChipTextActive: {
      color: colors.textOnPrimary,
    },
  });
