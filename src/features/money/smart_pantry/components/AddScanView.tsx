import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { AddMode, AllergenTag, CategoryType, PantryItem, StorageLocation } from '../types';
import { ALLERGEN_DEFINITIONS, BARCODE_CATALOG } from '../data/mockPantryData';
import { PANTRY_COLORS } from '../constants/colors';
import { t } from '../../../../i18n';
import type { ThemeTokens } from '../../../../theme';
import useThemedStyles from '../../../../hooks/useThemedStyles';
import useTheme from '../../../../hooks/useTheme';

interface Props {
  onAddItem: (item: PantryItem) => Promise<void>;
  onNavigateDetails: () => void;
}

const CATEGORIES: { key: CategoryType; label: string; emoji: string }[] = [
  { key: 'produce', label: 'Produce', emoji: '🥦' },
  { key: 'dairy', label: 'Dairy', emoji: '🥛' },
  { key: 'bakery', label: 'Bakery', emoji: '🍞' },
  { key: 'beverages', label: 'Beverages', emoji: '🧃' },
  { key: 'meat', label: 'Meat & Seafood', emoji: '🥩' },
  { key: 'pantry', label: 'Dry Pantry', emoji: '🥫' },
];

const LOCATIONS: StorageLocation[] = ['Fridge', 'Freezer', 'Pantry Shelf'];

