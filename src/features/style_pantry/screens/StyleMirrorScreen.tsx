import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import useAuth from '../../../hooks/useAuth';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Calendar from 'lucide-react-native/icons/calendar';
import Send from 'lucide-react-native/icons/send';
import Plus from 'lucide-react-native/icons/plus';
import ClockArrowLeft from 'lucide-react-native/icons/clock-arrow-left';
import Button from '../../../components/Button';
import GlassCard from '../../../components/GlassCard';
import BottomSheet from '../../../components/BottomSheet';
import { SkeletonBox, SkeletonText } from '../../../components/Skeleton';
import {
  createOccasionEntry,
  deleteOccasionEntry,
  generateOutfitRecommendation,
  loadClothingItems,
  loadOccasions,
  loadWeather,
  ownedItems,
  saveOutfit,
  sendStyleMessage,
  todaysEvent,
  unsaveOutfit,
} from '../stylePantryStore';
import OutfitShowcase from '../components/OutfitShowcase';
import TryOnSheet from '../components/TryOnSheet';
import ItemThumb from '../components/ItemThumb';
import { describeStoreError, showStoreErrorAlert } from '../errors';
import { useBusy, useFocusLoad, useKeyboardHeight, useLocaleRerender } from '../hooks';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dateLabel, eventTypeLabel, moodLabel } from '../format';
import WardrobeHeader from '../components/WardrobeHeader';
import OfflineBanner from '../components/OfflineBanner';
import { getWeatherIconComponent } from '../clothingIcons';
import { MOODS, getMoodIconComponent } from '../moods';
import {
  EVENT_TYPES,
  type CalendarEvent,
  type ClothingItem,
  type EventType,
  type Mood,
  type OutfitRecommendation,
  type StyleChatTurn,
  type WeatherContext,
} from '../types';
import { formatTimeLabel, parseDateString, toDateString, todayString } from '../../../utils/date';
import { t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'StyleMirror'>;

/** One entry in the vertical feed of looks. */
type FeedEntry =
  | { id: string; kind: 'look'; outfit: OutfitRecommendation; note?: string }
  | { id: string; kind: 'request'; text: string }
  | { id: string; kind: 'note'; text: string }
  | { id: string; kind: 'items'; text: string; items: ClothingItem[] }
  | { id: string; kind: 'error'; text: string };

const REFINE_CHIPS: { key: string; labelKey: string }[] = [
  { key: 'formal', labelKey: 'style_pantry.refine_formal' },
  { key: 'casual', labelKey: 'style_pantry.refine_casual' },
  { key: 'warmer', labelKey: 'style_pantry.refine_warmer' },
  { key: 'shoes', labelKey: 'style_pantry.refine_shoes' },
];

/** The transcript as the server wants it — look-only turns become their title. */
function toHistory(feed: FeedEntry[]): StyleChatTurn[] {
  const turns: StyleChatTurn[] = [];
  for (const e of feed) {
    if (e.kind === 'request') turns.push({ role: 'user', text: e.text });
    else if (e.kind === 'note' || e.kind === 'items') turns.push({ role: 'assistant', text: e.text });
    else if (e.kind === 'look') turns.push({ role: 'assistant', text: e.note || e.outfit.title });
  }
  return turns;
}

let seq = 0;
function nextId(suffix: string): string {
  seq += 1;
  return `look_${Date.now()}_${seq}_${suffix}`;
}

export default function StyleMirrorScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { getAccessToken } = useAuth();
  useLocaleRerender();

  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [weather, setWeather] = useState<WeatherContext | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [generating, setGenerating] = useState(false);
  const [refineText, setRefineText] = useState('');
  const [selectedMood, setSelectedMood] = useState<Mood>('confident');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [tryOnOutfitTarget, setTryOnOutfitTarget] = useState<OutfitRecommendation | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const bootstrapped = useRef(false);

  const [showAddSheet, setShowAddSheet] = useState(false);
  const [savingOccasion, saveOccasion] = useBusy();
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newTimeDate, setNewTimeDate] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [newDate, setNewDate] = useState<string>(todayString());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newLocation, setNewLocation] = useState('');
  const [newType, setNewType] = useState<EventType>('office');

  const WeatherIcon = getWeatherIconComponent(weather?.condition);
  const hasOwnedItems = ownedItems(items).length > 0;

  const scrollToEnd = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

  // Android (SDK 36, edge-to-edge) ignores adjustResize, so pad the fixed refine bar
  // by the keyboard height ourselves; iOS keeps the KeyboardAvoidingView below.
  const keyboardHeight = useKeyboardHeight();
  const composerBottomPad = (Platform.OS === 'android' && keyboardHeight > 0 ? keyboardHeight : insets.bottom) + 10;
  useEffect(() => {
    if (keyboardHeight > 0) scrollToEnd();
  }, [keyboardHeight]);

  const generateFor = useCallback(
    async (evt: CalendarEvent, mood: Mood | undefined) => {
      setGenerating(true);
      try {
        const token = await getAccessToken();
        const result = await generateOutfitRecommendation({ event: evt, mood }, token);
        setFeed(prev => [
          ...prev,
          result.ok
            ? { id: nextId('look'), kind: 'look', outfit: result.data }
            : { id: nextId('err'), kind: 'error', text: describeStoreError(result.error) },
        ]);
      } finally {
        setGenerating(false);
        scrollToEnd();
      }
    },
    [getAccessToken],
  );

  const startFresh = useCallback(
    async (evt: CalendarEvent, mood: Mood) => {
      setFeed([]);
      await generateFor(evt, mood);
    },
    [generateFor],
  );

  const load = useCallback(async () => {
    const token = await getAccessToken();
    const [itemsRes, weatherRes, eventsRes] = await Promise.all([
      loadClothingItems(token),
      loadWeather(token),
      loadOccasions(token),
    ]);
    setItems(itemsRes.data);
    setWeather(weatherRes.data);
    setEvents(eventsRes.data);
    setSelectedEvent(prev => {
      const stillThere = prev && eventsRes.data.find(e => e.id === prev.id);
      return stillThere ?? (prev?.id === 'today' ? prev : eventsRes.data[0] ?? null);
    });
    if (!bootstrapped.current) {
      bootstrapped.current = true;
      const first = eventsRes.data[0];
      if (first && ownedItems(itemsRes.data).length > 0) {
        await startFresh(first, selectedMood);
      }
    }
    return { offline: itemsRes.offline || eventsRes.offline };
    // selectedMood is only read for the very first generation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAccessToken, startFresh]);

  const { loading, refreshing, offline, refresh } = useFocusLoad(load);

  const handleEventSelect = (evt: CalendarEvent) => {
    setSelectedEvent(evt);
    if (hasOwnedItems) startFresh(evt, selectedMood);
  };

  const handleGenerate = () => {
    if (generating) return;
    const evt = selectedEvent ?? todaysEvent();
    if (!selectedEvent) setSelectedEvent(evt);
    startFresh(evt, selectedMood);
  };

  const handleMoodSelect = (mood: Mood) => {
    setSelectedMood(mood);
    if (selectedEvent && hasOwnedItems) startFresh(selectedEvent, mood);
  };

  const handleRegenerate = () => {
    if (!generating) generateFor(selectedEvent ?? todaysEvent(), selectedMood);
  };

  const handleRefine = async (message: string) => {
    const text = message.trim();
    if (!text || generating) return;
    const evt = selectedEvent ?? todaysEvent();
    if (!selectedEvent) setSelectedEvent(evt);
    setRefineText('');
    const history = toHistory(feed);
    setFeed(prev => [...prev, { id: nextId('req'), kind: 'request', text }]);
    setGenerating(true);
    scrollToEnd();
    try {
      const token = await getAccessToken();
      const result = await sendStyleMessage({ message: text, history, event: evt, mood: selectedMood }, token);
      setFeed(prev => {
        if (!result.ok) {
          return [...prev, { id: nextId('err'), kind: 'error', text: describeStoreError(result.error) }];
        }
        const { reply, outfit, items } = result.data;
        if (outfit) return [...prev, { id: nextId('look'), kind: 'look', outfit, note: reply }];
        if (items && items.length > 0) return [...prev, { id: nextId('items'), kind: 'items', text: reply, items }];
        if (reply) return [...prev, { id: nextId('note'), kind: 'note', text: reply }];
        return prev;
      });
    } finally {
      setGenerating(false);
      scrollToEnd();
    }
  };

  const handleToggleSave = async (entryId: string, outfit: OutfitRecommendation) => {
    if (savingId) return;
    setSavingId(entryId);
    try {
      const token = await getAccessToken();
      if (outfit.isSaved) {
        const result = await unsaveOutfit(outfit.id, token);
        if (!result.ok) {
          showStoreErrorAlert(result.error);
          return;
        }
        setFeed(prev =>
          prev.map(e => (e.kind === 'look' && e.id === entryId ? { ...e, outfit: { ...e.outfit, isSaved: false } } : e)),
        );
        return;
      }
      const result = await saveOutfit(outfit, token);
      if (!result.ok) {
        showStoreErrorAlert(result.error);
        return;
      }
      setFeed(prev => prev.map(e => (e.kind === 'look' && e.id === entryId ? { ...e, outfit: result.data } : e)));
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteOccasion = (evt: CalendarEvent) => {
    Alert.alert(t('style_pantry.delete_occasion'), t('style_pantry.delete_occasion_confirm'), [
      { text: t('style_pantry.cancel'), style: 'cancel' },
      {
        text: t('style_pantry.delete'),
        style: 'destructive',
        onPress: async () => {
          const token = await getAccessToken();
          const result = await deleteOccasionEntry(evt.id, token);
          if (!result.ok) {
            showStoreErrorAlert(result.error);
            return;
          }
          setEvents(prev => prev.filter(e => e.id !== evt.id));
          if (selectedEvent?.id === evt.id) {
            setSelectedEvent(null);
            setFeed([]);
          }
        },
      },
    ]);
  };

  const resetAddForm = () => {
    setNewTitle('');
    setNewTime('');
    setNewTimeDate(null);
    setShowTimePicker(false);
    setNewDate(todayString());
    setShowDatePicker(false);
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

  const handleDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowDatePicker(false);
    if (event.type === 'set' && selected) setNewDate(toDateString(selected));
  };

  const handleSaveOccasion = () =>
    saveOccasion(async () => {
      if (!newTitle.trim() || !newTime.trim()) {
        Alert.alert(t('style_pantry.missing_occasion_title'), t('style_pantry.enter_occasion_title_msg'));
        return;
      }
      const token = await getAccessToken();
      const result = await createOccasionEntry(
        {
          title: newTitle.trim(),
          date: newDate,
          time: newTime.trim(),
          eventType: newType,
          location: newLocation.trim() || undefined,
        },
        token,
      );
      if (!result.ok) {
        showStoreErrorAlert(result.error);
        return;
      }
      setShowAddSheet(false);
      resetAddForm();
      setEvents(prev => [result.data, ...prev]);
      setSelectedEvent(result.data);
      if (hasOwnedItems) startFresh(result.data, selectedMood);
    });

  const latestLookIndex = (() => {
    for (let i = feed.length - 1; i >= 0; i--) if (feed[i].kind === 'look') return i;
    return -1;
  })();
  const hasLook = latestLookIndex >= 0;

  const renderEventChip = (evt: CalendarEvent) => {
    const active = selectedEvent?.id === evt.id;
    return (
      <Pressable
        key={evt.id}
        style={[styles.eventCard, active && styles.eventCardActive]}
        onPress={() => handleEventSelect(evt)}
        onLongPress={() => handleDeleteOccasion(evt)}
        accessibilityRole="button"
        accessibilityLabel={evt.title}
      >
        <View style={styles.eventTimeBadge}>
          <Calendar size={12} color={active ? styles.onPrimary.color : styles.iconTint.color} />
          <Text style={[styles.eventTimeText, active && styles.onPrimaryText]} numberOfLines={1}>
            {dateLabel(evt.date)}
            {evt.time ? ` · ${evt.time}` : ''}
          </Text>
        </View>
        <Text style={[styles.eventTitleText, active && styles.onPrimaryText]} numberOfLines={1}>
          {evt.title}
        </Text>
        <Text style={[styles.eventTypeTag, active && styles.onPrimaryMutedText]}>{eventTypeLabel(evt.eventType)}</Text>
      </Pressable>
    );
  };

  const renderEntry = (entry: FeedEntry, idx: number) => {
    switch (entry.kind) {
      case 'request':
        return (
          <View key={entry.id} style={styles.requestRow}>
            <View style={styles.requestPill}>
              <Text style={styles.requestText}>{entry.text}</Text>
            </View>
          </View>
        );
      case 'error':
        return (
          <View key={entry.id} style={styles.errorBubble}>
            <Text style={styles.errorText}>{entry.text}</Text>
          </View>
        );
      case 'note':
        return (
          <View key={entry.id} style={styles.noteBubble}>
            <Sparkles size={14} color={styles.iconTint.color} />
            <Text style={styles.noteText}>{entry.text}</Text>
          </View>
        );
      case 'items':
        return (
          <View key={entry.id}>
            <View style={styles.noteBubble}>
              <Sparkles size={14} color={styles.iconTint.color} />
              <Text style={styles.noteText}>{entry.text}</Text>
            </View>
            <View style={styles.itemsGrid}>
              {entry.items.map(i => (
                <Pressable
                  key={i.id}
                  style={styles.itemTile}
                  onPress={() => navigation.navigate('ClothingDetails', { itemId: i.id })}
                  accessibilityRole="button"
                  accessibilityLabel={i.name}
                >
                  <ItemThumb item={i} size={68} radius={14} />
                  <Text style={styles.itemTileText} numberOfLines={1}>
                    {i.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      case 'look': {
        const isLatest = idx === latestLookIndex;
        return (
          <View key={entry.id}>
            {entry.note ? (
              <View style={styles.noteBubble}>
                <Sparkles size={14} color={styles.iconTint.color} />
                <Text style={styles.noteText}>{entry.note}</Text>
              </View>
            ) : null}
            <OutfitShowcase
              outfit={entry.outfit}
              layout="chat"
              busy={generating || savingId === entry.id}
              onView={() => navigation.navigate('OutfitDetails', { outfit: entry.outfit })}
              onToggleSave={() => handleToggleSave(entry.id, entry.outfit)}
              onRegenerate={isLatest ? handleRegenerate : undefined}
              onTryOn={() => setTryOnOutfitTarget(entry.outfit)}
              onItemPress={item => navigation.navigate('ClothingDetails', { itemId: item.id })}
            />
          </View>
        );
      }
      default:
        return null;
    }
  };

  const Root = Platform.OS === 'ios' ? KeyboardAvoidingView : View;

  return (
    <Root style={styles.flex} behavior="padding">
      <View style={styles.root}>
        <WardrobeHeader
          title={t('style_pantry.mirror_title')}
          onBack={() => navigation.goBack()}
          right={{
            icon: ClockArrowLeft,
            onPress: () => navigation.navigate('StyleLog'),
            accessibilityLabel: t('style_pantry.style_log_title'),
          }}
        />

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={styles.iconTint.color} colors={[styles.iconTint.color]} />
          }
        >
          <OfflineBanner visible={offline} />

          {/* Weather */}
          {loading ? (
            <View style={styles.weatherCard}>
              <View style={styles.weatherRow}>
                <SkeletonBox width={44} height={44} borderRadius={22} style={styles.skeletonGap} />
                <View style={styles.flex}>
                  <SkeletonText width="40%" style={styles.skeletonLine} />
                  <SkeletonText width="65%" height={12} />
                </View>
              </View>
            </View>
          ) : weather ? (
            <GlassCard variant="elevated" style={styles.weatherCard}>
              <View style={styles.weatherRow}>
                <View style={styles.sunCircle}>
                  <WeatherIcon size={24} color={styles.weatherIcon.color} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.weatherTitle}>
                    {weather.city ? t('style_pantry.weather_location', { city: weather.city }) : t('style_pantry.today_weather')}
                  </Text>
                  <Text style={styles.weatherSub}>{weather.description}</Text>
                </View>
              </View>
            </GlassCard>
          ) : null}

          {/* Mood */}
          <Text style={styles.sectionTitle}>{t('style_pantry.mood_prompt')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moodScroll}>
            {MOODS.map(mood => {
              const MoodIcon = getMoodIconComponent(mood);
              const active = selectedMood === mood;
              return (
                <Pressable
                  key={mood}
                  style={[styles.moodChip, active && styles.moodChipActive]}
                  onPress={() => handleMoodSelect(mood)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  {MoodIcon ? <MoodIcon size={14} color={active ? styles.onPrimary.color : styles.iconTint.color} style={styles.moodChipIcon} /> : null}
                  <Text style={[styles.moodChipText, active && styles.onPrimaryText]}>{moodLabel(mood)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Occasions */}
          <Text style={styles.sectionTitle}>{t('style_pantry.upcoming_events')}</Text>
          {!loading && events.length === 0 ? (
            <GlassCard variant="default" style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t('style_pantry.no_occasions_title')}</Text>
              <Text style={styles.emptySub}>{t('style_pantry.no_occasions_sub')}</Text>
              <View style={styles.emptyActions}>
                <Button title={t('style_pantry.add_occasion')} onPress={() => setShowAddSheet(true)} variant="outline" style={styles.flex} showArrow={false} />
              </View>
            </GlassCard>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventsScroll}>
              {events.map(renderEventChip)}
              <Pressable style={styles.addEventCard} onPress={() => setShowAddSheet(true)} accessibilityRole="button" accessibilityLabel={t('style_pantry.add_occasion')}>
                <Plus size={18} color={styles.iconTint.color} />
                <Text style={styles.addEventText}>{t('style_pantry.add_occasion_short')}</Text>
              </Pressable>
            </ScrollView>
          )}

          {!loading && !hasOwnedItems ? (
            <GlassCard variant="default" style={styles.emptyCard}>
              <Text style={styles.emptySub}>{t('ai_stylist.no_items_yet')}</Text>
              <Button title={t('style_pantry.add_item_btn')} onPress={() => navigation.navigate('AddEditClothing', {})} style={styles.emptyBtn} />
            </GlassCard>
          ) : null}

          {/* Looks feed */}
          <View style={styles.feedHeader}>
            <Sparkles size={18} color={styles.iconTint.color} />
            <Text style={styles.feedTitle}>{t('style_pantry.ai_recommendation')}</Text>
          </View>

          {!loading && hasOwnedItems && !hasLook && !generating ? (
            <GlassCard variant="glow" style={styles.ctaCard}>
              <Text style={styles.ctaTitle}>
                {selectedEvent ? selectedEvent.title : t('ai_stylist.today_outfit_event_title')}
              </Text>
              <Text style={styles.ctaSub}>{t('style_pantry.ai_banner_sub')}</Text>
              <Button title={t('style_pantry.generate_look')} onPress={handleGenerate} style={styles.emptyBtn} />
            </GlassCard>
          ) : null}

          {feed.map(renderEntry)}

          {generating ? (
            <View style={styles.typingRow}>
              <SkeletonBox width={10} height={10} borderRadius={5} />
              <SkeletonBox width={10} height={10} borderRadius={5} />
              <SkeletonBox width={10} height={10} borderRadius={5} />
              <Text style={styles.typingText}>{t('style_pantry.stylist_typing')}</Text>
            </View>
          ) : null}

        </ScrollView>

        {/* Refine bar: fixed below the feed so it rides above the keyboard like a chat composer */}
        {hasLook ? (
          <View style={[styles.refineBar, { paddingBottom: composerBottomPad }]}>
            <Text style={styles.refineTitle}>{t('style_pantry.refine_title')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.refineChipScroll}>
              {REFINE_CHIPS.map(chip => (
                <Pressable
                  key={chip.key}
                  style={[styles.refineChip, generating && styles.disabled]}
                  onPress={() => handleRefine(t(chip.labelKey))}
                  disabled={generating}
                  accessibilityRole="button"
                >
                  <Text style={styles.refineChipText}>{t(chip.labelKey)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.refineRow}>
              <TextInput
                style={styles.refineInput}
                value={refineText}
                onChangeText={setRefineText}
                placeholder={t('style_pantry.refine_placeholder')}
                placeholderTextColor={styles.placeholder.color}
                onSubmitEditing={() => handleRefine(refineText)}
                returnKeyType="send"
                editable={!generating}
              />
              <Pressable
                style={[styles.sendBtn, (generating || !refineText.trim()) && styles.disabled]}
                onPress={() => handleRefine(refineText)}
                disabled={generating || !refineText.trim()}
                accessibilityRole="button"
                accessibilityLabel={t('style_pantry.sending')}
              >
                <Send size={18} color={styles.onPrimary.color} />
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      <BottomSheet
        visible={showAddSheet}
        onClose={() => {
          setShowAddSheet(false);
          resetAddForm();
        }}
        title={t('style_pantry.add_occasion')}
      >
        <Text style={styles.inputLabel}>{t('style_pantry.occasion_title_label')}</Text>
        <TextInput style={styles.textInput} value={newTitle} onChangeText={setNewTitle} placeholder={t('style_pantry.occasion_title_placeholder')} placeholderTextColor={styles.placeholder.color} />
        <Text style={styles.inputLabel}>{t('style_pantry.occasion_date_label')}</Text>
        <Pressable style={styles.textInput} onPress={() => setShowDatePicker(true)} accessibilityRole="button">
          <Text style={styles.valueText}>{dateLabel(newDate)}</Text>
        </Pressable>
        {showDatePicker ? <DateTimePicker value={parseDateString(newDate)} mode="date" display="default" onChange={handleDateChange} /> : null}
        <Text style={styles.inputLabel}>{t('style_pantry.occasion_time_label')}</Text>
        <Pressable style={styles.textInput} onPress={() => setShowTimePicker(true)} accessibilityRole="button">
          <Text style={newTime ? styles.valueText : styles.placeholderText}>{newTime || t('style_pantry.occasion_time_placeholder')}</Text>
        </Pressable>
        {showTimePicker ? <DateTimePicker value={newTimeDate ?? new Date()} mode="time" display="default" onChange={handleTimeChange} /> : null}
        <Text style={styles.inputLabel}>{t('style_pantry.occasion_type_label')}</Text>
        <View style={styles.chipWrap}>
          {EVENT_TYPES.map(type => (
            <Pressable key={type} style={[styles.typeChip, newType === type && styles.typeChipActive]} onPress={() => setNewType(type)} accessibilityRole="button" accessibilityState={{ selected: newType === type }}>
              <Text style={[styles.typeChipText, newType === type && styles.onPrimaryText]}>{eventTypeLabel(type)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.inputLabel}>{t('style_pantry.occasion_location_label')}</Text>
        <TextInput style={styles.textInput} value={newLocation} onChangeText={setNewLocation} placeholder={t('style_pantry.occasion_location_placeholder')} placeholderTextColor={styles.placeholder.color} />
        <Button title={t('style_pantry.save_occasion')} onPress={handleSaveOccasion} loading={savingOccasion} style={styles.emptyBtn} />
      </BottomSheet>

      <TryOnSheet
        visible={!!tryOnOutfitTarget}
        outfit={tryOnOutfitTarget}
        onClose={() => setTryOnOutfitTarget(null)}
      />
    </Root>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    flex: { flex: 1 },
    root: { flex: 1, backgroundColor: colors.background },
    onPrimary: { color: colors.textOnPrimary },
    onPrimaryText: { color: colors.textOnPrimary },
    onPrimaryMutedText: { color: colors.textOnPrimaryMuted },
    iconTint: { color: colors.primary },
    weatherIcon: { color: colors.turmeric },
    disabled: { opacity: 0.55 },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl + spacing.lg },
    skeletonGap: { marginRight: spacing.sm + 4, marginBottom: spacing.sm + 4 },
    skeletonLine: { marginBottom: 6 },
    weatherCard: { marginBottom: spacing.md, padding: spacing.md },
    weatherRow: { flexDirection: 'row', alignItems: 'center' },
    sunCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.turmericSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    weatherTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary },
    weatherSub: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    sectionTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.textPrimary, marginBottom: spacing.xs },
    moodScroll: { paddingVertical: spacing.xs, gap: spacing.xs, marginBottom: spacing.md },
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
    moodChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    moodChipIcon: { marginRight: 6 },
    moodChipText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textSecondary },
    eventsScroll: { paddingVertical: spacing.xs, gap: spacing.xs, marginBottom: spacing.md },
    eventCard: {
      width: 170,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: spacing.xs,
      ...shadow.soft,
    },
    eventCardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
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
    addEventText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.primary, marginTop: 4 },
    eventTimeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.xs },
    eventTimeText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.primary, flex: 1 },
    eventTitleText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.textPrimary, marginBottom: spacing.xs },
    eventTypeTag: { fontFamily: fonts.sansMedium, fontSize: 10, color: colors.textSecondary },
    emptyCard: { marginBottom: spacing.md },
    emptyTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.textPrimary },
    emptySub: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginTop: spacing.xs },
    emptyActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    emptyBtn: { marginTop: spacing.sm },
    feedHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm, marginTop: spacing.xs },
    feedTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.textPrimary },
    ctaCard: { marginBottom: spacing.md },
    ctaTitle: { fontFamily: fonts.serif, fontSize: 22, color: colors.textPrimary },
    ctaSub: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginTop: spacing.xs },
    requestRow: { alignItems: 'flex-end', marginBottom: spacing.sm },
    requestPill: {
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      borderBottomRightRadius: 4,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      maxWidth: '80%',
    },
    requestText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textOnPrimary },
    noteBubble: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      alignSelf: 'flex-start',
      maxWidth: '92%',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderBottomLeftRadius: 4,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      marginBottom: spacing.sm,
    },
    noteText: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.textPrimary, lineHeight: 19 },
    itemsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
    itemTile: { width: 72, alignItems: 'center' },
    itemTileText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
    errorBubble: {
      alignSelf: 'flex-start',
      maxWidth: '85%',
      backgroundColor: colors.dangerSoft,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
      borderRadius: radius.lg,
      borderBottomLeftRadius: 4,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.sm,
    },
    errorText: { fontFamily: fonts.sans, fontSize: 13, color: colors.danger, lineHeight: 18 },
    typingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.sm, marginBottom: spacing.sm },
    typingText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary, marginLeft: spacing.xs },
    refineBar: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    refineTitle: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs },
    refineChipScroll: { gap: spacing.xs, paddingRight: spacing.lg },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    refineChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    refineChipText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textPrimary },
    refineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
    refineInput: {
      flex: 1,
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    inputLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.sm },
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
    placeholder: { color: colors.textSecondary },
    valueText: { fontFamily: fonts.sans, fontSize: 14, color: colors.textPrimary },
    placeholderText: { fontFamily: fonts.sans, fontSize: 14, color: colors.textSecondary },
    typeChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    typeChipText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textSecondary },
  });
