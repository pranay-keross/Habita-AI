import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import useAuth from '../../../hooks/useAuth';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import Bookmark from 'lucide-react-native/icons/bookmark';
import Button from '../../../components/Button';
import GlassCard from '../../../components/GlassCard';
import {
  logStyleHistoryEntry,
  recordWearOutfit,
  saveOutfit,
} from '../stylePantryStore';
import { getClothingIconComponent } from '../clothingIcons';
import type { OutfitRecommendation } from '../types';
import { subscribeToLanguageChanges, t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'OutfitDetails'>;

export default function OutfitDetailsScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuth();
  const { outfit } = route.params;
  const [, setLocaleVersion] = useState(0);

  const [wearing, setWearing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubLang = subscribeToLanguageChanges(() =>
      setLocaleVersion(v => v + 1),
    );
    return () => {
      unsubLang();
    };
  }, []);

  const handleWearToday = async () => {
    setWearing(true);
    const token = await getAccessToken();
    const itemIds = outfit.items.map(i => i.id);
    await Promise.all([
      recordWearOutfit(itemIds, token),
      logStyleHistoryEntry(outfit, token),
    ]);
    setWearing(false);
    Alert.alert(
      t('style_pantry.worn_alert_title'),
      t('style_pantry.worn_alert_msg'),
    );
    navigation.popTo('StylePantryDashboard');
  };

  const handleSaveOutfit = async () => {
    setSaving(true);
    const token = await getAccessToken();
    await saveOutfit(outfit, token);
    setSaving(false);
    Alert.alert(
      t('style_pantry.outfit_saved_title'),
      t('style_pantry.outfit_saved_msg'),
    );
  };

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {t('style_pantry.outfit_preview_title')}
        </Text>
        <Pressable onPress={handleSaveOutfit} style={styles.headerBtn}>
          <Bookmark size={18} color={styles.aiAccent.color} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Title Hero Card */}
        <GlassCard variant="glow" style={styles.heroCard}>
          <Text style={styles.occasionBadge}>{outfit.occasion}</Text>
          <Text style={styles.heroTitle}>{outfit.title}</Text>
          <Text style={styles.eventTitle}>{outfit.eventTitle}</Text>

          <View style={styles.scoresWrap}>
            <View style={styles.scorePillPrimary}>
              <CheckCircle2
                size={14}
                color={styles.aiAccent.color}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.scoreTextPrimary}>
                {outfit.occasionSuitability}
              </Text>
            </View>
            <View style={styles.scorePillGreen}>
              <CheckCircle2
                size={14}
                color={styles.successColor.color}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.scoreTextGreen}>
                {outfit.weatherSuitability}
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* Stylist Note */}
        <Text style={styles.sectionTitle}>
          {t('style_pantry.stylist_note')}
        </Text>
        <GlassCard variant="default" style={styles.card}>
          <Text style={styles.noteText}>{outfit.stylistNote}</Text>
        </GlassCard>

        {/* Items List */}
        <Text style={styles.sectionTitle}>
          {t('style_pantry.items_in_outfit', { count: outfit.items.length })}
        </Text>
        <View style={styles.itemsWrap}>
          {outfit.items.map(item => {
            const ItemIcon = getClothingIconComponent(item.emoji);
            return (
              <GlassCard
                key={item.id}
                variant="default"
                style={styles.itemCard}
              >
                <View style={styles.itemRow}>
                  <View style={styles.itemEmojiBadge}>
                    <ItemIcon size={24} color={styles.iconTint.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemSub}>
                      {item.category.toUpperCase()} · {item.color}{' '}
                      {item.brand ? `(${item.brand})` : ''}
                    </Text>
                  </View>
                </View>
              </GlassCard>
            );
          })}
        </View>

        {/* Bottom Actions */}
        <View style={styles.btnRow}>
          <Button
            title={t('style_pantry.wear_today')}
            onPress={handleWearToday}
            loading={wearing}
          />
          <Pressable style={styles.saveOutlineBtn} onPress={handleSaveOutfit}>
            <Bookmark
              size={18}
              color={styles.aiAccent.color}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.saveOutlineText}>
              {t('style_pantry.save_outfit')}
            </Text>
          </Pressable>
        </View>
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
    aiAccent: {
      color: colors.primary,
    },
    successColor: {
      color: colors.forest,
    },
    iconTint: {
      color: colors.primary,
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
    heroCard: {
      marginBottom: spacing.md,
    },
    occasionBadge: {
      fontFamily: fonts.sansBold,
      fontSize: 11,
      color: colors.primary,
      letterSpacing: 1,
      marginBottom: 4,
    },
    heroTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 18,
      color: colors.textPrimary,
    },
    eventTitle: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
      marginBottom: spacing.md,
    },
    scoresWrap: {
      gap: spacing.xs,
    },
    scorePillPrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.md,
    },
    scoreTextPrimary: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.primary,
    },
    scorePillGreen: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.md,
    },
    scoreTextGreen: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.forest,
    },
    sectionTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    card: {
      marginBottom: spacing.md,
    },
    noteText: {
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    itemsWrap: {
      gap: spacing.xs,
      marginBottom: spacing.lg,
    },
    itemCard: {
      padding: spacing.md,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    itemEmojiBadge: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    itemName: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.textPrimary,
    },
    itemSub: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    btnRow: {
      gap: spacing.sm,
    },
    saveOutlineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    saveOutlineText: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.primary,
    },
  });
