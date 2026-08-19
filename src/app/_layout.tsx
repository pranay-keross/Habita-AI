import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LanguageScreen from './onboarding/language';
import PhoneScreen from './onboarding/phone';
import OtpScreen from './onboarding/otp';
import ProfileScreen from './onboarding/profile';
import DashboardScreen from './dashboard';
import FamilyScreen from '../features/family/FamilyScreen';
import MedicineScreen from '../features/medicine/MedicineScreen';
import {
  ExpenseGroupsScreen,
  GroupDetailsScreen,
  AddSplitExpenseScreen,
  ExpenseDetailsSettleUpScreen,
} from '../features/money';
import {
  DocHubScreen,
  DocDetailsScreen,
  AddDocScreen,
  DocTemplateFormScreen,
  ExpirationAlertsScreen,
  type DocTemplateType,
} from '../features/money/document_hub';
import PantryScreen from '../features/money/smart_pantry/PantryScreen';
import WardrobeScreen from '../features/money/style_wardrobe/WardrobeScreen';
import VoiceScreen from '../features/money/voice_assistant/VoiceScreen';
import VoiceSettingsScreen from '../features/money/voice_assistant/VoiceSettingsScreen';
import type { ThemeTokens } from '../theme';
import useThemedStyles from '../hooks/useThemedStyles';
import useTheme from '../hooks/useTheme';
import useAuth from '../hooks/useAuth';

export type RootStackParamList = {
  Language: undefined;
  Phone: undefined;
  Otp: { isNewUser: boolean } | undefined;
  Profile: { isEditing?: boolean } | undefined;
  // `profileUpdated`: set by profile.tsx after a successful edit-mode save, so Dashboard
  // knows to re-fetch GET /profile/details once (fresh avatar/name/language) instead of
  // on every focus — see docs/DECISIONS.md.
  Dashboard: { profileUpdated?: boolean } | undefined;
  Family: undefined;
  Medicine: undefined;
  ExpenseGroups: undefined;
  GroupDetails: { groupId: string };
  AddSplitExpense: { groupId: string; expenseId?: string };
  ExpenseDetailsSettleUp: {
    groupId: string;
    expenseId?: string;
    settlePayerId?: string;
    settlePayeeId?: string;
  };
  DocHub: undefined;
  DocDetails: { docId: string };
  AddDoc: undefined;
  DocTemplateForm: { templateType: DocTemplateType };
  ExpirationAlerts: undefined;
  Pantry: undefined;
  Staff: undefined;
  Wardrobe: undefined;
  Voice: undefined;
  VoiceSettings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppLayout = () => {
  const { theme } = useTheme();
  const { pending, signedIn } = useAuth();
  const styles = useThemedStyles(makeStyles);

  // `initialRouteName` is only read on the Navigator's first mount, so the Navigator
  // itself must not render until the session restore check resolves — otherwise it
  // locks in `Language` before `signedIn` is known.
  if (pending) {
    return (
      <SafeAreaProvider>
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={signedIn ? 'Dashboard' : 'Language'}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
            animation: 'slide_from_right',
          }}>
          <Stack.Screen name="Language" component={LanguageScreen} />
          <Stack.Screen name="Phone" component={PhoneScreen} />
          <Stack.Screen name="Otp" component={OtpScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="Family" component={FamilyScreen} />
          <Stack.Screen name="Medicine" component={MedicineScreen} />
          <Stack.Screen name="ExpenseGroups" component={ExpenseGroupsScreen} />
          <Stack.Screen name="GroupDetails" component={GroupDetailsScreen} />
          <Stack.Screen name="AddSplitExpense" component={AddSplitExpenseScreen} />
          <Stack.Screen name="ExpenseDetailsSettleUp" component={ExpenseDetailsSettleUpScreen} />
          <Stack.Screen name="DocHub" component={DocHubScreen} />
          <Stack.Screen name="DocDetails" component={DocDetailsScreen} />
          <Stack.Screen name="AddDoc" component={AddDocScreen} />
          <Stack.Screen name="DocTemplateForm" component={DocTemplateFormScreen} />
          <Stack.Screen name="ExpirationAlerts" component={ExpirationAlertsScreen} />
          <Stack.Screen name="Pantry" component={PantryScreen} />
          <Stack.Screen name="Wardrobe" component={WardrobeScreen} />
          <Stack.Screen name="Voice" component={VoiceScreen} />
          <Stack.Screen name="VoiceSettings" component={VoiceSettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

const makeStyles = ({ colors }: ThemeTokens) => StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AppLayout;
