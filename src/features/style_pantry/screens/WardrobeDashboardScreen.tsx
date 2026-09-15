import React, { useCallback, useMemo, useState } from 'react';
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
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import useAuth from '../../../hooks/useAuth';
import Plus from 'lucide-react-native/icons/plus';
import BarChart3 from 'lucide-react-native/icons/chart-column';
import Heart from 'lucide-react-native/icons/heart';
import WandSparkles from 'lucide-react-native/icons/wand-sparkles';
import Share2 from 'lucide-react-native/icons/share-2';
import FolderOpen from 'lucide-react-native/icons/folder-open';
import Pencil from 'lucide-react-native/icons/pencil';
import Trash2 from 'lucide-react-native/icons/trash';
import GlassCard from '../../../components/GlassCard';
import BottomSheet from '../../../components/BottomSheet';
import Button from '../../../components/Button';
import { SkeletonBox, SkeletonText } from '../../../components/Skeleton';
import {
  loadClothingItems,
  loadCollections,
  addCollection,
  editCollection,
  removeCollection,
  ownedItems as pickOwned,
} from '../stylePantryStore';
import { showStoreErrorAlert } from '../errors';
import { useBusy, useFocusLoad, useLocaleRerender } from '../hooks';
import WardrobeHeader from '../components/WardrobeHeader';
import ItemThumb from '../components/ItemThumb';
import OfflineBanner from '../components/OfflineBanner';
import ItemPickerSheet from '../components/ItemPickerSheet';
import {
  COLLECTION_ICON_KEYS,
  getCollectionIconComponent,
} from '../collectionIcons';
import type { ClothingItem, WardrobeCollection } from '../types';
import { t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'Wardrobe'>;

interface FolderCard {
  key: string;
  title: string;
  count: number;
  coverItems: ClothingItem[];
  iconKey: string;
  onPress: () => void;
  collection?: WardrobeCollection;
}

export default function WardrobeDashboardScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { getAccessToken } = useAuth();
  useLocaleRerender();

  const [items, setItems] = useState<ClothingItem[]>([]);
  const [collections, setCollections] = useState<WardrobeCollection[]>([]);

  // Create / edit closet sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<WardrobeCollection | null>(null);
  const [name, setName] = useState('');
  const [iconKey, setIconKey] = useState<string>(COLLECTION_ICON_KEYS[0]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [optionsFor, setOptionsFor] = useState<WardrobeCollection | null>(null);
  const [showComingSoon, setShowComingSoon] = useState<string | null>(null);
  const [busy, run] = useBusy();

  const { loading, refreshing, offline, refresh, reload } = useFocusLoad(
    useCallback(async () => {
      const token = await getAccessToken();
      const [list, cols] = await Promise.all([
        loadClothingItems(token),
        loadCollections(token),
      ]);
      setItems(list.data);
      setCollections(cols.data);
      return { offline: list.offline || cols.offline };
    }, [getAccessToken]),
  );

  const owned = useMemo(() => pickOwned(items), [items]);
  const wishlistCount = items.length - owned.length;
  const winterItems = useMemo(() => owned.filter(i => i.season === 'winter'), [owned]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setIconKey(COLLECTION_ICON_KEYS[0]);
    setSelectedIds([]);
    setSheetOpen(true);
  };

  const openEdit = (col: WardrobeCollection) => {
    setOptionsFor(null);
    setEditing(col);
    setName(col.name);
    setIconKey(col.iconKey);
    setSelectedIds(col.itemIds.filter(id => owned.some(i => i.id === id)));
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setEditing(null);
  };

  const handleSaveCollection = () =>
    run(async () => {
      const trimmed = name.trim();
      if (!trimmed) {
        Alert.alert(t('closet.missing_name_title'), t('closet.missing_name_msg'));
        return;
      }
      const token = await getAccessToken();
      const input = { name: trimmed, iconKey, itemIds: selectedIds };
      const result = editing
        ? await editCollection(editing.id, input, token)
        : await addCollection(input, token);
      if (!result.ok) {
        showStoreErrorAlert(result.error);
        return;
      }
      closeSheet();
      await reload();
    });

  const confirmDelete = (col: WardrobeCollection) => {
    setOptionsFor(null);
    Alert.alert(
      t('closet.delete_closet_confirm_title'),
      t('closet.delete_closet_confirm_msg'),
      [
        { text: t('style_pantry.cancel'), style: 'cancel' },
        {
          text: t('style_pantry.delete'),
          style: 'destructive',
          onPress: () =>
            run(async () => {
              const token = await getAccessToken();
              const result = await removeCollection(col.id, token);
              if (!result.ok) {
                showStoreErrorAlert(result.error);
                return;
              }
              await reload();
            }),
        },
      ],
    );
  };

  const handleShareCloset = async () => {
    try {
      await Share.share({
        message: t('closet.share_message', { count: owned.length }),
      });
    } catch {
      // user cancelled the native share sheet
    }
  };

  const folders: FolderCard[] = [
    {
      key: 'all',
      title: t('closet.folder_all_clothes'),
      count: owned.length,
      coverItems: owned.slice(0, 4),
      iconKey: 'closet',
      onPress: () =>
        navigation.navigate('ClosetItems', { title: t('closet.folder_all_clothes') }),
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
    ...collections.map(col => {
      const members = owned.filter(i => col.itemIds.includes(i.id));
      return {
        key: col.id,
        title: col.name,
        count: members.length,
        coverItems: members.slice(0, 4),
        iconKey: col.iconKey,
        collection: col,
        onPress: () =>
          navigation.navigate('ClosetItems', { title: col.name, collectionId: col.id }),
      };
    }),
  ];

  return (
    <View style={styles.root}>
      <WardrobeHeader
        title={t('closet.title')}
        onBack={() => navigation.goBack()}
        right={{
          icon: Plus,
          primary: true,
          accessibilityLabel: t('style_pantry.add_item_btn'),
          onPress: () => navigation.navigate('AddEditClothing', {}),
        }}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={styles.iconTint.color}
            colors={[styles.iconTint.color]}
          />
        }
      >
        <OfflineBanner visible={offline} />

        <View style={styles.actionRow}>
          <Pressable style={styles.actionItem} onPress={() => navigation.navigate('StyleCalendar')}>
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
          <Pressable style={styles.actionItem} onPress={() => setShowComingSoon(t('closet.action_beautify'))}>
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

        {loading ? (
          <View style={styles.gridWrap}>
            {[0, 1].map(i => (
              <View key={i} style={styles.folderCard}>
                <SkeletonBox width="100%" height={90} borderRadius={12} />
                <SkeletonText width="60%" style={styles.skeletonGap} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.gridWrap}>
            {folders.map(folder => {
              const FolderIcon = getCollectionIconComponent(folder.iconKey);
              return (
                <Pressable
                  key={folder.key}
                  style={styles.folderCardWrap}
                  onPress={folder.onPress}
                  onLongPress={folder.collection ? () => setOptionsFor(folder.collection ?? null) : undefined}
                  delayLongPress={350}
                >
                  <GlassCard variant="default" style={styles.folderCard}>
                    <View style={styles.folderCover}>
                      {folder.coverItems.length > 0 ? (
                        folder.coverItems.map(item => (
                          <ItemThumb key={item.id} item={item} size={40} radius={6} style={styles.folderCoverTile} />
                        ))
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
                </Pressable>
              );
            })}
            <Pressable style={styles.createFolderCard} onPress={openCreate}>
              <FolderOpen size={26} color={styles.iconTint.color} />
              <Text style={styles.createFolderText}>{t('closet.create_closet')}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Create / edit closet */}
      <BottomSheet
        visible={sheetOpen}
        onClose={closeSheet}
        title={editing ? t('closet.edit_closet') : t('closet.create_closet')}
      >
        <Text style={styles.inputLabel}>{t('closet.closet_name_label')}</Text>
        <TextInput
          style={styles.textInput}
          value={name}
          onChangeText={setName}
          placeholder={t('closet.closet_name_placeholder')}
          placeholderTextColor={styles.placeholder.color}
        />
        <Text style={styles.inputLabel}>{t('closet.closet_icon_label')}</Text>
        <View style={styles.iconPickerWrap}>
          {COLLECTION_ICON_KEYS.map(key => {
            const IconComp = getCollectionIconComponent(key);
            const active = iconKey === key;
            return (
              <Pressable
                key={key}
                style={[styles.iconChoice, active && styles.iconChoiceActive]}
                onPress={() => setIconKey(key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <IconComp size={18} color={active ? styles.iconOnPrimary.color : styles.iconTint.color} />
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.inputLabel}>{t('closet.closet_items_label')}</Text>
        <Pressable style={styles.pickItemsBtn} onPress={() => setPickerOpen(true)}>
          <View style={styles.pickPreview}>
            {owned
              .filter(i => selectedIds.includes(i.id))
              .slice(0, 5)
              .map(i => (
                <ItemThumb key={i.id} item={i} size={32} radius={6} style={styles.pickPreviewThumb} />
              ))}
          </View>
          <Text style={styles.pickItemsText}>
            {t('closet.items_selected', { count: selectedIds.length })}
          </Text>
        </Pressable>
        <Button
          title={t('closet.save_closet')}
          onPress={handleSaveCollection}
          loading={busy}
          style={styles.sheetBtn}
        />
      </BottomSheet>

      <ItemPickerSheet
        visible={pickerOpen}
        title={t('closet.closet_items_label')}
        items={owned}
        selectedIds={selectedIds}
        onClose={() => setPickerOpen(false)}
        onConfirm={ids => {
          setSelectedIds(ids);
          setPickerOpen(false);
        }}
        confirmLabel={t('closet.closet_items_label')}
      />

      {/* Long-press options for a custom closet */}
      <BottomSheet
        visible={!!optionsFor}
        onClose={() => setOptionsFor(null)}
        title={optionsFor?.name ?? t('closet.closet_options')}
      >
        <Pressable style={styles.optionRow} onPress={() => optionsFor && openEdit(optionsFor)}>
          <Pencil size={18} color={styles.iconTint.color} />
          <Text style={styles.optionText}>{t('closet.edit_closet')}</Text>
        </Pressable>
        <Pressable style={styles.optionRow} onPress={() => optionsFor && confirmDelete(optionsFor)}>
          <Trash2 size={18} color={styles.danger.color} />
          <Text style={[styles.optionText, styles.danger]}>{t('closet.delete_closet')}</Text>
        </Pressable>
      </BottomSheet>

      <BottomSheet
        visible={!!showComingSoon}
        onClose={() => setShowComingSoon(null)}
        title={showComingSoon || ''}
      >
        <Text style={styles.comingSoonText}>{t('ai_stylist.coming_soon')}</Text>
        <Button title={t('ai_stylist.coming_soon_ok')} onPress={() => setShowComingSoon(null)} style={styles.sheetBtn} />
      </BottomSheet>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    iconTint: { color: colors.primary },
    iconOnPrimary: { color: colors.textOnPrimary },
    danger: { color: colors.danger },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg },
    actionItem: { alignItems: 'center', flex: 1 },
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
    actionLabel: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textSecondary, textAlign: 'center' },
    gridWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    folderCardWrap: { width: '48%', marginBottom: spacing.md },
    folderCard: { width: '100%', padding: spacing.md },
    skeletonGap: { marginTop: 10 },
    folderCover: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, height: 90 },
    folderCoverTile: { width: '47%', height: '47%' },
    folderCoverEmpty: {
      width: '100%',
      height: '100%',
      borderRadius: radius.md,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    folderTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary, marginTop: spacing.sm },
    folderCount: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
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
    createFolderText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.primary, marginTop: spacing.sm, textAlign: 'center' },
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
    iconPickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
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
    iconChoiceActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    pickItemsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm,
    },
    pickPreview: { flexDirection: 'row', gap: 4 },
    pickPreviewThumb: { marginRight: 0 },
    pickItemsText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.primary },
    sheetBtn: { marginTop: spacing.md },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    optionText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
    comingSoonText: { fontFamily: fonts.sans, fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.sm },
  });
