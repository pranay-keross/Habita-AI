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
import useTheme from '../hooks/useTheme';

export type RootStackParamList = {
  Language: undefined;
  Phone: undefined;
  Otp: undefined;
  Profile: { isEditing?: boolean } | undefined;
  Dashboard: undefined;
  Family: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppLayout = () => {
  const { theme } = useTheme();

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Language"
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
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};


export default AppLayout;
