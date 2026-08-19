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
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import Bookmark from 'lucide-react-native/icons/bookmark';
import Shirt from 'lucide-react-native/icons/shirt';
import Button from '../../../components/Button';
import { recordWearOutfit, saveOutfit } from '../stylePantryStore';
import type { OutfitRecommendation } from '../types';
import { subscribeToLanguageChanges, t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'OutfitDetails'>;

export default function OutfitDetailsScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { outfit } = route.params;
  const [, setLocaleVersion] = useState(0);

  const [wearing, setWearing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubLang = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    return () => {
      unsubLang();
    };
  }, []);

  const handleWearToday = async () => {
    setWearing(true);
    const itemIds = outfit.items.map((i) => i.id);
    await recordWearOutfit(itemIds);
    setWearing(false);
    Alert.alert(
      t('style_pantry.worn_alert_title'),
      t('style_pantry.worn_alert_msg')
    );
    navigation.popTo('StylePantryDashboard');
  };

  const handleSaveOutfit = async () => {
    setSaving(true);
    await saveOutfit(outfit);
    setSaving(false);
    Alert.alert(
      t('style_pantry.outfit_saved_title'),
      t('style_pantry.outfit_saved_msg')
    );
  };

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('style_pantry.outfit_preview_title')}</Text>
        <Pressable onPress={handleSaveOutfit} style={styles.headerBtn}>
          <Bookmark size={18} color="#7C3AED" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Title Hero Card */}
        <View style={styles.heroCard}>
          <Text style={styles.occasionBadge}>{outfit.occasion}</Text>
          <Text style={styles.heroTitle}>{outfit.title}</Text>
          <Text style={styles.eventTitle}>{outfit.eventTitle}</Text>

          <View style={styles.scoresWrap}>
            <View style={styles.scorePillPurple}>
              <CheckCircle2 size={14} color="#7C3AED" style={{ marginRight: 4 }} />
              <Text style={styles.scoreTextPurple}>{outfit.occasionSuitability}</Text>
            </View>
            <View style={styles.scorePillGreen}>
              <CheckCircle2 size={14} color="#16A34A" style={{ marginRight: 4 }} />
              <Text style={styles.scoreTextGreen}>{outfit.weatherSuitability}</Text>
            </View>
          </View>
        </View>

        {/* Stylist Note */}
        <Text style={styles.sectionTitle}>{t('style_pantry.stylist_note')}</Text>
        <View style={styles.card}>
          <Text style={styles.noteText}>{outfit.stylistNote}</Text>
        </View>

        {/* Items List */}
        <Text style={styles.sectionTitle}>
          {t('style_pantry.items_in_outfit', { count: outfit.items.length })}
        </Text>
        <View style={styles.itemsWrap}>
          {outfit.items.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemEmojiBadge}>
                <Text style={{ fontSize: 24 }}>{item.emoji || '👕'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemSub}>
                  {item.category.toUpperCase()} · {item.color} {item.brand ? `(${item.brand})` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Bottom Actions */}
        <View style={styles.btnRow}>
          <Button
            title={t('style_pantry.wear_today')}
            onPress={handleWearToday}
            loading={wearing}
            style={styles.wearBtn}
          />
          <Pressable style={styles.saveOutlineBtn} onPress={handleSaveOutfit}>
            <Bookmark size={18} color="#7C3AED" style={{ marginRight: 6 }} />
            <Text style={styles.saveOutlineText}>{t('style_pantry.save_outfit')}</Text>
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
      backgroundColor: '#F3E8FF',
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: '#DDD6FE',
      marginBottom: spacing.md,
      ...shadow.soft,
    },
    occasionBadge: {
      fontFamily: fonts.sansBold,
      fontSize: 11,
      color: '#7C3AED',
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
      color: '#6D28D9',
      marginTop: 2,
      marginBottom: spacing.md,
    },
    scoresWrap: {
      gap: spacing.xs,
    },
    scorePillPurple: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.md,
    },
    scoreTextPurple: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: '#6D28D9',
    },
    scorePillGreen: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.md,
    },
    scoreTextGreen: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: '#15803D',
    },
    sectionTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
      ...shadow.soft,
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
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.soft,
    },
    itemEmojiBadge: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      backgroundColor: '#F1F5F9',
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
    wearBtn: {
      backgroundColor: '#7C3AED',
    },
    saveOutlineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      borderWidth: 1,
      borderColor: '#7C3AED',
    },
    saveOutlineText: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: '#7C3AED',
    },
  });
