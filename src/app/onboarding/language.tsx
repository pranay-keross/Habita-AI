import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../_layout';
import type { ThemeTokens } from '../../theme';
import useThemedStyles from '../../hooks/useThemedStyles';
import {
  SUPPORTED_LANGS,
  getCurrentLanguage,
  loadSavedLanguage,
  setLanguage,
  subscribeToLanguageChanges,
  t,
} from '../../i18n';
import Button from '../../components/Button';

type Props = StackScreenProps<RootStackParamList, 'Language'>;

const LanguageScreen = ({ navigation }: Props) => {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState('en');
  const [localeVersion, setLocaleVersion] = useState(0);

  useEffect(() => {
    let active = true;
    loadSavedLanguage()
      .then((code) => {
        if (active) {
          setSelected(code);
        }
      })
      .catch(() => {
        if (active) {
          setSelected('en');
        }
      });

    const unsubscribe = subscribeToLanguageChanges(() => {
      if (active) {
        setSelected(getCurrentLanguage());
        setLocaleVersion((value) => value + 1);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const pickLanguage = async (code: string) => {
    setSelected(code);
    setLocaleVersion((value) => value + 1);
    await setLanguage(code);
  };

  const orderedLangs = [...SUPPORTED_LANGS].sort((a, b) => {
    if (a.code === 'en') return -1;
    if (b.code === 'en') return 1;
    return 0;
  });

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.heroWrap}>
        <Text style={styles.hello}>Hello · নমস্কার · नमस्ते</Text>
        <Text style={styles.hello}>வணக்கம் · Hola · مرحبا</Text>
      </View>
      <Text style={styles.title}>{t('onboarding.choose_language')}</Text>
      <Text style={styles.subtitle}>{t('onboarding.choose_language_sub')}</Text>
    </View>
  );

  return (
    <View key={localeVersion} style={styles.root}>
      <FlatList
        data={orderedLangs}
        keyExtractor={(item) => item.code}
        extraData={selected}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 90,
          },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => {
          const isActive = selected === item.code;
          return (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                isActive && styles.cardActive,
                pressed && styles.cardPressed,
              ]}
              onPress={() => pickLanguage(item.code)}
              android_ripple={{ color: isActive ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)' }}>
              <Text style={styles.flag}>{item.flag}</Text>
              <Text style={[styles.native, isActive && styles.nativeActive]}>
                {item.native}
              </Text>
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        }}
      />

      {/* Floating Bottom Fixed Action Bar */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}>
        <Button
          title={t('onboarding.continue')}
          onPress={() => navigation.navigate('Phone')}
          style={styles.cta}
        />
      </View>
    </View>
  );
};

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: '#F8F9FA',
    },
    headerContainer: {
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
    },
    heroWrap: {
      alignItems: 'center',
      marginBottom: 16,
    },
    hello: {
      fontFamily: fonts.sans,
      fontSize: 13,
      fontWeight: '500',
      color: '#555555',
      letterSpacing: 0.5,
      marginTop: 2,
    },
    title: {
      fontFamily: fonts.sans,
      fontSize: 26,
      fontWeight: '600',
      color: '#000000',
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    subtitle: {
      fontFamily: fonts.sans,
      fontSize: 13,
      fontWeight: '400',
      color: '#777777',
      textAlign: 'center',
      marginTop: 6,
      lineHeight: 18,
    },
    listContent: {
      paddingHorizontal: spacing.lg,
      gap: 12,
    },
    columnWrapper: {
      gap: 12,
    },
    card: {
      flex: 1,
      backgroundColor: '#FFFFFF',
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: '#E5E5EA',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 20,
      paddingHorizontal: 12,
      ...shadow.soft,
      elevation: 2,
    },
    cardActive: {
      backgroundColor: '#000000',
      borderColor: '#000000',
    },
    cardPressed: {
      transform: [{ scale: 0.98 }],
      opacity: 0.9,
    },
    flag: {
      fontSize: 28,
    },
    native: {
      fontFamily: fonts.sans,
      fontSize: 20,
      fontWeight: '600',
      color: '#000000',
      marginTop: 6,
    },
    nativeActive: {
      color: '#FFFFFF',
    },
    label: {
      fontFamily: fonts.sans,
      fontSize: 11,
      fontWeight: '500',
      color: '#777777',
      marginTop: 3,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    labelActive: {
      color: 'rgba(255, 255, 255, 0.75)',
    },
    bottomBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(248, 249, 250, 0.95)',
      paddingHorizontal: spacing.lg,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: '#ECECEE',
    },
    cta: {
      width: '100%',
    },
  });

export default LanguageScreen;
