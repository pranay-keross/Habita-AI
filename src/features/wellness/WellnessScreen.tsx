import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { LucideIcon } from 'lucide-react-native';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Frown from 'lucide-react-native/icons/frown';
import Annoyed from 'lucide-react-native/icons/annoyed';
import Meh from 'lucide-react-native/icons/meh';
import Smile from 'lucide-react-native/icons/smile';
import Laugh from 'lucide-react-native/icons/laugh';
import Brain from 'lucide-react-native/icons/brain';
import Wind from 'lucide-react-native/icons/wind';
import Sparkles from 'lucide-react-native/icons/sparkles';
import HeartHandshake from 'lucide-react-native/icons/heart-handshake';
import MoonStar from 'lucide-react-native/icons/moon-star';
import Leaf from 'lucide-react-native/icons/leaf';
import Timer from 'lucide-react-native/icons/timer';
import Plus from 'lucide-react-native/icons/plus';
import type { RootStackParamList } from '../../app/_layout';
import type { ThemeTokens } from '../../theme';
import useThemedStyles from '../../hooks/useThemedStyles';
import useResponsive from '../../hooks/useResponsive';
import { subscribeToLanguageChanges, t } from '../../i18n';
import Button from '../../components/Button';
import BottomSheet from '../../components/BottomSheet';
import { cbtCoach } from './cbtCoach';
import {
  averageMood,
  checkInStreak,
  createMoodEntry,
  entriesToday,
  loadMoodEntries,
  moodTrend,
  saveMoodEntries,
  sortByNewest,
  topFactors,
} from './wellnessStore';
import {
  CBT_TECHNIQUES,
  MEDITATION_GUIDES,
  MOOD_FACTORS,
  MOOD_LEVELS,
  type CbtReply,
  type CbtTechniqueId,
  type MeditationGuide,
  type MoodEntry,
  type MoodFactor,
  type MoodLevel,
} from './types';

type Props = StackScreenProps<RootStackParamList, 'Wellness'>;

const MOOD_ICONS: Record<MoodLevel, LucideIcon> = {
  1: Frown,
  2: Annoyed,
  3: Meh,
  4: Smile,
  5: Laugh,
};

const TECHNIQUE_ICONS: Record<CbtTechniqueId, LucideIcon> = {
  reframe: Brain,
  grounding: Leaf,
  breathing: Wind,
  gratitude: HeartHandshake,
};

const CATEGORY_ICONS: Record<MeditationGuide['category'], LucideIcon> = {
  breath: Wind,
  calm: Leaf,
  sleep: MoonStar,
  focus: Sparkles,
};

const TREND_DAYS = 7;

