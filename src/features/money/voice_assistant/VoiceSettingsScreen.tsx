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
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear Voice History',
      'Are you sure you want to delete all recorded voice command logs from this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearVoiceHistory();
            Alert.alert('Cleared', 'Voice command history has been wiped.');
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color="#0284C7" />
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
        <Text style={styles.headerTitle}>Voice Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Language Selection Section */}
        <View style={styles.sectionHeader}>
          <Globe size={18} color="#0284C7" />
          <Text style={styles.sectionTitle}>Speech Recognition Language</Text>
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
                  <Check size={18} color="#0284C7" />
                )}
              </Pressable>
            </React.Fragment>
          ))}
        </View>

        {/* Engine Mode Section */}
        <View style={styles.sectionHeader}>
          <Sparkles size={18} color="#0284C7" />
          <Text style={styles.sectionTitle}>Recognition Engine</Text>
        </View>

        <View style={styles.card}>
          <Pressable
            style={styles.modeRow}
            onPress={() => updateSetting('recognitionMode', 'cloud')}>
            <View style={styles.modeTextWrap}>
              <Text style={styles.modeTitle}>Dual-LLM Cloud AI Engine</Text>
              <Text style={styles.modeSub}>
                Highest accuracy, understands complex household finance & medical commands.
              </Text>
            </View>
            {settings.recognitionMode === 'cloud' && <Check size={18} color="#0284C7" />}
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={styles.modeRow}
            onPress={() => updateSetting('recognitionMode', 'offline')}>
            <View style={styles.modeTextWrap}>
              <Text style={styles.modeTitle}>On-Device Offline Recognition</Text>
              <Text style={styles.modeSub}>
                Faster response time, operates without internet connection.
              </Text>
            </View>
            {settings.recognitionMode === 'offline' && <Check size={18} color="#0284C7" />}
          </Pressable>
        </View>

        {/* Audio & Feedback Settings */}
        <View style={styles.sectionHeader}>
          <Volume2 size={18} color="#0284C7" />
          <Text style={styles.sectionTitle}>Audio & Controls</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={styles.settingTitle}>Audio Feedback Sounds</Text>
              <Text style={styles.settingSub}>Play a chime tone when microphone starts listening.</Text>
            </View>
            <Switch
              value={settings.soundFeedback}
              onValueChange={(val) => updateSetting('soundFeedback', val)}
              trackColor={{ false: '#CBD5E1', true: '#7DD3FC' }}
              thumbColor={settings.soundFeedback ? '#0284C7' : '#F1F5F9'}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={styles.settingTitle}>Auto-Submit Spoken Commands</Text>
              <Text style={styles.settingSub}>Execute voice intents automatically after 2s of silence.</Text>
            </View>
            <Switch
              value={settings.autoSubmit}
              onValueChange={(val) => updateSetting('autoSubmit', val)}
              trackColor={{ false: '#CBD5E1', true: '#7DD3FC' }}
              thumbColor={settings.autoSubmit ? '#0284C7' : '#F1F5F9'}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={styles.settingTitle}>Noise Cancellation</Text>
              <Text style={styles.settingSub}>Filter background home noise during microphone capture.</Text>
            </View>
            <Switch
              value={settings.noiseCancellation}
              onValueChange={(val) => updateSetting('noiseCancellation', val)}
              trackColor={{ false: '#CBD5E1', true: '#7DD3FC' }}
              thumbColor={settings.noiseCancellation ? '#0284C7' : '#F1F5F9'}
            />
          </View>
        </View>

        {/* Wake Word Detection */}
        <View style={styles.sectionHeader}>
          <Mic size={18} color="#0284C7" />
          <Text style={styles.sectionTitle}>Wake Word & Hands-Free</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={styles.settingTitle}>Hands-Free "Hey Habita"</Text>
              <Text style={styles.settingSub}>Listen for wake word trigger without tapping the mic button.</Text>
            </View>
            <Switch
              value={settings.wakeWordEnabled}
              onValueChange={(val) => updateSetting('wakeWordEnabled', val)}
              trackColor={{ false: '#CBD5E1', true: '#7DD3FC' }}
              thumbColor={settings.wakeWordEnabled ? '#0284C7' : '#F1F5F9'}
            />
          </View>
        </View>

        {/* Privacy & Logs */}
        <View style={styles.sectionHeader}>
          <ShieldCheck size={18} color="#0284C7" />
          <Text style={styles.sectionTitle}>Privacy & History</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={styles.settingTitle}>Save Voice Command History</Text>
              <Text style={styles.settingSub}>Keep local logs of past voice intents for quick review.</Text>
            </View>
            <Switch
              value={settings.saveHistory}
              onValueChange={(val) => updateSetting('saveHistory', val)}
              trackColor={{ false: '#CBD5E1', true: '#7DD3FC' }}
              thumbColor={settings.saveHistory ? '#0284C7' : '#F1F5F9'}
            />
          </View>

          <View style={styles.divider} />

          <Pressable style={styles.clearBtnRow} onPress={handleClearHistory}>
            <Trash2 size={18} color="#EF4444" />
            <Text style={styles.clearBtnText}>Clear Voice History Log</Text>
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
