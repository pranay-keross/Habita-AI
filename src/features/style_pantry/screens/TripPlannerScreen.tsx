import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, Alert, RefreshControl } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import useAuth from '../../../hooks/useAuth';
import Plus from 'lucide-react-native/icons/plus';
import Luggage from 'lucide-react-native/icons/luggage';
import MapPin from 'lucide-react-native/icons/map-pin';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import GlassCard from '../../../components/GlassCard';
import { SkeletonBox, SkeletonText } from '../../../components/Skeleton';
import { addTrip, loadTrips, removeTrip } from '../stylePantryStore';
import { showStoreErrorAlert } from '../errors';
import { useBusy, useFocusLoad, useLocaleRerender } from '../hooks';
import { dateRangeLabel } from '../format';
import WardrobeHeader from '../components/WardrobeHeader';
import OfflineBanner from '../components/OfflineBanner';
import TripFormSheet from '../components/TripFormSheet';
import type { TripInput, WardrobeTrip } from '../types';
import { t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'Trips'>;

function TripCover({ uri, styles }: { uri?: string; styles: ReturnType<typeof makeStyles> }) {
  const [failed, setFailed] = useState(false);
  if (uri && !failed) {
    return <Image source={{ uri }} style={styles.tripCover} resizeMode="cover" onError={() => setFailed(true)} />;
  }
  return (
    <View style={styles.tripCover}>
      <Luggage size={28} color={styles.tint.color} />
    </View>
  );
}

export default function TripPlannerScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { getAccessToken } = useAuth();
  useLocaleRerender();

  const [trips, setTrips] = useState<WardrobeTrip[]>([]);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [busy, run] = useBusy();

  const { loading, refreshing, offline, refresh, reload } = useFocusLoad(
    useCallback(async () => {
      const r = await loadTrips(await getAccessToken());
      setTrips(r.data);
      return r;
    }, [getAccessToken]),
  );

  const handleCreateTrip = (input: TripInput) =>
    run(async () => {
      const r = await addTrip(input, await getAccessToken());
      if (!r.ok) {
        showStoreErrorAlert(r.error);
        return;
      }
      setShowAddSheet(false);
      setTrips(prev => [r.data, ...prev]);
      navigation.navigate('TripDetails', { tripId: r.data.id });
    });

  const confirmDelete = (trip: WardrobeTrip) => {
    Alert.alert(t('trip.delete_trip'), t('trip.delete_confirm_msg'), [
      { text: t('style_pantry.cancel'), style: 'cancel' },
      {
        text: t('style_pantry.delete'),
        style: 'destructive',
        onPress: () =>
          run(async () => {
            const r = await removeTrip(trip.id, await getAccessToken());
            if (!r.ok) {
              showStoreErrorAlert(r.error);
              return;
            }
            await reload();
          }),
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <WardrobeHeader
        title={t('trip.list_title')}
        onBack={() => navigation.goBack()}
        right={{ icon: Plus, primary: true, onPress: () => setShowAddSheet(true), accessibilityLabel: t('trip.new_trip') }}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={styles.tint.color} colors={[styles.tint.color]} />
        }>
        <OfflineBanner visible={offline} />
        {loading ? (
          <>
            {[0, 1].map(i => (
              <View key={i} style={styles.tripCard}>
                <SkeletonBox width="100%" height={90} borderRadius={12} />
                <SkeletonText width="50%" style={styles.skelLine} />
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
            <GlassCard key={trip.id} variant="default" style={styles.tripCard} onPress={() => navigation.navigate('TripDetails', { tripId: trip.id })}>
              <TripCover uri={trip.coverImageUri} styles={styles} />
              <Text style={styles.tripTitle}>{trip.title}</Text>
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
              <Text style={styles.deleteLink} onPress={() => confirmDelete(trip)} suppressHighlighting>
                {t('trip.delete_trip')}
              </Text>
            </GlassCard>
          ))
        )}
      </ScrollView>

      <TripFormSheet visible={showAddSheet} onClose={() => setShowAddSheet(false)} saving={busy} onSubmit={handleCreateTrip} />
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    tint: { color: colors.primary },
    placeholder: { color: colors.textSecondary },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    skelLine: { marginTop: 10 },
    tripCard: { marginBottom: spacing.md },
    tripCover: {
      width: '100%',
      height: 90,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
      overflow: 'hidden',
    },
    tripTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.textPrimary, marginBottom: spacing.xs },
    tripMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    tripMetaText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary },
    deleteLink: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.danger, marginTop: spacing.sm, alignSelf: 'flex-start' },
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
  });
