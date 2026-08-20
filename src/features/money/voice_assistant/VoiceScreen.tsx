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
import { VOICE_COLORS } from './constants/colors';
import { subscribeToLanguageChanges, t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'Voice'>;
type ScreenState = 'default' | 'listening' | 'confirm' | 'history';
type HistoryFilter = 'all' | 'completed' | 'failed';

interface SuggestionChip {
  id: string;
  iconType: 'rupee' | 'package' | 'bell';
  text: string;
}

const SUGGESTIONS: SuggestionChip[] = [
  { id: 's1', iconType: 'rupee', text: 'Add ₹150 for dinner' },
  { id: 's2', iconType: 'package', text: 'Show group balance' },
  { id: 's3', iconType: 'bell', text: 'Remind me to pay electricity bill' },
];

interface QuickAskCategory {
  id: string;
  titleKey: string;
  title: string;
  bgColor: string;
  iconColor: string;
  icon: React.ComponentType<{ size: number; color: string }>;
}

const WHAT_YOU_CAN_ASK: QuickAskCategory[] = [
  { id: 'c1', titleKey: 'voice_assistant.cat_groups', title: 'Groups', bgColor: '#E3F2F5', iconColor: '#004F63', icon: Users },
  { id: 'c2', titleKey: 'voice_assistant.cat_expenses', title: 'Expenses', bgColor: '#DCFCE7', iconColor: '#16A34A', icon: FilePlus },
  { id: 'c3', titleKey: 'voice_assistant.cat_spending', title: 'Spending', bgColor: '#F3E8FF', iconColor: '#9333EA', icon: ChartPie },
  { id: 'c4', titleKey: 'voice_assistant.cat_bills', title: 'Bills', bgColor: '#FFEDD5', iconColor: '#EA580C', icon: Bell },
  { id: 'c5', titleKey: 'voice_assistant.cat_inventory', title: 'Inventory', bgColor: '#EFF6FF', iconColor: '#2563EB', icon: Package },
  { id: 'c6', titleKey: 'voice_assistant.cat_contacts', title: 'Contacts', bgColor: '#FEF3C7', iconColor: '#D97706', icon: User },
];

interface CommandHistoryItem {
  id: string;
  transcript: string;
  module: string;
  time: string;
  status: 'completed' | 'failed';
  icon: React.ComponentType<{ size: number; color: string }>;
  bgColor: string;
  iconColor: string;
}

const HISTORY_DATA: CommandHistoryItem[] = [
  {
    id: 'h1',
    transcript: 'Show my group balances',
    module: 'Expense Groups',
    time: '10:30 AM',
    status: 'completed',
    icon: Users,
    bgColor: '#E3F2F5',
    iconColor: '#004F63',
  },
  {
    id: 'h2',
    transcript: 'Add ₹500 for groceries',
    module: 'Add Expense',
    time: '10:15 AM',
    status: 'completed',
    icon: Wallet,
    bgColor: '#DCFCE7',
    iconColor: '#16A34A',
  },
  {
    id: 'h3',
    transcript: 'What bills are due this week?',
    module: 'Bills & Reminders',
    time: '10:00 AM',
    status: 'completed',
    icon: Bell,
    bgColor: '#FFEDD5',
    iconColor: '#EA580C',
  },
  {
    id: 'h4',
    transcript: 'How much did we spend in July?',
    module: 'Expense Summary',
    time: 'Yesterday',
    status: 'completed',
    icon: ChartPie,
    bgColor: '#F3E8FF',
    iconColor: '#9333EA',
  },
  {
    id: 'h5',
    transcript: 'Show low-stock items',
    module: 'Inventory & Stock',
    time: 'Yesterday',
    status: 'completed',
    icon: Package,
    bgColor: '#EFF6FF',
    iconColor: '#2563EB',
  },
  {
    id: 'h6',
    transcript: 'Sync unrecognized audio input',
    module: 'System Orchestrator',
    time: '3 days ago',
    status: 'failed',
    icon: Mic,
    bgColor: '#FEE2E2',
    iconColor: '#EF4444',
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
  const [activeQuery, setActiveQuery] = useState('Show my balance in Home Rent & Bills');
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

  const handleStartListening = (queryText?: string) => {
    if (queryText) {
      setActiveQuery(queryText);
    } else {
      setActiveQuery('Show my balance in Home Rent & Bills');
    }
    setScreenState('listening');
  };

  const handleStopListening = () => {
    setScreenState('confirm');
  };

  const filteredHistory = HISTORY_DATA.filter((item) => {
    if (historyFilter === 'completed') return item.status === 'completed';
    if (historyFilter === 'failed') return item.status === 'failed';
    return true;
  });

  const bottomPadding = Math.max(insets.bottom, 16) + 130;

  return (
    <View style={styles.root}>
      {/* Top Header Bar */}
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
          {screenState === 'confirm'
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
                <Mic size={22} color={VOICE_COLORS.textOnPrimary} />
              </View>
            </View>
            <View style={styles.defaultHeroRight}>
              <Text style={styles.defaultHeroHelp}>{t('voice_assistant.header_title')}</Text>
              <Text style={styles.defaultHeroTitle}>
                Ask about expenses, groups, bills, inventory, or reminders.
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
            <Sparkles size={18} color={VOICE_COLORS.primary} />
            <Text style={styles.sectionTitleSparkle}>{t('voice_assistant.try_saying')}</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionsContainer}>
            {SUGGESTIONS.map((chip) => (
              <Pressable
                key={chip.id}
                style={styles.suggestionChip}
                onPress={() => handleStartListening(chip.text)}>
                <View style={styles.chipIconBadge}>
                  {chip.iconType === 'rupee' && <IndianRupee size={14} color={VOICE_COLORS.accentBlue} />}
                  {chip.iconType === 'package' && <Package size={14} color={VOICE_COLORS.accentBlue} />}
                  {chip.iconType === 'bell' && <Bell size={14} color={VOICE_COLORS.accentBlue} />}
                </View>
                <Text style={styles.chipText}>"{chip.text}"</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Recent Commands */}
          <View style={styles.recentHeaderRow}>
            <Text style={styles.sectionTitle}>{t('voice_assistant.recent_history')}</Text>
            <Pressable
              onPress={() => setScreenState('history')}
              style={styles.viewAllBtn}>
              <Text style={styles.viewAllText}>{t('voice_assistant.all')}</Text>
              <ChevronRight size={14} color={VOICE_COLORS.accentBlue} />
            </Pressable>
          </View>

          <View style={styles.recentCardContainer}>
            {HISTORY_DATA.slice(0, 3).map((item, idx) => {
              const IconComp = item.icon;
              return (
                <React.Fragment key={item.id}>
                  {idx > 0 && <View style={styles.divider} />}
                  <Pressable
                    style={styles.recentRow}
                    onPress={() => {
                      setActiveQuery(item.transcript);
                      setScreenState('confirm');
                    }}>
                    <View style={[styles.recentIconBadge, { backgroundColor: item.bgColor }]}>
                      <IconComp size={18} color={item.iconColor} />
                    </View>
                    <View style={styles.recentTextWrap}>
                      <Text style={styles.recentTitle} numberOfLines={1}>
                        {item.transcript}
                      </Text>
                      <Text style={styles.recentSubtitle}>{item.module}</Text>
                    </View>
                    <View style={styles.recentRightWrap}>
                      <Text style={styles.recentTime}>{item.time}</Text>
                      <CircleCheck size={16} color={VOICE_COLORS.successGreen} />
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
                  onPress={() => handleStartListening(`Help with ${titleText}`)}>
                  <View style={[styles.categoryIconBadge, { backgroundColor: cat.bgColor }]}>
                    <IconComponent size={22} color={cat.iconColor} />
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
                  <Mic size={32} color={VOICE_COLORS.textOnPrimary} />
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
            <Text style={styles.understandingIntentHeader}>Groups & Balances:</Text>
            <Text style={styles.understandingIntentSub}>Home Rent & Bills</Text>
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
              <Users size={20} color={VOICE_COLORS.primary} />
            </View>
            <View style={styles.understoodTextWrap}>
              <Text style={styles.understoodTitle}>"{activeQuery}"</Text>
              <Text style={styles.understoodIntentSub}>Intent: View group balance</Text>
            </View>
          </View>

          {/* Action Details Table Card */}
          <Text style={styles.stateSectionTitle}>{t('voice_assistant.action_details')}</Text>
          <View style={styles.actionDetailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>{t('voice_assistant.module')}</Text>
              <Text style={styles.detailVal}>Expense Groups</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>{t('voice_assistant.group')}</Text>
              <Text style={styles.detailVal}>Home Rent & Bills</Text>
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
              <CircleCheck size={18} color={VOICE_COLORS.primary} />
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
              return (
                <React.Fragment key={item.id}>
                  {idx > 0 && <View style={styles.divider} />}
                  <Pressable
                    style={styles.recentRow}
                    onPress={() => {
                      setActiveQuery(item.transcript);
                      setScreenState('confirm');
                    }}>
                    <View style={[styles.recentIconBadge, { backgroundColor: item.bgColor }]}>
                      <IconComp size={18} color={item.iconColor} />
                    </View>
                    <View style={styles.recentTextWrap}>
                      <Text style={styles.recentTitle} numberOfLines={1}>
                        {item.transcript}
                      </Text>
                      <Text style={styles.recentSubtitle}>{item.module}</Text>
                    </View>
                    <View style={styles.recentRightWrap}>
                      <Text style={styles.recentTime}>{item.time}</Text>
                      {item.status === 'completed' ? (
                        <CircleCheck size={16} color={VOICE_COLORS.successGreen} />
                      ) : (
                        <CircleX size={16} color={VOICE_COLORS.dangerRed} />
                      )}
                    </View>
                  </Pressable>
                </React.Fragment>
              );
            })}
          </View>

          {/* Footer Note */}
          <Text style={styles.historyFooterNote}>
            Voice commands are analyzed by LlmClientService and routed to the relevant module.
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
              <Mic size={26} color={VOICE_COLORS.textOnPrimary} />
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
      backgroundColor: '#054E63',
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
      color: '#38BDF8',
      marginBottom: 2,
    },
    defaultHeroTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: '#FFFFFF',
      lineHeight: 22,
      marginBottom: 10,
    },
    heroTapPillBtn: {
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 8,
      alignSelf: 'flex-start',
    },
    heroTapPillText: {
      fontFamily: fonts.sansBold,
      fontSize: 12.5,
      color: '#054E63',
    },

    // LISTENING STATE HERO
    listeningHeroCard: {
      backgroundColor: '#054E63',
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
      backgroundColor: 'rgba(56, 189, 248, 0.25)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    listeningMicPulseInner: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: 'rgba(56, 189, 248, 0.4)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    listeningMicCore: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: '#004F63',
      alignItems: 'center',
      justifyContent: 'center',
    },
    listeningTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 22,
      color: '#FFFFFF',
      marginBottom: 4,
    },
    listeningSub: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: '#E0F2FE',
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
      backgroundColor: '#004F63',
    },
    understandingCard: {
      backgroundColor: '#E0F2FE',
      borderRadius: 16,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: '#BAE6FD',
    },
    understandingIntentHeader: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: '#0284C7',
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
      backgroundColor: '#054E63',
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
    },
    stopListeningBtnText: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: '#FFFFFF',
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
      backgroundColor: '#E0F2FE',
      borderRadius: 16,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: '#BAE6FD',
      marginBottom: spacing.md,
    },
    understoodIconBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#FFFFFF',
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
      color: '#0284C7',
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
      color: '#16A34A',
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
      backgroundColor: '#E0F2FE',
      borderRadius: 16,
      padding: spacing.md,
      marginTop: spacing.xl,
      borderWidth: 1,
      borderColor: '#BAE6FD',
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
      color: '#0284C7',
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
      backgroundColor: '#054E63',
      borderColor: '#054E63',
    },
    filterPillText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12.5,
      color: colors.textPrimary,
    },
    filterPillTextActive: {
      color: '#FFFFFF',
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
      backgroundColor: '#E0F2FE',
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
      color: '#0284C7',
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
      backgroundColor: '#38BDF8',
      borderRadius: 2,
    },
    mainMicButton: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: '#054E63',
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow.medium,
    },
    tapToSpeakLabel: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: '#054E63',
      marginTop: 6,
      marginBottom: 4,
    },
  });
