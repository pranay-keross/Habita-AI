import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../../app/_layout';
import type { ThemeTokens } from '../../../../theme';
import useThemedStyles from '../../../../hooks/useThemedStyles';
import useResponsive from '../../../../hooks/useResponsive';
import { SkeletonCard } from '../../../../components/Skeleton';
import ModernBottomNav, { type BottomNavTab } from '../../../../components/ModernBottomNav';
import {
  ArrowLeft,
  Search,
  Plus,
  AlertTriangle,
  FileText,
  Globe,
  CreditCard,
  ShieldCheck,
  Clock,
  ChevronRight,
  Folder,
  BookOpen,
  Tag,
  Home,
  Receipt,
} from 'lucide-react-native';
import { loadDocuments, getDocStatus } from '../docStore';
import type { DocCategory, DocHubEntry } from '../types';
import { subscribeToLanguageChanges, t } from '../../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'DocHub'>;

const CATEGORIES: { key: DocCategory | 'all'; labelKey: string }[] = [
  { key: 'all', labelKey: 'doc_hub.cat_all' },
  { key: 'passport', labelKey: 'doc_hub.cat_passport' },
  { key: 'visa', labelKey: 'doc_hub.cat_visa' },
  { key: 'license', labelKey: 'doc_hub.cat_license' },
  { key: 'insurance', labelKey: 'doc_hub.cat_insurance' },
  { key: 'warranty', labelKey: 'doc_hub.cat_warranty' },
  { key: 'property', labelKey: 'doc_hub.cat_property' },
  { key: 'tax', labelKey: 'doc_hub.cat_tax' },
];

