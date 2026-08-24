import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { LucideIcon } from 'lucide-react-native';
import {
  UsersRound,
  Droplets,
  PartyPopper,
  CarFront,
  ArrowLeft,
  ChevronRight,
  Info,
} from 'lucide-react-native';
import type { RootStackParamList } from '../../app/_layout';
import SectionHeader from '../../components/SectionHeader';
import BottomSheet from '../../components/BottomSheet';
import Button from '../../components/Button';
import useThemedStyles from '../../hooks/useThemedStyles';
import useResponsive from '../../hooks/useResponsive';
import { subscribeToLanguageChanges, t } from '../../i18n';
import type { ThemeTokens } from '../../theme';

type Props = StackScreenProps<RootStackParamList, 'HouseholdOperations'>;

interface SectionItem {
  id: 'caregiver' | 'resources' | 'events' | 'assets';
  title: string;
  subtitle: string;
  description: string;
  tag: string;
  tagColor: string;
  Icon: LucideIcon;
}

export default function HouseholdOperationsScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { isExpanded, contentMaxWidth } = useResponsive();
  const [localeVersion, setLocaleVersion] = useState(0);
  const [infoSection, setInfoSection] = useState<SectionItem | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToLanguageChanges(() =>
      setLocaleVersion(version => version + 1),
    );
    return () => {
      unsubscribe();
    };
  }, []);

  const sections: SectionItem[] = [
    {
      id: 'caregiver',
      title: t('household.caregiver_title'),
      subtitle: t('household.caregiver_highlight_staff'),
      description: 'Manage household staff profiles, daily attendance, emergency contacts, shifts, and caregiver coordination.',
      tag: 'Staff',
      tagColor: '#6366F1',
      Icon: UsersRound,
    },
    {
      id: 'resources',
      title: t('household.resources_title'),
      subtitle: t('household.resources_highlight_deliveries'),
      description: 'Quick-tap logging for daily supplies, water cans, LPG cylinders, delivery logs, and household utility refills.',
      tag: 'Deliveries',
      tagColor: '#0070F3',
      Icon: Droplets,
    },
    {
      id: 'events',
      title: t('household.events_title'),
      subtitle: t('household.events_highlight_budget'),
      description: 'Organize family celebrations, birthdays, weddings, track shared event budgets, vendor expenses, and milestones.',
      tag: 'Events',
      tagColor: '#F97316',
      Icon: PartyPopper,
    },
    {
      id: 'assets',
      title: t('household.assets_title'),
      subtitle: t('household.assets_highlight_vehicle'),
      description: 'Maintain vehicle records, fuel log tracking, odometer readings, appliance warranty radars, and service schedules.',
      tag: 'Assets',
      tagColor: '#F59E0B',
      Icon: CarFront,
    },
  ];

  const handleSectionPress = (id: 'caregiver' | 'resources' | 'events' | 'assets') => {
    if (id === 'caregiver') navigation.navigate('Staff');
    else if (id === 'resources') navigation.navigate('Resources');
    else if (id === 'events') navigation.navigate('EventBudgets');
    else if (id === 'assets') navigation.navigate('Vehicles');
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
            accessibilityLabel={t('household.back')}
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
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={maxContentStyle}>
          <SectionHeader
            title={t('household.domains_title')}
            subtitle={t('household.domains_subtitle')}
          />

          <View style={styles.grid}>
            {sections.map((section) => (
              <Pressable
                key={section.id}
                style={({ pressed }) => [styles.bentoCard, pressed && styles.bentoCardPressed]}
                onPress={() => handleSectionPress(section.id)}
              >
                {/* Top Row: Icon Box + Status Tag + Info Button */}
                <View style={styles.bentoCardTop}>
                  <View style={styles.bentoIconBox}>
                    <section.Icon size={18} color="#000000" strokeWidth={1.5} />
                  </View>
                  <View style={styles.bentoTopRight}>
                    <View style={styles.bentoTag}>
                      <Text style={[styles.bentoTagText, { color: section.tagColor }]}>
                        {section.tag}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Info for ${section.title}`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.bentoInfoBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        setInfoSection(section);
                      }}
                    >
                      <Info size={13} color="#888888" strokeWidth={1.8} />
                    </Pressable>
                  </View>
                </View>

                {/* Bottom Content: Clean Title, Subtitle + Thin Black Arrow */}
                <View style={styles.bentoCardBottom}>
                  <View style={styles.bentoTextGroup}>
                    <Text style={styles.bentoTitle} numberOfLines={2}>
                      {section.title}
                    </Text>
                    <Text style={styles.bentoSubtitle} numberOfLines={2}>
                      {section.subtitle}
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#000000" strokeWidth={1.3} />
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Info BottomSheet */}
      <BottomSheet
        visible={!!infoSection}
        onClose={() => setInfoSection(null)}
        title={infoSection?.title || 'Workspace Info'}
      >
        {infoSection && (
          <View style={styles.infoSheetContent}>
            <View style={styles.infoSheetHeader}>
              <View style={styles.infoSheetIconBox}>
                <infoSection.Icon size={22} color="#000000" strokeWidth={1.5} />
              </View>
              <View style={styles.infoSheetHeaderText}>
                <Text style={styles.infoSheetTitle}>{infoSection.title}</Text>
                <View style={[styles.bentoTag, { alignSelf: 'flex-start', marginTop: 4 }]}>
                  <Text style={[styles.bentoTagText, { color: infoSection.tagColor }]}>
                    {infoSection.tag}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.infoSheetSubTitle}>{infoSection.subtitle}</Text>
            <Text style={styles.infoSheetDesc}>{infoSection.description}</Text>

            <Button
              title={`Open ${infoSection.title}`}
              onPress={() => {
                const sec = infoSection;
                setInfoSection(null);
                handleSectionPress(sec.id);
              }}
              style={styles.infoSheetCta}
            />
          </View>
        )}
      </BottomSheet>
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
    bentoCard: {
      width: '48%',
      backgroundColor: '#FFFFFF',
      borderRadius: radius.card,
      padding: spacing.md,
      minHeight: 114,
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: '#ECECEE',
      ...shadow.soft,
    },
    bentoCardPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.98 }],
    },
    bentoCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    bentoIconBox: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: '#F5F5F7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bentoTopRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    bentoTag: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.pill,
      backgroundColor: '#F5F5F7',
    },
    bentoTagText: {
      fontFamily: fonts.sans,
      fontSize: 9,
      fontWeight: '500',
    },
    bentoInfoBtn: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#F5F5F7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bentoCardBottom: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    bentoTextGroup: {
      flex: 1,
      marginRight: 4,
    },
    bentoTitle: {
      fontFamily: fonts.sans,
      fontSize: 13,
      fontWeight: '600',
      color: '#000000',
      lineHeight: 17,
    },
    bentoSubtitle: {
      fontFamily: fonts.sans,
      fontSize: 10,
      fontWeight: '300',
      color: '#888888',
      marginTop: 2,
      lineHeight: 13,
    },
    infoSheetContent: {
      paddingBottom: spacing.lg,
    },
    infoSheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: spacing.md,
    },
    infoSheetIconBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: '#F5F5F7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoSheetHeaderText: {
      flex: 1,
    },
    infoSheetTitle: {
      fontFamily: fonts.sans,
      fontSize: 17,
      fontWeight: '600',
      color: '#000000',
    },
    infoSheetSubTitle: {
      fontFamily: fonts.sans,
      fontSize: 13,
      fontWeight: '500',
      color: '#444444',
      marginBottom: spacing.sm,
    },
    infoSheetDesc: {
      fontFamily: fonts.sans,
      fontSize: 13,
      fontWeight: '300',
      color: '#666666',
      lineHeight: 20,
      marginBottom: spacing.lg,
    },
    infoSheetCta: {
      marginTop: spacing.xs,
    },
  });
