import React, { useState } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, Platform, StyleSheet, Alert, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../_layout';
import type { ThemeTokens } from '../../theme';
import useThemedStyles from '../../hooks/useThemedStyles';
import { getCurrentLanguage, t } from '../../i18n';
import Button from '../../components/Button';
import { setItem } from '../../utils/storage';
import useAuth from '../../hooks/useAuth';
import { parseAuthError } from '../../features/auth/api';
import { ArrowLeft, Phone as PhoneIcon } from 'lucide-react-native';

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
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [phone, setPhone] = useState(() => getCountryCodeForLang(getCurrentLanguage()));
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.length < 7) {
      Alert.alert(t('onboarding.error_title'), t('onboarding.phone_invalid'));
      return;
    }

    setSubmitting(true);
    try {
      const { isNewUser } = await login(cleaned);
      await setItem('habita.user_phone', cleaned);
      navigation.navigate('Otp', { isNewUser });
    } catch (err) {
      const kind = parseAuthError(err);
      console.warn('Phone submit failed:', kind, err);
      if (kind === 'deletion_pending') {
        Alert.alert(
          t('profile.delete_account_confirm_title') || t('onboarding.error_title'),
          t('profile.delete_account_already_pending'),
        );
      } else if (kind === 'network') {
        Alert.alert(t('onboarding.error_title'), t('onboarding.network_error'));
      } else {
        Alert.alert(t('onboarding.error_title'), t('onboarding.phone_invalid'));
      }
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
      <View style={[styles.root, { paddingTop: insets.top + 20 }]}> 
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={18} color="#000000" strokeWidth={1.5} />
        </Pressable>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <PhoneIcon size={26} color="#000000" strokeWidth={1.5} />
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
            placeholderTextColor={styles.placeholder.color}
            autoFocus
          />

          <Button
            title={t('onboarding.continue')}
            onPress={submit}
            loading={submitting}
            style={styles.cta}
          />

          <Text style={styles.terms}>{t('onboarding.phone_terms')}</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) => StyleSheet.create({
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
    backgroundColor: colors.surfaceElevated,
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
  // `placeholderTextColor` is a prop, not a style — the colour is kept here so
  // the factory stays the single place this screen reads the palette.
  placeholder: {
    color: colors.textMuted,
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
