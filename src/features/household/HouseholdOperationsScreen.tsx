import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { LucideIcon } from 'lucide-react-native';
import UsersRound from 'lucide-react-native/icons/users-round';
import Droplets from 'lucide-react-native/icons/droplets';
import PartyPopper from 'lucide-react-native/icons/party-popper';
import CarFront from 'lucide-react-native/icons/car-front';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Info from 'lucide-react-native/icons/info';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import type { RootStackParamList } from '../../app/_layout';
import SectionHeader from '../../components/SectionHeader';
import ModernBottomNav, { type BottomNavTab } from '../../components/ModernBottomNav';
import useThemedStyles from '../../hooks/useThemedStyles';
import useResponsive from '../../hooks/useResponsive';
import { subscribeToLanguageChanges, t } from '../../i18n';
import type { ThemeTokens } from '../../theme';

type Props = StackScreenProps<RootStackParamList, 'HouseholdOperations'>;

export default function HouseholdOperationsScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { isExpanded, contentMaxWidth } = useResponsive();
  const [localeVersion, setLocaleVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToLanguageChanges(() =>
      setLocaleVersion(version => version + 1),
    );
    return () => {
      unsubscribe();
    };
  }, []);

  const sections: {
    id: 'caregiver' | 'resources' | 'events' | 'assets';
    title: string;
    description: string;
    highlights: string[];
    Icon: LucideIcon;
  }[] = [
    {
      id: 'caregiver',
      title: t('household.caregiver_title'),
      description: t('household.caregiver_description'),
      highlights: [
        t('household.caregiver_highlight_staff'),
        t('household.caregiver_highlight_attendance'),
        t('household.caregiver_highlight_pay'),
      ],
      Icon: UsersRound,
    },
    {
      id: 'resources',
      title: t('household.resources_title'),
      description: t('household.resources_description'),
      highlights: [
        t('household.resources_highlight_deliveries'),
        t('household.resources_highlight_quick_tap'),
        t('household.resources_highlight_bills'),
      ],
      Icon: Droplets,
    },
    {
      id: 'events',
      title: t('household.events_title'),
      description: t('household.events_description'),
      highlights: [
        t('household.events_highlight_folders'),
        t('household.events_highlight_budget'),
        t('household.events_highlight_calendar'),
      ],
      Icon: PartyPopper,
    },
    {
      id: 'assets',
      title: t('household.assets_title'),
      description: t('household.assets_description'),
      highlights: [
        t('household.assets_highlight_vehicle'),
        t('household.assets_highlight_warranties'),
        t('household.assets_highlight_maintenance'),
      ],
      Icon: CarFront,
    },
  ];

  const handleNavPress = (tab: BottomNavTab) => {
    if (tab === 'home') navigation.navigate('Dashboard');
    else if (tab === 'life') navigation.navigate('SmartLife');
    else if (tab === 'center') navigation.navigate('Voice');
    else if (tab === 'health') navigation.navigate('Medicine');
    else if (tab === 'vault') navigation.navigate('DocHub');
  };

  const maxContentStyle = isExpanded
    ? { maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as const }
    : { width: '100%' as const };

  return (
    <View key={localeVersion} style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.headerContent, maxContentStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <ArrowLeft size={18} color="#000000" strokeWidth={1.5} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('household.operations_title')}</Text>
          <View style={styles.backButtonPlaceholder} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={maxContentStyle}>
          <SectionHeader
            title={t('household.domains_title')}
            subtitle={t('household.domains_subtitle')}
          />

          <View style={styles.grid}>
            {sections.map(({ id, title, description, highlights, Icon }) => (
              <Pressable
                key={id}
                style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
                onPress={() =>
                  id === 'caregiver'
                    ? navigation.navigate('Staff')
                    : id === 'resources'
                    ? navigation.navigate('Resources')
                    : id === 'events'
                    ? navigation.navigate('EventBudgets')
                    : id === 'assets'
                    ? navigation.navigate('Vehicles')
                    : navigation.navigate('HouseholdArea', { area: id })
                }
              >
                <View style={styles.tileTopRow}>
                  <View style={styles.tileIcon}>
                    <Icon size={20} color="#000000" strokeWidth={1.5} />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={title}
                    hitSlop={10}
                    onPress={(e) => {
                      e.stopPropagation();
                      Alert.alert(title, [description, ...highlights.map((h) => `• ${h}`)].join('\n'));
                    }}
                    style={styles.infoButton}
                  >
                    <Info size={14} color="#888888" strokeWidth={1.5} />
                  </Pressable>
                </View>
                <Text style={styles.tileTitle} numberOfLines={2}>
                  {title}
                </Text>
                <View style={styles.tileBottomRow}>
                  <Text style={styles.tileOpenBtnText}>
                    {t('household.open_workspace')}
                  </Text>
                  <ChevronRight size={14} color="#000000" strokeWidth={1.3} />
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Solid Black Minimalist Bottom Navigation Bar */}
      <ModernBottomNav
        activeTab="life"
        onTabPress={handleNavPress}
        badgeCounts={{ health: 2 }}
      />
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      backgroundColor: '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: '#ECECEE',
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F5F5F7',
      borderWidth: 1,
      borderColor: '#EAEAEA',
    },
    backButtonPlaceholder: {
      width: 36,
    },
    headerTitle: {
      fontFamily: fonts.sans,
      fontSize: 16,
      fontWeight: '600',
      color: '#000000',
    },
    content: { padding: spacing.lg },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      justifyContent: 'space-between',
    },
    tile: {
      width: '48%',
      minHeight: 140,
      backgroundColor: '#FFFFFF',
      borderRadius: radius.card,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: '#ECECEE',
      ...shadow.soft,
      justifyContent: 'space-between',
    },
    tilePressed: {
      opacity: 0.7,
      transform: [{ scale: 0.98 }],
    },
    tileTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    tileIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: '#F5F5F7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoButton: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F5F5F7',
    },
    tileTitle: {
      fontFamily: fonts.sans,
      fontWeight: '500',
      fontSize: 14,
      color: '#000000',
    },
    tileBottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
    },
    tileOpenBtnText: {
      fontFamily: fonts.sans,
      fontWeight: '400',
      fontSize: 11,
      color: '#555555',
    },
  });
