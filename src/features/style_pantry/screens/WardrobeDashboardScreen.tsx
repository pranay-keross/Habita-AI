import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  Share,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import useAuth from '../../../hooks/useAuth';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Plus from 'lucide-react-native/icons/plus';
import BarChart3 from 'lucide-react-native/icons/chart-column';
import Heart from 'lucide-react-native/icons/heart';
import WandSparkles from 'lucide-react-native/icons/wand-sparkles';
import Share2 from 'lucide-react-native/icons/share-2';
import FolderOpen from 'lucide-react-native/icons/folder-open';
import Check from 'lucide-react-native/icons/check';
import GlassCard from '../../../components/GlassCard';
import BottomSheet from '../../../components/BottomSheet';
import Button from '../../../components/Button';
import { SkeletonBox, SkeletonText } from '../../../components/Skeleton';
import { loadClothingItems, loadCollections, addCollection } from '../stylePantryStore';
import { getClothingIconComponent } from '../clothingIcons';
import {
  COLLECTION_ICON_KEYS,
  getCollectionIconComponent,
} from '../collectionIcons';
import type { ClothingItem, WardrobeCollection } from '../types';
import { subscribeToLanguageChanges, t } from '../../../i18n';

type Props = StackScreenProps<
  RootStackParamList,
  'StylePantryDashboard' | 'Wardrobe'
>;

interface FolderCard {
  key: string;
  title: string;
  count: number;
  coverItems: ClothingItem[];
  iconKey: string;
  onPress: () => void;
}

