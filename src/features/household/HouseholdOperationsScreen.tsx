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
import type { RootStackParamList } from '../../app/_layout';
import SectionHeader from '../../components/SectionHeader';
import useThemedStyles from '../../hooks/useThemedStyles';
import { subscribeToLanguageChanges, t } from '../../i18n';
import type { ThemeTokens } from '../../theme';

type Props = StackScreenProps<RootStackParamList, 'HouseholdOperations'>;

export default function HouseholdOperationsScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
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
    tint: string;
    tintSoft: string;
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
      tint: '#2E7D5B',
      tintSoft: '#E3F3EA',
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
      tint: '#1D7FBF',
      tintSoft: '#E1F1FB',
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
      tint: '#C24F8E',
      tintSoft: '#FAE6F0',
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
      tint: '#C7791E',
      tintSoft: '#FBEBDA',
    },
  ];

  return (
    <View key={localeVersion} style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('household.back')}
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft
            size={20}
            color={styles.backIcon.color}
            strokeWidth={1.8}
          />
        </Pressable>
        <Text style={styles.headerTitle}>{t('household.header_title')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader
          title={t('household.sections_title')}
          subtitle={t('household.sections_subtitle')}
        />

        <View style={styles.grid}>
          {sections.map(({ id, title, description, highlights, Icon, tint, tintSoft }) => (
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
                <View style={[styles.tileIcon, { backgroundColor: tintSoft }]}>
                  <Icon size={26} color={tint} strokeWidth={2.4} />
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
                  <Info size={16} color={styles.infoIconColor.color} strokeWidth={2} />
                </Pressable>
              </View>
              <Text style={styles.tileTitle} numberOfLines={2}>
                {title}
              </Text>
              <View style={[styles.tileOpenBtn, { backgroundColor: tintSoft }]}>
                <Text style={[styles.tileOpenBtnText, { color: tint }]}>
                  {t('household.open_workspace')}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors, fonts, spacing }: ThemeTokens) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    backIcon: { color: colors.textPrimary },
    headerTitle: {
      marginLeft: spacing.md,
      fontFamily: fonts.serif,
      fontSize: 22,
      color: colors.textPrimary,
    },
    content: { padding: spacing.lg },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    tile: {
      width: '47%',
      minHeight: 168,
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 1,
      justifyContent: 'space-between',
    },
    tilePressed: {
      opacity: 0.9,
      transform: [{ scale: 0.98 }],
    },
    tileTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    tileIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoIconColor: { color: colors.textMuted },
    tileTitle: {
      flex: 1,
      fontFamily: fonts.serif,
      fontWeight: '700',
      fontSize: 17,
      color: colors.textPrimary,
    },
    tileOpenBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      paddingVertical: 9,
      marginTop: spacing.md,
    },
    tileOpenBtnText: {
      fontFamily: fonts.sansBold,
      fontWeight: '700',
      fontSize: 13,
    },
  });
