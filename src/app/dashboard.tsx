import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
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
import CalendarHeart from 'lucide-react-native/icons/calendar-heart';
import Smile from 'lucide-react-native/icons/smile';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import type { RootStackParamList } from './_layout';
import type { ThemeTokens } from '../theme';
import useThemedStyles from '../hooks/useThemedStyles';
import SectionHeader from '../components/SectionHeader';
import { subscribeToLanguageChanges, setLanguage, SUPPORTED_LANGS, t } from '../i18n';
import { getItem } from '../utils/storage';
import { calculateAdherence, loadIntakeLog, loadMedicines } from '../features/medicine/medicineStore';
import useAuth from '../hooks/useAuth';
import { apiFetch } from '../features/auth/api';

type Props = StackScreenProps<RootStackParamList, 'Dashboard'>;

const PROFILE_STORAGE_KEY = 'habita.user_profile';

// Matches `onboarding/profile.tsx`'s `ProfileDetailsResponse` — GET /profile/details's
// shape. Duplicated rather than imported, same pattern already used for
// `PROFILE_STORAGE_KEY` above (docs/DECISIONS.md D-019).
interface ProfileDetailsResponse {
  phone: string;
  name: string;
  email: string;
  preferredLanguage: string;
  active: boolean;
  isVerified: boolean;
  avatarUrl: string | null;
  city: string;
}

// Stable IDs a translation reword can't break — `handleTilePress`/quick actions
// route on these, never on the (locale-dependent) label text. See `M1-T7`.
type TileId =
  | 'scan'
  | 'pay'
  | 'family'
  | 'money'
  | 'docs'
  | 'safety'
  | 'wellness'
  | 'cycle'
  | 'style'
  | 'events'
  | 'medicine';
type ActionId = 'scan' | 'pay' | 'meds' | 'mood' | 'cycle' | 'expense' | 'fuel' | 'premium';

