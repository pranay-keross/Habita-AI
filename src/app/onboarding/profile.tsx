import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, PermissionsAndroid, Pressable, Alert, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import Geolocation from '@react-native-community/geolocation';
import type { GeolocationResponse } from '@react-native-community/geolocation';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../_layout';
import type { ThemeTokens } from '../../theme';
import useThemedStyles from '../../hooks/useThemedStyles';
import useAuth from '../../hooks/useAuth';
import { apiFetch, postMultipart, ApiError } from '../../features/auth/api';
import { SUPPORTED_LANGS, getCurrentLanguage, setLanguage, subscribeToLanguageChanges, t } from '../../i18n';
import Button from '../../components/Button';
import BottomSheet from '../../components/BottomSheet';
import { clearAll, getItem, setItem } from '../../utils/storage';
import { ArrowLeft, User, Camera, Image as ImageIcon, Trash2, LogOut, Home } from 'lucide-react-native';

type Props = StackScreenProps<RootStackParamList, 'Profile'>;

const PROFILE_STORAGE_KEY = 'habita.user_profile';

// OpenStreetMap's Nominatim — free, no API key, no new dependency (plain `fetch`).
// Chosen over Google's Geocoding API specifically to avoid needing billing/API-key setup
// for what is still a prototype. Its usage policy asks for a descriptive User-Agent and
// caps free usage at ~1 request/second, both fine for a single lookup on profile setup;
// revisit if this app ever needs geocoding at real volume — that's a paid-API or
// self-hosted-Nominatim decision, not one to make silently here.
async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&addressdetails=1&lat=${latitude}&lon=${longitude}`,
      { headers: { 'User-Agent': 'HabitaAI-Prototype/1.0' } },
    );
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    const address = data?.address ?? {};
    const place = address.city || address.town || address.village || address.suburb || address.county;
    const state = address.state;
    if (place && state) {
      return `${place}, ${state}`;
    }
    return place || data?.display_name || null;
  } catch {
    return null;
  }
}

// GET /api/profile/details response shape — `role` has no backend field (confirmed by
// this shape), so it stays a local-only concept; `avatarUrl` is a freshly-signed,
// short-lived S3 URL, not the raw stored object key.
interface ProfileDetailsResponse {
  phone: string;
  name: string;
  email: string;
  preferredLanguage: string;
  active: boolean;
  isVerified: boolean;
  avatarUrl: string | null;
  city: string;
}

export default function ProfileScreen({ route, navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { getAccessToken, getPhone, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const isEditing = route.params?.isEditing ?? false;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'household_ceo' | 'individual'>('household_ceo');
  const [location, setLocation] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedLang, setSelectedLang] = useState('en');
  const [localeVersion, setLocaleVersion] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const currentCode = getCurrentLanguage();
    setSelectedLang(currentCode);

    const unsubscribe = subscribeToLanguageChanges(() => {
      setSelectedLang(getCurrentLanguage());
      setLocaleVersion((v) => v + 1);
    });

    if (isEditing) {
      // Set once the live fetch below succeeds. Guards the local-cache callback further
      // down: an AsyncStorage read and a network call have no defined ordering, so
      // without this, a local-cache read that happens to resolve *after* a successful
      // live fetch could silently overwrite fresher backend data with stale cached
      // data — confirmed live (2026-08-11, docs/DECISIONS.md D-028) as the cause of a
      // save mismatch between the name and email fields.
      let liveDetailsLoaded = false;

      getItem(PROFILE_STORAGE_KEY, {
        name: '',
        phone: '',
        email: '',
        role: 'household_ceo',
        location: '',
        photoUri: null,
      }).then((data) => {
        if (data) {
          // name/email/location can also come from the live fetch below — skip them
          // here if that already won the race. role/photoUri have no backend
          // equivalent (see the comment on the fetch below) and always apply. `phone`
          // is deliberately not read from here any more — see getPhone() below.
          if (!liveDetailsLoaded) {
            if (data.name) setName(data.name);
            if (data.email) setEmail(data.email);
            if (data.location) setLocation(data.location);
          }
          if (data.role === 'household_ceo' || data.role === 'individual') {
            setRole(data.role);
          }
          if (data.photoUri) setPhotoUri(data.photoUri);
        }
      });

      // The phone number itself is never in `habita.user_profile` reliably — that key
      // only ever gets a `phone` value once the user has saved at least once on this
      // device, which is exactly why the field was showing empty right after a fresh
      // sign-in (docs/DECISIONS.md D-029). The session's own phone — exactly what was
      // verified via OTP — is always available the instant this screen can render at
      // all, no network call needed.
      getPhone().then((p) => {
        if (p) setPhone(p);
      });

      // Local storage above is the immediate/offline fallback so the screen isn't blank
      // while this resolves; the backend is the authoritative record once reachable.
      // `role`/`avatar` have no backend field (confirmed by ProfileDetailsResponse's
      // shape) and stay local-only.
      (async () => {
        try {
          const token = await getAccessToken();
          const details = await apiFetch<ProfileDetailsResponse>('/profile/details', { method: 'GET', token });
          liveDetailsLoaded = true;
          if (details.name) setName(details.name);
          if (details.email) setEmail(details.email);
          if (details.city) setLocation(details.city);
          // The account's saved language, not whatever this device currently happens to
          // have active — confirmed live (D-029) as missing: `PUT /profile/details`
          // saves `preferredLanguage`, but nothing ever read it back, so the picker (and
          // the whole app) kept showing the device's last language instead of the
          // signed-in account's own choice. `setLanguage` persists and notifies every
          // subscribed screen, including this one's own listener above.
          if (details.preferredLanguage && SUPPORTED_LANGS.some((l) => l.code === details.preferredLanguage)) {
            await setLanguage(details.preferredLanguage);
          }
          if (details.avatarUrl) {
            // Functional update: don't clobber a local photo the user just picked in
            // the (unlikely but possible) case this resolves after that.
            setPhotoUri((current) => current ?? details.avatarUrl);
          }
        } catch {
          // Offline, or profile not created yet (500 — see the collection's known-gap
          // note) — local storage above already covers the screen.
        }
      })();
    } else {
      getItem<string>('habita.user_phone', '').then((savedPhone) => {
        if (savedPhone) {
          setPhone(savedPhone);
        }
      });
    }

    return () => {
      unsubscribe();
    };
  }, [isEditing, getAccessToken, getPhone]);

  // First-time setup only — prefill the location field from the device's current
  // position, but leave it fully editable. Best-effort: a denied permission, an
  // unlinked native module (pre-rebuild), or a location-services timeout all just leave
  // the field empty for manual entry instead of surfacing an error.
  useEffect(() => {
    if (isEditing) {
      return;
    }

    const prefillLocation = async () => {
      try {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            return;
          }
        }
        const applyPosition = async (position: GeolocationResponse) => {
          const { latitude, longitude } = position.coords;
          const place = await reverseGeocode(latitude, longitude);
          // Falls back to raw coordinates only if reverse geocoding itself failed
          // (network error, Nominatim down, no address match) — still better than
          // leaving the field empty when we do have a real position.
          setLocation(place ?? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        };

        Geolocation.getCurrentPosition(
          applyPosition,
          () => {
            // `enableHighAccuracy: true` (GPS) failed or timed out — retry once with
            // the network/WiFi-based provider rather than leaving the field empty.
            // Less accurate, but real coordinates beat none; the field stays editable
            // regardless. `enableHighAccuracy: false` alone (the previous, only
            // attempt) was the actual bug here — Android's network location provider
            // can return a wildly wrong fix (seen live: a user in Kolkata prefilled to
            // California) when it has no recent, nearby WiFi/cell fingerprint to go on,
            // so GPS is now tried first.
            Geolocation.getCurrentPosition(applyPosition, () => {}, {
              enableHighAccuracy: false,
              timeout: 10000,
            });
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        );
      } catch {}
    };

    prefillLocation();
  }, [isEditing]);

  const handleSaveProfile = async () => {
    await setItem(PROFILE_STORAGE_KEY, { name, phone, email, role, location, photoUri });
    await setLanguage(selectedLang);

    setSaving(true);
    try {
      const token = await getAccessToken();
      const hasNewLocalPhoto = !!photoUri && !photoUri.startsWith('http');

      if (isEditing) {
        await apiFetch('/profile/details', {
          method: 'PUT',
          body: { email, preferredLanguage: selectedLang, city: location },
          token,
        });

        if (hasNewLocalPhoto) {
          const photoForm = new FormData();
          photoForm.append('profilePhoto', { uri: photoUri, name: 'profile.jpg', type: 'image/jpeg' } as unknown as Blob);
          await postMultipart('/profile/profilePhoto', photoForm, token, 'PUT');
        }
      } else {
        const profileRequest = { name, email, city: location, preferredLanguage: selectedLang || 'en' };
        const form = new FormData();
        form.append('profileRequest', { string: JSON.stringify(profileRequest), type: 'application/json' } as unknown as Blob);
        if (hasNewLocalPhoto) {
          form.append('profilePhoto', { uri: photoUri, name: 'profile.jpg', type: 'image/jpeg' } as unknown as Blob);
        }
        await postMultipart('/profile/create', form, token);
      }
    } catch (err) {
      setSaving(false);
      console.warn('Profile save failed:', err);
      Alert.alert(t('onboarding.error_title'), t('profile.save_error'));
      return;
    }
    setSaving(false);

    if (isEditing) {
      Alert.alert(t('profile.header_title'), t('profile.save_success'));
      navigation.navigate('Dashboard', { profileUpdated: true });
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Dashboard' }],
      });
    }
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
        t('profile.camera_notice_title'),
        t('profile.camera_notice_message')
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
        t('profile.gallery_notice_title'),
        t('profile.gallery_notice_message')
      );
    }
  };

  const handleSignOut = () => {
    Alert.alert(t('profile.sign_out_confirm_title'), t('profile.sign_out_confirm_msg'), [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('profile.sign_out'),
        style: 'destructive',
        onPress: async () => {
          await logout();
          navigation.reset({
            index: 0,
            routes: [{ name: 'Phone' }],
          });
        },
      },
    ]);
  };

  const deletionErrorMessage = (err: unknown): string => {
    if (err instanceof ApiError) {
      if (err.status === 0) {
        return t('onboarding.network_error');
      }
      const body = err.body;
      const message = body && typeof body === 'object' && 'message' in body ? (body as { message?: unknown }).message : null;
      if (message === 'Deletion Request already being sent' || (typeof message === 'string' && /delet(ion|e)/i.test(message))) {
        return t('profile.delete_account_already_pending');
      }
    }
    return t('profile.delete_account_error');
  };

  const handleDeleteAccount = () => {
    Alert.alert(t('profile.delete_account_confirm_title'), t('profile.delete_account_confirm_msg'), [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('profile.delete_account'),
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await getAccessToken();
            await apiFetch('/profile/delete', { method: 'DELETE', token });
            await clearAll();
            await logout();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Phone' }],
            });
          } catch (err) {
            Alert.alert(t('onboarding.error_title'), deletionErrorMessage(err));
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView key={localeVersion} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}> 
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={18} color="#FFFFFF" strokeWidth={1.5} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEditing ? t('profile.header_title') : t('onboarding.profile_title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.root}>
        <View style={styles.avatarSection}>
          <View style={styles.avatarOuterContainer}>
            <Pressable style={styles.avatarWrap} onPress={() => setShowPhotoModal(true)}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={38} color="#FFFFFF" strokeWidth={1.5} />
                </View>
              )}
            </Pressable>
            <Pressable style={styles.editBadge} onPress={() => setShowPhotoModal(true)}>
              <Camera size={14} color="#000000" strokeWidth={1.5} />
            </Pressable>
          </View>

          <Text style={styles.avatarTitle}>{t('profile.photo_title')}</Text>
          <Pressable onPress={() => setShowPhotoModal(true)}>
            <Text style={styles.changePhotoLabel}>{t('profile.photo_change')}</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>{t('profile.name_label')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('profile.name_placeholder')}
          placeholderTextColor={styles.placeholder.color}
          autoFocus={!isEditing}
        />

        <Text style={styles.label}>{t('profile.phone_label')}</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder={t('profile.phone_placeholder')}
          placeholderTextColor={styles.placeholder.color}
        />

        <Text style={styles.label}>{t('profile.email_label')}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder={t('profile.email_placeholder')}
          placeholderTextColor={styles.placeholder.color}
        />

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

        {isEditing && (
          <>
            <Text style={styles.label}>{t('profile.role_label')}</Text>
            <View style={styles.roleGrid}>
              <Pressable
                style={[styles.roleCard, role === 'household_ceo' && styles.roleCardActive]}
                onPress={() => setRole('household_ceo')}>
                <Text style={[styles.roleTitle, role === 'household_ceo' && styles.roleTitleActive]}>{t('onboarding.role_ceo')}</Text>
                <Text style={[styles.roleSub, role === 'household_ceo' && styles.roleSubActive]}>{t('onboarding.role_ceo_sub')}</Text>
              </Pressable>
              <Pressable
                style={[styles.roleCard, role === 'individual' && styles.roleCardActive]}
                onPress={() => setRole('individual')}>
                <Text style={[styles.roleTitle, role === 'individual' && styles.roleTitleActive]}>{t('onboarding.role_individual')}</Text>
                <Text style={[styles.roleSub, role === 'individual' && styles.roleSubActive]}>{t('onboarding.role_individual_sub')}</Text>
              </Pressable>
            </View>
          </>
        )}

        <Text style={styles.label}>{t('profile.location_label')}</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder={t('onboarding.profile_location_placeholder')}
          placeholderTextColor={styles.placeholder.color}
        />

        <Button
          title={isEditing ? t('profile.save_changes') : `${t('onboarding.finish')} →`}
          onPress={handleSaveProfile}
          loading={saving}
          style={styles.cta}
        />

        {isEditing && (
          <View style={styles.dangerZone}>
            <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
              <LogOut size={16} color="#FFFFFF" strokeWidth={1.5} style={{ marginRight: 8 }} />
              <Text style={styles.signOutText}>{t('profile.sign_out')}</Text>
            </Pressable>

            <Pressable style={styles.deleteBtn} onPress={handleDeleteAccount}>
              <Trash2 size={16} color="#ef4444" strokeWidth={1.5} style={{ marginRight: 8 }} />
              <Text style={styles.deleteText}>{t('profile.delete_account')}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <BottomSheet
        visible={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        title={t('profile.photo_options_title')}
        dark={true}>
        <Pressable style={styles.photoOptionBtn} onPress={handleCameraCapture}>
          <View style={styles.photoOptionIconWrap}>
            <Camera size={18} color="#FFFFFF" strokeWidth={1.5} />
          </View>
          <View style={styles.photoOptionContent}>
            <Text style={styles.photoOptionTitle}>{t('profile.take_photo')}</Text>
            <Text style={styles.photoOptionSub}>{t('profile.take_photo_sub')}</Text>
          </View>
        </Pressable>

        <Pressable style={styles.photoOptionBtn} onPress={handleGalleryPick}>
          <View style={styles.photoOptionIconWrap}>
            <ImageIcon size={18} color="#FFFFFF" strokeWidth={1.5} />
          </View>
          <View style={styles.photoOptionContent}>
            <Text style={styles.photoOptionTitle}>{t('profile.choose_gallery')}</Text>
            <Text style={styles.photoOptionSub}>{t('profile.choose_gallery_sub')}</Text>
          </View>
        </Pressable>

        {photoUri && (
          <Pressable
            style={[styles.photoOptionBtn, styles.photoOptionBtnDanger]}
            onPress={() => {
              setPhotoUri(null);
              setShowPhotoModal(false);
            }}>
            <View style={[styles.photoOptionIconWrap, styles.photoOptionIconWrapDanger]}>
              <Trash2 size={18} color="#FF453A" strokeWidth={1.5} />
            </View>
            <View style={styles.photoOptionContent}>
              <Text style={[styles.photoOptionTitle, { color: '#FF453A' }]}>{t('profile.remove_photo')}</Text>
              <Text style={styles.photoOptionSub}>{t('profile.remove_photo_sub')}</Text>
            </View>
          </Pressable>
        )}
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

const makeStyles = ({ fonts, radius, shadow, spacing }: ThemeTokens) => StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: '#0D0D0D',
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  headerSpacer: {
    width: 36,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A22',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A2A32',
  },
  backIcon: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  headerTitle: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#1A1A22',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#33333E',
  },
  avatarPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#1A1A22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  editBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0D0D0D',
    zIndex: 10,
  },
  editBadgeText: {
    fontSize: 11,
  },
  avatarTitle: {
    fontFamily: fonts.sans,
    fontSize: 18,
    fontWeight: '500',
    color: '#FFFFFF',
    marginTop: 10,
  },
  changePhotoLabel: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '400',
    color: '#A0A0B0',
    marginTop: 2,
  },
  label: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 1.5,
    color: '#777785',
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#16161C',
    borderWidth: 1,
    borderColor: '#282832',
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: '#FFFFFF',
  },
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161C',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#282832',
  },
  langChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  langFlag: {
    fontSize: 15,
    marginRight: 6,
  },
  langText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '400',
    color: '#CCCCCC',
  },
  langTextActive: {
    color: '#0D0D0D',
    fontWeight: '600',
  },
  roleGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  roleCard: {
    flex: 1,
    backgroundColor: '#16161C',
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#282832',
  },
  roleCardActive: {
    borderColor: '#FFFFFF',
    backgroundColor: '#202028',
  },
  roleTitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  roleSub: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: '300',
    color: '#888894',
    marginTop: 3,
    lineHeight: 14,
  },
  roleTitleActive: {
    color: '#FFFFFF',
  },
  roleSubActive: {
    color: '#CCCCCC',
  },
  placeholder: {
    color: '#666672',
  },
  cta: {
    marginTop: 28,
  },
  dangerZone: {
    marginTop: 32,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#222228',
    paddingTop: 24,
  },
  signOutBtn: {
    backgroundColor: '#16161C',
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#282832',
  },
  signOutText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  deleteBtn: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  deleteText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '500',
    color: '#FF3B30',
  },
  photoOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181820',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#262632',
  },
  photoOptionBtnDanger: {
    borderColor: 'rgba(255, 69, 58, 0.25)',
  },
  photoOptionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#242430',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  photoOptionIconWrapDanger: {
    backgroundColor: 'rgba(255, 69, 58, 0.12)',
  },
  photoOptionContent: {
    flex: 1,
  },
  photoOptionTitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  photoOptionSub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '400',
    color: '#9999A6',
    marginTop: 2,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: '#16161C',
    padding: 12,
    borderRadius: radius.md,
    marginTop: 12,
    justifyContent: 'center',
  },
  avatarOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#22222A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOptionSelected: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarOptionText: {
    fontSize: 22,
  },
});