export default function WardrobeDashboardScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuth();
  const [, setLocaleVersion] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [collections, setCollections] = useState<WardrobeCollection[]>([]);

  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIconKey, setNewIconKey] = useState<string>(COLLECTION_ICON_KEYS[0]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    const token = await getAccessToken();
    const [list, cols] = await Promise.all([
      loadClothingItems(token),
      loadCollections(token),
    ]);
    setItems(list);
    setCollections(cols);
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

  const ownedItems = items.filter(i => !i.isWishlist);
  const wishlistCount = items.filter(i => i.isWishlist).length;
  const winterItems = ownedItems.filter(i => i.season === 'winter');

  const resetCreateForm = () => {
    setNewName('');
    setNewIconKey(COLLECTION_ICON_KEYS[0]);
    setSelectedItemIds([]);
  };

  const toggleSelectedItem = (id: string) => {
    setSelectedItemIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id],
    );
  };

  const handleCreateCollection = async () => {
    if (!newName.trim()) {
      Alert.alert(
        t('closet.missing_name_title'),
        t('closet.missing_name_msg'),
      );
      return;
    }
    setCreating(true);
    const token = await getAccessToken();
    const { collection } = await addCollection(
      { name: newName.trim(), iconKey: newIconKey, itemIds: selectedItemIds },
      token,
    );
    setCreating(false);
    setShowCreateSheet(false);
    resetCreateForm();
    setCollections(prev => [collection, ...prev]);
  };

  const handleShareCloset = async () => {
    try {
      await Share.share({
        message: t('closet.share_message', {
          count: ownedItems.length,
        }),
      });
    } catch {
      // user cancelled the native share sheet — nothing to do
    }
  };

  const folders: FolderCard[] = [
    {
      key: 'all',
      title: t('closet.folder_all_clothes'),
      count: ownedItems.length,
      coverItems: ownedItems.slice(0, 4),
      iconKey: 'closet',
      onPress: () =>
        navigation.navigate('ClosetItems', {
          title: t('closet.folder_all_clothes'),
        }),
    },
    {
      key: 'winter',
      title: t('closet.folder_winter_items'),
      count: winterItems.length,
      coverItems: winterItems.slice(0, 4),
      iconKey: 'winter',
      onPress: () =>
        navigation.navigate('ClosetItems', {
          title: t('closet.folder_winter_items'),
          seasonFilter: 'winter',
        }),
    },
    ...collections.map(col => ({
      key: col.id,
      title: col.name,
      count: col.itemIds.length,
      coverItems: ownedItems.filter(i => col.itemIds.includes(i.id)).slice(0, 4),
      iconKey: col.iconKey,
      onPress: () =>
        navigation.navigate('ClosetItems', {
          title: col.name,
          collectionId: col.id,
        }),
    })),
  ];

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('closet.title')}</Text>
        <Pressable
          onPress={() => navigation.navigate('AddEditClothing', {})}
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
        {/* Action row */}
        <View style={styles.actionRow}>
          <Pressable
            style={styles.actionItem}
            onPress={() => navigation.navigate('StyleCalendar')}
          >
            <View style={styles.actionIconCircle}>
              <BarChart3 size={18} color={styles.iconTint.color} />
            </View>
            <Text style={styles.actionLabel}>{t('closet.action_stats')}</Text>
          </Pressable>
          <Pressable
            style={styles.actionItem}
            onPress={() =>
              navigation.navigate('ClosetItems', {
                title: t('closet.folder_wishlist'),
                wishlistOnly: true,
              })
            }
          >
            <View style={styles.actionIconCircle}>
              <Heart size={18} color={styles.iconTint.color} />
            </View>
            <Text style={styles.actionLabel}>
              {t('closet.action_wishlist')}
              {wishlistCount > 0 ? ` (${wishlistCount})` : ''}
            </Text>
          </Pressable>
          <Pressable
            style={styles.actionItem}
            onPress={() => setShowComingSoon(t('closet.action_beautify'))}
          >
            <View style={styles.actionIconCircle}>
              <WandSparkles size={18} color={styles.iconTint.color} />
            </View>
            <Text style={styles.actionLabel}>{t('closet.action_beautify')}</Text>
          </Pressable>
          <Pressable style={styles.actionItem} onPress={handleShareCloset}>
            <View style={styles.actionIconCircle}>
              <Share2 size={18} color={styles.iconTint.color} />
            </View>
            <Text style={styles.actionLabel}>{t('closet.action_share')}</Text>
          </Pressable>
        </View>

        {/* Folder grid */}
        {loading ? (
          <View style={styles.gridWrap}>
            {[0, 1].map(i => (
              <View key={i} style={styles.folderCard}>
                <SkeletonBox width="100%" height={90} borderRadius={12} />
                <SkeletonText width="60%" style={{ marginTop: 10 }} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.gridWrap}>
            {folders.map(folder => {
              const FolderIcon = getCollectionIconComponent(folder.iconKey);
              return (
                <GlassCard
                  key={folder.key}
                  variant="default"
                  style={styles.folderCard}
                  onPress={folder.onPress}
                >
                  <View style={styles.folderCover}>
                    {folder.coverItems.length > 0 ? (
                      folder.coverItems.map(item => {
                        const ItemIcon = getClothingIconComponent(item.emoji);
                        return (
                          <View key={item.id} style={styles.folderCoverTile}>
                            <ItemIcon size={18} color={styles.iconTint.color} />
                          </View>
                        );
                      })
                    ) : (
                      <View style={styles.folderCoverEmpty}>
                        <FolderIcon size={26} color={styles.iconTint.color} />
                      </View>
                    )}
                  </View>
                  <Text style={styles.folderTitle} numberOfLines={1}>
                    {folder.title}
                  </Text>
                  <Text style={styles.folderCount}>
                    {t('closet.folder_item_count', { count: folder.count })}
                  </Text>
                </GlassCard>
              );
            })}
            <Pressable
              style={styles.createFolderCard}
              onPress={() => setShowCreateSheet(true)}
            >
              <FolderOpen size={26} color={styles.iconTint.color} />
              <Text style={styles.createFolderText}>
                {t('closet.create_closet')}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Create closet sheet */}
      <BottomSheet
        visible={showCreateSheet}
        onClose={() => {
          setShowCreateSheet(false);
          resetCreateForm();
        }}
        title={t('closet.create_closet')}
      >
        <Text style={styles.inputLabel}>{t('closet.closet_name_label')}</Text>
        <TextInput
          style={styles.textInput}
          value={newName}
          onChangeText={setNewName}
          placeholder={t('closet.closet_name_placeholder')}
          placeholderTextColor={styles.placeholder.color}
        />
        <Text style={styles.inputLabel}>{t('closet.closet_icon_label')}</Text>
        <View style={styles.iconPickerWrap}>
          {COLLECTION_ICON_KEYS.map(key => {
            const IconComp = getCollectionIconComponent(key);
            const active = newIconKey === key;
            return (
              <Pressable
                key={key}
                style={[styles.iconChoice, active && styles.iconChoiceActive]}
                onPress={() => setNewIconKey(key)}
              >
                <IconComp
                  size={18}
                  color={
                    active
                      ? styles.headerIconOnPrimary.color
                      : styles.iconTint.color
                  }
                />
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.inputLabel}>{t('closet.closet_items_label')}</Text>
        <View style={styles.itemPickList}>
          {ownedItems.map(item => {
            const selected = selectedItemIds.includes(item.id);
            const ItemIcon = getClothingIconComponent(item.emoji);
            return (
              <Pressable
                key={item.id}
                style={styles.itemPickRow}
                onPress={() => toggleSelectedItem(item.id)}
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
          title={t('closet.save_closet')}
          onPress={handleCreateCollection}
          loading={creating}
          style={{ marginTop: 8 }}
        />
      </BottomSheet>

      {/* Coming soon sheet for Beautify (and any future not-yet-built action) */}
      <BottomSheet
        visible={!!showComingSoon}
        onClose={() => setShowComingSoon(null)}
        title={showComingSoon || ''}
      >
        <Text style={styles.comingSoonText}>{t('ai_stylist.coming_soon')}</Text>
        <Button
          title={t('ai_stylist.coming_soon_ok')}
          onPress={() => setShowComingSoon(null)}
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
    headerIcon: { color: colors.textPrimary },
    headerIconOnPrimary: { color: colors.textOnPrimary },
    iconTint: { color: colors.primary },
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
    actionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    actionItem: {
      alignItems: 'center',
      flex: 1,
    },
    actionIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 6,
    },
    actionLabel: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    gridWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    folderCard: {
      width: '48%',
      marginBottom: spacing.md,
      padding: spacing.md,
    },
    folderCover: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      height: 90,
    },
    folderCoverTile: {
      width: '47%',
      height: '47%',
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    folderCoverEmpty: {
      width: '100%',
      height: '100%',
      borderRadius: radius.md,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    folderTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.textPrimary,
      marginTop: spacing.sm,
    },
    folderCount: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    createFolderCard: {
      width: '48%',
      marginBottom: spacing.md,
      padding: spacing.md,
      borderRadius: radius.card,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 154,
    },
    createFolderText: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.primary,
      marginTop: spacing.sm,
      textAlign: 'center',
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
    placeholder: { color: colors.textSecondary },
    iconPickerWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    iconChoice: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconChoiceActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
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
    itemPickIconBadge: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    itemPickName: {
      flex: 1,
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textPrimary,
    },
    comingSoonText: {
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: spacing.sm,
    },
  });
