import React, { useEffect, useState } from 'react';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  pick,
  isErrorWithCode,
  errorCodes,
  types as documentTypes,
} from '@react-native-documents/picker';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import CarFront from 'lucide-react-native/icons/car-front';
import FileText from 'lucide-react-native/icons/file-text';
import ShieldAlert from 'lucide-react-native/icons/shield-alert';
import Tag from 'lucide-react-native/icons/tag';
import ChevronUp from 'lucide-react-native/icons/chevron-up';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import type { RootStackParamList } from '../../app/_layout';
import BottomSheet from '../../components/BottomSheet';
import Button from '../../components/Button';
import Card from '../../components/Card';
import SectionHeader from '../../components/SectionHeader';
import useThemedStyles from '../../hooks/useThemedStyles';
import { subscribeToLanguageChanges, t } from '../../i18n';
import type { ThemeTokens } from '../../theme';
import {
  loadHouseholdAssets,
  loadVehicles,
  saveHouseholdAssets,
  saveVehicles,
} from './assetStore';
import type { HouseholdAsset, Vehicle } from './types';

type Props = StackScreenProps<RootStackParamList, 'Vehicles'>;
const DEFAULT_ASSET_CATEGORIES = [
  'Appliance',
  'Furniture',
  'Electronics',
  'Jewellery',
  'Tools',
  'Vehicle accessory',
  'Other',
];
const ASSET_CATEGORY_KEYS: Record<string, string> = {
  Appliance: 'assets.category_appliance',
  Furniture: 'assets.category_furniture',
  Electronics: 'assets.category_electronics',
  Jewellery: 'assets.category_jewellery',
  Tools: 'assets.category_tools',
  'Vehicle accessory': 'assets.category_vehicle_accessory',
  Other: 'assets.category_other',
};
const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(date.getDate()).padStart(2, '0')}`;
const displayDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
};

export default function VehiclesScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [assets, setAssets] = useState<HouseholdAsset[]>([]);
  const [assetSheetVisible, setAssetSheetVisible] = useState(false);
  const [assetName, setAssetName] = useState('');
  const [assetCategory, setAssetCategory] = useState(DEFAULT_ASSET_CATEGORIES[0]);
  const [assetSerial, setAssetSerial] = useState('');
  const [showAssetCategoryList, setShowAssetCategoryList] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [makeModel, setMakeModel] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [documentReviewed, setDocumentReviewed] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [localeVersion, setLocaleVersion] = useState(0);
  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      try {
        const [savedVehicles, savedAssets] = await Promise.all([
          loadVehicles(),
          loadHouseholdAssets(),
        ]);

        if (!isMounted) return;

        setVehicles(Array.isArray(savedVehicles) ? savedVehicles : []);
        setAssets(Array.isArray(savedAssets) ? savedAssets : []);
      } catch {
        if (!isMounted) return;
        setVehicles([]);
        setAssets([]);
      }
    };

    hydrate();
    const unsubscribe = subscribeToLanguageChanges(() =>
      setLocaleVersion(version => version + 1),
    );
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);
  const persist = async (next: Vehicle[]) => {
    const safeNext = Array.isArray(next) ? next : [];
    setVehicles(safeNext);
    await saveVehicles(safeNext);
  };
  const saveAsset = async () => {
    if (!assetName.trim() || !assetCategory.trim()) {
      Alert.alert(t('assets.incomplete_title'), t('assets.asset_incomplete'));
      return;
    }
    const next = [
      {
        id: String(Date.now()),
        name: assetName.trim(),
        category: assetCategory.trim(),
        serialNumber: assetSerial.trim(),
        warrantyExpiry: '',
        createdAt: Date.now(),
      },
      ...assets,
    ];
    const safeNext = Array.isArray(next) ? next : [];
    setAssets(safeNext);
    await saveHouseholdAssets(safeNext);
    setAssetSheetVisible(false);
  };
  const resetAssetForm = () => {
    setAssetName('');
    setAssetCategory(DEFAULT_ASSET_CATEGORIES[0]);
    setAssetSerial('');
    setShowAssetCategoryList(false);
  };
  const openForm = (vehicle?: Vehicle) => {
    setEditingId(vehicle?.id ?? null);
    setMakeModel(vehicle?.makeModel ?? '');
    setRegistrationNumber(vehicle?.registrationNumber ?? '');
    setInsuranceExpiry(vehicle?.insuranceExpiry ?? '');
    setDocumentName(vehicle?.documentName ?? null);
    setDocumentReviewed(vehicle?.documentReviewed ?? false);
    setShowDatePicker(false);
    setSheetVisible(true);
  };
  const attachDocument = async () => {
    try {
      const [file] = await pick({
        type: [documentTypes.pdf, documentTypes.images],
      });
      if (file) {
        setDocumentName(file.name ?? 'Vehicle document');
        setDocumentReviewed(false);
      }
    } catch (error) {
      if (
        !isErrorWithCode(error) ||
        error.code !== errorCodes.OPERATION_CANCELED
      )
        Alert.alert(
          t('assets.document_not_attached'),
          t('assets.document_not_attached_message'),
        );
    }
  };
  const save = async () => {
    if (!makeModel.trim() || !registrationNumber.trim() || !insuranceExpiry) {
      Alert.alert(
        t('assets.incomplete_title'),
        t('assets.vehicle_incomplete'),
      );
      return;
    }
    const entry = {
      makeModel: makeModel.trim(),
      registrationNumber: registrationNumber.trim().toUpperCase(),
      insuranceExpiry,
      documentName,
      documentReviewed,
    };
    const next = editingId
      ? vehicles.map(vehicle =>
          vehicle.id === editingId ? { ...vehicle, ...entry } : vehicle,
        )
      : [
          { id: String(Date.now()), createdAt: Date.now(), ...entry },
          ...vehicles,
        ];
    await persist(next);
    setSheetVisible(false);
  };
  const remove = () => {
    if (!editingId) return;
    Alert.alert(
      t('assets.delete_title'),
      t('assets.delete_message'),
      [
        { text: t('assets.cancel'), style: 'cancel' },
        {
          text: t('assets.delete'),
          style: 'destructive',
          onPress: async () => {
            await persist(vehicles.filter(vehicle => vehicle.id !== editingId));
            setSheetVisible(false);
          },
        },
      ],
    );
  };
  const reviewDocument = async (vehicle: Vehicle) => {
    if (!vehicle.documentName) {
      Alert.alert(
        t('assets.attach_first_title'),
        t('assets.attach_first_message'),
      );
      return;
    }
    await persist(
      vehicles.map(item =>
        item.id === vehicle.id
          ? { ...item, documentReviewed: !item.documentReviewed }
          : item,
      ),
    );
  };
  const handleDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowDatePicker(false);
    if (event.type === 'set' && selected)
      setInsuranceExpiry(toDateKey(selected));
  };
  const pendingReview = vehicles.filter(
    vehicle => vehicle.documentName && !vehicle.documentReviewed,
  ).length;
  const missingDocs = vehicles.filter(vehicle => !vehicle.documentName).length;
  const vehiclesWithDocs = vehicles.filter(vehicle => !!vehicle.documentName).length;
  const mostCommonAssetCategory = (() => {
    if (assets.length === 0) return t('assets.no_items');
    const counts = assets.reduce<Record<string, number>>((memo, asset) => {
      const key = asset.category || t('assets.category_other');
      memo[key] = (memo[key] ?? 0) + 1;
      return memo;
    }, {});
    const [category, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const categoryLabel = ASSET_CATEGORY_KEYS[category]
      ? t(ASSET_CATEGORY_KEYS[category])
      : category;
    return count > 1 ? `${categoryLabel} (${count})` : categoryLabel;
  })();
  const expiringSoon = vehicles.filter(vehicle => {
    if (!vehicle.insuranceExpiry) return false;
    const expiry = new Date(`${vehicle.insuranceExpiry}T00:00:00`);
    if (Number.isNaN(expiry.getTime())) return false;
    const diffMs = expiry.getTime() - Date.now();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 30;
  }).length;
  return (
    <View key={localeVersion} style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={20} color={styles.backIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('assets.header_title')}</Text>
        <Pressable style={styles.addButton} onPress={() => openForm()}>
          <Text style={styles.addText}>+</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 28 },
        ]}
      >
        <Card style={styles.hero}>
          <View style={styles.heroIcon}>
            <CarFront size={24} color={styles.heroIconColor.color} />
          </View>
          <Text style={styles.heroTitle}>
            {t('assets.hero_title')}
          </Text>
          <Text style={styles.heroText}>
            {t('assets.hero_description')}
          </Text>
        </Card>
        <SectionHeader
          title={t('assets.overview_title')}
          subtitle={t('assets.overview_subtitle')}
        />
        <View style={styles.metrics}>
          <Card style={styles.metric}>
            <Text style={styles.metricValue}>{vehicles.length}</Text>
            <Text style={styles.metricLabel}>{t('assets.metric_vehicles')}</Text>
          </Card>
          <Card style={styles.metric}>
            <Text style={styles.metricValue}>{vehiclesWithDocs}</Text>
            <Text style={styles.metricLabel}>{t('assets.metric_documented')}</Text>
          </Card>
          <Card style={styles.metric}>
            <Text style={styles.metricValue}>{pendingReview}</Text>
            <Text style={styles.metricLabel}>{t('assets.metric_review')}</Text>
          </Card>
        </View>
        <View style={styles.summaryStrip}>
          <View style={[styles.summaryPill, styles.priorityPill]}>
            <View style={styles.summaryPillHeader}>
              <View style={styles.summaryPillIcon}><FileText size={12} color={styles.summaryIconPrimary.color} /></View>
              <Text style={styles.summaryPillLabel}>{t('assets.coverage')}</Text>
            </View>
            <Text style={styles.summaryPillValue}>{vehiclesWithDocs}/{vehicles.length}</Text>
          </View>
          <View style={[styles.summaryPill, styles.warningPill]}>
            <View style={styles.summaryPillHeader}>
              <View style={styles.summaryPillIcon}><ShieldAlert size={12} color={styles.summaryIconWarning.color} /></View>
              <Text style={styles.summaryPillLabel}>{t('assets.attention')}</Text>
            </View>
            <Text style={styles.summaryPillValue}>{missingDocs + expiringSoon}</Text>
          </View>
          <View style={[styles.summaryPill, styles.successPill]}>
            <View style={styles.summaryPillHeader}>
              <View style={styles.summaryPillIcon}><Tag size={12} color={styles.summaryIconSuccess.color} /></View>
              <Text style={styles.summaryPillLabel}>{t('assets.top_category')}</Text>
            </View>
            <Text style={styles.summaryPillValue}>{mostCommonAssetCategory}</Text>
          </View>
        </View>
        <View style={styles.sectionDivider} />
        <SectionHeader
          title={t('assets.vehicles_title')}
          subtitle={t('assets.vehicles_subtitle')}
          style={styles.sectionHeader}
        />
        <Button title={t('assets.add_vehicle')} onPress={() => openForm()} style={styles.primaryAction} />
        {vehicles.length === 0 ? (
          <Card style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('assets.empty_title')}</Text>
            <Text style={styles.emptyText}>
              {t('assets.empty_text')}
            </Text>
          </Card>
        ) : (
          vehicles.map(vehicle => (
            <Pressable
              key={vehicle.id}
              style={styles.vehicleRow}
              onPress={() => openForm(vehicle)}
            >
              <View style={styles.vehicleCopy}>
                <Text style={styles.vehicleName}>{vehicle.makeModel}</Text>
                <Text style={styles.vehicleMeta}>
                  {vehicle.registrationNumber} · {t('assets.insurance_until')}{' '}
                  {displayDate(vehicle.insuranceExpiry)}
                </Text>
                <Text style={styles.documentName}>
                  {vehicle.documentName ?? t('assets.no_document')}
                </Text>
              </View>
              <Pressable
                onPress={() => reviewDocument(vehicle)}
                style={[
                  styles.reviewPill,
                  vehicle.documentReviewed && styles.reviewPillDone,
                ]}
              >
                <Text
                  style={[
                    styles.reviewText,
                    vehicle.documentReviewed && styles.reviewTextDone,
                  ]}
                >
                  {vehicle.documentReviewed ? t('assets.reviewed') : t('assets.review_document')}
                </Text>
              </Pressable>
            </Pressable>
          ))
        )}
        <View style={styles.sectionDivider} />
        <SectionHeader
          title={t('assets.household_assets')}
          subtitle={t('assets.household_assets_subtitle')}
          style={styles.sectionHeader}
        />
        <Button
          title={t('assets.add_asset')}
          onPress={() => {
            resetAssetForm();
            setAssetSheetVisible(true);
          }}
          style={styles.secondaryAction}
          textStyle={styles.secondaryActionText}
        />
        {assets.map(asset => (
          <View key={asset.id} style={styles.vehicleRow}>
            <View style={styles.vehicleCopy}>
              <Text style={styles.vehicleName}>{asset.name}</Text>
              <Text style={styles.vehicleMeta}>
                {asset.category}
                {asset.serialNumber ? ` · S/N ${asset.serialNumber}` : ''}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <BottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        title={editingId ? t('assets.edit_vehicle') : t('assets.add_vehicle')}
      >
        <Text style={styles.label}>{t('assets.make_model')}</Text>
        <TextInput
          style={styles.input}
          value={makeModel}
          onChangeText={setMakeModel}
          placeholder={t('assets.make_model_placeholder')}
          placeholderTextColor={styles.placeholder.color}
        />
        <Text style={styles.label}>{t('assets.registration_number')}</Text>
        <TextInput
          style={styles.input}
          value={registrationNumber}
          onChangeText={setRegistrationNumber}
          autoCapitalize="characters"
          placeholder={t('assets.registration_placeholder')}
          placeholderTextColor={styles.placeholder.color}
        />
        <Text style={styles.label}>{t('assets.insurance_expiry')}</Text>
        <Pressable style={styles.input} onPress={() => setShowDatePicker(true)}>
          <Text style={insuranceExpiry ? styles.dateValue : styles.placeholder}>
            {insuranceExpiry
              ? displayDate(insuranceExpiry)
              : t('assets.insurance_expiry_placeholder')}
          </Text>
        </Pressable>
        {showDatePicker ? (
          <DateTimePicker
            value={
              insuranceExpiry
                ? new Date(`${insuranceExpiry}T00:00:00`)
                : new Date()
            }
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        ) : null}
        <Text style={styles.label}>{t('assets.vehicle_document')}</Text>
        <Pressable style={styles.attachButton} onPress={attachDocument}>
          <Text style={styles.attachText}>
            {documentName
              ? t('assets.replace_document')
              : t('assets.attach_document')}
          </Text>
        </Pressable>
        {documentName ? (
          <View style={styles.documentPreviewCard}>
            <View style={styles.documentIconWrap}>
              <Text style={styles.documentIconText}>
                {documentName.split('.').pop()?.toUpperCase() || 'FILE'}
              </Text>
            </View>
            <View style={styles.documentInfoWrap}>
              <Text style={styles.documentPreviewName}>{documentName}</Text>
              <Text style={styles.documentPreviewMeta}>
                {documentReviewed ? t('assets.reviewed_saved') : t('assets.pending_review')}
              </Text>
            </View>
          </View>
        ) : null}
        <Text style={styles.documentHelp}>
          {t('assets.document_help')}
        </Text>
        <Button
          title={editingId ? t('assets.save_changes') : t('assets.save_vehicle')}
          onPress={save}
          style={styles.saveButton}
        />
        {editingId ? (
          <Pressable style={styles.deleteButton} onPress={remove}>
            <Text style={styles.deleteText}>{t('assets.delete_vehicle')}</Text>
          </Pressable>
        ) : null}
      </BottomSheet>
      <BottomSheet
        visible={assetSheetVisible}
        onClose={() => setAssetSheetVisible(false)}
        title={t('assets.add_asset')}
      >
        <Text style={styles.label}>{t('assets.asset_name')}</Text>
        <TextInput
          style={styles.input}
          value={assetName}
          onChangeText={setAssetName}
          placeholder={t('assets.asset_name_placeholder')}
          placeholderTextColor={styles.placeholder.color}
        />
        <Text style={styles.label}>{t('assets.category')}</Text>
        <Pressable
          style={styles.selectInput}
          onPress={() => setShowAssetCategoryList(value => !value)}
        >
          <Text style={assetCategory ? styles.dateValue : styles.placeholder}>
            {assetCategory || t('assets.select_category')}
          </Text>
          {showAssetCategoryList ? (
            <ChevronUp size={15} color={styles.selectCaret.color} style={{ marginLeft: styles.selectCaret.marginLeft }} />
          ) : (
            <ChevronDown size={15} color={styles.selectCaret.color} style={{ marginLeft: styles.selectCaret.marginLeft }} />
          )}
        </Pressable>
        {showAssetCategoryList ? (
          <View style={styles.categoryList}>
            {DEFAULT_ASSET_CATEGORIES.map(option => (
              <Pressable
                key={option}
                style={[
                  styles.categoryItem,
                  assetCategory === option && styles.categoryItemSelected,
                ]}
                onPress={() => {
                  setAssetCategory(option);
                  setShowAssetCategoryList(false);
                }}
              >
                <Text
                  style={[
                    styles.categoryItemText,
                    assetCategory === option && styles.categoryItemTextSelected,
                  ]}
                >
                  {t(ASSET_CATEGORY_KEYS[option])}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Text style={styles.label}>{t('assets.serial_number_optional')}</Text>
        <TextInput
          style={styles.input}
          value={assetSerial}
          onChangeText={setAssetSerial}
          placeholder={t('assets.serial_number_placeholder')}
          placeholderTextColor={styles.placeholder.color}
        />
        <Button
          title={t('assets.save_asset')}
          onPress={saveAsset}
          style={styles.saveButton}
        />
      </BottomSheet>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    backIcon: { color: colors.textPrimary },
    headerTitle: {
      flex: 1,
      marginLeft: spacing.md,
      fontFamily: fonts.serif,
      fontSize: 21,
      color: colors.textPrimary,
    },
    addButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    addText: { fontSize: 24, color: colors.surface },
    content: { padding: spacing.lg },
    hero: { backgroundColor: colors.surfaceElevated, marginBottom: spacing.xl },
    heroIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.blush,
      marginBottom: spacing.md,
    },
    heroIconColor: { color: colors.primary },
    heroTitle: {
      fontFamily: fonts.serif,
      fontSize: 24,
      color: colors.textPrimary,
    },
    heroText: {
      marginTop: spacing.xs,
      fontFamily: fonts.sans,
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
    },
    metrics: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    metric: {
      flexBasis: '48%',
      flexGrow: 1,
      minWidth: 120,
      padding: spacing.md,
    },
    summaryStrip: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.xl,
    },
    summaryPill: {
      flex: 1,
      minWidth: 120,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    summaryPillHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    summaryPillIcon: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryIconPrimary: { color: colors.primary },
    summaryIconWarning: { color: colors.danger },
    summaryIconSuccess: { color: colors.forest },
    priorityPill: {
      backgroundColor: colors.blush,
      borderColor: colors.border,
    },
    warningPill: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.dangerBorder,
    },
    successPill: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    summaryPillLabel: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textSecondary,
    },
    summaryPillValue: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textPrimary,
    },
    metricValue: {
      fontFamily: fonts.serif,
      fontSize: 21,
      color: colors.primary,
    },
    metricLabel: {
      marginTop: 3,
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.textSecondary,
    },
    sectionHeader: { marginBottom: spacing.md },
    sectionDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    primaryAction: {
      marginBottom: spacing.md,
      shadowColor: colors.primary,
      shadowOpacity: 0.16,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    secondaryAction: {
      marginBottom: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
      shadowColor: colors.primary,
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    secondaryActionText: {
      color: colors.primary,
    },
    empty: { marginTop: spacing.md },
    emptyTitle: {
      fontFamily: fonts.serif,
      fontSize: 18,
      color: colors.textPrimary,
    },
    emptyText: {
      marginTop: spacing.xs,
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
    },
    vehicleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      marginBottom: spacing.xs,
      borderRadius: radius.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surfaceElevated,
    },
    vehicleCopy: { flex: 1, paddingRight: spacing.sm },
    vehicleName: {
      fontFamily: fonts.sansMedium,
      fontSize: 15,
      color: colors.textPrimary,
    },
    vehicleMeta: {
      marginTop: 2,
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
    },
    documentName: {
      marginTop: 3,
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textMuted,
    },
    reviewPill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.blush,
    },
    reviewPillDone: { backgroundColor: colors.surfaceElevated },
    reviewText: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: colors.primary,
    },
    reviewTextDone: { color: colors.forest },
    label: {
      marginTop: spacing.md,
      marginBottom: spacing.xs,
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textPrimary,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      fontFamily: fonts.sans,
      fontSize: 15,
      color: colors.textPrimary,
    },
    placeholder: { color: colors.textMuted },
    dateValue: {
      fontFamily: fonts.sans,
      fontSize: 15,
      color: colors.textPrimary,
    },
    attachButton: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      borderRadius: radius.md,
      padding: spacing.md,
      backgroundColor: colors.surface,
    },
    attachText: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.primary,
    },
    documentPreviewCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    documentIconWrap: {
      width: 42,
      height: 42,
      borderRadius: radius.md,
      backgroundColor: colors.blush,
      alignItems: 'center',
      justifyContent: 'center',
    },
    documentIconText: {
      fontFamily: fonts.sansBold,
      fontSize: 10,
      color: colors.primary,
    },
    documentInfoWrap: { flex: 1 },
    documentPreviewName: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textPrimary,
    },
    documentPreviewMeta: {
      marginTop: 2,
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textSecondary,
    },
    documentHelp: {
      marginTop: spacing.sm,
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    selectInput: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
    },
    selectCaret: {
      fontSize: 15,
      color: colors.textMuted,
      marginLeft: spacing.sm,
    },
    categoryList: {
      marginTop: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    categoryItem: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    categoryItemSelected: {
      backgroundColor: colors.blush,
    },
    categoryItemText: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textPrimary,
    },
    categoryItemTextSelected: {
      color: colors.primary,
    },
    saveButton: { marginTop: spacing.lg },
    deleteButton: { alignItems: 'center', paddingVertical: spacing.md },
    deleteText: {
      fontFamily: fonts.sansMedium,
      fontSize: 14,
      color: colors.danger,
    },
  });
