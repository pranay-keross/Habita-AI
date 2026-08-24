import React from 'react';
import { View, Text, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Search, Mic } from 'lucide-react-native';
import type { ThemeTokens } from '../theme';
import useThemedStyles from '../hooks/useThemedStyles';

interface SearchPillProps {
  placeholder?: string;
  onPress?: () => void;
  onMicPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export default function SearchPill({
  placeholder = 'Ask Habita AI anything or search...',
  onPress,
  onMicPress,
  style,
  testID,
}: SearchPillProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <Pressable
      testID={testID}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.containerPressed,
        style,
      ]}
      onPress={onPress}>
      <View style={styles.leftGroup}>
        <Search size={16} color={styles.searchIconColor.color} strokeWidth={1.5} />
        <Text style={styles.placeholder} numberOfLines={1}>
          {placeholder}
        </Text>
      </View>
      <Pressable
        hitSlop={8}
        style={styles.micButton}
        onPress={(e) => {
          e.stopPropagation();
          onMicPress?.();
        }}>
        <Mic size={15} color={styles.micIconColor.color} strokeWidth={1.5} />
      </Pressable>
    </Pressable>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 3,
      ...shadow.soft,
    },
    containerPressed: {
      opacity: 0.85,
    },
    leftGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: spacing.sm,
      gap: 10,
    },
    searchIconColor: {
      color: '#666666',
    },
    placeholder: {
      fontFamily: fonts.sans,
      fontSize: 13,
      fontWeight: '400',
      color: colors.textMuted,
      flex: 1,
    },
    micButton: {
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    micIconColor: {
      color: '#000000',
    },
  });
