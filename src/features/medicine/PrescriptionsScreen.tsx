import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, ActivityIndicator, Image, Modal, RefreshControl } from 'react-native';
import { pick, keepLocalCopy, isErrorWithCode, errorCodes, types as documentTypes } from '@react-native-documents/picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet from '../../components/BottomSheet';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../app/_layout';
import type { ThemeTokens } from '../../theme';
import useThemedStyles from '../../hooks/useThemedStyles';
import { subscribeToLanguageChanges, t } from '../../i18n';
import { SkeletonCard } from '../../components/Skeleton';
import useAuth from '../../hooks/useAuth';
import { ArrowLeft, ChevronRight, Eye, Trash2, Camera, Image as ImageIcon, FileText, X, MoreVertical, Paperclip } from 'lucide-react-native';
import {
  deleteMedicalDocument,
  extractMedchestErrorMessage,
  listMedicalDocuments,
  listMedicines,
  normalizeScheduleTimes,
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
import { timeToSlot } from './types';

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
  const [refreshing, setRefreshing] = useState(false);
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [showUploadSheet, setShowUploadSheet] = useState(false);
  const [selectedDocForOptions, setSelectedDocForOptions] = useState<MedicalDocument | null>(null);
  const [showDocOptionsSheet, setShowDocOptionsSheet] = useState(false);
  const [fullscreenDoc, setFullscreenDoc] = useState<MedicalDocument | null>(null);
  const [localeVersion, setLocaleVersion] = useState(0);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [savingQuantity, setSavingQuantity] = useState(false);

  const showRemoteError = (err: unknown) => {
    const detail = extractMedchestErrorMessage(err);
    if (detail) {
      if (
        detail.toLowerCase().includes('unable to extract') ||
        detail.toLowerCase().includes('extract medicines') ||
        detail.toLowerCase().includes('prescription')
      ) {
        Alert.alert(
          t('medicine.prescription_failed_title'),
          t('medicine.prescription_failed_msg'),
          [
            { text: t('medicine.cancel'), style: 'cancel' },
            {
              text: t('medicine.add_medicine_manually'),
              style: 'default',
              onPress: () => navigation.navigate('Medicine', { openAddModal: true }),
            },
          ]
        );
        return;
      }
      Alert.alert(t('onboarding.error_title'), detail);
    } else {
      const key: Record<MedchestErrorKind, string> = {
        network: 'onboarding.network_error',
        not_found: 'medicine.error_not_found',
        no_permission: 'medicine.error_no_permission',
        unknown: 'medicine.error_generic',
      };
      Alert.alert(t('onboarding.error_title'), t(key[parseMedchestError(err)]));
    }
  };

  const refreshDocuments = async (token: string) => {
    setDocuments(await listMedicalDocuments(familyProfileId, token));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const token = await getAccessToken();
      if (token) {
        await refreshDocuments(token);
      }
    } catch (err) {
      showRemoteError(err);
    } finally {
      setRefreshing(false);
    }
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

  const handleSelectDocOptions = (doc: MedicalDocument) => {
    setSelectedDocForOptions(doc);
    setShowDocOptionsSheet(true);
  };

  const handleViewFullscreen = () => {
    setShowDocOptionsSheet(false);
    if (selectedDocForOptions) {
      setFullscreenDoc(selectedDocForOptions);
    }
  };

  const handleDeleteDocument = () => {
    setShowDocOptionsSheet(false);
    const docToDelete = selectedDocForOptions;
    if (!docToDelete) return;

    Alert.alert(
      t('medicine.delete_doc_confirm_title'),
      t('medicine.delete_doc_confirm_msg'),
      [
        { text: t('medicine.cancel'), style: 'cancel' },
        {
          text: t('medicine.delete_document'),
          style: 'destructive',
          onPress: async () => {
            setUploadingDoc(true);
            try {
              const token = await getAccessToken();
              if (token) {
                await deleteMedicalDocument(familyProfileId, [docToDelete.id], token);
                await refreshDocuments(token);
              }
            } catch (err) {
              showRemoteError(err);
            } finally {
              setUploadingDoc(false);
            }
          },
        },
      ],
    );
  };

  const startQuantityQueue = async (matched: RemoteMedicine[]) => {
    const liquidFlags = await loadLiquidFlags();
    setQueue(
      matched.map((m) => ({
        id: m.id,
        name: m.name,
        dosage: m.dosage ?? '',
        scheduleTimes: normalizeScheduleTimes(m.scheduleTimes),
        lowStockThreshold: m.lowStockThreshold ?? 3,
        stock: normalizeStockQuantity(m.stockQuantity) !== null ? String(m.stockQuantity) : '',
        isLiquid: liquidFlags[m.id] ?? guessIsLiquid(m.dosage ?? ''),
      })),
    );
    setQueueIndex(0);
  };

  const processUploadedDocument = async (
    uploaded: MedicalDocument,
    token: string,
    existingMedicines: RemoteMedicine[],
  ) => {
    await refreshDocuments(token);

    if (uploaded.ocrStatus === 'FAILED') {
      Alert.alert(
        t('medicine.prescription_failed_title'),
        t('medicine.prescription_failed_msg'),
        [
          { text: t('medicine.cancel'), style: 'cancel' },
          {
            text: t('medicine.add_medicine_manually'),
            style: 'default',
            onPress: () => navigation.navigate('Medicine', { openAddModal: true }),
          },
        ]
      );
      return;
    }

    // Polling loop to wait for asynchronous OCR processing to complete (up to 5 attempts)
    let remoteMedicines: RemoteMedicine[] = [];
    let newlyAdded: RemoteMedicine[] = [];
    let matchedByName: RemoteMedicine[] = [];

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    for (let attempt = 0; attempt < 5; attempt++) {
      await delay(attempt === 0 ? 800 : 1500);
      try {
        const [docs, meds] = await Promise.all([
          listMedicalDocuments(familyProfileId, token),
          listMedicines(familyProfileId, token),
        ]);
        setDocuments(docs);
        remoteMedicines = meds;

        // 1. Identify medicines newly added to the remote list
        newlyAdded = remoteMedicines.filter((m) => !existingMedicines.some((e) => e.id === m.id));

        // 2. Identify medicines matching extracted names
        const latestDoc = docs.find((d) => d.id === uploaded.id) || uploaded;
        const extractedNames = latestDoc.extractedMedicineNames || uploaded.extractedMedicineNames || [];
        matchedByName = extractedNames.flatMap((rawName) => {
          const cleanName = rawName.trim().toLowerCase();
          if (!cleanName) return [];
          return remoteMedicines.filter((m) => {
            const medName = m.name.trim().toLowerCase();
            return medName === cleanName || medName.includes(cleanName) || cleanName.includes(medName);
          });
        });

        if (newlyAdded.length > 0 || matchedByName.length > 0) {
          break;
        }

        if (latestDoc.ocrStatus === 'COMPLETED' || latestDoc.ocrStatus === 'SUCCESS' || latestDoc.ocrStatus === 'FAILED') {
          break;
        }
      } catch {
        // Continue polling if a transient error occurs
      }
    }

    // Combine newly added medicines and matched-by-name medicines, deduplicating by ID
    const combinedMap = new Map<string, RemoteMedicine>();
    for (const m of [...newlyAdded, ...matchedByName]) {
      combinedMap.set(m.id, m);
    }
    const matched = Array.from(combinedMap.values());

    if (matched.length > 0) {
      await startQuantityQueue(matched);
    } else {
      Alert.alert(
        t('medicine.prescription_processed_title'),
        t('medicine.prescription_empty_msg'),
        [
          { text: t('medicine.ok'), style: 'cancel' },
          {
            text: t('medicine.add_medicine_manually'),
            style: 'default',
            onPress: () => navigation.navigate('Medicine', { openAddModal: true }),
          },
        ]
      );
    }
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
      // On iOS the picker can return asset URIs (ph:// / assets-library://). Copy a
      // local cache copy first so the upload can read a file:// uri.
      let uploadUri = result.uri;
      try {
        // Only call keepLocalCopy on iOS-like asset URIs; keepLocalCopy will return
        // a `localUri` pointing into the app cache/document dir when successful.
        if (uploadUri && (uploadUri.startsWith('ph://') || uploadUri.startsWith('assets-library://')))
        {
          const copies = await keepLocalCopy({
            files: [{ uri: uploadUri, fileName: result.name ?? 'document' }],
            destination: 'cachesDirectory',
          });
          if (copies && copies[0] && copies[0].status === 'success') {
            uploadUri = copies[0].localUri;
          }
        }
      } catch (copyErr) {
        // If copying fails, fall back to the original URI and let the upload error
        // surface to the user; don't block the flow.
        // eslint-disable-next-line no-console
        console.warn('keepLocalCopy failed', copyErr);
      }

      const existingMedicines = await listMedicines(familyProfileId, token);
      const uploaded = await uploadMedicalDocument(
        familyProfileId,
        { uri: uploadUri, name: result.name ?? 'document', type: result.type ?? 'application/octet-stream' },
        'PRESCRIPTION',
        token,
      );
      await processUploadedDocument(uploaded, token, existingMedicines);
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      showRemoteError(err);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleTakePhoto = async () => {
    setShowUploadSheet(false);
    try {
      const res = await launchCamera({ mediaType: 'photo', cameraType: 'back', quality: 0.8, saveToPhotos: false });
      if (res.didCancel) return;
      const asset = res.assets && res.assets[0];
      if (!asset || !asset.uri) return;
      setUploadingDoc(true);
      const token = await getAccessToken();
      if (!token) return;

      let uploadUri = asset.uri;
      try {
        if (uploadUri.startsWith('ph://') || uploadUri.startsWith('assets-library://')) {
          const copies = await keepLocalCopy({ files: [{ uri: uploadUri, fileName: asset.fileName ?? 'photo.jpg' }], destination: 'cachesDirectory' });
          if (copies && copies[0] && copies[0].status === 'success') uploadUri = copies[0].localUri;
        }
      } catch (e) {
        // ignore copy errors and fallback to original uri
        // eslint-disable-next-line no-console
        console.warn('keepLocalCopy failed', e);
      }

      const existingMedicines = await listMedicines(familyProfileId, token);
      const uploaded = await uploadMedicalDocument(familyProfileId, { uri: uploadUri, name: asset.fileName ?? 'photo.jpg', type: asset.type ?? 'image/jpeg' }, 'PRESCRIPTION', token);
      await processUploadedDocument(uploaded, token, existingMedicines);
    } catch (err) {
      showRemoteError(err);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handlePickFromGallery = async () => {
    setShowUploadSheet(false);
    try {
      const res = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.8 });
      if (res.didCancel) return;
      const asset = res.assets && res.assets[0];
      if (!asset || !asset.uri) return;
      setUploadingDoc(true);
      const token = await getAccessToken();
      if (!token) return;

      let uploadUri = asset.uri;
      try {
        if (uploadUri.startsWith('ph://') || uploadUri.startsWith('assets-library://')) {
          const copies = await keepLocalCopy({ files: [{ uri: uploadUri, fileName: asset.fileName ?? 'photo.jpg' }], destination: 'cachesDirectory' });
          if (copies && copies[0] && copies[0].status === 'success') uploadUri = copies[0].localUri;
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('keepLocalCopy failed', e);
      }

      const existingMedicines = await listMedicines(familyProfileId, token);
      const uploaded = await uploadMedicalDocument(familyProfileId, { uri: uploadUri, name: asset.fileName ?? 'photo.jpg', type: asset.type ?? 'image/jpeg' }, 'PRESCRIPTION', token);
      await processUploadedDocument(uploaded, token, existingMedicines);
    } catch (err) {
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
      const scheduleTimesMap: Record<string, string> = {};
      const times = normalizeScheduleTimes(item.scheduleTimes);
      if (times.length > 0) {
        for (const time of times) {
          const slot = timeToSlot(time);
          scheduleTimesMap[slot] = time;
        }
      } else {
        scheduleTimesMap.morning = '08:00';
      }
      await updateMedicine(
        item.id,
        {
          name: item.name,
          dosage: item.dosage,
          scheduleTimes: scheduleTimesMap,
          stockQuantity: qty,
          lowStockThreshold: item.lowStockThreshold ?? 3,
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
          <ArrowLeft size={18} color="#000000" strokeWidth={1.5} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('medicine.prescriptions_header_title')}</Text>
        <View style={styles.addBtnPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#000000"
            colors={['#000000']}
          />
        }>
        {loading ? (
          <View style={{ paddingTop: 8 }}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : (
          <>
            <Text style={styles.sectionSub}>{t('medicine.documents_sub')}</Text>

            <Pressable style={styles.uploadBanner} onPress={() => setShowUploadSheet(true)} disabled={uploadingDoc}>
              {uploadingDoc ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <>
                  <Paperclip size={18} color="#000000" strokeWidth={1.5} style={{ marginRight: 12 }} />
                  <View style={styles.uploadBannerContent}>
                    <Text style={styles.uploadBannerTitle}>{t('medicine.upload_document_btn')}</Text>
                    <Text style={styles.uploadBannerSub}>{t('medicine.upload_document_sub')}</Text>
                  </View>
                  <ChevronRight size={16} color="#000000" strokeWidth={1.3} />
                </>
              )}
            </Pressable>

            {documents.length === 0 ? (
              <Text style={styles.documentsEmptyText}>{t('medicine.documents_empty')}</Text>
            ) : (
              documents.map((doc) => (
                <Pressable key={doc.id} style={styles.documentRow} onPress={() => handleSelectDocOptions(doc)}>
                  <View style={styles.documentIconWrap}>
                    <FileText size={18} color="#000000" strokeWidth={1.5} />
                  </View>
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentName} numberOfLines={1}>
                      {doc.originalFilename}
                    </Text>
                    <Text style={styles.documentMeta}>
                      {new Date(doc.uploadedAt).toLocaleDateString()} · {t('medicine.ocr_status_label')}:{' '}
                      {t(`medicine.ocr_status_${doc.ocrStatus.toLowerCase()}`)}
                    </Text>
                  </View>
                  <MoreVertical size={16} color={styles.documentMeta.color ?? '#888888'} />
                </Pressable>
              ))
            )}
            <BottomSheet visible={showUploadSheet} onClose={() => setShowUploadSheet(false)} title={t('medicine.upload_document_btn')}>
              <Pressable style={styles.sheetOption} onPress={handleTakePhoto}>
                <Camera size={16} color="#000000" style={{ marginRight: 10 }} />
                <Text style={styles.sheetOptionText}>{t('medicine.choose_camera')}</Text>
              </Pressable>
              <Pressable style={styles.sheetOption} onPress={handlePickFromGallery}>
                <ImageIcon size={16} color="#000000" style={{ marginRight: 10 }} />
                <Text style={styles.sheetOptionText}>{t('medicine.choose_gallery')}</Text>
              </Pressable>
              <Pressable style={styles.sheetOption} onPress={async () => { setShowUploadSheet(false); await handlePickDocument(); }}>
                <FileText size={16} color="#000000" style={{ marginRight: 10 }} />
                <Text style={styles.sheetOptionText}>{t('medicine.choose_document')}</Text>
              </Pressable>
            </BottomSheet>

            <BottomSheet
              visible={showDocOptionsSheet}
              onClose={() => setShowDocOptionsSheet(false)}
              title={selectedDocForOptions?.originalFilename ?? t('medicine.prescriptions_header_title')}
            >
              <Pressable style={styles.sheetOption} onPress={handleViewFullscreen}>
                <Eye size={16} color="#000000" style={{ marginRight: 10 }} />
                <Text style={styles.sheetOptionText}>{t('medicine.view_fullscreen')}</Text>
              </Pressable>
              <Pressable style={styles.sheetOption} onPress={handleDeleteDocument}>
                <Trash2 size={16} color="#ef4444" style={{ marginRight: 10 }} />
                <Text style={[styles.sheetOptionText, styles.destructiveText]}>{t('medicine.delete_document')}</Text>
              </Pressable>
            </BottomSheet>
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

      {fullscreenDoc && (
        <Modal
          visible
          animationType="slide"
          onRequestClose={() => setFullscreenDoc(null)}
          statusBarTranslucent
        >
          <View style={[styles.fullscreenContainer, { paddingTop: insets.top + 8 }]}>
            <View style={styles.fullscreenHeader}>
              <Pressable onPress={() => setFullscreenDoc(null)} style={styles.fullscreenCloseBtn}>
                <X size={18} color="#000000" />
              </Pressable>
              <Text style={styles.fullscreenTitle} numberOfLines={1}>
                {fullscreenDoc.originalFilename}
              </Text>
              <View style={styles.fullscreenPlaceholder} />
            </View>

            <View style={styles.fullscreenBody}>
              {fullscreenDoc.documentPath ? (
                <Image
                  source={{ uri: fullscreenDoc.documentPath }}
                  style={styles.fullscreenImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.documentsEmptyText}>
                  {fullscreenDoc.originalFilename}
                </Text>
              )}
            </View>
          </View>
        </Modal>
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#ECECEE',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  backIcon: {
    fontSize: 16,
    color: '#000000',
  },
  headerTitle: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  addBtnPlaceholder: {
    width: 36,
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
    fontSize: 11,
    fontWeight: '300',
    color: '#888888',
    marginBottom: spacing.md,
  },
  uploadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#ECECEE',
    ...shadow.soft,
  },
  uploadBannerIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  uploadBannerContent: {
    flex: 1,
  },
  uploadBannerTitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  uploadBannerSub: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '300',
    color: '#888888',
    marginTop: 2,
  },
  uploadBannerArrow: {
    fontSize: 16,
    color: '#000000',
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetOptionText: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.textPrimary,
  },
  documentsEmptyText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#ECECEE',
    ...shadow.soft,
  },
  documentIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
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
  documentMoreIcon: {
    fontSize: 18,
    color: colors.textMuted,
    paddingLeft: spacing.xs,
  },
  destructiveText: {
    color: colors.danger || '#E53935',
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: '#121212',
  },
  fullscreenCloseBtn: {
    padding: spacing.xs,
  },
  fullscreenCloseIcon: {
    fontSize: 22,
    color: '#FFFFFF',
    fontFamily: fonts.sansBold,
  },
  fullscreenTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  fullscreenPlaceholder: {
    width: 32,
  },
  fullscreenBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
});
