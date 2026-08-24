import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import { ShoppingCart, Shirt, ArrowLeft, ChevronRight, Info } from 'lucide-react-native';
import type { RootStackParamList } from '../../app/_layout';
import type { ThemeTokens } from '../../theme';
import useThemedStyles from '../../hooks/useThemedStyles';
import useResponsive from '../../hooks/useResponsive';
import BottomSheet from '../../components/BottomSheet';
import Button from '../../components/Button';
import { t } from '../../i18n';

type Props = StackScreenProps<RootStackParamList, 'SmartLife'>;

interface SmartModuleItem {
  id: 'pantry' | 'wardrobe';
  title: string;
  subtitle: string;
  description: string;
  tag: string;
  tagColor: string;
  Icon: typeof ShoppingCart;
}

export default function SmartLifeScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { isExpanded, contentMaxWidth } = useResponsive();
  const [infoModule, setInfoModule] = useState<SmartModuleItem | null>(null);

  const modules: SmartModuleItem[] = [
    {
      id: 'pantry',
      title: t('expenses.pantry_title'),
      subtitle: t('expenses.pantry_sub'),
      description: 'Track food stock, grocery lists, expiry dates, and automated low-stock refill reminders for your kitchen.',
      tag: t('expenses.radar_active'),
      tagColor: '#10B981',
      Icon: ShoppingCart,
    },
    {
      id: 'wardrobe',
      title: t('expenses.style_mirror_title'),
      subtitle: t('expenses.style_mirror_sub'),
      description: 'AI-curated daily outfit recommendations, digital wardrobe organizer, and weather-synchronized clothing suggestions.',
      tag: t('expenses.weather_fit'),
      tagColor: '#FF2E93',
      Icon: Shirt,
    },
  ];

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
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={maxContentStyle}>
          <Text style={styles.subTitle}>{t('expenses.operating_hub_sub')}</Text>

          <View style={styles.modulesGrid}>
            {modules.map((mod) => (
              <Pressable
                key={mod.id}
                style={({ pressed }) => [styles.moduleBox, pressed && styles.moduleBoxPressed]}
                onPress={() => navigation.navigate(mod.id === 'pantry' ? 'Pantry' : 'Wardrobe')}>
                <View style={styles.moduleBoxHeader}>
                  <View style={styles.moduleBoxBadge}>
                    <mod.Icon size={18} color="#000000" strokeWidth={1.5} />
                  </View>
                  <View style={styles.moduleTopRight}>
                    <View style={styles.moduleStatusTag}>
                      <Text style={[styles.moduleStatusTagText, { color: mod.tagColor }]}>
                        {mod.tag}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Info for ${mod.title}`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.moduleInfoBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        setInfoModule(mod);
                      }}>
                      <Info size={13} color="#888888" strokeWidth={1.8} />
                    </Pressable>
                  </View>
                </View>
                <View style={styles.moduleBoxBottom}>
                  <View style={styles.moduleTextGroup}>
                    <Text style={styles.moduleBoxTitle} numberOfLines={2}>
                      {mod.title}
                    </Text>
                    <Text style={styles.moduleBoxSub} numberOfLines={2}>
                      {mod.subtitle}
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#000000" strokeWidth={1.3} />
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Info BottomSheet */}
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
                <View style={[styles.moduleStatusTag, { alignSelf: 'flex-start', marginTop: 4 }]}>
                  <Text style={[styles.moduleStatusTagText, { color: infoModule.tagColor }]}>
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
                navigation.navigate(mod.id === 'pantry' ? 'Pantry' : 'Wardrobe');
              }}
              style={styles.infoSheetCta}
            />
          </View>
        )}
      </BottomSheet>
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
    moduleTopRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
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
    moduleInfoBtn: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#F5F5F7',
      alignItems: 'center',
      justifyContent: 'center',
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
      fontSize: 13,
      fontWeight: '600',
      color: '#000000',
      lineHeight: 17,
    },
    moduleBoxSub: {
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
  });