export const AddScanView: React.FC<Props> = ({ onAddItem, onNavigateDetails }) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [addMode, setAddMode] = useState<AddMode>('barcode');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<CategoryType>('produce');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('pcs');
  const [expiryDate, setExpiryDate] = useState('2026-08-30');
  const [storageLocation, setStorageLocation] = useState<StorageLocation>('Fridge');
  const [selectedAllergens, setSelectedAllergens] = useState<AllergenTag[]>(['gluten-free', 'nut-free']);
  const [saving, setSaving] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const handleSaveItem = async () => {
    if (!name.trim()) {
      Alert.alert('Missing Info', 'Please enter item name.');
      return;
    }
    setSaving(true);
    const newItem: PantryItem = {
      id: `p_${Date.now()}`,
      name: name.trim(),
      category,
      quantity: Math.max(1, parseInt(quantity, 10) || 1),
      unit: unit.trim() || 'pcs',
      expiryDate,
      storageLocation,
      allergens: selectedAllergens,
      barcode: scannedBarcode || undefined,
      isLowStock: parseInt(quantity, 10) <= 1,
    };
    await onAddItem(newItem);
    setSaving(false);
    setName('');
    setScannedBarcode('');
    Alert.alert('Item Saved! 🥗', `${newItem.name} added to ${newItem.storageLocation}.`);
    onNavigateDetails();
  };

  const handleSimulateBarcodeScan = (code: string) => {
    setScannedBarcode(code);
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      const catalogItem = BARCODE_CATALOG[code];
      if (catalogItem) {
        setName(catalogItem.name || '');
        if (catalogItem.category) setCategory(catalogItem.category);
        if (catalogItem.unit) setUnit(catalogItem.unit);
        if (catalogItem.storageLocation) setStorageLocation(catalogItem.storageLocation);
        if (catalogItem.allergens) setSelectedAllergens(catalogItem.allergens);
        Alert.alert('Barcode Scanned 🎯', `Found: ${catalogItem.name}`);
      } else {
        setName('Scanned Item #' + code.slice(-4));
        Alert.alert('Barcode Detected', `Code ${code} scanned. Confirm item details.`);
      }
      setAddMode('manual');
    }, 800);
  };

  const handleSimulateReceiptScan = () => {
    setIsScanning(true);
    setTimeout(async () => {
      setIsScanning(false);
      const extracted: PantryItem = {
        id: `p_rcpt_${Date.now()}_1`,
        name: 'Fresh Strawberries 250g',
        category: 'produce',
        quantity: 2,
        unit: 'pack',
        expiryDate: '2026-08-23',
        storageLocation: 'Fridge',
        allergens: ['gluten-free', 'vegan', 'nut-free', 'dairy-free', 'halal', 'kosher'],
      };
      await onAddItem(extracted);
      Alert.alert('Receipt Processed ✨', 'Extracted 1 item from receipt into Pantry!');
      onNavigateDetails();
    }, 1200);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeading}>{t('smart_pantry.add_title')}</Text>

      {/* Entry Modes */}
      <View style={styles.modeToggleRow}>
        <Pressable
          style={[styles.modeBtn, addMode === 'barcode' && styles.modeBtnActive]}
          onPress={() => setAddMode('barcode')}>
          <Text style={[styles.modeBtnText, addMode === 'barcode' && styles.modeBtnTextActive]}>
            {t('smart_pantry.mode_barcode')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, addMode === 'receipt' && styles.modeBtnActive]}
          onPress={() => setAddMode('receipt')}>
          <Text style={[styles.modeBtnText, addMode === 'receipt' && styles.modeBtnTextActive]}>
            {t('smart_pantry.mode_receipt')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, addMode === 'manual' && styles.modeBtnActive]}
          onPress={() => setAddMode('manual')}>
          <Text style={[styles.modeBtnText, addMode === 'manual' && styles.modeBtnTextActive]}>
            {t('smart_pantry.mode_manual')}
          </Text>
        </Pressable>
      </View>

      {addMode === 'barcode' && (
        <View style={styles.scannerBox}>
          <Text style={styles.scannerTitle}>{t('smart_pantry.barcode_title')}</Text>
          <Text style={styles.scannerSub}>{t('smart_pantry.barcode_sub')}</Text>

          <View style={styles.cameraViewfinder}>
            <View style={styles.viewfinderTarget}>
              {isScanning ? (
                <ActivityIndicator size="large" color={PANTRY_COLORS.safeGreen} />
              ) : (
                <Text style={{ fontSize: 40 }}>|||||||||||||||</Text>
              )}
            </View>
          </View>

          <Text style={styles.quickScanLabel}>{t('smart_pantry.test_barcodes')}</Text>
          <View style={styles.barcodeCatalogRow}>
            {Object.entries(BARCODE_CATALOG).map(([code, details]) => (
              <Pressable
                key={code}
                style={styles.barcodeTile}
                onPress={() => handleSimulateBarcodeScan(code)}>
                <Text style={styles.barcodeTileTitle}>⚡ {details.name}</Text>
                <Text style={styles.barcodeTileCode}>Code: {code}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {addMode === 'receipt' && (
        <View style={styles.scannerBox}>
          <Text style={styles.scannerTitle}>{t('smart_pantry.receipt_title')}</Text>
          <Pressable style={styles.receiptUploadCard} onPress={handleSimulateReceiptScan}>
            {isScanning ? (
              <ActivityIndicator size="large" color={theme.colors.primary} />
            ) : (
              <>
                <Text style={{ fontSize: 48, marginBottom: 8 }}>🧾</Text>
                <Text style={styles.receiptUploadTitle}>{t('smart_pantry.receipt_upload_title')}</Text>
                <Text style={styles.receiptUploadSub}>{t('smart_pantry.receipt_upload_sub')}</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {addMode === 'manual' && (
        <View style={styles.formContainer}>
          <Text style={styles.formLabel}>{t('smart_pantry.item_name')}</Text>
          <TextInput
            style={styles.formInput}
            placeholder="e.g. Organic Almond Milk"
            placeholderTextColor={theme.colors.textMuted}
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.formLabel}>{t('smart_pantry.category')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 12 }}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.key}
                style={[styles.catChip, category === cat.key && styles.catChipActive]}
                onPress={() => setCategory(cat.key)}>
                <Text style={[styles.catChipText, category === cat.key && styles.catChipTextActive]}>
                  {cat.emoji} {cat.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.formLabel}>{t('smart_pantry.quantity')}</Text>
              <TextInput style={styles.formInput} value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.formLabel}>{t('smart_pantry.unit')}</Text>
              <TextInput style={styles.formInput} value={unit} onChangeText={setUnit} />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.formLabel}>{t('smart_pantry.storage_loc')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                {LOCATIONS.map((loc) => (
                  <Pressable
                    key={loc}
                    style={[styles.locChip, storageLocation === loc && styles.locChipActive]}
                    onPress={() => setStorageLocation(loc)}>
                    <Text style={[styles.locChipText, storageLocation === loc && styles.locChipTextActive]}>
                      {loc}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.formLabel}>{t('smart_pantry.expiry_date')}</Text>
              <TextInput style={styles.formInput} value={expiryDate} onChangeText={setExpiryDate} />
            </View>
          </View>

          <Pressable style={styles.submitBtn} onPress={handleSaveItem} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>{t('smart_pantry.save_to_pantry')}</Text>}
          </Pressable>
        </View>
      )}
    </View>
  );
};

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) =>
  StyleSheet.create({
    container: { marginTop: spacing.sm },
    sectionHeading: { fontFamily: fonts.serif, fontSize: 17, color: colors.textPrimary, marginBottom: 8 },
    modeToggleRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
    modeBtn: { flex: 1, backgroundColor: colors.surface, paddingVertical: 8, borderRadius: radius.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    modeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    modeBtnText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textSecondary },
    modeBtnTextActive: { fontFamily: fonts.sansBold, color: colors.textOnPrimary },
    scannerBox: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, alignItems: 'center' },
    scannerTitle: { fontFamily: fonts.serif, fontSize: 18, color: colors.textPrimary },
    scannerSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: 2, marginBottom: 12 },
    cameraViewfinder: {
      width: '100%',
      height: 120,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    viewfinderTarget: {
      width: 160,
      height: 70,
      borderWidth: 2,
      borderColor: colors.primary,
      borderRadius: 8,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickScanLabel: { alignSelf: 'flex-start', fontFamily: fonts.sansBold, fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
    barcodeCatalogRow: { width: '100%', gap: 6 },
    barcodeTile: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 8 },
    barcodeTileTitle: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.textPrimary },
    barcodeTileCode: { fontFamily: fonts.sans, fontSize: 10, color: colors.textMuted, marginTop: 2 },
    receiptUploadCard: { width: '100%', paddingVertical: 30, backgroundColor: colors.surfaceElevated, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center' },
    receiptUploadTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary },
    receiptUploadSub: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginTop: 2 },
    formContainer: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
    formLabel: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textSecondary, marginBottom: 4, marginTop: 8 },
    formInput: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13, color: colors.textPrimary, marginBottom: 4 },
    catChip: { backgroundColor: colors.background, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
    catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    catChipText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textSecondary },
    catChipTextActive: { fontFamily: fonts.sansBold, color: colors.textOnPrimary },
    locChip: { backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
    locChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    locChipText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textSecondary },
    locChipTextActive: { fontFamily: fonts.sansBold, color: colors.textOnPrimary },
    submitBtn: { backgroundColor: colors.primary, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center', marginTop: 10 },
    submitBtnText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textOnPrimary },
  });
