import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, Alert } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import BottomSheet from '../../../components/BottomSheet';
import Button from '../../../components/Button';
import { isValidDateString, parseDateString, toDateString, todayString } from '../../../utils/date';
import { dateLabel } from '../format';
import type { TripInput, WardrobeTrip } from '../types';
import { t } from '../../../i18n';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Present when editing; the form is pre-filled and packedItemIds are preserved. */
  trip?: WardrobeTrip | null;
  saving: boolean;
  onSubmit: (input: TripInput) => void;
}

/** Create/edit trip form. Validates title, both dates and end >= start before submitting. */
export default function TripFormSheet({ visible, onClose, trip, saving, onSubmit }: Props) {
  const styles = useThemedStyles(makeStyles);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [start, setStart] = useState(todayString());
  const [end, setEnd] = useState(todayString());
  const [pickerFor, setPickerFor] = useState<'start' | 'end' | null>(null);

  // Re-seed the form whenever the sheet opens.
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setTitle(trip?.title ?? '');
      setLocation(trip?.location ?? '');
      setNotes(trip?.notes ?? '');
      setStart(trip?.startDate && isValidDateString(trip.startDate) ? trip.startDate : todayString());
      setEnd(trip?.endDate && isValidDateString(trip.endDate) ? trip.endDate : todayString());
      setPickerFor(null);
    }
  }

  const handleDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    const target = pickerFor;
    setPickerFor(null);
    if (event.type === 'set' && selected && target) {
      const value = toDateString(selected);
      if (target === 'start') {
        setStart(value);
        if (end < value) setEnd(value);
      } else setEnd(value);
    }
  };

  const submit = () => {
    if (!title.trim()) {
      Alert.alert(t('trip.missing_title_title'), t('trip.missing_title_msg'));
      return;
    }
    if (!isValidDateString(start) || !isValidDateString(end)) {
      Alert.alert(t('style_pantry.error_title'), t('style_pantry.err_INVALID_DATE'));
      return;
    }
    if (end < start) {
      Alert.alert(t('style_pantry.error_title'), t('trip.date_invalid_range'));
      return;
    }
    onSubmit({
      title: title.trim(),
      startDate: start,
      endDate: end,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
      coverImageUri: trip?.coverImageUri,
      ...(trip ? { packedItemIds: trip.packedItemIds } : {}),
    });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={trip ? t('trip.edit_trip') : t('trip.new_trip')}>
      <Text style={styles.inputLabel}>{t('trip.title_label')}</Text>
      <TextInput
        style={styles.textInput}
        value={title}
        onChangeText={setTitle}
        placeholder={t('trip.title_placeholder')}
        placeholderTextColor={styles.placeholder.color}
      />
      <Text style={styles.inputLabel}>{t('trip.location_label')}</Text>
      <TextInput
        style={styles.textInput}
        value={location}
        onChangeText={setLocation}
        placeholder={t('trip.location_placeholder')}
        placeholderTextColor={styles.placeholder.color}
      />
      <View style={styles.dateRow}>
        <View style={styles.flex}>
          <Text style={styles.inputLabel}>{t('trip.start_date_label')}</Text>
          <Pressable style={styles.textInput} onPress={() => setPickerFor('start')} accessibilityLabel={t('trip.pick_date_label')}>
            <Text style={styles.valueText}>{dateLabel(start)}</Text>
          </Pressable>
        </View>
        <View style={styles.flex}>
          <Text style={styles.inputLabel}>{t('trip.end_date_label')}</Text>
          <Pressable style={styles.textInput} onPress={() => setPickerFor('end')} accessibilityLabel={t('trip.pick_date_label')}>
            <Text style={styles.valueText}>{dateLabel(end)}</Text>
          </Pressable>
        </View>
      </View>
      {pickerFor ? (
        <DateTimePicker
          value={parseDateString(pickerFor === 'start' ? start : end)}
          minimumDate={pickerFor === 'end' ? parseDateString(start) : undefined}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      ) : null}
      <Text style={styles.inputLabel}>{t('trip.notes_label')}</Text>
      <TextInput
        style={[styles.textInput, styles.notesInput]}
        value={notes}
        onChangeText={setNotes}
        placeholder={t('trip.notes_placeholder')}
        placeholderTextColor={styles.placeholder.color}
        multiline
      />
      <Button title={t('trip.save_trip')} onPress={submit} loading={saving} disabled={saving} style={styles.submit} />
    </BottomSheet>
  );
}

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) =>
  StyleSheet.create({
    flex: { flex: 1 },
    placeholder: { color: colors.textSecondary },
    inputLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.sm },
    textInput: {
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.textPrimary,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    notesInput: { minHeight: 72, textAlignVertical: 'top' },
    dateRow: { flexDirection: 'row', gap: spacing.sm },
    valueText: { fontFamily: fonts.sans, fontSize: 14, color: colors.textPrimary },
    submit: { marginTop: spacing.sm },
  });
