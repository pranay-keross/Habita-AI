import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import {
  Annoyed,
  ArrowLeft,
  Brain,
  CloudOff,
  Frown,
  HeartHandshake,
  Laugh,
  Leaf,
  Meh,
  MoonStar,
  Plus,
  SendHorizontal,
  Smile,
  Sparkles,
  Timer,
  Trash2,
  Wind,
  type LucideIcon,
} from 'lucide-react-native';
import type { RootStackParamList } from '../../app/_layout';
import type { ThemeTokens } from '../../theme';
import useThemedStyles from '../../hooks/useThemedStyles';
import useResponsive from '../../hooks/useResponsive';
import useAuth from '../../hooks/useAuth';
import { subscribeToLanguageChanges, t } from '../../i18n';
import Button from '../../components/Button';
import BottomSheet from '../../components/BottomSheet';
import { cbtCoach } from './cbtCoach';
import {
  clearCbtHistory,
  completeExerciseSession,
  createCheckIn,
  deleteCheckIn,
  getCbtHistory,
  getCbtRecommendation,
  getCheckIn,
  getExercise,
  getMoodUplift,
  getWellnessSummary,
  listCheckIns,
  listExercises,
  sendCbtMessage,
  updateCheckIn,
} from './api';
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
  EXERCISE_CATEGORIES,
  MOOD_BY_LEVEL,
  MOOD_FACTORS,
  MOOD_LEVELS,
  checkInToEntry,
  factorsToTags,
  type AiMoodUpliftResponse,
  type CbtChatMessage,
  type CbtRecommendationResponse,
  type CbtReply,
  type CbtTechniqueId,
  type ExerciseCategory,
  type MoodCheckInRequest,
  type MoodEntry,
  type MoodFactor,
  type MoodLevel,
  type WellnessExercise,
  type WellnessSummaryResponse,
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

/** Backend exercise categories, mapped onto the icon set this screen already uses. */
const EXERCISE_ICONS: Record<ExerciseCategory, LucideIcon> = {
  CBT_TECHNIQUE: Brain,
  BREATH: Wind,
  SLEEP: MoonStar,
  FOCUS: Sparkles,
  MINDFULNESS: Leaf,
};

const TREND_DAYS = 7;

/** One page of check-ins. The backend's own default is 10; 20 fills a phone screen. */
const CHECK_IN_PAGE_SIZE = 20;

