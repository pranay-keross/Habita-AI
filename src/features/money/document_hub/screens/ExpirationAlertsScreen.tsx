import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../../app/_layout';
import type { ThemeTokens } from '../../../../theme';
import useThemedStyles from '../../../../hooks/useThemedStyles';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import AlertTriangle from 'lucide-react-native/icons/triangle-alert';
import Clock from 'lucide-react-native/icons/clock';
import FileText from 'lucide-react-native/icons/file-text';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import BottomSheet from '../../../../components/BottomSheet';
import Button from '../../../../components/Button';
import { loadDocuments, getDocStatus, updateDocument } from '../docStore';
import type { DocHubEntry } from '../types';

type Props = StackScreenProps<RootStackParamList, 'ExpirationAlerts'>;

export default function ExpirationAlertsScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<DocHubEntry[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocHubEntry | null>(null);
  const [newExpiry, setNewExpiry] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchAlerts = async () => {
    setLoading(true);
    const list = await loadDocuments();
    setDocs(list);
    setLoading(false);
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const expiredList = docs.filter((d) => getDocStatus(d.expiryDate).status === 'expired');
  const expiringList = docs.filter((d) => getDocStatus(d.expiryDate).status === 'expiring');

  const handleOpenRenewModal = (doc: DocHubEntry) => {
    setSelectedDoc(doc);
    setNewExpiry('2032-12-31');
  };

  const handleSaveRenewal = async () => {
    if (!selectedDoc || !newExpiry.trim()) return;

    setUpdating(true);
    await updateDocument({
      ...selectedDoc,
      expiryDate: newExpiry.trim(),
    });
    setUpdating(false);

    Alert.alert('Updated!', `Expiry date for "${selectedDoc.title}" updated.`);
    setSelectedDoc(null);
    fetchAlerts();
  };

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>Expiration & Alerts</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Alerts Summary Hero Card */}
        <View style={styles.alertSummaryHero}>
          <View style={styles.heroRow}>
            <View style={styles.alertCircleBadge}>
              <AlertTriangle size={24} color="#EA580C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertHeroTitle}>Document Warning Center</Text>
              <Text style={styles.alertHeroSub}>
                Track passports, visas, insurance policies & licenses requiring renewal.
              </Text>
            </View>
          </View>

          <View style={styles.alertStatsRow}>
            <View style={[styles.statBox, styles.statBoxRed]}>
              <Text style={styles.statNumberRed}>{expiredList.length}</Text>
              <Text style={styles.statLabelRed}>Expired</Text>
            </View>

            <View style={[styles.statBox, styles.statBoxOrange]}>
              <Text style={styles.statNumberOrange}>{expiringList.length}</Text>
              <Text style={styles.statLabelOrange}>Expiring Soon</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color="#004F63" style={{ marginTop: 24 }} />
        ) : expiredList.length === 0 && expiringList.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <CheckCircle2 size={40} color="#16A34A" />
            <Text style={styles.emptyTitle}>All Documents Up-To-Date!</Text>
            <Text style={styles.emptySub}>
              No expired or expiring documents found in your repository.
            </Text>
          </View>
        ) : (
          <>
            {/* Expired Documents Section */}
            {expiredList.length > 0 && (
              <>
                <Text style={styles.sectionTitleRed}>Expired Documents ({expiredList.length})</Text>
                {expiredList.map((doc) => {
                  const { daysLeft } = getDocStatus(doc.expiryDate);
                  return (
                    <View key={doc.id} style={styles.docCardRed}>
                      <View style={styles.cardHeader}>
                        <FileText size={20} color="#EF4444" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.docTitle}>{doc.title}</Text>
                          <Text style={styles.docMember}>Owner: {doc.memberName}</Text>
                        </View>
                        <View style={styles.badgeExpired}>
                          <Text style={styles.textExpired}>Expired</Text>
                        </View>
                      </View>

                      <View style={styles.cardFooterRow}>
                        <View style={styles.clockRow}>
                          <Clock size={12} color="#EF4444" />
                          <Text style={styles.daysExpiredText}>
                            Expired {Math.abs(daysLeft)} days ago ({doc.expiryDate})
                          </Text>
                        </View>

                        <Pressable
                          style={styles.renewBtnRed}
                          onPress={() => handleOpenRenewModal(doc)}>
                          <Text style={styles.renewBtnTextRed}>Update Expiry</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {/* Expiring Soon Documents Section */}
            {expiringList.length > 0 && (
              <>
                <Text style={styles.sectionTitleOrange}>
                  Expiring Soon ({expiringList.length})
                </Text>
                {expiringList.map((doc) => {
                  const { daysLeft } = getDocStatus(doc.expiryDate);
                  return (
                    <View key={doc.id} style={styles.docCardOrange}>
                      <View style={styles.cardHeader}>
                        <FileText size={20} color="#EA580C" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.docTitle}>{doc.title}</Text>
                          <Text style={styles.docMember}>Owner: {doc.memberName}</Text>
                        </View>
                        <View style={styles.badgeExpiring}>
                          <Text style={styles.textExpiring}>{daysLeft} days left</Text>
                        </View>
                      </View>

                      <View style={styles.cardFooterRow}>
                        <View style={styles.clockRow}>
                          <Clock size={12} color="#EA580C" />
                          <Text style={styles.daysExpiringText}>
                            Expires on {doc.expiryDate}
                          </Text>
                        </View>

                        <Pressable
                          style={styles.renewBtnOrange}
                          onPress={() => handleOpenRenewModal(doc)}>
                          <Text style={styles.renewBtnTextOrange}>Update Expiry</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Renewal Expiry Update Bottom Sheet */}
      {selectedDoc && (
        <BottomSheet
          visible={!!selectedDoc}
          onClose={() => setSelectedDoc(null)}
          title={`Update ${selectedDoc.title}`}>
          <View style={styles.modalContent}>
            <Text style={styles.modalLabel}>New Expiration Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.modalInput}
              value={newExpiry}
              onChangeText={setNewExpiry}
              placeholder="e.g. 2030-04-11"
              placeholderTextColor={styles.placeholder.color}
            />

            <Button
              title="Save Updated Expiry Date"
              onPress={handleSaveRenewal}
              loading={updating}
              style={{ marginTop: 16 }}
            />
          </View>
        </BottomSheet>
      )}
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
    alertSummaryHero: {
      backgroundColor: '#FFEDD5',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#FED7AA',
      padding: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.lg,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    alertCircleBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    alertHeroTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: '#C2410C',
    },
    alertHeroSub: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: '#EA580C',
      marginTop: 2,
      lineHeight: 16,
    },
    alertStatsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    statBox: {
      flex: 1,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
    },
    statBoxRed: {
      backgroundColor: '#FEE2E2',
    },
    statNumberRed: {
      fontFamily: fonts.sansBold,
      fontSize: 20,
      color: '#EF4444',
    },
    statLabelRed: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: '#EF4444',
      marginTop: 2,
    },
    statBoxOrange: {
      backgroundColor: '#FFFFFF',
    },
    statNumberOrange: {
      fontFamily: fonts.sansBold,
      fontSize: 20,
      color: '#EA580C',
    },
    statLabelOrange: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: '#EA580C',
      marginTop: 2,
    },
    sectionTitleRed: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: '#EF4444',
      marginBottom: spacing.xs,
      marginTop: spacing.md,
    },
    sectionTitleOrange: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: '#EA580C',
      marginBottom: spacing.xs,
      marginTop: spacing.md,
    },
    docCardRed: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: '#FCA5A5',
      padding: spacing.md,
      marginBottom: spacing.sm,
      ...shadow.soft,
    },
    docCardOrange: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: '#FDBA74',
      padding: spacing.md,
      marginBottom: spacing.sm,
      ...shadow.soft,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 10,
    },
    docTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
    },
    docMember: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    badgeExpired: {
      backgroundColor: '#FEE2E2',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
    },
    textExpired: {
      fontFamily: fonts.sansBold,
      fontSize: 11,
      color: '#EF4444',
    },
    badgeExpiring: {
      backgroundColor: '#FFEDD5',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
    },
    textExpiring: {
      fontFamily: fonts.sansBold,
      fontSize: 11,
      color: '#EA580C',
    },
    cardFooterRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
    },
    clockRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    daysExpiredText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: '#EF4444',
    },
    daysExpiringText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: '#EA580C',
    },
    renewBtnRed: {
      backgroundColor: '#EF4444',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    renewBtnTextRed: {
      color: '#FFFFFF',
      fontFamily: fonts.sansBold,
      fontSize: 12,
    },
    renewBtnOrange: {
      backgroundColor: '#EA580C',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    renewBtnTextOrange: {
      color: '#FFFFFF',
      fontFamily: fonts.sansBold,
      fontSize: 12,
    },
    emptyStateCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xxl,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.md,
    },
    emptyTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: colors.textPrimary,
      marginTop: 12,
    },
    emptySub: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
      textAlign: 'center',
    },
    modalContent: {
      paddingBottom: 20,
    },
    modalLabel: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    modalInput: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.textPrimary,
      fontFamily: fonts.sans,
    },
    placeholder: {
      color: colors.textMuted,
    },
  });
