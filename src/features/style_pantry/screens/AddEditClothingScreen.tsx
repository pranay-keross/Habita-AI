import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  Image,
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
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Camera from 'lucide-react-native/icons/camera';
import Button from '../../../components/Button';
import BottomSheet from '../../../components/BottomSheet';
import {
  addClothingItem,
  updateClothingItem,
  loadClothingItems,
} from '../stylePantryStore';
import { CATEGORY_ICON_KEYS, getClothingIconComponent } from '../clothingIcons';
import type { ClothingCategory, ClothingSeason, PickedFile } from '../types';
import { subscribeToLanguageChanges, t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'AddEditClothing'>;

const CATEGORY_OPTIONS: {
  key: ClothingCategory;
  labelKey: string;
  iconKey: string;
}[] = [
  {
    key: 'tops',
    labelKey: 'style_pantry.cat_tops',
    iconKey: CATEGORY_ICON_KEYS.tops,
  },
  {
    key: 'bottoms',
    labelKey: 'style_pantry.cat_bottoms',
    iconKey: CATEGORY_ICON_KEYS.bottoms,
  },
  {
    key: 'shoes',
    labelKey: 'style_pantry.cat_shoes',
    iconKey: CATEGORY_ICON_KEYS.shoes,
  },
  {
    key: 'jackets',
    labelKey: 'style_pantry.cat_jackets',
    iconKey: CATEGORY_ICON_KEYS.jackets,
  },
  {
    key: 'accessories',
    labelKey: 'style_pantry.cat_accessories',
    iconKey: CATEGORY_ICON_KEYS.accessories,
  },
];

const SEASON_OPTIONS: { key: ClothingSeason; label: string }[] = [
  { key: 'all-year', label: 'All Year' },
  { key: 'summer', label: 'Summer' },
  { key: 'winter', label: 'Winter' },
  { key: 'monsoon', label: 'Monsoon' },
  { key: 'spring', label: 'Spring / Autumn' },
];

// On iOS the picker can return asset-library URIs (ph://) that a later multipart
// upload can't read from directly — copy a local cache copy first, same safeguard
// `PrescriptionsScreen.tsx` uses for its camera/gallery uploads.
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

export default function AddEditClothingScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuth();
  const itemId = route.params?.itemId;
  const [, setLocaleVersion] = useState(0);

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ClothingCategory>('tops');
  const [color, setColor] = useState('Navy Blue');
  const [brand, setBrand] = useState('');
  const [season, setSeason] = useState<ClothingSeason>('all-year');
  const [material, setMaterial] = useState('');
  const [tagsStr, setTagsStr] = useState('office, formal');
  const [existingImageUri, setExistingImageUri] = useState<string | undefined>(
    undefined,
  );
  const [pickedPhoto, setPickedPhoto] = useState<PickedFile | null>(null);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [existingWearCount, setExistingWearCount] = useState(0);
  const [existingLastWorn, setExistingLastWorn] = useState<string | undefined>(
    undefined,
  );

  useEffect(() => {
    const unsubLang = subscribeToLanguageChanges(() =>
      setLocaleVersion(v => v + 1),
    );
    if (itemId) {
      loadClothingItems().then(items => {
        const found = items.find(i => i.id === itemId);
        if (found) {
          setName(found.name);
          setCategory(found.category);
          setColor(found.color);
          setBrand(found.brand || '');
          setSeason(found.season);
          setMaterial(found.material || '');
          setTagsStr(found.tags.join(', '));
          setExistingImageUri(found.imageUri);
          setExistingWearCount(found.wearCount);
          setExistingLastWorn(found.lastWornDate);
        }
      });
    }
    return () => {
      unsubLang();
    };
  }, [itemId]);

  const handleTakePhoto = async () => {
    setShowPhotoSheet(false);
    const res = await launchCamera({
      mediaType: 'photo',
      cameraType: 'back',
      quality: 0.8,
      saveToPhotos: false,
    });
    if (res.didCancel) return;
    const asset = res.assets && res.assets[0];
    if (!asset || !asset.uri) return;
    const uri = await resolveLocalUri(asset.uri, asset.fileName || 'item.jpg');
    setPickedPhoto({
      uri,
      name: asset.fileName || 'item.jpg',
      type: asset.type || 'image/jpeg',
    });
  };

  const handlePickFromGallery = async () => {
    setShowPhotoSheet(false);
    const res = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.8,
    });
    if (res.didCancel) return;
    const asset = res.assets && res.assets[0];
    if (!asset || !asset.uri) return;
    const uri = await resolveLocalUri(asset.uri, asset.fileName || 'item.jpg');
    setPickedPhoto({
      uri,
      name: asset.fileName || 'item.jpg',
      type: asset.type || 'image/jpeg',
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(
        t('style_pantry.missing_name'),
        t('style_pantry.enter_name_msg'),
      );
      return;
    }

    setSaving(true);
    const token = await getAccessToken();
    const tags = tagsStr
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0);

    const chosenCat =
      CATEGORY_OPTIONS.find(c => c.key === category) || CATEGORY_OPTIONS[0];

    if (itemId) {
      await updateClothingItem(
        {
          id: itemId,
          name: name.trim(),
          category,
          color: color.trim() || 'Custom',
          brand: brand.trim(),
          season,
          material: material.trim(),
          tags,
          emoji: chosenCat.iconKey,
          imageUri: pickedPhoto?.uri ?? existingImageUri,
          wearCount: existingWearCount,
          lastWornDate: existingLastWorn,
        },
        pickedPhoto,
        token,
      );
    } else {
      await addClothingItem(
        {
          name: name.trim(),
          category,
          color: color.trim() || 'Custom',
          brand: brand.trim(),
          season,
          material: material.trim(),
          tags,
          emoji: chosenCat.iconKey,
          imageUri: pickedPhoto?.uri,
        },
        pickedPhoto,
        token,
      );
    }

    setSaving(false);
    Alert.alert(
      t('style_pantry.dash_title'),
      t('style_pantry.saved_msg', { name }),
    );
    navigation.goBack();
  };

  const photoUri = pickedPhoto?.uri ?? existingImageUri;

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {itemId ? t('style_pantry.edit_title') : t('style_pantry.add_title')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 54 : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 160 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Photo Upload Card */}
          <Pressable
            style={styles.photoUploadCard}
            onPress={() => setShowPhotoSheet(true)}
          >
            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={styles.photoPreview}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.cameraCircle}>
                <Camera size={24} color={styles.iconTint.color} />
              </View>
            )}
            <Text style={styles.photoUploadTitle}>
              {photoUri
                ? t('style_pantry.photo_selected')
                : t('style_pantry.take_photo')}
            </Text>
          </Pressable>

          {/* Input Fields Card */}
          <View style={styles.card}>
            <Text style={styles.inputLabel}>
              {t('style_pantry.item_name_label')}
            </Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder={t('style_pantry.name_placeholder')}
              placeholderTextColor={styles.placeholder.color}
            />

            <Text style={styles.inputLabel}>
              {t('style_pantry.category_label')}
            </Text>
            <View style={styles.categoryWrap}>
              {CATEGORY_OPTIONS.map(c => {
                const CatIcon = getClothingIconComponent(c.iconKey);
                return (
                  <Pressable
                    key={c.key}
                    style={[
                      styles.catOptionChip,
                      category === c.key && styles.catOptionChipActive,
                    ]}
                    onPress={() => setCategory(c.key)}
                  >
                    <CatIcon
                      size={14}
                      color={
                        category === c.key
                          ? styles.headerIconOnPrimary.color
                          : styles.catOptionText.color
                      }
                      style={styles.catOptionIcon}
                    />
                    <Text
                      style={[
                        styles.catOptionText,
                        category === c.key && styles.catOptionTextActive,
                      ]}
                    >
                      {t(c.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>
              {t('style_pantry.color_label')}
            </Text>
            <TextInput
              style={styles.textInput}
              value={color}
              onChangeText={setColor}
              placeholder="e.g. Navy Blue, Charcoal Black"
              placeholderTextColor={styles.placeholder.color}
            />

            <Text style={styles.inputLabel}>
              {t('style_pantry.brand_label')}
            </Text>
            <TextInput
              style={styles.textInput}
              value={brand}
              onChangeText={setBrand}
              placeholder={t('style_pantry.brand_placeholder')}
              placeholderTextColor={styles.placeholder.color}
            />
          </View>

          {/* Specialized Details Card */}
          <Text style={styles.sectionTitle}>
            {t('style_pantry.season_material_tags')}
          </Text>
          <View style={styles.card}>
            <Text style={styles.inputLabel}>
              {t('style_pantry.season_label')}
            </Text>
            <View style={styles.seasonWrap}>
              {SEASON_OPTIONS.map(s => (
                <Pressable
                  key={s.key}
                  style={[
                    styles.seasonChip,
                    season === s.key && styles.seasonChipActive,
                  ]}
                  onPress={() => setSeason(s.key)}
                >
                  <Text
                    style={[
                      styles.seasonChipText,
                      season === s.key && styles.seasonChipTextActive,
                    ]}
                  >
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.inputLabel}>
              {t('style_pantry.material_label')}
            </Text>
            <TextInput
              style={styles.textInput}
              value={material}
              onChangeText={setMaterial}
              placeholder={t('style_pantry.material_placeholder')}
              placeholderTextColor={styles.placeholder.color}
            />

            <Text style={styles.inputLabel}>
              {t('style_pantry.tags_label')}
            </Text>
            <TextInput
              style={styles.textInput}
              value={tagsStr}
              onChangeText={setTagsStr}
              placeholder={t('style_pantry.tags_placeholder')}
              placeholderTextColor={styles.placeholder.color}
            />
          </View>

          {/* Save Button */}
          <Button
            title={t('style_pantry.save_item')}
            onPress={handleSave}
            loading={saving}
            style={styles.saveBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomSheet
        visible={showPhotoSheet}
        onClose={() => setShowPhotoSheet(false)}
        title={t('style_pantry.choose_photo_title')}
      >
        <Pressable style={styles.photoOption} onPress={handleTakePhoto}>
          <Camera
            size={18}
            color={styles.iconTint.color}
            style={{ marginRight: 10 }}
          />
          <Text style={styles.photoOptionText}>
            {t('style_pantry.take_photo_option')}
          </Text>
        </Pressable>
        <Pressable style={styles.photoOption} onPress={handlePickFromGallery}>
          <Camera
            size={18}
            color={styles.iconTint.color}
            style={{ marginRight: 10 }}
          />
          <Text style={styles.photoOptionText}>
            {t('style_pantry.choose_gallery_option')}
          </Text>
        </Pressable>
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
    headerIcon: {
      color: colors.textPrimary,
    },
    headerIconOnPrimary: {
      color: colors.textOnPrimary,
    },
    iconTint: {
      color: colors.primary,
    },
    headerTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 18,
      color: colors.textPrimary,
    },
    keyboardContainer: {
      flex: 1,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
    },
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
    photoPreview: {
      width: 96,
      height: 96,
      borderRadius: radius.md,
      marginBottom: spacing.xs,
    },
    cameraCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    photoUploadTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.primary,
    },
    card: {
      backgroundColor: colors.glassSurface,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      marginBottom: spacing.md,
      ...shadow.soft,
    },
    inputLabel: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
      marginTop: spacing.xs,
    },
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
    placeholder: {
      color: colors.textSecondary,
    },
    categoryWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    catOptionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 4,
      marginBottom: 4,
    },
    catOptionChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    catOptionIcon: {
      marginRight: 4,
    },
    catOptionText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.textSecondary,
    },
    catOptionTextActive: {
      color: colors.textOnPrimary,
    },
    sectionTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    seasonWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    seasonChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 4,
      marginBottom: 4,
    },
    seasonChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    seasonChipText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.textSecondary,
    },
    seasonChipTextActive: {
      color: colors.textOnPrimary,
    },
    saveBtn: {
      marginTop: spacing.md,
    },
    photoOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    photoOptionText: {
      fontFamily: fonts.sansMedium,
      fontSize: 14,
      color: colors.textPrimary,
    },
  });
