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
import Plus from 'lucide-react-native/icons/plus';
import Luggage from 'lucide-react-native/icons/luggage';
import MapPin from 'lucide-react-native/icons/map-pin';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import GlassCard from '../../../components/GlassCard';
import BottomSheet from '../../../components/BottomSheet';
import Button from '../../../components/Button';
import { SkeletonBox, SkeletonText } from '../../../components/Skeleton';
import { loadTrips, addTrip } from '../stylePantryStore';
import type { WardrobeTrip } from '../types';
import { subscribeToLanguageChanges, t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'Trips'>;

function dateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatRange(start: string, end: string): string {
  return `${start} - ${end}`;
}

export default function TripPlannerScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuth();
  const [, setLocaleVersion] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trips, setTrips] = useState<WardrobeTrip[]>([]);

  const [showAddSheet, setShowAddSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newStart, setNewStart] = useState<Date>(new Date());
  const [newEnd, setNewEnd] = useState<Date>(new Date());
  const [pickerFor, setPickerFor] = useState<'start' | 'end' | null>(null);

  const fetchData = useCallback(async () => {
    const token = await getAccessToken();
    setTrips(await loadTrips(token));
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

  const resetForm = () => {
    setNewTitle('');
    setNewLocation('');
    setNewNotes('');
    setNewStart(new Date());
    setNewEnd(new Date());
    setPickerFor(null);
  };

  const handleDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    setPickerFor(null);
    if (event.type === 'set' && selected) {
      if (pickerFor === 'start') setNewStart(selected);
      else if (pickerFor === 'end') setNewEnd(selected);
    }
  };

  const handleCreateTrip = async () => {
    if (!newTitle.trim()) {
      Alert.alert(t('trip.missing_title_title'), t('trip.missing_title_msg'));
      return;
    }
    setSaving(true);
    const token = await getAccessToken();
    const { trip } = await addTrip(
      {
        title: newTitle.trim(),
        startDate: dateKey(newStart),
        endDate: dateKey(newEnd),
        location: newLocation.trim() || undefined,
        notes: newNotes.trim() || undefined,
      },
      token,
    );
    setSaving(false);
    setShowAddSheet(false);
    resetForm();
    setTrips(prev => [trip, ...prev]);
    navigation.navigate('TripDetails', { tripId: trip.id });
  };

  return (
    <View style={styles.root}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('trip.list_title')}</Text>
        <Pressable
          onPress={() => setShowAddSheet(true)}
          style={styles.addNavBtn}
        >
          <Plus size={20} color={styles.headerIconOnPrimary.color} />
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
        {loading ? (
          <>
            {[0, 1].map(i => (
              <View key={i} style={styles.tripCard}>
                <SkeletonBox width="100%" height={90} borderRadius={12} />
                <SkeletonText width="50%" style={{ marginTop: 10 }} />
              </View>
            ))}
          </>
        ) : trips.length === 0 ? (
          <View style={styles.emptyCard}>
            <Luggage size={36} color={styles.placeholder.color} />
            <Text style={styles.emptyTitle}>{t('trip.empty_title')}</Text>
            <Text style={styles.emptySub}>{t('trip.empty_sub')}</Text>
          </View>
        ) : (
          trips.map(trip => (
            <GlassCard
              key={trip.id}
              variant="default"
              style={styles.tripCard}
              onPress={() =>
                navigation.navigate('TripDetails', { tripId: trip.id })
              }
            >
              <View style={styles.tripCoverPlaceholder}>
                <Luggage size={28} color={styles.iconTint.color} />
              </View>
              <Text style={styles.tripTitle}>{trip.title}</Text>
              <View style={styles.tripMetaRow}>
                <CalendarDays size={13} color={styles.placeholder.color} />
                <Text style={styles.tripMetaText}>
                  {formatRange(trip.startDate, trip.endDate)}
                </Text>
              </View>
              {trip.location ? (
                <View style={styles.tripMetaRow}>
                  <MapPin size={13} color={styles.placeholder.color} />
                  <Text style={styles.tripMetaText}>{trip.location}</Text>
                </View>
              ) : null}
            </GlassCard>
          ))
        )}
      </ScrollView>

      <BottomSheet
        visible={showAddSheet}
        onClose={() => {
          setShowAddSheet(false);
          resetForm();
        }}
        title={t('trip.new_trip')}
      >
        <Text style={styles.inputLabel}>{t('trip.title_label')}</Text>
        <TextInput
          style={styles.textInput}
          value={newTitle}
          onChangeText={setNewTitle}
          placeholder={t('trip.title_placeholder')}
          placeholderTextColor={styles.placeholder.color}
        />
        <Text style={styles.inputLabel}>{t('trip.location_label')}</Text>
        <TextInput
          style={styles.textInput}
          value={newLocation}
          onChangeText={setNewLocation}
          placeholder={t('trip.location_placeholder')}
          placeholderTextColor={styles.placeholder.color}
        />
        <View style={styles.dateRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>{t('trip.start_date_label')}</Text>
            <Pressable
              style={styles.textInput}
              onPress={() => setPickerFor('start')}
            >
              <Text style={styles.timeValueText}>{dateKey(newStart)}</Text>
            </Pressable>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>{t('trip.end_date_label')}</Text>
            <Pressable
              style={styles.textInput}
              onPress={() => setPickerFor('end')}
            >
              <Text style={styles.timeValueText}>{dateKey(newEnd)}</Text>
            </Pressable>
          </View>
        </View>
        {pickerFor ? (
          <DateTimePicker
            value={pickerFor === 'start' ? newStart : newEnd}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        ) : null}
        <Text style={styles.inputLabel}>{t('trip.notes_label')}</Text>
        <TextInput
          style={[styles.textInput, styles.notesInput]}
          value={newNotes}
          onChangeText={setNewNotes}
          placeholder={t('trip.notes_placeholder')}
          placeholderTextColor={styles.placeholder.color}
          multiline
        />
        <Button
          title={t('trip.save_trip')}
          onPress={handleCreateTrip}
          loading={saving}
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
      fontFamily: fonts.sansBold,
      fontSize: 18,
      color: colors.textPrimary,
    },
    addNavBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow.soft,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    tripCard: {
      marginBottom: spacing.md,
    },
    tripCoverPlaceholder: {
      width: '100%',
      height: 90,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    tripTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
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
    notesInput: {
      minHeight: 72,
      textAlignVertical: 'top',
    },
    dateRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    timeValueText: {
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.textPrimary,
    },
  });