export default function DashboardScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuth();
  const scrollY = useSharedValue(0);
  const [avatar, setAvatar] = useState('👩‍💼');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [localeVersion, setLocaleVersion] = useState(0);
  const [adherence, setAdherence] = useState<number | null>(null);

  // Dynamic translated arrays evaluated on render
  const quickActions: { id: ActionId; label: string; Icon: LucideIcon }[] = [
    { id: 'scan', label: t('dashboard.action_scan'), Icon: ScanLine },
    { id: 'pay', label: t('dashboard.action_pay'), Icon: IndianRupee },
    { id: 'meds', label: t('dashboard.action_meds'), Icon: Pill },
    { id: 'mood', label: t('dashboard.action_mood'), Icon: Smile },
    { id: 'cycle', label: t('dashboard.action_cycle'), Icon: CalendarHeart },
    { id: 'expense', label: t('dashboard.action_expense'), Icon: Receipt },
    { id: 'fuel', label: t('dashboard.action_fuel'), Icon: Fuel },
    { id: 'premium', label: t('dashboard.action_premium'), Icon: Crown },
  ];

  const tiles: { id: TileId; title: string; Icon: LucideIcon }[] = [
    { id: 'scan', title: t('dashboard.tile_scan'), Icon: ScanSearch },
    { id: 'pay', title: t('dashboard.tile_pay'), Icon: CreditCard },
    { id: 'family', title: t('dashboard.tile_family'), Icon: Users },
    { id: 'medicine', title: t('dashboard.tile_medicine'), Icon: Pill },
    { id: 'money', title: t('dashboard.tile_money'), Icon: TrendingUp },
    { id: 'docs', title: t('dashboard.tile_docs'), Icon: FolderOpen },
    { id: 'safety', title: t('dashboard.tile_safety'), Icon: ShieldCheck },
    { id: 'wellness', title: t('dashboard.tile_wellness'), Icon: HeartPulse },
    { id: 'cycle', title: t('dashboard.tile_cycle'), Icon: CalendarHeart },
    { id: 'style', title: t('dashboard.tile_style'), Icon: Shirt },
    { id: 'events', title: t('dashboard.tile_events'), Icon: CalendarDays },
  ];

  useEffect(() => {
    const unsubFocus = navigation.addListener('focus', () => {
      setLocaleVersion((v) => v + 1);

      // Set once the live fetch below succeeds — guards the local-cache callback so a
      // slow AsyncStorage read can't resolve after a successful fetch and silently
      // reapply a stale cached photo over a fresh one. Same pattern, same reason, as
      // `onboarding/profile.tsx`'s edit-mode load (docs/DECISIONS.md D-028).
      let liveProfileLoaded = false;

      getItem(PROFILE_STORAGE_KEY, { avatar: '👩‍💼', photoUri: null }).then((data) => {
        if (data && data.avatar) setAvatar(data.avatar);
        if (!liveProfileLoaded) {
          setPhotoUri(data?.photoUri ?? null);
        }
      });

      // Previously only Profile edit ever fetched this, so the dashboard kept showing
      // whatever photo/language happened to be cached locally until the user went
      // looking for it — confirmed live as a real gap (docs/DECISIONS.md D-029) and
      // fixed the same way profile.tsx's own load already was.
      (async () => {
        try {
          const token = await getAccessToken();
          const details = await apiFetch<ProfileDetailsResponse>('/profile/details', { method: 'GET', token });
          liveProfileLoaded = true;
          if (details.avatarUrl) {
            setPhotoUri(details.avatarUrl);
          }
          if (details.preferredLanguage && SUPPORTED_LANGS.some((l) => l.code === details.preferredLanguage)) {
            await setLanguage(details.preferredLanguage);
          }
        } catch {
          // Offline, or profile not created yet — local cache above already covers
          // the screen.
        }
      })();

      Promise.all([loadMedicines(), loadIntakeLog()]).then(([medicines, log]) => {
        setAdherence(calculateAdherence(medicines, log));
      });
    });

    const unsubLang = subscribeToLanguageChanges(() => {
      setLocaleVersion((v) => v + 1);
    });

    return () => {
      unsubFocus();
      unsubLang();
    };
  }, [navigation, getAccessToken]);

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

  const handleTilePress = (id: TileId) => {
    if (id === 'family') {
      navigation.navigate('Family');
    } else if (id === 'medicine') {
      navigation.navigate('Medicine');
    } else if (id === 'wellness') {
      navigation.navigate('Wellness');
    } else if (id === 'cycle') {
      navigation.navigate('Cycle');
    }
    // Other tiles have no screen yet — see docs/BACKLOG.md M5-M7.
  };

  const handleActionPress = (id: ActionId) => {
    if (id === 'meds') {
      navigation.navigate('Medicine');
    } else if (id === 'mood') {
      navigation.navigate('Wellness');
    } else if (id === 'cycle') {
      navigation.navigate('Cycle');
    }
    // Other quick actions have no screen yet — see docs/BACKLOG.md M5-M7.
  };

  return (
    <View key={localeVersion} style={styles.flex}>
      {/* Sticky AppBar */}
      <View pointerEvents="box-none" style={[styles.appBarContainer, { paddingTop: insets.top }]}>
        <Animated.View style={[styles.appBarBg, appBarBgStyle]} />
        <View style={styles.appBarContent}>
          <View style={styles.appBarLeft}>
            <Text style={styles.appBarBrand}>Habita AI</Text>

            <Animated.View style={[styles.compactPill, appBarPillStyle]}>
              <Text style={styles.compactPillText}>
                2 {t('dashboard.pending')} · 4 {t('dashboard.due')}
              </Text>
            </Animated.View>
          </View>

          <Pressable
            style={styles.profileBtn}
            onPress={() => navigation.navigate('Profile', { isEditing: true })}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.profileBtnImage} />
            ) : (
              <Text style={styles.profileBtnAvatar}>{avatar}</Text>
            )}
          </Pressable>
        </View>
      </View>

      <Animated.ScrollView
        contentContainerStyle={[styles.root, { paddingTop: insets.top + 64 }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={scrollHandler}>
        {/* Greeting + stat cards — one restrained fade for the whole header block
            instead of separate staggered entrances for the greeting and the cards. */}
        <Animated.View entering={FadeInDown.duration(280)}>
          <View style={styles.greetingBlock}>
            <Text style={styles.greetingTitle}>{t('dashboard.greeting')}</Text>
            <Text style={styles.greetingSubtitle}>{t('dashboard.subheading')}</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>
                2 {t('dashboard.hero_pending')} · 4 {t('dashboard.hero_due')}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>{t('dashboard.stats_spend_title')}</Text>
              <Text style={styles.statValue}>₹12,450</Text>
              <Text style={styles.statNote}>{t('dashboard.stats_spend_sub')}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>{t('dashboard.stats_meds_title')}</Text>
              <Text style={styles.statValue}>
                {adherence === null ? '—' : `${adherence}%`}
              </Text>
              <Text style={styles.statNote}>{t('dashboard.stats_meds_sub')}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Quick actions — no per-item entrance animation; a row of six items
            cascading in one at a time read as too busy on every screen visit. */}
        <View style={styles.sectionMargin}>
          <Text style={styles.sectionTitle}>{t('dashboard.quick_actions')}</Text>
          <Text style={styles.sectionSubtitle}>{t('dashboard.quick_actions_sub')}</Text>

          <View style={styles.actionsRow}>
            {quickActions.map((action, idx) => (
              <View key={idx} style={styles.actionItem}>
                <Pressable style={styles.actionPressable} onPress={() => handleActionPress(action.id)}>
                  <View style={styles.actionIconCircle}>
                    <action.Icon size={22} color={styles.actionIconColor.color} strokeWidth={1.75} />
                  </View>
                  <Text style={styles.actionLabel} numberOfLines={1}>
                    {action.label}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>

        {/* Module list — same reasoning: ten rows staggering in individually was
            the largest source of visible motion on this screen. */}
        <SectionHeader title={t('dashboard.quick_tiles')} subtitle={t('dashboard.quick_tiles_sub')} style={styles.gridHeader} />
        <View style={styles.moduleList}>
          {tiles.map((tile, idx) => (
            <Pressable
              key={idx}
              style={[styles.moduleRow, idx === tiles.length - 1 && styles.moduleRowLast]}
              onPress={() => handleTilePress(tile.id)}>
              <View style={styles.moduleIconCircle}>
                <tile.Icon size={20} color={styles.moduleIconColor.color} strokeWidth={1.75} />
              </View>
              <Text style={styles.moduleTitle}>{tile.title}</Text>
              <ChevronRight size={18} color={styles.moduleChevronColor.color} strokeWidth={1.75} />
            </Pressable>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>Habita AI · Home & Life OS</Text>
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
    overflow: 'hidden',
    ...shadow.soft,
  },
  profileBtnAvatar: {
    fontSize: 20,
  },
  profileBtnImage: {
    width: '100%',
    height: '100%',
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
