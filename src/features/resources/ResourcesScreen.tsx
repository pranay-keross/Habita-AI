import React, { useEffect, useMemo, useState } from 'react';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Bolt from 'lucide-react-native/icons/bolt';
import CalendarClock from 'lucide-react-native/icons/calendar-clock';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import Droplet from 'lucide-react-native/icons/droplet';
import Droplets from 'lucide-react-native/icons/droplets';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import Flame from 'lucide-react-native/icons/flame';
import Package from 'lucide-react-native/icons/package';
import Pencil from 'lucide-react-native/icons/pencil';
import Plus from 'lucide-react-native/icons/plus';
import ScanLine from 'lucide-react-native/icons/scan-line';
import Trash2 from 'lucide-react-native/icons/trash-2';
import Wifi from 'lucide-react-native/icons/wifi';
import type { RootStackParamList } from '../../app/_layout';
import BottomSheet from '../../components/BottomSheet';
import Button from '../../components/Button';
import useAuth from '../../hooks/useAuth';
import useThemedStyles from '../../hooks/useThemedStyles';
import { subscribeToLanguageChanges, t } from '../../i18n';
import type { ThemeTokens } from '../../theme';
import { getMyPrimaryFamily } from '../family/api';
import { showNetworkUnavailableAlert } from '../../utils/networkStatus';
import {
  createLog,
  createOrUpdateQuickTapItem,
  createUtilityBill,
  loadQuickTapItems,
  loadResourceLogs,
  loadUtilityBills,
  loadUtilityTypeOptions,
  DEFAULT_QUICK_TAP_ICON,
  removeQuickTapItem,
  saveQuickTapItems,
  saveResourceLogs,
  saveUtilityBills,
  toggleUtilityBillPaid,
} from './resourceStore';
import type {
  QuickTapItem,
  ResourceLog,
  UtilityBill,
  UtilityType,
  UtilityTypeOption,
} from './types';

type Props = StackScreenProps<RootStackParamList, 'Resources'>;

const UTILITY_TYPES: { type: UtilityType; label: string; Icon: typeof Bolt }[] = [
  { type: 'electricity', label: 'resources.utility_electricity', Icon: Bolt },
  { type: 'gas', label: 'resources.utility_gas', Icon: Flame },
  { type: 'internet', label: 'resources.utility_internet', Icon: Wifi },
  { type: 'water', label: 'resources.utility_water', Icon: Droplet },
  { type: 'waste', label: 'resources.utility_waste', Icon: Trash2 },
];

const QUICK_TAP_ICONS: { value: string; label: string; Icon: typeof Bolt }[] = [
  { value: 'bolt', label: 'resources.icon_bolt', Icon: Bolt },
  { value: 'water', label: 'resources.icon_water', Icon: Droplet },
  { value: 'flame', label: 'resources.icon_flame', Icon: Flame },
  { value: 'package', label: 'resources.icon_package', Icon: Package },
];

