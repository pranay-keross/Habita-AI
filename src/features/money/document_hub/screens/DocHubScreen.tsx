import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../../app/_layout';
import type { ThemeTokens } from '../../../../theme';
import useThemedStyles from '../../../../hooks/useThemedStyles';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Search from 'lucide-react-native/icons/search';
import Plus from 'lucide-react-native/icons/plus';
import AlertTriangle from 'lucide-react-native/icons/triangle-alert';
import FileText from 'lucide-react-native/icons/file-text';
import Globe from 'lucide-react-native/icons/globe';
import CreditCard from 'lucide-react-native/icons/credit-card';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Clock from 'lucide-react-native/icons/clock';
import { loadDocuments, getDocStatus } from '../docStore';
import type { DocCategory, DocHubEntry } from '../types';
import { subscribeToLanguageChanges, t } from '../../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'DocHub'>;

const CATEGORIES: { key: DocCategory | 'all'; labelKey: string; label: string; icon: string }[] = [
  { key: 'all', labelKey: 'doc_hub.cat_all', label: 'All Docs', icon: '📂' },
  { key: 'passport', labelKey: 'doc_hub.cat_passport', label: 'Passports', icon: '📘' },
  { key: 'visa', labelKey: 'doc_hub.cat_visa', label: 'Visas', icon: '🛂' },
  { key: 'license', labelKey: 'doc_hub.cat_license', label: 'Licenses', icon: '🪪' },
  { key: 'insurance', labelKey: 'doc_hub.cat_insurance', label: 'Insurance', icon: '🏥' },
  { key: 'warranty', labelKey: 'doc_hub.cat_warranty', label: 'Warranties', icon: '🏷️' },
  { key: 'property', labelKey: 'doc_hub.cat_property', label: 'Property', icon: '🏠' },
  { key: 'tax', labelKey: 'doc_hub.cat_tax', label: 'Tax', icon: '🧾' },
];

