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

type Props = StackScreenProps<RootStackParamList, 'DocDetails'>;

export default function DocDetailsScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { docId } = route.params;

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
    fetchDetail();
  }, [docId]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Document',
      `Are you sure you want to remove "${doc?.title}" from your repository?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteDocument(docId);
            Alert.alert('Deleted', 'Document has been removed.');
            navigation.goBack();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color="#004F63" />
      </View>
    );
  }

  if (!doc) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.errorText}>Document Not Found</Text>
        <Pressable style={styles.backLinkBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>Go Back</Text>
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
        <Text style={styles.headerTitle}>Document Details</Text>
        <Pressable onPress={handleDelete} style={styles.deleteHeaderBtn}>
          <Trash2 size={18} color="#EF4444" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Document Hero Badge */}
        <View style={styles.docHeroCard}>
          <View style={styles.heroIconBadge}>
            <FileText size={28} color="#004F63" />
          </View>
          <Text style={styles.heroTitle}>{doc.title}</Text>
          <Text style={styles.heroCategory}>{doc.category.toUpperCase()} DOCUMENT</Text>

          {/* Status Badge */}
          <View style={styles.statusBadgeWrap}>
            {status === 'expired' && (
              <View style={[styles.statusBadge, styles.badgeExpired]}>
                <Text style={[styles.statusBadgeText, styles.textExpired]}>
                  Expired ({Math.abs(daysLeft)} days ago)
                </Text>
              </View>
            )}
            {status === 'expiring' && (
              <View style={[styles.statusBadge, styles.badgeExpiring]}>
                <Text style={[styles.statusBadgeText, styles.textExpiring]}>
                  Expiring Soon ({daysLeft} days remaining)
                </Text>
              </View>
            )}
            {status === 'valid' && (
              <View style={[styles.statusBadge, styles.badgeValid]}>
                <Text style={[styles.statusBadgeText, styles.textValid]}>
                  Valid & Active
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Secure Document Number Card */}
        <Text style={styles.sectionTitle}>Document Number & Access</Text>
        <View style={styles.card}>
          <View style={styles.secureRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>Document / Policy ID</Text>
              <Text style={styles.secureDocNumber}>{maskedDocNumber(doc.docNumber)}</Text>
            </View>
            {doc.docNumber && (
              <Pressable
                style={styles.eyeBtn}
                onPress={() => setShowDocNumber(!showDocNumber)}>
                {showDocNumber ? (
                  <EyeOff size={18} color="#004F63" />
                ) : (
                  <Eye size={18} color="#004F63" />
                )}
              </Pressable>
            )}
          </View>
        </View>

        {/* Info Table Card */}
        <Text style={styles.sectionTitle}>Key Metadata</Text>
        <View style={styles.card}>
          <View style={styles.metaRow}>
            <User size={16} color={styles.placeholder.color} />
            <Text style={styles.metaKey}>Document Owner</Text>
            <Text style={styles.metaVal}>{doc.memberName}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.metaRow}>
            <Calendar size={16} color={styles.placeholder.color} />
            <Text style={styles.metaKey}>Issue Date</Text>
            <Text style={styles.metaVal}>{doc.issueDate || 'Not specified'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.metaRow}>
            <Clock size={16} color={styles.placeholder.color} />
            <Text style={styles.metaKey}>Expiration Date</Text>
            <Text style={styles.metaValBold}>
              {doc.expiryDate}
            </Text>
          </View>

          {doc.country && (
            <>
              <View style={styles.divider} />
              <View style={styles.metaRow}>
                <ShieldCheck size={16} color={styles.placeholder.color} />
                <Text style={styles.metaKey}>Country</Text>
                <Text style={styles.metaVal}>{doc.country}</Text>
              </View>
            </>
          )}

          {doc.issuingAuthority && (
            <>
              <View style={styles.divider} />
              <View style={styles.metaRow}>
                <ShieldCheck size={16} color={styles.placeholder.color} />
                <Text style={styles.metaKey}>Issuing Authority</Text>
                <Text style={styles.metaVal}>{doc.issuingAuthority}</Text>
              </View>
            </>
          )}

          {doc.coveredMembers && (
            <>
              <View style={styles.divider} />
              <View style={styles.metaRow}>
                <User size={16} color={styles.placeholder.color} />
                <Text style={styles.metaKey}>Covered Members</Text>
                <Text style={styles.metaVal}>{doc.coveredMembers}</Text>
              </View>
            </>
          )}
        </View>

        {/* Notes Card */}
        {doc.notes && (
          <>
            <Text style={styles.sectionTitle}>Notes & Instructions</Text>
            <View style={styles.card}>
              <Text style={styles.notesText}>{doc.notes}</Text>
            </View>
          </>
        )}

        {/* Attachment View Card */}
        <Text style={styles.sectionTitle}>Document Attachment</Text>
        <View style={styles.card}>
          <View style={styles.attachmentRow}>
            <File size={20} color="#004F63" />
            <View style={{ flex: 1 }}>
              <Text style={styles.attachmentTitle}>
                {doc.fileName || `${doc.title}.pdf`}
              </Text>
              <Text style={styles.attachmentSub}>Stored in local encrypted vault</Text>
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
      backgroundColor: '#004F63',
      borderRadius: 12,
    },
    backLinkText: {
      color: '#FFFFFF',
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
      backgroundColor: '#FEE2E2',
      alignItems: 'center',
      justifyContent: 'center',
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
      backgroundColor: '#E0F2FE',
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
    },
    badgeExpired: { backgroundColor: '#FEE2E2' },
    badgeExpiring: { backgroundColor: '#FFEDD5' },
    badgeValid: { backgroundColor: '#DCFCE7' },
    statusBadgeText: { fontFamily: fonts.sansBold, fontSize: 12 },
    textExpired: { color: '#EF4444' },
    textExpiring: { color: '#EA580C' },
    textValid: { color: '#16A34A' },

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
      backgroundColor: '#E0F2FE',
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
