import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import useAuth from '../../../hooks/useAuth';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Pencil from 'lucide-react-native/icons/pencil';
import Trash2 from 'lucide-react-native/icons/trash-2';
import Tag from 'lucide-react-native/icons/tag';
import Clock from 'lucide-react-native/icons/clock';
import Button from '../../../components/Button';
import GlassCard from '../../../components/GlassCard';
import { SkeletonBox, SkeletonText } from '../../../components/Skeleton';
import { loadClothingItems, deleteClothingItem } from '../stylePantryStore';
import { getClothingIconComponent } from '../clothingIcons';
import type { ClothingItem } from '../types';
import { subscribeToLanguageChanges, t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'ClothingDetails'>;

export default function ClothingDetailsScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuth();
  const { itemId } = route.params;
  const [, setLocaleVersion] = useState(0);

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<ClothingItem | undefined>();

  const fetchDetail = async () => {
    setLoading(true);
    const token = await getAccessToken();
    const list = await loadClothingItems(token);
    const found = list.find((i) => i.id === itemId);
    setItem(found);
    setLoading(false);
  };

  useEffect(() => {
    const unsubLang = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    fetchDetail();
    return () => {
      unsubLang();
    };
  }, [itemId]);

  const handleDelete = () => {
    if (!item) return;
    Alert.alert(
      t('style_pantry.delete_confirm_title'),
      t('style_pantry.delete_confirm_msg', { name: item.name }),
      [
        { text: t('style_pantry.cancel'), style: 'cancel' },
        {
          text: t('style_pantry.delete'),
          style: 'destructive',
          onPress: async () => {
            const token = await getAccessToken();
            await deleteClothingItem(item.id, token);
            Alert.alert(t('style_pantry.dash_title'), t('style_pantry.deleted_msg'));
            navigation.goBack();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerBtn} />
          <SkeletonText width={140} height={18} />
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.content}>
          <SkeletonBox width="100%" height={180} borderRadius={16} style={{ marginBottom: 16 }} />
          <SkeletonBox width="100%" height={100} borderRadius={16} />
        </View>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.errorText}>{t('style_pantry.item_not_found')}</Text>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>{t('style_pantry.go_back')}</Text>
        </Pressable>
      </View>
    );
  }

  const ItemIcon = getClothingIconComponent(item.emoji);

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('style_pantry.item_details_title')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => navigation.navigate('AddEditClothing', { itemId: item.id })}
            style={styles.headerActionBtn}>
            <Pencil size={18} color={styles.iconTint.color} />
          </Pressable>
          <Pressable onPress={handleDelete} style={styles.headerActionBtn}>
            <Trash2 size={18} color={styles.dangerColor.color} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Large Clothing Hero Card */}
        <GlassCard variant="elevated" style={styles.heroCard}>
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={styles.heroEmojiBadge}>
              <ItemIcon size={42} color={styles.iconTint.color} />
            </View>
          )}
          <Text style={styles.heroTitle}>{item.name}</Text>
          <Text style={styles.heroSub}>
            {item.category.toUpperCase()} · {item.color}
          </Text>
        </GlassCard>

        {/* Info Metadata Card */}
        <Text style={styles.sectionTitle}>{t('style_pantry.clothing_info')}</Text>
        <GlassCard variant="default" style={styles.card}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t('style_pantry.brand_label')}</Text>
            <Text style={styles.metaVal}>{item.brand || t('style_pantry.not_specified')}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t('style_pantry.season_label')}</Text>
            <Text style={styles.metaVal}>{item.season.toUpperCase()}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t('style_pantry.material_label')}</Text>
            <Text style={styles.metaVal}>{item.material || t('style_pantry.standard_fabric')}</Text>
          </View>
        </GlassCard>

        {/* Style Tags Card */}
        {item.tags.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('style_pantry.tags_label')}</Text>
            <GlassCard variant="default" style={styles.card}>
              <View style={styles.tagsWrap}>
                {item.tags.map((tag) => (
                  <View key={tag} style={styles.tagBadge}>
                    <Tag size={12} color={styles.iconTint.color} style={{ marginRight: 4 }} />
                    <Text style={styles.tagBadgeText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            </GlassCard>
          </>
        )}

        {/* Usage & Wear History Card */}
        <Text style={styles.sectionTitle}>{t('style_pantry.usage_history')}</Text>
        <GlassCard variant="default" style={styles.card}>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{item.wearCount}</Text>
              <Text style={styles.statLabel}>{t('style_pantry.times_worn')}</Text>
            </View>
            <View style={styles.vDivider} />
            <View style={styles.statBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Clock size={16} color={styles.iconTint.color} />
                <Text style={styles.statDateVal}>
                  {item.lastWornDate || t('style_pantry.not_worn_yet')}
                </Text>
              </View>
              <Text style={styles.statLabel}>{t('style_pantry.last_worn_date')}</Text>
            </View>
          </View>
        </GlassCard>

        {/* Style with AI Button */}
        <Button
          title={t('style_pantry.try_style_mirror')}
          onPress={() => navigation.navigate('StyleMirror')}
        />
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
    center: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
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
    headerActionBtn: {
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
    iconTint: {
      color: colors.primary,
    },
    dangerColor: {
      color: colors.danger,
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
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    heroImage: {
      width: 96,
      height: 96,
      borderRadius: radius.md,
      marginBottom: spacing.md,
    },
    heroEmojiBadge: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    heroTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 18,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    heroSub: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.primary,
      marginTop: 4,
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
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    metaLabel: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textSecondary,
    },
    metaVal: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.textPrimary,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.xs,
    },
    tagsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    tagBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.blush,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.md,
    },
    tagBadgeText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.primary,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingVertical: spacing.xs,
    },
    statBox: {
      alignItems: 'center',
      flex: 1,
    },
    vDivider: {
      width: 1,
      height: 40,
      backgroundColor: colors.border,
    },
    statNumber: {
      fontFamily: fonts.sansBold,
      fontSize: 22,
      color: colors.primary,
    },
    statDateVal: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.textPrimary,
    },
    statLabel: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    errorText: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    backBtn: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    backBtnText: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.textPrimary,
    },
  });
