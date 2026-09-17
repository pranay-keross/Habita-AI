import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../app/_layout';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import useAuth from '../../../hooks/useAuth';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Send from 'lucide-react-native/icons/send';
import Trash2 from 'lucide-react-native/icons/trash-2';
import {
  saveOutfit,
  sendStyleMessage,
  todaysEvent,
  unsaveOutfit,
} from '../stylePantryStore';
import { describeStoreError, showStoreErrorAlert } from '../errors';
import { useBusy, useKeyboardHeight, useLocaleRerender } from '../hooks';
import WardrobeHeader from '../components/WardrobeHeader';
import OutfitShowcase from '../components/OutfitShowcase';
import ItemThumb from '../components/ItemThumb';
import type { ClothingItem, OutfitRecommendation, StyleChatTurn } from '../types';
import { t } from '../../../i18n';

type Props = StackScreenProps<RootStackParamList, 'StyleChat'>;

type ChatMessage =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; text: string; outfit?: OutfitRecommendation; items?: ClothingItem[] }
  | { id: string; role: 'error'; text: string };

const PROMPT_KEYS = ['prompt_colours', 'prompt_loafers', 'prompt_pack', 'prompt_capsule'];

let seq = 0;
const nextId = (p: string) => `${p}_${Date.now()}_${seq++}`;

function introMessage(): ChatMessage {
  return { id: 'intro', role: 'assistant', text: t('style_chat.intro') };
}

function toHistory(messages: ChatMessage[]): StyleChatTurn[] {
  const turns: StyleChatTurn[] = [];
  for (const m of messages) {
    if (m.id === 'intro') continue;
    if (m.role === 'user') turns.push({ role: 'user', text: m.text });
    else if (m.role === 'assistant') {
      turns.push({ role: 'assistant', text: m.text || m.outfit?.title || '' });
    }
  }
  return turns;
}

