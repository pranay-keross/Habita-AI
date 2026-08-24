import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import type { ThemeTokens } from '../theme';
import useThemedStyles from '../hooks/useThemedStyles';
import useResponsive from '../hooks/useResponsive';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollable?: boolean;
  showsVerticalScrollIndicator?: boolean;
  testID?: string;
}

export default function ResponsiveContainer({
  children,
  style,
  contentContainerStyle,
  scrollable = false,
  showsVerticalScrollIndicator = false,
  testID,
}: ResponsiveContainerProps) {
  const styles = useThemedStyles(makeStyles);
  const { contentMaxWidth, isExpanded } = useResponsive();

  const maxWidthStyle: ViewStyle = isExpanded
    ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }
    : { width: '100%' };

  if (scrollable) {
    return (
      <View testID={testID} style={[styles.root, style]}>
        <ScrollView
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          contentContainerStyle={[styles.scrollContent, maxWidthStyle, contentContainerStyle]}>
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View testID={testID} style={[styles.root, style]}>
      <View style={[styles.content, maxWidthStyle, contentContainerStyle]}>
        {children}
      </View>
    </View>
  );
}

const makeStyles = ({ colors }: ThemeTokens) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
    },
    content: {
      flex: 1,
    },
  });
