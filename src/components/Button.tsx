import React from 'react';
import {Pressable, Text, ViewStyle, TextStyle, ActivityIndicator} from 'react-native';
import {theme} from '../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function Button({
  title,
  onPress,
  disabled,
  loading,
  style,
  textStyle,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({pressed}) => [{
        backgroundColor: disabled ? theme.colors.border : theme.colors.primary,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.radius.md,
        opacity: pressed ? 0.85 : 1,
        alignItems: 'center',
        justifyContent: 'center',
      }, style] as any}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.surface} />
      ) : (
        <Text
          style={[
            {
              color: theme.colors.surface,
              fontFamily: theme.fonts.sansMedium,
              fontSize: 16,
            },
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}