export default function WellnessScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const r = useResponsive();
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuth();

  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [localeVersion, setLocaleVersion] = useState(0);

  // Backend state. `offline` is not an error state — every panel keeps rendering
  // from the device copy, and the banner just says the numbers may be stale.
  const [summary, setSummary] = useState<WellnessSummaryResponse | null>(null);
  const [exercises, setExercises] = useState<WellnessExercise[]>([]);
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  // Read inside `loadAll` instead of closing over `category`: the focus listener is
  // registered once, so a `loadAll` bound to the initial filter would quietly reset
  // the exercise list to unfiltered on every return to this screen while the chip
  // still showed the chosen category.
  const categoryRef = useRef<ExerciseCategory | null>(null);
  const [recommendation, setRecommendation] = useState<CbtRecommendationResponse | null>(null);
  const [uplift, setUplift] = useState<AiMoodUpliftResponse | null>(null);
  const [chat, setChat] = useState<CbtChatMessage[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);

  // Log sheet
  const [showLogSheet, setShowLogSheet] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [level, setLevel] = useState<MoodLevel>(3);
  const [factors, setFactors] = useState<MoodFactor[]>([]);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [extraTags, setExtraTags] = useState<string[]>([]);

  // Coach + chat + exercise sheet
  const [reply, setReply] = useState<CbtReply | null>(null);
  const [coachBusy, setCoachBusy] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatFellBack, setChatFellBack] = useState(false);
  const [openExercise, setOpenExercise] = useState<WellnessExercise | null>(null);
  const [completing, setCompleting] = useState(false);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // ---- loading ------------------------------------------------------------

  /**
   * One pass over every wellness endpoint. Each panel is settled independently
   * (`allSettled`) so one failing route — today that's the CBT chat POST, see
   * `api.ts` — never blanks the panels that did answer.
   */
  const loadAll = useCallback(
    async (opts?: { category?: ExerciseCategory | null }) => {
      const wanted = opts?.category !== undefined ? opts.category : categoryRef.current;
      const token = await getAccessToken();
      if (!token) {
        const local = await loadMoodEntries();
        if (mounted.current) {
          setEntries(local);
          setOffline(true);
        }
        return;
      }

      const [
        summaryRes,
        checkInsRes,
        exercisesRes,
        recommendationRes,
        upliftRes,
        historyRes,
      ] = await Promise.allSettled([
        getWellnessSummary(token),
        listCheckIns(token, { page: 0, limit: CHECK_IN_PAGE_SIZE }),
        listExercises(token, wanted ?? undefined),
        getCbtRecommendation(token),
        getMoodUplift(token),
        getCbtHistory(token),
      ]);

      if (!mounted.current) {
        return;
      }

      if (summaryRes.status === 'fulfilled') {
        setSummary(summaryRes.value);
      }
      if (exercisesRes.status === 'fulfilled') {
        setExercises(exercisesRes.value);
      }
      if (recommendationRes.status === 'fulfilled') {
        setRecommendation(recommendationRes.value);
      }
      if (upliftRes.status === 'fulfilled') {
        setUplift(upliftRes.value);
      }
      if (historyRes.status === 'fulfilled') {
        setChat(historyRes.value);
      }

      if (checkInsRes.status === 'fulfilled') {
        const remote = checkInsRes.value.content.map(checkInToEntry);
        setEntries(remote);
        setPage(checkInsRes.value.page);
        setTotalPages(Math.max(checkInsRes.value.totalPages, 1));
        setOffline(false);
        // Mirror the page locally so a later cold start with no network still has
        // something honest to show, and so `wellnessStore`'s analytics keep working.
        await saveMoodEntries(remote);
      } else {
        const local = await loadMoodEntries();
        if (mounted.current) {
          setEntries(local);
          setOffline(true);
        }
      }
    },
    [getAccessToken],
  );

  useEffect(() => {
    (async () => {
      // Paint the device copy first so the screen is never empty while the
      // network round-trip is in flight.
      const local = await loadMoodEntries();
      if (mounted.current && local.length > 0) {
        setEntries(local);
      }
      await loadAll();
      if (mounted.current) {
        setLoading(false);
      }
    })();
    const unsubscribe = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    const unsubFocus = navigation.addListener('focus', () => {
      loadAll();
    });
    return () => {
      unsubscribe();
      unsubFocus();
    };
    // Runs once: `loadAll` is stable, and the initial load must not re-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAll();
    } finally {
      if (mounted.current) {
        setRefreshing(false);
      }
    }
  }, [loadAll]);

  const loadMore = useCallback(async () => {
    const token = await getAccessToken();
    if (!token || page + 1 >= totalPages) {
      return;
    }
    setBusy(true);
    try {
      const next = await listCheckIns(token, { page: page + 1, limit: CHECK_IN_PAGE_SIZE });
      if (!mounted.current) {
        return;
      }
      const more = next.content.map(checkInToEntry);
      setEntries((prev) => {
        const byId = new Map(prev.map((e) => [e.id, e]));
        more.forEach((e) => byId.set(e.id, e));
        return [...byId.values()];
      });
      setPage(next.page);
      setTotalPages(Math.max(next.totalPages, 1));
    } catch {
      setOffline(true);
    } finally {
      if (mounted.current) {
        setBusy(false);
      }
    }
  }, [getAccessToken, page, totalPages]);

  // ---- derived ------------------------------------------------------------

  const ordered = useMemo(() => sortByNewest(entries), [entries]);
  const latest = ordered[0] ?? null;

  // Server-computed when the summary answered, locally derived otherwise. The
  // two agree by construction — `moodScore` is exactly `MoodLevel`.
  const todayCount = summary?.checkInsToday ?? entriesToday(entries).length;
  const average = summary?.sevenDayAverage ?? averageMood(entries);
  const streak = summary?.dayStreak ?? checkInStreak(entries);

  const trend = useMemo<(number | null)[]>(() => {
    if (summary?.lastSevenDays?.length) {
      return summary.lastSevenDays.map((d) => (d.checkInCount > 0 ? d.averageScore : null));
    }
    return moodTrend(entries, TREND_DAYS);
  }, [summary, entries]);

  const leadingFactors = useMemo<{ label: string; count: number }[]>(() => {
    if (summary?.mostMentionedTags?.length) {
      return summary.mostMentionedTags.slice(0, 3).map((m) => ({ label: m.tag, count: m.count }));
    }
    return topFactors(entries)
      .slice(0, 3)
      .map(({ factor, count }) => ({ label: t(`wellness.factor_${factor}`), count }));
    // `localeVersion` is not a dependency: a language change remounts the whole
    // tree through `key={localeVersion}` on the root, so this memo is rebuilt anyway.
  }, [summary, entries]);

  // ---- mood logging -------------------------------------------------------

  // Tapping a face on the strip is the "real-time" path: it pre-selects the level
  // and opens the sheet, so a check-in is two taps (face -> save) rather than four.
  const openLogSheet = (preset?: MoodLevel) => {
    setEditingId(null);
    setLevel(preset ?? 3);
    setFactors([]);
    setNote('');
    setReason('');
    setExtraTags([]);
    setShowLogSheet(true);
  };

  /**
   * Opens the sheet on the list's copy immediately, then re-reads that one
   * check-in by id and corrects the fields if the server disagrees — the list
   * page can be minutes old, and an edit made on another device would otherwise
   * be silently overwritten by whatever this screen last fetched. A check-in
   * deleted elsewhere comes back null, so the sheet closes rather than saving
   * an edit to a row that no longer exists.
   */
  const openEditSheet = async (entry: MoodEntry) => {
    setEditingId(entry.id);
    setLevel(entry.level);
    setFactors(entry.factors);
    setNote(entry.note);
    setReason(entry.reason ?? '');
    setExtraTags(entry.extraTags ?? []);
    setShowLogSheet(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        return;
      }
      const fresh = await getCheckIn(entry.id, token);
      if (!mounted.current) {
        return;
      }
      if (fresh === null) {
        setShowLogSheet(false);
        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
        return;
      }
      const latestEntry = checkInToEntry(fresh);
      setLevel(latestEntry.level);
      setFactors(latestEntry.factors);
      setNote(latestEntry.note);
      setReason(latestEntry.reason ?? '');
      setExtraTags(latestEntry.extraTags ?? []);
      setEntries((prev) => prev.map((e) => (e.id === latestEntry.id ? latestEntry : e)));
    } catch {
      // Offline — the list copy already on screen is the best available.
    }
  };

  const toggleFactor = (factor: MoodFactor) => {
    setFactors((prev) => (prev.includes(factor) ? prev.filter((f) => f !== factor) : [...prev, factor]));
  };

  const handleSave = async () => {
    const body: MoodCheckInRequest = {
      mood: MOOD_BY_LEVEL[level],
      reason: reason.trim() || undefined,
      tags: factorsToTags(factors, extraTags),
      note: note.trim() || undefined,
    };

    setBusy(true);
    try {
      const token = await getAccessToken();
      if (token) {
        if (editingId) {
          await updateCheckIn(editingId, body, token);
        } else {
          await createCheckIn(body, token);
        }
        setShowLogSheet(false);
        await loadAll();
        return;
      }
      // Signed out / no token: keep the entry on the device so nothing is lost.
      const local = editingId
        ? entries.map((e) =>
            e.id === editingId
              ? { ...e, level, factors, extraTags, note: note.trim(), reason: reason.trim(), synced: false }
              : e,
          )
        : [...entries, { ...createMoodEntry(level, factors, note), reason: reason.trim(), synced: false }];
      setEntries(local);
      await saveMoodEntries(local);
      setOffline(true);
      setShowLogSheet(false);
    } catch {
      Alert.alert(t('wellness.sync_failed_title'), t('wellness.sync_failed_msg'));
    } finally {
      if (mounted.current) {
        setBusy(false);
      }
    }
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
          setBusy(true);
          try {
            const token = await getAccessToken();
            if (token) {
              await deleteCheckIn(editingId, token);
              setShowLogSheet(false);
              await loadAll();
              return;
            }
            const local = entries.filter((e) => e.id !== editingId);
            setEntries(local);
            await saveMoodEntries(local);
            setShowLogSheet(false);
          } catch {
            Alert.alert(t('wellness.sync_failed_title'), t('wellness.sync_failed_msg'));
          } finally {
            if (mounted.current) {
              setBusy(false);
            }
          }
        },
      },
    ]);
  };

  // ---- CBT: offline coach -------------------------------------------------

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

  // ---- CBT: real chat assistant -------------------------------------------

  const handleSendChat = async () => {
    const message = chatInput.trim();
    if (message.length === 0 || chatSending) {
      return;
    }
    setChatSending(true);
    setChatInput('');

    // Optimistic echo, so the conversation reads correctly while the round-trip
    // is in flight and still reads correctly if the assistant reply never lands.
    const localEcho: CbtChatMessage = {
      id: `local-${Date.now()}`,
      sender: 'USER',
      message,
      suggestedTechnique: null,
      createdAt: new Date().toISOString(),
    };
    setChat((prev) => [...prev, localEcho]);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('no token');
      }
      const answer = await sendCbtMessage(message, token);
      if (!mounted.current) {
        return;
      }
      setChatFellBack(false);
      // Re-read the server's own transcript rather than trusting the optimistic
      // echo — it is the record the next `getCbtHistory` will return anyway.
      const history = await getCbtHistory(token);
      setChat(history.length > 0 ? history : [localEcho, answer]);
    } catch {
      // The assistant route is down (it 500s today — see `api.ts`). Answer from
      // `LocalCbtCoach` instead of leaving the message unanswered, and say so.
      if (!mounted.current) {
        return;
      }
      const fallback = await cbtCoach.respond({
        level: latest?.level ?? null,
        factors: latest?.factors ?? [],
        note: message,
        recentAverage: average,
      });
      setReply(fallback);
      setChatFellBack(true);
      setChat((prev) => [
        ...prev,
        {
          id: `local-reply-${Date.now()}`,
          sender: 'ASSISTANT',
          message: `${t(fallback.openingKey)} ${t(fallback.titleKey)}: ${fallback.stepKeys
            .map((k) => t(k))
            .join(' ')}`,
          suggestedTechnique: fallback.techniqueId,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      if (mounted.current) {
        setChatSending(false);
      }
    }
  };

  const handleClearChat = () => {
    Alert.alert(t('wellness.chat_clear_title'), t('wellness.chat_clear_msg'), [
      { text: t('wellness.cancel'), style: 'cancel' },
      {
        text: t('wellness.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await getAccessToken();
            if (token) {
              await clearCbtHistory(token);
            }
          } catch {
            // Local clear still stands; the next load re-reads the server.
          } finally {
            if (mounted.current) {
              setChat([]);
              setChatFellBack(false);
            }
          }
        },
      },
    ]);
  };

  // ---- Exercises ----------------------------------------------------------

  const selectCategory = async (next: ExerciseCategory | null) => {
    setCategory(next);
    categoryRef.current = next;
    const token = await getAccessToken();
    if (!token) {
      return;
    }
    setBusy(true);
    try {
      const list = await listExercises(token, next ?? undefined);
      if (mounted.current) {
        setExercises(list);
      }
    } catch {
      setOffline(true);
    } finally {
      if (mounted.current) {
        setBusy(false);
      }
    }
  };

  /**
   * The list payload already carries `steps`, so the sheet opens on it with no
   * wait; the by-id read then refreshes it. Worth doing because the sheet is the
   * only place the full step list is actually followed, and it is the one view
   * where showing a stale or trimmed exercise would matter.
   */
  const openExerciseSheet = async (exercise: WellnessExercise) => {
    setOpenExercise(exercise);
    try {
      const token = await getAccessToken();
      if (!token) {
        return;
      }
      const full = await getExercise(exercise.id, token);
      if (mounted.current && full) {
        setOpenExercise((current) => (current?.id === full.id ? full : current));
      }
    } catch {
      // Offline — the list copy is complete enough to follow.
    }
  };

  const handleCompleteExercise = async (exercise: WellnessExercise) => {
    setCompleting(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('no token');
      }
      await completeExerciseSession(exercise.id, exercise.durationMinutes, token);
      if (!mounted.current) {
        return;
      }
      setOpenExercise(null);
      // A finished session moves the recommendation and the streak, so re-read.
      await loadAll();
      Alert.alert(t('wellness.ex_done_title'), t('wellness.ex_done_msg', { title: exercise.title }));
    } catch {
      Alert.alert(t('wellness.sync_failed_title'), t('wellness.sync_failed_msg'));
    } finally {
      if (mounted.current) {
        setCompleting(false);
      }
    }
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
  const recommended = recommendation?.recommendedExercise ?? null;
  const RecommendedIcon = recommended ? EXERCISE_ICONS[recommended.category] ?? Brain : Brain;
  const hasMore = page + 1 < totalPages;

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
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={[styles.content, { maxWidth: r.contentMaxWidth }]}>
          {offline && (
            <View style={styles.offlineBanner}>
              <CloudOff size={14} color={styles.iconMuted.color} strokeWidth={2} />
              <Text style={styles.offlineText}>{t('wellness.offline_banner')}</Text>
            </View>
          )}

          {/* Hero — today's actual state, server-computed when reachable */}
          <View style={[styles.hero, { padding: r.scale(20) }]}>
            <Text style={[styles.heroTitle, { fontSize: r.font(24) }]}>{t('wellness.hero_title')}</Text>
            <Text style={styles.heroSubtitle}>{t('wellness.hero_subtitle')}</Text>

            <View style={[styles.statsRow, singleColumnStats && styles.statsColumn]}>
              <View style={[styles.statChip, singleColumnStats && styles.statChipWide]}>
                <Text style={styles.statNum}>{todayCount}</Text>
                <Text style={styles.statLabel}>{t('wellness.stat_today')}</Text>
              </View>
              <View style={[styles.statChip, singleColumnStats && styles.statChipWide]}>
                <Text style={styles.statNum}>
                  {average === null || average === 0 ? '—' : average.toFixed(1)}
                </Text>
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

          {/* AI mood uplift — GET /wellness/cbt/uplift */}
          {uplift && (
            <View style={styles.upliftCard}>
              <View style={styles.upliftHeader}>
                <Sparkles size={16} color={styles.iconAccent.color} strokeWidth={1.9} />
                <Text style={styles.upliftTitle}>{t('wellness.uplift_title')}</Text>
                {uplift.basedOnTodayMood ? (
                  <Text style={styles.upliftMood}>{uplift.basedOnTodayMood}</Text>
                ) : null}
              </View>
              <Text style={styles.upliftMessage}>{uplift.upliftMessage}</Text>
              <View style={styles.upliftRow}>
                <Text style={styles.upliftLabel}>{t('wellness.uplift_activity')}</Text>
                <Text style={styles.upliftValue}>{uplift.suggestedActivity}</Text>
              </View>
              <View style={styles.upliftRow}>
                <Text style={styles.upliftLabel}>{t('wellness.uplift_affirmation')}</Text>
                <Text style={styles.upliftValue}>{uplift.affirmation}</Text>
              </View>
            </View>
          )}

          {/* 7-day trend — server's lastSevenDays when available */}
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
                  {leadingFactors.map(({ label, count }) => (
                    <View key={label} style={styles.tag}>
                      <Text style={styles.tagText}>
                        {label} · {count}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Smart CBT recommendation — GET /wellness/cbt/recommendation */}
          {recommended && (
            <Pressable style={styles.recoCard} onPress={() => openExerciseSheet(recommended)}>
              <View style={styles.recoIconCircle}>
                <RecommendedIcon size={20} color={styles.iconOnPrimary.color} strokeWidth={1.9} />
              </View>
              <View style={styles.recoBody}>
                <Text style={styles.recoEyebrow}>
                  {recommendation?.basedOnMood
                    ? t('wellness.reco_based_on', { mood: recommendation.basedOnMood })
                    : t('wellness.reco_title')}
                </Text>
                <Text style={styles.recoTitle} numberOfLines={2}>
                  {recommended.title}
                </Text>
                <Text style={styles.recoMessage} numberOfLines={3}>
                  {recommendation?.message}
                </Text>
              </View>
            </Pressable>
          )}

          {/* CBT chat assistant — POST /wellness/cbt/chat + GET/DELETE history */}
          <View style={styles.sectionHeadRow}>
            <View style={styles.sectionHeadText}>
              <Text style={styles.sectionTitle}>{t('wellness.chat_title')}</Text>
              <Text style={styles.sectionSub}>{t('wellness.chat_sub')}</Text>
            </View>
            {chat.length > 0 && (
              <Pressable onPress={handleClearChat} style={styles.iconBtnSmall} hitSlop={8}>
                <Trash2 size={16} color={styles.iconMuted.color} strokeWidth={1.9} />
              </Pressable>
            )}
          </View>

          <View style={styles.chatCard}>
            {chat.length === 0 ? (
              <Text style={styles.chatEmpty}>{t('wellness.chat_empty')}</Text>
            ) : (
              chat.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.chatBubble,
                    msg.sender === 'USER' ? styles.chatBubbleUser : styles.chatBubbleBot,
                  ]}>
                  <Text
                    style={[
                      styles.chatText,
                      msg.sender === 'USER' ? styles.chatTextUser : styles.chatTextBot,
                    ]}>
                    {msg.message}
                  </Text>
                  {msg.suggestedTechnique ? (
                    <Text style={styles.chatTechnique}>{msg.suggestedTechnique}</Text>
                  ) : null}
                </View>
              ))
            )}

            {chatFellBack && <Text style={styles.chatFallbackNote}>{t('wellness.chat_offline_note')}</Text>}

            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                value={chatInput}
                onChangeText={setChatInput}
                placeholder={t('wellness.chat_placeholder')}
                placeholderTextColor={styles.placeholder.color}
                multiline
                editable={!chatSending}
              />
              <Pressable
                onPress={handleSendChat}
                disabled={chatSending || chatInput.trim().length === 0}
                style={[
                  styles.chatSendBtn,
                  (chatSending || chatInput.trim().length === 0) && styles.chatSendBtnDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('wellness.chat_send')}>
                {chatSending ? (
                  <ActivityIndicator size="small" color={styles.iconOnPrimary.color} />
                ) : (
                  <SendHorizontal size={16} color={styles.iconOnPrimary.color} strokeWidth={2} />
                )}
              </Pressable>
            </View>
          </View>

          {/* Offline CBT coach — the fallback that never needs the network */}
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

          {/* Exercise library — GET /wellness/exercises[?category] */}
          <Text style={styles.sectionTitle}>{t('wellness.ex_title')}</Text>
          <Text style={styles.sectionSub}>{t('wellness.ex_sub')}</Text>

          <View style={styles.chipRow}>
            <Pressable
              onPress={() => selectCategory(null)}
              style={[styles.chip, category === null && styles.chipActive]}>
              <Text style={[styles.chipText, category === null && styles.chipTextActive]}>
                {t('wellness.ex_cat_all')}
              </Text>
            </Pressable>
            {EXERCISE_CATEGORIES.map((cat) => {
              const Icon = EXERCISE_ICONS[cat];
              const active = category === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => selectCategory(cat)}
                  style={[styles.chip, active && styles.chipActive]}>
                  <Icon
                    size={13}
                    color={active ? styles.iconOnPrimary.color : styles.iconAccent.color}
                    strokeWidth={2}
                  />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {t(`wellness.ex_cat_${cat.toLowerCase()}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {exercises.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{t('wellness.ex_empty_title')}</Text>
              <Text style={styles.emptySub}>{t('wellness.ex_empty_sub')}</Text>
            </View>
          ) : (
            <View style={styles.guideGrid}>
              {exercises.map((exercise) => {
                const Icon = EXERCISE_ICONS[exercise.category] ?? Leaf;
                return (
                  <Pressable
                    key={exercise.id}
                    onPress={() => openExerciseSheet(exercise)}
                    style={[styles.guideCard, guideWidth ? { width: guideWidth } : styles.guideCardFull]}>
                    <View style={styles.guideIconCircle}>
                      <Icon size={20} color={styles.iconAccent.color} strokeWidth={1.8} />
                    </View>
                    <Text style={styles.guideTitle} numberOfLines={2}>
                      {exercise.title}
                    </Text>
                    <Text style={styles.guideSub} numberOfLines={3}>
                      {exercise.description}
                    </Text>
                    <View style={styles.guideMetaRow}>
                      <Timer size={12} color={styles.iconMuted.color} strokeWidth={2} />
                      <Text style={styles.guideMeta}>
                        {t('wellness.med_minutes', { count: exercise.durationMinutes })} ·{' '}
                        {t(`wellness.ex_cat_${exercise.category.toLowerCase()}`)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Timeline — GET /wellness/check-ins */}
          <Text style={styles.sectionTitle}>{t('wellness.history_title')}</Text>
          <Text style={styles.sectionSub}>{t('wellness.history_sub')}</Text>

          {loading && ordered.length === 0 ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color={styles.iconAccent.color} />
            </View>
          ) : ordered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{t('wellness.empty_title')}</Text>
              <Text style={styles.emptySub}>{t('wellness.empty_sub')}</Text>
            </View>
          ) : (
            <>
              {ordered.map((entry) => {
                const Icon = MOOD_ICONS[entry.level];
                const chips = [
                  ...entry.factors.map((f) => t(`wellness.factor_${f}`)),
                  ...(entry.extraTags ?? []),
                ];
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
                      {entry.reason ? <Text style={styles.entryReason}>{entry.reason}</Text> : null}
                      {entry.note.length > 0 && (
                        <Text style={styles.entryNote} numberOfLines={3}>
                          {entry.note}
                        </Text>
                      )}
                      {chips.length > 0 && (
                        <View style={styles.tagRow}>
                          {chips.map((label) => (
                            <View key={label} style={styles.tag}>
                              <Text style={styles.tagText}>{label}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}

              {hasMore && (
                <Pressable style={styles.loadMoreBtn} onPress={loadMore} disabled={busy}>
                  {busy ? (
                    <ActivityIndicator size="small" color={styles.iconAccent.color} />
                  ) : (
                    <Text style={styles.loadMoreText}>{t('wellness.load_more')}</Text>
                  )}
                </Pressable>
              )}
            </>
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

        <Text style={styles.label}>{t('wellness.label_reason')}</Text>
        <TextInput
          style={styles.input}
          value={reason}
          onChangeText={setReason}
          placeholder={t('wellness.placeholder_reason')}
          placeholderTextColor={styles.placeholder.color}
        />

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
          loading={busy}
          style={styles.modalCta}
        />

        {editingId && (
          <Pressable style={styles.modalRemoveBtn} onPress={handleDelete}>
            <Text style={styles.modalRemoveText}>{t('wellness.delete_entry')}</Text>
          </Pressable>
        )}
      </BottomSheet>

      {/* Exercise sheet — steps, then POST .../complete */}
      <BottomSheet
        visible={openExercise !== null}
        onClose={() => setOpenExercise(null)}
        title={openExercise ? openExercise.title : ''}>
        {openExercise && (
          <>
            <View style={styles.guideSheetMeta}>
              <Timer size={13} color={styles.iconMuted.color} strokeWidth={2} />
              <Text style={styles.guideMeta}>
                {t('wellness.med_minutes', { count: openExercise.durationMinutes })} ·{' '}
                {t(`wellness.ex_cat_${openExercise.category.toLowerCase()}`)}
              </Text>
            </View>
            <Text style={styles.guideSheetIntro}>{openExercise.description}</Text>
            {openExercise.steps.map((step, idx) => (
              <View key={`${openExercise.id}-${idx}`} style={styles.coachStepRow}>
                <View style={styles.coachStepNum}>
                  <Text style={styles.coachStepNumText}>{idx + 1}</Text>
                </View>
                <Text style={styles.coachStepText}>{step}</Text>
              </View>
            ))}
            <Text style={styles.coachDisclaimer}>{t('wellness.med_note')}</Text>
            <Button
              title={t('wellness.ex_complete')}
              onPress={() => handleCompleteExercise(openExercise)}
              loading={completing}
              style={styles.modalCta}
            />
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
    offlineBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md,
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
      marginTop: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    offlineText: {
      flex: 1,
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
    },
    sectionHeadRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    sectionHeadText: {
      flex: 1,
    },
    iconBtnSmall: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    upliftCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginBottom: spacing.xl,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.soft,
    },
    upliftHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: spacing.sm,
    },
    upliftTitle: {
      flex: 1,
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.textPrimary,
    },
    upliftMood: {
      fontFamily: fonts.sansBold,
      fontSize: 11,
      color: colors.textSecondary,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 3,
      overflow: 'hidden',
    },
    upliftMessage: {
      fontFamily: fonts.sans,
      fontSize: 14,
      lineHeight: 21,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    upliftRow: {
      marginTop: 6,
    },
    upliftLabel: {
      fontFamily: fonts.sansBold,
      fontSize: 11,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 2,
    },
    upliftValue: {
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
    },
    recoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.primary,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginBottom: spacing.xl,
      ...shadow.medium,
    },
    recoIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.textOnPrimaryMuted,
    },
    recoBody: {
      flex: 1,
    },
    recoEyebrow: {
      fontFamily: fonts.sansBold,
      fontSize: 10,
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      color: colors.textOnPrimaryMuted,
      marginBottom: 3,
    },
    recoTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textOnPrimary,
      marginBottom: 3,
    },
    recoMessage: {
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textOnPrimaryMuted,
    },
    chatCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.xl,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.soft,
    },
    chatEmpty: {
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 20,
      color: colors.textMuted,
      textAlign: 'center',
      paddingVertical: spacing.md,
    },
    chatBubble: {
      maxWidth: '88%',
      borderRadius: radius.lg,
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
      marginBottom: 8,
    },
    chatBubbleUser: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primary,
    },
    chatBubbleBot: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surfaceElevated,
    },
    chatText: {
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 19,
    },
    chatTextUser: {
      color: colors.textOnPrimary,
    },
    chatTextBot: {
      color: colors.textPrimary,
    },
    chatTechnique: {
      fontFamily: fonts.sansBold,
      fontSize: 10,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: colors.textMuted,
      marginTop: 6,
    },
    chatFallbackNote: {
      fontFamily: fonts.sans,
      fontSize: 11,
      lineHeight: 17,
      color: colors.textMuted,
      marginBottom: spacing.sm,
    },
    chatInputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      marginTop: spacing.sm,
    },
    chatInput: {
      flex: 1,
      maxHeight: 110,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textPrimary,
    },
    chatSendBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chatSendBtnDisabled: {
      opacity: 0.4,
    },
    entryReason: {
      fontFamily: fonts.sansBold,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
      marginTop: 2,
    },
    loadMoreBtn: {
      alignSelf: 'center',
      paddingVertical: 12,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginTop: spacing.sm,
      minHeight: 44,
      justifyContent: 'center',
    },
    loadMoreText: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.textPrimary,
    },
  });