function startOfToday(): number {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export default function ResourcesScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuth();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyChecked, setFamilyChecked] = useState(false);
  const [utilityTypeOptions, setUtilityTypeOptions] = useState<UtilityTypeOption[]>([]);
  const [items, setItems] = useState<QuickTapItem[]>([]);
  const [logs, setLogs] = useState<ResourceLog[]>([]);
  const [utilityBills, setUtilityBills] = useState<UtilityBill[]>([]);
  const [itemSheet, setItemSheet] = useState(false);
  const [logSheet, setLogSheet] = useState(false);
  const [utilitySheet, setUtilitySheet] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editingUtilityId, setEditingUtilityId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [unitLabel, setUnitLabel] = useState('');
  const [icon, setIcon] = useState(DEFAULT_QUICK_TAP_ICON);
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [logItemId, setLogItemId] = useState('');
  const [utilityType, setUtilityType] = useState<UtilityType>('electricity');
  const [provider, setProvider] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [localeVersion, setLocaleVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<'quickTap' | 'history' | 'utilities'>('quickTap');
  const [menuItem, setMenuItem] = useState<QuickTapItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [logDetails, setLogDetails] = useState<ResourceLog | null>(null);

  const loadAll = async () => {
    const token = await getAccessToken().catch(() => null);
    const family = token
      ? await getMyPrimaryFamily(token).catch(err => {
          console.warn('Resources: failed to load family', err);
          return null;
        })
      : null;
    const fid = family?.id ?? null;
    setFamilyId(fid);
    if (token) setFamilyChecked(true);
    const [savedItems, savedLogs, savedBills, typeOptions] = await Promise.all([
      loadQuickTapItems(fid, token),
      loadResourceLogs(fid, token),
      loadUtilityBills(fid, token),
      loadUtilityTypeOptions(token),
    ]);
    setItems(savedItems);
    setLogs(savedLogs);
    setUtilityBills(savedBills);
    setUtilityTypeOptions(typeOptions);
  };

  useEffect(() => {
    loadAll();
    const unsub = subscribeToLanguageChanges(() =>
      setLocaleVersion(v => v + 1),
    );
    const unsubFocus = navigation.addListener('focus', () => {
      loadAll();
    });
    return () => {
      unsub();
      unsubFocus();
    };
  }, [getAccessToken, navigation]);

  useEffect(() => {
    loadAll();
    // Re-fetches whenever the user switches tabs, so History/Utilities always
    // show the latest server data instead of whatever was loaded on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };
  const activeItems = items.filter(item => item.active);
  const todayLogs = useMemo(
    () => logs.filter(log => log.loggedAt >= startOfToday()),
    [logs],
  );
  const unpaidBillsCount = useMemo(
    () => utilityBills.filter(bill => !bill.paid).length,
    [utilityBills],
  );
  const persistItems = async (next: QuickTapItem[]) => {
    setItems(next);
    await saveQuickTapItems(next);
  };
  const persistLogs = async (next: ResourceLog[]) => {
    setLogs(next);
    await saveResourceLogs(next);
  };
  const persistUtilityBills = async (next: UtilityBill[]) => {
    setUtilityBills(next);
    await saveUtilityBills(next);
  };
  const openItem = (item?: QuickTapItem) => {
    setEditingItemId(item?.id ?? null);
    setName(item?.name ?? '');
    setUnitLabel(item?.unitLabel ?? '');
    setIcon(item?.icon ?? DEFAULT_QUICK_TAP_ICON);
    setItemSheet(true);
  };
  const openLog = (item?: QuickTapItem, log?: ResourceLog) => {
    setEditingLogId(log?.id ?? null);
    setLogItemId(log?.quickTapItemId ?? item?.id ?? activeItems[0]?.id ?? '');
    setQuantity(String(log?.quantity ?? 1));
    setNote(log?.note ?? '');
    setLogSheet(true);
  };
  const openUtility = (bill?: UtilityBill) => {
    setEditingUtilityId(bill?.id ?? null);
    setUtilityType(bill?.type ?? 'electricity');
    setProvider(bill?.provider ?? '');
    setBillAmount(bill ? String(bill.amount) : '');
    setDueDate(bill?.dueDate ?? '');
    setShowDueDatePicker(false);
    setUtilitySheet(true);
  };
  const saveItem = async () => {
    if (!name.trim() || !unitLabel.trim()) {
      Alert.alert(
        t('resources.incomplete_title'),
        t('resources.item_incomplete'),
      );
      return;
    }
    const token = await getAccessToken().catch(() => null);
    const { item: savedItem, offline } = await createOrUpdateQuickTapItem(
      { id: editingItemId, name: name.trim(), unitLabel: unitLabel.trim(), icon },
      familyId,
      token,
    );
    if (offline) {
      if (token && !familyId) {
        Alert.alert(
          t('resources.incomplete_title'),
          t('resources.no_family_message'),
        );
      } else {
        showNetworkUnavailableAlert();
      }
    }
    if (editingItemId)
      await persistItems(
        items.map(item => (item.id === editingItemId ? savedItem : item)),
      );
    else await persistItems([...items, savedItem]);
    setItemSheet(false);
    if (!offline) await loadAll();
  };
  const saveLog = async () => {
    const amount = Number(quantity);
    const item = items.find(entry => entry.id === logItemId);
    if (!item || !Number.isFinite(amount) || amount <= 0) {
      Alert.alert(
        t('resources.incomplete_title'),
        t('resources.log_incomplete'),
      );
      return;
    }
    const next = {
      quickTapItemId: item.id,
      itemName: item.name,
      quantity: amount,
      note: note.trim(),
    };
    if (editingLogId) {
      await persistLogs(
        logs.map(log => (log.id === editingLogId ? { ...log, ...next } : log)),
      );
    } else {
      const token = await getAccessToken().catch(() => null);
      const { offline } = await createLog(
        { itemName: item.name, quantity: amount, note: note.trim() },
        familyId,
        token,
      );
      if (offline && token) showNetworkUnavailableAlert();
      await persistLogs([
        { id: String(Date.now()), loggedAt: Date.now(), ...next },
        ...logs,
      ]);
      if (!offline) {
        setLogSheet(false);
        await loadAll();
        return;
      }
    }
    setLogSheet(false);
  };
  const saveUtility = async () => {
    const amount = Number(billAmount);
    if (
      !provider.trim() ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      !dueDate.trim()
    ) {
      Alert.alert(
        t('resources.incomplete_title'),
        t('resources.utility_incomplete'),
      );
      return;
    }
    const matchedOption = utilityTypeOptions.find(option =>
      option.utilityName.toLowerCase().includes(utilityType),
    );
    const utilityTypeId = matchedOption?.id ?? null;
    const next = {
      utilityTypeId,
      type: utilityType,
      provider: provider.trim(),
      amount,
      dueDate: dueDate.trim(),
    };
    if (editingUtilityId) {
      await persistUtilityBills(
        utilityBills.map(bill =>
          bill.id === editingUtilityId ? { ...bill, ...next } : bill,
        ),
      );
    } else {
      const token = await getAccessToken().catch(() => null);
      const { offline } = await createUtilityBill(
        { utilityTypeId, provider: provider.trim(), amount, dueDate: dueDate.trim() },
        familyId,
        token,
      );
      if (offline) {
        if (token && familyId && utilityTypeId == null) {
          Alert.alert(
            t('resources.incomplete_title'),
            t('resources.unknown_utility_type_message'),
          );
        } else if (token && !familyId) {
          Alert.alert(
            t('resources.incomplete_title'),
            t('resources.no_family_message'),
          );
        } else {
          showNetworkUnavailableAlert();
        }
      }
      await persistUtilityBills([
        { id: String(Date.now()), createdAt: Date.now(), paid: false, ...next },
        ...utilityBills,
      ]);
      if (!offline) {
        setUtilitySheet(false);
        await loadAll();
        return;
      }
    }
    setUtilitySheet(false);
  };
  const toggleUtilityPaid = async (bill: UtilityBill) => {
    const token = await getAccessToken().catch(() => null);
    const { offline } = await toggleUtilityBillPaid(bill.id, !bill.paid, familyId, token);
    if (offline) {
      if (token && !familyId) {
        Alert.alert(
          t('resources.incomplete_title'),
          t('resources.no_family_message'),
        );
      } else {
        showNetworkUnavailableAlert();
      }
    }
    await persistUtilityBills(
      utilityBills.map(entry =>
        entry.id === bill.id ? { ...entry, paid: !entry.paid } : entry,
      ),
    );
  };
  const formatDueDate = (value: string) => {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
  };
  const dueDateValue = (value: string) => {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  };
  const handleDueDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    setShowDueDatePicker(false);
    if (event.type !== 'set' || !selectedDate) return;
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    setDueDate(`${year}-${month}-${day}`);
  };
  const deleteItem = (target: QuickTapItem) => {
    Alert.alert(
      t('resources.remove_item_title'),
      t('resources.remove_item_message', { name: target.name }),
      [
        { text: t('resources.cancel'), style: 'cancel' },
        {
          text: t('resources.remove'),
          style: 'destructive',
          onPress: async () => {
            const token = await getAccessToken().catch(() => null);
            const { offline } = await removeQuickTapItem(target.id, token);
            if (offline && token) showNetworkUnavailableAlert();
            await persistItems(items.filter(item => item.id !== target.id));
            setItemSheet(false);
          },
        },
      ],
    );
  };
  const removeItem = () => {
    const target = items.find(item => item.id === editingItemId);
    if (!target) return;
    deleteItem(target);
  };
  const openItemMenu = (item: QuickTapItem) => {
    setMenuItem(item);
  };
  const closeItemMenu = () => setMenuItem(null);
  const handleMenuUpdate = () => {
    if (!menuItem) return;
    const target = menuItem;
    closeItemMenu();
    openItem(target);
  };
  const handleMenuRemove = () => {
    if (!menuItem) return;
    const target = menuItem;
    closeItemMenu();
    deleteItem(target);
  };
  const removeLog = () => {
    if (!editingLogId) return;
    Alert.alert(
      t('resources.remove_log_title'),
      t('resources.remove_log_message'),
      [
        { text: t('resources.cancel'), style: 'cancel' },
        {
          text: t('resources.remove'),
          style: 'destructive',
          onPress: async () => {
            await persistLogs(logs.filter(log => log.id !== editingLogId));
            setLogSheet(false);
          },
        },
      ],
    );
  };
  const formatTime = (time: number) => new Date(time).toLocaleString();
  const utilityIconFor = (type: UtilityType) =>
    UTILITY_TYPES.find(option => option.type === type)?.Icon ?? Bolt;
  const noFamily = familyChecked && !familyId;
  const goToFamily = () => navigation.navigate('Family');

  return (
    <View key={localeVersion} style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('resources.back')}
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={20} color={styles.backIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('resources.header_title')}</Text>
        {noFamily ? (
          <View style={styles.addButtonSpacer} />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('resources.add_item')}
            style={styles.addButton}
            onPress={() => openItem()}
          >
            <Plus size={20} color={styles.addIcon.color} strokeWidth={2.4} />
          </Pressable>
        )}
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {noFamily ? (
          <View style={styles.noFamilyBanner}>
            <View style={styles.noFamilyIconCircle}>
              <Droplets size={22} color={styles.heroIconColor.color} />
            </View>
            <Text style={styles.noFamilyTitle}>{t('resources.no_family_title')}</Text>
            <Text style={styles.noFamilyText}>{t('resources.no_family_banner_message')}</Text>
            <Pressable style={styles.noFamilyButton} onPress={goToFamily}>
              <Text style={styles.noFamilyButtonText}>{t('resources.go_to_family')}</Text>
            </Pressable>
          </View>
        ) : (
        <>
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIcon}>
              <Droplets size={22} color={styles.heroIconColor.color} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{t('resources.hero_title')}</Text>
              <Text style={styles.heroText}>{t('resources.hero_description')}</Text>
            </View>
          </View>
          <View style={styles.statRow}>
            <View style={styles.statPill}>
              <Text style={styles.statValue}>{todayLogs.length}</Text>
              <Text style={styles.statLabel}>{t('resources.today_logs')}</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statValue}>{activeItems.length}</Text>
              <Text style={styles.statLabel}>{t('resources.active_items')}</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={[styles.statValue, unpaidBillsCount > 0 && styles.statValueAlert]}>
                {unpaidBillsCount}
              </Text>
              <Text style={styles.statLabel}>{t('resources.unpaid_bills')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabBar}>
          {(
            [
              { key: 'quickTap' as const, label: 'resources.tab_quick_tap' },
              { key: 'history' as const, label: 'resources.tab_history' },
              { key: 'utilities' as const, label: 'resources.tab_utilities' },
            ]
          ).map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                  {t(tab.label)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'quickTap' && (
        <>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('resources.quick_tap_title')}</Text>
          <Text style={styles.sectionSubtitle}>{t('resources.quick_tap_subtitle')}</Text>
        </View>
        {activeItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Package size={22} color={styles.heroIconColor.color} />
            </View>
            <Text style={styles.emptyTitle}>{t('resources.empty_title')}</Text>
            <Text style={styles.emptyText}>{t('resources.empty_text')}</Text>
            <Button
              title={t('resources.add_first')}
              onPress={() => openItem()}
              style={styles.emptyButton}
            />
          </View>
        ) : (
          <View style={styles.listCard}>
            {activeItems.map((item, idx) => {
              const IconComponent =
                QUICK_TAP_ICONS.find(option => option.value === item.icon)?.Icon ?? Bolt;
              return (
                <Pressable
                  key={item.id}
                  style={[styles.tapListRow, idx === 0 && styles.rowFirst]}
                  onPress={() => openLog(item)}
                >
                  <View style={styles.tapIconBadge}>
                    <IconComponent size={20} color={styles.heroIconColor.color} strokeWidth={1.8} />
                  </View>
                  <View style={styles.tapListCopy}>
                    <Text style={styles.tapName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.tapUnit} numberOfLines={1}>{item.unitLabel}</Text>
                  </View>
                  <Pressable
                    accessibilityLabel={t('resources.edit_item')}
                    style={styles.tapListMenu}
                    onPress={() => openItemMenu(item)}
                    hitSlop={8}
                  >
                    <Ellipsis size={18} color={styles.menuIcon.color} />
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        )}
        </>
        )}

        {activeTab === 'history' && (
        <>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('resources.history_title')}</Text>
          <Text style={styles.sectionSubtitle}>{t('resources.history_subtitle')}</Text>
        </View>
        <Pressable
          style={[styles.fullAction, activeItems.length === 0 && styles.fullActionDisabled]}
          onPress={() => openLog()}
          disabled={activeItems.length === 0}
        >
          <Plus size={16} color={styles.fullActionText.color} strokeWidth={2.4} />
          <Text style={styles.fullActionText}>{t('resources.log_delivery')}</Text>
        </Pressable>
        {logs.length === 0 ? (
          <Text style={styles.noHistory}>{t('resources.no_history')}</Text>
        ) : (
          <View style={styles.listCard}>
            {logs.slice(0, 12).map((log, idx) => (
              <Pressable
                key={log.id}
                style={[styles.logRow, idx === 0 && styles.rowFirst]}
                onPress={() => setLogDetails(log)}
              >
                <View style={styles.logBadge}>
                  <Text style={styles.logBadgeText}>{log.quantity}</Text>
                </View>
                <View style={styles.logCopy}>
                  <Text style={styles.logName} numberOfLines={1}>{log.itemName}</Text>
                  <Text style={styles.logMeta} numberOfLines={1}>
                    {formatTime(log.loggedAt)}
                    {log.note ? ` · ${log.note}` : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
        </>
        )}

        {activeTab === 'utilities' && (
        <>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('resources.utility_bills')}</Text>
          <Text style={styles.sectionSubtitle}>{t('resources.utility_bills_subtitle')}</Text>
        </View>
        <View style={styles.utilityActionRow}>
          <Pressable style={[styles.fullAction, styles.utilityActionMain]} onPress={() => openUtility()}>
            <Plus size={16} color={styles.fullActionText.color} strokeWidth={2.4} />
            <Text style={styles.fullActionText}>{t('resources.add_utility_bill')}</Text>
          </Pressable>
          <Pressable
            style={styles.scanButton}
            onPress={() => openUtility()}
            accessibilityLabel={t('resources.scan_bill')}
          >
            <ScanLine size={18} color={styles.fullActionText.color} strokeWidth={1.8} />
          </Pressable>
        </View>
        {utilityBills.length === 0 ? (
          <Text style={styles.noHistory}>{t('resources.no_utility_bills')}</Text>
        ) : (
          <View style={styles.listCard}>
            {utilityBills.map((bill, idx) => {
              const UtilityIcon = utilityIconFor(bill.type);
              return (
                <Pressable
                  key={bill.id}
                  style={[styles.utilityRow, idx === 0 && styles.rowFirst]}
                  onPress={() => openUtility(bill)}
                >
                  <View style={styles.utilityIconBadge}>
                    <UtilityIcon size={18} color={styles.heroIconColor.color} strokeWidth={1.8} />
                  </View>
                  <View style={styles.utilityCopy}>
                    <Text style={styles.utilityName} numberOfLines={1}>
                      {
                        UTILITY_TYPES.find(option => option.type === bill.type)
                          ? t(UTILITY_TYPES.find(option => option.type === bill.type)!.label)
                          : t('resources.utility_unknown')
                      }
                    </Text>
                    <Text style={styles.utilityMeta} numberOfLines={1}>
                      {bill.provider} · {t('resources.due')} {formatDueDate(bill.dueDate)}
                    </Text>
                  </View>
                  <View style={styles.utilityStatus}>
                    <Text style={styles.utilityAmount}>
                      ₹{bill.amount.toLocaleString()}
                    </Text>
                    <Pressable
                      onPress={() => toggleUtilityPaid(bill)}
                      hitSlop={8}
                      style={[styles.paidPill, bill.paid && styles.paidPillDone]}
                    >
                      {bill.paid ? (
                        <CircleCheck size={12} color={styles.paidStatusDone.color} strokeWidth={2} />
                      ) : (
                        <CalendarClock size={12} color={styles.paidStatus.color} strokeWidth={2} />
                      )}
                      <Text
                        style={[
                          styles.paidStatus,
                          bill.paid && styles.paidStatusDone,
                        ]}
                      >
                        {bill.paid ? t('resources.paid') : t('resources.mark_paid')}
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        </>
        )}
        </>
        )}
      </ScrollView>
      <BottomSheet
        visible={itemSheet}
        onClose={() => setItemSheet(false)}
        title={t(
          editingItemId
            ? 'resources.edit_item_title'
            : 'resources.add_item_title',
        )}
      >
        <Text style={styles.label}>{t('resources.item_name')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('resources.item_name_placeholder')}
          placeholderTextColor={styles.placeholder.color}
        />
        <Text style={styles.label}>{t('resources.unit_label')}</Text>
        <TextInput
          style={styles.input}
          value={unitLabel}
          onChangeText={setUnitLabel}
          placeholder={t('resources.unit_placeholder')}
          placeholderTextColor={styles.placeholder.color}
        />
        <Text style={styles.label}>{t('resources.item_icon')}</Text>
        <View style={styles.choiceRow}>
          {QUICK_TAP_ICONS.map(option => (
            <Pressable
              key={option.value}
              onPress={() => setIcon(option.value)}
              style={[
                styles.iconChoice,
                icon === option.value && styles.choiceSelected,
              ]}
            >
              <option.Icon
                size={18}
                color={
                  icon === option.value
                    ? styles.choiceTextSelected.color
                    : styles.choiceText.color
                }
              />
              <Text
                style={[
                  styles.choiceText,
                  icon === option.value && styles.choiceTextSelected,
                ]}
              >
                {t(option.label)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Button
          title={t('resources.save_item')}
          onPress={saveItem}
          style={styles.saveButton}
        />
        {editingItemId ? (
          <Pressable style={styles.removeButton} onPress={removeItem}>
            <Text style={styles.removeText}>{t('resources.remove')}</Text>
          </Pressable>
        ) : null}
      </BottomSheet>
      <BottomSheet
        visible={logSheet}
        onClose={() => setLogSheet(false)}
        title={t(
          editingLogId ? 'resources.edit_log_title' : 'resources.add_log_title',
        )}
      >
        <Text style={styles.label}>{t('resources.choose_item')}</Text>
        <View style={styles.choiceRow}>
          {activeItems.map(item => (
            <Pressable
              key={item.id}
              onPress={() => setLogItemId(item.id)}
              style={[
                styles.choice,
                logItemId === item.id && styles.choiceSelected,
              ]}
            >
              <Text
                style={[
                  styles.choiceText,
                  logItemId === item.id && styles.choiceTextSelected,
                ]}
              >
                {item.name}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>{t('resources.quantity')}</Text>
        <TextInput
          style={styles.input}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="decimal-pad"
          placeholder={t('resources.quantity_placeholder')}
          placeholderTextColor={styles.placeholder.color}
        />
        <Text style={styles.label}>{t('resources.note')}</Text>
        <TextInput
          style={styles.input}
          value={note}
          onChangeText={setNote}
          placeholder={t('resources.note_placeholder')}
          placeholderTextColor={styles.placeholder.color}
        />
        <Button
          title={t('resources.save_log')}
          onPress={saveLog}
          style={styles.saveButton}
        />
        {editingLogId ? (
          <Pressable style={styles.removeButton} onPress={removeLog}>
            <Text style={styles.removeText}>{t('resources.remove')}</Text>
          </Pressable>
        ) : null}
      </BottomSheet>
      <BottomSheet
        visible={utilitySheet}
        onClose={() => setUtilitySheet(false)}
        title={editingUtilityId ? t('resources.edit_utility_bill') : t('resources.add_utility_bill')}
      >
        <Text style={styles.label}>{t('resources.utility_type')}</Text>
        <View style={styles.choiceRow}>
          {UTILITY_TYPES.map(option => (
            <Pressable
              key={option.type}
              onPress={() => setUtilityType(option.type)}
              style={[
                styles.iconChoice,
                utilityType === option.type && styles.choiceSelected,
              ]}
            >
              <option.Icon
                size={16}
                color={
                  utilityType === option.type
                    ? styles.choiceTextSelected.color
                    : styles.choiceText.color
                }
              />
              <Text
                style={[
                  styles.choiceText,
                  utilityType === option.type && styles.choiceTextSelected,
                ]}
              >
                {t(option.label)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>{t('resources.provider')}</Text>
        <TextInput
          style={styles.input}
          value={provider}
          onChangeText={setProvider}
          placeholder={t('resources.provider_placeholder')}
          placeholderTextColor={styles.placeholder.color}
        />
        <Text style={styles.label}>{t('resources.bill_amount')}</Text>
        <TextInput
          style={styles.input}
          value={billAmount}
          onChangeText={setBillAmount}
          keyboardType="decimal-pad"
          placeholder={t('resources.bill_amount_placeholder')}
          placeholderTextColor={styles.placeholder.color}
        />
        <Text style={styles.label}>{t('resources.due_date')}</Text>
        <Pressable
          style={styles.input}
          onPress={() => setShowDueDatePicker(true)}
        >
          <Text style={dueDate ? styles.dateValue : styles.placeholder}>
            {dueDate ? formatDueDate(dueDate) : t('resources.due_date_placeholder')}
          </Text>
        </Pressable>
        {showDueDatePicker ? (
          <DateTimePicker
            value={dueDate ? dueDateValue(dueDate) : new Date()}
            mode="date"
            display="default"
            onChange={handleDueDateChange}
          />
        ) : null}
        <Button
          title={t('resources.save_utility_bill')}
          onPress={saveUtility}
          style={styles.saveButton}
        />
      </BottomSheet>
      <BottomSheet
        visible={!!menuItem}
        onClose={closeItemMenu}
        title={menuItem?.name}
      >
        <Pressable style={styles.menuRow} onPress={handleMenuUpdate}>
          <View style={styles.menuRowIconBadge}>
            <Pencil size={18} color={styles.heroIconColor.color} strokeWidth={1.8} />
          </View>
          <Text style={styles.menuRowText}>{t('resources.update')}</Text>
        </Pressable>
        <Pressable style={styles.menuRow} onPress={handleMenuRemove}>
          <View style={[styles.menuRowIconBadge, styles.menuRowIconBadgeDanger]}>
            <Trash2 size={18} color={styles.removeText.color} strokeWidth={1.8} />
          </View>
          <Text style={[styles.menuRowText, styles.removeText]}>{t('resources.remove')}</Text>
        </Pressable>
      </BottomSheet>
      <BottomSheet
        visible={!!logDetails}
        onClose={() => setLogDetails(null)}
        title={t('resources.log_details_title')}
      >
        {logDetails ? (
          <>
            <Text style={styles.label}>{t('resources.item_name')}</Text>
            <Text style={styles.detailValue}>{logDetails.itemName}</Text>
            <Text style={styles.label}>{t('resources.quantity')}</Text>
            <Text style={styles.detailValue}>{logDetails.quantity}</Text>
            <Text style={styles.label}>{t('resources.log_details_time')}</Text>
            <Text style={styles.detailValue}>{formatTime(logDetails.loggedAt)}</Text>
            {logDetails.note ? (
              <>
                <Text style={styles.label}>{t('resources.note')}</Text>
                <Text style={styles.detailValue}>{logDetails.note}</Text>
              </>
            ) : null}
          </>
        ) : null}
      </BottomSheet>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
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
      ...shadow.soft,
    },
    addIcon: {
      color: colors.textOnPrimary,
    },
    addButtonSpacer: { width: 40, height: 40 },
    content: { padding: spacing.lg },
    noFamilyBanner: {
      alignItems: 'center',
      backgroundColor: colors.glassSurface || colors.surfaceElevated,
      borderRadius: radius.card || 20,
      borderWidth: 1,
      borderColor: colors.glassBorder || colors.border,
      padding: spacing.xl,
      ...shadow.soft,
    },
    noFamilyIconCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.blush,
      marginBottom: spacing.md,
    },
    noFamilyTitle: {
      fontFamily: fonts.serif,
      fontSize: 20,
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.xs,
    },
    noFamilyText: {
      fontFamily: fonts.sans,
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    noFamilyButton: {
      alignSelf: 'stretch',
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      paddingVertical: spacing.sm + 2,
    },
    noFamilyButtonText: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.textOnPrimary,
    },
    hero: {
      backgroundColor: colors.glassSurface || colors.surfaceElevated,
      borderRadius: radius.card || 20,
      borderWidth: 1,
      borderColor: colors.glassBorder || colors.border,
      padding: spacing.lg,
      marginBottom: spacing.xl,
      ...shadow.soft,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    heroIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.blush,
      marginRight: spacing.md,
    },
    heroIconColor: { color: colors.primary },
    heroCopy: { flex: 1 },
    heroTitle: {
      fontFamily: fonts.serif,
      fontSize: 22,
      color: colors.textPrimary,
      marginBottom: 4,
    },
    heroText: {
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
    },
    statRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    statPill: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.sm,
    },
    statValue: {
      fontFamily: fonts.serif,
      fontSize: 20,
      color: colors.primary,
    },
    statValueAlert: { color: colors.danger },
    statLabel: {
      marginTop: 2,
      fontFamily: fonts.sansMedium,
      fontSize: 10,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.pill,
      padding: 4,
      marginBottom: spacing.xl,
    },
    tabButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 9,
      borderRadius: radius.pill,
    },
    tabButtonActive: {
      backgroundColor: colors.surface,
      ...shadow.soft,
    },
    tabButtonText: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textSecondary,
    },
    tabButtonTextActive: {
      fontFamily: fonts.sansBold,
      color: colors.primary,
    },
    sectionHead: { marginBottom: spacing.md },
    sectionHeadRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginTop: spacing.xl,
    },
    sectionTitle: {
      fontFamily: fonts.serif,
      fontSize: 18,
      color: colors.textPrimary,
    },
    sectionSubtitle: {
      marginTop: 2,
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
    },
    smallAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.blush,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
    },
    fullAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.blush,
      borderRadius: radius.lg,
      paddingVertical: spacing.sm + 2,
      marginBottom: spacing.lg,
    },
    fullActionDisabled: { opacity: 0.5 },
    fullActionText: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.primary,
    },
    smallActionDisabled: { opacity: 0.5 },
    smallActionText: {
      fontFamily: fonts.sansBold,
      fontSize: 12,
      color: colors.primary,
    },
    emptyCard: {
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      borderRadius: radius.card || 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadow.soft,
    },
    emptyIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.blush,
      marginBottom: spacing.sm,
    },
    emptyTitle: {
      fontFamily: fonts.serif,
      fontSize: 18,
      color: colors.textPrimary,
    },
    emptyText: {
      marginTop: 4,
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
    },
    emptyButton: { alignSelf: 'stretch', marginTop: spacing.lg },
    tapListRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    tapListCopy: { flex: 1, marginRight: spacing.xs },
    tapListMenu: { padding: 4 },
    tapIconBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.blush,
      marginRight: spacing.sm,
    },
    tapName: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.textPrimary,
    },
    tapUnit: {
      marginTop: 2,
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textMuted,
    },
    menuIcon: { color: colors.textMuted },
    noHistory: {
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.textMuted,
    },
    listCard: {
      backgroundColor: colors.glassSurface || colors.surface,
      borderRadius: radius.card || 18,
      borderWidth: 1,
      borderColor: colors.glassBorder || colors.border,
      paddingHorizontal: spacing.md,
      ...shadow.soft,
    },
    rowFirst: { borderTopWidth: 0 },
    logRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    logBadge: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.blush,
      marginRight: spacing.sm,
    },
    logBadgeText: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.primary,
    },
    logCopy: { flex: 1, marginRight: spacing.xs },
    logName: {
      fontFamily: fonts.sansMedium,
      fontSize: 14,
      color: colors.textPrimary,
    },
    logMeta: {
      marginTop: 2,
      fontFamily: fonts.sans,
      fontSize: 11,
      color: colors.textMuted,
    },
    editText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.primary,
    },
    utilityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    utilityIconBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.blush,
      marginRight: spacing.sm,
    },
    utilityCopy: { flex: 1, marginRight: spacing.xs },
    utilityName: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.textPrimary,
    },
    utilityMeta: {
      marginTop: 2,
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textMuted,
    },
    utilityStatus: { alignItems: 'flex-end' },
    utilityAmount: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.textPrimary,
    },
    paidStatus: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: colors.primary,
    },
    paidStatusDone: { color: colors.forest },
    paidPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.blush,
    },
    paidPillDone: { backgroundColor: colors.surfaceElevated },
    utilityActionRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    utilityActionMain: { flex: 1, marginBottom: 0 },
    scanButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.blush,
      borderRadius: radius.lg,
    },
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
    choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    choice: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    choiceSelected: {
      backgroundColor: colors.blush,
      borderColor: colors.primary,
    },
    iconChoice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    choiceText: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textSecondary,
    },
    choiceTextSelected: { color: colors.primary },
    saveButton: { marginTop: spacing.lg },
    removeButton: { alignItems: 'center', paddingVertical: spacing.md },
    removeText: {
      fontFamily: fonts.sansMedium,
      fontSize: 14,
      color: colors.danger,
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    menuRowIconBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.blush,
      marginRight: spacing.md,
    },
    menuRowIconBadgeDanger: {
      backgroundColor: colors.dangerSoft || colors.blush,
    },
    menuRowText: {
      fontFamily: fonts.sansMedium,
      fontSize: 15,
      color: colors.textPrimary,
    },
    detailValue: {
      fontFamily: fonts.sans,
      fontSize: 15,
      color: colors.textPrimary,
    },
  });
