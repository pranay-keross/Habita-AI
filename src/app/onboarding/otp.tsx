import React, { useRef, useState } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, Platform, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../_layout';
import { colors, fonts, radius, shadow, spacing } from '../../theme';
import { t } from '../../i18n';
import Button from '../../components/Button';

type Props = StackScreenProps<RootStackParamList, 'Otp'>;

const OtpScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const handleChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '');

    // Support 6-digit paste
    if (clean.length >= 6) {
      const pasteDigits = clean.slice(0, 6).split('');
      setDigits(pasteDigits);
      inputRefs.current[5]?.focus();
      return;
    }

    const singleDigit = clean.slice(-1);
    const next = [...digits];
    next[index] = singleDigit;
    setDigits(next);

    // Auto-advance to next input digit automatically
    if (singleDigit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace') {
      // Focus previous input on backspace if current is empty
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        const next = [...digits];
        next[index - 1] = '';
        setDigits(next);
      }
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
      <View style={[styles.root, { paddingTop: insets.top + 20 }]}> 
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>

        <View style={styles.content}>
          <View style={styles.heroIcon}>
            <Text style={styles.heroIconText}>🔐</Text>
          </View>
          <Text style={styles.title}>{t('onboarding.otp_title')}</Text>
          <Text style={styles.hint}>{t('onboarding.otp_hint')}</Text>
          <Text style={styles.demo}>{t('onboarding.otp_demo')}</Text>

          <View style={styles.codeRow}>
            {digits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}

                style={styles.codeBox}
                value={digit}
                onChangeText={(value) => handleChange(index, value)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus={index === 0}
              />
            ))}
          </View>

          <Button title={t('onboarding.verify')} onPress={() => navigation.navigate('Profile')} style={styles.cta} />
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
  demo: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.turmeric,
    marginTop: 20,
    backgroundColor: '#FCE3C8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 30,
  },
  codeBox: {
    width: 44,
    height: 54,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    textAlign: 'center',
    fontFamily: fonts.serif,
    fontSize: 24,
    color: colors.textPrimary,
  },
  cta: {
    marginTop: 28,
    width: '100%',
  },
});

export default OtpScreen;
