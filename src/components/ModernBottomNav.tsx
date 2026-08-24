import React from 'react';
import { View, Text, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  House,
  Users,
  HeartPulse,
  FolderOpen,
  Mic,
  type LucideIcon,
} from 'lucide-react-native';
import type { ThemeTokens } from '../theme';
import useThemedStyles from '../hooks/useThemedStyles';
import useResponsive from '../hooks/useResponsive';
import { t } from '../i18n';

export type BottomNavTab = 'home' | 'family' | 'center' | 'health' | 'vault';

interface ModernBottomNavProps {
  activeTab?: BottomNavTab;
  onTabPress: (tab: BottomNavTab) => void;
  style?: StyleProp<ViewStyle>;
  badgeCounts?: Partial<Record<BottomNavTab, number>>;
}

export default function ModernBottomNav({
  activeTab = 'home',
  onTabPress,
  style,
  badgeCounts,
}: ModernBottomNavProps) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { isExpanded } = useResponsive();

  const tabs: { id: BottomNavTab; label: string; Icon: LucideIcon }[] = [
    { id: 'home', label: t('nav.home') || 'Home', Icon: House },
    { id: 'family', label: t('nav.family') || 'Family', Icon: Users },
    { id: 'center', label: t('nav.ai') || 'Habita AI', Icon: Mic },
    { id: 'health', label: t('nav.health') || 'Health', Icon: HeartPulse },
    { id: 'vault', label: t('nav.vault') || 'Vault', Icon: FolderOpen },
  ];

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.outerContainer,
        { paddingBottom: Math.max(insets.bottom, 12) },
        style,
      ]}>
      <View style={[styles.dock, isExpanded && styles.dockTablet]}>
        {tabs.map((tab) => {
          if (tab.id === 'center') {
            return (
              <View key={tab.id} style={styles.centerTabWrapper}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Habita AI Assistant"
                  style={({ pressed }) => [
                    styles.centerButton,
                    pressed && styles.centerButtonPressed,
                  ]}
                  onPress={() => onTabPress('center')}>
                  <View style={styles.centerInnerGlow}>
                    <tab.Icon
                      size={20}
                      color={styles.centerIconColor.color}
                      strokeWidth={1.6}
                    />
                  </View>
                </Pressable>
              </View>
            );
          }

          const isActive = activeTab === tab.id;
          const badgeCount = badgeCounts?.[tab.id];

          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              style={({ pressed }) => [
                styles.tabButton,
                isActive && styles.tabButtonActive,
                pressed && styles.tabButtonPressed,
              ]}
              onPress={() => onTabPress(tab.id)}>
              <View style={[styles.tabIconContainer, isActive && styles.tabIconContainerActive]}>
                <tab.Icon
                  size={19}
                  color={
                    isActive
                      ? styles.activeIconColor.color
                      : styles.inactiveIconColor.color
                  }
                  strokeWidth={isActive ? 1.8 : 1.4}
                />
                {badgeCount && badgeCount > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  isActive && styles.tabLabelActive,
                ]}
                numberOfLines={1}>
                {tab.label}
              </Text>
              {isActive ? <View style={styles.activeDot} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    outerContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      zIndex: 99,
    },
    dock: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      width: '100%',
      maxWidth: 420,
      height: 62,
      backgroundColor: '#0D0D0D',
      borderRadius: 24,
      borderWidth: 1,
      borderColor: '#222222',
      paddingHorizontal: spacing.sm,
      ...shadow.medium,
      shadowColor: '#000000',
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 8,
    },
    dockTablet: {
      maxWidth: 520,
      height: 68,
    },
    tabButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 4,
      height: '100%',
    },
    tabButtonActive: {
      borderRadius: radius.pill,
    },
    tabButtonPressed: {
      opacity: 0.7,
    },
    tabIconContainer: {
      width: 34,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    tabIconContainerActive: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    activeIconColor: {
      color: '#FFFFFF',
    },
    inactiveIconColor: {
      color: '#8E8E93',
    },
    tabLabel: {
      fontFamily: fonts.sans,
      fontSize: 9,
      fontWeight: '400',
      color: '#8E8E93',
      letterSpacing: 0.3,
      marginTop: 2,
    },
    tabLabelActive: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    activeDot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: '#FFFFFF',
      marginTop: 2,
    },
    centerTabWrapper: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      top: -12,
    },
    centerButton: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: '#1C1C1E',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: '#2C2C2E',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 8,
    },
    centerButtonPressed: {
      transform: [{ scale: 0.94 }],
    },
    centerInnerGlow: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: '#2C2C2E',
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerIconColor: {
      color: '#FFFFFF',
    },
    badge: {
      position: 'absolute',
      top: -2,
      right: -4,
      backgroundColor: colors.danger,
      borderRadius: radius.pill,
      minWidth: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    badgeText: {
      fontFamily: fonts.sansBold,
      fontSize: 9,
      color: '#FFFFFF',
    },
  });
