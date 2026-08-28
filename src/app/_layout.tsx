import React from 'react';
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
import PrescriptionsScreen from '../features/medicine/PrescriptionsScreen';
import WellnessScreen from '../features/wellness/WellnessScreen';
import CycleScreen from '../features/cycle/CycleScreen';
import HouseholdOperationsScreen from '../features/household/HouseholdOperationsScreen';
import HouseholdAreaScreen from '../features/household/HouseholdAreaScreen';
import StaffScreen from '../features/staff/StaffScreen';
import ResourcesScreen from '../features/resources/ResourcesScreen';
import EventBudgetsScreen from '../features/events/EventBudgetsScreen';
import VehiclesScreen from '../features/assets/VehiclesScreen';
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
import {
  WardrobeDashboardScreen,
  AddEditClothingScreen,
  ClothingDetailsScreen,
  StyleMirrorScreen,
  OutfitDetailsScreen,
  type OutfitRecommendation,
} from '../features/style_pantry';
import VoiceScreen from '../features/money/voice_assistant/VoiceScreen';
import SmartLifeScreen from '../features/smart_life/SmartLifeScreen';
import VoiceSettingsScreen from '../features/money/voice_assistant/VoiceSettingsScreen';
import SplashScreen from '../components/SplashScreen';
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
  Medicine: { openAddModal?: boolean } | undefined;
  Prescriptions: { familyProfileId: string };
  Wellness: undefined;
  Cycle: undefined;
  HouseholdOperations: undefined;
  HouseholdArea: { area: 'caregiver' | 'resources' | 'events' | 'assets' };
  Staff: undefined;
  Resources: undefined;
  EventBudgets: undefined;
  Vehicles: undefined;
  ExpenseGroups: undefined;
  GroupDetails: { groupId: string };
  AddSplitExpense: { groupId: string; expenseId?: string };
  ExpenseDetailsSettleUp: {
    groupId: string;
    expenseId?: string;
    settlePayerId?: string;
    settlePayeeId?: string;
    settleAmount?: number;
  };
  DocHub: undefined;
  DocDetails: { docId: string };
  AddDoc: undefined;
  DocTemplateForm: { templateType: DocTemplateType };
  ExpirationAlerts: undefined;
  Pantry: undefined;
  Wardrobe: undefined;
  StylePantryDashboard: undefined;
  AddEditClothing: { itemId?: string } | undefined;
  ClothingDetails: { itemId: string };
  StyleMirror: undefined;
  OutfitDetails: { outfit: OutfitRecommendation };
  Voice: undefined;
  VoiceSettings: undefined;
  SmartLife: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppLayout = () => {
  const { theme } = useTheme();
  const { pending, signedIn } = useAuth();
  const [splashFinished, setSplashFinished] = React.useState(false);

  // Show luxury animated splash screen on app start / restore from killed state
  if (pending || !splashFinished) {
    return (
      <SafeAreaProvider>
        <SplashScreen
          onFinish={() => setSplashFinished(true)}
          minDuration={1800}
        />
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
          }}
        >
          <Stack.Screen name="Language" component={LanguageScreen} />
          <Stack.Screen name="Phone" component={PhoneScreen} />
          <Stack.Screen name="Otp" component={OtpScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{ animation: 'none' }}
          />
          <Stack.Screen
            name="Family"
            component={FamilyScreen}
            options={{ animation: 'none' }}
          />
          <Stack.Screen
            name="Medicine"
            component={MedicineScreen}
            options={{ animation: 'none' }}
          />
          <Stack.Screen name="Prescriptions" component={PrescriptionsScreen} />
          <Stack.Screen name="Wellness" component={WellnessScreen} />
          <Stack.Screen name="Cycle" component={CycleScreen} />
          <Stack.Screen
            name="HouseholdOperations"
            component={HouseholdOperationsScreen}
          />
          <Stack.Screen name="HouseholdArea" component={HouseholdAreaScreen} />
          <Stack.Screen name="Staff" component={StaffScreen} />
          <Stack.Screen name="Resources" component={ResourcesScreen} />
          <Stack.Screen name="EventBudgets" component={EventBudgetsScreen} />
          <Stack.Screen name="Vehicles" component={VehiclesScreen} />
          <Stack.Screen name="ExpenseGroups" component={ExpenseGroupsScreen} />
          <Stack.Screen name="GroupDetails" component={GroupDetailsScreen} />
          <Stack.Screen name="AddSplitExpense" component={AddSplitExpenseScreen} />
          <Stack.Screen name="ExpenseDetailsSettleUp" component={ExpenseDetailsSettleUpScreen} />
          <Stack.Screen
            name="DocHub"
            component={DocHubScreen}
            options={{ animation: 'none' }}
          />
          <Stack.Screen name="DocDetails" component={DocDetailsScreen} />
          <Stack.Screen name="AddDoc" component={AddDocScreen} />
          <Stack.Screen name="DocTemplateForm" component={DocTemplateFormScreen} />
          <Stack.Screen name="ExpirationAlerts" component={ExpirationAlertsScreen} />
          <Stack.Screen name="Pantry" component={PantryScreen} />
          <Stack.Screen name="Wardrobe" component={WardrobeDashboardScreen} />
          <Stack.Screen name="StylePantryDashboard" component={WardrobeDashboardScreen} />
          <Stack.Screen name="AddEditClothing" component={AddEditClothingScreen} />
          <Stack.Screen name="ClothingDetails" component={ClothingDetailsScreen} />
          <Stack.Screen name="StyleMirror" component={StyleMirrorScreen} />
          <Stack.Screen name="OutfitDetails" component={OutfitDetailsScreen} />
          <Stack.Screen
            name="Voice"
            component={VoiceScreen}
            options={{ animation: 'fade' }}
          />
          <Stack.Screen name="VoiceSettings" component={VoiceSettingsScreen} />
          <Stack.Screen name="SmartLife" component={SmartLifeScreen} />
        </Stack.Navigator >
      </NavigationContainer >
    </SafeAreaProvider>
  );
};

export default AppLayout;
