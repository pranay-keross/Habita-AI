import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { LucideIcon } from 'lucide-react-native';
import ScanLine from 'lucide-react-native/icons/scan-line';
import IndianRupee from 'lucide-react-native/icons/indian-rupee';
import Pill from 'lucide-react-native/icons/pill';
import Receipt from 'lucide-react-native/icons/receipt';
import Fuel from 'lucide-react-native/icons/fuel';
import Crown from 'lucide-react-native/icons/crown';
import ScanSearch from 'lucide-react-native/icons/scan-search';
import CreditCard from 'lucide-react-native/icons/credit-card';
import Users from 'lucide-react-native/icons/users';
import TrendingUp from 'lucide-react-native/icons/trending-up';
import FolderOpen from 'lucide-react-native/icons/folder-open';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import HeartPulse from 'lucide-react-native/icons/heart-pulse';
import Shirt from 'lucide-react-native/icons/shirt';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import type { RootStackParamList } from './_layout';
import type { ThemeTokens } from '../theme';
import useThemedStyles from '../hooks/useThemedStyles';
import SectionHeader from '../components/SectionHeader';
import { subscribeToLanguageChanges, t } from '../i18n';
import { getItem } from '../utils/storage';

type Props = StackScreenProps<RootStackParamList, 'Dashboard'>;

const PROFILE_STORAGE_KEY = 'saheli.user_profile';

