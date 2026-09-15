import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  Image,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { keepLocalCopy } from '@react-native-documents/picker';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import useAuth from '../../../hooks/useAuth';
import Camera from 'lucide-react-native/icons/camera';
import ImageIcon from 'lucide-react-native/icons/image';
import Button from '../../../components/Button';
import BottomSheet from '../../../components/BottomSheet';
import { SkeletonBox } from '../../../components/Skeleton';
import {
  addClothingItem,
  addItemToCollection,
  updateClothingItem,
  getClothingItem,
} from '../stylePantryStore';
import { showStoreErrorAlert } from '../errors';
import { useBusy, useFocusLoad, useLocaleRerender } from '../hooks';
import { categoryLabel, seasonLabel } from '../format';
import WardrobeHeader from '../components/WardrobeHeader';
import ItemThumb from '../components/ItemThumb';
import OfflineBanner from '../components/OfflineBanner';
import { CATEGORY_ICON_KEYS, getClothingIconComponent } from '../clothingIcons';
import {
  CLOTHING_CATEGORIES,
  CLOTHING_SEASONS,
  type ClothingCategory,
  type ClothingItemInput,
  type ClothingSeason,
  type PickedFile,
} from '../types';
import { t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'AddEditClothing'>;

// On iOS the picker can return asset-library URIs (ph://) that a later multipart
// upload can't read from directly — copy a local cache copy first.
async function resolveLocalUri(uri: string, fileName: string): Promise<string> {
  if (!uri.startsWith('ph://') && !uri.startsWith('assets-library://')) {
    return uri;
  }
  try {
    const copies = await keepLocalCopy({
      files: [{ uri, fileName }],
      destination: 'cachesDirectory',
    });
    if (copies && copies[0] && copies[0].status === 'success') {
      return copies[0].localUri;
    }
  } catch {
    // fall back to the original uri and let the upload surface any error
  }
  return uri;
}

function parsePrice(value: string): { ok: true; price?: number } | { ok: false } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, price: undefined };
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return { ok: false };
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? { ok: true, price: n } : { ok: false };
}

