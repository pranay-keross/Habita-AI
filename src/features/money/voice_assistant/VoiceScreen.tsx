import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Settings from 'lucide-react-native/icons/settings';
import Mic from 'lucide-react-native/icons/mic';
import Sparkles from 'lucide-react-native/icons/sparkles';
import IndianRupee from 'lucide-react-native/icons/indian-rupee';
import Package from 'lucide-react-native/icons/package';
import Bell from 'lucide-react-native/icons/bell';
import Users from 'lucide-react-native/icons/users';
import Wallet from 'lucide-react-native/icons/wallet';
import ChartPie from 'lucide-react-native/icons/chart-pie';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import FilePlus from 'lucide-react-native/icons/file-plus';
import User from 'lucide-react-native/icons/user';
import CircleX from 'lucide-react-native/icons/circle-x';
import { loadVoiceHistory, saveVoiceHistory } from './voiceStore';
import type { VoiceIntent } from './types';
import { subscribeToLanguageChanges, t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'Voice'>;
type ScreenState = 'default' | 'listening' | 'confirm' | 'history';
type HistoryFilter = 'all' | 'completed' | 'failed';

interface SuggestionChip {
  id: string;
  iconType: 'rupee' | 'package' | 'bell';
  textKey: string;
}

const SUGGESTIONS: SuggestionChip[] = [
  { id: 's1', iconType: 'rupee', textKey: 'voice_assistant.suggestion_1' },
  { id: 's2', iconType: 'package', textKey: 'voice_assistant.suggestion_2' },
  { id: 's3', iconType: 'bell', textKey: 'voice_assistant.suggestion_3' },
];

interface QuickAskCategory {
  id: string;
  titleKey: string;
  title: string;
  icon: React.ComponentType<{ size: number; color: string }>;
}

const WHAT_YOU_CAN_ASK: QuickAskCategory[] = [
  { id: 'c1', titleKey: 'voice_assistant.cat_groups', title: 'Groups', icon: Users },
  { id: 'c2', titleKey: 'voice_assistant.cat_expenses', title: 'Expenses', icon: FilePlus },
  { id: 'c3', titleKey: 'voice_assistant.cat_spending', title: 'Spending', icon: ChartPie },
  { id: 'c4', titleKey: 'voice_assistant.cat_bills', title: 'Bills', icon: Bell },
  { id: 'c5', titleKey: 'voice_assistant.cat_inventory', title: 'Inventory', icon: Package },
  { id: 'c6', titleKey: 'voice_assistant.cat_contacts', title: 'Contacts', icon: User },
];

interface CommandHistoryItem {
  id: string;
  transcriptKey: string;
  moduleKey: string;
  timeStr: string;
  status: 'completed' | 'failed';
  icon: React.ComponentType<{ size: number; color: string }>;
}

const HISTORY_DATA: CommandHistoryItem[] = [
  {
    id: 'h1',
    transcriptKey: 'voice_assistant.history_cmd_1',
    moduleKey: 'voice_assistant.mod_expense_groups',
    timeStr: '10:30 AM',
    status: 'completed',
    icon: Users,
  },
  {
    id: 'h2',
    transcriptKey: 'voice_assistant.history_cmd_2',
    moduleKey: 'voice_assistant.mod_add_expense',
    timeStr: '10:15 AM',
    status: 'completed',
    icon: Wallet,
  },
  {
    id: 'h3',
    transcriptKey: 'voice_assistant.history_cmd_3',
    moduleKey: 'voice_assistant.mod_bills_reminders',
    timeStr: '10:00 AM',
    status: 'completed',
    icon: Bell,
  },
  {
    id: 'h4',
    transcriptKey: 'voice_assistant.history_cmd_4',
    moduleKey: 'voice_assistant.mod_expense_summary',
    timeStr: 'Yesterday',
    status: 'completed',
    icon: ChartPie,
  },
  {
    id: 'h5',
    transcriptKey: 'voice_assistant.history_cmd_5',
    moduleKey: 'voice_assistant.mod_inventory_stock',
    timeStr: 'Yesterday',
    status: 'completed',
    icon: Package,
  },
  {
    id: 'h6',
    transcriptKey: 'voice_assistant.history_cmd_6',
    moduleKey: 'voice_assistant.mod_system_orchestrator',
    timeStr: '3 days ago',
    status: 'failed',
    icon: Mic,
  },
];

export default function VoiceScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [, setLocaleVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    return () => {
      unsubscribe();
    };
  }, []);

  const [screenState, setScreenState] = useState<ScreenState>('default');
  const [activeQuery, setActiveQuery] = useState(t('voice_assistant.history_cmd_1'));
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');

  const [pulseAnim] = useState(new Animated.Value(1));
  const [dotAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (screenState === 'listening') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(dotAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(dotAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
      dotAnim.setValue(0);
    }
  }, [screenState, pulseAnim, dotAnim]);

  const handleStartListening = (initialText?: string) => {
    if (initialText) {
      setActiveQuery(initialText);
    } else {
      setActiveQuery(t('voice_assistant.listening_sub'));
    }
    setScreenState('listening');
  };

  const handleStopListening = () => {
    setScreenState('confirm');
  };

  const filteredHistory = HISTORY_DATA.filter((item) => {
    if (historyFilter === 'all') return true;
    return item.status === historyFilter;
  });

  const bottomPadding = Math.max(insets.bottom + 100, 110);

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => {
            if (screenState !== 'default') {
              setScreenState('default');
            } else {
              navigation.goBack();
            }
          }}
          style={styles.headerBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {screenState === 'listening'
            ? t('voice_assistant.listening')
            : screenState === 'confirm'
              ? t('voice_assistant.confirm_command')
              : screenState === 'history'
                ? t('voice_assistant.history_title')
                : t('voice_assistant.header_title')}
        </Text>
        <Pressable
          onPress={() => navigation.navigate('VoiceSettings')}
          style={styles.headerBtn}>
          <Settings size={20} color={styles.headerIcon.color} />
        </Pressable>
      </View>

      {/* STATE 01: DEFAULT DASHBOARD */}
      {screenState === 'default' && (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}>
          {/* Default Hero Card */}
          <View style={styles.defaultHeroCard}>
            <View style={styles.defaultHeroLeft}>
              <View style={styles.heroMicIconCircle}>
                <Mic size={22} color={styles.defaultHeroTitle.color} />
              </View>
            </View>
            <View style={styles.defaultHeroRight}>
              <Text style={styles.defaultHeroHelp}>{t('voice_assistant.header_title')}</Text>
              <Text style={styles.defaultHeroTitle}>
                {t('voice_assistant.listening_sub')}
              </Text>
              <Pressable
                style={styles.heroTapPillBtn}
                onPress={() => handleStartListening()}>
                <Text style={styles.heroTapPillText}>{t('voice_assistant.tap_to_speak')}</Text>
              </Pressable>
            </View>
          </View>

          {/* Try saying */}
          <View style={styles.sectionHeader}>
            <Sparkles size={18} color={styles.viewAllText.color} />
            <Text style={styles.sectionTitleSparkle}>{t('voice_assistant.try_saying')}</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionsContainer}>
            {SUGGESTIONS.map((chip) => {
              const textVal = t(chip.textKey);
              return (
                <Pressable
                  key={chip.id}
                  style={styles.suggestionChip}
                  onPress={() => handleStartListening(textVal)}>
                  <View style={styles.chipIconBadge}>
                    {chip.iconType === 'rupee' && <IndianRupee size={14} color={styles.viewAllText.color} />}
                    {chip.iconType === 'package' && <Package size={14} color={styles.viewAllText.color} />}
                    {chip.iconType === 'bell' && <Bell size={14} color={styles.viewAllText.color} />}
                  </View>
                  <Text style={styles.chipText}>"{textVal}"</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Recent Commands */}
          <View style={styles.recentHeaderRow}>
            <Text style={styles.sectionTitle}>{t('voice_assistant.recent_history')}</Text>
            <Pressable
              onPress={() => setScreenState('history')}
              style={styles.viewAllBtn}>
              <Text style={styles.viewAllText}>{t('voice_assistant.all')}</Text>
              <ChevronRight size={14} color={styles.viewAllText.color} />
            </Pressable>
          </View>

          <View style={styles.recentCardContainer}>
            {HISTORY_DATA.slice(0, 3).map((item, idx) => {
              const IconComp = item.icon;
              const transcriptText = t(item.transcriptKey);
              const moduleText = t(item.moduleKey);
              return (
                <React.Fragment key={item.id}>
                  {idx > 0 && <View style={styles.divider} />}
                  <Pressable
                    style={styles.recentRow}
                    onPress={() => {
                      setActiveQuery(transcriptText);
                      setScreenState('confirm');
                    }}>
                    <View style={styles.recentIconBadge}>
                      <IconComp size={18} color={styles.viewAllText.color} />
                    </View>
                    <View style={styles.recentTextWrap}>
                      <Text style={styles.recentTitle} numberOfLines={1}>
                        {transcriptText}
                      </Text>
                      <Text style={styles.recentSubtitle}>{moduleText}</Text>
                    </View>
                    <View style={styles.recentRightWrap}>
                      <Text style={styles.recentTime}>{item.timeStr}</Text>
                      <CircleCheck size={16} color={styles.detailValHighlight.color} />
                    </View>
                  </Pressable>
                </React.Fragment>
              );
            })}
          </View>

          {/* What you can ask */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{t('voice_assistant.what_you_can_ask')}</Text>
          <View style={styles.categoriesGrid}>
            {WHAT_YOU_CAN_ASK.map((cat) => {
              const IconComponent = cat.icon;
              const titleText = t(cat.titleKey) || cat.title;
              return (
                <Pressable
                  key={cat.id}
                  style={styles.categoryCard}
                  onPress={() => handleStartListening(t('voice_assistant.help_with_topic', { topic: titleText }))}>
                  <View style={styles.categoryIconBadge}>
                    <IconComponent size={22} color={styles.viewAllText.color} />
                  </View>
                  <Text style={styles.categoryTitle}>{titleText}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* STATE 02: VOICE LISTENING */}
      {screenState === 'listening' && (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}>
          {/* Expanded Listening Hero Card */}
          <View style={styles.listeningHeroCard}>
            <Animated.View
              style={[
                styles.listeningMicPulseOuter,
                { transform: [{ scale: pulseAnim }] },
              ]}>
              <View style={styles.listeningMicPulseInner}>
                <View style={styles.listeningMicCore}>
                  <Mic size={32} color={styles.defaultHeroTitle.color} />
                </View>
              </View>
            </Animated.View>

            <Text style={styles.listeningTitle}>{t('voice_assistant.listening')}</Text>
            <Text style={styles.listeningSub}>
              {t('voice_assistant.listening_sub')}
            </Text>
          </View>

          {/* Live Transcript Card */}
          <Text style={styles.stateSectionTitle}>{t('voice_assistant.live_transcript')}</Text>
          <View style={styles.liveTranscriptCard}>
            <Text style={styles.transcriptText}>"{activeQuery}"</Text>
            <View style={styles.soundDotsRow}>
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.soundDot,
                    {
                      opacity: dotAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [i % 2 === 0 ? 0.3 : 0.9, i % 2 === 0 ? 0.9 : 0.3],
                      }),
                    },
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Understanding Request Card */}
          <Text style={styles.stateSectionTitle}>{t('voice_assistant.understanding_request')}</Text>
          <View style={styles.understandingCard}>
            <Text style={styles.understandingIntentHeader}>{t('voice_assistant.intent_groups_balances')}</Text>
            <Text style={styles.understandingIntentSub}>{t('voice_assistant.home_rent_bills')}</Text>
          </View>

          {/* Bottom Control Buttons */}
          <View style={styles.listeningBtnRow}>
            <Pressable
              style={styles.cancelOutlineBtn}
              onPress={() => setScreenState('default')}>
              <Text style={styles.cancelOutlineBtnText}>{t('voice_assistant.cancel')}</Text>
            </Pressable>

            <Pressable
              style={styles.stopListeningBtn}
              onPress={handleStopListening}>
              <Text style={styles.stopListeningBtnText}>{t('voice_assistant.stop_listening')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      {/* STATE 03: CONFIRM ACTION */}
      {screenState === 'confirm' && (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.confirmSubtitle}>{t('voice_assistant.understood_request')}</Text>

          {/* Understood Intent Card */}
          <View style={styles.understoodCard}>
            <View style={styles.understoodIconBadge}>
              <Users size={20} color={styles.viewAllText.color} />
            </View>
            <View style={styles.understoodTextWrap}>
              <Text style={styles.understoodTitle}>"{activeQuery}"</Text>
              <Text style={styles.understoodIntentSub}>{t('voice_assistant.intent_view_balance')}</Text>
            </View>
          </View>

          {/* Action Details Table Card */}
          <Text style={styles.stateSectionTitle}>{t('voice_assistant.action_details')}</Text>
          <View style={styles.actionDetailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>{t('voice_assistant.module')}</Text>
              <Text style={styles.detailVal}>{t('voice_assistant.mod_expense_groups')}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>{t('voice_assistant.group')}</Text>
              <Text style={styles.detailVal}>{t('voice_assistant.home_rent_bills')}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>{t('voice_assistant.balance')}</Text>
              <Text style={styles.detailValHighlight}>
                ₹17,500
              </Text>
            </View>
            <Text style={styles.actionReadyText}>{t('voice_assistant.ready_to_open')}</Text>
          </View>

          {/* Bottom Action Buttons */}
          <View style={styles.listeningBtnRow}>
            <Pressable
              style={styles.cancelOutlineBtn}
              onPress={() => setScreenState('default')}>
              <Text style={styles.cancelOutlineBtnText}>{t('voice_assistant.cancel')}</Text>
            </Pressable>

            <Pressable
              style={styles.stopListeningBtn}
              onPress={() => {
                navigation.navigate('ExpenseGroups');
              }}>
              <Text style={styles.stopListeningBtnText}>{t('voice_assistant.open_details')}</Text>
            </Pressable>
          </View>

          {/* Completed Status Banner at bottom */}
          <View style={styles.completedToastBanner}>
            <View style={styles.completedToastHeader}>
              <CircleCheck size={18} color={styles.viewAllText.color} />
              <Text style={styles.completedToastTitle}>{t('voice_assistant.command_completed')}</Text>
            </View>
            <Text style={styles.completedToastSub}>
              {t('voice_assistant.ask_another')}
            </Text>
          </View>
        </ScrollView>
      )}

      {/* STATE 04: COMMAND HISTORY */}
      {screenState === 'history' && (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.historySubtitle}>{t('voice_assistant.history_sub')}</Text>

          {/* Filter Chips Bar */}
          <View style={styles.historyFilterBar}>
            {(['all', 'completed', 'failed'] as HistoryFilter[]).map((filterKey) => (
              <Pressable
                key={filterKey}
                style={[
                  styles.filterPill,
                  historyFilter === filterKey && styles.filterPillActive,
                ]}
                onPress={() => setHistoryFilter(filterKey)}>
                <Text
                  style={[
                    styles.filterPillText,
                    historyFilter === filterKey && styles.filterPillTextActive,
                  ]}>
                  {filterKey === 'all'
                    ? t('voice_assistant.all')
                    : filterKey === 'completed'
                      ? t('voice_assistant.completed')
                      : t('voice_assistant.failed')}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* History List */}
          <View style={styles.recentCardContainer}>
            {filteredHistory.map((item, idx) => {
              const IconComp = item.icon;
              const transcriptText = t(item.transcriptKey);
              const moduleText = t(item.moduleKey);
              return (
                <React.Fragment key={item.id}>
                  {idx > 0 && <View style={styles.divider} />}
                  <Pressable
                    style={styles.recentRow}
                    onPress={() => {
                      setActiveQuery(transcriptText);
                      setScreenState('confirm');
                    }}>
                    <View style={styles.recentIconBadge}>
                      <IconComp size={18} color={styles.viewAllText.color} />
                    </View>
                    <View style={styles.recentTextWrap}>
                      <Text style={styles.recentTitle} numberOfLines={1}>
                        {transcriptText}
                      </Text>
                      <Text style={styles.recentSubtitle}>{moduleText}</Text>
                    </View>
                    <View style={styles.recentRightWrap}>
                      <Text style={styles.recentTime}>{item.timeStr}</Text>
                      {item.status === 'completed' ? (
                        <CircleCheck size={16} color={styles.detailValHighlight.color} />
                      ) : (
                        <CircleX size={16} color={styles.dangerText.color} />
                      )}
                    </View>
                  </Pressable>
                </React.Fragment>
              );
            })}
          </View>

          {/* Footer Note */}
          <Text style={styles.historyFooterNote}>
            {t('voice_assistant.history_footer_note')}
          </Text>
        </ScrollView>
      )}

      {/* Floating Bottom Voice Mic Bar (rendered on Default state) */}
      {screenState === 'default' && (
        <View style={[styles.bottomVoiceBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.waveVisualizerRow}>
            <View style={styles.waveSideGroup}>
              {[10, 16, 24, 14, 20, 28, 12, 18].map((h, i) => (
                <View key={`l_${i}`} style={[styles.bottomWaveLine, { height: h }]} />
              ))}
            </View>

            <Pressable
              style={styles.mainMicButton}
              onPress={() => handleStartListening()}>
              <Mic size={26} color={styles.defaultHeroTitle.color} />
            </Pressable>

            <View style={styles.waveSideGroup}>
              {[18, 12, 28, 20, 14, 24, 16, 10].map((h, i) => (
                <View key={`r_${i}`} style={[styles.bottomWaveLine, { height: h }]} />
              ))}
            </View>
          </View>

          <Text style={styles.tapToSpeakLabel}>{t('voice_assistant.tap_to_speak')}</Text>
        </View>
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
    headerTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 18,
      color: colors.textPrimary,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: 120,
    },

    // DEFAULT HERO CARD
    defaultHeroCard: {
      backgroundColor: colors.primaryDark,
      borderRadius: 20,
      padding: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      ...shadow.medium,
    },
    defaultHeroLeft: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroMicIconCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    defaultHeroRight: {
      flex: 1,
    },
    defaultHeroHelp: {
      fontFamily: fonts.sansMedium,
      fontSize: 14,
      color: colors.textOnPrimaryAccent || '#38BDF8',
      marginBottom: 2,
    },
    defaultHeroTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: colors.textOnPrimary,
      lineHeight: 22,
      marginBottom: 10,
    },
    heroTapPillBtn: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 8,
      alignSelf: 'flex-start',
    },
    heroTapPillText: {
      fontFamily: fonts.sansBold,
      fontSize: 12.5,
      color: colors.primary,
    },

    // LISTENING STATE HERO
    listeningHeroCard: {
      backgroundColor: colors.primaryDark,
      borderRadius: 24,
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow.medium,
    },
    listeningMicPulseOuter: {
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    listeningMicPulseInner: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    listeningMicCore: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listeningTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 22,
      color: colors.textOnPrimary,
      marginBottom: 4,
    },
    listeningSub: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textOnPrimaryMuted,
      textAlign: 'center',
    },

    stateSectionTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    liveTranscriptCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadow.soft,
    },
    transcriptText: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
      marginBottom: 8,
    },
    soundDotsRow: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
    },
    soundDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    understandingCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 16,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    understandingIntentHeader: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.primary,
    },
    understandingIntentSub: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textPrimary,
      marginTop: 2,
    },
    listeningBtnRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: spacing.xl,
    },
    cancelOutlineBtn: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
    },
    cancelOutlineBtnText: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.textPrimary,
    },
    stopListeningBtn: {
      flex: 1.5,
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
    },
    stopListeningBtnText: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.textOnPrimary,
    },

    // CONFIRM STATE
    confirmSubtitle: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: colors.textPrimary,
      marginTop: spacing.xs,
      marginBottom: spacing.md,
    },
    understoodCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 16,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
    },
    understoodIconBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    understoodTextWrap: {
      flex: 1,
    },
    understoodTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.textPrimary,
    },
    understoodIntentSub: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.primary,
      marginTop: 2,
    },
    actionDetailsCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadow.soft,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    detailKey: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textSecondary,
    },
    detailVal: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textPrimary,
    },
    detailValHighlight: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.forest,
    },
    dangerText: {
      color: colors.danger,
    },
    detailDivider: {
      height: 1,
      backgroundColor: colors.border,
    },
    actionReadyText: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 10,
    },
    completedToastBanner: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 16,
      padding: spacing.md,
      marginTop: spacing.xl,
      borderWidth: 1,
      borderColor: colors.border,
    },
    completedToastHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2,
    },
    completedToastTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.primary,
    },
    completedToastSub: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
    },

    // HISTORY STATE
    historySubtitle: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: colors.textPrimary,
      marginTop: spacing.xs,
      marginBottom: spacing.md,
    },
    historyFilterBar: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: spacing.md,
    },
    filterPill: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    filterPillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterPillText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12.5,
      color: colors.textPrimary,
    },
    filterPillTextActive: {
      color: colors.textOnPrimary,
      fontFamily: fonts.sansBold,
    },
    historyFooterNote: {
      fontFamily: fonts.sans,
      fontSize: 11.5,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.xl,
      lineHeight: 16,
    },

    // SECTIONS & SHARED
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: spacing.sm,
    },
    sectionTitleSparkle: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: colors.textPrimary,
    },
    suggestionsContainer: {
      gap: 10,
      paddingRight: spacing.lg,
      marginBottom: spacing.lg,
    },
    suggestionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      ...shadow.soft,
    },
    chipIconBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipText: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textPrimary,
    },
    recentHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    sectionTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: colors.textPrimary,
    },
    viewAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    viewAllText: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.primary,
    },
    recentCardContainer: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 4,
      ...shadow.soft,
    },
    recentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 12,
    },
    recentIconBadge: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recentTextWrap: {
      flex: 1,
    },
    recentTitle: {
      fontFamily: fonts.sansMedium,
      fontSize: 14,
      color: colors.textPrimary,
    },
    recentSubtitle: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    recentRightWrap: {
      alignItems: 'flex-end',
      gap: 4,
    },
    recentTime: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textMuted,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: 14,
    },
    categoriesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: spacing.sm,
    },
    categoryCard: {
      width: '30.5%',
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 14,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow.soft,
    },
    categoryIconBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    categoryTitle: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.textPrimary,
      textAlign: 'center',
    },

    // FLOATING BOTTOM MIC
    bottomVoiceBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTopWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      paddingTop: 12,
      paddingHorizontal: spacing.lg,
      ...shadow.medium,
    },
    waveVisualizerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      width: '100%',
    },
    waveSideGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    bottomWaveLine: {
      width: 3,
      backgroundColor: colors.primary,
      borderRadius: 2,
    },
    mainMicButton: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow.medium,
    },
    tapToSpeakLabel: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.primary,
      marginTop: 6,
      marginBottom: 4,
    },
  });
//  });
