import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import useAuth from '../../../hooks/useAuth';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Trash2 from 'lucide-react-native/icons/trash';
import Plus from 'lucide-react-native/icons/plus';
import Check from 'lucide-react-native/icons/check';
import CircleDashed from 'lucide-react-native/icons/circle-dashed';
import MapPin from 'lucide-react-native/icons/map-pin';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import GlassCard from '../../../components/GlassCard';
import BottomSheet from '../../../components/BottomSheet';
import Button from '../../../components/Button';
import {
  loadTrips,
  removeTrip,
  loadTripOutfits,
  saveTripOutfit,
  removeTripOutfit,
  loadTripChecklist,
  addTripChecklistItem,
  toggleTripChecklistItem,
  removeTripChecklistItem,
  loadClothingItems,
  editTrip,
} from '../stylePantryStore';
import { getClothingIconComponent } from '../clothingIcons';
import type {
  ClothingItem,
  TripChecklistItem,
  TripOutfitEntry,
  WardrobeTrip,
} from '../types';
import { subscribeToLanguageChanges, t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'TripDetails'>;
type Tab = 'outfit' | 'item' | 'checklist';

function datesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start);
  const last = new Date(end);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(last.getTime())) return [];
  while (cur <= last && dates.length < 60) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export default function TripDetailsScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuth();
  const [, setLocaleVersion] = useState(0);
  const { tripId } = route.params;

  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState<WardrobeTrip | null>(null);
  const [tab, setTab] = useState<Tab>('outfit');
  const [outfits, setOutfits] = useState<TripOutfitEntry[]>([]);
  const [checklist, setChecklist] = useState<TripChecklistItem[]>([]);
  const [items, setItems] = useState<ClothingItem[]>([]);

  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [pickerTitle, setPickerTitle] = useState('');
  const [pickerItemIds, setPickerItemIds] = useState<string[]>([]);
  const [savingOutfit, setSavingOutfit] = useState(false);
  const [newChecklistLabel, setNewChecklistLabel] = useState('');

  const fetchData = useCallback(async () => {
    const token = await getAccessToken();
    const [trips, tripOutfits, tripChecklist, clothingItems] =
      await Promise.all([
        loadTrips(token),
        loadTripOutfits(tripId, token),
        loadTripChecklist(tripId, token),
        loadClothingItems(token),
      ]);
    setTrip(trips.find(t2 => t2.id === tripId) || null);
    setOutfits(tripOutfits);
    setChecklist(tripChecklist);
    setItems(clothingItems);
  }, [getAccessToken, tripId]);

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

  const handleDeleteTrip = () => {
    Alert.alert(t('trip.delete_confirm_title'), t('trip.delete_confirm_msg'), [
      { text: t('style_pantry.cancel'), style: 'cancel' },
      {
        text: t('style_pantry.delete'),
        style: 'destructive',
        onPress: async () => {
          const token = await getAccessToken();
          await removeTrip(tripId, token);
          navigation.goBack();
        },
      },
    ]);
  };

  const openOutfitPicker = (date: string, existing?: TripOutfitEntry) => {
    setPickerDate(date);
    setPickerTitle(existing?.outfitTitle || '');
    setPickerItemIds(existing?.itemIds || []);
  };

  const toggleItemForOutfit = (id: string) => {
    setPickerItemIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id],
    );
  };

  const handleSaveOutfit = async () => {
    if (!pickerDate || pickerItemIds.length === 0) {
      Alert.alert(t('trip.pick_items_title'), t('trip.pick_items_msg'));
      return;
    }
    setSavingOutfit(true);
    const token = await getAccessToken();
    const { entry } = await saveTripOutfit(
      tripId,
      {
        date: pickerDate,
        itemIds: pickerItemIds,
        outfitTitle:
          pickerTitle.trim() || t('trip.default_outfit_title', { date: pickerDate }),
      },
      token,
    );
    setSavingOutfit(false);
    setOutfits(prev => [
      entry,
      ...prev.filter(o => o.date !== entry.date),
    ]);
    setPickerDate(null);
  };

  const handleRemoveOutfit = async (entry: TripOutfitEntry) => {
    const token = await getAccessToken();
    await removeTripOutfit(tripId, entry.id, token);
    setOutfits(prev => prev.filter(o => o.id !== entry.id));
  };

  const togglePacked = async (itemId: string) => {
    if (!trip) return;
    const packed = trip.packedItemIds || [];
    const updated = packed.includes(itemId)
      ? packed.filter(i => i !== itemId)
      : [...packed, itemId];
    const nextTrip = { ...trip, packedItemIds: updated };
    setTrip(nextTrip);
    const token = await getAccessToken();
    await editTrip(nextTrip, token);
  };

  const handleAddChecklistItem = async () => {
    if (!newChecklistLabel.trim()) return;
    const token = await getAccessToken();
    const { item } = await addTripChecklistItem(
      tripId,
      { label: newChecklistLabel.trim(), checked: false },
      token,
    );
    setChecklist(prev => [item, ...prev]);
    setNewChecklistLabel('');
  };

  const handleToggleChecklistItem = async (item: TripChecklistItem) => {
    setChecklist(prev =>
      prev.map(i => (i.id === item.id ? { ...i, checked: !i.checked } : i)),
    );
    const token = await getAccessToken();
    await toggleTripChecklistItem(tripId, item, token);
  };

  const handleRemoveChecklistItem = async (itemId: string) => {
    setChecklist(prev => prev.filter(i => i.id !== itemId));
    const token = await getAccessToken();
    await removeTripChecklistItem(tripId, itemId, token);
  };

  if (!loading && !trip) {
    return (
      <View style={styles.root}>
        <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.headerBtn}
          >
            <ArrowLeft size={20} color={styles.headerIcon.color} />
          </Pressable>
        </View>
        <Text style={styles.emptyText}>{t('style_pantry.item_not_found')}</Text>
      </View>
    );
  }

  const dayList = trip ? datesInRange(trip.startDate, trip.endDate) : [];

  return (
    <View style={styles.root}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {trip?.title || ''}
        </Text>
        <Pressable onPress={handleDeleteTrip} style={styles.headerBtn}>
          <Trash2 size={18} color={styles.headerIcon.color} />
        </Pressable>
      </View>

      {trip ? (
        <View style={styles.coverInfo}>
          <View style={styles.tripMetaRow}>
            <CalendarDays size={13} color={styles.placeholder.color} />
            <Text style={styles.tripMetaText}>
              {trip.startDate} - {trip.endDate}
            </Text>
          </View>
          {trip.location ? (
            <View style={styles.tripMetaRow}>
              <MapPin size={13} color={styles.placeholder.color} />
              <Text style={styles.tripMetaText}>{trip.location}</Text>
            </View>
          ) : null}
          {trip.notes ? <Text style={styles.notesText}>{trip.notes}</Text> : null}
        </View>
      ) : null}

      <View style={styles.tabRow}>
        {(['outfit', 'item', 'checklist'] as Tab[]).map(t2 => (
          <Pressable
            key={t2}
            style={[styles.tabChip, tab === t2 && styles.tabChipActive]}
            onPress={() => setTab(t2)}
          >
            <Text
              style={[styles.tabChipText, tab === t2 && styles.tabChipTextActive]}
            >
              {t(`trip.tab_${t2}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'outfit' &&
          dayList.map((date, idx) => {
            const entry = outfits.find(o => o.date === date);
            return (
              <GlassCard key={date} variant="default" style={styles.dayCard}>
                <Text style={styles.dayLabel}>
                  {t('trip.day_label', { n: idx + 1 })} · {date}
                </Text>
                {entry ? (
                  <>
                    <Text style={styles.dayOutfitTitle}>
                      {entry.outfitTitle}
                    </Text>
                    <View style={styles.dayItemsRow}>
                      {entry.itemIds.map(id => {
                        const item = itemsById.get(id);
                        if (!item) return null;
                        const ItemIcon = getClothingIconComponent(item.emoji);
                        return (
                          <View key={id} style={styles.dayItemBadge}>
                            <ItemIcon size={18} color={styles.iconTint.color} />
                          </View>
                        );
                      })}
                    </View>
                    <View style={styles.dayActionsRow}>
                      <Pressable onPress={() => openOutfitPicker(date, entry)}>
                        <Text style={styles.dayActionText}>
                          {t('style_chat.edit')}
                        </Text>
                      </Pressable>
                      <Pressable onPress={() => handleRemoveOutfit(entry)}>
                        <Text style={styles.dayActionTextDanger}>
                          {t('style_pantry.delete')}
                        </Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <Pressable
                    style={styles.addOutfitBtn}
                    onPress={() => openOutfitPicker(date)}
                  >
                    <Plus size={16} color={styles.iconTint.color} />
                    <Text style={styles.addOutfitText}>
                      {t('trip.add_outfit')}
                    </Text>
                  </Pressable>
                )}
              </GlassCard>
            );
          })}

        {tab === 'item' &&
          items.map(item => {
            const packed = (trip?.packedItemIds || []).includes(item.id);
            const ItemIcon = getClothingIconComponent(item.emoji);
            return (
              <Pressable
                key={item.id}
                style={styles.packRow}
                onPress={() => togglePacked(item.id)}
              >
                <View style={styles.itemPickIconBadge}>
                  <ItemIcon size={18} color={styles.iconTint.color} />
                </View>
                <Text style={styles.packName} numberOfLines={1}>
                  {item.name}
                </Text>
                {packed ? (
                  <Check size={18} color={styles.iconTint.color} />
                ) : (
                  <CircleDashed size={18} color={styles.placeholder.color} />
                )}
              </Pressable>
            );
          })}

        {tab === 'checklist' && (
          <>
            <View style={styles.checklistAddRow}>
              <TextInput
                style={styles.checklistInput}
                value={newChecklistLabel}
                onChangeText={setNewChecklistLabel}
                placeholder={t('trip.checklist_placeholder')}
                placeholderTextColor={styles.placeholder.color}
                onSubmitEditing={handleAddChecklistItem}
                returnKeyType="done"
              />
              <Pressable
                style={styles.checklistAddBtn}
                onPress={handleAddChecklistItem}
              >
                <Plus size={18} color={styles.headerIconOnPrimary.color} />
              </Pressable>
            </View>
            {checklist.map(item => (
              <View key={item.id} style={styles.checklistRow}>
                <Pressable
                  style={styles.checklistCheckArea}
                  onPress={() => handleToggleChecklistItem(item)}
                >
                  {item.checked ? (
                    <Check size={18} color={styles.iconTint.color} />
                  ) : (
                    <CircleDashed size={18} color={styles.placeholder.color} />
                  )}
                  <Text
                    style={[
                      styles.checklistLabel,
                      item.checked && styles.checklistLabelChecked,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
                <Pressable onPress={() => handleRemoveChecklistItem(item.id)}>
                  <Trash2 size={16} color={styles.placeholder.color} />
                </Pressable>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <BottomSheet
        visible={!!pickerDate}
        onClose={() => setPickerDate(null)}
        title={t('trip.add_outfit')}
      >
        <Text style={styles.inputLabel}>{t('trip.outfit_title_label')}</Text>
        <TextInput
          style={styles.textInput}
          value={pickerTitle}
          onChangeText={setPickerTitle}
          placeholder={t('trip.outfit_title_placeholder')}
          placeholderTextColor={styles.placeholder.color}
        />
        <Text style={styles.inputLabel}>{t('trip.pick_items_label')}</Text>
        <View style={styles.itemPickList}>
          {items.map(item => {
            const selected = pickerItemIds.includes(item.id);
            const ItemIcon = getClothingIconComponent(item.emoji);
            return (
              <Pressable
                key={item.id}
                style={styles.itemPickRow}
                onPress={() => toggleItemForOutfit(item.id)}
              >
                <View style={styles.itemPickIconBadge}>
                  <ItemIcon size={18} color={styles.iconTint.color} />
                </View>
                <Text style={styles.itemPickName} numberOfLines={1}>
                  {item.name}
                </Text>
                {selected ? (
                  <Check size={18} color={styles.iconTint.color} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <Button
          title={t('trip.save_trip_outfit')}
          onPress={handleSaveOutfit}
          loading={savingOutfit}
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
    headerIconOnPrimary: { color: colors.textOnPrimary },
    iconTint: { color: colors.primary },
    placeholder: { color: colors.textSecondary },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontFamily: fonts.sansBold,
      fontSize: 17,
      color: colors.textPrimary,
      marginHorizontal: spacing.sm,
    },
    coverInfo: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    tripMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 2,
    },
    tripMetaText: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
    },
    notesText: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    tabRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    tabChip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tabChipText: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textSecondary,
    },
    tabChipTextActive: {
      color: colors.textOnPrimary,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    emptyText: {
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.xl,
    },
    dayCard: {
      marginBottom: spacing.md,
    },
    dayLabel: {
      fontFamily: fonts.sansBold,
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    dayOutfitTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
    },
    dayItemsRow: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginTop: spacing.sm,
    },
    dayItemBadge: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayActionsRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    dayActionText: {
      fontFamily: fonts.sansBold,
      fontSize: 12,
      color: colors.primary,
    },
    dayActionTextDanger: {
      fontFamily: fonts.sansBold,
      fontSize: 12,
      color: colors.danger,
    },
    addOutfitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
    },
    addOutfitText: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.primary,
    },
    packRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    packName: {
      flex: 1,
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textPrimary,
    },
    itemPickIconBadge: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    checklistAddRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    checklistInput: {
      flex: 1,
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
    checklistAddBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checklistRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    checklistCheckArea: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    checklistLabel: {
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.textPrimary,
    },
    checklistLabelChecked: {
      color: colors.textSecondary,
      textDecorationLine: 'line-through',
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
    itemPickList: {
      maxHeight: 260,
    },
    itemPickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.xs + 2,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    itemPickName: {
      flex: 1,
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textPrimary,
    },
  });
