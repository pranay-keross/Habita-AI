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
  TextInput,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import {
  CalendarDays,
  CalendarHeart,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  FolderOpen,
  Fuel,
  House,
  IndianRupee,
  Pill,
  Plus,
  Receipt,
  ScanLine,
  Search,
  ShieldCheck,
  Shirt,
  ShoppingCart,
  Smile,
  Sparkles,
  User,
  Users,
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
import Button from '../components/Button';
import HabitaLogo from '../components/HabitaLogo';
import { SkeletonBox, SkeletonCircle, SkeletonText } from '../components/Skeleton';
import { subscribeToLanguageChanges, setLanguage, SUPPORTED_LANGS, t } from '../i18n';
import { getItem, setItem } from '../utils/storage';
import { calculateAdherence, loadIntakeLog, loadMedicines } from '../features/medicine/medicineStore';
import { loadQuickTapItems, saveResourceLogs } from '../features/resources/resourceStore';
import type { QuickTapItem, ResourceLog } from '../features/resources/types';
import { loadDocuments, getDocStatus } from '../features/money/document_hub/docStore';
import type { DocHubEntry, DocCategory } from '../features/money/document_hub/types';
import type { Medicine } from '../features/medicine/types';
import useAuth from '../hooks/useAuth';
import { apiFetch } from '../features/auth/api';

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
  | 'scan'
  | 'pay'
  | 'meds'
  | 'mood'
  | 'cycle'
  | 'expense'
  | 'smartLife'
  | 'fuel'
  | 'wardrobe';

type TileId =
  | 'medicine'
  | 'docs'
  | 'family'
  | 'money'
  | 'household'
  | 'safety'
  | 'wellness'
  | 'cycle'
  | 'style'
  | 'events'
  | 'vehicles'
  | 'pantry'
  | 'pay'
  | 'scan';

type InsightsTab = 'adherence' | 'spend' | 'activity';

interface BentoModule {
  id: TileId;
  title: string;
  subtitle: string;
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

  const [activeNavTab, setActiveNavTab] = useState<BottomNavTab>('home');
  const [initialLoading, setInitialLoading] = useState(true);
  const [userName, setUserName] = useState('Pranay');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [localeVersion, setLocaleVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [adherence, setAdherence] = useState<number | null>(null);
  const [medicinesList, setMedicinesList] = useState<Medicine[]>([]);
  const [vaultDocs, setVaultDocs] = useState<DocHubEntry[]>([]);
  const [resourceItems, setResourceItems] = useState<QuickTapItem[]>([]);
  const [selectedInsightsTab, setSelectedInsightsTab] = useState<InsightsTab>('adherence');
  const [docSearch, setDocSearch] = useState('');
  const [selectedDocCategory, setSelectedDocCategory] = useState<DocCategory | 'all'>('all');
  const [showAllWorkspaces, setShowAllWorkspaces] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let lastBackPress = 0;
      const onBackPress = () => {
        if (activeNavTab !== 'home') {
          setActiveNavTab('home');
          return true;
        }
        const now = Date.now();
        if (now - lastBackPress < 2000) {
          BackHandler.exitApp();
          return true;
        }
        lastBackPress = now;
        if (Platform.OS === 'android') {
          ToastAndroid.show(
            t('dashboard.press_back_again_to_exit') || 'Press back again to exit',
            ToastAndroid.SHORT,
          );
        }
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [activeNavTab])
  );

  const quickActions: { id: ActionId; label: string; Icon: LucideIcon }[] = [
    { id: 'scan', label: t('dashboard.action_scan'), Icon: ScanLine },
    { id: 'pay', label: t('dashboard.action_pay'), Icon: IndianRupee },
    { id: 'meds', label: t('dashboard.action_meds'), Icon: Pill },
    { id: 'mood', label: t('dashboard.action_mood'), Icon: Smile },
    { id: 'cycle', label: t('dashboard.action_cycle'), Icon: CalendarHeart },
    { id: 'expense', label: t('dashboard.action_expense'), Icon: Receipt },
    { id: 'smartLife', label: t('dashboard.action_smart_life'), Icon: Sparkles },
    { id: 'fuel', label: t('dashboard.action_fuel'), Icon: Fuel },
  ];

  const bentoModules: BentoModule[] = [
    {
      id: 'medicine',
      title: t('dashboard.tile_medicine'),
      subtitle: 'Cabinet & Adherence',
      tag: adherence !== null ? `${adherence}% on-time` : 'Active',
      tagColor: '#10B981',
      Icon: Pill,
    },
    {
      id: 'docs',
      title: t('dashboard.tile_docs'),
      subtitle: 'Vault & Expiry Radar',
      tag: 'Encrypted',
      tagColor: '#0070F3',
      Icon: FolderOpen,
    },
    {
      id: 'family',
      title: t('dashboard.tile_family'),
      subtitle: 'Kin & Care Circle',
      tag: 'Circle',
      tagColor: '#8B5CF6',
      Icon: Users,
    },
    {
      id: 'money',
      title: t('dashboard.tile_money'),
      subtitle: 'Passbook & Ledgers',
      tag: 'Tracked',
      tagColor: '#EC4899',
      Icon: IndianRupee,
    },
    {
      id: 'household',
      title: t('dashboard.tile_household') || 'Home Operations',
      subtitle: 'Staff & Areas',
      tag: 'Operations',
      tagColor: '#F59E0B',
      Icon: House,
    },
    {
      id: 'safety',
      title: t('dashboard.tile_safety'),
      subtitle: 'Emergency SOS',
      tag: 'Ready',
      tagColor: '#EF4444',
      Icon: ShieldCheck,
    },
    {
      id: 'wellness',
      title: t('dashboard.tile_wellness') || 'Wellness',
      subtitle: 'Mind & Mood Coach',
      tag: 'Mind & Mood',
      tagColor: '#6366F1',
      Icon: Smile,
    },
    {
      id: 'cycle',
      title: t('dashboard.tile_cycle') || 'Cycle',
      subtitle: 'Period & Life Stage',
      tag: 'Tracker',
      tagColor: '#FF2E93',
      Icon: CalendarHeart,
    },
    {
      id: 'style',
      title: t('dashboard.tile_style') || 'Style',
      subtitle: 'Wardrobe & Mirror',
      tag: 'Closet',
      tagColor: '#14B8A6',
      Icon: Shirt,
    },
    {
      id: 'events',
      title: t('dashboard.tile_events') || 'Events',
      subtitle: 'Celebrations & Budgets',
      tag: 'Planner',
      tagColor: '#F97316',
      Icon: CalendarDays,
    },
    {
      id: 'vehicles',
      title: t('dashboard.tile_vehicles') || 'Vehicles & Fuel',
      subtitle: 'Mileage & Logs',
      tag: 'Garage',
      tagColor: '#EAB308',
      Icon: Fuel,
    },
    {
      id: 'pantry',
      title: t('dashboard.tile_pantry') || 'Smart Pantry',
      subtitle: 'Kitchen & Groceries',
      tag: 'Pantry',
      tagColor: '#22C55E',
      Icon: ShoppingCart,
    },
  ];

  const filteredVaultDocs = useMemo(() => {
    return vaultDocs.filter((doc) => {
      const matchesCategory =
        selectedDocCategory === 'all' || doc.category === selectedDocCategory;
      const matchesSearch =
        doc.title.toLowerCase().includes(docSearch.toLowerCase()) ||
        doc.memberName.toLowerCase().includes(docSearch.toLowerCase()) ||
        (doc.docNumber && doc.docNumber.toLowerCase().includes(docSearch.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [vaultDocs, selectedDocCategory, docSearch]);

  const chartData = useMemo(() => {
    if (selectedInsightsTab === 'spend') return [3200, 4800, 2900, 6100, 4300, 5200, 4900];
    if (selectedInsightsTab === 'activity') return [65, 80, 72, 90, 85, 95, 88];
    return [78, 85, 92, 88, 96, 94, 98];
  }, [selectedInsightsTab]);

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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await Promise.all([
          fetchLiveProfile(),
          getItem(PROFILE_STORAGE_KEY, { name: 'Pranay', photoUri: null }).then((data) => {
            if (data && data.name && mounted) setUserName(data.name);
            if (mounted) setPhotoUri((current) => current ?? data?.photoUri ?? null);
          }),
          Promise.all([loadMedicines(), loadIntakeLog()]).then(([medicines, log]) => {
            if (mounted) {
              setMedicinesList(medicines);
              setAdherence(calculateAdherence(medicines, log));
            }
          }),
          loadDocuments().then((docs) => {
            if (mounted) setVaultDocs(docs);
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
  }, [fetchLiveProfile]);

  useEffect(() => {
    if (route.params?.profileUpdated) {
      fetchLiveProfile();
      navigation.setParams({ profileUpdated: undefined });
    }
  }, [route.params?.profileUpdated, fetchLiveProfile, navigation]);

  useEffect(() => {
    const unsubFocus = navigation.addListener('focus', () => {
      getItem(PROFILE_STORAGE_KEY, { name: 'Pranay', photoUri: null }).then((data) => {
        if (data && data.name) setUserName(data.name);
        setPhotoUri((current) => current ?? data?.photoUri ?? null);
      });

      Promise.all([loadMedicines(), loadIntakeLog()]).then(([medicines, log]) => {
        setMedicinesList(medicines);
        setAdherence(calculateAdherence(medicines, log));
      });
      loadDocuments().then((docs) => setVaultDocs(docs));
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
  }, [navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchLiveProfile(),
        getItem(PROFILE_STORAGE_KEY, { name: 'Pranay', photoUri: null }).then((data) => {
          if (data && data.name) setUserName(data.name);
          setPhotoUri((current) => current ?? data?.photoUri ?? null);
        }),
        Promise.all([loadMedicines(), loadIntakeLog()]).then(([medicines, log]) => {
          setMedicinesList(medicines);
          setAdherence(calculateAdherence(medicines, log));
        }),
        loadDocuments().then((docs) => setVaultDocs(docs)),
        loadQuickTapItems().then((items) =>
          setResourceItems(items.filter((item) => item.active))
        ),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchLiveProfile]);

  const handleTilePress = (id: TileId) => {
    if (id === 'family') navigation.navigate('Family');
    else if (id === 'medicine') navigation.navigate('Medicine');
    else if (id === 'wellness') navigation.navigate('Wellness');
    else if (id === 'cycle') navigation.navigate('Cycle');
    else if (id === 'household') navigation.navigate('HouseholdOperations');
    else if (id === 'money') navigation.navigate('ExpenseGroups');
    else if (id === 'docs') navigation.navigate('DocHub');
    else if (id === 'safety') navigation.navigate('Staff');
    else if (id === 'style') navigation.navigate('Wardrobe');
    else if (id === 'events') navigation.navigate('EventBudgets');
    else if (id === 'vehicles') navigation.navigate('Vehicles');
    else if (id === 'pantry') navigation.navigate('Pantry');
    else if (id === 'pay') navigation.navigate('ExpenseGroups');
    else if (id === 'scan') navigation.navigate('DocHub');
  };

  const handleActionPress = (id: ActionId) => {
    if (id === 'meds') navigation.navigate('Medicine');
    else if (id === 'mood') navigation.navigate('Wellness');
    else if (id === 'cycle') navigation.navigate('Cycle');
    else if (id === 'expense') navigation.navigate('ExpenseGroups');
    else if (id === 'smartLife') navigation.navigate('SmartLife');
    else if (id === 'fuel') navigation.navigate('Vehicles');
    else if (id === 'wardrobe') navigation.navigate('Wardrobe');
    else if (id === 'pay') navigation.navigate('ExpenseGroups');
    else if (id === 'scan') navigation.navigate('DocHub');
  };

  const handleNavPress = (tab: BottomNavTab) => {
    if (tab === 'center') {
      navigation.navigate('Voice');
    } else {
      setActiveNavTab(tab);
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

  const renderHealthTab = () => (
    <View style={styles.tabViewWrapper}>
      <View style={styles.tabViewHeader}>
        <Text style={styles.tabViewTitle}>{t('dashboard.tile_medicine')}</Text>
        <Text style={styles.tabViewSubtitle}>Daily intake, adherence & prescriptions</Text>
      </View>

      {/* Adherence Hero Banner */}
      <View style={styles.healthHeroBanner}>
        <View style={styles.healthHeroLeft}>
          <Text style={styles.healthHeroNumber}>
            {adherence === null ? '94%' : `${adherence}%`}
          </Text>
          <Text style={styles.healthHeroSub}>On-time adherence this week</Text>
        </View>
        <Pressable
          style={styles.healthAddBtn}
          onPress={() => navigation.navigate('Medicine')}>
          <Plus size={14} color="#FFFFFF" strokeWidth={2} />
          <Text style={styles.healthAddBtnText}>{t('medicine.add_medicine') || 'Add Med'}</Text>
        </Pressable>
      </View>

      {/* Medicine List */}
      <View style={styles.medicineList}>
        {medicinesList.length > 0 ? (
          medicinesList.slice(0, 5).map((med) => (
            <Pressable
              key={med.id}
              style={styles.medRowCard}
              onPress={() => navigation.navigate('Medicine')}>
              <View style={styles.medIconSquare}>
                <Pill size={18} color="#000000" strokeWidth={1.5} />
              </View>
              <View style={styles.medInfo}>
                <Text style={styles.medName} numberOfLines={1}>
                  {med.name}
                </Text>
                <Text style={styles.medDosage} numberOfLines={1}>
                  {med.dosage || '1 dose'} · {med.schedule && med.schedule.length > 0 ? med.schedule.join(', ') : 'Daily'}
                </Text>
              </View>
              <ChevronRight size={16} color="#000000" strokeWidth={1.3} />
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Pill size={28} color="#888888" strokeWidth={1.3} />
            <Text style={styles.emptyCardTitle}>No Medicines Added</Text>
            <Text style={styles.emptyCardSub}>Add medicines to track schedules & adherence</Text>
          </View>
        )}
      </View>

      <Button
        title={t('dashboard.tile_medicine')}
        onPress={() => navigation.navigate('Medicine')}
        style={styles.tabActionBtn}
      />
    </View>
  );

  const renderVaultTab = () => (
    <View style={styles.tabViewWrapper}>
      <View style={styles.tabViewHeader}>
        <Text style={styles.tabViewTitle}>{t('expenses.doc_hub_title')}</Text>
        <Text style={styles.tabViewSubtitle}>Encrypted vault & expiry tracking</Text>
      </View>

      {/* Search Input */}
      <View style={styles.docSearchInputWrapper}>
        <Search size={16} color="#888888" strokeWidth={1.5} />
        <TextInput
          style={styles.docSearchInput}
          placeholder="Search documents & records..."
          placeholderTextColor="#888888"
          value={docSearch}
          onChangeText={setDocSearch}
        />
      </View>

      {/* Category Filter Chips */}
      <View style={styles.vaultCatStrip}>
        {(['all', 'personal', 'medical', 'finance', 'property', 'vehicle'] as (DocCategory | 'all')[]).map((cat) => {
          const isSelected = selectedDocCategory === cat;
          return (
            <Pressable
              key={cat}
              style={[styles.vaultCatChip, isSelected && styles.vaultCatChipActive]}
              onPress={() => setSelectedDocCategory(cat)}>
              <Text style={[styles.vaultCatChipText, isSelected && styles.vaultCatChipTextActive]}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Documents List */}
      <View style={styles.docList}>
        {filteredVaultDocs.length > 0 ? (
          filteredVaultDocs.slice(0, 6).map((doc) => {
            const docStatus = doc.expiryDate
              ? getDocStatus(doc.expiryDate)
              : { status: 'valid' as const, daysLeft: 999 };
            const statusLabel =
              docStatus.status === 'expired'
                ? 'Expired'
                : docStatus.status === 'expiring'
                ? `${docStatus.daysLeft}d left`
                : 'Valid';
            const isAlert = docStatus.status === 'expired' || docStatus.status === 'expiring';

            return (
              <Pressable
                key={doc.id}
                style={styles.docRowCard}
                onPress={() => navigation.navigate('DocDetails', { docId: doc.id })}>
                <View style={styles.docIconSquare}>
                  <FileText size={18} color="#000000" strokeWidth={1.5} />
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docRowTitle} numberOfLines={1}>
                    {doc.title}
                  </Text>
                  <Text style={styles.docRowSub} numberOfLines={1}>
                    {doc.memberName} · {doc.category}
                  </Text>
                </View>
                <View
                  style={[
                    styles.docStatusPill,
                    isAlert ? styles.tagDanger : styles.tagSuccess,
                  ]}>
                  <Text
                    style={[
                      styles.docStatusText,
                      isAlert ? styles.tagTextDanger : styles.tagTextSuccess,
                    ]}>
                    {statusLabel}
                  </Text>
                </View>
              </Pressable>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <FolderOpen size={28} color="#888888" strokeWidth={1.3} />
            <Text style={styles.emptyCardTitle}>No Documents in Vault</Text>
            <Text style={styles.emptyCardSub}>Add IDs, insurance, and medical records</Text>
          </View>
        )}
      </View>

      <Button
        title={t('expenses.doc_hub_title')}
        onPress={() => navigation.navigate('DocHub')}
        style={styles.tabActionBtn}
      />
    </View>
  );

  const renderLifeTab = () => (
    <View style={styles.tabViewWrapper}>
      <View style={styles.tabViewHeader}>
        <Text style={styles.tabViewTitle}>Smart Life & Operations</Text>
        <Text style={styles.tabViewSubtitle}>Household inventory, wardrobes & utilities</Text>
      </View>

      <View style={styles.bentoGrid}>
        <Pressable
          style={({ pressed }) => [styles.bentoCard, pressed && styles.bentoCardPressed]}
          onPress={() => navigation.navigate('Pantry')}>
          <View style={styles.bentoCardTop}>
            <View style={styles.bentoIconBox}>
              <ShoppingCart size={18} color="#000000" strokeWidth={1.5} />
            </View>
            <View style={styles.bentoTag}>
              <Text style={[styles.bentoTagText, { color: '#10B981' }]}>Active</Text>
            </View>
          </View>
          <View style={styles.bentoCardBottom}>
            <View style={styles.bentoTextGroup}>
              <Text style={styles.bentoTitle}>{t('expenses.pantry_title')}</Text>
              <Text style={styles.bentoSubtitle}>{t('expenses.pantry_sub')}</Text>
            </View>
            <ChevronRight size={16} color="#000000" strokeWidth={1.3} />
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.bentoCard, pressed && styles.bentoCardPressed]}
          onPress={() => navigation.navigate('Wardrobe')}>
          <View style={styles.bentoCardTop}>
            <View style={styles.bentoIconBox}>
              <Shirt size={18} color="#000000" strokeWidth={1.5} />
            </View>
            <View style={styles.bentoTag}>
              <Text style={[styles.bentoTagText, { color: '#FF2E93' }]}>Mirror</Text>
            </View>
          </View>
          <View style={styles.bentoCardBottom}>
            <View style={styles.bentoTextGroup}>
              <Text style={styles.bentoTitle}>{t('expenses.style_mirror_title')}</Text>
              <Text style={styles.bentoSubtitle}>{t('expenses.style_mirror_sub')}</Text>
            </View>
            <ChevronRight size={16} color="#000000" strokeWidth={1.3} />
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.bentoCard, pressed && styles.bentoCardPressed]}
          onPress={() => navigation.navigate('HouseholdOperations')}>
          <View style={styles.bentoCardTop}>
            <View style={styles.bentoIconBox}>
              <House size={18} color="#000000" strokeWidth={1.5} />
            </View>
            <View style={styles.bentoTag}>
              <Text style={[styles.bentoTagText, { color: '#666666' }]}>Ops</Text>
            </View>
          </View>
          <View style={styles.bentoCardBottom}>
            <View style={styles.bentoTextGroup}>
              <Text style={styles.bentoTitle}>Home Operations</Text>
              <Text style={styles.bentoSubtitle}>Staff & Utilities</Text>
            </View>
            <ChevronRight size={16} color="#000000" strokeWidth={1.3} />
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.bentoCard, pressed && styles.bentoCardPressed]}
          onPress={() => navigation.navigate('Vehicles')}>
          <View style={styles.bentoCardTop}>
            <View style={styles.bentoIconBox}>
              <Fuel size={18} color="#000000" strokeWidth={1.5} />
            </View>
            <View style={styles.bentoTag}>
              <Text style={[styles.bentoTagText, { color: '#F59E0B' }]}>Assets</Text>
            </View>
          </View>
          <View style={styles.bentoCardBottom}>
            <View style={styles.bentoTextGroup}>
              <Text style={styles.bentoTitle}>Vehicles & Fuel</Text>
              <Text style={styles.bentoSubtitle}>Logs & Mileage</Text>
            </View>
            <ChevronRight size={16} color="#000000" strokeWidth={1.3} />
          </View>
        </Pressable>
      </View>

      <Button
        title={t('dashboard.action_smart_life')}
        onPress={() => navigation.navigate('SmartLife')}
        style={styles.tabActionBtn}
      />
    </View>
  );

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
          ) : activeNavTab === 'home' ? (
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

                {/* Minimalist Search Bar */}
                <SearchPill
                  placeholder={t('dashboard.search_placeholder')}
                  onPress={() => navigation.navigate('DocHub')}
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
                    selectedIndex={5}
                    accentColor="#000000"
                  />
                </View>

                {/* 3 Clean Stat Pillars */}
                <View style={styles.statHighlightsRow}>
                  <View style={styles.statPillar}>
                    <Text style={styles.statPillarValue}>
                      {adherence === null ? '94%' : `${adherence}%`}
                    </Text>
                    <Text style={styles.statPillarLabel} numberOfLines={1}>
                      {t('dashboard.stats_meds_title')}
                    </Text>
                  </View>

                  <View style={styles.statDivider} />

                  <View style={styles.statPillar}>
                    <Text style={styles.statPillarValue}>₹12,450</Text>
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

              {/* Minimalist Clean Bento Workspaces */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeading}>Household Workspaces</Text>
                  <Text style={styles.sectionSubCount}>
                    {showAllWorkspaces ? bentoModules.length : Math.min(6, bentoModules.length)} of {bentoModules.length}
                  </Text>
                </View>

                <View style={styles.bentoGrid}>
                  {(showAllWorkspaces ? bentoModules : bentoModules.slice(0, 6)).map((module) => (
                    <Pressable
                      key={module.id}
                      style={({ pressed }) => [
                        styles.bentoCard,
                        pressed && styles.bentoCardPressed,
                      ]}
                      onPress={() => handleTilePress(module.id)}>
                      {/* Top Row: Icon + Minimal Tag */}
                      <View style={styles.bentoCardTop}>
                        <View style={styles.bentoIconBox}>
                          <module.Icon size={18} color="#000000" strokeWidth={1.5} />
                        </View>
                        <View style={styles.bentoTag}>
                          <Text style={[styles.bentoTagText, { color: module.tagColor }]}>
                            {module.tag}
                          </Text>
                        </View>
                      </View>

                      {/* Bottom Content: Clean Title + Thin Black Arrow */}
                      <View style={styles.bentoCardBottom}>
                        <View style={styles.bentoTextGroup}>
                          <Text style={styles.bentoTitle} numberOfLines={1}>
                            {module.title}
                          </Text>
                          <Text style={styles.bentoSubtitle} numberOfLines={1}>
                            {module.subtitle}
                          </Text>
                        </View>
                        <ChevronRight size={16} color="#000000" strokeWidth={1.3} />
                      </View>
                    </Pressable>
                  ))}
                </View>

                {/* Show More / Show Less Toggle Button */}
                {bentoModules.length > 6 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      showAllWorkspaces
                        ? t('dashboard.show_less_workspaces') || 'Show fewer workspaces'
                        : t('dashboard.show_more_workspaces') || 'Show all workspaces'
                    }
                    style={({ pressed }) => [
                      styles.showMoreWorkspacesBtn,
                      pressed && styles.showMoreWorkspacesBtnPressed,
                    ]}
                    onPress={() => setShowAllWorkspaces((prev) => !prev)}>
                    <Text style={styles.showMoreWorkspacesText}>
                      {showAllWorkspaces
                        ? t('dashboard.show_less_workspaces') || 'Show fewer workspaces'
                        : t('dashboard.show_more_workspaces') || 'Show all workspaces'}
                    </Text>
                    {showAllWorkspaces ? (
                      <ChevronUp size={15} color="#000000" strokeWidth={1.8} />
                    ) : (
                      <ChevronDown size={15} color="#000000" strokeWidth={1.8} />
                    )}
                  </Pressable>
                )}
              </View>

              {/* Minimalist Footer */}
              <View style={styles.footerContainer}>
                <Text style={styles.footerBrand}>HABITA AI</Text>
                <Text style={styles.footerSub}>{t('dashboard.footer_note')}</Text>
              </View>
            </>
          ) : activeNavTab === 'health' ? (
            renderHealthTab()
          ) : activeNavTab === 'vault' ? (
            renderVaultTab()
          ) : activeNavTab === 'life' ? (
            renderLifeTab()
          ) : null}
        </View>
      </ScrollView>

      {/* Solid Black Minimalist Bottom Nav Dock */}
      <ModernBottomNav
        activeTab={activeNavTab}
        onTabPress={handleNavPress}
        badgeCounts={{ health: 2, life: 1 }}
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
      justifyContent: 'space-between',
      rowGap: spacing.xs,
    },
    actionGridColumn: {
      width: '23%',
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
      fontSize: 14,
      fontWeight: '500',
      color: '#000000',
    },
    bentoSubtitle: {
      fontFamily: fonts.sans,
      fontSize: 10,
      fontWeight: '300',
      color: '#888888',
      marginTop: 2,
    },
    sectionSubCount: {
      fontFamily: fonts.sans,
      fontSize: 12,
      fontWeight: '400',
      color: '#888888',
    },
    showMoreWorkspacesBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: '#ECECEE',
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
      marginTop: spacing.md,
      gap: 6,
      ...shadow.soft,
    },
    showMoreWorkspacesBtnPressed: {
      backgroundColor: '#F5F5F7',
      opacity: 0.9,
    },
    showMoreWorkspacesText: {
      fontFamily: fonts.sans,
      fontSize: 13,
      fontWeight: '500',
      color: '#000000',
    },
    tabViewWrapper: {
      paddingTop: spacing.xs,
    },
    tabViewHeader: {
      marginBottom: spacing.md,
    },
    tabViewTitle: {
      fontFamily: fonts.sans,
      fontSize: 16,
      fontWeight: '500',
      color: '#000000',
      marginBottom: 2,
    },
    tabViewSubtitle: {
      fontFamily: fonts.sans,
      fontSize: 12,
      fontWeight: '300',
      color: '#888888',
    },
    healthHeroBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#FFFFFF',
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: '#ECECEE',
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...shadow.soft,
    },
    healthHeroLeft: {
      flex: 1,
    },
    healthHeroNumber: {
      fontFamily: fonts.sans,
      fontSize: 28,
      fontWeight: '300',
      color: '#000000',
    },
    healthHeroSub: {
      fontFamily: fonts.sans,
      fontSize: 11,
      fontWeight: '400',
      color: '#888888',
      marginTop: 2,
    },
    healthAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#000000',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.pill,
    },
    healthAddBtnText: {
      fontFamily: fonts.sans,
      fontSize: 11,
      color: '#FFFFFF',
      fontWeight: '500',
    },
    medicineList: {
      gap: 8,
    },
    medRowCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: '#ECECEE',
      padding: spacing.md,
      ...shadow.soft,
    },
    medIconSquare: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: '#F5F5F7',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    medInfo: {
      flex: 1,
    },
    medName: {
      fontFamily: fonts.sans,
      fontSize: 14,
      fontWeight: '500',
      color: '#000000',
    },
    medDosage: {
      fontFamily: fonts.sans,
      fontSize: 11,
      fontWeight: '300',
      color: '#888888',
      marginTop: 1,
    },
    docSearchInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: '#ECECEE',
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
      height: 42,
      gap: 8,
      ...shadow.soft,
    },
    searchIconColor: {
      color: '#888888',
    },
    docSearchInput: {
      flex: 1,
      color: '#000000',
      fontFamily: fonts.sans,
      fontSize: 13,
      fontWeight: '400',
    },
    vaultCatStrip: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: spacing.md,
      flexWrap: 'wrap',
    },
    vaultCatChip: {
      backgroundColor: '#F5F5F7',
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: '#ECECEE',
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    vaultCatChipActive: {
      backgroundColor: '#000000',
      borderColor: '#000000',
    },
    vaultCatChipText: {
      fontFamily: fonts.sans,
      fontSize: 10,
      fontWeight: '400',
      color: '#666666',
    },
    vaultCatChipTextActive: {
      color: '#FFFFFF',
      fontWeight: '500',
    },
    docAlertBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(255, 59, 48, 0.06)',
      borderWidth: 1,
      borderColor: 'rgba(255, 59, 48, 0.25)',
      borderRadius: radius.md,
      padding: spacing.sm + 2,
      marginBottom: spacing.md,
    },
    docAlertText: {
      fontFamily: fonts.sans,
      fontSize: 11,
      fontWeight: '400',
      color: '#FF3B30',
    },
    docList: {
      gap: 8,
    },
    docRowCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: '#ECECEE',
      padding: spacing.md,
      ...shadow.soft,
    },
    docIconSquare: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: '#F5F5F7',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    docInfo: {
      flex: 1,
    },
    docRowTitle: {
      fontFamily: fonts.sans,
      fontSize: 14,
      fontWeight: '500',
      color: '#000000',
    },
    docRowSub: {
      fontFamily: fonts.sans,
      fontSize: 11,
      fontWeight: '300',
      color: '#888888',
      marginTop: 1,
    },
    docStatusPill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    tagSuccess: {
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
    },
    tagDanger: {
      backgroundColor: 'rgba(255, 59, 48, 0.1)',
    },
    docStatusText: {
      fontFamily: fonts.sans,
      fontSize: 9,
      fontWeight: '500',
    },
    tagTextSuccess: {
      color: '#10B981',
    },
    tagTextDanger: {
      color: '#FF3B30',
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
