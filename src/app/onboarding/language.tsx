import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../_layout';
import { colors, fonts, radius, shadow, spacing } from '../../theme';
import { SUPPORTED_LANGS, getCurrentLanguage, loadSavedLanguage, setLanguage, subscribeToLanguageChanges, t } from '../../i18n';
import Button from '../../components/Button';

type Props = StackScreenProps<RootStackParamList, 'Language'>;

const LanguageScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState('en');
  const [localeVersion, setLocaleVersion] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    loadSavedLanguage()
      .then((code) => {
        if (active) {
          setSelected(code);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setSelected('en');
          setReady(true);
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

  return (
    <View key={localeVersion} style={[styles.root, { paddingTop: insets.top + 20 }]}> 
      <View style={styles.heroWrap}>
        <Text style={styles.hello}>Hello · নমস্কার · नमस्ते</Text>
        <Text style={styles.hello}>வணக்கம் · Hola · مرحبا</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{t('onboarding.choose_language')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.choose_language_sub')}</Text>

        <FlatList
          data={orderedLangs}
          keyExtractor={(item) => item.code}
          extraData={selected}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, selected === item.code && styles.cardActive]}
              onPress={() => pickLanguage(item.code)}
              android_ripple={{ color: 'rgba(255,255,255,0.16)' }}>
              <Text style={styles.flag}>{item.flag}</Text>
              <Text style={[styles.native, selected === item.code && { color: '#FFF' }]}>{item.native}</Text>
              <Text style={[styles.label, selected === item.code && { color: colors.blush }]}>{item.label}</Text>
            </Pressable>
          )}
        />

        <Button title={`${t('onboarding.continue')} →`} onPress={() => navigation.navigate('Phone')} disabled={!ready} style={styles.cta} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  heroWrap: {
    alignItems: 'center',
    marginVertical: 12,
  },
  hello: {
    fontFamily: fonts.serif,
    fontSize: 15,
    color: colors.primary,
    marginTop: 4,
  },
  content: {
    flex: 1,
    marginTop: 24,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 30,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
  },
  listContent: {
    gap: 12,
    marginTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  columnWrapper: {
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: radius.xl,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
    ...shadow.soft,
  },
  cardActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  flag: {
    fontSize: 28,
  },
  native: {
    fontFamily: fonts.serif,
    fontSize: 22,
    color: colors.textPrimary,
    marginTop: 6,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cta: {
    marginTop: 18,
    marginBottom: 30,
  },
});

export default LanguageScreen;
