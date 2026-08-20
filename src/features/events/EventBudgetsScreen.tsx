import React, { useEffect, useMemo, useState } from 'react';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import type { RootStackParamList } from '../../app/_layout';
import BottomSheet from '../../components/BottomSheet';
import Button from '../../components/Button';
import Card from '../../components/Card';
import SectionHeader from '../../components/SectionHeader';
import useThemedStyles from '../../hooks/useThemedStyles';
import type { ThemeTokens } from '../../theme';
import { loadFamilyEventBudgets, saveFamilyEventBudgets } from './eventStore';
import type { FamilyEventBudget } from './types';

type Props = StackScreenProps<RootStackParamList, 'EventBudgets'>;

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(date.getDate()).padStart(2, '0')}`;
const displayDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
};

export default function EventBudgetsScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<FamilyEventBudget[]>([]);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [budget, setBudget] = useState('');
  const [spent, setSpent] = useState('0');
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    loadFamilyEventBudgets().then(setItems);
  }, []);
  const persist = async (next: FamilyEventBudget[]) => {
    setItems(next);
    await saveFamilyEventBudgets(next);
  };
  const totals = useMemo(
    () =>
      items.reduce(
        (summary, item) => ({
          budget: summary.budget + item.budget,
          spent: summary.spent + item.spent,
        }),
        { budget: 0, spent: 0 },
      ),
    [items],
  );
  const upcoming = items.filter(
    item =>
      new Date(`${item.date}T00:00:00`).getTime() >=
      new Date().setHours(0, 0, 0, 0),
  ).length;
  const openForm = (item?: FamilyEventBudget) => {
    setEditingId(item?.id ?? null);
    setName(item?.name ?? '');
    setDate(item?.date ?? '');
    setBudget(item ? String(item.budget) : '');
    setSpent(item ? String(item.spent) : '0');
    setNotes(item?.notes ?? '');
    setShowDatePicker(false);
    setSheetVisible(true);
  };
  const save = async () => {
    const numericBudget = Number(budget);
    const numericSpent = Number(spent);
    if (
      !name.trim() ||
      !date ||
      !Number.isFinite(numericBudget) ||
      numericBudget < 0 ||
      !Number.isFinite(numericSpent) ||
      numericSpent < 0
    ) {
      Alert.alert(
        'Complete the details',
        'Enter an event name, date, and valid budget amounts.',
      );
      return;
    }
    const entry = {
      name: name.trim(),
      date,
      budget: numericBudget,
      spent: numericSpent,
      notes: notes.trim(),
    };
    const next = editingId
      ? items.map(item =>
          item.id === editingId ? { ...item, ...entry } : item,
        )
      : [{ id: String(Date.now()), createdAt: Date.now(), ...entry }, ...items];
    await persist(next);
    setSheetVisible(false);
  };
  const remove = () => {
    if (!editingId) return;
    Alert.alert(
      'Delete event?',
      'This event and its budget summary will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await persist(items.filter(item => item.id !== editingId));
            setSheetVisible(false);
          },
        },
      ],
    );
  };
  const handleDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowDatePicker(false);
    if (event.type === 'set' && selected) setDate(toDateKey(selected));
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityLabel="Go back"
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={20} color={styles.backIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>Family events & budgets</Text>
        <Pressable
          accessibilityLabel="Add event"
          style={styles.addButton}
          onPress={() => openForm()}
        >
          <Text style={styles.addButtonText}>+</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.hero}>
          <View style={styles.heroIcon}>
            <CalendarDays size={24} color={styles.heroIconColor.color} />
          </View>
          <Text style={styles.heroTitle}>
            Every celebration, clearly planned
          </Text>
          <Text style={styles.heroText}>
            Keep event dates, budgets, and spend in one calm overview.
          </Text>
        </Card>
        <SectionHeader
          title="At a glance"
          subtitle="A quick breakdown across every event."
        />
        <View style={styles.metricGrid}>
          <Card style={styles.metric}>
            <Text style={styles.metricValue}>{items.length}</Text>
            <Text style={styles.metricLabel}>Events</Text>
          </Card>
          <Card style={styles.metric}>
            <Text style={styles.metricValue}>
              ₹{totals.budget.toLocaleString()}
            </Text>
            <Text style={styles.metricLabel}>Planned</Text>
          </Card>
          <Card style={styles.metric}>
            <Text style={styles.metricValue}>
              ₹{totals.spent.toLocaleString()}
            </Text>
            <Text style={styles.metricLabel}>Spent</Text>
          </Card>
          <Card style={styles.metric}>
            <Text style={styles.metricValue}>
              ₹{Math.max(totals.budget - totals.spent, 0).toLocaleString()}
            </Text>
            <Text style={styles.metricLabel}>Remaining</Text>
          </Card>
        </View>
        <Card style={styles.upcomingCard}>
          <Text style={styles.upcomingValue}>{upcoming}</Text>
          <Text style={styles.upcomingText}>
            upcoming {upcoming === 1 ? 'event' : 'events'} to prepare for
          </Text>
        </Card>
        <SectionHeader
          title="Events"
          subtitle="Tap an event to update its plan or budget."
          style={styles.sectionHeader}
        />
        <Button title="Add family event" onPress={() => openForm()} />
        {items.length === 0 ? (
          <Card style={styles.empty}>
            <Text style={styles.emptyTitle}>Start with an event</Text>
            <Text style={styles.emptyText}>
              Add a birthday, celebration, trip, or gathering and its budget.
            </Text>
          </Card>
        ) : (
          items
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(item => {
              const remaining = item.budget - item.spent;
              const overBudget = remaining < 0;
              return (
                <Pressable
                  key={item.id}
                  style={styles.eventRow}
                  onPress={() => openForm(item)}
                >
                  <View style={styles.eventCopy}>
                    <Text style={styles.eventName}>{item.name}</Text>
                    <Text style={styles.eventDate}>
                      {displayDate(item.date)}
                    </Text>
                    {item.notes ? (
                      <Text style={styles.eventNotes} numberOfLines={1}>
                        {item.notes}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.eventBudget}>
                    <Text style={styles.eventAmount}>
                      ₹{item.spent.toLocaleString()} / ₹
                      {item.budget.toLocaleString()}
                    </Text>
                    <Text
                      style={[
                        styles.eventRemaining,
                        overBudget && styles.overBudget,
                      ]}
                    >
                      {overBudget
                        ? `₹${Math.abs(remaining).toLocaleString()} over budget`
                        : `₹${remaining.toLocaleString()} remaining`}
                    </Text>
                  </View>
                </Pressable>
              );
            })
        )}
      </ScrollView>
      <BottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        title={editingId ? 'Edit event' : 'Add family event'}
      >
        <Text style={styles.label}>Event name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g., Diwali dinner"
          placeholderTextColor={styles.placeholder.color}
        />
        <Text style={styles.label}>Event date</Text>
        <Pressable style={styles.input} onPress={() => setShowDatePicker(true)}>
          <Text style={date ? styles.dateValue : styles.placeholder}>
            {date ? displayDate(date) : 'Choose a date'}
          </Text>
        </Pressable>
        {showDatePicker ? (
          <DateTimePicker
            value={date ? new Date(`${date}T00:00:00`) : new Date()}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        ) : null}
        <Text style={styles.label}>Planned budget</Text>
        <TextInput
          style={styles.input}
          value={budget}
          onChangeText={setBudget}
          keyboardType="decimal-pad"
          placeholder="e.g., 15000"
          placeholderTextColor={styles.placeholder.color}
        />
        <Text style={styles.label}>Amount spent</Text>
        <TextInput
          style={styles.input}
          value={spent}
          onChangeText={setSpent}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={styles.placeholder.color}
        />
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Guests, venue, tasks, or other details"
          placeholderTextColor={styles.placeholder.color}
          multiline
        />
        <Button
          title={editingId ? 'Save changes' : 'Add event'}
          onPress={save}
          style={styles.saveButton}
        />
        {editingId ? (
          <Pressable style={styles.deleteButton} onPress={remove}>
            <Text style={styles.deleteText}>Delete event</Text>
          </Pressable>
        ) : null}
      </BottomSheet>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
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
      flex: 1,
      marginLeft: spacing.md,
      fontFamily: fonts.serif,
      fontSize: 21,
      color: colors.textPrimary,
    },
    addButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    addButtonText: { fontSize: 24, color: colors.surface },
    content: { padding: spacing.lg },
    hero: { backgroundColor: colors.surfaceElevated, marginBottom: spacing.xl },
    heroIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.blush,
      marginBottom: spacing.md,
    },
    heroIconColor: { color: colors.primary },
    heroTitle: {
      fontFamily: fonts.serif,
      fontSize: 24,
      color: colors.textPrimary,
    },
    heroText: {
      marginTop: spacing.xs,
      fontFamily: fonts.sans,
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
    },
    metricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    metric: { width: '48%', padding: spacing.md },
    metricValue: {
      fontFamily: fonts.serif,
      fontSize: 20,
      color: colors.primary,
    },
    metricLabel: {
      marginTop: 3,
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.textSecondary,
    },
    upcomingCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.turmericSoft,
      marginBottom: spacing.xl,
    },
    upcomingValue: {
      fontFamily: fonts.serif,
      fontSize: 26,
      color: colors.textPrimary,
      marginRight: spacing.sm,
    },
    upcomingText: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textSecondary,
    },
    sectionHeader: { marginBottom: spacing.md },
    empty: { marginTop: spacing.md },
    emptyTitle: {
      fontFamily: fonts.serif,
      fontSize: 18,
      color: colors.textPrimary,
    },
    emptyText: {
      marginTop: spacing.xs,
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
    },
    eventRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    eventCopy: { flex: 1, paddingRight: spacing.sm },
    eventName: {
      fontFamily: fonts.sansMedium,
      fontSize: 15,
      color: colors.textPrimary,
    },
    eventDate: {
      marginTop: 2,
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.primary,
    },
    eventNotes: {
      marginTop: 3,
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textMuted,
    },
    eventBudget: { alignItems: 'flex-end' },
    eventAmount: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.textPrimary,
    },
    eventRemaining: {
      marginTop: 3,
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.forest,
    },
    overBudget: { color: colors.danger },
    label: {
      marginTop: spacing.md,
      marginBottom: spacing.xs,
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textPrimary,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      fontFamily: fonts.sans,
      fontSize: 15,
      color: colors.textPrimary,
    },
    placeholder: { color: colors.textMuted },
    dateValue: {
      fontFamily: fonts.sans,
      fontSize: 15,
      color: colors.textPrimary,
    },
    notesInput: { minHeight: 78, textAlignVertical: 'top' },
    saveButton: { marginTop: spacing.lg },
    deleteButton: { alignItems: 'center', paddingVertical: spacing.md },
    deleteText: {
      fontFamily: fonts.sansMedium,
      fontSize: 14,
      color: colors.danger,
    },
  });
