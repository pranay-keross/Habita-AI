import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../../app/_layout';
import type { ThemeTokens } from '../../../../theme';
import useThemedStyles from '../../../../hooks/useThemedStyles';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import FileText from 'lucide-react-native/icons/file-text';
import Calendar from 'lucide-react-native/icons/calendar';
import User from 'lucide-react-native/icons/user';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import Trash2 from 'lucide-react-native/icons/trash-2';
import Clock from 'lucide-react-native/icons/clock';
import File from 'lucide-react-native/icons/file';
import { getDocById, getDocStatus, deleteDocument } from '../docStore';
import type { DocHubEntry } from '../types';
import { subscribeToLanguageChanges, t } from '../../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'DocDetails'>;

export default function DocDetailsScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { docId } = route.params;
  const [, setLocaleVersion] = useState(0);

  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<DocHubEntry | undefined>();
  const [showDocNumber, setShowDocNumber] = useState(false);

  const fetchDetail = async () => {
    setLoading(true);
    const item = await getDocById(docId);
    setDoc(item);
    setLoading(false);
  };

  useEffect(() => {
    const unsubLang = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    fetchDetail();
    return () => {
      unsubLang();
    };
  }, [docId]);

  const handleDelete = () => {
    Alert.alert(
      t('doc_hub.delete_doc_title'),
      t('doc_hub.delete_doc_confirm', { title: doc?.title || 'Document' }),
      [
        { text: t('doc_hub.cancel'), style: 'cancel' },
        {
          text: t('doc_hub.delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteDocument(docId);
            Alert.alert(t('doc_hub.delete_doc_title'), t('doc_hub.deleted_alert'));
            navigation.goBack();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={styles.primaryIcon.color} />
      </View>
    );
  }

  if (!doc) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.errorText}>{t('doc_hub.not_found')}</Text>
        <Pressable style={styles.backLinkBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>{t('doc_hub.go_back')}</Text>
        </Pressable>
      </View>
    );
  }

  const { status, daysLeft } = getDocStatus(doc.expiryDate);

  const maskedDocNumber = (num?: string) => {
    if (!num) return 'N/A';
    if (showDocNumber) return num;
    if (num.length <= 4) return '••••';
    return `${num.slice(0, 2)}••••${num.slice(-2)}`;
  };

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('doc_hub.details_title')}</Text>
        <Pressable onPress={handleDelete} style={styles.deleteHeaderBtn}>
          <Trash2 size={18} color={styles.dangerText.color} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Document Hero Badge */}
        <View style={styles.docHeroCard}>
          <View style={styles.heroIconBadge}>
            <FileText size={28} color={styles.primaryIcon.color} />
          </View>
          <Text style={styles.heroTitle}>{doc.title}</Text>
          <Text style={styles.heroCategory}>{doc.category.toUpperCase()} DOCUMENT</Text>

          {/* Status Badge */}
          <View style={styles.statusBadgeWrap}>
            {status === 'expired' && (
              <View style={[styles.statusBadge, styles.badgeExpired]}>
                <Text style={[styles.statusBadgeText, styles.textExpired]}>
                  {t('doc_hub.expired_days_ago', { count: Math.abs(daysLeft) })}
                </Text>
              </View>
            )}
            {status === 'expiring' && (
              <View style={[styles.statusBadge, styles.badgeExpiring]}>
                <Text style={[styles.statusBadgeText, styles.textExpiring]}>
                  {t('doc_hub.expiring_remaining', { count: daysLeft })}
                </Text>
              </View>
            )}
            {status === 'valid' && (
              <View style={[styles.statusBadge, styles.badgeValid]}>
                <Text style={[styles.statusBadgeText, styles.textValid]}>
                  {t('doc_hub.valid_active')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Secure Document Number Card */}
        <Text style={styles.sectionTitle}>{t('doc_hub.doc_num_access')}</Text>
        <View style={styles.card}>
          <View style={styles.secureRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>{t('doc_hub.doc_policy_id')}</Text>
              <Text style={styles.secureDocNumber}>{maskedDocNumber(doc.docNumber)}</Text>
            </View>
            {doc.docNumber && (
              <Pressable
                style={styles.eyeBtn}
                onPress={() => setShowDocNumber(!showDocNumber)}>
                {showDocNumber ? (
                  <EyeOff size={18} color={styles.primaryIcon.color} />
                ) : (
                  <Eye size={18} color={styles.primaryIcon.color} />
                )}
              </Pressable>
            )}
          </View>
        </View>

        {/* Info Table Card */}
        <Text style={styles.sectionTitle}>{t('doc_hub.key_metadata')}</Text>
        <View style={styles.card}>
          <View style={styles.metaRow}>
            <User size={16} color={styles.placeholder.color} />
            <Text style={styles.metaKey}>{t('doc_hub.doc_owner')}</Text>
            <Text style={styles.metaVal}>{doc.memberName}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.metaRow}>
            <Calendar size={16} color={styles.placeholder.color} />
            <Text style={styles.metaKey}>{t('doc_hub.issue_date')}</Text>
            <Text style={styles.metaVal}>{doc.issueDate || t('doc_hub.not_specified')}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.metaRow}>
            <Clock size={16} color={styles.placeholder.color} />
            <Text style={styles.metaKey}>{t('doc_hub.expiration_date')}</Text>
            <Text style={styles.metaValBold}>
              {doc.expiryDate}
            </Text>
          </View>

          {doc.country && (
            <>
              <View style={styles.divider} />
              <View style={styles.metaRow}>
                <ShieldCheck size={16} color={styles.placeholder.color} />
                <Text style={styles.metaKey}>{t('doc_hub.country')}</Text>
                <Text style={styles.metaVal}>{doc.country}</Text>
              </View>
            </>
          )}

          {doc.issuingAuthority && (
            <>
              <View style={styles.divider} />
              <View style={styles.metaRow}>
                <ShieldCheck size={16} color={styles.placeholder.color} />
                <Text style={styles.metaKey}>{t('doc_hub.issuing_authority')}</Text>
                <Text style={styles.metaVal}>{doc.issuingAuthority}</Text>
              </View>
            </>
          )}

          {doc.coveredMembers && (
            <>
              <View style={styles.divider} />
              <View style={styles.metaRow}>
                <User size={16} color={styles.placeholder.color} />
                <Text style={styles.metaKey}>{t('doc_hub.covered_members')}</Text>
                <Text style={styles.metaVal}>{doc.coveredMembers}</Text>
              </View>
            </>
          )}
        </View>

        {/* Notes Card */}
        {doc.notes && (
          <>
            <Text style={styles.sectionTitle}>{t('doc_hub.notes_instructions')}</Text>
            <View style={styles.card}>
              <Text style={styles.notesText}>{doc.notes}</Text>
            </View>
          </>
        )}

        {/* Attachment View Card */}
        <Text style={styles.sectionTitle}>{t('doc_hub.doc_attachment')}</Text>
        <View style={styles.card}>
          <View style={styles.attachmentRow}>
            <File size={20} color={styles.primaryIcon.color} />
            <View style={{ flex: 1 }}>
              <Text style={styles.attachmentTitle}>
                {doc.fileName || `${doc.title}.pdf`}
              </Text>
              <Text style={styles.attachmentSub}>{t('doc_hub.local_vault_sub')}</Text>
            </View>
          </View>
        </View>
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
    center: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorText: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: colors.textPrimary,
    },
    backLinkBtn: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: colors.primary,
      borderRadius: 12,
    },
    backLinkText: {
      color: colors.textOnPrimary,
      fontFamily: fonts.sansBold,
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
    deleteHeaderBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerIcon: {
      color: colors.textPrimary,
    },
    primaryIcon: {
      color: colors.primary,
    },
    dangerText: {
      color: colors.danger,
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
    docHeroCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.md,
      marginBottom: spacing.lg,
      ...shadow.soft,
    },
    heroIconBadge: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    heroTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 18,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    heroCategory: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 4,
      letterSpacing: 0.5,
    },
    statusBadgeWrap: {
      marginTop: 12,
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    badgeExpired: { backgroundColor: colors.surfaceElevated },
    badgeExpiring: { backgroundColor: colors.surfaceElevated },
    badgeValid: { backgroundColor: colors.surfaceElevated },
    statusBadgeText: { fontFamily: fonts.sansBold, fontSize: 12 },
    textExpired: { color: colors.danger },
    textExpiring: { color: colors.primary },
    textValid: { color: colors.forest },

    sectionTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
      marginTop: spacing.md,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadow.soft,
    },
    secureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardLabel: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
    },
    secureDocNumber: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: colors.textPrimary,
      marginTop: 4,
      letterSpacing: 1,
    },
    eyeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      gap: 10,
    },
    metaKey: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textSecondary,
      flex: 1,
    },
    metaVal: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textPrimary,
    },
    metaValBold: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.textPrimary,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    notesText: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textPrimary,
      lineHeight: 18,
    },
    attachmentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    attachmentTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 13.5,
      color: colors.textPrimary,
    },
    attachmentSub: {
      fontFamily: fonts.sans,
      fontSize: 11.5,
      color: colors.textMuted,
      marginTop: 2,
    },
    placeholder: {
      color: colors.textMuted,
    },
  });
