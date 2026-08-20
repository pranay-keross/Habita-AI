import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Globe from 'lucide-react-native/icons/globe';
import Mic from 'lucide-react-native/icons/mic';
import Volume2 from 'lucide-react-native/icons/volume-2';
import Sparkles from 'lucide-react-native/icons/sparkles';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import Trash2 from 'lucide-react-native/icons/trash-2';
import Check from 'lucide-react-native/icons/check';
import {
  loadVoiceSettings,
  saveVoiceSettings,
  clearVoiceHistory,
  DEFAULT_VOICE_SETTINGS,
} from './voiceStore';
import type { VoiceSettings } from './types';
import { VOICE_COLORS } from './constants/colors';
import { subscribeToLanguageChanges, setLanguage, t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'VoiceSettings'>;

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi (हिंदी)', flag: '🇮🇳' },
  { code: 'bn', label: 'Bengali (বাংলা)', flag: '🇮🇳' },
  { code: 'ta', label: 'Tamil (தமிழ்)', flag: '🇮🇳' },
  { code: 'es', label: 'Spanish (Español)', flag: '🇪🇸' },
  { code: 'ar', label: 'Arabic (العربية)', flag: '🇸🇦' },
];

export default function VoiceSettingsScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [, setLocaleVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    (async () => {
      const data = await loadVoiceSettings();
      setSettings(data);
      setLoading(false);
    })();
  }, []);

  const updateSetting = <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveVoiceSettings(updated);
    if (key === 'language') {
      setLanguage(value as string);
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      t('voice_assistant.clear_history_confirm_title'),
      t('voice_assistant.clear_history_confirm_msg'),
      [
        { text: t('voice_assistant.cancel'), style: 'cancel' },
        {
          text: t('voice_assistant.clear_all'),
          style: 'destructive',
          onPress: async () => {
            await clearVoiceHistory();
            Alert.alert(t('voice_assistant.cleared_title'), t('voice_assistant.cleared_msg'));
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={VOICE_COLORS.accentBlue} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('voice_assistant.settings_title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Language Selection Section */}
        <View style={styles.sectionHeader}>
          <Globe size={18} color={VOICE_COLORS.accentBlue} />
          <Text style={styles.sectionTitle}>{t('voice_assistant.speech_language')}</Text>
        </View>

        <View style={styles.card}>
          {LANGUAGES.map((lang, index) => (
            <React.Fragment key={lang.code}>
              {index > 0 && <View style={styles.divider} />}
              <Pressable
                style={styles.langRow}
                onPress={() => updateSetting('language', lang.code as VoiceSettings['language'])}>
                <Text style={styles.flagEmoji}>{lang.flag}</Text>
                <Text style={styles.langLabel}>{lang.label}</Text>
                {settings.language === lang.code && (
                  <Check size={18} color={VOICE_COLORS.accentBlue} />
                )}
              </Pressable>
            </React.Fragment>
          ))}
        </View>

        {/* Engine Mode Section */}
        <View style={styles.sectionHeader}>
          <Sparkles size={18} color={VOICE_COLORS.accentBlue} />
          <Text style={styles.sectionTitle}>{t('voice_assistant.recognition_engine')}</Text>
        </View>

        <View style={styles.card}>
          <Pressable
            style={styles.modeRow}
            onPress={() => updateSetting('recognitionMode', 'cloud')}>
            <View style={styles.modeTextWrap}>
              <Text style={styles.modeTitle}>{t('voice_assistant.cloud_engine_title')}</Text>
              <Text style={styles.modeSub}>
                {t('voice_assistant.cloud_engine_sub')}
              </Text>
            </View>
            {settings.recognitionMode === 'cloud' && <Check size={18} color={VOICE_COLORS.accentBlue} />}
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={styles.modeRow}
            onPress={() => updateSetting('recognitionMode', 'offline')}>
            <View style={styles.modeTextWrap}>
              <Text style={styles.modeTitle}>{t('voice_assistant.offline_engine_title')}</Text>
              <Text style={styles.modeSub}>
                {t('voice_assistant.offline_engine_sub')}
              </Text>
            </View>
            {settings.recognitionMode === 'offline' && <Check size={18} color={VOICE_COLORS.accentBlue} />}
          </Pressable>
        </View>

        {/* Audio & Feedback Settings */}
        <View style={styles.sectionHeader}>
          <Volume2 size={18} color={VOICE_COLORS.accentBlue} />
          <Text style={styles.sectionTitle}>{t('voice_assistant.audio_controls')}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={styles.settingTitle}>{t('voice_assistant.audio_feedback_title')}</Text>
              <Text style={styles.settingSub}>{t('voice_assistant.audio_feedback_sub')}</Text>
            </View>
            <Switch
              value={settings.soundFeedback}
              onValueChange={(val) => updateSetting('soundFeedback', val)}
              trackColor={{ false: '#CBD5E1', true: '#7DD3FC' }}
              thumbColor={settings.soundFeedback ? VOICE_COLORS.accentBlue : '#F1F5F9'}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={styles.settingTitle}>{t('voice_assistant.auto_submit_title')}</Text>
              <Text style={styles.settingSub}>{t('voice_assistant.auto_submit_sub')}</Text>
            </View>
            <Switch
              value={settings.autoSubmit}
              onValueChange={(val) => updateSetting('autoSubmit', val)}
              trackColor={{ false: '#CBD5E1', true: '#7DD3FC' }}
              thumbColor={settings.autoSubmit ? VOICE_COLORS.accentBlue : '#F1F5F9'}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={styles.settingTitle}>{t('voice_assistant.noise_cancel_title')}</Text>
              <Text style={styles.settingSub}>{t('voice_assistant.noise_cancel_sub')}</Text>
            </View>
            <Switch
              value={settings.noiseCancellation}
              onValueChange={(val) => updateSetting('noiseCancellation', val)}
              trackColor={{ false: '#CBD5E1', true: '#7DD3FC' }}
              thumbColor={settings.noiseCancellation ? VOICE_COLORS.accentBlue : '#F1F5F9'}
            />
          </View>
        </View>

        {/* Wake Word Detection */}
        <View style={styles.sectionHeader}>
          <Mic size={18} color={VOICE_COLORS.accentBlue} />
          <Text style={styles.sectionTitle}>{t('voice_assistant.wake_word_title')}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={styles.settingTitle}>{t('voice_assistant.hands_free_title')}</Text>
              <Text style={styles.settingSub}>{t('voice_assistant.hands_free_sub')}</Text>
            </View>
            <Switch
              value={settings.wakeWordEnabled}
              onValueChange={(val) => updateSetting('wakeWordEnabled', val)}
              trackColor={{ false: '#CBD5E1', true: '#7DD3FC' }}
              thumbColor={settings.wakeWordEnabled ? VOICE_COLORS.accentBlue : '#F1F5F9'}
            />
          </View>
        </View>

        {/* Privacy & Logs */}
        <View style={styles.sectionHeader}>
          <ShieldCheck size={18} color={VOICE_COLORS.accentBlue} />
          <Text style={styles.sectionTitle}>{t('voice_assistant.privacy_history_title')}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={styles.settingTitle}>{t('voice_assistant.save_history_title')}</Text>
              <Text style={styles.settingSub}>{t('voice_assistant.save_history_sub')}</Text>
            </View>
            <Switch
              value={settings.saveHistory}
              onValueChange={(val) => updateSetting('saveHistory', val)}
              trackColor={{ false: '#CBD5E1', true: '#7DD3FC' }}
              thumbColor={settings.saveHistory ? VOICE_COLORS.accentBlue : '#F1F5F9'}
            />
          </View>

          <View style={styles.divider} />

          <Pressable style={styles.clearBtnRow} onPress={handleClearHistory}>
            <Trash2 size={18} color={VOICE_COLORS.dangerRed} />
            <Text style={styles.clearBtnText}>{t('voice_assistant.clear_history_log')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      backgroundColor: colors.background,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.soft,
    },
    headerIcon: {
      color: colors.textPrimary,
    },
    headerTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 18,
      color: colors.textPrimary,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: spacing.lg,
      marginBottom: spacing.xs,
    },
    sectionTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 4,
      ...shadow.soft,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: spacing.md,
    },
    langRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      gap: 12,
    },
    flagEmoji: {
      fontSize: 20,
    },
    langLabel: {
      flex: 1,
      fontFamily: fonts.sansMedium,
      fontSize: 14,
      color: colors.textPrimary,
    },
    modeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      gap: 12,
    },
    modeTextWrap: {
      flex: 1,
    },
    modeTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.textPrimary,
    },
    modeSub: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      gap: 12,
    },
    switchTextWrap: {
      flex: 1,
    },
    settingTitle: {
      fontFamily: fonts.sansMedium,
      fontSize: 14,
      color: colors.textPrimary,
    },
    settingSub: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    clearBtnRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
    },
    clearBtnText: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: '#EF4444',
    },
  });
