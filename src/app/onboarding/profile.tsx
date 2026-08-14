import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, PermissionsAndroid, Pressable, Alert, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import Geolocation from '@react-native-community/geolocation';
import type { GeolocationResponse } from '@react-native-community/geolocation';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../_layout';
import { palettes, type ThemeTokens } from '../../theme';
import useThemedStyles from '../../hooks/useThemedStyles';
import useTheme from '../../hooks/useTheme';
import useAuth from '../../hooks/useAuth';
import { apiFetch, postMultipart, ApiError } from '../../features/auth/api';
import { SUPPORTED_LANGS, getCurrentLanguage, setLanguage, subscribeToLanguageChanges, t } from '../../i18n';
import Button from '../../components/Button';
import BottomSheet from '../../components/BottomSheet';
import { clearAll, getItem, setItem } from '../../utils/storage';

type Props = StackScreenProps<RootStackParamList, 'Profile'>;

const AVATAR_OPTIONS = ['👩‍💼', '👩‍⚕️', '👩‍🍳', '👩‍💻', '🧘‍♀️', '🎨', '👩‍🏫', '🌸'];

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
  const { paletteKey, setTheme } = useTheme();
  const { getAccessToken, getPhone, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const isEditing = route.params?.isEditing ?? false;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'household_ceo' | 'individual'>('household_ceo');
  const [location, setLocation] = useState('');
  const [avatar, setAvatar] = useState('👩‍💼');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showAvatarGrid, setShowAvatarGrid] = useState(false);
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
        avatar: '👩‍💼',
        photoUri: null,
      }).then((data) => {
        if (data) {
          // name/email/location can also come from the live fetch below — skip them
          // here if that already won the race. role/avatar/photoUri have no backend
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
          if (data.avatar) setAvatar(data.avatar);
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
    await setItem(PROFILE_STORAGE_KEY, { name, phone, email, role, location, avatar, photoUri });
    await setLanguage(selectedLang);

    setSaving(true);
    try {
      const token = await getAccessToken();
      // A local photoUri is either a device file (freshly picked, needs uploading) or
      // an https:// S3 URL we just loaded from GET /profile/details (already on the
      // backend — nothing to upload).
      const hasNewLocalPhoto = !!photoUri && !photoUri.startsWith('http');

      if (isEditing) {
        // PUT /profile/details only accepts email/preferredLanguage/city — no `name`
        // field in this DTO (unlike Create). Sending it anyway wouldn't necessarily
        // error, but it doesn't match the documented contract, so it's left out.
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
        // preferredLanguage must never be empty here — the backend's @RequestPart
        // validation is a documented no-op (collection's known-gap note), so an empty
        // value isn't rejected cleanly; it 500s or silently persists as "". selectedLang
        // is always a real language code (defaults to 'en'), so this is just a guard.
        const profileRequest = { name, email, city: location, preferredLanguage: selectedLang || 'en' };
        const form = new FormData();
        // A plain string part (`form.append('profileRequest', JSON.stringify(...))`) was
        // tried and is now CONFIRMED broken, via a real backend stack trace: RN sends it
        // as `Content-Type: application/octet-stream` (not empty, not text/plain — an
        // actual default the native layer applies), and Spring's `@RequestPart` 415s on
        // it since no converter reads octet-stream into a DTO. Passing an object instead
        // — `{string, type}` — reads `.type` into the part's Content-Type header
        // (`Libraries/Network/FormData.js`, `getParts()`); this was tried once before and
        // reverted on a theory (never confirmed by logs) that it broke the request
        // client-side. That theory is now the less-supported one: we have hard evidence
        // plain-string is wrong, and none that this was. Re-trying it with real backend
        // log visibility this time — if it still 415s/500s, the log will say why.
        form.append('profileRequest', { string: JSON.stringify(profileRequest), type: 'application/json' } as unknown as Blob);
        if (hasNewLocalPhoto) {
          form.append('profilePhoto', { uri: photoUri, name: 'profile.jpg', type: 'image/jpeg' } as unknown as Blob);
        }
        await postMultipart('/profile/create', form, token);
      }
    } catch (err) {
      setSaving(false);
      // The user-facing message stays generic (localized, non-technical), but this is
      // the one thing standing between "profile save doesn't work" and knowing why —
      // log it so device/Metro logs actually say something useful next time.
      console.warn('Profile save failed:', err);
      Alert.alert(t('onboarding.error_title'), t('profile.save_error'));
      return;
    }
    setSaving(false);

    if (isEditing) {
      Alert.alert(t('profile.header_title'), t('profile.save_success'));
    }
    // `profileUpdated: true` only on an actual edit save — first-time setup already gets
    // a fresh fetch from Dashboard's own mount effect, no signal needed for that path.
    navigation.navigate('Dashboard', isEditing ? { profileUpdated: true } : undefined);
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
        onPress: async () => {
          await logout();
          navigation.reset({
            index: 0,
            routes: [{ name: 'Language' }],
          });
        },
      },
    ]);
  };

  // Distinguishes "you already have a pending deletion" (400, confirmed live against
  // the deployed backend) from every other failure — the previous single generic
  // message told the user to "try again" even when retrying could never work (a second
  // request while one is already pending always 400s the same way).
  const deletionErrorMessage = (err: unknown): string => {
    if (err instanceof ApiError) {
      if (err.status === 0) {
        return t('onboarding.network_error');
      }
      const body = err.body;
      const message = body && typeof body === 'object' && 'message' in body ? (body as { message?: unknown }).message : null;
      if (message === 'Deletion Request already being sent') {
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
            // Soft-delete: stamps `deletionRequestedAt` server-side, hard-deleted 30
            // days later by a scheduled job — not an immediate wipe. If this call
            // fails, the account is *not* actually scheduled for deletion, so the
            // local wipe below must not run either — proceeding regardless would
            // leave the user thinking they're safe while the account (and its data)
            // still exists server-side indefinitely.
            await apiFetch('/profile/deletion/request', { method: 'PUT', token });
          } catch (err) {
            console.warn('Account deletion request failed:', err);
            Alert.alert(t('onboarding.error_title'), deletionErrorMessage(err));
            return;
          }
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
          placeholderTextColor={styles.placeholder.color}
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

            {/* Palette picker — applies live, persists to habita.theme.palette */}
            <Text style={styles.label}>{t('profile.theme_label')}</Text>
            <View style={styles.themeGrid}>
              {palettes.map((palette) => {
                const active = paletteKey === palette.key;
                return (
                  <Pressable
                    key={palette.key}
                    style={[styles.themeCard, active && styles.themeCardActive]}
                    onPress={() => setTheme(palette.key)}>
                    <View style={styles.swatchRow}>
                      <View style={[styles.swatch, { backgroundColor: palette.swatch[0] }]} />
                      <View style={[styles.swatch, { backgroundColor: palette.swatch[1] }]} />
                    </View>
                    <Text style={[styles.themeName, active && styles.themeNameActive]}>
                      {t(`theme.${palette.key}`)}
                    </Text>
                    <Text style={[styles.themeDesc, active && styles.themeDescActive]}>
                      {t(`theme.${palette.key}_desc`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* User Role — asking at first-time setup was friction for a purely local,
            no-backend-field concept; still changeable later from Profile edit. */}
        {isEditing && (
          <>
            <Text style={styles.label}>{t('profile.role_label')}</Text>
            <View style={styles.roleGrid}>
              <Pressable
                style={[styles.roleCard, role === 'household_ceo' && styles.roleCardActive]}
                onPress={() => setRole('household_ceo')}>
                <Text style={[styles.roleTitle, role === 'household_ceo' && styles.roleTitleActive]}>🏠 {t('onboarding.role_ceo')}</Text>
                <Text style={[styles.roleSub, role === 'household_ceo' && styles.roleSubActive]}>{t('onboarding.role_ceo_sub')}</Text>
              </Pressable>
              <Pressable
                style={[styles.roleCard, role === 'individual' && styles.roleCardActive]}
                onPress={() => setRole('individual')}>
                <Text style={[styles.roleTitle, role === 'individual' && styles.roleTitleActive]}>🧑 {t('onboarding.role_individual')}</Text>
                <Text style={[styles.roleSub, role === 'individual' && styles.roleSubActive]}>{t('onboarding.role_individual_sub')}</Text>
              </Pressable>
            </View>
          </>
        )}

        {/* Location */}
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

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) => StyleSheet.create({
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
    borderColor: colors.surfaceElevated,
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
    backgroundColor: colors.surfaceElevated,
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
    backgroundColor: colors.surfaceElevated,
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
    color: colors.textOnPrimary,
  },
  themeGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  themeCard: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  themeCardActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  swatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  themeName: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.textPrimary,
  },
  themeNameActive: {
    color: colors.textOnPrimary,
  },
  themeDesc: {
    fontFamily: fonts.sans,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 13,
  },
  themeDescActive: {
    color: colors.textOnPrimaryMuted,
  },
  roleGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  roleCard: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
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
  roleTitleActive: {
    color: colors.textOnPrimary,
  },
  roleSubActive: {
    color: colors.textOnPrimaryMuted,
  },
  // `placeholderTextColor` is a prop, not a style — the colour is kept here so
  // the factory stays the single place this screen reads the palette.
  placeholder: {
    color: colors.textMuted,
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
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.xl,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  deleteText: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: colors.danger,
  },
  photoOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
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
    backgroundColor: colors.surfaceElevated,
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
