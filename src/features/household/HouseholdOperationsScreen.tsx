import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { LucideIcon } from 'lucide-react-native';
import UsersRound from 'lucide-react-native/icons/users-round';
import Droplets from 'lucide-react-native/icons/droplets';
import PartyPopper from 'lucide-react-native/icons/party-popper';
import CarFront from 'lucide-react-native/icons/car-front';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Sparkles from 'lucide-react-native/icons/sparkles';
import type { RootStackParamList } from '../../app/_layout';
import Card from '../../components/Card';
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
    const unsubscribe = subscribeToLanguageChanges(() => setLocaleVersion((version) => version + 1));
    return () => {
      unsubscribe();
    };
  }, []);

  const sections: { id: 'caregiver' | 'resources' | 'events' | 'assets'; title: string; description: string; highlights: string[]; Icon: LucideIcon }[] = [
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

  return (
    <View key={localeVersion} style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('household.back')}
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={styles.backIcon.color} strokeWidth={1.8} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('household.header_title')}</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Sparkles size={22} color={styles.heroIconColor.color} strokeWidth={1.8} />
          </View>
          <Text style={styles.heroTitle}>{t('household.hero_title')}</Text>
          <Text style={styles.heroDescription}>{t('household.hero_description')}</Text>
        </View>

        <SectionHeader title={t('household.sections_title')} subtitle={t('household.sections_subtitle')} />

        <View style={styles.cards}>
          {sections.map(({ id, title, description, highlights, Icon }) => (
            <Card key={id} style={styles.card} onPress={() => id === 'caregiver' ? navigation.navigate('Staff') : id === 'resources' ? navigation.navigate('Resources') : navigation.navigate('HouseholdArea', { area: id })}>
              <View style={styles.cardTopRow}>
                <View style={styles.sectionIcon}>
                  <Icon size={21} color={styles.sectionIconColor.color} strokeWidth={1.8} />
                </View>
              </View>
              <Text style={styles.cardTitle}>{title}</Text>
              <Text style={styles.cardDescription}>{description}</Text>
              <View style={styles.highlightList}>
                {highlights.map((highlight) => (
                  <View key={highlight} style={styles.highlightRow}>
                    <View style={styles.highlightDot} />
                    <Text style={styles.highlightText}>{highlight}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.openWorkspace}>{t('household.open_workspace')}</Text>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors, fonts, spacing }: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  backIcon: { color: colors.textPrimary },
  headerTitle: { marginLeft: spacing.md, fontFamily: fonts.serif, fontSize: 22, color: colors.textPrimary },
  content: { padding: spacing.lg },
  hero: { marginBottom: spacing.xl },
  heroIcon: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.blush, marginBottom: spacing.md,
  },
  heroIconColor: { color: colors.primary },
  heroTitle: { fontFamily: fonts.serif, fontSize: 28, color: colors.textPrimary, marginBottom: 6 },
  heroDescription: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  cards: { gap: spacing.md },
  card: { padding: spacing.lg },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  sectionIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blush },
  sectionIconColor: { color: colors.primary },
  cardTitle: { fontFamily: fonts.serif, fontSize: 20, color: colors.textPrimary, marginBottom: 4 },
  cardDescription: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  highlightList: { marginTop: spacing.md, gap: 7 },
  highlightRow: { flexDirection: 'row', alignItems: 'center' },
  highlightDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.turmeric, marginRight: spacing.sm },
  highlightText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textPrimary },
  openWorkspace: { marginTop: spacing.md, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.primary },
});