export default function DocHubScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { isExpanded, contentMaxWidth } = useResponsive();
  const [, setLocaleVersion] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [docs, setDocs] = useState<DocHubEntry[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<DocCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDocs = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    const list = await loadDocuments();
    setDocs(list);
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    fetchDocs(true);
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

  const getCategoryIcon = (category: DocCategory | 'all', size = 16, color?: string) => {
    const c = color ?? styles.primaryIcon.color;
    switch (category) {
      case 'passport':
        return <BookOpen size={size} color={c} strokeWidth={1.5} />;
      case 'visa':
        return <Globe size={size} color={c} strokeWidth={1.5} />;
      case 'license':
        return <CreditCard size={size} color={c} strokeWidth={1.5} />;
      case 'insurance':
        return <ShieldCheck size={size} color={c} strokeWidth={1.5} />;
      case 'warranty':
        return <Tag size={size} color={c} strokeWidth={1.5} />;
      case 'property':
        return <Home size={size} color={c} strokeWidth={1.5} />;
      case 'tax':
        return <Receipt size={size} color={c} strokeWidth={1.5} />;
      default:
        return <Folder size={size} color={c} strokeWidth={1.5} />;
    }
  };

  const maxContentStyle = isExpanded
    ? { maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as const }
    : { width: '100%' as const };

  const handleNavPress = (tab: BottomNavTab) => {
    if (tab === 'home') {
      navigation.navigate('Dashboard');
    } else if (tab === 'family') {
      navigation.navigate('Family');
    } else if (tab === 'center') {
      navigation.navigate('Voice');
    } else if (tab === 'health') {
      navigation.navigate('Medicine');
    } else if (tab === 'vault') {
      // already on vault
    }
  };

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.headerContent, maxContentStyle]}>
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
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 96 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#000000"
            colors={['#000000']}
          />
        }>
        <View style={maxContentStyle}>
          {/* Search Bar */}
          <View style={styles.searchBarRow}>
            <Search size={18} color={styles.placeholder.color} style={styles.searchIcon} />
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
                <View style={styles.alertTextGroup}>
                  <Text style={styles.alertTitle}>{t('doc_hub.exp_warnings')}</Text>
                  <Text style={styles.alertSub}>
                    {alertSummary.expiredCount > 0
                      ? t('doc_hub.expired_expiring_sub', {
                          expired: alertSummary.expiredCount,
                          expiring: alertSummary.expiringCount,
                        })
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
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.key;
              return (
                <Pressable
                  key={cat.key}
                  style={[
                    styles.categoryChip,
                    active && styles.categoryChipActive,
                  ]}
                  onPress={() => setSelectedCategory(cat.key)}>
                  <View style={{ marginRight: 6 }}>
                    {getCategoryIcon(cat.key, 13, active ? '#FFFFFF' : '#000000')}
                  </View>
                  <Text
                    style={[
                      styles.chipText,
                      active && styles.chipTextActive,
                    ]}>
                    {t(cat.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Document Cards */}
          {loading ? (
            <View style={{ paddingTop: 8 }}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : filteredDocs.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <FileText size={48} color={styles.placeholder.color} />
              <Text style={styles.emptyTitle}>{t('doc_hub.no_docs_found')}</Text>
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
                      <Text style={styles.docMemberName}>
                        {t('doc_hub.owner_label', { name: doc.memberName })}
                      </Text>
                    </View>

                    {/* Status Badge */}
                    {status === 'expired' && (
                      <View style={[styles.statusBadge, styles.badgeExpired]}>
                        <Text style={[styles.statusBadgeText, styles.textExpired]}>
                          {t('doc_hub.status_expired')}
                        </Text>
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
                        <Text style={[styles.statusBadgeText, styles.textValid]}>
                          {t('doc_hub.status_valid')}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Footer details */}
                  <View style={styles.docCardFooter}>
                    {doc.docNumber ? (
                      <Text style={styles.docNumberText}>
                        {t('doc_hub.no_label', { num: doc.docNumber })}
                      </Text>
                    ) : (
                      <Text style={styles.docNumberText}>
                        {t('doc_hub.cat_label', { cat: doc.category })}
                      </Text>
                    )}
                    <View style={styles.expiryRow}>
                      <Clock size={12} color={styles.placeholder.color} />
                      <Text style={styles.expiryDateText}>
                        {t('doc_hub.expires_label', { date: doc.expiryDate })}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      <ModernBottomNav activeTab="vault" onTabPress={handleNavPress} />
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
      backgroundColor: colors.navBackground || colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.navBorder || colors.border,
      ...shadow.soft,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.glassSurface || colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
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
    addNavBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow.soft,
    },
    headerTitle: {
      fontFamily: fonts.serif,
      fontSize: 18,
      color: colors.textPrimary,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    searchBarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.glassSurface || colors.surface,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.glassBorder || colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: Platform.OS === 'ios' ? 10 : 4,
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
    searchIcon: {
      marginRight: 8,
    },
    alertTextGroup: {
      flex: 1,
    },
    alertBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.card || 18,
      borderWidth: 1,
      borderColor: colors.dangerBorder || colors.danger,
      padding: spacing.md,
      marginBottom: spacing.md,
      ...shadow.soft,
    },
    alertBannerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: spacing.sm,
      gap: 10,
    },
    alertIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.dangerSoft || colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    alertTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.danger,
    },
    alertSub: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    categoriesContainer: {
      paddingBottom: spacing.md,
      gap: 8,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.glassSurface || colors.surface,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 6,
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
      fontSize: 12,
      color: colors.textPrimary,
    },
    chipTextActive: {
      color: colors.textOnPrimary,
      fontFamily: fonts.sansBold,
    },
    loadingContainer: {
      paddingVertical: spacing.xxl,
      alignItems: 'center',
    },
    docCard: {
      backgroundColor: colors.glassSurface || colors.surface,
      borderRadius: radius.card || 20,
      borderWidth: 1,
      borderColor: colors.glassBorder || colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
      ...shadow.soft,
    },
    docCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    docIconBadge: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.blush || colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    docMainInfo: {
      flex: 1,
      marginRight: spacing.xs,
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
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    badgeExpired: { backgroundColor: colors.dangerSoft || colors.surfaceElevated },
    badgeExpiring: { backgroundColor: colors.turmericSoft || colors.surfaceElevated },
    badgeValid: { backgroundColor: colors.surfaceElevated },
    statusBadgeText: { fontFamily: fonts.sansBold, fontSize: 10 },
    textExpired: { color: colors.danger },
    textExpiring: { color: colors.turmeric || colors.primary },
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
      fontSize: 11,
      color: colors.textSecondary,
    },
    expiryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    expiryDateText: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textMuted,
    },
    emptyStateCard: {
      backgroundColor: colors.glassSurface || colors.surface,
      borderRadius: radius.card || 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xxl,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.md,
      ...shadow.soft,
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