export default function DashboardScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const [avatar, setAvatar] = useState('👩‍💼');
  const [localeVersion, setLocaleVersion] = useState(0);

  // Dynamic translated arrays evaluated on render
  const quickActions: { label: string; Icon: LucideIcon }[] = [
    { label: t('dashboard.action_scan'), Icon: ScanLine },
    { label: t('dashboard.action_pay'), Icon: IndianRupee },
    { label: t('dashboard.action_meds'), Icon: Pill },
    { label: t('dashboard.action_expense'), Icon: Receipt },
    { label: t('dashboard.action_fuel'), Icon: Fuel },
    { label: t('dashboard.action_premium'), Icon: Crown },
  ];

  const tiles: { title: string; Icon: LucideIcon }[] = [
    { title: t('dashboard.tile_scan'), Icon: ScanSearch },
    { title: t('dashboard.tile_pay'), Icon: CreditCard },
    { title: t('dashboard.tile_family'), Icon: Users },
    { title: t('dashboard.tile_money'), Icon: TrendingUp },
    { title: t('dashboard.tile_docs'), Icon: FolderOpen },
    { title: t('dashboard.tile_safety'), Icon: ShieldCheck },
    { title: t('dashboard.tile_wellness'), Icon: HeartPulse },
    { title: t('dashboard.tile_style'), Icon: Shirt },
    { title: t('dashboard.tile_events'), Icon: CalendarDays },
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

  // Scroll handler runs entirely on the UI thread, so the app bar fade-in
  // stays glitch-free even on a busy JS thread.
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const appBarBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 60], [0, 0.98], Extrapolation.CLAMP),
  }));

  const appBarPillStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [10, 60], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [10, 60], [10, 0], Extrapolation.CLAMP) },
    ],
  }));

  const handleTilePress = (title: string) => {
    if (title === 'Family' || title === t('dashboard.tile_family')) {
      navigation.navigate('Family');
    }
  };

  return (
    <View key={localeVersion} style={styles.flex}>
      {/* Sticky AppBar */}
      <View pointerEvents="box-none" style={[styles.appBarContainer, { paddingTop: insets.top }]}>
        <Animated.View style={[styles.appBarBg, appBarBgStyle]} />
        <View style={styles.appBarContent}>
          <View style={styles.appBarLeft}>
            <Text style={styles.appBarBrand}>Saheli</Text>

            <Animated.View style={[styles.compactPill, appBarPillStyle]}>
              <Text style={styles.compactPillText}>
                2 {t('dashboard.pending')} · 4 {t('dashboard.due')}
              </Text>
            </Animated.View>
          </View>

          <Pressable
            style={styles.profileBtn}
            onPress={() => navigation.navigate('Profile', { isEditing: true })}>
            <Text style={styles.profileBtnAvatar}>{avatar}</Text>
          </Pressable>
        </View>
      </View>

      <Animated.ScrollView
        contentContainerStyle={[styles.root, { paddingTop: insets.top + 64 }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={scrollHandler}>
        {/* Greeting */}
        <Animated.View
          entering={FadeInDown.duration(420).springify().damping(18)}
          style={styles.greetingBlock}>
          <Text style={styles.greetingTitle}>{t('dashboard.greeting')}</Text>
          <Text style={styles.greetingSubtitle}>{t('dashboard.subheading')}</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              2 {t('dashboard.hero_pending')} · 4 {t('dashboard.hero_due')}
            </Text>
          </View>
        </Animated.View>

        {/* Stat cards */}
        <Animated.View
          entering={FadeInDown.delay(80).duration(420).springify().damping(18)}
          style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t('dashboard.stats_spend_title')}</Text>
            <Text style={styles.statValue}>₹12,450</Text>
            <Text style={styles.statNote}>{t('dashboard.stats_spend_sub')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t('dashboard.stats_meds_title')}</Text>
            <Text style={styles.statValue}>3 Active</Text>
            <Text style={styles.statNote}>{t('dashboard.stats_meds_sub')}</Text>
          </View>
        </Animated.View>

        {/* Quick actions */}
        <View style={styles.sectionMargin}>
          <Text style={styles.sectionTitle}>{t('dashboard.quick_actions')}</Text>
          <Text style={styles.sectionSubtitle}>{t('dashboard.quick_actions_sub')}</Text>

          <View style={styles.actionsRow}>
            {quickActions.map((action, idx) => (
              <Animated.View
                key={idx}
                style={styles.actionItem}
                entering={FadeInDown.delay(120 + idx * 40).duration(360).springify().damping(20)}>
                <Pressable style={styles.actionPressable} onPress={() => {}}>
                  <View style={styles.actionIconCircle}>
                    <action.Icon size={22} color={styles.actionIconColor.color} strokeWidth={1.75} />
                  </View>
                  <Text style={styles.actionLabel} numberOfLines={1}>
                    {action.label}
                  </Text>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Module list */}
        <SectionHeader title={t('dashboard.quick_tiles')} subtitle={t('dashboard.quick_tiles_sub')} style={styles.gridHeader} />
        <View style={styles.moduleList}>
          {tiles.map((tile, idx) => (
            <Animated.View
              key={idx}
              entering={FadeInDown.delay(220 + idx * 30).duration(360).springify().damping(20)}>
              <Pressable
                style={[styles.moduleRow, idx === tiles.length - 1 && styles.moduleRowLast]}
                onPress={() => handleTilePress(tile.title)}>
                <View style={styles.moduleIconCircle}>
                  <tile.Icon size={20} color={styles.moduleIconColor.color} strokeWidth={1.75} />
                </View>
                <Text style={styles.moduleTitle}>{tile.title}</Text>
                <ChevronRight size={18} color={styles.moduleChevronColor.color} strokeWidth={1.75} />
              </Pressable>
            </Animated.View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>Saheli · Smart Household AI</Text>
          <Text style={styles.footerText}>{t('dashboard.footer_note')}</Text>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

// Wrapped in a factory so the palette is read per render, not at module load.
// The destructured parameter shadows the module imports, so the block below is
// unchanged from when it was a plain StyleSheet.create call.
const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) => StyleSheet.create({
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
  compactPill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  compactPillText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textSecondary,
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
  greetingBlock: {
    marginBottom: spacing.lg,
  },
  greetingTitle: {
    fontFamily: fonts.serif,
    fontSize: 26,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  greetingSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textSecondary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.turmeric,
  },
  statusText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.soft,
  },
  statLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontFamily: fonts.serif,
    fontSize: 20,
    color: colors.textPrimary,
    marginVertical: 4,
  },
  statNote: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
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
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.md,
  },
  actionItem: {
    width: '33.33%',
  },
  actionPressable: {
    alignItems: 'center',
  },
  actionIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionIconColor: {
    color: colors.primary,
  },
  actionLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  gridHeader: {
    marginBottom: spacing.md,
  },
  moduleList: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.soft,
  },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  moduleRowLast: {
    borderBottomWidth: 0,
  },
  moduleIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  moduleIconColor: {
    color: colors.primary,
  },
  moduleTitle: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  moduleChevronColor: {
    color: colors.textMuted,
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
