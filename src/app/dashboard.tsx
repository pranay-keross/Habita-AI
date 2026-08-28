import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  BackHandler,
  ToastAndroid,
  Platform,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import {
  CalendarHeart,
  CarFront,
  ChevronRight,
  Droplets,
  Fuel,
  Info,
  PartyPopper,
  Pill,
  Receipt,
  ShieldCheck,
  Shirt,
  ShoppingCart,
  Smile,
  Sparkles,
  User,
  UsersRound,
  type LucideIcon,
} from 'lucide-react-native';
import type { RootStackParamList } from './_layout';
import type { ThemeTokens } from '../theme';
import useThemedStyles from '../hooks/useThemedStyles';
import useResponsive from '../hooks/useResponsive';
import StatWaveChart from '../components/StatWaveChart';
import QuickActionTile from '../components/QuickActionTile';
import SearchPill from '../components/SearchPill';
import ModernBottomNav, { type BottomNavTab } from '../components/ModernBottomNav';
import BottomSheet from '../components/BottomSheet';
import Button from '../components/Button';
import HabitaLogo from '../components/HabitaLogo';
import { SkeletonBox, SkeletonCircle, SkeletonText } from '../components/Skeleton';
import { subscribeToLanguageChanges, setLanguage, SUPPORTED_LANGS, t } from '../i18n';
import { getItem, setItem } from '../utils/storage';
import { calculateAdherence, loadIntakeLog, loadMedicines } from '../features/medicine/medicineStore';
import { loadQuickTapItems, saveResourceLogs } from '../features/resources/resourceStore';
import type { QuickTapItem, ResourceLog } from '../features/resources/types';
import useAuth from '../hooks/useAuth';
import { apiFetch } from '../features/auth/api';
import { getRolling30DaySpend, loadExpenses } from '../features/money';

type Props = StackScreenProps<RootStackParamList, 'Dashboard'>;

const PROFILE_STORAGE_KEY = 'habita.user_profile';

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

type ActionId =
  | 'meds'
  | 'mood'
  | 'cycle'
  | 'expense'
  | 'safety'
  | 'fuel';

type LifeOsId = 'pantry' | 'style';
type HomeOpId = 'caregiver' | 'resources' | 'events' | 'assets';

type InsightsTab = 'adherence' | 'spend' | 'activity';

interface BentoModule {
  id: LifeOsId | HomeOpId;
  title: string;
  subtitle: string;
  description: string;
  tag: string;
  tagColor: string;
  Icon: LucideIcon;
}

function getGreetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'dashboard.greeting_night';
  if (hour < 12) return 'dashboard.greeting_morning';
  if (hour < 17) return 'dashboard.greeting_afternoon';
  if (hour < 21) return 'dashboard.greeting_evening';
  return 'dashboard.greeting_night';
}

