import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { LucideIcon } from 'lucide-react-native';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import UsersRound from 'lucide-react-native/icons/users-round';
import Droplets from 'lucide-react-native/icons/droplets';
import PartyPopper from 'lucide-react-native/icons/party-popper';
import CarFront from 'lucide-react-native/icons/car-front';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import type { RootStackParamList } from '../../app/_layout';
import Card from '../../components/Card';
import SectionHeader from '../../components/SectionHeader';
import useThemedStyles from '../../hooks/useThemedStyles';
import { subscribeToLanguageChanges, t } from '../../i18n';
import type { ThemeTokens } from '../../theme';

type Props = StackScreenProps<RootStackParamList, 'HouseholdArea'>;
type Area = Props['route']['params']['area'];

interface AreaContent {
  Icon: LucideIcon;
  title: string;
  description: string;
  metricValues: [string, string, string];
  metricLabels: [string, string, string];
  activity: [string, string, string];
}

export default function HouseholdAreaScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [localeVersion, setLocaleVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToLanguageChanges(() => setLocaleVersion((version) => version + 1));
    return () => { unsubscribe(); };
  }, []);

  const content: Record<Area, AreaContent> = {
    caregiver: {
      Icon: UsersRound, title: t('household.caregiver_title'), description: t('household.caregiver_description'),
      metricValues: ['4', '18', '₹8,400'],
      metricLabels: [t('household.caregiver_highlight_staff'), t('household.caregiver_highlight_attendance'), t('household.caregiver_highlight_pay')],
      activity: [t('household.caregiver_activity_one'), t('household.caregiver_activity_two'), t('household.caregiver_activity_three')],
    },
    resources: {
      Icon: Droplets, title: t('household.resources_title'), description: t('household.resources_description'),
      metricValues: ['12', '6', '₹3,250'],
      metricLabels: [t('household.resources_highlight_deliveries'), t('household.resources_highlight_quick_tap'), t('household.resources_highlight_bills')],
      activity: [t('household.resources_activity_one'), t('household.resources_activity_two'), t('household.resources_activity_three')],
    },
    events: {
      Icon: PartyPopper, title: t('household.events_title'), description: t('household.events_description'),
      metricValues: ['2', '₹18,000', '3'],
      metricLabels: [t('household.events_highlight_folders'), t('household.events_highlight_budget'), t('household.events_highlight_calendar')],
      activity: [t('household.events_activity_one'), t('household.events_activity_two'), t('household.events_activity_three')],
    },
    assets: {
      Icon: CarFront, title: t('household.assets_title'), description: t('household.assets_description'),
      metricValues: ['5', '2', '4'],
      metricLabels: [t('household.assets_highlight_vehicle'), t('household.assets_highlight_warranties'), t('household.assets_highlight_maintenance')],
      activity: [t('household.assets_activity_one'), t('household.assets_activity_two'), t('household.assets_activity_three')],
    },
  };
  const area = content[route.params.area];

  return (
    <View key={localeVersion} style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('household.back')} style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={styles.backIcon.color} strokeWidth={1.8} />
        </Pressable>
        <Text style={styles.headerTitle}>{area.title}</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]} showsVerticalScrollIndicator={false}>
        <Card style={styles.hero}>
          <View style={styles.heroIcon}><area.Icon size={24} color={styles.heroIconColor.color} strokeWidth={1.8} /></View>
          <Text style={styles.heroTitle}>{area.title}</Text>
          <Text style={styles.heroDescription}>{area.description}</Text>
        </Card>

        <SectionHeader title={t('household.workspace_overview')} subtitle={t('household.workspace_overview_subtitle')} style={styles.sectionHeader} />
        <View style={styles.metrics}>
          {area.metricValues.map((value, index) => (
            <Card key={area.metricLabels[index]} style={styles.metricCard}>
              <Text style={styles.metricValue}>{value}</Text>
              <Text style={styles.metricLabel}>{area.metricLabels[index]}</Text>
            </Card>
          ))}
        </View>

        <SectionHeader title={t('household.workspace_activity')} subtitle={t('household.workspace_activity_subtitle')} style={styles.sectionHeader} />
        <View style={styles.activityList}>
          {area.activity.map((item, index) => (
            <View key={item} style={[styles.activityRow, index === area.activity.length - 1 && styles.activityRowLast]}>
              <View style={styles.activityNumber}><Text style={styles.activityNumberText}>{index + 1}</Text></View>
              <Text style={styles.activityText}>{item}</Text>
              <ChevronRight size={18} color={styles.chevronColor.color} strokeWidth={1.75} />
            </View>
          ))}
        </View>

        <Card style={styles.workflowCard}>
          <Text style={styles.workflowTitle}>{t('household.workspace_workflow')}</Text>
          <Text style={styles.workflowDescription}>{t('household.workspace_workflow_description')}</Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  backIcon: { color: colors.textPrimary },
  headerTitle: { flex: 1, marginLeft: spacing.md, fontFamily: fonts.serif, fontSize: 21, color: colors.textPrimary },
  content: { padding: spacing.lg },
  hero: { backgroundColor: colors.surfaceElevated, marginBottom: spacing.xl },
  heroIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blush, marginBottom: spacing.md },
  heroIconColor: { color: colors.primary },
  heroTitle: { fontFamily: fonts.serif, fontSize: 26, color: colors.textPrimary, marginBottom: 6 },
  heroDescription: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  sectionHeader: { marginBottom: spacing.md },
  metrics: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  metricCard: { flex: 1, padding: spacing.md, minHeight: 116 },
  metricValue: { fontFamily: fonts.serif, fontSize: 21, color: colors.primary, marginBottom: spacing.sm },
  metricLabel: { fontFamily: fonts.sansMedium, fontSize: 11, lineHeight: 16, color: colors.textSecondary },
  activityList: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden', ...shadow.soft },
  activityRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  activityRowLast: { borderBottomWidth: 0 },
  activityNumber: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blush, marginRight: spacing.sm },
  activityNumberText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.primary },
  activityText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18, color: colors.textPrimary },
  chevronColor: { color: colors.textMuted },
  workflowCard: { marginTop: spacing.xl, backgroundColor: colors.surfaceElevated },
  workflowTitle: { fontFamily: fonts.serif, fontSize: 19, color: colors.textPrimary, marginBottom: 5 },
  workflowDescription: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, color: colors.textSecondary },
});
