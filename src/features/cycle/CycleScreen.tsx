import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Switch, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { LucideIcon } from 'lucide-react-native';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Plus from 'lucide-react-native/icons/plus';
import Droplets from 'lucide-react-native/icons/droplets';
import Egg from 'lucide-react-native/icons/egg';
import Leaf from 'lucide-react-native/icons/leaf';
import MoonStar from 'lucide-react-native/icons/moon-star';
import Baby from 'lucide-react-native/icons/baby';
import Flower2 from 'lucide-react-native/icons/flower-2';
import Sparkles from 'lucide-react-native/icons/sparkles';
import CalendarHeart from 'lucide-react-native/icons/calendar-heart';
import Bell from 'lucide-react-native/icons/bell';
import Salad from 'lucide-react-native/icons/salad';
import Dumbbell from 'lucide-react-native/icons/dumbbell';
import Settings from 'lucide-react-native/icons/settings';
import type { RootStackParamList } from '../../app/_layout';
import type { ThemeTokens } from '../../theme';
import useThemedStyles from '../../hooks/useThemedStyles';
import useResponsive from '../../hooks/useResponsive';
import { subscribeToLanguageChanges, t } from '../../i18n';
import Button from '../../components/Button';
import BottomSheet from '../../components/BottomSheet';
import {
  addDays,
  createCycle,
  isValidISODate,
  loadCycleSettings,
  loadCycles,
  predictNextCycle,
  saveCycleSettings,
  saveCycles,
  sortCycles,
  todayISO,
  upcomingReminders,
} from './cycleStore';
import {
  CYCLE_SYMPTOMS,
  DEFAULT_CYCLE_SETTINGS,
  FLOW_LEVELS,
  GUIDANCE_ITEMS_PER_STAGE,
  LIFE_STAGES,
  type CyclePhase,
  type CycleSettings,
  type CycleSymptom,
  type FlowLevel,
  type ISODate,
  type LifeStage,
  type PeriodCycle,
} from './types';

type Props = StackScreenProps<RootStackParamList, 'Cycle'>;

const PHASE_ICONS: Record<CyclePhase, LucideIcon> = {
  menstrual: Droplets,
  follicular: Leaf,
  ovulation: Egg,
  luteal: MoonStar,
};

const STAGE_ICONS: Record<LifeStage, LucideIcon> = {
  cycling: CalendarHeart,
  fertility: Egg,
  postpartum: Baby,
  perimenopause: Flower2,
  menopause: Sparkles,
};