export default function DashboardScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { isExpanded, contentMaxWidth } = useResponsive();
  const { getAccessToken } = useAuth();

  const [initialLoading, setInitialLoading] = useState(true);
  const [userName, setUserName] = useState('Pranay');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [localeVersion, setLocaleVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [adherence, setAdherence] = useState<number | null>(null);
  const [monthlySpend, setMonthlySpend] = useState<number | null>(null);
  const [weeklySpend, setWeeklySpend] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [resourceItems, setResourceItems] = useState<QuickTapItem[]>([]);
  const [selectedInsightsTab, setSelectedInsightsTab] = useState<InsightsTab>('adherence');
  const [selectedDayIndex, setSelectedDayIndex] = useState(5);
  const [infoModule, setInfoModule] = useState<BentoModule | null>(null);

  useFocusEffect(
    useCallback(() => {
      let lastBackPress = 0;
      const onBackPress = () => {
        const now = Date.now();
        if (now - lastBackPress < 2000) {
          BackHandler.exitApp();
          return true;
        }
        lastBackPress = now;
        ToastAndroid.show(t('dashboard.press_back_again_to_exit'), ToastAndroid.SHORT);
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  const quickActions: { id: ActionId; label: string; Icon: LucideIcon }[] = [
    { id: 'meds', label: t('dashboard.action_meds'), Icon: Pill },
    { id: 'mood', label: t('dashboard.action_mood'), Icon: Smile },
    { id: 'cycle', label: t('dashboard.action_cycle'), Icon: CalendarHeart },
    { id: 'expense', label: t('dashboard.action_expense'), Icon: Receipt },
    { id: 'safety', label: t('dashboard.action_safety') || 'SOS Alert', Icon: ShieldCheck },
    { id: 'fuel', label: t('dashboard.action_fuel'), Icon: Fuel },
  ];

  const lifeOsModules: BentoModule[] = [
    {
      id: 'pantry',
      title: t('expenses.pantry_title'),
      subtitle: t('expenses.pantry_sub'),
      description: 'Track food stock, grocery lists, expiry dates, and automated low-stock refill reminders for your kitchen.',
      tag: 'Active',
      tagColor: '#10B981',
      Icon: ShoppingCart,
    },
    {
      id: 'style',
      title: t('expenses.style_mirror_title'),
      subtitle: t('expenses.style_mirror_sub'),
      description: 'AI-curated daily outfit recommendations, digital wardrobe organizer, and weather-synchronized clothing suggestions.',
      tag: 'Mirror',
      tagColor: '#FF2E93',
      Icon: Shirt,
    },
  ];

  const homeOperationsModules: BentoModule[] = [
    {
      id: 'caregiver',
      title: t('household.caregiver_title'),
      subtitle: t('household.caregiver_highlight_staff'),
      description: 'Manage household staff profiles, daily attendance, emergency contacts, shifts, and caregiver coordination.',
      tag: 'Staff',
      tagColor: '#6366F1',
      Icon: UsersRound,
    },
    {
      id: 'resources',
      title: t('household.resources_title'),
      subtitle: t('household.resources_highlight_deliveries'),
      description: 'Quick-tap logging for daily supplies, water cans, LPG cylinders, delivery logs, and household utility refills.',
      tag: 'Deliveries',
      tagColor: '#0070F3',
      Icon: Droplets,
    },
    {
      id: 'events',
      title: t('household.events_title'),
      subtitle: t('household.events_highlight_budget'),
      description: 'Organize family celebrations, birthdays, weddings, track shared event budgets, vendor expenses, and milestones.',
      tag: 'Events',
      tagColor: '#F97316',
      Icon: PartyPopper,
    },
    {
      id: 'assets',
      title: t('household.assets_title'),
      subtitle: t('household.assets_highlight_vehicle'),
      description: 'Maintain vehicle records, fuel log tracking, odometer readings, appliance warranty radars, and service schedules.',
      tag: 'Assets',
      tagColor: '#F59E0B',
      Icon: CarFront,
    },
  ];

  const chartData = useMemo(() => {
    if (selectedInsightsTab === 'spend') {
      const hasSpend = weeklySpend.some((v) => v > 0);
      return hasSpend ? weeklySpend : [0, 0, 0, 0, 0, 0, 0];
    }
    if (selectedInsightsTab === 'activity') return [65, 80, 72, 90, 85, 95, 88];
    return [78, 85, 92, 88, 96, 94, 98];
  }, [selectedInsightsTab, weeklySpend]);

  const valueFormatter = useCallback(
    (val: number) => {
      if (selectedInsightsTab === 'spend') return `₹${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`;
      return `${val}%`;
    },
    [selectedInsightsTab]
  );

  const fetchLiveProfile = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const details = await apiFetch<ProfileDetailsResponse>('/profile/details', {
        method: 'GET',
        token,
      });
      if (details.name) setUserName(details.name);
      if (details.avatarUrl) setPhotoUri(details.avatarUrl);
      if (
        details.preferredLanguage &&
        SUPPORTED_LANGS.some((l) => l.code === details.preferredLanguage)
      ) {
        await setLanguage(details.preferredLanguage);
      }
      if (details.avatarUrl || details.name) {
        const current = await getItem<any>(PROFILE_STORAGE_KEY, {});
        await setItem(PROFILE_STORAGE_KEY, {
          ...current,
          ...(details.name ? { name: details.name } : {}),
          ...(details.avatarUrl ? { photoUri: details.avatarUrl } : {}),
        });
      }
    } catch {
      // Offline fallback
    }
  }, [getAccessToken]);

  const fetchSpendRollup = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const exps = await loadExpenses(undefined, token);

      // Compute dynamic 7-day spend distribution across Mon..Sun
      const now = new Date();
      const days = [0, 0, 0, 0, 0, 0, 0];
      exps.forEach((e) => {
        if (!e.date) return;
        const d = new Date(e.date);
        if (isNaN(d.getTime())) return;
        const diffMs = now.getTime() - d.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays < 30) {
          const dayIdx = (d.getDay() + 6) % 7; // Mon=0 .. Sun=6
          days[dayIdx] += (e.baseAmountINR || e.amount || 0);
        }
      });
      setWeeklySpend(days);

      if (token) {
        try {
          const remote = await getRolling30DaySpend(token);
          if (remote && typeof remote.rolling30DaysSpendINR === 'number') {
            setMonthlySpend(remote.rolling30DaysSpendINR);
            return;
          }
        } catch {
          // Fall through to local fallback
        }
      }
      const sum = exps.reduce((acc, e) => acc + (e.baseAmountINR || e.amount || 0), 0);
      setMonthlySpend(sum);
    } catch {
      setMonthlySpend(0);
    }
  }, [getAccessToken]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await Promise.all([
          fetchLiveProfile(),
          fetchSpendRollup(),
          getItem(PROFILE_STORAGE_KEY, { name: 'Pranay', photoUri: null }).then((data) => {
            if (data && data.name && mounted) setUserName(data.name);
            if (mounted) setPhotoUri((current) => current ?? data?.photoUri ?? null);
          }),
          Promise.all([loadMedicines(), loadIntakeLog()]).then(([medicines, log]) => {
            if (mounted) {
              setAdherence(calculateAdherence(medicines, log));
            }
          }),
          loadQuickTapItems().then((items) => {
            if (mounted) setResourceItems(items.filter((item) => item.active));
          }),
        ]);
      } finally {
        if (mounted) setInitialLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [fetchLiveProfile, fetchSpendRollup]);

  useEffect(() => {
    if (route.params?.profileUpdated) {
      fetchLiveProfile();
      navigation.setParams({ profileUpdated: undefined });
    }
  }, [route.params?.profileUpdated, fetchLiveProfile, navigation]);

  useEffect(() => {
    const unsubFocus = navigation.addListener('focus', () => {
      fetchSpendRollup();
      getItem(PROFILE_STORAGE_KEY, { name: 'Pranay', photoUri: null }).then((data) => {
        if (data && data.name) setUserName(data.name);
        setPhotoUri((current) => current ?? data?.photoUri ?? null);
      });

      Promise.all([loadMedicines(), loadIntakeLog()]).then(([medicines, log]) => {
        setAdherence(calculateAdherence(medicines, log));
      });
      loadQuickTapItems().then((items) =>
        setResourceItems(items.filter((item) => item.active))
      );
    });

    const unsubLang = subscribeToLanguageChanges(() => {
      setLocaleVersion((v) => v + 1);
    });

    return () => {
      unsubFocus();
      unsubLang();
    };
  }, [navigation, fetchSpendRollup]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchLiveProfile(),
        fetchSpendRollup(),
        getItem(PROFILE_STORAGE_KEY, { name: 'Pranay', photoUri: null }).then((data) => {
          if (data && data.name) setUserName(data.name);
          setPhotoUri((current) => current ?? data?.photoUri ?? null);
        }),
        Promise.all([loadMedicines(), loadIntakeLog()]).then(([medicines, log]) => {
          setAdherence(calculateAdherence(medicines, log));
        }),
        loadQuickTapItems().then((items) =>
          setResourceItems(items.filter((item) => item.active))
        ),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchLiveProfile, fetchSpendRollup]);


  const handleLifeOsPress = (id: LifeOsId) => {
    if (id === 'pantry') navigation.navigate('Pantry');
    else if (id === 'style') navigation.navigate('Wardrobe');
  };

  const handleHomeOpPress = (id: HomeOpId) => {
    if (id === 'caregiver') navigation.navigate('Staff');
    else if (id === 'resources') navigation.navigate('Resources');
    else if (id === 'events') navigation.navigate('EventBudgets');
    else if (id === 'assets') navigation.navigate('Vehicles');
  };

  const handleActionPress = (id: ActionId) => {
    if (id === 'meds') navigation.navigate('Medicine');
    else if (id === 'mood') navigation.navigate('Wellness');
    else if (id === 'cycle') navigation.navigate('Cycle');
    else if (id === 'expense') navigation.navigate('ExpenseGroups');
    else if (id === 'safety') navigation.navigate('Staff');
    else if (id === 'fuel') navigation.navigate('Vehicles');
  };

  const handleNavPress = (tab: BottomNavTab) => {
    if (tab === 'family') {
      navigation.navigate('Family');
    } else if (tab === 'center') {
      navigation.navigate('Voice');
    } else if (tab === 'health') {
      navigation.navigate('Medicine');
    } else if (tab === 'vault') {
      navigation.navigate('DocHub');
    }
  };

  const handleResourceTap = async (item: QuickTapItem) => {
    const { loadResourceLogs } = await import('../features/resources/resourceStore');
    const existing = await loadResourceLogs();
    const entry: ResourceLog = {
      id: String(Date.now()),
      quickTapItemId: item.id,
      itemName: item.name,
      quantity: 1,
      note: '',
      loggedAt: Date.now(),
    };
    await saveResourceLogs([entry, ...existing]);
    if (Platform.OS === 'android') {
      ToastAndroid.show(`+1 ${item.name} logged`, ToastAndroid.SHORT);
    }
  };

  const maxContentStyle = isExpanded
    ? { maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as const }
    : { width: '100%' as const };

  const firstName = userName ? userName.trim().split(' ')[0] : 'Pranay';
  const greetingPrefix = t(getGreetingKey()).replace('Habita AI', '').replace(',', '').trim();

  return (
    <View key={localeVersion} style={styles.flex}>
      {/* Minimalist Top App Bar */}
      <View style={[styles.appBarContainer, { paddingTop: insets.top }]}>
        <View style={[styles.appBarContent, maxContentStyle]}>
          <View style={styles.appBarLeft}>
            <HabitaLogo size={32} />
            <Text style={styles.appBarBrand}>HABITA AI</Text>
          </View>

          <View style={styles.appBarRight}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voice Assistant"
              style={styles.headerIconButton}
              onPress={() => navigation.navigate('Voice')}>
              <Sparkles size={16} color="#000000" strokeWidth={1.5} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.edit_profile')}
              style={styles.profileBtn}
              onPress={() => navigation.navigate('Profile', { isEditing: true })}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.profileBtnImage} resizeMode="cover" />
              ) : (
                <User size={16} color="#000000" strokeWidth={1.5} />
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {/* Main Content Area */}
      <ScrollView
        contentContainerStyle={[
          styles.root,
          {
            paddingTop: insets.top + 64,
            paddingBottom: insets.bottom + 92,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#000000"
            colors={['#000000']}
          />
        }>
        <View style={maxContentStyle}>
          {initialLoading ? (
            <View style={styles.skeletonContainer}>
              {/* Top Greeting Skeleton */}
              <View style={styles.greetingHeader}>
                <View style={{ flex: 1 }}>
                  <SkeletonText width="65%" height={22} style={{ marginBottom: 6 }} />
                </View>
                <SkeletonBox width={110} height={26} borderRadius={9999} />
              </View>

              {/* Search Bar Skeleton */}
              <SkeletonBox width="100%" height={46} borderRadius={9999} style={{ marginVertical: 14 }} />

              {/* Insights Card Skeleton */}
              <View style={[styles.insightsCard, { marginBottom: 20 }]}>
                <SkeletonText width="45%" height={16} style={{ marginBottom: 12 }} />
                <SkeletonBox width="100%" height={100} borderRadius={12} style={{ marginBottom: 14 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <SkeletonBox width="30%" height={36} borderRadius={8} />
                  <SkeletonBox width="30%" height={36} borderRadius={8} />
                  <SkeletonBox width="30%" height={36} borderRadius={8} />
                </View>
              </View>

              {/* Quick Actions Skeleton */}
              <SkeletonText width="35%" height={15} style={{ marginBottom: 12 }} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                {[...Array(8)].map((_, i) => (
                  <View key={i} style={{ width: '22%', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <SkeletonCircle size={46} />
                    <SkeletonText width={42} height={10} />
                  </View>
                ))}
              </View>

              {/* Bento Grid Skeleton */}
              <SkeletonText width="35%" height={15} style={{ marginBottom: 12 }} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <SkeletonBox width="48%" height={110} borderRadius={16} />
                <SkeletonBox width="48%" height={110} borderRadius={16} />
                <SkeletonBox width="48%" height={110} borderRadius={16} />
                <SkeletonBox width="48%" height={110} borderRadius={16} />
              </View>
            </View>
          ) : (
            <>
              {/* Minimalist Greeting & Status */}
              <View style={styles.heroSection}>
                <View style={styles.greetingHeader}>
                  <View style={styles.greetingTextGroup}>
                    <Text style={styles.greetingTitle} numberOfLines={1}>
                      {greetingPrefix ? `${greetingPrefix}, ${firstName}` : `Hello, ${firstName}`}
                    </Text>
                  </View>
                  <View style={styles.statusPill}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>2 pending · 4 due</Text>
                  </View>
                </View>

                {/* Minimalist Search Bar - Direct AI Voice/Chat Entry */}
                <SearchPill
                  placeholder={t('dashboard.search_placeholder')}
                  onPress={() => navigation.navigate('Voice')}
                  onMicPress={() => navigation.navigate('Voice')}
                />
              </View>

              {/* Minimalist Insights Card */}
              <View style={styles.insightsCard}>
                <View style={styles.insightsHeader}>
                  <View style={styles.insightsTitleGroup}>
                    <Text style={styles.insightsSectionLabel}>{t('dashboard.insights_title')}</Text>
                    <Text style={styles.insightsSubtitle}>{t('dashboard.insights_subtitle')}</Text>
                  </View>
                </View>

                {/* Responsive Full-Width Tab Pills */}
                <View style={styles.tabsContainer}>
                  {(['adherence', 'spend', 'activity'] as InsightsTab[]).map((tab) => {
                    const isActive = selectedInsightsTab === tab;
                    const label =
                      tab === 'adherence'
                        ? t('dashboard.tab_adherence')
                        : tab === 'spend'
                        ? t('dashboard.tab_spend')
                        : t('dashboard.tab_activity');
                    return (
                      <Pressable
                        key={tab}
                        style={[styles.tabButton, isActive && styles.tabButtonActive]}
                        onPress={() => setSelectedInsightsTab(tab)}>
                        <Text
                          style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}
                          numberOfLines={1}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Smooth Black Spline Wave Chart */}
                <View style={styles.chartContainer}>
                  <StatWaveChart
                    data={chartData}
                    height={110}
                    selectedIndex={selectedDayIndex}
                    onSelectIndex={setSelectedDayIndex}
                    valueFormatter={valueFormatter}
                    accentColor="#000000"
                  />
                </View>

                {/* 3 Clean Stat Pillars */}
                <View style={styles.statHighlightsRow}>
                  <View style={styles.statPillar}>
                    <Text style={styles.statPillarValue}>
                      {selectedInsightsTab === 'spend'
                        ? `₹${chartData[selectedDayIndex]?.toLocaleString('en-IN')}`
                        : selectedInsightsTab === 'adherence' && selectedDayIndex === 6 && adherence !== null
                        ? `${adherence}%`
                        : `${chartData[selectedDayIndex]}%`}
                    </Text>
                    <Text style={styles.statPillarLabel} numberOfLines={1}>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][selectedDayIndex]}{' '}
                      {selectedInsightsTab === 'spend'
                        ? 'Spend'
                        : selectedInsightsTab === 'activity'
                        ? 'Score'
                        : t('dashboard.stats_meds_title')}
                    </Text>
                  </View>

                  <View style={styles.statDivider} />

                  <View style={styles.statPillar}>
                    <Text style={styles.statPillarValue}>
                      ₹{(monthlySpend ?? 0).toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.statPillarLabel} numberOfLines={1}>
                      {t('dashboard.monthly_budget')}
                    </Text>
                  </View>

                  <View style={styles.statDivider} />

                  <View style={styles.statPillar}>
                    <Text style={styles.statPillarValue}>6</Text>
                    <Text style={styles.statPillarLabel} numberOfLines={1}>
                      {t('dashboard.active_now')}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Minimalist Quick Actions Grid */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeading}>{t('dashboard.quick_actions')}</Text>
                </View>

                <View style={styles.actionsGrid}>
                  {quickActions.map((action) => (
                    <View key={action.id} style={styles.actionGridColumn}>
                      <QuickActionTile
                        label={action.label}
                        Icon={action.Icon}
                        onPress={() => handleActionPress(action.id)}
                      />
                    </View>
                  ))}
                </View>
              </View>

              {/* Quick Tap Utilities Refill Strip */}
              {resourceItems.length > 0 ? (
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeading}>{t('resources.dashboard_title')}</Text>
                    <Pressable onPress={() => navigation.navigate('Resources')}>
                      <Text style={styles.sectionLink}>{t('resources.open')} →</Text>
                    </Pressable>
                  </View>

                  <View style={styles.resourceTapsRow}>
                    {resourceItems.slice(0, 4).map((item) => (
                      <Pressable
                        key={item.id}
                        style={styles.resourceTapCard}
                        onPress={() => handleResourceTap(item)}>
                        <View style={styles.resourceTapPlusCircle}>
                          <Text style={styles.resourceTapPlusText}>+</Text>
                        </View>
                        <Text style={styles.resourceTapName} numberOfLines={1}>
                          {item.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Direct Life OS Section */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeading}>{t('nav.life') || 'Life OS'}</Text>
                </View>

                <View style={styles.bentoGrid}>
                  {lifeOsModules.map((module) => (
                    <Pressable
                      key={module.id}
                      style={({ pressed }) => [
                        styles.bentoCard,
                        pressed && styles.bentoCardPressed,
                      ]}
                      onPress={() => handleLifeOsPress(module.id as LifeOsId)}>
                      <View style={styles.bentoCardTop}>
                        <View style={styles.bentoIconBox}>
                          <module.Icon size={18} color="#000000" strokeWidth={1.5} />
                        </View>
                        <View style={styles.bentoTopRight}>
                          <View style={styles.bentoTag}>
                            <Text style={[styles.bentoTagText, { color: module.tagColor }]}>
                              {module.tag}
                            </Text>
                          </View>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Info for ${module.title}`}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={styles.bentoInfoBtn}
                            onPress={(e) => {
                              e.stopPropagation();
                              setInfoModule(module);
                            }}>
                            <Info size={13} color="#888888" strokeWidth={1.8} />
                          </Pressable>
                        </View>
                      </View>

                      <View style={styles.bentoCardBottom}>
                        <View style={styles.bentoTextGroup}>
                          <Text style={styles.bentoTitle} numberOfLines={2}>
                            {module.title}
                          </Text>
                          <Text style={styles.bentoSubtitle} numberOfLines={2}>
                            {module.subtitle}
                          </Text>
                        </View>
                        <ChevronRight size={16} color="#000000" strokeWidth={1.3} />
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Direct Home Operations Section */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeading}>{t('household.header_title') || 'Home Operations'}</Text>
                </View>

                <View style={styles.bentoGrid}>
                  {homeOperationsModules.map((module) => (
                    <Pressable
                      key={module.id}
                      style={({ pressed }) => [
                        styles.bentoCard,
                        pressed && styles.bentoCardPressed,
                      ]}
                      onPress={() => handleHomeOpPress(module.id as HomeOpId)}>
                      <View style={styles.bentoCardTop}>
                        <View style={styles.bentoIconBox}>
                          <module.Icon size={18} color="#000000" strokeWidth={1.5} />
                        </View>
                        <View style={styles.bentoTopRight}>
                          <View style={styles.bentoTag}>
                            <Text style={[styles.bentoTagText, { color: module.tagColor }]}>
                              {module.tag}
                            </Text>
                          </View>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Info for ${module.title}`}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={styles.bentoInfoBtn}
                            onPress={(e) => {
                              e.stopPropagation();
                              setInfoModule(module);
                            }}>
                            <Info size={13} color="#888888" strokeWidth={1.8} />
                          </Pressable>
                        </View>
                      </View>

                      <View style={styles.bentoCardBottom}>
                        <View style={styles.bentoTextGroup}>
                          <Text style={styles.bentoTitle} numberOfLines={2}>
                            {module.title}
                          </Text>
                          <Text style={styles.bentoSubtitle} numberOfLines={2}>
                            {module.subtitle}
                          </Text>
                        </View>
                        <ChevronRight size={16} color="#000000" strokeWidth={1.3} />
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Minimalist Footer */}
              <View style={styles.footerContainer}>
                <Text style={styles.footerBrand}>HABITA AI</Text>
                <Text style={styles.footerSub}>{t('dashboard.footer_note')}</Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Workspace Info BottomSheet */}
      <BottomSheet
        visible={!!infoModule}
        onClose={() => setInfoModule(null)}
        title={infoModule?.title || 'Workspace Info'}>
        {infoModule && (
          <View style={styles.infoSheetContent}>
            <View style={styles.infoSheetHeader}>
              <View style={styles.infoSheetIconBox}>
                <infoModule.Icon size={22} color="#000000" strokeWidth={1.5} />
              </View>
              <View style={styles.infoSheetHeaderText}>
                <Text style={styles.infoSheetTitle}>{infoModule.title}</Text>
                <View style={[styles.bentoTag, { alignSelf: 'flex-start', marginTop: 4 }]}>
                  <Text style={[styles.bentoTagText, { color: infoModule.tagColor }]}>
                    {infoModule.tag}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.infoSheetSubTitle}>{infoModule.subtitle}</Text>
            <Text style={styles.infoSheetDesc}>{infoModule.description}</Text>

            <Button
              title={`Open ${infoModule.title}`}
              onPress={() => {
                const mod = infoModule;
                setInfoModule(null);
                if (mod.id === 'pantry' || mod.id === 'style') {
                  handleLifeOsPress(mod.id);
                } else {
                  handleHomeOpPress(mod.id);
                }
              }}
              style={styles.infoSheetCta}
            />
          </View>
        )}
      </BottomSheet>

      {/* Solid Black Minimalist Bottom Nav Dock */}
      <ModernBottomNav
        activeTab="home"
        onTabPress={handleNavPress}
        badgeCounts={{ health: 2 }}
      />
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    flex: {
      flex: 1,
      backgroundColor: colors.background,
    },
    skeletonContainer: {
      paddingBottom: spacing.lg,
    },
    appBarContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      backgroundColor: '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: '#ECECEE',
    },
    appBarContent: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
    },
    appBarLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    appBarBrand: {
      fontFamily: fonts.sans,
      fontSize: 16,
      fontWeight: '700',
      color: '#000000',
      letterSpacing: 1.5,
    },
    appBarBrandSub: {
      fontFamily: fonts.sans,
      fontSize: 10,
      fontWeight: '400',
      color: '#888888',
      letterSpacing: 1,
    },
    appBarRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerIconButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: '#F5F5F7',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#EAEAEA',
    },
    profileBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: '#F5F5F7',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#EAEAEA',
      overflow: 'hidden',
    },
    profileBtnAvatar: {
      fontSize: 16,
    },
    profileBtnImage: {
      width: '100%',
      height: '100%',
    },
    root: {
      paddingHorizontal: spacing.lg,
    },
    heroSection: {
      marginBottom: spacing.md,
    },
    greetingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
      gap: 8,
    },
    greetingTextGroup: {
      flex: 1,
      minWidth: 0,
      paddingRight: 8,
    },
    greetingTitle: {
      fontFamily: fonts.sans,
      fontSize: 22,
      fontWeight: '600',
      color: '#000000',
      letterSpacing: -0.3,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#FFFFFF',
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: '#EAEAEA',
      paddingHorizontal: 9,
      paddingVertical: 5,
      flexShrink: 0,
      alignSelf: 'center',
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#10B981',
    },
    statusText: {
      fontFamily: fonts.sans,
      fontSize: 11,
      fontWeight: '500',
      color: '#444444',
    },
    insightsCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: '#ECECEE',
      padding: spacing.md,
      marginBottom: spacing.lg,
      ...shadow.soft,
      elevation: 2,
    },
    insightsHeader: {
      marginBottom: spacing.xs,
    },
    insightsTitleGroup: {
      marginBottom: 6,
    },
    insightsSectionLabel: {
      fontFamily: fonts.sans,
      fontSize: 13,
      fontWeight: '600',
      color: '#000000',
      marginBottom: 1,
    },
    insightsSubtitle: {
      fontFamily: fonts.sans,
      fontSize: 11,
      fontWeight: '400',
      color: '#888888',
    },
    tabsContainer: {
      flexDirection: 'row',
      backgroundColor: '#F5F5F7',
      borderRadius: radius.pill,
      padding: 3,
      gap: 4,
      width: '100%',
      marginVertical: 4,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabButtonActive: {
      backgroundColor: '#000000',
    },
    tabButtonText: {
      fontFamily: fonts.sans,
      fontSize: 11,
      fontWeight: '500',
      color: '#777777',
      textAlign: 'center',
    },
    tabButtonTextActive: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    tabActionBtn: {
      marginTop: spacing.md,
      marginBottom: spacing.lg,
    },
    emptyCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: '#ECECEE',
      padding: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginVertical: spacing.sm,
    },
    emptyCardTitle: {
      fontFamily: fonts.sans,
      fontSize: 14,
      fontWeight: '600',
      color: '#000000',
      marginTop: 4,
    },
    emptyCardSub: {
      fontFamily: fonts.sans,
      fontSize: 11,
      fontWeight: '400',
      color: '#888888',
      textAlign: 'center',
    },
    chartContainer: {
      marginVertical: spacing.xs,
    },
    statHighlightsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.xs,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: '#F0F0F2',
    },
    statPillar: {
      flex: 1,
      alignItems: 'center',
    },
    statPillarValue: {
      fontFamily: fonts.sans,
      fontSize: 18,
      fontWeight: '300',
      color: '#000000',
      marginBottom: 1,
    },
    statPillarLabel: {
      fontFamily: fonts.sans,
      fontSize: 10,
      fontWeight: '400',
      color: '#888888',
    },
    statDivider: {
      width: 1,
      height: 26,
      backgroundColor: '#EAEAEA',
    },
    sectionContainer: {
      marginBottom: spacing.lg,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    sectionHeading: {
      fontFamily: fonts.sans,
      fontSize: 13,
      fontWeight: '500',
      color: '#000000',
    },
    sectionLink: {
      fontFamily: fonts.sans,
      fontSize: 12,
      fontWeight: '400',
      color: '#000000',
    },
    actionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
      rowGap: spacing.md,
      columnGap: 10,
    },
    actionGridColumn: {
      width: '22.5%',
      alignItems: 'center',
    },
    resourceTapsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    resourceTapCard: {
      flex: 1,
      minHeight: 64,
      backgroundColor: '#FFFFFF',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: '#ECECEE',
      padding: spacing.sm,
      justifyContent: 'space-between',
      ...shadow.soft,
    },
    resourceTapPlusCircle: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#F5F5F7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    resourceTapPlusText: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: '#000000',
      lineHeight: 14,
    },
    resourceTapName: {
      fontFamily: fonts.sans,
      fontSize: 11,
      fontWeight: '400',
      color: '#000000',
    },
    bentoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      justifyContent: 'space-between',
    },
    bentoCard: {
      width: '48%',
      minHeight: 112,
      backgroundColor: '#FFFFFF',
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: '#ECECEE',
      padding: spacing.md,
      justifyContent: 'space-between',
      ...shadow.soft,
    },
    bentoCardPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.98 }],
    },
    bentoCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    bentoIconBox: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: '#F5F5F7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bentoTopRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    bentoTag: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.pill,
      backgroundColor: '#F5F5F7',
    },
    bentoTagText: {
      fontFamily: fonts.sans,
      fontSize: 9,
      fontWeight: '500',
    },
    bentoInfoBtn: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#F5F5F7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bentoCardBottom: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginTop: spacing.xs,
    },
    bentoTextGroup: {
      flex: 1,
      marginRight: 4,
    },
    bentoTitle: {
      fontFamily: fonts.sans,
      fontSize: 13,
      fontWeight: '600',
      color: '#000000',
      lineHeight: 17,
    },
    bentoSubtitle: {
      fontFamily: fonts.sans,
      fontSize: 10,
      fontWeight: '300',
      color: '#888888',
      marginTop: 2,
      lineHeight: 13,
    },
    infoSheetContent: {
      paddingBottom: spacing.lg,
    },
    infoSheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: spacing.md,
    },
    infoSheetIconBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: '#F5F5F7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoSheetHeaderText: {
      flex: 1,
    },
    infoSheetTitle: {
      fontFamily: fonts.sans,
      fontSize: 17,
      fontWeight: '600',
      color: '#000000',
    },
    infoSheetSubTitle: {
      fontFamily: fonts.sans,
      fontSize: 13,
      fontWeight: '500',
      color: '#444444',
      marginBottom: spacing.sm,
    },
    infoSheetDesc: {
      fontFamily: fonts.sans,
      fontSize: 13,
      fontWeight: '300',
      color: '#666666',
      lineHeight: 20,
      marginBottom: spacing.lg,
    },
    infoSheetCta: {
      marginTop: spacing.xs,
    },
    footerContainer: {
      alignItems: 'center',
      marginTop: spacing.lg,
      marginBottom: spacing.xl,
    },
    footerBrand: {
      fontFamily: fonts.sans,
      fontSize: 12,
      fontWeight: '500',
      color: '#000000',
      letterSpacing: 2,
    },
    footerSub: {
      fontFamily: fonts.sans,
      fontSize: 10,
      fontWeight: '300',
      color: '#888888',
      marginTop: 2,
      textAlign: 'center',
    },
  });
