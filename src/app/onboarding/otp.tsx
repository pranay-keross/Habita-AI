import React, { useEffect, useRef, useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, StyleSheet, Pressable, Alert } from 'react-native';
import { OtpInput, type OtpInputRef } from 'react-native-otp-entry';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../_layout';
import type { ThemeTokens } from '../../theme';
import useThemedStyles from '../../hooks/useThemedStyles';
import { t } from '../../i18n';
import Button from '../../components/Button';
import useAuth from '../../hooks/useAuth';
import { parseAuthError } from '../../features/auth/api';
import { getItem } from '../../utils/storage';
import { ArrowLeft, Lock } from 'lucide-react-native';

type Props = StackScreenProps<RootStackParamList, 'Otp'>;

const RESEND_COOLDOWN_SECONDS = 30;

const OtpScreen = ({ navigation, route }: Props) => {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { verify, login } = useAuth();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [resendSeconds, setResendSeconds] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);
  const otpRef = useRef<OtpInputRef>(null);

  // One-second self-rescheduling countdown rather than setInterval, so it can't drift
  // and cleanup is a single clearTimeout — stops itself once resendSeconds hits 0.
  useEffect(() => {
    if (resendSeconds <= 0) {
      return;
    }
    const timer = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendSeconds]);

  const handleResend = async () => {
    if (resendSeconds > 0 || resending) {
      return;
    }
    setResending(true);
    setError('');
    try {
      const phone = await getItem('habita.user_phone', '');
      // Same call the Phone screen makes — login first, falls back to register for a
      // first-time number — so resend works regardless of which path got us here.
      await login(phone);
      setCode('');
      otpRef.current?.clear();
      otpRef.current?.focus();
      setResendSeconds(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      const kind = parseAuthError(err);
      console.warn('OTP resend failed:', kind, err);
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
      setResending(false);
    }
  };

  const handleVerify = async () => {
    if (code.length < 6) {
      return;
    }

    setError('');
    setVerifying(true);
    try {
      const phone = await getItem('habita.user_phone', '');
      await verify(phone, code);
      // A returning user (login succeeded directly, isNewUser: false) already has a
      // profile — reset stack straight to Dashboard so back button cannot return to login/OTP.
      // Defaults to Profile if this param is missing (first-time onboarding).
      const isNewUser = route.params?.isNewUser ?? true;
      if (isNewUser) {
        navigation.navigate('Profile');
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Dashboard' }],
        });
      }
    } catch (err) {
      const kind = parseAuthError(err);
      console.warn('OTP verify failed:', kind, err);
      if (kind === 'deletion_pending') {
        Alert.alert(
          t('profile.delete_account_confirm_title') || t('onboarding.error_title'),
          t('profile.delete_account_already_pending'),
        );
      } else if (kind === 'network') {
        Alert.alert(t('onboarding.error_title'), t('onboarding.network_error'));
      } else {
        setError(t('onboarding.otp_invalid'));
        // Clear and refocus rather than leaving 6 filled boxes the user has to manually
        // delete one at a time to retry.
        otpRef.current?.clear();
        otpRef.current?.focus();
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
      <View style={[styles.root, { paddingTop: insets.top + 20 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={18} color="#000000" strokeWidth={1.5} />
        </Pressable>

        <View style={styles.content}>
          <View style={styles.heroIcon}>
            <Lock size={26} color="#000000" strokeWidth={1.5} />
          </View>
          <Text style={styles.title}>{t('onboarding.otp_title')}</Text>
          <Text style={styles.hint}>{t('onboarding.otp_hint')}</Text>

          <View style={styles.codeRow}>
            <OtpInput
              ref={otpRef}
              numberOfDigits={6}
              autoFocus
              type="numeric"
              onTextChange={(value) => {
                setError('');
                setCode(value);
              }}
              theme={{
                containerStyle: styles.codeContainer,
                pinCodeContainerStyle: error ? styles.codeBoxError : styles.codeBox,
                focusedPinCodeContainerStyle: styles.codeBoxFocused,
                filledPinCodeContainerStyle: styles.codeBoxFilled,
                pinCodeTextStyle: styles.codeText,
                focusStickStyle: styles.codeStick,
              }}
            />
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.resendRow}>
            {resendSeconds > 0 ? (
              <Text style={styles.resendMuted}>{t('onboarding.resend_in', { sec: resendSeconds })}</Text>
            ) : (
              <Pressable onPress={handleResend} disabled={resending}>
                <Text style={styles.resendLink}>{t('onboarding.resend')}</Text>
              </Pressable>
            )}
          </View>

          <Button
            title={t('onboarding.verify')}
            onPress={handleVerify}
            loading={verifying}
            disabled={code.length < 6}
            style={styles.cta}
          />

          <Pressable onPress={() => navigation.goBack()} style={styles.changeNumberBtn}>
            <Text style={styles.changeNumberLink}>{t('onboarding.change_number')}</Text>
          </Pressable>
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
  content: {
    flex: 1,
    alignItems: 'center',
    marginTop: 40,
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
  title: {
    fontFamily: fonts.serif,
    fontSize: 26,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  hint: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
  },
  codeRow: {
    width: '100%',
    marginTop: 30,
  },
  codeContainer: {
    width: '100%',
    justifyContent: 'space-between',
  },
  codeBox: {
    width: 44,
    height: 54,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  codeBoxFocused: {
    width: 44,
    height: 54,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.md,
  },
  codeBoxFilled: {
    width: 44,
    height: 54,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
  },
  codeBoxError: {
    width: 44,
    height: 54,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.danger,
    borderRadius: radius.md,
  },
  codeText: {
    fontFamily: fonts.serif,
    fontSize: 24,
    color: colors.textPrimary,
  },
  codeStick: {
    backgroundColor: colors.primary,
  },
  errorText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.danger,
    marginTop: 12,
  },
  resendRow: {
    marginTop: 18,
    alignItems: 'center',
  },
  resendMuted: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
  },
  resendLink: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.primary,
  },
  cta: {
    marginTop: 28,
    width: '100%',
  },
  changeNumberBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  changeNumberLink: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});

export default OtpScreen;