export default function CycleScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const r = useResponsive();
  const insets = useSafeAreaInsets();

  const [cycles, setCycles] = useState<PeriodCycle[]>([]);
  const [settings, setSettings] = useState<CycleSettings>(DEFAULT_CYCLE_SETTINGS);
  const [localeVersion, setLocaleVersion] = useState(0);

  // Log sheet
  const [showLogSheet, setShowLogSheet] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<ISODate>(todayISO());
  const [endDate, setEndDate] = useState<string>('');
  const [flow, setFlow] = useState<FlowLevel>('medium');
  const [symptoms, setSymptoms] = useState<CycleSymptom[]>([]);
  const [note, setNote] = useState('');

  // Settings sheet
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [cycleLengthDraft, setCycleLengthDraft] = useState('28');
  const [periodLengthDraft, setPeriodLengthDraft] = useState('5');

  useEffect(() => {
    loadCycles().then(setCycles);
    loadCycleSettings().then(setSettings);
    const unsubscribe = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    return () => {
      unsubscribe();
    };
  }, []);

  const today = todayISO();
  const ordered = useMemo(() => sortCycles(cycles).reverse(), [cycles]);
  const prediction = useMemo(() => predictNextCycle(cycles, settings, today), [cycles, settings, today]);
  const reminders = useMemo(
    () => upcomingReminders(cycles, settings, prediction, today),
    [cycles, settings, prediction, today],
  );

  const persistCycles = useCallback(async (updated: PeriodCycle[]) => {
    setCycles(updated);
    await saveCycles(updated);
  }, []);

  const persistSettings = useCallback(async (updated: CycleSettings) => {
    setSettings(updated);
    await saveCycleSettings(updated);
  }, []);

  // ---- logging ------------------------------------------------------------

  const openLogSheet = () => {
    setEditingId(null);
    setStartDate(today);
    setEndDate('');
    setFlow('medium');
    setSymptoms([]);
    setNote('');
    setShowLogSheet(true);
  };

  const openEditSheet = (cycle: PeriodCycle) => {
    setEditingId(cycle.id);
    setStartDate(cycle.startDate);
    setEndDate(cycle.endDate ?? '');
    setFlow(cycle.flow);
    setSymptoms(cycle.symptoms);
    setNote(cycle.note);
    setShowLogSheet(true);
  };

  const toggleSymptom = (symptom: CycleSymptom) => {
    setSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom],
    );
  };

  const handleSave = async () => {
    // No date-picker dependency exists in this project and adding one needs approval
    // (agent.md rule 7), so the field is a text input with day steppers — which means
    // the validation below is the only thing standing between a typo and a prediction
    // computed from a nonsense date.
    if (!isValidISODate(startDate)) {
      Alert.alert(t('cycle.invalid_title'), t('cycle.invalid_start_msg'));
      return;
    }
    const end = endDate.trim();
    if (end.length > 0 && (!isValidISODate(end) || end < startDate)) {
      Alert.alert(t('cycle.invalid_title'), t('cycle.invalid_end_msg'));
      return;
    }
    const normalisedEnd = end.length > 0 ? end : null;

    if (editingId) {
      await persistCycles(
        cycles.map((c) =>
          c.id === editingId
            ? { ...c, startDate, endDate: normalisedEnd, flow, symptoms, note: note.trim() }
            : c,
        ),
      );
    } else {
      const duplicate = cycles.some((c) => c.startDate === startDate);
      if (duplicate) {
        Alert.alert(t('cycle.invalid_title'), t('cycle.duplicate_msg'));
        return;
      }
      await persistCycles([...cycles, createCycle(startDate, normalisedEnd, flow, symptoms, note)]);
    }
    setShowLogSheet(false);
  };

  const handleDelete = () => {
    if (!editingId) {
      return;
    }
    Alert.alert(t('cycle.delete_confirm_title'), t('cycle.delete_confirm_msg'), [
      { text: t('cycle.cancel'), style: 'cancel' },
      {
        text: t('cycle.delete'),
        style: 'destructive',
        onPress: async () => {
          await persistCycles(cycles.filter((c) => c.id !== editingId));
          setShowLogSheet(false);
        },
      },
    ]);
  };

  const stepStart = (days: number) => setStartDate((prev) => addDays(prev, days));
  const stepEnd = (days: number) =>
    setEndDate((prev) => (prev.trim().length === 0 ? startDate : addDays(prev.trim(), days)));

  // ---- settings -----------------------------------------------------------

  const openSettingsSheet = () => {
    setCycleLengthDraft(String(settings.averageCycleLength));
    setPeriodLengthDraft(String(settings.averagePeriodLength));
    setShowSettingsSheet(true);
  };

  const handleSaveSettings = async () => {
    const cycleLength = parseInt(cycleLengthDraft, 10);
    const periodLength = parseInt(periodLengthDraft, 10);
    if (Number.isNaN(cycleLength) || cycleLength < 15 || cycleLength > 60) {
      Alert.alert(t('cycle.invalid_title'), t('cycle.invalid_cycle_length_msg'));
      return;
    }
    if (Number.isNaN(periodLength) || periodLength < 1 || periodLength > 14) {
      Alert.alert(t('cycle.invalid_title'), t('cycle.invalid_period_length_msg'));
      return;
    }
    await persistSettings({ ...settings, averageCycleLength: cycleLength, averagePeriodLength: periodLength });
    setShowSettingsSheet(false);
  };

  const setLifeStage = (lifeStage: LifeStage) => persistSettings({ ...settings, lifeStage });

  // ---- responsive layout numbers -----------------------------------------

  const gutter = r.isCompact ? 12 : 16;
  const guidanceColumns = r.columns(260, 2);
  const guidanceWidth =
    guidanceColumns === 1 ? undefined : r.columnWidth(guidanceColumns, 12, gutter);
  const progressHeight = r.scale(8, 1, 1.6);
  const singleColumnStats = r.isCompact;

  const formatDate = (iso: ISODate) =>
    fromISOForDisplay(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const formatLongDate = (iso: ISODate) =>
    fromISOForDisplay(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  const PhaseIcon = prediction ? PHASE_ICONS[prediction.phase] : Flower2;
  const stageGuidanceIndexes = Array.from({ length: GUIDANCE_ITEMS_PER_STAGE }, (_, i) => i + 1);

  // Progress round the cycle, clamped: a very late period shouldn't render past full.
  const cycleProgress = prediction
    ? Math.max(0, Math.min(1, prediction.dayOfCycle / prediction.averageCycleLength))
    : 0;

  return (
    <View style={styles.root} key={localeVersion}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8, paddingHorizontal: gutter }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={8}>
          <ArrowLeft size={20} color={styles.iconOnSurface.color} strokeWidth={1.9} />
        </Pressable>
        <Text style={[styles.headerTitle, { fontSize: r.font(20) }]} numberOfLines={1}>
          {t('cycle.header_title')}
        </Text>
        <View style={styles.headerActions}>
          <Pressable onPress={openSettingsSheet} style={styles.iconBtn} hitSlop={8}>
            <Settings size={18} color={styles.iconOnSurface.color} strokeWidth={1.9} />
          </Pressable>
          <Pressable onPress={openLogSheet} style={styles.addBtn} hitSlop={8}>
            <Plus size={14} color={styles.iconOnPrimary.color} strokeWidth={2.4} />
            <Text style={styles.addBtnText}>{t('cycle.add_btn')}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: gutter }]}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.content, { maxWidth: r.contentMaxWidth }]}>
          {/* Hero — current phase and the headline number */}
          <View style={[styles.hero, { padding: r.scale(20) }]}>
            <View style={styles.heroHeadRow}>
              <View style={styles.heroIconCircle}>
                <PhaseIcon size={20} color={styles.iconOnPrimary.color} strokeWidth={1.9} />
              </View>
              <View style={styles.heroHeadText}>
                <Text style={[styles.heroTitle, { fontSize: r.font(22) }]} numberOfLines={2}>
                  {prediction ? t(`cycle.phase_${prediction.phase}`) : t('cycle.hero_no_data_title')}
                </Text>
                <Text style={styles.heroSubtitle}>
                  {prediction
                    ? t('cycle.hero_day', { day: prediction.dayOfCycle })
                    : t('cycle.hero_no_data_sub')}
                </Text>
              </View>
            </View>

            {prediction && (
              <>
                {/* Cycle progress — a proportional bar rather than a decorative ring,
                    so it stays readable at 320dp and at tablet width alike. */}
                <View style={[styles.progressTrack, { height: progressHeight }]}>
                  <View style={[styles.progressFill, { width: `${cycleProgress * 100}%` }]} />
                </View>
                <Text style={styles.progressCaption}>
                  {t('cycle.progress_caption', {
                    day: prediction.dayOfCycle,
                    length: prediction.averageCycleLength,
                  })}
                </Text>

                <View style={[styles.statsRow, singleColumnStats && styles.statsColumn]}>
                  <View style={[styles.statChip, singleColumnStats && styles.statChipWide]}>
                    <Text style={styles.statNum}>
                      {prediction.daysUntilNextStart < 0
                        ? t('cycle.late_by', { days: Math.abs(prediction.daysUntilNextStart) })
                        : prediction.daysUntilNextStart}
                    </Text>
                    <Text style={styles.statLabel}>
                      {prediction.daysUntilNextStart < 0
                        ? t('cycle.stat_late')
                        : t('cycle.stat_days_to_period')}
                    </Text>
                  </View>
                  <View style={[styles.statChip, singleColumnStats && styles.statChipWide]}>
                    <Text style={styles.statNum}>{prediction.averageCycleLength}</Text>
                    <Text style={styles.statLabel}>{t('cycle.stat_cycle_length')}</Text>
                  </View>
                  <View style={[styles.statChip, singleColumnStats && styles.statChipWide]}>
                    <Text style={styles.statNum}>{cycles.length}</Text>
                    <Text style={styles.statLabel}>{t('cycle.stat_logged')}</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Life stage */}
          <Text style={styles.sectionTitle}>{t('cycle.stage_title')}</Text>
          <Text style={styles.sectionSub}>{t('cycle.stage_sub')}</Text>
          <View style={styles.chipRow}>
            {LIFE_STAGES.map((stage) => {
              const Icon = STAGE_ICONS[stage];
              const active = settings.lifeStage === stage;
              return (
                <Pressable
                  key={stage}
                  onPress={() => setLifeStage(stage)}
                  style={[styles.chip, active && styles.chipActive]}>
                  <Icon
                    size={13}
                    color={active ? styles.iconOnPrimary.color : styles.iconAccent.color}
                    strokeWidth={2}
                  />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {t(`cycle.stage_${stage}_name`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.stageDescBox}>
            <Text style={styles.stageDescText}>{t(`cycle.stage_${settings.lifeStage}_desc`)}</Text>
          </View>

          {/* Prediction */}
          <Text style={styles.sectionTitle}>{t('cycle.prediction_title')}</Text>
          <Text style={styles.sectionSub}>{t('cycle.prediction_sub')}</Text>

          {prediction === null ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {settings.lifeStage === 'menopause'
                  ? t('cycle.prediction_menopause_title')
                  : t('cycle.prediction_empty_title')}
              </Text>
              <Text style={styles.emptySub}>
                {settings.lifeStage === 'menopause'
                  ? t('cycle.prediction_menopause_sub')
                  : t('cycle.prediction_empty_sub')}
              </Text>
            </View>
          ) : (
            <View style={styles.panel}>
              <View style={styles.predictionRow}>
                <View style={styles.predictionIconCircle}>
                  <Droplets size={16} color={styles.iconAccent.color} strokeWidth={2} />
                </View>
                <View style={styles.predictionBody}>
                  <Text style={styles.predictionLabel}>{t('cycle.next_period')}</Text>
                  <Text style={styles.predictionValue}>{formatLongDate(prediction.nextStart)}</Text>
                </View>
              </View>

              {settings.lifeStage !== 'postpartum' && settings.lifeStage !== 'perimenopause' && (
                <>
                  <View style={styles.predictionRow}>
                    <View style={styles.predictionIconCircle}>
                      <Egg size={16} color={styles.iconAccent.color} strokeWidth={2} />
                    </View>
                    <View style={styles.predictionBody}>
                      <Text style={styles.predictionLabel}>{t('cycle.ovulation')}</Text>
                      <Text style={styles.predictionValue}>{formatLongDate(prediction.ovulationDate)}</Text>
                    </View>
                  </View>

                  <View style={styles.predictionRow}>
                    <View style={styles.predictionIconCircle}>
                      <Sparkles size={16} color={styles.iconAccent.color} strokeWidth={2} />
                    </View>
                    <View style={styles.predictionBody}>
                      <Text style={styles.predictionLabel}>{t('cycle.fertile_window')}</Text>
                      <Text style={styles.predictionValue}>
                        {formatDate(prediction.fertileStart)} – {formatDate(prediction.fertileEnd)}
                      </Text>
                    </View>
                  </View>
                </>
              )}

              <View style={styles.confidenceRow}>
                <View
                  style={[
                    styles.confidenceBadge,
                    prediction.confidence === 'low' && styles.confidenceBadgeLow,
                  ]}>
                  <Text
                    style={[
                      styles.confidenceText,
                      prediction.confidence === 'low' && styles.confidenceTextLow,
                    ]}>
                    {t(`cycle.confidence_${prediction.confidence}`)}
                  </Text>
                </View>
                <Text style={styles.confidenceNote}>
                  {t('cycle.confidence_note', { count: prediction.samples })}
                </Text>
              </View>
              <Text style={styles.disclaimer}>{t('cycle.prediction_disclaimer')}</Text>
            </View>
          )}

          {/* Reminders */}
          <Text style={styles.sectionTitle}>{t('cycle.reminders_title')}</Text>
          <Text style={styles.sectionSub}>{t('cycle.reminders_sub')}</Text>
          <View style={styles.panel}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabelBox}>
                <Text style={styles.switchLabel}>{t('cycle.reminders_toggle')}</Text>
                <Text style={styles.switchHint}>{t('cycle.reminders_pending_note')}</Text>
              </View>
              <Switch
                value={settings.remindersEnabled}
                onValueChange={(value) => persistSettings({ ...settings, remindersEnabled: value })}
                trackColor={{ false: styles.switchTrackOff.color, true: styles.switchTrackOn.color }}
                thumbColor={styles.switchThumb.color}
              />
            </View>

            {reminders.length === 0 ? (
              <Text style={styles.reminderEmpty}>{t('cycle.reminders_empty')}</Text>
            ) : (
              reminders.map((reminder) => (
                <View key={reminder.id} style={styles.reminderRow}>
                  <View style={styles.predictionIconCircle}>
                    <Bell size={14} color={styles.iconAccent.color} strokeWidth={2} />
                  </View>
                  <View style={styles.predictionBody}>
                    <Text style={styles.reminderTitle}>{t(`cycle.reminder_${reminder.kind}`)}</Text>
                    <Text style={styles.reminderMeta}>
                      {formatLongDate(reminder.date)}
                      {reminder.daysAway > 0
                        ? ` · ${t('cycle.reminder_in_days', { count: reminder.daysAway })}`
                        : ''}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Life-stage guidance */}
          <Text style={styles.sectionTitle}>{t('cycle.guidance_title')}</Text>
          <Text style={styles.sectionSub}>
            {t('cycle.guidance_sub', { stage: t(`cycle.stage_${settings.lifeStage}_name`) })}
          </Text>
          <View style={styles.guidanceGrid}>
            <View style={[styles.guidanceCard, guidanceWidth ? { width: guidanceWidth } : styles.guidanceCardFull]}>
              <View style={styles.guidanceHeadRow}>
                <View style={styles.guidanceIconCircle}>
                  <Salad size={18} color={styles.iconAccent.color} strokeWidth={1.9} />
                </View>
                <Text style={styles.guidanceTitle}>{t('cycle.guidance_nutrition')}</Text>
              </View>
              {stageGuidanceIndexes.map((i) => (
                <View key={i} style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bulletText}>
                    {t(`cycle.stage_${settings.lifeStage}_nutrition_${i}`)}
                  </Text>
                </View>
              ))}
            </View>

            <View style={[styles.guidanceCard, guidanceWidth ? { width: guidanceWidth } : styles.guidanceCardFull]}>
              <View style={styles.guidanceHeadRow}>
                <View style={styles.guidanceIconCircle}>
                  <Dumbbell size={18} color={styles.iconAccent.color} strokeWidth={1.9} />
                </View>
                <Text style={styles.guidanceTitle}>{t('cycle.guidance_exercise')}</Text>
              </View>
              {stageGuidanceIndexes.map((i) => (
                <View key={i} style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bulletText}>
                    {t(`cycle.stage_${settings.lifeStage}_exercise_${i}`)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* History */}
          <Text style={styles.sectionTitle}>{t('cycle.history_title')}</Text>
          <Text style={styles.sectionSub}>{t('cycle.history_sub')}</Text>

          {ordered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{t('cycle.empty_title')}</Text>
              <Text style={styles.emptySub}>{t('cycle.empty_sub')}</Text>
            </View>
          ) : (
            ordered.map((cycle) => (
              <Pressable key={cycle.id} style={styles.entryCard} onPress={() => openEditSheet(cycle)}>
                <View style={styles.entryIconCircle}>
                  <Droplets size={18} color={styles.iconAccent.color} strokeWidth={1.8} />
                </View>
                <View style={styles.entryBody}>
                  <View style={styles.entryHeadRow}>
                    <Text style={styles.entryDate}>
                      {formatLongDate(cycle.startDate)}
                      {cycle.endDate ? ` – ${formatDate(cycle.endDate)}` : ''}
                    </Text>
                    <Text style={styles.entryFlow}>{t(`cycle.flow_${cycle.flow}`)}</Text>
                  </View>
                  {cycle.endDate === null && (
                    <Text style={styles.entryOpen}>{t('cycle.entry_ongoing')}</Text>
                  )}
                  {cycle.note.length > 0 && (
                    <Text style={styles.entryNote} numberOfLines={2}>
                      {cycle.note}
                    </Text>
                  )}
                  {cycle.symptoms.length > 0 && (
                    <View style={styles.tagRow}>
                      {cycle.symptoms.map((symptom) => (
                        <View key={symptom} style={styles.tag}>
                          <Text style={styles.tagText}>{t(`cycle.symptom_${symptom}`)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </Pressable>
            ))
          )}

          <Text style={styles.privacyNote}>{t('cycle.privacy_note')}</Text>
        </View>
      </ScrollView>

      {/* Log / edit sheet */}
      <BottomSheet
        visible={showLogSheet}
        onClose={() => setShowLogSheet(false)}
        title={editingId ? t('cycle.sheet_title_edit') : t('cycle.sheet_title_add')}>
        <Text style={styles.label}>{t('cycle.label_start')}</Text>
        <View style={styles.dateRow}>
          <Pressable style={styles.stepBtn} onPress={() => stepStart(-1)} hitSlop={6}>
            <Text style={styles.stepBtnText}>−</Text>
          </Pressable>
          <TextInput
            style={[styles.input, styles.dateInput]}
            value={startDate}
            onChangeText={setStartDate}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t('cycle.placeholder_date')}
            placeholderTextColor={styles.placeholder.color}
          />
          <Pressable style={styles.stepBtn} onPress={() => stepStart(1)} hitSlop={6}>
            <Text style={styles.stepBtnText}>+</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => setStartDate(today)} style={styles.todayLink} hitSlop={6}>
          <Text style={styles.todayLinkText}>{t('cycle.set_today')}</Text>
        </Pressable>

        <Text style={styles.label}>{t('cycle.label_end')}</Text>
        <View style={styles.dateRow}>
          <Pressable style={styles.stepBtn} onPress={() => stepEnd(-1)} hitSlop={6}>
            <Text style={styles.stepBtnText}>−</Text>
          </Pressable>
          <TextInput
            style={[styles.input, styles.dateInput]}
            value={endDate}
            onChangeText={setEndDate}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t('cycle.placeholder_end')}
            placeholderTextColor={styles.placeholder.color}
          />
          <Pressable style={styles.stepBtn} onPress={() => stepEnd(1)} hitSlop={6}>
            <Text style={styles.stepBtnText}>+</Text>
          </Pressable>
        </View>
        <Text style={styles.fieldHint}>{t('cycle.end_hint')}</Text>

        <Text style={styles.label}>{t('cycle.label_flow')}</Text>
        <View style={styles.chipRow}>
          {FLOW_LEVELS.map((value) => (
            <Pressable
              key={value}
              onPress={() => setFlow(value)}
              style={[styles.chip, flow === value && styles.chipActive]}>
              <Text style={[styles.chipText, flow === value && styles.chipTextActive]}>
                {t(`cycle.flow_${value}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>{t('cycle.label_symptoms')}</Text>
        <View style={styles.chipRow}>
          {CYCLE_SYMPTOMS.map((symptom) => {
            const active = symptoms.includes(symptom);
            return (
              <Pressable
                key={symptom}
                onPress={() => toggleSymptom(symptom)}
                style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {t(`cycle.symptom_${symptom}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>{t('cycle.label_note')}</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          placeholder={t('cycle.placeholder_note')}
          placeholderTextColor={styles.placeholder.color}
        />

        <Button
          title={editingId ? t('cycle.save_changes') : t('cycle.save_entry')}
          onPress={handleSave}
          style={styles.modalCta}
        />

        {editingId && (
          <Pressable style={styles.modalRemoveBtn} onPress={handleDelete}>
            <Text style={styles.modalRemoveText}>{t('cycle.delete_entry')}</Text>
          </Pressable>
        )}
      </BottomSheet>

      {/* Settings sheet */}
      <BottomSheet
        visible={showSettingsSheet}
        onClose={() => setShowSettingsSheet(false)}
        title={t('cycle.settings_title')}>
        <Text style={styles.fieldHint}>{t('cycle.settings_sub')}</Text>

        <Text style={styles.label}>{t('cycle.label_avg_cycle')}</Text>
        <TextInput
          style={styles.input}
          value={cycleLengthDraft}
          onChangeText={setCycleLengthDraft}
          keyboardType="number-pad"
          placeholder="28"
          placeholderTextColor={styles.placeholder.color}
        />

        <Text style={styles.label}>{t('cycle.label_avg_period')}</Text>
        <TextInput
          style={styles.input}
          value={periodLengthDraft}
          onChangeText={setPeriodLengthDraft}
          keyboardType="number-pad"
          placeholder="5"
          placeholderTextColor={styles.placeholder.color}
        />

        <Button title={t('cycle.save_settings')} onPress={handleSaveSettings} style={styles.modalCta} />
      </BottomSheet>
    </View>
  );
}

// Display-only parse. `cycleStore.fromISODate` is the arithmetic one; this is kept
// local so the screen never reaches for date maths it should be asking the store for.
function fromISOForDisplay(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
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
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
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
    heroHeadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    heroIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.textOnPrimaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroHeadText: {
      flex: 1,
    },
    heroTitle: {
      fontFamily: fonts.serif,
      color: colors.textOnPrimary,
    },
    heroSubtitle: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textOnPrimaryMuted,
      marginTop: 2,
    },
    progressTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.textOnPrimaryMuted,
      overflow: 'hidden',
      marginTop: spacing.lg,
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
      backgroundColor: colors.textOnPrimary,
    },
    progressCaption: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textOnPrimaryMuted,
      marginTop: 6,
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
    stageDescBox: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginTop: spacing.md,
      marginBottom: spacing.xl,
    },
    stageDescText: {
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 19,
      color: colors.textSecondary,
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
    predictionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    predictionIconCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.blush,
      alignItems: 'center',
      justifyContent: 'center',
    },
    predictionBody: {
      flex: 1,
    },
    predictionLabel: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    predictionValue: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.textPrimary,
      marginTop: 2,
    },
    confidenceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      flexWrap: 'wrap',
    },
    confidenceBadge: {
      backgroundColor: colors.blush,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    confidenceBadgeLow: {
      backgroundColor: colors.turmericSoft,
      borderColor: colors.turmeric,
    },
    confidenceText: {
      fontFamily: fonts.sansBold,
      fontSize: 10,
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    confidenceTextLow: {
      color: colors.turmeric,
    },
    confidenceNote: {
      flex: 1,
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textMuted,
    },
    disclaimer: {
      fontFamily: fonts.sans,
      fontSize: 10,
      lineHeight: 15,
      color: colors.textMuted,
      marginTop: spacing.sm,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    switchLabelBox: {
      flex: 1,
    },
    switchLabel: {
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.textPrimary,
    },
    switchHint: {
      fontFamily: fonts.sans,
      fontSize: 11,
      lineHeight: 16,
      color: colors.textMuted,
      marginTop: 2,
    },
    reminderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingTop: spacing.md,
    },
    reminderTitle: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textPrimary,
    },
    reminderMeta: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    reminderEmpty: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textMuted,
      paddingTop: spacing.md,
    },
    guidanceGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: spacing.xl,
    },
    guidanceCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadow.soft,
    },
    guidanceCardFull: {
      width: '100%',
    },
    guidanceHeadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    guidanceIconCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.blush,
      alignItems: 'center',
      justifyContent: 'center',
    },
    guidanceTitle: {
      flex: 1,
      fontFamily: fonts.serif,
      fontSize: 15,
      color: colors.textPrimary,
    },
    bulletRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: spacing.sm,
    },
    bulletDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: colors.primary,
      marginTop: 7,
    },
    bulletText: {
      flex: 1,
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 19,
      color: colors.textSecondary,
    },
    emptyState: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
      borderStyle: 'dashed',
      padding: spacing.xl,
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    emptyTitle: {
      fontFamily: fonts.serif,
      fontSize: 16,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    emptySub: {
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 18,
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
    entryDate: {
      flex: 1,
      fontFamily: fonts.sansBold,
      fontSize: 13,
      color: colors.textPrimary,
    },
    entryFlow: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: colors.textMuted,
    },
    entryOpen: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: colors.turmeric,
      marginTop: 2,
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
    fieldHint: {
      fontFamily: fonts.sans,
      fontSize: 11,
      lineHeight: 16,
      color: colors.textMuted,
      marginTop: 6,
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
      minHeight: 80,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    dateInput: {
      flex: 1,
      textAlign: 'center',
    },
    stepBtn: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBtnText: {
      fontFamily: fonts.sansBold,
      fontSize: 18,
      color: colors.textPrimary,
    },
    todayLink: {
      alignSelf: 'flex-start',
      marginTop: 8,
    },
    todayLinkText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.primary,
    },
    // Props, not styles — kept in the factory so the palette is read in one place.
    placeholder: {
      color: colors.textMuted,
    },
    iconAccent: {
      color: colors.primary,
    },
    iconOnSurface: {
      color: colors.textPrimary,
    },
    iconOnPrimary: {
      color: colors.textOnPrimary,
    },
    switchTrackOff: {
      color: colors.border,
    },
    switchTrackOn: {
      color: colors.primary,
    },
    switchThumb: {
      color: colors.surfaceElevated,
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