export default function AddEditClothingScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuth();
  const itemId = route.params?.itemId;
  const collectionId = route.params?.collectionId;
  const wishlistDefault = !itemId && route.params?.wishlist === true;
  useLocaleRerender();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<ClothingCategory>('tops');
  const [color, setColor] = useState('');
  const [brand, setBrand] = useState('');
  const [season, setSeason] = useState<ClothingSeason>('all-year');
  const [material, setMaterial] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [purchasePriceStr, setPurchasePriceStr] = useState('');
  const [isWishlist, setIsWishlist] = useState(wishlistDefault);
  const [existingImageUri, setExistingImageUri] = useState<string | undefined>(undefined);
  const [notFound, setNotFound] = useState(false);
  const [pickedPhoto, setPickedPhoto] = useState<PickedFile | null>(null);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [busy, run] = useBusy();

  const { loading, offline } = useFocusLoad(
    useCallback(async () => {
      if (!itemId) return;
      const token = await getAccessToken();
      const r = await getClothingItem(itemId, token);
      const found = r.data;
      if (!found) {
        setNotFound(true);
        return { offline: r.offline };
      }
      setName(found.name);
      setCategory(found.category);
      setColor(found.color);
      setBrand(found.brand ?? '');
      setSeason(found.season);
      setMaterial(found.material ?? '');
      setTagsStr(found.tags.join(', '));
      setPurchasePriceStr(found.purchasePrice != null ? String(found.purchasePrice) : '');
      setIsWishlist(found.isWishlist);
      setExistingImageUri(found.imageUri);
      return { offline: r.offline };
    }, [getAccessToken, itemId]),
  );

  const pickAsset = (asset: { uri?: string; fileName?: string; type?: string } | undefined) =>
    run(async () => {
      if (!asset?.uri) return;
      const fileName = asset.fileName || 'item.jpg';
      const uri = await resolveLocalUri(asset.uri, fileName);
      setPickedPhoto({ uri, name: fileName, type: asset.type || 'image/jpeg' });
    });

  const handleTakePhoto = async () => {
    setShowPhotoSheet(false);
    const res = await launchCamera({ mediaType: 'photo', cameraType: 'back', quality: 0.8, saveToPhotos: false });
    if (res.didCancel) return;
    await pickAsset(res.assets?.[0]);
  };

  const handlePickFromGallery = async () => {
    setShowPhotoSheet(false);
    const res = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.8 });
    if (res.didCancel) return;
    await pickAsset(res.assets?.[0]);
  };

  const handleSave = () =>
    run(async () => {
      if (!name.trim()) {
        Alert.alert(t('style_pantry.missing_name'), t('style_pantry.enter_name_msg'));
        return;
      }
      const price = parsePrice(purchasePriceStr);
      if (!price.ok) {
        Alert.alert(t('style_pantry.error_title'), t('style_pantry.invalid_price_msg'));
        return;
      }

      const input: ClothingItemInput = {
        name: name.trim(),
        category,
        color: color.trim() || t('style_pantry.not_specified'),
        brand: brand.trim() || undefined,
        season,
        material: material.trim() || undefined,
        tags: tagsStr
          .split(',')
          .map(tag => tag.trim().toLowerCase())
          .filter(tag => tag.length > 0),
        emoji: CATEGORY_ICON_KEYS[category],
        purchasePrice: price.price,
        isWishlist,
      };

      const token = await getAccessToken();
      const result = itemId
        ? await updateClothingItem(itemId, input, pickedPhoto, token)
        : await addClothingItem(input, pickedPhoto, token);
      if (!result.ok) {
        showStoreErrorAlert(result.error);
        return;
      }
      if (!itemId && collectionId) {
        const added = await addItemToCollection(collectionId, result.data.id, token);
        if (!added.ok) {
          // The item exists either way; only the folder membership failed.
          showStoreErrorAlert(added.error);
        }
      }
      navigation.goBack();
    });

  const CategoryIcon = getClothingIconComponent(CATEGORY_ICON_KEYS[category]);

  return (
    <View style={styles.root}>
      <WardrobeHeader
        title={itemId ? t('style_pantry.edit_title') : t('style_pantry.add_title')}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 54 : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 160 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <OfflineBanner visible={offline} />

          {itemId && loading ? (
            <>
              <SkeletonBox width="100%" height={150} borderRadius={14} style={styles.skeletonGap} />
              <SkeletonBox width="100%" height={220} borderRadius={14} />
            </>
          ) : itemId && notFound ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t('style_pantry.item_not_found')}</Text>
              <Button title={t('style_pantry.go_back')} onPress={() => navigation.goBack()} style={styles.saveBtn} />
            </View>
          ) : (
            <>
              <Pressable style={styles.photoUploadCard} onPress={() => setShowPhotoSheet(true)}>
                {pickedPhoto ? (
                  <Image source={{ uri: pickedPhoto.uri }} style={styles.photoPreview} resizeMode="cover" />
                ) : existingImageUri ? (
                  <ItemThumb
                    item={{ imageUri: existingImageUri, emoji: CATEGORY_ICON_KEYS[category], name }}
                    size={96}
                    style={styles.photoPreview}
                  />
                ) : (
                  <View style={styles.cameraCircle}>
                    <CategoryIcon size={24} color={styles.iconTint.color} />
                  </View>
                )}
                <Text style={styles.photoUploadTitle}>
                  {pickedPhoto ? t('style_pantry.photo_selected') : t('style_pantry.take_photo')}
                </Text>
              </Pressable>

              <View style={styles.card}>
                <Text style={styles.inputLabel}>{t('style_pantry.item_name_label')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('style_pantry.name_placeholder')}
                  placeholderTextColor={styles.placeholder.color}
                />

                <Text style={styles.inputLabel}>{t('style_pantry.category_label')}</Text>
                <View style={styles.chipWrap}>
                  {CLOTHING_CATEGORIES.map(c => {
                    const active = category === c;
                    const CatIcon = getClothingIconComponent(CATEGORY_ICON_KEYS[c]);
                    return (
                      <Pressable
                        key={c}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setCategory(c)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                      >
                        <CatIcon size={14} color={active ? styles.chipTextActive.color : styles.chipText.color} style={styles.chipIcon} />
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{categoryLabel(c)}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.inputLabel}>{t('style_pantry.color_label')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={color}
                  onChangeText={setColor}
                  placeholder={t('style_pantry.color_placeholder')}
                  placeholderTextColor={styles.placeholder.color}
                />

                <Text style={styles.inputLabel}>{t('style_pantry.brand_label')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={brand}
                  onChangeText={setBrand}
                  placeholder={t('style_pantry.brand_placeholder')}
                  placeholderTextColor={styles.placeholder.color}
                />

                <Text style={styles.inputLabel}>{t('style_pantry.purchase_price_label')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={purchasePriceStr}
                  onChangeText={setPurchasePriceStr}
                  placeholder={t('style_pantry.purchase_price_placeholder')}
                  placeholderTextColor={styles.placeholder.color}
                  keyboardType="decimal-pad"
                />
              </View>

              <Text style={styles.sectionTitle}>{t('style_pantry.season_material_tags')}</Text>
              <View style={styles.card}>
                <Text style={styles.inputLabel}>{t('style_pantry.season_label')}</Text>
                <View style={styles.chipWrap}>
                  {CLOTHING_SEASONS.map(s => {
                    const active = season === s;
                    return (
                      <Pressable
                        key={s}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setSeason(s)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{seasonLabel(s)}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.inputLabel}>{t('style_pantry.material_label')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={material}
                  onChangeText={setMaterial}
                  placeholder={t('style_pantry.material_placeholder')}
                  placeholderTextColor={styles.placeholder.color}
                />

                <Text style={styles.inputLabel}>{t('style_pantry.tags_label')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={tagsStr}
                  onChangeText={setTagsStr}
                  placeholder={t('style_pantry.tags_placeholder')}
                  placeholderTextColor={styles.placeholder.color}
                  autoCapitalize="none"
                />
                <Text style={styles.hint}>{t('style_pantry.tags_hint')}</Text>

                <View style={styles.wishlistRow}>
                  <View style={styles.wishlistTextWrap}>
                    <Text style={styles.wishlistLabel}>{t('style_pantry.wishlist_toggle_label')}</Text>
                    <Text style={styles.wishlistSub}>{t('style_pantry.wishlist_toggle_sub')}</Text>
                  </View>
                  <Switch value={isWishlist} onValueChange={setIsWishlist} />
                </View>
              </View>

              <Button title={t('style_pantry.save_item')} onPress={handleSave} loading={busy} style={styles.saveBtn} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomSheet visible={showPhotoSheet} onClose={() => setShowPhotoSheet(false)} title={t('style_pantry.choose_photo_title')}>
        <Pressable style={styles.photoOption} onPress={handleTakePhoto}>
          <Camera size={18} color={styles.iconTint.color} style={styles.photoOptionIcon} />
          <Text style={styles.photoOptionText}>{t('style_pantry.take_photo_option')}</Text>
        </Pressable>
        <Pressable style={styles.photoOption} onPress={handlePickFromGallery}>
          <ImageIcon size={18} color={styles.iconTint.color} style={styles.photoOptionIcon} />
          <Text style={styles.photoOptionText}>{t('style_pantry.choose_gallery_option')}</Text>
        </Pressable>
      </BottomSheet>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    iconTint: { color: colors.primary },
    keyboardContainer: { flex: 1 },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    skeletonGap: { marginBottom: spacing.md },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.textPrimary },
    photoUploadCard: {
      backgroundColor: colors.blush,
      borderRadius: radius.lg,
      padding: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderStyle: 'dashed',
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    photoPreview: { width: 96, height: 96, borderRadius: radius.md, marginBottom: spacing.xs },
    cameraCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    photoUploadTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.primary },
    card: {
      backgroundColor: colors.glassSurface,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      marginBottom: spacing.md,
      ...shadow.soft,
    },
    inputLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.xs },
    textInput: {
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.textPrimary,
      backgroundColor: colors.background,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.sm,
    },
    hint: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginTop: -4, marginBottom: spacing.sm },
    placeholder: { color: colors.textSecondary },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.full,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 4,
      marginBottom: 4,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipIcon: { marginRight: 4 },
    chipText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textSecondary },
    chipTextActive: { color: colors.textOnPrimary },
    sectionTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.textPrimary, marginBottom: spacing.xs },
    saveBtn: { marginTop: spacing.md },
    wishlistRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    wishlistTextWrap: { flex: 1 },
    wishlistLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textPrimary },
    wishlistSub: { fontFamily: fonts.sans, fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    photoOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    photoOptionIcon: { marginRight: 10 },
    photoOptionText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
  });
