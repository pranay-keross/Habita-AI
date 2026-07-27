import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from './_layout';
import { colors, fonts, radius, shadow, spacing } from '../theme';
import SectionHeader from '../components/SectionHeader';
import Card from '../components/Card';
import { getCurrentLanguage, subscribeToLanguageChanges, t } from '../i18n';
import { getItem } from '../utils/storage';

type Props = StackScreenProps<RootStackParamList, 'Dashboard'>;

const PROFILE_STORAGE_KEY = 'saheli.user_profile';

export default function DashboardScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [avatar, setAvatar] = useState('👩‍💼');
  const [localeVersion, setLocaleVersion] = useState(0);

  // Dynamic translated arrays evaluated on render
  const quickActions = [
    { label: t('dashboard.action_scan'), shortcut: '📄' },
    { label: t('dashboard.action_pay'), shortcut: '💸' },
    { label: t('dashboard.action_meds'), shortcut: '💊' },
    { label: t('dashboard.action_expense'), shortcut: '🧾' },
    { label: t('dashboard.action_fuel'), shortcut: '⛽' },
    { label: t('dashboard.action_premium'), shortcut: '⭐' },
  ];

  const tiles = [
    { title: t('dashboard.tile_scan'), icon: '🔍' },
    { title: t('dashboard.tile_pay'), icon: '💳' },
    { title: t('dashboard.tile_family'), icon: '👪' },
    { title: t('dashboard.tile_money'), icon: '📈' },
    { title: t('dashboard.tile_docs'), icon: '📁' },
    { title: t('dashboard.tile_safety'), icon: '🛡️' },
    { title: t('dashboard.tile_wellness'), icon: '🏃‍♀️' },
    { title: t('dashboard.tile_style'), icon: '💃' },
    { title: t('dashboard.tile_events'), icon: '🎉' },
  ];

  useEffect(() => {
    const unsubFocus = navigation.addListener('focus', () => {
      setLocaleVersion((v) => v + 1);
      getItem(PROFILE_STORAGE_KEY, { avatar: '👩‍💼' }).then((data) => {
        if (data && data.avatar) setAvatar(data.avatar);
      });
    });

    const unsubLang = subscribeToLanguageChanges(() => {
      setLocaleVersion((v) => v + 1);
    });

    return () => {
      unsubFocus();
      unsubLang();
    };
  }, [navigation]);

  // Interpolations for scroll animation
  const appbarBgOpacity = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [0, 0.98],
    extrapolate: 'clamp',
  });

  const appbarPillOpacity = scrollY.interpolate({
    inputRange: [30, 90],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const appbarPillTranslateY = scrollY.interpolate({
    inputRange: [30, 90],
    outputRange: [12, 0],
    extrapolate: 'clamp',
  });

  const heroCardScale = scrollY.interpolate({
    inputRange: [-50, 0, 100],
    outputRange: [1.05, 1, 0.94],
    extrapolate: 'clamp',
  });

  const heroCardOpacity = scrollY.interpolate({
    inputRange: [0, 70],
    outputRange: [1, 0.2],
    extrapolate: 'clamp',
  });

  const handleTilePress = (title: string) => {
    if (title === 'Family' || title === t('dashboard.tile_family')) {
      navigation.navigate('Family');
    }
  };

  return (
    <View key={localeVersion} style={styles.flex}>
      {/* Sticky AppBar */}
      <View pointerEvents="box-none" style={[styles.appBarContainer, { paddingTop: insets.top }]}>
        <Animated.View style={[styles.appBarBg, { opacity: appbarBgOpacity }]} />
        <View style={styles.appBarContent}>
          <View style={styles.appBarLeft}>
            <Text style={styles.appBarBrand}>Saheli</Text>

            <Animated.View
              style={[
                styles.compactPillRow,
                {
                  opacity: appbarPillOpacity,
                  transform: [{ translateY: appbarPillTranslateY }],
                },
              ]}>
              <View style={styles.compactPillPending}>
                <Text style={styles.compactPillPendingText}>2 {t('dashboard.pending')}</Text>
              </View>
              <View style={styles.compactPillDue}>
                <Text style={styles.compactPillDueText}>4 {t('dashboard.due')}</Text>
              </View>
            </Animated.View>
          </View>

          <Pressable
            style={styles.profileBtn}
            onPress={() => navigation.navigate('Profile', { isEditing: true })}>
            <Text style={styles.profileBtnAvatar}>{avatar}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.root, { paddingTop: insets.top + 64 }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}>
        {/* Transformable Hero Card */}
        <Animated.View
          style={[
            styles.heroCardContainer,
            {
              transform: [{ scale: heroCardScale }],
              opacity: heroCardOpacity,
            },
          ]}>
          <Text style={styles.heroTitle}>{t('dashboard.greeting')}</Text>
          <Text style={styles.heroSubtitle}>{t('dashboard.subheading')}</Text>

          <View style={styles.badgeRow}>
            <View style={styles.badgeItem}>
              <Text style={styles.badgeLabel}>{t('dashboard.hero_pending')}</Text>
              <Text style={styles.badgeValue}>2 Tasks</Text>
            </View>
            <View style={styles.badgeItem}>
              <Text style={[styles.badgeLabel, styles.badgeLabelAccent]}>{t('dashboard.hero_due')}</Text>
              <Text style={styles.badgeValue}>4 Bills</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statsCard}>
              <Text style={styles.statsTitle}>{t('dashboard.stats_spend_title')}</Text>
              <Text style={styles.statsAmount}>₹12,450</Text>
              <Text style={styles.statsNote}>{t('dashboard.stats_spend_sub')}</Text>
            </View>
            <View style={styles.statsCard}>
              <Text style={styles.statsTitle}>{t('dashboard.stats_meds_title')}</Text>
              <Text style={styles.statsAmount}>3 Active</Text>
              <Text style={styles.statsNote}>{t('dashboard.stats_meds_sub')}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Horizontal Quick Actions */}
        <View style={styles.sectionMargin}>
          <Text style={styles.sectionTitle}>{t('dashboard.quick_actions')}</Text>
          <Text style={styles.sectionSubtitle}>{t('dashboard.quick_actions_sub')}</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {quickActions.map((action, idx) => (
              <Card key={idx} style={styles.actionCard} onPress={() => {}}>
                <Text style={styles.actionShortcut}>{action.shortcut}</Text>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </Card>
            ))}
          </ScrollView>
        </View>

        {/* Feature Grid */}
        <SectionHeader title={t('dashboard.quick_tiles')} subtitle={t('dashboard.quick_tiles_sub')} style={styles.gridHeader} />
        <View style={styles.tilesGrid}>
          {tiles.map((tile, idx) => (
            <Card key={idx} style={styles.tileCard} onPress={() => handleTilePress(tile.title)}>
              <View style={styles.tileIconCircle}>
                <Text style={styles.tileIcon}>{tile.icon}</Text>
              </View>
              <Text style={styles.tileTitle}>{tile.title}</Text>
            </Card>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>Saheli · Smart Household AI</Text>
          <Text style={styles.footerText}>{t('dashboard.footer_note')}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  appBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  appBarBg: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadow.soft,
  },

  appBarContent: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  appBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appBarBrand: {
    fontFamily: fonts.serif,
    fontSize: 22,
    color: colors.primary,
    marginRight: 12,
  },
  compactPillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  compactPillPending: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  compactPillPendingText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    color: '#FFF',
  },
  compactPillDue: {
    backgroundColor: colors.turmeric,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  compactPillDueText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    color: colors.textPrimary,
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    ...shadow.soft,
  },
  profileBtnAvatar: {
    fontSize: 20,
  },
  root: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  heroCardContainer: {
    backgroundColor: colors.primary,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    ...shadow.medium,
  },
  heroTitle: {
    fontFamily: fonts.serif,
    fontSize: 28,
    color: '#FFF',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: '#F8ECE4',
    marginBottom: spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.lg,
  },
  badgeItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  badgeLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: '#FFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeLabelAccent: {
    color: '#FFE8A3',
  },
  badgeValue: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: '#FFF',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statsCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  statsTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: '#F8ECE4',
  },
  statsAmount: {
    fontFamily: fonts.serif,
    fontSize: 18,
    color: '#FFF',
    marginVertical: 4,
  },
  statsNote: {
    fontFamily: fonts.sans,
    fontSize: 10,
    color: '#F8ECE4',
  },
  sectionMargin: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontFamily: fonts.serif,
    fontSize: 22,
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  horizontalScroll: {
    gap: 12,
  },
  actionCard: {
    width: 110,
    padding: spacing.md,
    alignItems: 'center',
  },
  actionShortcut: {
    fontSize: 26,
    marginBottom: 8,
  },
  actionLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  gridHeader: {
    marginBottom: spacing.md,
  },
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tileCard: {
    width: '30%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  tileIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  tileIcon: {
    fontSize: 22,
  },
  tileTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  footerBrand: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.primary,
  },
  footerText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
});
