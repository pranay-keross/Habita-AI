import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Pressable, Alert, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../_layout';
import { colors, fonts, radius, shadow, spacing } from '../../theme';
import { SUPPORTED_LANGS, getCurrentLanguage, setLanguage, subscribeToLanguageChanges, t } from '../../i18n';
import Button from '../../components/Button';
import BottomSheet from '../../components/BottomSheet';
import { clearAll, getItem, setItem } from '../../utils/storage';

type Props = StackScreenProps<RootStackParamList, 'Profile'>;

const AVATAR_OPTIONS = ['👩‍💼', '👩‍⚕️', '👩‍🍳', '👩‍💻', '🧘‍♀️', '🎨', '👩‍🏫', '🌸'];

const PROFILE_STORAGE_KEY = 'saheli.user_profile';

export default function ProfileScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const isEditing = route.params?.isEditing ?? false;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'household_ceo' | 'individual'>('household_ceo');
  const [location, setLocation] = useState('');
  const [avatar, setAvatar] = useState('👩‍💼');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showAvatarGrid, setShowAvatarGrid] = useState(false);
  const [selectedLang, setSelectedLang] = useState('en');
  const [localeVersion, setLocaleVersion] = useState(0);

  useEffect(() => {
    const currentCode = getCurrentLanguage();
    setSelectedLang(currentCode);

    const unsubscribe = subscribeToLanguageChanges(() => {
      setSelectedLang(getCurrentLanguage());
      setLocaleVersion((v) => v + 1);
    });

    if (isEditing) {
      getItem(PROFILE_STORAGE_KEY, {
        name: '',
        phone: '',
        role: 'household_ceo',
        location: '',
        avatar: '👩‍💼',
        photoUri: null,
      }).then((data) => {
        if (data) {
          if (data.name) setName(data.name);
          if (data.phone) setPhone(data.phone);
          if (data.role === 'household_ceo' || data.role === 'individual') {
            setRole(data.role);
          }
          if (data.location) setLocation(data.location);
          if (data.avatar) setAvatar(data.avatar);
          if (data.photoUri) setPhotoUri(data.photoUri);
        }
      });
    } else {
      getItem<string>('saheli.user_phone', '').then((savedPhone) => {
        if (savedPhone) {
          setPhone(savedPhone);
        }
      });
    }

    return () => {
      unsubscribe();
    };
  }, [isEditing]);

  const handleSaveProfile = async () => {
    await setItem(PROFILE_STORAGE_KEY, { name, phone, role, location, avatar, photoUri });
    await setLanguage(selectedLang);
    if (isEditing) {
      Alert.alert(t('profile.header_title'), t('profile.save_success'));
    }
    navigation.navigate('Dashboard');
  };

  const handleLangChange = async (langCode: string) => {
    setSelectedLang(langCode);
    setLocaleVersion((v) => v + 1);
    await setLanguage(langCode);
  };

  const handleCameraCapture = async () => {
    setShowPhotoModal(false);
    try {
      const response = await launchCamera({
        mediaType: 'photo',
        cameraType: 'front',
        quality: 0.8,
        saveToPhotos: true,
      });
      if (!response.didCancel && response.assets && response.assets[0]?.uri) {
        setPhotoUri(response.assets[0].uri);
      }
    } catch (error) {
      console.warn('Native camera launcher unavailable:', error);
      Alert.alert(
        'Camera Module Notice',
        'Please rebuild the native iOS app (npx react-native run-ios) after running pod install to link camera native modules. Fallback applied.',
        [
          {
            text: 'Use Camera Avatar',
            onPress: () => setAvatar('📸'),
          },
        ]
      );
    }
  };

  const handleGalleryPick = async () => {
    setShowPhotoModal(false);
    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        quality: 0.8,
      });
      if (!response.didCancel && response.assets && response.assets[0]?.uri) {
        setPhotoUri(response.assets[0].uri);
      }
    } catch (error) {
      console.warn('Native gallery launcher unavailable:', error);
      Alert.alert(
        'Gallery Module Notice',
        'Please rebuild the native iOS app (npx react-native run-ios) after running pod install to link gallery native modules. Fallback applied.',
        [
          {
            text: 'Use Gallery Avatar',
            onPress: () => setAvatar('🖼️'),
          },
        ]
      );
    }
  };

  const handleSignOut = () => {
    Alert.alert(t('profile.sign_out_confirm_title'), t('profile.sign_out_confirm_msg'), [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('profile.sign_out'),
        style: 'destructive',
        onPress: () => {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Language' }],
          });
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(t('profile.delete_account_confirm_title'), t('profile.delete_account_confirm_msg'), [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('profile.delete_account'),
        style: 'destructive',
        onPress: async () => {
          await clearAll();
          navigation.reset({
            index: 0,
            routes: [{ name: 'Language' }],
          });
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView key={localeVersion} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}> 
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{isEditing ? t('profile.header_title') : t('onboarding.profile_title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.root}>
        {/* Profile Photo / Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarOuterContainer}>
            <Pressable style={styles.avatarWrap} onPress={() => setShowPhotoModal(true)}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{avatar}</Text>
              )}
            </Pressable>
            <Pressable style={styles.editBadge} onPress={() => setShowPhotoModal(true)}>
              <Text style={styles.editBadgeText}>📷</Text>
            </Pressable>
          </View>

          <Text style={styles.avatarTitle}>{t('profile.photo_title')}</Text>
          <Pressable onPress={() => setShowPhotoModal(true)}>
            <Text style={styles.changePhotoLabel}>{t('profile.photo_change')}</Text>
          </Pressable>
        </View>

        {/* Display Name - Only shows hint placeholder */}
        <Text style={styles.label}>{t('profile.name_label')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Priya Sharma"
          placeholderTextColor={colors.textMuted}
          autoFocus={!isEditing}
        />

        {/* Mobile Number - Prefilled on onboarding from PhoneScreen step */}
        <Text style={styles.label}>{t('profile.phone_label')}</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="e.g. +91 98765 43210"
          placeholderTextColor={colors.textMuted}
        />

        {/* App Language Selection - ONLY shown inside app when editing profile */}
        {isEditing && (
          <>
            <Text style={styles.label}>{t('profile.language_label')}</Text>
            <View style={styles.langGrid}>
              {SUPPORTED_LANGS.map((item) => (
                <Pressable
                  key={item.code}
                  style={[styles.langChip, selectedLang === item.code && styles.langChipActive]}
                  onPress={() => handleLangChange(item.code)}>
                  <Text style={styles.langFlag}>{item.flag}</Text>
                  <Text style={[styles.langText, selectedLang === item.code && styles.langTextActive]}>{item.native}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* User Role */}
        <Text style={styles.label}>{t('profile.role_label')}</Text>
        <View style={styles.roleGrid}>
          <Pressable
            style={[styles.roleCard, role === 'household_ceo' && styles.roleCardActive]}
            onPress={() => setRole('household_ceo')}>
            <Text style={[styles.roleTitle, role === 'household_ceo' && { color: '#FFF' }]}>🏠 {t('onboarding.role_ceo')}</Text>
            <Text style={[styles.roleSub, role === 'household_ceo' && { color: colors.blush }]}>{t('onboarding.role_ceo_sub')}</Text>
          </Pressable>
          <Pressable
            style={[styles.roleCard, role === 'individual' && styles.roleCardActive]}
            onPress={() => setRole('individual')}>
            <Text style={[styles.roleTitle, role === 'individual' && { color: '#FFF' }]}>🧑 {t('onboarding.role_individual')}</Text>
            <Text style={[styles.roleSub, role === 'individual' && { color: colors.blush }]}>{t('onboarding.role_individual_sub')}</Text>
          </Pressable>
        </View>

        {/* Location */}
        <Text style={styles.label}>{t('profile.location_label')}</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder={t('onboarding.profile_location_placeholder')}
          placeholderTextColor={colors.textMuted}
        />

        <Button title={isEditing ? t('profile.save_changes') : `${t('onboarding.finish')} →`} onPress={handleSaveProfile} style={styles.cta} />

        {/* Sign Out & Delete Account Actions - ONLY shown when editing profile inside app */}
        {isEditing && (
          <View style={styles.dangerZone}>
            <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
              <Text style={styles.signOutText}>🚪 {t('profile.sign_out')}</Text>
            </Pressable>

            <Pressable style={styles.deleteBtn} onPress={handleDeleteAccount}>
              <Text style={styles.deleteText}>🗑️ {t('profile.delete_account')}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Photo Picker Bottom Sheet Modal */}
      <BottomSheet
        visible={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        title="Profile Photo Options">
        <Pressable style={styles.photoOptionBtn} onPress={handleCameraCapture}>
          <Text style={styles.photoOptionIcon}>📸</Text>
          <View style={styles.photoOptionContent}>
            <Text style={styles.photoOptionTitle}>Take Photo (Camera)</Text>
            <Text style={styles.photoOptionSub}>Open native camera to take picture</Text>
          </View>
        </Pressable>

        <Pressable style={styles.photoOptionBtn} onPress={handleGalleryPick}>
          <Text style={styles.photoOptionIcon}>🖼️</Text>
          <View style={styles.photoOptionContent}>
            <Text style={styles.photoOptionTitle}>Choose from Gallery</Text>
            <Text style={styles.photoOptionSub}>Select photo from device library</Text>
          </View>
        </Pressable>

        <Pressable
          style={styles.photoOptionBtn}
          onPress={() => {
            setShowAvatarGrid(!showAvatarGrid);
          }}>
          <Text style={styles.photoOptionIcon}>🎭</Text>
          <View style={styles.photoOptionContent}>
            <Text style={styles.photoOptionTitle}>Choose Preset Avatar</Text>
            <Text style={styles.photoOptionSub}>Select from curated avatar collection</Text>
          </View>
        </Pressable>

        {showAvatarGrid && (
          <View style={styles.avatarGrid}>
            {AVATAR_OPTIONS.map((item) => (
              <Pressable
                key={item}
                style={[styles.avatarOption, avatar === item && styles.avatarOptionSelected]}
                onPress={() => {
                  setAvatar(item);
                  setPhotoUri(null);
                  setShowPhotoModal(false);
                  setShowAvatarGrid(false);
                }}>
                <Text style={styles.avatarOptionText}>{item}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  // Balances the back button so the header title stays centred.
  headerSpacer: {
    width: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  backIcon: {
    fontSize: 20,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontFamily: fonts.serif,
    fontSize: 20,
    color: colors.textPrimary,
  },
  root: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 60,
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  avatarOuterContainer: {
    position: 'relative',
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.surfaceElevated,
    ...shadow.medium,
  },
  avatarText: {
    fontSize: 44,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  editBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.primary,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 2,
    borderColor: '#FFF',
    ...shadow.soft,
    zIndex: 10,
  },
  editBadgeText: {
    fontSize: 12,
  },
  avatarTitle: {
    fontFamily: fonts.serif,
    fontSize: 18,
    color: colors.textPrimary,
    marginTop: 10,
  },
  changePhotoLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.primary,
    marginTop: 2,
  },
  label: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.textMuted,
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    color: colors.textPrimary,
  },
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  langChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  langFlag: {
    fontSize: 16,
    marginRight: 6,
  },
  langText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textPrimary,
  },
  langTextActive: {
    color: '#FFF',
  },
  roleGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  roleCard: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  roleCardActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleTitle: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.textPrimary,
  },
  roleSub: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 15,
  },
  cta: {
    marginTop: 28,
  },
  dangerZone: {
    marginTop: 32,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 24,
  },
  signOutBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOutText: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  deleteBtn: {
    backgroundColor: '#FDE8E8',
    borderRadius: radius.xl,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F8B4B4',
  },
  deleteText: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: colors.danger,
  },
  photoOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: spacing.md,
    borderRadius: radius.xl,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  photoOptionIcon: {
    fontSize: 26,
    marginRight: 14,
  },
  photoOptionContent: {
    flex: 1,
  },
  photoOptionTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  photoOptionSub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: radius.xl,
    marginTop: 12,
    justifyContent: 'center',
    ...shadow.soft,
  },
  avatarOption: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOptionSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.blush,
  },
  avatarOptionText: {
    fontSize: 24,
  },
});
