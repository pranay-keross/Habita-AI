import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Alert, RefreshControl } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import useAuth from '../../../hooks/useAuth';
import Trash2 from 'lucide-react-native/icons/trash';
import Pencil from 'lucide-react-native/icons/pencil';
import Plus from 'lucide-react-native/icons/plus';
import Check from 'lucide-react-native/icons/check';
import CircleDashed from 'lucide-react-native/icons/circle-dashed';
import MapPin from 'lucide-react-native/icons/map-pin';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import GlassCard from '../../../components/GlassCard';
import BottomSheet from '../../../components/BottomSheet';
import Button from '../../../components/Button';
import { SkeletonBox, SkeletonText } from '../../../components/Skeleton';
import {
  addTripChecklistItem,
  editTrip,
  getTrip,
  loadClothingItems,
  loadTripChecklist,
  loadTripOutfits,
  ownedItems,
  removeTrip,
  removeTripChecklistItem,
  removeTripOutfit,
  saveTripOutfit,
  updateTripChecklistItem,
} from '../stylePantryStore';
import { showStoreErrorAlert } from '../errors';
import { useBusy, useFocusLoad, useLocaleRerender } from '../hooks';
import { dateLabel, dateRangeLabel } from '../format';
import { dateRange } from '../../../utils/date';
import WardrobeHeader from '../components/WardrobeHeader';
import ItemThumb from '../components/ItemThumb';
import OfflineBanner from '../components/OfflineBanner';
import ItemPickerSheet from '../components/ItemPickerSheet';
import TripFormSheet from '../components/TripFormSheet';
import type { ClothingItem, TripChecklistItem, TripInput, TripOutfitEntry, WardrobeTrip } from '../types';
import { t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'TripDetails'>;
type Tab = 'outfit' | 'item' | 'checklist';
const TABS: Tab[] = ['outfit', 'item', 'checklist'];

export default function TripDetailsScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { getAccessToken } = useAuth();
  useLocaleRerender();
  const { tripId } = route.params;

  const [trip, setTrip] = useState<WardrobeTrip | null>(null);
  const [tab, setTab] = useState<Tab>('outfit');
  const [outfits, setOutfits] = useState<TripOutfitEntry[]>([]);
  const [checklist, setChecklist] = useState<TripChecklistItem[]>([]);
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [busy, run] = useBusy();

  const [showEdit, setShowEdit] = useState(false);
  const [outfitDraft, setOutfitDraft] = useState<{ date: string; title: string; itemIds: string[] } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newChecklistLabel, setNewChecklistLabel] = useState('');

  const { loading, refreshing, offline, refresh } = useFocusLoad(
    useCallback(async () => {
      const token = await getAccessToken();
      const [tr, o, c, i] = await Promise.all([getTrip(tripId, token), loadTripOutfits(tripId, token), loadTripChecklist(tripId, token), loadClothingItems(token)]);
      setTrip(tr.data ?? null);
      setOutfits(o.data);
      setChecklist(c.data);
      setItems(i.data);
      return { offline: tr.offline || o.offline || c.offline || i.offline };
    }, [getAccessToken, tripId]),
  );

  const owned = useMemo(() => ownedItems(items), [items]);
  const itemsById = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);
  const dayList = trip ? dateRange(trip.startDate, trip.endDate) : [];
  const packedIds = trip?.packedItemIds ?? [];
  const packedCount = owned.filter(i => packedIds.includes(i.id)).length;

  const handleDeleteTrip = () => {
    Alert.alert(t('trip.delete_confirm_title'), t('trip.delete_confirm_msg'), [
      { text: t('style_pantry.cancel'), style: 'cancel' },
      {
        text: t('style_pantry.delete'),
        style: 'destructive',
        onPress: () =>
          run(async () => {
            const r = await removeTrip(tripId, await getAccessToken());
            if (!r.ok) {
              showStoreErrorAlert(r.error);
              return;
            }
            navigation.goBack();
          }),
      },
    ]);
  };

  const handleEditTrip = (input: TripInput) =>
    run(async () => {
      const r = await editTrip(tripId, input, await getAccessToken());
      if (!r.ok) {
        showStoreErrorAlert(r.error);
        return;
      }
      setTrip(r.data);
      setShowEdit(false);
    });

  const openOutfitDraft = (date: string, existing?: TripOutfitEntry) => {
    setOutfitDraft({ date, title: existing?.outfitTitle ?? '', itemIds: existing?.itemIds.filter(id => itemsById.has(id)) ?? [] });
  };

  const handleSaveOutfit = () =>
    run(async () => {
      if (!outfitDraft) return;
      if (outfitDraft.itemIds.length === 0) {
        Alert.alert(t('trip.pick_items_title'), t('trip.pick_items_msg'));
        return;
      }
      const r = await saveTripOutfit(
        tripId,
        {
          date: outfitDraft.date,
          itemIds: outfitDraft.itemIds,
          outfitTitle: outfitDraft.title.trim() || t('trip.default_outfit_title', { date: dateLabel(outfitDraft.date) }),
        },
        await getAccessToken(),
      );
      if (!r.ok) {
        showStoreErrorAlert(r.error);
        return;
      }
      setOutfits(prev => [...prev.filter(o => o.id !== r.data.id && o.date !== r.data.date), r.data].sort((a, b) => a.date.localeCompare(b.date)));
      setOutfitDraft(null);
    });

  const confirmRemoveOutfit = (entry: TripOutfitEntry) => {
    Alert.alert(t('trip.remove_outfit'), t('trip.remove_outfit_confirm'), [
      { text: t('style_pantry.cancel'), style: 'cancel' },
      {
        text: t('style_pantry.delete'),
        style: 'destructive',
        onPress: () =>
          run(async () => {
            const r = await removeTripOutfit(tripId, entry.id, await getAccessToken());
            if (!r.ok) {
              showStoreErrorAlert(r.error);
              return;
            }
            setOutfits(prev => prev.filter(o => o.id !== entry.id));
          }),
      },
    ]);
  };

  const togglePacked = (itemId: string) =>
    run(async () => {
      if (!trip) return;
      const next = packedIds.includes(itemId) ? packedIds.filter(i => i !== itemId) : [...packedIds, itemId];
      const r = await editTrip(
        tripId,
        {
          title: trip.title,
          coverImageUri: trip.coverImageUri,
          startDate: trip.startDate,
          endDate: trip.endDate,
          location: trip.location,
          notes: trip.notes,
          packedItemIds: next,
        },
        await getAccessToken(),
      );
      if (!r.ok) {
        showStoreErrorAlert(r.error);
        return;
      }
      setTrip(r.data);
    });

  const handleAddChecklistItem = () =>
    run(async () => {
      const label = newChecklistLabel.trim();
      if (!label) return;
      const r = await addTripChecklistItem(tripId, label, await getAccessToken());
      if (!r.ok) {
        showStoreErrorAlert(r.error);
        return;
      }
      setChecklist(prev => [...prev, r.data]);
      setNewChecklistLabel('');
    });

  const handleToggleChecklistItem = (item: TripChecklistItem) =>
    run(async () => {
      const r = await updateTripChecklistItem(tripId, item.id, { checked: !item.checked }, await getAccessToken());
      if (!r.ok) {
        showStoreErrorAlert(r.error);
        return;
      }
      setChecklist(prev => prev.map(i => (i.id === r.data.id ? r.data : i)));
    });

  const handleRemoveChecklistItem = (itemId: string) =>
    run(async () => {
      const r = await removeTripChecklistItem(tripId, itemId, await getAccessToken());
      if (!r.ok) {
        showStoreErrorAlert(r.error);
        return;
      }
      setChecklist(prev => prev.filter(i => i.id !== itemId));
    });

  if (!loading && !trip) {
    return (
      <View style={styles.root}>
        <WardrobeHeader title="" onBack={() => navigation.goBack()} />
        <OfflineBanner visible={offline} />
        <Text style={styles.emptyText}>{t('style_pantry.err_TRIP_NOT_FOUND')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <WardrobeHeader
        title={trip?.title ?? ''}
        onBack={() => navigation.goBack()}
        right={[
          { icon: Pencil, onPress: () => setShowEdit(true), accessibilityLabel: t('trip.edit_trip'), disabled: !trip },
          { icon: Trash2, onPress: handleDeleteTrip, accessibilityLabel: t('trip.delete_trip'), disabled: !trip },
        ]}
      />

      {trip ? (
        <View style={styles.coverInfo}>
          <View style={styles.tripMetaRow}>
            <CalendarDays size={13} color={styles.placeholder.color} />
            <Text style={styles.tripMetaText}>{dateRangeLabel(trip.startDate, trip.endDate)}</Text>
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
        {TABS.map(t2 => (
          <Pressable key={t2} style={[styles.tabChip, tab === t2 && styles.tabChipActive]} onPress={() => setTab(t2)} accessibilityRole="tab">
            <Text style={[styles.tabChipText, tab === t2 && styles.tabChipTextActive]}>{t(`trip.tab_${t2}`)}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={styles.tint.color} colors={[styles.tint.color]} />
        }>
        <OfflineBanner visible={offline} />

        {loading ? (
          <>
            {[0, 1, 2].map(i => (
              <View key={i} style={styles.dayCard}>
                <SkeletonText width="35%" />
                <SkeletonBox width="100%" height={40} borderRadius={10} style={styles.skelBox} />
              </View>
            ))}
          </>
        ) : null}

        {!loading && tab === 'outfit' && (
          <>
            {dayList.length === 0 ? <Text style={styles.emptyText}>{t('trip.outfits_empty')}</Text> : null}
            {dayList.map((date, idx) => {
              const entry = outfits.find(o => o.date === date);
              return (
                <GlassCard key={date} variant="default" style={styles.dayCard}>
                  <Text style={styles.dayLabel}>
                    {t('trip.day_label', { n: idx + 1 })} · {dateLabel(date)}
                  </Text>
                  {entry ? (
                    <>
                      <Text style={styles.dayOutfitTitle}>{entry.outfitTitle}</Text>
                      <View style={styles.dayItemsRow}>
                        {entry.itemIds.map(id => {
                          const item = itemsById.get(id);
                          return item ? <ItemThumb key={id} item={item} size={36} /> : null;
                        })}
                      </View>
                      <View style={styles.dayActionsRow}>
                        <Pressable onPress={() => openOutfitDraft(date, entry)} disabled={busy}>
                          <Text style={styles.dayActionText}>{t('style_chat.edit')}</Text>
                        </Pressable>
                        <Pressable onPress={() => confirmRemoveOutfit(entry)} disabled={busy}>
                          <Text style={styles.dayActionTextDanger}>{t('trip.remove_outfit')}</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <Pressable style={styles.addOutfitBtn} onPress={() => openOutfitDraft(date)} disabled={busy}>
                      <Plus size={16} color={styles.tint.color} />
                      <Text style={styles.addOutfitText}>{t('trip.add_outfit')}</Text>
                    </Pressable>
                  )}
                </GlassCard>
              );
            })}
          </>
        )}

        {!loading && tab === 'item' && (
          <>
            <Text style={styles.packedCount}>{t('trip.packed_count', { packed: packedCount, total: owned.length })}</Text>
            {owned.length === 0 ? <Text style={styles.emptyText}>{t('trip.no_owned_items')}</Text> : null}
            {owned.map(item => {
              const packed = packedIds.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  style={styles.packRow}
                  onPress={() => togglePacked(item.id)}
                  disabled={busy}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: packed }}>
                  <ItemThumb item={item} size={36} style={styles.rowThumb} />
                  <Text style={[styles.packName, packed && styles.packNameDone]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {packed ? <Check size={18} color={styles.tint.color} /> : <CircleDashed size={18} color={styles.placeholder.color} />}
                </Pressable>
              );
            })}
          </>
        )}

        {!loading && tab === 'checklist' && (
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
              <Pressable style={styles.checklistAddBtn} onPress={handleAddChecklistItem} disabled={busy} accessibilityRole="button">
                <Plus size={18} color={styles.onPrimary.color} />
              </Pressable>
            </View>
            {checklist.length === 0 ? <Text style={styles.emptyText}>{t('trip.checklist_empty')}</Text> : null}
            {checklist.map(item => (
              <View key={item.id} style={styles.checklistRow}>
                <Pressable
                  style={styles.checklistCheckArea}
                  onPress={() => handleToggleChecklistItem(item)}
                  disabled={busy}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.checked }}>
                  {item.checked ? <Check size={18} color={styles.tint.color} /> : <CircleDashed size={18} color={styles.placeholder.color} />}
                  <Text style={[styles.checklistLabel, item.checked && styles.checklistLabelChecked]}>{item.label}</Text>
                </Pressable>
                <Pressable onPress={() => handleRemoveChecklistItem(item.id)} disabled={busy} hitSlop={8} accessibilityRole="button">
                  <Trash2 size={16} color={styles.placeholder.color} />
                </Pressable>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <TripFormSheet visible={showEdit} onClose={() => setShowEdit(false)} trip={trip} saving={busy} onSubmit={handleEditTrip} />

      <BottomSheet visible={outfitDraft !== null && !pickerOpen} onClose={() => setOutfitDraft(null)} title={t('trip.add_outfit')}>
        {outfitDraft ? (
          <>
            <Text style={styles.inputLabel}>{t('trip.outfit_title_label')}</Text>
            <TextInput
              style={styles.textInput}
              value={outfitDraft.title}
              onChangeText={v => setOutfitDraft(d => (d ? { ...d, title: v } : d))}
              placeholder={t('trip.outfit_title_placeholder')}
              placeholderTextColor={styles.placeholder.color}
            />
            <Text style={styles.inputLabel}>{t('trip.pick_items_label')}</Text>
            <View style={styles.draftItemsRow}>
              {outfitDraft.itemIds.map(id => {
                const item = itemsById.get(id);
                return item ? <ItemThumb key={id} item={item} size={40} /> : null;
              })}
              <Pressable style={styles.pickBtn} onPress={() => setPickerOpen(true)} accessibilityRole="button">
                <Plus size={16} color={styles.tint.color} />
                <Text style={styles.pickBtnText}>{t('trip.pick_items_label')}</Text>
              </Pressable>
            </View>
            <Button title={t('trip.save_trip_outfit')} onPress={handleSaveOutfit} loading={busy} disabled={busy} style={styles.submit} />
          </>
        ) : null}
      </BottomSheet>

      <ItemPickerSheet
        visible={pickerOpen}
        title={t('trip.pick_items_title')}
        items={owned}
        selectedIds={outfitDraft?.itemIds ?? []}
        confirmLabel={t('trip.pick_items_label')}
        onClose={() => setPickerOpen(false)}
        onConfirm={ids => {
          setOutfitDraft(d => (d ? { ...d, itemIds: ids } : d));
          setPickerOpen(false);
        }}
      />
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    tint: { color: colors.primary },
    onPrimary: { color: colors.textOnPrimary },
    placeholder: { color: colors.textSecondary },
    coverInfo: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
    tripMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    tripMetaText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary },
    notesText: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs },
    tabRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.xs, marginBottom: spacing.sm },
    tabChip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabChipText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textSecondary },
    tabChipTextActive: { color: colors.textOnPrimary },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    skelBox: { marginTop: spacing.sm },
    emptyText: { fontFamily: fonts.sans, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
    dayCard: { marginBottom: spacing.md },
    dayLabel: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs },
    dayOutfitTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.textPrimary },
    dayItemsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
    dayActionsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
    dayActionText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.primary },
    dayActionTextDanger: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.danger },
    addOutfitBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
    addOutfitText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.primary },
    packedCount: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm },
    packRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    rowThumb: { marginRight: spacing.sm },
    packName: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.textPrimary },
    packNameDone: { color: colors.textSecondary },
    checklistAddRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
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
    checklistAddBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    checklistRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    checklistCheckArea: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
    checklistLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.textPrimary },
    checklistLabelChecked: { color: colors.textSecondary, textDecorationLine: 'line-through' },
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
    draftItemsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
    pickBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pickBtnText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.primary },
    submit: { marginTop: spacing.md },
  });