export default function StyleChatScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuth();
  useLocaleRerender();

  const [messages, setMessages] = useState<ChatMessage[]>([introMessage()]);
  const [composerText, setComposerText] = useState('');
  const [sending, send] = useBusy();
  const [savingId, setSavingId] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const scrollToEnd = () =>
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

  // Android (SDK 36, edge-to-edge) ignores adjustResize, so pad the composer by the
  // keyboard height ourselves; iOS keeps the KeyboardAvoidingView root.
  const keyboardHeight = useKeyboardHeight();
  const composerBottomPad =
    (Platform.OS === 'android' && keyboardHeight > 0 ? keyboardHeight : insets.bottom) + 10;
  useEffect(() => {
    if (keyboardHeight > 0) scrollToEnd();
  }, [keyboardHeight]);

  const handleSend = (raw?: string) => {
    const message = (raw ?? composerText).trim();
    if (!message) return;
    send(async () => {
      setComposerText('');
      const history = toHistory(messages);
      setMessages(prev => [...prev, { id: nextId('u'), role: 'user', text: message }]);
      scrollToEnd();
      const token = await getAccessToken();
      const result = await sendStyleMessage(
        { message, history, event: todaysEvent() },
        token,
      );
      setMessages(prev => {
        if (!result.ok) {
          return [
            ...prev,
            { id: nextId('e'), role: 'error', text: describeStoreError(result.error) },
          ];
        }
        const { reply, outfit, items } = result.data;
        return [
          ...prev,
          { id: nextId('a'), role: 'assistant', text: reply, outfit: outfit ?? undefined, items: items ?? undefined },
        ];
      });
      scrollToEnd();
    });
  };

  const handleToggleSave = async (msgId: string, outfit: OutfitRecommendation) => {
    if (savingId) return;
    setSavingId(msgId);
    try {
      const token = await getAccessToken();
      if (outfit.isSaved) {
        const result = await unsaveOutfit(outfit.id, token);
        if (!result.ok) {
          showStoreErrorAlert(result.error);
          return;
        }
        setMessages(prev =>
          prev.map(m =>
            m.role === 'assistant' && m.id === msgId && m.outfit
              ? { ...m, outfit: { ...m.outfit, isSaved: false } }
              : m,
          ),
        );
        return;
      }
      const result = await saveOutfit(outfit, token);
      if (!result.ok) {
        showStoreErrorAlert(result.error);
        return;
      }
      setMessages(prev =>
        prev.map(m =>
          m.role === 'assistant' && m.id === msgId ? { ...m, outfit: result.data } : m,
        ),
      );
      Alert.alert(
        t('style_pantry.outfit_saved_title'),
        t('style_pantry.outfit_saved_msg'),
      );
    } finally {
      setSavingId(null);
    }
  };

  const showPrompts = messages.length === 1 && !sending;

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    if (item.role === 'user') {
      return (
        <View style={styles.userRow}>
          <View style={styles.userBubble}>
            <Text style={styles.userText}>{item.text}</Text>
          </View>
        </View>
      );
    }
    if (item.role === 'error') {
      return (
        <View style={styles.assistantRow}>
          <View style={styles.avatar}>
            <Sparkles size={14} color={styles.avatarIcon.color} />
          </View>
          <View style={styles.errorBubble}>
            <Text style={styles.errorText}>{item.text}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.assistantBlock}>
        <View style={styles.assistantRow}>
          <View style={styles.avatar}>
            <Sparkles size={14} color={styles.avatarIcon.color} />
          </View>
          <View style={styles.assistantBubble}>
            <Text style={styles.assistantText}>{item.text}</Text>
          </View>
        </View>
        {item.outfit ? (
          <View style={styles.outfitCard}>
            <OutfitShowcase
              outfit={item.outfit}
              layout="chat"
              busy={savingId === item.id}
              onView={() =>
                navigation.navigate('OutfitDetails', { outfit: item.outfit! })
              }
              onToggleSave={() => handleToggleSave(item.id, item.outfit!)}
              onItemPress={i =>
                navigation.navigate('ClothingDetails', { itemId: i.id })
              }
            />
          </View>
        ) : null}
        {item.items && item.items.length > 0 ? (
          <View style={styles.itemsGrid}>
            {item.items.map(i => (
              <Pressable
                key={i.id}
                style={styles.itemTile}
                onPress={() => navigation.navigate('ClothingDetails', { itemId: i.id })}
                accessibilityRole="button"
                accessibilityLabel={i.name}
              >
                <ItemThumb item={i} size={68} radius={14} />
                <Text style={styles.itemTileText} numberOfLines={1}>
                  {i.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  const Root = Platform.OS === 'ios' ? KeyboardAvoidingView : View;

  return (
    <Root style={styles.root} behavior="padding">
      <WardrobeHeader
        title={t('style_chat.title')}
        subtitle={t('style_chat.subtitle')}
        onBack={() => navigation.goBack()}
        right={{
          icon: Trash2,
          onPress: () => setMessages([introMessage()]),
          accessibilityLabel: t('style_chat.clear'),
          disabled: messages.length <= 1 || sending,
        }}
      />

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListFooterComponent={
          <View>
            {showPrompts ? (
              <View style={styles.promptWrap}>
                {PROMPT_KEYS.map(key => (
                  <Pressable
                    key={key}
                    style={styles.promptChip}
                    onPress={() => handleSend(t(`style_chat.${key}`))}
                    accessibilityRole="button"
                    accessibilityLabel={t(`style_chat.${key}`)}
                  >
                    <Text style={styles.promptText}>{t(`style_chat.${key}`)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {sending ? (
              <View style={styles.assistantRow}>
                <View style={styles.avatar}>
                  <Sparkles size={14} color={styles.avatarIcon.color} />
                </View>
                <View style={styles.typingBubble}>
                  <Text style={styles.typingText}>
                    {t('style_pantry.stylist_typing')}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        }
      />

      <View style={[styles.composer, { paddingBottom: composerBottomPad }]}>
        <TextInput
          style={styles.input}
          value={composerText}
          onChangeText={setComposerText}
          placeholder={t('style_pantry.chat_placeholder')}
          placeholderTextColor={styles.placeholder.color}
          multiline
          maxLength={600}
          editable={!sending}
          onSubmitEditing={() => handleSend()}
          blurOnSubmit
          returnKeyType="send"
        />
        <Pressable
          style={[
            styles.sendBtn,
            (sending || !composerText.trim()) && styles.sendBtnDisabled,
          ]}
          onPress={() => handleSend()}
          disabled={sending || !composerText.trim()}
          accessibilityRole="button"
          accessibilityLabel={t('style_chat.title')}
        >
          <Send size={18} color={styles.sendIcon.color} />
        </Pressable>
      </View>
    </Root>
  );
}

const makeStyles = ({ colors, fonts, radius, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    list: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.lg,
    },
    assistantBlock: { marginBottom: spacing.md },
    assistantRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      marginBottom: spacing.md,
      paddingRight: spacing.xl,
    },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarIcon: { color: colors.textOnPrimary },
    assistantBubble: {
      flexShrink: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.xl,
      borderBottomLeftRadius: radius.xs,
      paddingVertical: spacing.sm + 4,
      paddingHorizontal: spacing.md,
    },
    assistantText: {
      fontFamily: fonts.sans,
      fontSize: 14,
      lineHeight: 20,
      color: colors.textPrimary,
    },
    outfitCard: { marginLeft: 36, marginTop: -spacing.xs },
    itemsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginLeft: 36,
      marginTop: spacing.xs,
    },
    itemTile: { width: 72, alignItems: 'center' },
    itemTileText: {
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 4,
      textAlign: 'center',
    },
    userRow: { alignItems: 'flex-end', marginBottom: spacing.md, paddingLeft: spacing.xl },
    userBubble: {
      backgroundColor: colors.primary,
      borderRadius: radius.xl,
      borderBottomRightRadius: radius.xs,
      paddingVertical: spacing.sm + 4,
      paddingHorizontal: spacing.md,
    },
    userText: {
      fontFamily: fonts.sans,
      fontSize: 14,
      lineHeight: 20,
      color: colors.textOnPrimary,
    },
    errorBubble: {
      flexShrink: 1,
      backgroundColor: colors.dangerSoft,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
      borderRadius: radius.xl,
      borderBottomLeftRadius: radius.xs,
      paddingVertical: spacing.sm + 4,
      paddingHorizontal: spacing.md,
    },
    errorText: {
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 18,
      color: colors.danger,
    },
    typingBubble: {
      backgroundColor: colors.blush,
      borderRadius: radius.xl,
      borderBottomLeftRadius: radius.xs,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
    },
    typingText: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    promptWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginLeft: 36,
      marginBottom: spacing.md,
    },
    promptChip: {
      paddingVertical: 9,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    promptText: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.textPrimary,
    },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    input: {
      flex: 1,
      minHeight: 46,
      maxHeight: 120,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.textPrimary,
    },
    placeholder: { color: colors.textMuted },
    sendBtn: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.4 },
    sendIcon: { color: colors.textOnPrimary },
  });
