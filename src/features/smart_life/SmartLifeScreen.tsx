import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import { FileText, Mic, ShoppingCart, Shirt, ArrowLeft, ChevronRight } from 'lucide-react-native';
import type { RootStackParamList } from '../../app/_layout';
import type { ThemeTokens } from '../../theme';
import useThemedStyles from '../../hooks/useThemedStyles';
import useResponsive from '../../hooks/useResponsive';
import ModernBottomNav, { type BottomNavTab } from '../../components/ModernBottomNav';
import { t } from '../../i18n';

type Props = StackScreenProps<RootStackParamList, 'SmartLife'>;

export default function SmartLifeScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { isExpanded, contentMaxWidth } = useResponsive();

  const handleNavPress = (tab: BottomNavTab) => {
    if (tab === 'home') navigation.navigate('Dashboard');
    else if (tab === 'life') {
      // already here
    } else if (tab === 'center') navigation.navigate('Voice');
    else if (tab === 'health') navigation.navigate('Medicine');
    else if (tab === 'vault') navigation.navigate('DocHub');
  };

  const maxContentStyle = isExpanded
    ? { maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as const }
    : { width: '100%' as const };

  return (
    <View style={styles.root}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.headerContent, maxContentStyle]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={18} color="#000000" strokeWidth={1.5} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('expenses.operating_hub_title')}</Text>
          <View style={styles.backBtnPlaceholder} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={maxContentStyle}>
          <Text style={styles.subTitle}>{t('expenses.operating_hub_sub')}</Text>

          <View style={styles.modulesGrid}>
            <Pressable
              style={({ pressed }) => [styles.moduleBox, pressed && styles.moduleBoxPressed]}
              onPress={() => navigation.navigate('DocHub')}>
              <View style={styles.moduleBoxHeader}>
                <View style={styles.moduleBoxBadge}>
                  <FileText size={18} color="#000000" strokeWidth={1.5} />
                </View>
                <View style={styles.moduleStatusTag}>
                  <Text style={[styles.moduleStatusTagText, { color: '#0070F3' }]}>
                    {t('expenses.vaulted_count')}
                  </Text>
                </View>
              </View>
              <View style={styles.moduleBoxBottom}>
                <View style={styles.moduleTextGroup}>
                  <Text style={styles.moduleBoxTitle}>{t('expenses.doc_hub_title')}</Text>
                  <Text style={styles.moduleBoxSub}>{t('expenses.doc_hub_sub')}</Text>
                </View>
                <ChevronRight size={16} color="#000000" strokeWidth={1.3} />
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.moduleBox, pressed && styles.moduleBoxPressed]}
              onPress={() => navigation.navigate('Pantry')}>
              <View style={styles.moduleBoxHeader}>
                <View style={styles.moduleBoxBadge}>
                  <ShoppingCart size={18} color="#000000" strokeWidth={1.5} />
                </View>
                <View style={styles.moduleStatusTag}>
                  <Text style={[styles.moduleStatusTagText, { color: '#10B981' }]}>
                    {t('expenses.radar_active')}
                  </Text>
                </View>
              </View>
              <View style={styles.moduleBoxBottom}>
                <View style={styles.moduleTextGroup}>
                  <Text style={styles.moduleBoxTitle}>{t('expenses.pantry_title')}</Text>
                  <Text style={styles.moduleBoxSub}>{t('expenses.pantry_sub')}</Text>
                </View>
                <ChevronRight size={16} color="#000000" strokeWidth={1.3} />
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.moduleBox, pressed && styles.moduleBoxPressed]}
              onPress={() => navigation.navigate('Voice')}>
              <View style={styles.moduleBoxHeader}>
                <View style={styles.moduleBoxBadge}>
                  <Mic size={18} color="#000000" strokeWidth={1.5} />
                </View>
                <View style={styles.moduleStatusTag}>
                  <Text style={[styles.moduleStatusTagText, { color: '#6A35FF' }]}>
                    {t('expenses.ai_copilot')}
                  </Text>
                </View>
              </View>
              <View style={styles.moduleBoxBottom}>
                <View style={styles.moduleTextGroup}>
                  <Text style={styles.moduleBoxTitle}>{t('expenses.voice_engine_title')}</Text>
                  <Text style={styles.moduleBoxSub}>{t('expenses.voice_engine_sub')}</Text>
                </View>
                <ChevronRight size={16} color="#000000" strokeWidth={1.3} />
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.moduleBox, pressed && styles.moduleBoxPressed]}
              onPress={() => navigation.navigate('Wardrobe')}>
              <View style={styles.moduleBoxHeader}>
                <View style={styles.moduleBoxBadge}>
                  <Shirt size={18} color="#000000" strokeWidth={1.5} />
                </View>
                <View style={styles.moduleStatusTag}>
                  <Text style={[styles.moduleStatusTagText, { color: '#FF2E93' }]}>
                    {t('expenses.weather_fit')}
                  </Text>
                </View>
              </View>
              <View style={styles.moduleBoxBottom}>
                <View style={styles.moduleTextGroup}>
                  <Text style={styles.moduleBoxTitle}>{t('expenses.style_mirror_title')}</Text>
                  <Text style={styles.moduleBoxSub}>{t('expenses.style_mirror_sub')}</Text>
                </View>
                <ChevronRight size={16} color="#000000" strokeWidth={1.3} />
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Solid Black Minimalist Bottom Navigation Bar */}
      <ModernBottomNav
        activeTab="life"
        onTabPress={handleNavPress}
        badgeCounts={{ health: 2 }}
      />
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerBar: {
      backgroundColor: '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: '#ECECEE',
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#F5F5F7',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#EAEAEA',
    },
    backBtnPlaceholder: {
      width: 36,
    },
    headerTitle: {
      fontFamily: fonts.sans,
      fontSize: 16,
      fontWeight: '600',
      color: '#000000',
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    subTitle: {
      fontFamily: fonts.sans,
      fontSize: 12,
      fontWeight: '300',
      color: '#888888',
      marginBottom: spacing.md,
    },
    modulesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      justifyContent: 'space-between',
    },
    moduleBox: {
      width: '48%',
      backgroundColor: '#FFFFFF',
      borderRadius: radius.card,
      padding: spacing.md,
      minHeight: 114,
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: '#ECECEE',
      ...shadow.soft,
    },
    moduleBoxPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.98 }],
    },
    moduleBoxHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    moduleBoxBadge: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: '#F5F5F7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    moduleStatusTag: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.pill,
      backgroundColor: '#F5F5F7',
    },
    moduleStatusTagText: {
      fontFamily: fonts.sans,
      fontSize: 9,
      fontWeight: '500',
    },
    moduleBoxBottom: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    moduleTextGroup: {
      flex: 1,
      marginRight: 4,
    },
    moduleBoxTitle: {
      fontFamily: fonts.sans,
      fontSize: 14,
      fontWeight: '500',
      color: '#000000',
    },
    moduleBoxSub: {
      fontFamily: fonts.sans,
      fontSize: 10,
      fontWeight: '300',
      color: '#888888',
      marginTop: 2,
    },
  });