export default function WellnessScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const r = useResponsive();
  const insets = useSafeAreaInsets();

  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [localeVersion, setLocaleVersion] = useState(0);

  // Log sheet
  const [showLogSheet, setShowLogSheet] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [level, setLevel] = useState<MoodLevel>(3);
  const [factors, setFactors] = useState<MoodFactor[]>([]);
  const [note, setNote] = useState('');

  // Coach + meditation
  const [reply, setReply] = useState<CbtReply | null>(null);
  const [coachBusy, setCoachBusy] = useState(false);
  const [openGuide, setOpenGuide] = useState<MeditationGuide | null>(null);

  useEffect(() => {
    loadMoodEntries().then(setEntries);
    const unsubscribe = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    return () => {
      unsubscribe();
    };
  }, []);

  const ordered = useMemo(() => sortByNewest(entries), [entries]);
  const latest = ordered[0] ?? null;
  const todayCount = useMemo(() => entriesToday(entries).length, [entries]);
  const average = useMemo(() => averageMood(entries), [entries]);
  const streak = useMemo(() => checkInStreak(entries), [entries]);
  const trend = useMemo(() => moodTrend(entries, TREND_DAYS), [entries]);
  const leadingFactors = useMemo(() => topFactors(entries).slice(0, 3), [entries]);

  const persist = useCallback(async (updated: MoodEntry[]) => {
    setEntries(updated);
    await saveMoodEntries(updated);
  }, []);

  // ---- mood logging -------------------------------------------------------

  // Tapping a face on the strip is the "real-time" path: it pre-selects the level
  // and opens the sheet, so a check-in is two taps (face -> save) rather than four.
  const openLogSheet = (preset?: MoodLevel) => {
    setEditingId(null);
    setLevel(preset ?? 3);
    setFactors([]);
    setNote('');
    setShowLogSheet(true);
  };

  const openEditSheet = (entry: MoodEntry) => {
    setEditingId(entry.id);
    setLevel(entry.level);
    setFactors(entry.factors);
    setNote(entry.note);
    setShowLogSheet(true);
  };

  const toggleFactor = (factor: MoodFactor) => {
    setFactors((prev) => (prev.includes(factor) ? prev.filter((f) => f !== factor) : [...prev, factor]));
  };

  const handleSave = async () => {
    if (editingId) {
      await persist(
        entries.map((e) => (e.id === editingId ? { ...e, level, factors, note: note.trim() } : e)),
      );
    } else {
      await persist([...entries, createMoodEntry(level, factors, note)]);
    }
    setShowLogSheet(false);
  };

  const handleDelete = () => {
    if (!editingId) {
      return;
    }
    Alert.alert(t('wellness.delete_confirm_title'), t('wellness.delete_confirm_msg'), [
      { text: t('wellness.cancel'), style: 'cancel' },
      {
        text: t('wellness.delete'),
        style: 'destructive',
        onPress: async () => {
          await persist(entries.filter((e) => e.id !== editingId));
          setShowLogSheet(false);
        },
      },
    ]);
  };

  // ---- CBT assistant ------------------------------------------------------

  const askCoach = async (forced?: CbtTechniqueId) => {
    setCoachBusy(true);
    const next = await cbtCoach.respond({
      level: latest?.level ?? null,
      factors: latest?.factors ?? [],
      note: latest?.note ?? '',
      recentAverage: average,
    });
    // A manually picked technique overrides the coach's own choice but keeps its
    // empathetic opening — the user asking for breathing shouldn't lose the
    // acknowledgement of how they said they felt.
    setReply(
      forced
        ? {
            ...next,
            techniqueId: forced,
            titleKey: `wellness.cbt_${forced}_title`,
            stepKeys: [1, 2, 3].map((i) => `wellness.cbt_${forced}_step_${i}`),
            promptKey: `wellness.cbt_${forced}_prompt`,
          }
        : next,
    );
    setCoachBusy(false);
  };

  // ---- responsive layout numbers -----------------------------------------

  const gutter = r.isCompact ? 12 : 16;
  const moodSize = Math.min(r.scale(58), r.columnWidth(5, 8, gutter));
  const guideColumns = r.columns(240, 3);
  const guideWidth = guideColumns === 1 ? undefined : r.columnWidth(guideColumns, 12, gutter);
  const singleColumnStats = r.isCompact;
  const trendBarHeight = r.scale(72);

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  const ReplyIcon = reply ? TECHNIQUE_ICONS[reply.techniqueId] : Brain;

  return (
    <View style={styles.root} key={localeVersion}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8, paddingHorizontal: gutter }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={8}>
          <ArrowLeft size={20} color={styles.iconOnSurface.color} strokeWidth={1.9} />
        </Pressable>
        <Text style={[styles.headerTitle, { fontSize: r.font(20) }]} numberOfLines={1}>
          {t('wellness.header_title')}
        </Text>
        <Pressable onPress={() => openLogSheet()} style={styles.addBtn} hitSlop={8}>
          <Plus size={14} color={styles.iconOnPrimary.color} strokeWidth={2.4} />
          <Text style={styles.addBtnText}>{t('wellness.add_btn')}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: gutter }]}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.content, { maxWidth: r.contentMaxWidth }]}>
          {/* Hero — today's actual state, not a static banner */}
          <View style={[styles.hero, { padding: r.scale(20) }]}>
            <Text style={[styles.heroTitle, { fontSize: r.font(24) }]}>{t('wellness.hero_title')}</Text>
            <Text style={styles.heroSubtitle}>{t('wellness.hero_subtitle')}</Text>

            <View style={[styles.statsRow, singleColumnStats && styles.statsColumn]}>
              <View style={[styles.statChip, singleColumnStats && styles.statChipWide]}>
                <Text style={styles.statNum}>{todayCount}</Text>
                <Text style={styles.statLabel}>{t('wellness.stat_today')}</Text>
              </View>
              <View style={[styles.statChip, singleColumnStats && styles.statChipWide]}>
                <Text style={styles.statNum}>{average === null ? '—' : average.toFixed(1)}</Text>
                <Text style={styles.statLabel}>{t('wellness.stat_average')}</Text>
              </View>
              <View style={[styles.statChip, singleColumnStats && styles.statChipWide]}>
                <Text style={styles.statNum}>{streak}</Text>
                <Text style={styles.statLabel}>{t('wellness.stat_streak')}</Text>
              </View>
            </View>
          </View>

          {/* Real-time check-in strip */}
          <Text style={styles.sectionTitle}>{t('wellness.checkin_title')}</Text>
          <Text style={styles.sectionSub}>{t('wellness.checkin_sub')}</Text>
          <View style={styles.moodStrip}>
            {MOOD_LEVELS.map((value) => {
              const Icon = MOOD_ICONS[value];
              const active = latest !== null && todayCount > 0 && latest.level === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => openLogSheet(value)}
                  style={styles.moodItem}
                  accessibilityRole="button"
                  accessibilityLabel={t(`wellness.mood_${value}`)}>
                  <View
                    style={[
                      styles.moodCircle,
                      active && styles.moodCircleActive,
                      { width: moodSize, height: moodSize, borderRadius: moodSize / 2 },
                    ]}>
                    <Icon
                      size={Math.round(moodSize * 0.46)}
                      color={active ? styles.iconOnPrimary.color : styles.iconAccent.color}
                      strokeWidth={1.8}
                    />
                  </View>
                  <Text
                    style={[styles.moodLabel, active && styles.moodLabelActive, { fontSize: r.font(11) }]}
                    numberOfLines={2}>
                    {t(`wellness.mood_${value}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* 7-day trend */}
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>{t('wellness.trend_title')}</Text>
              <Text style={styles.panelMeta}>{t('wellness.trend_meta')}</Text>
            </View>
            <View style={[styles.trendRow, { height: trendBarHeight }]}>
              {trend.map((value, idx) => (
                <View key={idx} style={styles.trendCol}>
                  <View style={styles.trendTrack}>
                    <View
                      style={[
                        styles.trendFill,
                        value === null ? styles.trendFillEmpty : null,
                        { height: `${value === null ? 6 : (value / 5) * 100}%` },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.trendLabels}>
              <Text style={styles.trendLabel}>{t('wellness.trend_oldest')}</Text>
              <Text style={styles.trendLabel}>{t('wellness.trend_today')}</Text>
            </View>
            {leadingFactors.length > 0 && (
              <View style={styles.factorSummary}>
                <Text style={styles.factorSummaryLabel}>{t('wellness.trend_factors')}</Text>
                <View style={styles.tagRow}>
                  {leadingFactors.map(({ factor, count }) => (
                    <View key={factor} style={styles.tag}>
                      <Text style={styles.tagText}>
                        {t(`wellness.factor_${factor}`)} · {count}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* CBT assistant */}
          <Text style={styles.sectionTitle}>{t('wellness.cbt_title')}</Text>
          <Text style={styles.sectionSub}>{t('wellness.cbt_sub')}</Text>

          <View style={styles.coachCard}>
            {reply === null ? (
              <>
                <View style={styles.coachIconCircle}>
                  <Brain size={22} color={styles.iconAccent.color} strokeWidth={1.8} />
                </View>
                <Text style={styles.coachIdleTitle}>{t('wellness.cbt_idle_title')}</Text>
                <Text style={styles.coachIdleSub}>
                  {latest === null ? t('wellness.cbt_idle_no_entry') : t('wellness.cbt_idle_sub')}
                </Text>
              </>
            ) : (
              <>
                <View style={styles.coachReplyHeader}>
                  <View style={styles.coachIconCircleSmall}>
                    <ReplyIcon size={18} color={styles.iconAccent.color} strokeWidth={1.8} />
                  </View>
                  <Text style={styles.coachTechnique}>{t(reply.titleKey)}</Text>
                </View>
                <Text style={styles.coachOpening}>{t(reply.openingKey)}</Text>
                {reply.stepKeys.map((key, idx) => (
                  <View key={key} style={styles.coachStepRow}>
                    <View style={styles.coachStepNum}>
                      <Text style={styles.coachStepNumText}>{idx + 1}</Text>
                    </View>
                    <Text style={styles.coachStepText}>{t(key)}</Text>
                  </View>
                ))}
                <View style={styles.coachPromptBox}>
                  <Text style={styles.coachPromptText}>{t(reply.promptKey)}</Text>
                </View>
                <Text style={styles.coachDisclaimer}>{t('wellness.cbt_disclaimer')}</Text>
              </>
            )}

            <Button
              title={reply === null ? t('wellness.cbt_start') : t('wellness.cbt_again')}
              onPress={() => askCoach()}
              loading={coachBusy}
              style={styles.coachCta}
            />

            <Text style={styles.coachPickLabel}>{t('wellness.cbt_pick_label')}</Text>
            <View style={styles.chipRow}>
              {CBT_TECHNIQUES.map((technique) => {
                const Icon = TECHNIQUE_ICONS[technique];
                const active = reply?.techniqueId === technique;
                return (
                  <Pressable
                    key={technique}
                    onPress={() => askCoach(technique)}
                    style={[styles.chip, active && styles.chipActive]}>
                    <Icon
                      size={13}
                      color={active ? styles.iconOnPrimary.color : styles.iconAccent.color}
                      strokeWidth={2}
                    />
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {t(`wellness.cbt_${technique}_title`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Meditation library */}
          <Text style={styles.sectionTitle}>{t('wellness.med_title')}</Text>
          <Text style={styles.sectionSub}>{t('wellness.med_sub')}</Text>
          <View style={styles.guideGrid}>
            {MEDITATION_GUIDES.map((guide) => {
              const Icon = CATEGORY_ICONS[guide.category];
              return (
                <Pressable
                  key={guide.id}
                  onPress={() => setOpenGuide(guide)}
                  style={[styles.guideCard, guideWidth ? { width: guideWidth } : styles.guideCardFull]}>
                  <View style={styles.guideIconCircle}>
                    <Icon size={20} color={styles.iconAccent.color} strokeWidth={1.8} />
                  </View>
                  <Text style={styles.guideTitle} numberOfLines={2}>
                    {t(`wellness.med_${guide.id}_title`)}
                  </Text>
                  <Text style={styles.guideSub} numberOfLines={3}>
                    {t(`wellness.med_${guide.id}_sub`)}
                  </Text>
                  <View style={styles.guideMetaRow}>
                    <Timer size={12} color={styles.iconMuted.color} strokeWidth={2} />
                    <Text style={styles.guideMeta}>
                      {t('wellness.med_minutes', { count: guide.minutes })} ·{' '}
                      {t(`wellness.med_cat_${guide.category}`)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Timeline */}
          <Text style={styles.sectionTitle}>{t('wellness.history_title')}</Text>
          <Text style={styles.sectionSub}>{t('wellness.history_sub')}</Text>

          {ordered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{t('wellness.empty_title')}</Text>
              <Text style={styles.emptySub}>{t('wellness.empty_sub')}</Text>
            </View>
          ) : (
            ordered.slice(0, 20).map((entry) => {
              const Icon = MOOD_ICONS[entry.level];
              return (
                <Pressable key={entry.id} style={styles.entryCard} onPress={() => openEditSheet(entry)}>
                  <View style={styles.entryIconCircle}>
                    <Icon size={18} color={styles.iconAccent.color} strokeWidth={1.8} />
                  </View>
                  <View style={styles.entryBody}>
                    <View style={styles.entryHeadRow}>
                      <Text style={styles.entryMood}>{t(`wellness.mood_${entry.level}`)}</Text>
                      <Text style={styles.entryTime}>
                        {formatDate(entry.loggedAt)} · {formatTime(entry.loggedAt)}
                      </Text>
                    </View>
                    {entry.note.length > 0 && (
                      <Text style={styles.entryNote} numberOfLines={3}>
                        {entry.note}
                      </Text>
                    )}
                    {entry.factors.length > 0 && (
                      <View style={styles.tagRow}>
                        {entry.factors.map((factor) => (
                          <View key={factor} style={styles.tag}>
                            <Text style={styles.tagText}>{t(`wellness.factor_${factor}`)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}

          <Text style={styles.privacyNote}>{t('wellness.privacy_note')}</Text>
        </View>
      </ScrollView>

      {/* Log / edit sheet */}
      <BottomSheet
        visible={showLogSheet}
        onClose={() => setShowLogSheet(false)}
        title={editingId ? t('wellness.sheet_title_edit') : t('wellness.sheet_title_add')}>
        <Text style={styles.label}>{t('wellness.label_mood')}</Text>
        <View style={styles.moodStrip}>
          {MOOD_LEVELS.map((value) => {
            const Icon = MOOD_ICONS[value];
            const active = level === value;
            return (
              <Pressable key={value} onPress={() => setLevel(value)} style={styles.moodItem}>
                <View
                  style={[
                    styles.moodCircle,
                    active && styles.moodCircleActive,
                    { width: moodSize, height: moodSize, borderRadius: moodSize / 2 },
                  ]}>
                  <Icon
                    size={Math.round(moodSize * 0.46)}
                    color={active ? styles.iconOnPrimary.color : styles.iconAccent.color}
                    strokeWidth={1.8}
                  />
                </View>
                <Text style={[styles.moodLabel, active && styles.moodLabelActive]} numberOfLines={2}>
                  {t(`wellness.mood_${value}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>{t('wellness.label_factors')}</Text>
        <View style={styles.chipRow}>
          {MOOD_FACTORS.map((factor) => {
            const active = factors.includes(factor);
            return (
              <Pressable
                key={factor}
                onPress={() => toggleFactor(factor)}
                style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {t(`wellness.factor_${factor}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>{t('wellness.label_note')}</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          placeholder={t('wellness.placeholder_note')}
          placeholderTextColor={styles.placeholder.color}
        />

        <Button
          title={editingId ? t('wellness.save_changes') : t('wellness.save_entry')}
          onPress={handleSave}
          style={styles.modalCta}
        />

        {editingId && (
          <Pressable style={styles.modalRemoveBtn} onPress={handleDelete}>
            <Text style={styles.modalRemoveText}>{t('wellness.delete_entry')}</Text>
          </Pressable>
        )}
      </BottomSheet>

      {/* Meditation guide sheet */}
      <BottomSheet
        visible={openGuide !== null}
        onClose={() => setOpenGuide(null)}
        title={openGuide ? t(`wellness.med_${openGuide.id}_title`) : ''}>
        {openGuide && (
          <>
            <View style={styles.guideSheetMeta}>
              <Timer size={13} color={styles.iconMuted.color} strokeWidth={2} />
              <Text style={styles.guideMeta}>
                {t('wellness.med_minutes', { count: openGuide.minutes })} ·{' '}
                {t(`wellness.med_cat_${openGuide.category}`)}
              </Text>
            </View>
            <Text style={styles.guideSheetIntro}>{t(`wellness.med_${openGuide.id}_sub`)}</Text>
            {Array.from({ length: openGuide.stepCount }, (_, i) => i + 1).map((step) => (
              <View key={step} style={styles.coachStepRow}>
                <View style={styles.coachStepNum}>
                  <Text style={styles.coachStepNumText}>{step}</Text>
                </View>
                <Text style={styles.coachStepText}>{t(`wellness.med_${openGuide.id}_step_${step}`)}</Text>
              </View>
            ))}
            <Text style={styles.coachDisclaimer}>{t('wellness.med_note')}</Text>
            <Button title={t('wellness.med_done')} onPress={() => setOpenGuide(null)} style={styles.modalCta} />
          </>
        )}
      </BottomSheet>
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
      gap: spacing.sm,
      paddingBottom: spacing.sm,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow.soft,
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontFamily: fonts.serif,
      color: colors.textPrimary,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.pill,
    },
    addBtnText: {
      fontFamily: fonts.sansBold,
      fontSize: 12,
      color: colors.textOnPrimary,
    },
    scroll: {
      paddingBottom: spacing.xxl,
      alignItems: 'center',
    },
    content: {
      width: '100%',
    },
    hero: {
      backgroundColor: colors.primary,
      borderRadius: radius.xxl,
      marginTop: spacing.md,
      marginBottom: spacing.xl,
      ...shadow.medium,
    },
    heroTitle: {
      fontFamily: fonts.serif,
      color: colors.textOnPrimary,
      marginBottom: 6,
    },
    heroSubtitle: {
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 19,
      color: colors.textOnPrimaryMuted,
      marginBottom: spacing.lg,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    statsColumn: {
      flexDirection: 'column',
    },
    statChip: {
      flex: 1,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.textOnPrimaryMuted,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      alignItems: 'center',
    },
    statChipWide: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    statNum: {
      fontFamily: fonts.sansBold,
      fontSize: 18,
      color: colors.textOnPrimary,
    },
    statLabel: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textOnPrimaryMuted,
      marginTop: 2,
      textAlign: 'center',
    },
    sectionTitle: {
      fontFamily: fonts.serif,
      fontSize: 20,
      color: colors.textPrimary,
    },
    sectionSub: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
      marginBottom: spacing.md,
    },
    moodStrip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.xl,
    },
    moodItem: {
      alignItems: 'center',
      flex: 1,
    },
    moodCircle: {
      backgroundColor: colors.blush,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    moodCircleActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primaryDark,
    },
    moodLabel: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 6,
      textAlign: 'center',
      paddingHorizontal: 2,
    },
    moodLabelActive: {
      color: colors.primary,
    },
    panel: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.xl,
      ...shadow.soft,
    },
    panelHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    panelTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.textPrimary,
    },
    panelMeta: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textMuted,
    },
    trendRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 6,
    },
    trendCol: {
      flex: 1,
      height: '100%',
      justifyContent: 'flex-end',
    },
    trendTrack: {
      height: '100%',
      justifyContent: 'flex-end',
      backgroundColor: colors.surface,
      borderRadius: radius.sm,
      overflow: 'hidden',
    },
    trendFill: {
      width: '100%',
      backgroundColor: colors.primary,
      borderRadius: radius.sm,
    },
    trendFillEmpty: {
      backgroundColor: colors.border,
    },
    trendLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    trendLabel: {
      fontFamily: fonts.sans,
      fontSize: 10,
      color: colors.textMuted,
    },
    factorSummary: {
      marginTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.md,
    },
    factorSummaryLabel: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: colors.textMuted,
      marginBottom: 6,
    },
    coachCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.xl,
      ...shadow.soft,
    },
    coachIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.blush,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    coachIconCircleSmall: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.blush,
      alignItems: 'center',
      justifyContent: 'center',
    },
    coachIdleTitle: {
      fontFamily: fonts.serif,
      fontSize: 16,
      color: colors.textPrimary,
    },
    coachIdleSub: {
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textMuted,
      marginTop: 4,
    },
    coachReplyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: spacing.md,
    },
    coachTechnique: {
      flex: 1,
      fontFamily: fonts.serif,
      fontSize: 16,
      color: colors.textPrimary,
    },
    coachOpening: {
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 20,
      color: colors.textSecondary,
      marginBottom: spacing.md,
    },
    coachStepRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: spacing.sm,
    },
    coachStepNum: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.blush,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    coachStepNumText: {
      fontFamily: fonts.sansBold,
      fontSize: 11,
      color: colors.primary,
    },
    coachStepText: {
      flex: 1,
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 20,
      color: colors.textPrimary,
    },
    coachPromptBox: {
      backgroundColor: colors.turmericSoft,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.turmeric,
      padding: spacing.md,
      marginTop: spacing.sm,
    },
    coachPromptText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textPrimary,
    },
    coachDisclaimer: {
      fontFamily: fonts.sans,
      fontSize: 10,
      lineHeight: 15,
      color: colors.textMuted,
      marginTop: spacing.md,
    },
    coachCta: {
      marginTop: spacing.md,
    },
    coachPickLabel: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: colors.textMuted,
      marginTop: spacing.lg,
      marginBottom: 8,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.textPrimary,
    },
    chipTextActive: {
      color: colors.textOnPrimary,
    },
    guideGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: spacing.xl,
    },
    guideCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadow.soft,
    },
    guideCardFull: {
      width: '100%',
    },
    guideIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.blush,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    guideTitle: {
      fontFamily: fonts.serif,
      fontSize: 15,
      color: colors.textPrimary,
    },
    guideSub: {
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 17,
      color: colors.textMuted,
      marginTop: 3,
    },
    guideMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: spacing.sm,
    },
    guideMeta: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: colors.textMuted,
    },
    guideSheetMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: spacing.md,
    },
    guideSheetIntro: {
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 20,
      color: colors.textSecondary,
      marginTop: 6,
      marginBottom: spacing.md,
    },
    emptyState: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
      borderStyle: 'dashed',
      padding: spacing.xl,
      alignItems: 'center',
    },
    emptyTitle: {
      fontFamily: fonts.serif,
      fontSize: 16,
      color: colors.textPrimary,
    },
    emptySub: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 4,
    },
    entryCard: {
      flexDirection: 'row',
      gap: spacing.md,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
      ...shadow.soft,
    },
    entryIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.blush,
      alignItems: 'center',
      justifyContent: 'center',
    },
    entryBody: {
      flex: 1,
    },
    entryHeadRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: spacing.sm,
    },
    entryMood: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.textPrimary,
    },
    entryTime: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textMuted,
    },
    entryNote: {
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
      marginTop: 4,
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 8,
    },
    tag: {
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    tagText: {
      fontFamily: fonts.sansMedium,
      fontSize: 10,
      color: colors.textSecondary,
    },
    privacyNote: {
      fontFamily: fonts.sans,
      fontSize: 10,
      lineHeight: 15,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.xl,
    },
    label: {
      fontFamily: fonts.sansBold,
      fontSize: 11,
      letterSpacing: 1.5,
      color: colors.textMuted,
      marginTop: 14,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    input: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: fonts.sansMedium,
      fontSize: 15,
      color: colors.textPrimary,
    },
    inputMultiline: {
      minHeight: 96,
    },
    // `placeholderTextColor` and icon `color` are props, not styles — kept in the
    // factory so this screen still reads the palette in exactly one place.
    placeholder: {
      color: colors.textMuted,
    },
    iconAccent: {
      color: colors.primary,
    },
    iconMuted: {
      color: colors.textMuted,
    },
    iconOnSurface: {
      color: colors.textPrimary,
    },
    iconOnPrimary: {
      color: colors.textOnPrimary,
    },
    modalCta: {
      marginTop: 24,
    },
    modalRemoveBtn: {
      marginTop: 14,
      marginBottom: 24,
      backgroundColor: colors.dangerSoft,
      paddingVertical: 12,
      borderRadius: radius.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.dangerBorder,
    },
    modalRemoveText: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.danger,
    },
  });
