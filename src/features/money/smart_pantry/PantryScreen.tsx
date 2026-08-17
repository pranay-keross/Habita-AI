import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import BottomSheet from '../../../components/BottomSheet';
import Button from '../../../components/Button';
import { loadPantry, savePantry } from './pantryStore';
import type { AllergenTag, PantryItem } from './types';

type Props = StackScreenProps<RootStackParamList, 'Pantry'>;

const ALLERGEN_CHIPS: { tag: AllergenTag; label: string; icon: string }[] = [
  { tag: 'nut-free', label: 'Nut-Free', icon: '🥜' },
  { tag: 'gluten-free', label: 'Gluten-Free', icon: '🌾' },
  { tag: 'dairy-free', label: 'Dairy-Free', icon: '🥛' },
  { tag: 'vegan', label: 'Vegan', icon: '🌿' },
  { tag: 'halal', label: 'Halal', icon: '🌙' },
];

export default function PantryScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PantryItem[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<AllergenTag | 'all'>('all');

  // Form State
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('pack');
  const [expiryDate, setExpiryDate] = useState('2026-08-30');
  const [selectedAllergens, setSelectedAllergens] = useState<AllergenTag[]>(['nut-free']);
  const [saving, setSaving] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    const list = await loadPantry();
    setItems(list);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const filteredItems = selectedFilter === 'all'
    ? items
    : items.filter((i) => i.allergens.includes(selectedFilter));

  const handleAddItem = async () => {
    if (!name.trim()) {
      Alert.alert('Incomplete Info', 'Please enter item name.');
      return;
    }
    setSaving(true);
    const newItem: PantryItem = {
      id: `p_${Date.now()}`,
      name: name.trim(),
      category: 'produce',
      quantity: parseInt(quantity, 10) || 1,
      unit,
      expiryDate,
      allergens: selectedAllergens,
    };
    const updated = [...items, newItem];
    await savePantry(updated);
    setItems(updated);
    setShowAddSheet(false);
    setName('');
    setSaving(false);
  };

  const toggleAllergen = (tag: AllergenTag) => {
    setSelectedAllergens((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleDelete = (id: string) => {
    Alert.alert('Remove Item', 'Remove this item from pantry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const updated = items.filter((i) => i.id !== id);
          await savePantry(updated);
          setItems(updated);
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Smart Pantry & Allergen Radar</Text>
        <Pressable onPress={() => setShowAddSheet(true)} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ Item</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Smart Inventory & Allergen Radar</Text>
          <Text style={styles.heroSub}>
            Track pantry stock, auto-detect dietary allergens, and get zero-waste recipe recommendations.
          </Text>

          <View style={styles.recipeCard}>
            <Text style={styles.recipeTitle}>💡 Zero-Waste Recipe Suggestion</Text>
            <Text style={styles.recipeSub}>
              You have fresh eggs and almond milk expiring soon — try making a Gluten-Free Omelette Bowl!
            </Text>
          </View>
        </View>

        {/* Allergen Radar Filter Pills */}
        <Text style={styles.sectionTitle}>Allergen Filter Radar</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <Pressable
            style={[styles.filterChip, selectedFilter === 'all' && styles.filterChipActive]}
            onPress={() => setSelectedFilter('all')}>
            <Text style={[styles.filterChipText, selectedFilter === 'all' && styles.filterChipTextActive]}>
              All Items ({items.length})
            </Text>
          </Pressable>
          {ALLERGEN_CHIPS.map((chip) => (
            <Pressable
              key={chip.tag}
              style={[styles.filterChip, selectedFilter === chip.tag && styles.filterChipActive]}
              onPress={() => setSelectedFilter(chip.tag)}>
              <Text
                style={[
                  styles.filterChipText,
                  selectedFilter === chip.tag && styles.filterChipTextActive,
                ]}>
                {chip.icon} {chip.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={styles.addBtnText.color} style={{ marginTop: 40 }} />
        ) : (
          filteredItems.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemMainRow}>
                <View style={styles.itemEmojiCircle}>
                  <Text style={{ fontSize: 20 }}>🛒</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemSub}>
                    Qty: {item.quantity} {item.unit} · Expires {item.expiryDate}
                  </Text>
                </View>
                <Pressable onPress={() => handleDelete(item.id)}>
                  <Text style={styles.crossText}>×</Text>
                </Pressable>
              </View>

              {/* Allergen Badges */}
              <View style={styles.allergenBadgeRow}>
                {item.allergens.map((tag) => (
                  <View key={tag} style={styles.tagBadge}>
                    <Text style={styles.tagBadgeText}>
                      ✓ {ALLERGEN_CHIPS.find((c) => c.tag === tag)?.label || tag}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Pantry Sheet */}
      <BottomSheet visible={showAddSheet} onClose={() => setShowAddSheet(false)} title="Add Pantry Item">
        <Text style={styles.label}>Item Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Organic Almond Milk, Whole Wheat Bread"
          placeholderTextColor={styles.placeholder.color}
        />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Quantity</Text>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Unit</Text>
            <TextInput style={styles.input} value={unit} onChangeText={setUnit} />
          </View>
        </View>

        <Text style={styles.label}>Select Safety & Allergen Badges</Text>
        <View style={styles.tagPickerRow}>
          {ALLERGEN_CHIPS.map((chip) => {
            const isSel = selectedAllergens.includes(chip.tag);
            return (
              <Pressable
                key={chip.tag}
                style={[styles.tagPickerChip, isSel && styles.tagPickerChipActive]}
                onPress={() => toggleAllergen(chip.tag)}>
                <Text style={[styles.tagPickerChipText, isSel && styles.tagPickerChipTextActive]}>
                  {chip.icon} {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Button title="Save to Pantry →" onPress={handleAddItem} loading={saving} style={{ marginTop: 12 }} />
      </BottomSheet>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow.soft,
    },
    backIcon: { fontSize: 20, color: colors.textPrimary },
    headerTitle: { fontFamily: fonts.serif, fontSize: 17, color: colors.textPrimary },
    addBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
    addBtnText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.textOnPrimary },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    heroCard: {
      backgroundColor: colors.primary,
      borderRadius: radius.xxl,
      padding: spacing.xl,
      marginTop: spacing.md,
      marginBottom: spacing.lg,
      ...shadow.medium,
    },
    heroTitle: { fontFamily: fonts.serif, fontSize: 22, color: colors.textOnPrimary },
    heroSub: { fontFamily: fonts.sans, fontSize: 13, color: colors.textOnPrimaryMuted, marginTop: 4 },
    recipeCard: {
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderRadius: radius.lg,
      padding: spacing.md,
      marginTop: spacing.md,
    },
    recipeTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.textOnPrimaryAccent },
    recipeSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.textOnPrimaryMuted, marginTop: 2 },
    sectionTitle: { fontFamily: fonts.serif, fontSize: 18, color: colors.textPrimary, marginBottom: 8 },
    filterRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.md },
    filterChip: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.pill,
    },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterChipText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textSecondary },
    filterChipTextActive: { color: colors.textOnPrimary, fontFamily: fonts.sansBold },
    itemCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
      ...shadow.soft,
    },
    itemMainRow: { flexDirection: 'row', alignItems: 'center' },
    itemEmojiCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.blush,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    itemName: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.textPrimary },
    itemSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: 2 },
    crossText: { fontSize: 20, color: colors.textMuted, fontWeight: 'bold' },
    allergenBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: spacing.sm },
    tagBadge: { backgroundColor: colors.forest, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
    tagBadgeText: { fontFamily: fonts.sansBold, fontSize: 10, color: '#FFFFFF' },
    label: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textSecondary, marginBottom: 4, marginTop: 8 },
    input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 14, color: colors.textPrimary, marginBottom: 8 },
    placeholder: { color: colors.textMuted },
    tagPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    tagPickerChip: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
    tagPickerChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tagPickerChipText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textPrimary },
    tagPickerChipTextActive: { color: colors.textOnPrimary },
  });
