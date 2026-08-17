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
import { loadWardrobe, MOCK_WEATHER_RECOMMENDATION, saveWardrobe } from './wardrobeStore';
import type { ClosetCategory, WardrobeItem } from './types';

type Props = StackScreenProps<RootStackParamList, 'Wardrobe'>;

const CATEGORY_MAP: Record<ClosetCategory, { label: string; icon: string }> = {
  formal: { label: 'Formal', icon: '🧥' },
  casual: { label: 'Casual', icon: '👕' },
  traditional: { label: 'Festive / Silk', icon: '👘' },
  party: { label: 'Party', icon: '👗' },
  activewear: { label: 'Activewear', icon: '👟' },
};

export default function WardrobeScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [selectedCat, setSelectedCat] = useState<ClosetCategory | 'all'>('all');

  // Form State
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ClosetCategory>('casual');
  const [color, setColor] = useState('Navy Blue');
  const [saving, setSaving] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    const list = await loadWardrobe();
    setItems(list);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const filteredItems = selectedCat === 'all'
    ? items
    : items.filter((i) => i.category === selectedCat);

  const handleAddItem = async () => {
    if (!name.trim()) {
      Alert.alert('Incomplete Info', 'Please enter item name.');
      return;
    }
    setSaving(true);
    const newItem: WardrobeItem = {
      id: `w_${Date.now()}`,
      name: name.trim(),
      category,
      color,
      season: 'all-year',
      emoji: CATEGORY_MAP[category].icon,
    };
    const updated = [...items, newItem];
    await saveWardrobe(updated);
    setItems(updated);
    setShowAddSheet(false);
    setName('');
    setSaving(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Remove Item', 'Remove this item from your wardrobe?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const updated = items.filter((i) => i.id !== id);
          await saveWardrobe(updated);
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
        <Text style={styles.headerTitle}>Wardrobe & Style Mirror</Text>
        <Pressable onPress={() => setShowAddSheet(true)} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ Outfit</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Weather-Adaptive Style Mirror Hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>🌤️ Weather-Adaptive Style Mirror</Text>
          <Text style={styles.heroSub}>
            {MOCK_WEATHER_RECOMMENDATION.location} · {MOCK_WEATHER_RECOMMENDATION.tempC}°C ({MOCK_WEATHER_RECOMMENDATION.condition})
          </Text>

          <View style={styles.recommendationBox}>
            <Text style={styles.recLabel}>AI Today's Recommended Outfit</Text>
            <Text style={styles.recText}>
              "{MOCK_WEATHER_RECOMMENDATION.suggestedOutfit}"
            </Text>
          </View>
        </View>

        {/* Closet Category Pills */}
        <Text style={styles.sectionTitle}>Digital Closet</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          <Pressable
            style={[styles.catChip, selectedCat === 'all' && styles.catChipActive]}
            onPress={() => setSelectedCat('all')}>
            <Text style={[styles.catChipText, selectedCat === 'all' && styles.catChipTextActive]}>
              All ({items.length})
            </Text>
          </Pressable>
          {(Object.keys(CATEGORY_MAP) as ClosetCategory[]).map((cat) => (
            <Pressable
              key={cat}
              style={[styles.catChip, selectedCat === cat && styles.catChipActive]}
              onPress={() => setSelectedCat(cat)}>
              <Text style={[styles.catChipText, selectedCat === cat && styles.catChipTextActive]}>
                {CATEGORY_MAP[cat].icon} {CATEGORY_MAP[cat].label}
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
                <Text style={{ fontSize: 24, marginRight: 12 }}>{item.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemSub}>
                    {CATEGORY_MAP[item.category]?.label} · Color: {item.color}
                  </Text>
                </View>
                <Pressable onPress={() => handleDelete(item.id)}>
                  <Text style={styles.crossText}>×</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Wardrobe Sheet */}
      <BottomSheet visible={showAddSheet} onClose={() => setShowAddSheet(false)} title="Add Wardrobe Item">
        <Text style={styles.label}>Outfit / Item Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Linen Pink Shirt, Royal Blue Blazer"
          placeholderTextColor={styles.placeholder.color}
        />

        <Text style={styles.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          {(Object.keys(CATEGORY_MAP) as ClosetCategory[]).map((cat) => (
            <Pressable
              key={cat}
              style={[styles.catChip, category === cat && styles.catChipActive]}
              onPress={() => setCategory(cat)}>
              <Text style={[styles.catChipText, category === cat && styles.catChipTextActive]}>
                {CATEGORY_MAP[cat].icon} {CATEGORY_MAP[cat].label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>Color</Text>
        <TextInput style={styles.input} value={color} onChangeText={setColor} />

        <Button title="Save to Closet →" onPress={handleAddItem} loading={saving} style={{ marginTop: 12 }} />
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
    recommendationBox: {
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderRadius: radius.lg,
      padding: spacing.md,
      marginTop: spacing.md,
    },
    recLabel: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.textOnPrimaryAccent },
    recText: { fontFamily: fonts.sans, fontSize: 13, color: colors.textOnPrimary, marginTop: 4, fontStyle: 'italic' },
    sectionTitle: { fontFamily: fonts.serif, fontSize: 18, color: colors.textPrimary, marginBottom: 8 },
    catRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.md },
    catChip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
    catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    catChipText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textSecondary },
    catChipTextActive: { color: colors.textOnPrimary, fontFamily: fonts.sansBold },
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
    itemName: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.textPrimary },
    itemSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: 2 },
    crossText: { fontSize: 20, color: colors.textMuted, fontWeight: 'bold' },
    label: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textSecondary, marginBottom: 4, marginTop: 8 },
    input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 14, color: colors.textPrimary, marginBottom: 8 },
    placeholder: { color: colors.textMuted },
  });
