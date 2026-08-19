import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, ActivityIndicator, Linking } from 'react-native';
import { pick, isErrorWithCode, errorCodes, types as documentTypes } from '@react-native-documents/picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../app/_layout';
import type { ThemeTokens } from '../../theme';
import useThemedStyles from '../../hooks/useThemedStyles';
import { subscribeToLanguageChanges, t } from '../../i18n';
import useAuth from '../../hooks/useAuth';
import {
  listMedicalDocuments,
  listMedicines,
  normalizeStockQuantity,
  parseMedchestError,
  updateMedicine,
  uploadMedicalDocument,
  type MedchestErrorKind,
  type MedicalDocument,
  type RemoteMedicine,
} from './api';
import { guessIsLiquid, loadLiquidFlags, saveLiquidFlags } from './medicineStore';
import MedicineQuantitySheet from './MedicineQuantitySheet';

type Props = StackScreenProps<RootStackParamList, 'Prescriptions'>;

interface QueueItem {
  id: string;
  name: string;
  dosage: string;
  scheduleTimes: string[];
  lowStockThreshold: number;
  stock: string;
  isLiquid: boolean;
}

export default function PrescriptionsScreen({ navigation, route }: Props) {
  const { familyProfileId } = route.params;
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [localeVersion, setLocaleVersion] = useState(0);

  // After a prescription is parsed, any medicines it auto-created come back with no
  // confirmed count — this queue walks the user through setting a real quantity (and
  // whether it's a liquid) for each one, one at a time, via `MedicineQuantitySheet`.
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [savingQuantity, setSavingQuantity] = useState(false);

  const showRemoteError = (err: unknown) => {
    const key: Record<MedchestErrorKind, string> = {
      network: 'onboarding.network_error',
      not_found: 'medicine.error_not_found',
      no_permission: 'medicine.error_no_permission',
      unknown: 'medicine.error_generic',
    };
    Alert.alert(t('onboarding.error_title'), t(key[parseMedchestError(err)]));
  };

  const refreshDocuments = async (token: string) => {
    setDocuments(await listMedicalDocuments(familyProfileId, token));
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const token = await getAccessToken();
      if (token) {
        try {
          await refreshDocuments(token);
        } catch (err) {
          showRemoteError(err);
        }
      }
      setLoading(false);
    })();
    const unsubscribe = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenDocument = async (doc: MedicalDocument) => {
    if (!doc.documentPath) {
      return;
    }
    try {
      await Linking.openURL(doc.documentPath);
    } catch {
      Alert.alert(t('onboarding.error_title'), t('medicine.error_generic'));
    }
  };

  const startQuantityQueue = async (matched: RemoteMedicine[]) => {
    const liquidFlags = await loadLiquidFlags();
    setQueue(
      matched.map((m) => ({
        id: m.id,
        name: m.name,
        dosage: m.dosage,
        scheduleTimes: m.scheduleTimes,
        lowStockThreshold: m.lowStockThreshold,
        stock: normalizeStockQuantity(m.stockQuantity) !== null ? String(m.stockQuantity) : '',
        isLiquid: liquidFlags[m.id] ?? guessIsLiquid(m.dosage),
      })),
    );
    setQueueIndex(0);
  };

  const handlePickDocument = async () => {
    try {
      const [result] = await pick({
        type: [documentTypes.pdf, documentTypes.doc, documentTypes.docx, documentTypes.images],
      });
      setUploadingDoc(true);
      const token = await getAccessToken();
      if (!token) {
        return;
      }
      const uploaded = await uploadMedicalDocument(
        familyProfileId,
        { uri: result.uri, name: result.name ?? 'document', type: result.type ?? 'application/octet-stream' },
        'PRESCRIPTION',
        token,
      );
      await refreshDocuments(token);

      if (uploaded.ocrStatus === 'FAILED') {
        Alert.alert(t('medicine.prescription_failed_title'), t('medicine.prescription_failed_msg'));
        return;
      }

      const extractedNames = uploaded.extractedMedicineNames ?? [];
      if (extractedNames.length === 0) {
        Alert.alert(t('medicine.prescription_processed_title'), t('medicine.prescription_empty_msg'));
        return;
      }

      const remoteMedicines = await listMedicines(familyProfileId, token);
      const matched = extractedNames
        .map((name) => remoteMedicines.find((m) => m.name.trim().toLowerCase() === name.trim().toLowerCase()))
        .filter((m): m is RemoteMedicine => !!m);

      if (matched.length === 0) {
        Alert.alert(t('medicine.prescription_processed_title'), t('medicine.prescription_processed_msg'));
        return;
      }
      await startQuantityQueue(matched);
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      showRemoteError(err);
    } finally {
      setUploadingDoc(false);
    }
  };

  const updateQueueItem = (patch: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((item, i) => (i === queueIndex ? { ...item, ...patch } : item)));
  };

  const advanceQueue = () => {
    if (queueIndex + 1 >= queue.length) {
      setQueue([]);
      setQueueIndex(0);
    } else {
      setQueueIndex((i) => i + 1);
    }
  };

  const handleSaveQuantity = async () => {
    const item = queue[queueIndex];
    const qty = parseInt(item.stock, 10);
    if (!item.stock.trim() || Number.isNaN(qty) || qty < 0) {
      Alert.alert(t('medicine.incomplete_title'), t('medicine.confirm_quantity_invalid_msg'));
      return;
    }
    setSavingQuantity(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        return;
      }
      await updateMedicine(
        item.id,
        {
          name: item.name,
          dosage: item.dosage,
          scheduleTimes: item.scheduleTimes,
          stockQuantity: qty,
          lowStockThreshold: item.lowStockThreshold,
        },
        token,
      );
      const flags = await loadLiquidFlags();
      flags[item.id] = item.isLiquid;
      await saveLiquidFlags(flags);
      advanceQueue();
    } catch (err) {
      showRemoteError(err);
    } finally {
      setSavingQuantity(false);
    }
  };

  const currentQueueItem = queue[queueIndex];

  return (
    <View style={styles.root} key={localeVersion}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t('medicine.prescriptions_header_title')}</Text>
        <View style={styles.addBtnPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={styles.headerTitle.color} />
          </View>
        ) : (
          <>
            <Text style={styles.sectionSub}>{t('medicine.documents_sub')}</Text>

            <Pressable style={styles.uploadBanner} onPress={handlePickDocument} disabled={uploadingDoc}>
              {uploadingDoc ? (
                <ActivityIndicator color={styles.uploadBannerArrow.color} />
              ) : (
                <>
                  <Text style={styles.uploadBannerIcon}>📎</Text>
                  <View style={styles.uploadBannerContent}>
                    <Text style={styles.uploadBannerTitle}>{t('medicine.upload_document_btn')}</Text>
                    <Text style={styles.uploadBannerSub}>{t('medicine.upload_document_sub')}</Text>
                  </View>
                  <Text style={styles.uploadBannerArrow}>→</Text>
                </>
              )}
            </Pressable>

            {documents.length === 0 ? (
              <Text style={styles.documentsEmptyText}>{t('medicine.documents_empty')}</Text>
            ) : (
              documents.map((doc) => (
                <Pressable key={doc.id} style={styles.documentRow} onPress={() => handleOpenDocument(doc)}>
                  <Text style={styles.documentIcon}>📄</Text>
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentName} numberOfLines={1}>
                      {doc.originalFilename}
                    </Text>
                    <Text style={styles.documentMeta}>
                      {new Date(doc.uploadedAt).toLocaleDateString()} · {t('medicine.ocr_status_label')}:{' '}
                      {t(`medicine.ocr_status_${doc.ocrStatus.toLowerCase()}`)}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </>
        )}
      </ScrollView>

      {currentQueueItem && (
        <MedicineQuantitySheet
          visible
          medicineName={currentQueueItem.name}
          current={queueIndex + 1}
          total={queue.length}
          stock={currentQueueItem.stock}
          onChangeStock={(value) => updateQueueItem({ stock: value })}
          isLiquid={currentQueueItem.isLiquid}
          onChangeIsLiquid={(value) => updateQueueItem({ isLiquid: value })}
          saving={savingQuantity}
          onSave={handleSaveQuantity}
          onSkip={advanceQueue}
          onClose={advanceQueue}
        />
      )}
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) => StyleSheet.create({
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  backIcon: {
    fontSize: 20,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontFamily: fonts.serif,
    fontSize: 20,
    color: colors.textPrimary,
  },
  addBtnPlaceholder: {
    width: 40,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  loadingWrap: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  sectionSub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  uploadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
  },
  uploadBannerIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  uploadBannerContent: {
    flex: 1,
  },
  uploadBannerTitle: {
    fontFamily: fonts.serif,
    fontSize: 15,
    color: colors.textPrimary,
  },
  uploadBannerSub: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  uploadBannerArrow: {
    fontSize: 18,
    color: colors.primary,
    fontFamily: fonts.sansBold,
  },
  documentsEmptyText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  documentIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textPrimary,
  },
  documentMeta: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});
