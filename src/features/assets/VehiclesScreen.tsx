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
import type { RootStackParamList } from '../../app/_layout';
import BottomSheet from '../../components/BottomSheet';
import Button from '../../components/Button';
import Card from '../../components/Card';
import SectionHeader from '../../components/SectionHeader';
import useThemedStyles from '../../hooks/useThemedStyles';
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
    return () => {
      isMounted = false;
    };
  }, []);
  const persist = async (next: Vehicle[]) => {
    const safeNext = Array.isArray(next) ? next : [];
    setVehicles(safeNext);
    await saveVehicles(safeNext);
  };
  const saveAsset = async () => {
    if (!assetName.trim() || !assetCategory.trim()) {
      Alert.alert('Complete the details', 'Enter an asset name and category.');
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
          'Document not attached',
          'Please try selecting the vehicle registration or insurance document again.',
        );
    }
  };
  const save = async () => {
    if (!makeModel.trim() || !registrationNumber.trim() || !insuranceExpiry) {
      Alert.alert(
        'Complete the details',
        'Enter the vehicle, registration number, and insurance expiry date.',
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
      'Delete vehicle?',
      'This vehicle and its document details will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
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
        'Attach a document first',
        'Add the registration certificate or insurance document before marking it reviewed.',
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
    if (assets.length === 0) return 'No items yet';
    const counts = assets.reduce<Record<string, number>>((memo, asset) => {
      const key = asset.category || 'Other';
      memo[key] = (memo[key] ?? 0) + 1;
      return memo;
    }, {});
    const [category, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return count > 1 ? `${category} (${count})` : category;
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
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={20} color={styles.backIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>Assets & vehicles</Text>
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
            Vehicle details, ready when needed
          </Text>
          <Text style={styles.heroText}>
            Keep registration, insurance, and document-review status together.
          </Text>
        </Card>
        <SectionHeader
          title="At a glance"
          subtitle="A quick view of your vehicle records."
        />
        <View style={styles.metrics}>
          <Card style={styles.metric}>
            <Text style={styles.metricValue}>{vehicles.length}</Text>
            <Text style={styles.metricLabel}>Vehicles</Text>
          </Card>
          <Card style={styles.metric}>
            <Text style={styles.metricValue}>{vehiclesWithDocs}</Text>
            <Text style={styles.metricLabel}>Documented</Text>
          </Card>
          <Card style={styles.metric}>
            <Text style={styles.metricValue}>{pendingReview}</Text>
            <Text style={styles.metricLabel}>Needs review</Text>
          </Card>
        </View>
        <View style={styles.summaryStrip}>
          <View style={[styles.summaryPill, styles.priorityPill]}>
            <View style={styles.summaryPillHeader}>
              <View style={styles.summaryPillIcon}><FileText size={12} color={styles.summaryIconPrimary.color} /></View>
              <Text style={styles.summaryPillLabel}>Coverage</Text>
            </View>
            <Text style={styles.summaryPillValue}>{vehiclesWithDocs}/{vehicles.length}</Text>
          </View>
          <View style={[styles.summaryPill, styles.warningPill]}>
            <View style={styles.summaryPillHeader}>
              <View style={styles.summaryPillIcon}><ShieldAlert size={12} color={styles.summaryIconWarning.color} /></View>
              <Text style={styles.summaryPillLabel}>Attention</Text>
            </View>
            <Text style={styles.summaryPillValue}>{missingDocs + expiringSoon}</Text>
          </View>
          <View style={[styles.summaryPill, styles.successPill]}>
            <View style={styles.summaryPillHeader}>
              <View style={styles.summaryPillIcon}><Tag size={12} color={styles.summaryIconSuccess.color} /></View>
              <Text style={styles.summaryPillLabel}>Top category</Text>
            </View>
            <Text style={styles.summaryPillValue}>{mostCommonAssetCategory}</Text>
          </View>
        </View>
        <View style={styles.sectionDivider} />
        <SectionHeader
          title="Vehicles"
          subtitle="Tap a vehicle to update its details."
          style={styles.sectionHeader}
        />
        <Button title="Add vehicle" onPress={() => openForm()} style={styles.primaryAction} />
        {vehicles.length === 0 ? (
          <Card style={styles.empty}>
            <Text style={styles.emptyTitle}>Add your first vehicle</Text>
            <Text style={styles.emptyText}>
              Store its number and attach a registration or insurance document.
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
                  {vehicle.registrationNumber} · Insurance until{' '}
                  {displayDate(vehicle.insuranceExpiry)}
                </Text>
                <Text style={styles.documentName}>
                  {vehicle.documentName ?? 'No document attached'}
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
                  {vehicle.documentReviewed ? '✓ Reviewed' : 'Review document'}
                </Text>
              </Pressable>
            </Pressable>
          ))
        )}
        <View style={styles.sectionDivider} />
        <SectionHeader
          title="Household assets"
          subtitle="Track appliances and valuables with their category and serial number."
          style={styles.sectionHeader}
        />
        <Button
          title="Add household asset"
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
        title={editingId ? 'Edit vehicle' : 'Add vehicle'}
      >
        <Text style={styles.label}>Vehicle make and model</Text>
        <TextInput
          style={styles.input}
          value={makeModel}
          onChangeText={setMakeModel}
          placeholder="e.g., Honda City"
          placeholderTextColor={styles.placeholder.color}
        />
        <Text style={styles.label}>Registration number</Text>
        <TextInput
          style={styles.input}
          value={registrationNumber}
          onChangeText={setRegistrationNumber}
          autoCapitalize="characters"
          placeholder="e.g., MH 01 AB 1234"
          placeholderTextColor={styles.placeholder.color}
        />
        <Text style={styles.label}>Insurance expiry</Text>
        <Pressable style={styles.input} onPress={() => setShowDatePicker(true)}>
          <Text style={insuranceExpiry ? styles.dateValue : styles.placeholder}>
            {insuranceExpiry
              ? displayDate(insuranceExpiry)
              : 'Choose expiry date'}
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
        <Text style={styles.label}>Vehicle document</Text>
        <Pressable style={styles.attachButton} onPress={attachDocument}>
          <Text style={styles.attachText}>
            {documentName
              ? 'Replace document'
              : 'Attach registration or insurance document'}
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
                {documentReviewed ? 'Reviewed and saved' : 'Uploaded and pending review'}
              </Text>
            </View>
          </View>
        ) : null}
        <Text style={styles.documentHelp}>
          A reviewed document means you have checked the details; it does not
          verify authenticity with a government service.
        </Text>
        <Button
          title={editingId ? 'Save changes' : 'Save vehicle'}
          onPress={save}
          style={styles.saveButton}
        />
        {editingId ? (
          <Pressable style={styles.deleteButton} onPress={remove}>
            <Text style={styles.deleteText}>Delete vehicle</Text>
          </Pressable>
        ) : null}
      </BottomSheet>
      <BottomSheet
        visible={assetSheetVisible}
        onClose={() => setAssetSheetVisible(false)}
        title="Add household asset"
      >
        <Text style={styles.label}>Asset name</Text>
        <TextInput
          style={styles.input}
          value={assetName}
          onChangeText={setAssetName}
          placeholder="e.g., Washing machine"
          placeholderTextColor={styles.placeholder.color}
        />
        <Text style={styles.label}>Category</Text>
        <Pressable
          style={styles.selectInput}
          onPress={() => setShowAssetCategoryList(value => !value)}
        >
          <Text style={assetCategory ? styles.dateValue : styles.placeholder}>
            {assetCategory || 'Select category'}
          </Text>
          <Text style={styles.selectCaret}>
            {showAssetCategoryList ? '▴' : '▾'}
          </Text>
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
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Text style={styles.label}>Serial number (optional)</Text>
        <TextInput
          style={styles.input}
          value={assetSerial}
          onChangeText={setAssetSerial}
          placeholder="Serial number"
          placeholderTextColor={styles.placeholder.color}
        />
        <Button
          title="Save asset"
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
