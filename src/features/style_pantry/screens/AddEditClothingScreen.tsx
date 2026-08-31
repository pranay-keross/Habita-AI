import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Camera from 'lucide-react-native/icons/camera';
import Button from '../../../components/Button';
import { addClothingItem, updateClothingItem, loadClothingItems } from '../stylePantryStore';
import { CATEGORY_ICON_KEYS, getClothingIconComponent } from '../clothingIcons';
import type { ClothingCategory, ClothingSeason } from '../types';
import { subscribeToLanguageChanges, t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'AddEditClothing'>;

const CATEGORY_OPTIONS: { key: ClothingCategory; labelKey: string; iconKey: string }[] = [
  { key: 'tops', labelKey: 'style_pantry.cat_tops', iconKey: CATEGORY_ICON_KEYS.tops },
  { key: 'bottoms', labelKey: 'style_pantry.cat_bottoms', iconKey: CATEGORY_ICON_KEYS.bottoms },
  { key: 'shoes', labelKey: 'style_pantry.cat_shoes', iconKey: CATEGORY_ICON_KEYS.shoes },
  { key: 'jackets', labelKey: 'style_pantry.cat_jackets', iconKey: CATEGORY_ICON_KEYS.jackets },
  { key: 'accessories', labelKey: 'style_pantry.cat_accessories', iconKey: CATEGORY_ICON_KEYS.accessories },
];

const SEASON_OPTIONS: { key: ClothingSeason; label: string }[] = [
  { key: 'all-year', label: 'All Year' },
  { key: 'summer', label: 'Summer' },
  { key: 'winter', label: 'Winter' },
  { key: 'monsoon', label: 'Monsoon' },
  { key: 'spring', label: 'Spring / Autumn' },
];

export default function AddEditClothingScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
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
  const [photoSelected, setPhotoSelected] = useState(false);

  useEffect(() => {
    const unsubLang = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    if (itemId) {
      loadClothingItems().then((items) => {
        const found = items.find((i) => i.id === itemId);
        if (found) {
          setName(found.name);
          setCategory(found.category);
          setColor(found.color);
          setBrand(found.brand || '');
          setSeason(found.season);
          setMaterial(found.material || '');
          setTagsStr(found.tags.join(', '));
          setPhotoSelected(true);
        }
      });
    }
    return () => {
      unsubLang();
    };
  }, [itemId]);

  const handlePickPhoto = () => {
    setPhotoSelected(true);
    Alert.alert('Photo Captured', 'Clothing photo attached to item.');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('style_pantry.missing_name'), t('style_pantry.enter_name_msg'));
      return;
    }

    setSaving(true);
    const tags = tagsStr
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    const chosenCat = CATEGORY_OPTIONS.find((c) => c.key === category) || CATEGORY_OPTIONS[0];

    if (itemId) {
      const existing = (await loadClothingItems()).find((i) => i.id === itemId);
      if (existing) {
        await updateClothingItem({
          ...existing,
          name: name.trim(),
          category,
          color: color.trim() || 'Custom',
          brand: brand.trim(),
          season,
          material: material.trim(),
          tags,
          emoji: chosenCat.iconKey,
        });
      }
    } else {
      await addClothingItem({
        name: name.trim(),
        category,
        color: color.trim() || 'Custom',
        brand: brand.trim(),
        season,
        material: material.trim(),
        tags,
        emoji: chosenCat.iconKey,
      });
    }

    setSaving(false);
    Alert.alert(t('style_pantry.dash_title'), t('style_pantry.saved_msg', { name }));
    navigation.goBack();
  };

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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Photo Upload Card */}
        <Pressable style={styles.photoUploadCard} onPress={handlePickPhoto}>
          <View style={styles.cameraCircle}>
            <Camera size={24} color="#004F63" />
          </View>
          <Text style={styles.photoUploadTitle}>
            {photoSelected ? t('style_pantry.photo_selected') : t('style_pantry.take_photo')}
          </Text>
        </Pressable>

        {/* Input Fields Card */}
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
          <View style={styles.categoryWrap}>
            {CATEGORY_OPTIONS.map((c) => {
              const CatIcon = getClothingIconComponent(c.iconKey);
              return (
                <Pressable
                  key={c.key}
                  style={[
                    styles.catOptionChip,
                    category === c.key && styles.catOptionChipActive,
                  ]}
                  onPress={() => setCategory(c.key)}>
                  <CatIcon
                    size={14}
                    color={category === c.key ? '#FFFFFF' : styles.catOptionText.color}
                    style={styles.catOptionIcon}
                  />
                  <Text
                    style={[
                      styles.catOptionText,
                      category === c.key && styles.catOptionTextActive,
                    ]}>
                    {t(c.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.inputLabel}>{t('style_pantry.color_label')}</Text>
          <TextInput
            style={styles.textInput}
            value={color}
            onChangeText={setColor}
            placeholder="e.g. Navy Blue, Charcoal Black"
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
        </View>

        {/* Specialized Details Card */}
        <Text style={styles.sectionTitle}>Season, Material & Tags</Text>
        <View style={styles.card}>
          <Text style={styles.inputLabel}>{t('style_pantry.season_label')}</Text>
          <View style={styles.seasonWrap}>
            {SEASON_OPTIONS.map((s) => (
              <Pressable
                key={s.key}
                style={[
                  styles.seasonChip,
                  season === s.key && styles.seasonChipActive,
                ]}
                onPress={() => setSeason(s.key)}>
                <Text
                  style={[
                    styles.seasonChipText,
                    season === s.key && styles.seasonChipTextActive,
                  ]}>
                  {s.label}
                </Text>
              </Pressable>
            ))}
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
    photoUploadCard: {
      backgroundColor: '#E0F2FE',
      borderRadius: radius.lg,
      padding: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#BAE6FD',
      borderStyle: 'dashed',
      marginBottom: spacing.md,
    },
    cameraCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    photoUploadTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: '#004F63',
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
      borderRadius: radius.md,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 4,
      marginBottom: 4,
    },
    catOptionChipActive: {
      backgroundColor: '#004F63',
      borderColor: '#004F63',
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
      color: '#FFFFFF',
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
      borderRadius: radius.md,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 4,
      marginBottom: 4,
    },
    seasonChipActive: {
      backgroundColor: '#004F63',
      borderColor: '#004F63',
    },
    seasonChipText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.textSecondary,
    },
    seasonChipTextActive: {
      color: '#FFFFFF',
    },
    saveBtn: {
      marginTop: spacing.md,
    },
  });
