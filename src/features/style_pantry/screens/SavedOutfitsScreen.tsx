import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import useAuth from '../../../hooks/useAuth';
import Bookmark from 'lucide-react-native/icons/bookmark';
import { SkeletonBox, SkeletonText } from '../../../components/Skeleton';
import { loadSavedOutfits, unsaveOutfit } from '../stylePantryStore';
import { showStoreErrorAlert } from '../errors';
import { useBusy, useFocusLoad, useLocaleRerender } from '../hooks';
import WardrobeHeader from '../components/WardrobeHeader';
import OfflineBanner from '../components/OfflineBanner';
import OutfitShowcase from '../components/OutfitShowcase';
import type { OutfitRecommendation } from '../types';
import { t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'SavedOutfits'>;

export default function SavedOutfitsScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { getAccessToken } = useAuth();
  useLocaleRerender();

  const [outfits, setOutfits] = useState<OutfitRecommendation[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, run] = useBusy();

  const { loading, refreshing, offline, refresh } = useFocusLoad(
    useCallback(async () => {
      const token = await getAccessToken();
      const result = await loadSavedOutfits(token);
      setOutfits(result.data);
      return { offline: result.offline };
    }, [getAccessToken]),
  );

  const handleUnsave = (outfitId: string) =>
    run(async () => {
      setBusyId(outfitId);
      const token = await getAccessToken();
      const result = await unsaveOutfit(outfitId, token);
      setBusyId(null);
      if (!result.ok) {
        showStoreErrorAlert(result.error);
        return;
      }
      setOutfits(prev => prev.filter(o => o.id !== outfitId));
    });

  return (
    <View style={styles.root}>
      <WardrobeHeader title={t('style_pantry.saved_outfits_title')} onBack={() => navigation.goBack()} />

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
              <View key={i} style={styles.skelCard}>
                <SkeletonText width="40%" height={12} style={styles.skelLine} />
                <SkeletonBox width="100%" height={160} borderRadius={20} />
              </View>
            ))}
          </View>
        ) : outfits.length === 0 ? (
          <View style={styles.emptyCard}>
            <Bookmark size={36} color={styles.placeholder.color} />
            <Text style={styles.emptyTitle}>{t('style_pantry.no_saved_outfits')}</Text>
            <Text style={styles.emptySub}>{t('style_pantry.saved_outfits_empty_sub')}</Text>
          </View>
        ) : (
          outfits.map(outfit => (
            <View key={outfit.id} style={styles.card}>
              <OutfitShowcase
                outfit={outfit}
                layout="chat"
                busy={busyId === outfit.id}
                onView={() => navigation.navigate('OutfitDetails', { outfit })}
                onToggleSave={() => handleUnsave(outfit.id)}
                onItemPress={item => navigation.navigate('ClothingDetails', { itemId: item.id })}
              />
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    tint: { color: colors.primary },
    placeholder: { color: colors.textSecondary },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    card: { marginBottom: spacing.md },
    skelCard: { marginBottom: spacing.lg },
    skelLine: { marginBottom: spacing.sm },
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
