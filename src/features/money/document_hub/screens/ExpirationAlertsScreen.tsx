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
import BellRing from 'lucide-react-native/icons/bell-ring';
import BellOff from 'lucide-react-native/icons/bell-off';
import AlertsCard from '../../../../components/AlertsCard';
import BottomSheet from '../../../../components/BottomSheet';
import Button from '../../../../components/Button';
import { loadDocuments, getDocStatus, updateDocument } from '../docStore';
import {
  loadDocReminderSettings,
  setDocRemindersEnabled,
  syncDocumentReminders,
  type DocReminderSettings,
} from '../reminders';
import type { DocHubEntry } from '../types';
import { subscribeToLanguageChanges, t } from '../../../../i18n';
import useAuth from '../../../../hooks/useAuth';
import usePushNotifications from '../../../../hooks/usePushNotifications';
import { showNetworkUnavailableAlert } from '../../../../utils/networkStatus';
import { extractVaultErrorMessage } from '../api';

type Props = StackScreenProps<RootStackParamList, 'ExpirationAlerts'>;

export default function ExpirationAlertsScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuth();
  const [, setLocaleVersion] = useState(0);

  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<DocHubEntry[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocHubEntry | null>(null);
  const [newExpiry, setNewExpiry] = useState('');
  const [updating, setUpdating] = useState(false);
  const [reminders, setReminders] = useState<DocReminderSettings | null>(null);
  const [scheduledCount, setScheduledCount] = useState(0);
  const {
    documents: documentAlerts,
    markAsRead,
    markSectionAsRead,
  } = usePushNotifications();

  const fetchAlerts = async () => {
    setLoading(true);
    const token = await getAccessToken().catch(() => null);
    const list = await loadDocuments(token);
    setDocs(list);
    setLoading(false);

    // Reschedule from the freshly-loaded vault. Done here rather than only when a
    // document changes, because the schedule also goes stale simply by time
    // passing — a 30-day reminder that was in the future last month is not now.
    // `syncDocumentReminders` replaces the whole group with stable ids, so
    // repeating it on every visit converges instead of stacking duplicates.
    const settings = await loadDocReminderSettings();
    setReminders(settings);
    setScheduledCount(await syncDocumentReminders(list, settings));
  };

  const toggleReminders = async () => {
    const next = await setDocRemindersEnabled(!(reminders?.enabled ?? true), docs);
    setReminders(next);
    setScheduledCount(next.enabled ? await syncDocumentReminders(docs, next) : 0);
  };

  useEffect(() => {
    const unsubLang = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    fetchAlerts();
    return () => {
      unsubLang();
    };
  }, []);

  const expiredList = docs.filter((d) => getDocStatus(d.expiryDate).status === 'expired');
  const expiringList = docs.filter((d) => getDocStatus(d.expiryDate).status === 'expiring');

  const handleOpenRenewModal = (doc: DocHubEntry) => {
    setSelectedDoc(doc);
    setNewExpiry('2032-12-31');
  };

  const handleSaveRenewal = async () => {
    if (!selectedDoc || !newExpiry.trim()) return;
    if (selectedDoc.issueDate && selectedDoc.issueDate > newExpiry.trim()) {
      Alert.alert(t('doc_hub.invalid_dates_title'), t('doc_hub.invalid_dates_msg'));
      return;
    }

    setUpdating(true);
    try {
      const token = await getAccessToken().catch(() => null);
      const { offline } = await updateDocument(
        {
          ...selectedDoc,
          expiryDate: newExpiry.trim(),
        },
        token,
      );

      if (offline) {
        showNetworkUnavailableAlert();
      } else {
        Alert.alert(t('doc_hub.updated_alert_title'), t('doc_hub.updated_alert_msg', { title: selectedDoc.title }));
      }
      setSelectedDoc(null);
      fetchAlerts();
    } catch (err) {
      Alert.alert(t('doc_hub.renew_failed_title'), extractVaultErrorMessage(err) || t('doc_hub.renew_failed_msg'));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('doc_hub.alerts_title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Alerts Summary Hero Card */}
        <View style={styles.alertSummaryHero}>
          <View style={styles.heroRow}>
            <View style={styles.alertCircleBadge}>
              <AlertTriangle size={24} color={styles.alertHeroTitle.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertHeroTitle}>{t('doc_hub.warning_center')}</Text>
              <Text style={styles.alertHeroSub}>
                {t('doc_hub.warning_center_sub')}
              </Text>
            </View>
          </View>

          <View style={styles.alertStatsRow}>
            <View style={[styles.statBox, styles.statBoxRed]}>
              <Text style={styles.statNumberRed}>{expiredList.length}</Text>
              <Text style={styles.statLabelRed}>{t('doc_hub.status_expired')}</Text>
            </View>

            <View style={[styles.statBox, styles.statBoxOrange]}>
              <Text style={styles.statNumberOrange}>{expiringList.length}</Text>
              <Text style={styles.statLabelOrange}>{t('doc_hub.expiring_count_stat', { count: '' }).trim() || 'Expiring Soon'}</Text>
            </View>
          </View>
        </View>

        {/* Expiry reminders — the gap this screen used to leave open: it showed
            what was expiring, but only to whoever remembered to open it. See
            docs/AWH_FEATURE_GAP_ANALYSIS.md §1.1 gap 1.5. */}
        <Pressable
          style={styles.reminderRow}
          onPress={toggleReminders}
          accessibilityRole="switch"
          accessibilityState={{ checked: reminders?.enabled ?? false }}>
          <View style={styles.reminderIcon}>
            {reminders?.enabled ? (
              <BellRing size={18} color={styles.primaryIcon.color} />
            ) : (
              <BellOff size={18} color={styles.mutedIcon.color} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.reminderTitle}>{t('doc_hub.reminders_title')}</Text>
            <Text style={styles.reminderSub}>
              {reminders?.enabled
                ? scheduledCount > 0
                  ? t('doc_hub.reminders_scheduled', { count: scheduledCount })
                  : t('doc_hub.reminders_none_scheduled')
                : t('doc_hub.reminders_desc')}
            </Text>
          </View>
          <View style={[styles.reminderPill, reminders?.enabled && styles.reminderPillOn]}>
            <Text
              style={[
                styles.reminderPillText,
                reminders?.enabled && styles.reminderPillTextOn,
              ]}>
              {reminders?.enabled ? t('doc_hub.reminders_on') : t('doc_hub.reminders_off')}
            </Text>
          </View>
        </Pressable>

        {/* Reminders that already fired, so a swiped-away notification is not lost. */}
        <AlertsCard
          section="documents"
          items={documentAlerts}
          onDismiss={markAsRead}
          onMarkAllRead={() => markSectionAsRead('documents')}
        />

        {loading ? (
          <ActivityIndicator color={styles.primaryIcon.color} style={{ marginTop: 24 }} />
        ) : expiredList.length === 0 && expiringList.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <CheckCircle2 size={40} color={styles.forestText.color} />
            <Text style={styles.emptyTitle}>{t('doc_hub.all_current_title')}</Text>
            <Text style={styles.emptySub}>
              {t('doc_hub.all_current_sub')}
            </Text>
          </View>
        ) : (
          <>
            {/* Expired Documents Section */}
            {expiredList.length > 0 && (
              <>
                <Text style={styles.sectionTitleRed}>{t('doc_hub.status_expired')} ({expiredList.length})</Text>
                {expiredList.map((doc) => {
                  const { daysLeft } = getDocStatus(doc.expiryDate);
                  return (
                    <View key={doc.id} style={styles.docCardRed}>
                      <View style={styles.cardHeader}>
                        <FileText size={20} color={styles.dangerText.color} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.docTitle}>{doc.title}</Text>
                          <Text style={styles.docMember}>{t('doc_hub.owner_label', { name: doc.memberName })}</Text>
                        </View>
                        <View style={styles.badgeExpired}>
                          <Text style={styles.textExpired}>{t('doc_hub.status_expired')}</Text>
                        </View>
                      </View>

                      <View style={styles.cardFooterRow}>
                        <View style={styles.clockRow}>
                          <Clock size={12} color={styles.dangerText.color} />
                          <Text style={styles.daysExpiredText}>
                            {t('doc_hub.expired_days_ago', { count: Math.abs(daysLeft) })} ({doc.expiryDate})
                          </Text>
                        </View>

                        <Pressable
                          style={styles.renewBtnRed}
                          onPress={() => handleOpenRenewModal(doc)}>
                          <Text style={styles.renewBtnTextRed}>{t('doc_hub.update_renew')}</Text>
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
                  {t('doc_hub.action_needed', { count: expiringList.length })}
                </Text>
                {expiringList.map((doc) => {
                  const { daysLeft } = getDocStatus(doc.expiryDate);
                  return (
                    <View key={doc.id} style={styles.docCardOrange}>
                      <View style={styles.cardHeader}>
                        <FileText size={20} color={styles.primaryIcon.color} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.docTitle}>{doc.title}</Text>
                          <Text style={styles.docMember}>{t('doc_hub.owner_label', { name: doc.memberName })}</Text>
                        </View>
                        <View style={styles.badgeExpiring}>
                          <Text style={styles.textExpiring}>{t('doc_hub.status_days_left', { count: daysLeft })}</Text>
                        </View>
                      </View>

                      <View style={styles.cardFooterRow}>
                        <View style={styles.clockRow}>
                          <Clock size={12} color={styles.primaryIcon.color} />
                          <Text style={styles.daysExpiringText}>
                            {t('doc_hub.expires_label', { date: doc.expiryDate })}
                          </Text>
                        </View>

                        <Pressable
                          style={styles.renewBtnOrange}
                          onPress={() => handleOpenRenewModal(doc)}>
                          <Text style={styles.renewBtnTextOrange}>{t('doc_hub.update_renew')}</Text>
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
          title={t('doc_hub.renew_modal_title')}>
          <View style={styles.modalContent}>
            <Text style={styles.modalLabel}>{t('doc_hub.new_expiry_label')}</Text>
            <TextInput
              style={styles.modalInput}
              value={newExpiry}
              onChangeText={setNewExpiry}
              placeholder="e.g. 2030-04-11"
              placeholderTextColor={styles.placeholder.color}
            />
            <Button
              title={t('doc_hub.save_new_expiry')}
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
    primaryIcon: {
      color: colors.primary,
    },
    mutedIcon: {
      color: colors.textMuted,
    },
    reminderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    reminderIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reminderTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.textPrimary,
    },
    reminderSub: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    reminderPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
    },
    reminderPillOn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    reminderPillText: {
      fontFamily: fonts.sansBold,
      fontSize: 11,
      color: colors.textMuted,
    },
    reminderPillTextOn: {
      color: colors.textOnPrimary,
    },
    dangerText: {
      color: colors.danger,
    },
    forestText: {
      color: colors.forest,
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
      backgroundColor: colors.surfaceElevated,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    alertHeroTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: colors.primary,
    },
    alertHeroSub: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
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
      borderWidth: 1,
      borderColor: colors.border,
    },
    statBoxRed: {
      backgroundColor: colors.surface,
    },
    statNumberRed: {
      fontFamily: fonts.sansBold,
      fontSize: 20,
      color: colors.danger,
    },
    statLabelRed: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.danger,
      marginTop: 2,
    },
    statBoxOrange: {
      backgroundColor: colors.surface,
    },
    statNumberOrange: {
      fontFamily: fonts.sansBold,
      fontSize: 20,
      color: colors.primary,
    },
    statLabelOrange: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.primary,
      marginTop: 2,
    },
    sectionTitleRed: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.danger,
      marginBottom: spacing.xs,
      marginTop: spacing.md,
    },
    sectionTitleOrange: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.primary,
      marginBottom: spacing.xs,
      marginTop: spacing.md,
    },
    docCardRed: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
      ...shadow.soft,
    },
    docCardOrange: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
    },
    textExpired: {
      fontFamily: fonts.sansBold,
      fontSize: 11,
      color: colors.danger,
    },
    badgeExpiring: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
    },
    textExpiring: {
      fontFamily: fonts.sansBold,
      fontSize: 11,
      color: colors.primary,
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
      color: colors.danger,
    },
    daysExpiringText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.primary,
    },
    renewBtnRed: {
      backgroundColor: colors.danger,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    renewBtnTextRed: {
      color: colors.textOnPrimary,
      fontFamily: fonts.sansBold,
      fontSize: 12,
    },
    renewBtnOrange: {
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    renewBtnTextOrange: {
      color: colors.textOnPrimary,
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