export default function DocHubScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [, setLocaleVersion] = useState(0);

  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<DocHubEntry[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<DocCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDocs = async () => {
    setLoading(true);
    const list = await loadDocuments();
    setDocs(list);
    setLoading(false);
  };

  useEffect(() => {
    const unsubLang = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    const unsubscribe = navigation.addListener('focus', () => {
      fetchDocs();
    });
    return () => {
      unsubLang();
      unsubscribe();
    };
  }, [navigation]);

  const alertSummary = useMemo(() => {
    let expiredCount = 0;
    let expiringCount = 0;

    docs.forEach((d) => {
      const { status } = getDocStatus(d.expiryDate);
      if (status === 'expired') expiredCount++;
      if (status === 'expiring') expiringCount++;
    });

    return { expiredCount, expiringCount, totalAlerts: expiredCount + expiringCount };
  }, [docs]);

  const filteredDocs = useMemo(() => {
    return docs.filter((doc) => {
      const matchesCategory =
        selectedCategory === 'all' || doc.category === selectedCategory;
      const matchesSearch =
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.memberName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.docNumber && doc.docNumber.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesCategory && matchesSearch;
    });
  }, [docs, selectedCategory, searchQuery]);

  const getCategoryIcon = (category: DocCategory) => {
    switch (category) {
      case 'passport':
        return <FileText size={18} color={styles.primaryIcon.color} />;
      case 'visa':
        return <Globe size={18} color={styles.primaryIcon.color} />;
      case 'license':
        return <CreditCard size={18} color={styles.primaryIcon.color} />;
      case 'insurance':
        return <ShieldCheck size={18} color={styles.primaryIcon.color} />;
      default:
        return <FileText size={18} color={styles.placeholder.color} />;
    }
  };

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('doc_hub.hub_title')}</Text>
        <Pressable
          onPress={() => navigation.navigate('AddDoc')}
          style={styles.addNavBtn}>
          <Plus size={20} color={styles.addIcon.color} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Search Bar */}
        <View style={styles.searchBarRow}>
          <Search size={18} color={styles.placeholder.color} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('doc_hub.search_placeholder')}
            placeholderTextColor={styles.placeholder.color}
          />
        </View>

        {/* Expiration Alert Banner */}
        {alertSummary.totalAlerts > 0 && (
          <Pressable
            style={styles.alertBanner}
            onPress={() => navigation.navigate('ExpirationAlerts')}>
            <View style={styles.alertBannerLeft}>
              <View style={styles.alertIconCircle}>
                <AlertTriangle size={20} color={styles.alertTitle.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>{t('doc_hub.exp_warnings')}</Text>
                <Text style={styles.alertSub}>
                  {alertSummary.expiredCount > 0
                    ? t('doc_hub.expired_expiring_sub', { expired: alertSummary.expiredCount, expiring: alertSummary.expiringCount })
                    : t('doc_hub.expiring_soon_sub', { count: alertSummary.expiringCount })}
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={styles.alertTitle.color} />
          </Pressable>
        )}

        {/* Category Horizontal Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.key}
              style={[
                styles.categoryChip,
                selectedCategory === cat.key && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(cat.key)}>
              <Text style={styles.chipEmoji}>{cat.icon}</Text>
              <Text
                style={[
                  styles.chipText,
                  selectedCategory === cat.key && styles.chipTextActive,
                ]}>
                {t(cat.labelKey)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Document Repository List Header */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionTitle}>
            {t('doc_hub.repo_title', { count: filteredDocs.length })}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={styles.primaryIcon.color} style={{ marginTop: 24 }} />
        ) : filteredDocs.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <FileText size={36} color={styles.placeholder.color} />
            <Text style={styles.emptyTitle}>{t('doc_hub.no_docs_title')}</Text>
            <Text style={styles.emptySub}>
              {searchQuery ? t('doc_hub.search_try_another') : t('doc_hub.tap_add_doc')}
            </Text>
          </View>
        ) : (
          filteredDocs.map((doc) => {
            const { status, daysLeft } = getDocStatus(doc.expiryDate);
            return (
              <Pressable
                key={doc.id}
                style={styles.docCard}
                onPress={() => navigation.navigate('DocDetails', { docId: doc.id })}>
                <View style={styles.docCardHeader}>
                  <View style={styles.docIconBadge}>{getCategoryIcon(doc.category)}</View>
                  <View style={styles.docMainInfo}>
                    <Text style={styles.docTitle} numberOfLines={1}>
                      {doc.title}
                    </Text>
                    <Text style={styles.docMemberName}>{t('doc_hub.owner_label', { name: doc.memberName })}</Text>
                  </View>

                  {/* Status Badge */}
                  {status === 'expired' && (
                    <View style={[styles.statusBadge, styles.badgeExpired]}>
                      <Text style={[styles.statusBadgeText, styles.textExpired]}>{t('doc_hub.status_expired')}</Text>
                    </View>
                  )}
                  {status === 'expiring' && (
                    <View style={[styles.statusBadge, styles.badgeExpiring]}>
                      <Text style={[styles.statusBadgeText, styles.textExpiring]}>
                        {t('doc_hub.status_days_left', { count: daysLeft })}
                      </Text>
                    </View>
                  )}
                  {status === 'valid' && (
                    <View style={[styles.statusBadge, styles.badgeValid]}>
                      <Text style={[styles.statusBadgeText, styles.textValid]}>{t('doc_hub.status_valid')}</Text>
                    </View>
                  )}
                </View>

                {/* Footer details */}
                <View style={styles.docCardFooter}>
                  {doc.docNumber ? (
                    <Text style={styles.docNumberText}>{t('doc_hub.no_label', { num: doc.docNumber })}</Text>
                  ) : (
                    <Text style={styles.docNumberText}>{t('doc_hub.cat_label', { cat: doc.category })}</Text>
                  )}
                  <View style={styles.expiryRow}>
                    <Clock size={12} color={styles.placeholder.color} />
                    <Text style={styles.expiryDateText}>{t('doc_hub.expires_label', { date: doc.expiryDate })}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
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
    primaryIcon: {
      color: colors.primary,
    },
    addIcon: {
      color: colors.textOnPrimary,
    },
    headerTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 18,
      color: colors.textPrimary,
    },
    addNavBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow.soft,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    searchBarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginTop: spacing.md,
      marginBottom: spacing.md,
      ...shadow.soft,
    },
    searchInput: {
      flex: 1,
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.textPrimary,
    },
    placeholder: {
      color: colors.textMuted,
    },
    alertBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      marginBottom: spacing.md,
    },
    alertBannerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    alertIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    alertTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.primary,
    },
    alertSub: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    categoriesContainer: {
      gap: 8,
      marginBottom: spacing.lg,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    categoryChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipEmoji: {
      fontSize: 14,
    },
    chipText: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textPrimary,
    },
    chipTextActive: {
      color: colors.textOnPrimary,
      fontFamily: fonts.sansBold,
    },
    listHeaderRow: {
      marginBottom: spacing.sm,
    },
    sectionTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: colors.textPrimary,
    },
    docCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
      ...shadow.soft,
    },
    docCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 10,
    },
    docIconBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    docMainInfo: {
      flex: 1,
    },
    docTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
    },
    docMemberName: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    badgeExpired: { backgroundColor: colors.surfaceElevated },
    badgeExpiring: { backgroundColor: colors.surfaceElevated },
    badgeValid: { backgroundColor: colors.surfaceElevated },
    statusBadgeText: { fontFamily: fonts.sansBold, fontSize: 11 },
    textExpired: { color: colors.danger },
    textExpiring: { color: colors.primary },
    textValid: { color: colors.forest },
    docCardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
    },
    docNumberText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.textSecondary,
    },
    expiryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    expiryDateText: {
      fontFamily: fonts.sans,
      fontSize: 11.5,
      color: colors.textMuted,
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
  });
