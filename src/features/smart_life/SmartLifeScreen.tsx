import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import { FileText, Mic, ShoppingCart, Shirt } from 'lucide-react-native';
import type { RootStackParamList } from '../../app/_layout';
import type { ThemeTokens } from '../../theme';
import useThemedStyles from '../../hooks/useThemedStyles';
import { t } from '../../i18n';

type Props = StackScreenProps<RootStackParamList, 'SmartLife'>;

export default function SmartLifeScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t('expenses.operating_hub_title')}</Text>
        <View style={styles.backBtnPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subTitle}>{t('expenses.operating_hub_sub')}</Text>

        <View style={styles.modulesGrid}>
          <Pressable
            style={({ pressed }) => [styles.moduleBox, pressed && styles.moduleBoxPressed]}
            onPress={() => navigation.navigate('DocHub')}>
            <View style={styles.moduleBoxHeader}>
              <View style={styles.moduleBoxBadge}>
                <FileText size={20} color={styles.subTitle.color} />
              </View>
              <View style={styles.moduleStatusTag}>
                <Text style={styles.moduleStatusTagText}>{t('expenses.vaulted_count')}</Text>
              </View>
            </View>
            <Text style={styles.moduleBoxTitle}>{t('expenses.doc_hub_title')}</Text>
            <Text style={styles.moduleBoxSub}>{t('expenses.doc_hub_sub')}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.moduleBox, pressed && styles.moduleBoxPressed]}
            onPress={() => navigation.navigate('Pantry')}>
            <View style={styles.moduleBoxHeader}>
              <View style={styles.moduleBoxBadge}>
                <ShoppingCart size={20} color={styles.subTitle.color} />
              </View>
              <View style={styles.moduleStatusTag}>
                <Text style={styles.moduleStatusTagText}>{t('expenses.radar_active')}</Text>
              </View>
            </View>
            <Text style={styles.moduleBoxTitle}>{t('expenses.pantry_title')}</Text>
            <Text style={styles.moduleBoxSub}>{t('expenses.pantry_sub')}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.moduleBox, pressed && styles.moduleBoxPressed]}
            onPress={() => navigation.navigate('Voice')}>
            <View style={styles.moduleBoxHeader}>
              <View style={styles.moduleBoxBadge}>
                <Mic size={20} color={styles.subTitle.color} />
              </View>
              <View style={styles.moduleStatusTag}>
                <Text style={styles.moduleStatusTagText}>{t('expenses.ai_copilot')}</Text>
              </View>
            </View>
            <Text style={styles.moduleBoxTitle}>{t('expenses.voice_engine_title')}</Text>
            <Text style={styles.moduleBoxSub}>{t('expenses.voice_engine_sub')}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.moduleBox, pressed && styles.moduleBoxPressed]}
            onPress={() => navigation.navigate('Wardrobe')}>
            <View style={styles.moduleBoxHeader}>
              <View style={styles.moduleBoxBadge}>
                <Shirt size={20} color={styles.subTitle.color} />
              </View>
              <View style={styles.moduleStatusTag}>
                <Text style={styles.moduleStatusTagText}>{t('expenses.weather_fit')}</Text>
              </View>
            </View>
            <Text style={styles.moduleBoxTitle}>{t('expenses.style_mirror_title')}</Text>
            <Text style={styles.moduleBoxSub}>{t('expenses.style_mirror_sub')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) => StyleSheet.create({
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
  },
  backBtnPlaceholder: {
    width: 40,
  },
  backIcon: {
    fontSize: 20,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontFamily: fonts.serif,
    fontSize: 18,
    color: colors.textPrimary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  subTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  moduleBox: {
    width: '48.5%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    padding: 12,
    minHeight: 112,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
  },
  moduleBoxPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  moduleBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  moduleBoxBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleStatusTag: {
    backgroundColor: colors.surface,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  moduleStatusTagText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    color: colors.primary,
  },
  moduleBoxTitle: {
    fontFamily: fonts.serif,
    fontSize: 15,
    color: colors.textPrimary,
  },
  moduleBoxSub: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});
