import React, { useState } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, Platform, StyleSheet, Alert, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../_layout';
import { colors, fonts, radius, shadow, spacing } from '../../theme';
import { getCurrentLanguage, t } from '../../i18n';
import Button from '../../components/Button';
import { setItem } from '../../utils/storage';

type Props = StackScreenProps<RootStackParamList, 'Phone'>;

const getCountryCodeForLang = (lang: string) => {
  switch (lang) {
    case 'es':
      return '+34 ';
    case 'ar':
      return '+966 ';
    default:
      return '+91 ';
  }
};

const PhoneScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState(() => getCountryCodeForLang(getCurrentLanguage()));

  const submit = async () => {
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.length < 7) {
      Alert.alert(t('common.error') || 'Error', 'Please enter a valid phone number');
      return;
    }
    await setItem('saheli.user_phone', phone.trim());
    navigation.navigate('Otp');
  };


  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
      <View style={[styles.root, { paddingTop: insets.top + 20 }]}> 
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Text style={styles.heroIconText}>📞</Text>
          </View>
          <Text style={styles.welcome}>{t('onboarding.welcome')}</Text>
          <Text style={styles.welcomeSub}>{t('onboarding.welcome_sub')}</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>{t('onboarding.phone_title')}</Text>
          <Text style={styles.hint}>{t('onboarding.phone_hint')}</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder={t('onboarding.phone_placeholder')}
            placeholderTextColor={colors.textMuted}
            autoFocus
          />

          <Button title={`${t('onboarding.continue')} →`} onPress={submit} style={styles.cta} />

          <Text style={styles.terms}>We will send a 6-digit verification code. Use 123456 in demo mode.</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  root: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  backIcon: {
    fontSize: 20,
    color: colors.textPrimary,
  },
  hero: {
    alignItems: 'center',
    marginTop: 32,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroIconText: {
    fontSize: 28,
  },
  welcome: {
    fontFamily: fonts.serif,
    fontSize: 28,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  welcomeSub: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
  },
  form: {
    marginTop: 28,
  },
  label: {
    fontFamily: fonts.serif,
    fontSize: 20,
    color: colors.textPrimary,
  },
  hint: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 18,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontFamily: fonts.sansMedium,
    fontSize: 18,
    letterSpacing: 0.5,
    color: colors.textPrimary,
  },
  cta: {
    marginTop: 20,
  },
  terms: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
});

export default PhoneScreen;
