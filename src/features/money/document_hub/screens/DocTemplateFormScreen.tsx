import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../../app/_layout';
import type { ThemeTokens } from '../../../../theme';
import useThemedStyles from '../../../../hooks/useThemedStyles';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import FileText from 'lucide-react-native/icons/file-text';
import FilePlus from 'lucide-react-native/icons/file-plus';
import Upload from 'lucide-react-native/icons/upload';
import Globe from 'lucide-react-native/icons/globe';
import CreditCard from 'lucide-react-native/icons/credit-card';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import Tag from 'lucide-react-native/icons/tag';
import Home from 'lucide-react-native/icons/house';
import Receipt from 'lucide-react-native/icons/receipt';
import Button from '../../../../components/Button';
import { addDocument } from '../docStore';
import { DOC_TEMPLATES, type DocTemplateType, type DocCategory, type PickedFile } from '../types';
import { subscribeToLanguageChanges, t } from '../../../../i18n';
import useAuth from '../../../../hooks/useAuth';
import { showNetworkUnavailableAlert } from '../../../../utils/networkStatus';
import { extractVaultErrorMessage } from '../api';
import { getItem } from '../../../../utils/storage';

type Props = StackScreenProps<RootStackParamList, 'DocTemplateForm'>;

// Every category the backend accepts (docs/VAULT_API_SPEC.md §3.1). The 4 pre-built
// templates (passport/visa/license/insurance) fix their category automatically; the
// "Custom Document" entry point has no such template, so it needs a picker covering the
// full set — otherwise warranty/property/tax documents (which the custom flow's own
// description explicitly advertises) would have no way to be saved with the right
// category at all.
const ALL_CATEGORIES: { key: DocCategory; labelKey: string }[] = [
  { key: 'passport', labelKey: 'doc_hub.cat_passport' },
  { key: 'visa', labelKey: 'doc_hub.cat_visa' },
  { key: 'license', labelKey: 'doc_hub.cat_license' },
  { key: 'insurance', labelKey: 'doc_hub.cat_insurance' },
  { key: 'warranty', labelKey: 'doc_hub.cat_warranty' },
  { key: 'property', labelKey: 'doc_hub.cat_property' },
  { key: 'tax', labelKey: 'doc_hub.cat_tax' },
];

function getCategoryIcon(category: DocCategory, size: number, color: string) {
  switch (category) {
    case 'passport':
      return <FileText size={size} color={color} strokeWidth={1.5} />;
    case 'visa':
      return <Globe size={size} color={color} strokeWidth={1.5} />;
    case 'license':
      return <CreditCard size={size} color={color} strokeWidth={1.5} />;
    case 'insurance':
      return <ShieldCheck size={size} color={color} strokeWidth={1.5} />;
    case 'warranty':
      return <Tag size={size} color={color} strokeWidth={1.5} />;
    case 'property':
      return <Home size={size} color={color} strokeWidth={1.5} />;
    case 'tax':
      return <Receipt size={size} color={color} strokeWidth={1.5} />;
  }
}

export default function DocTemplateFormScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { templateType, custom } = route.params;
  const { getAccessToken } = useAuth();
  const [, setLocaleVersion] = useState(0);

  useEffect(() => {
    const unsubLang = subscribeToLanguageChanges(() => setLocaleVersion((v) => v + 1));
    return () => {
      unsubLang();
    };
  }, []);

  useEffect(() => {
    getItem<{ name?: string }>('habita.user_profile', {}).then((prof) => {
      if (prof?.name) {
        setMemberName(prof.name);
      }
    });
  }, []);

  const templateInfo =
    DOC_TEMPLATES.find((t) => t.type === templateType) || DOC_TEMPLATES[0];

  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(custom ? '' : `${templateInfo.title} (New)`);
  const [category, setCategory] = useState<DocCategory>(custom ? 'warranty' : templateInfo.category);
  const [docNumber, setDocNumber] = useState('');
  const [memberName, setMemberName] = useState('');
  const [issueDate, setIssueDate] = useState('2024-01-15');
  const [expiryDate, setExpiryDate] = useState('2030-01-14');
  const [country, setCountry] = useState(templateType === 'passport' ? 'India' : 'United States');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [coveredMembers, setCoveredMembers] = useState('');
  const [notes, setNotes] = useState('');
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);

  const handlePickFile = async () => {
    try {
      const picker = require('@react-native-documents/picker');
      const res = await picker.pick({
        type: [picker.types.allFiles],
      });
      if (res && res[0]) {
        const asset = res[0];
        setPickedFile({
          uri: asset.uri,
          name: asset.name || 'Attached_Document.pdf',
          type: asset.type || 'application/octet-stream',
        });
      }
    } catch (err: any) {
      // A cancelled picker rejects with a message containing "cancel" — not a real error.
      if (!err?.message?.includes('cancel')) {
        Alert.alert(t('doc_hub.cannot_attach_title'), t('doc_hub.cannot_attach_msg'));
      }
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert(t('doc_hub.missing_field'), t('doc_hub.enter_title_msg'));
      return;
    }
    if (!expiryDate.trim()) {
      Alert.alert(t('doc_hub.missing_expiry'), t('doc_hub.enter_expiry_msg'));
      return;
    }
    if (issueDate.trim() && issueDate.trim() > expiryDate.trim()) {
      Alert.alert(t('doc_hub.invalid_dates_title'), t('doc_hub.invalid_dates_msg'));
      return;
    }

    setSaving(true);
    try {
      const token = await getAccessToken().catch(() => null);
      const { offline } = await addDocument(
        {
          title: title.trim(),
          category,
          docNumber: docNumber.trim(),
          memberName: memberName.trim() || 'Household Member',
          issueDate: issueDate.trim(),
          expiryDate: expiryDate.trim(),
          notes: notes.trim(),
          fileName: pickedFile?.name || `${custom ? 'document' : templateInfo.type}_scanned.pdf`,
          country: custom ? '' : country.trim(),
          issuingAuthority: issuingAuthority.trim(),
          coveredMembers: custom ? '' : coveredMembers.trim(),
        },
        token,
        pickedFile,
      );

      if (offline) {
        showNetworkUnavailableAlert();
      } else {
        Alert.alert(t('doc_hub.saved_alert_title'), t('doc_hub.saved_alert_msg', { title }));
      }
      navigation.popTo('DocHub');
    } catch (err) {
      Alert.alert(t('doc_hub.save_failed_title'), extractVaultErrorMessage(err) || t('doc_hub.save_failed_msg'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {custom
            ? t('doc_hub.custom_doc_title')
            : t('doc_hub.form_suffix', {
                title: t(`doc_hub.tmpl_${templateInfo.type}_title`, { defaultValue: templateInfo.title }),
              })}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 60 : 0}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* Template Form Hero */}
        <View style={styles.formHeroCard}>
          <View
            style={[
              styles.formHeroBadge,
              { backgroundColor: custom ? styles.customIconBadge.backgroundColor : templateInfo.bgColor },
            ]}>
            {custom ? (
              <FilePlus size={24} color={styles.primaryIcon.color} />
            ) : (
              <FileText size={24} color={templateInfo.accentColor} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.formHeroTitle}>
              {custom
                ? t('doc_hub.custom_doc_title')
                : t(`doc_hub.tmpl_${templateInfo.type}_title`, { defaultValue: templateInfo.title })}
            </Text>
            <Text style={styles.formHeroSub}>
              {custom
                ? t('doc_hub.custom_doc_sub')
                : t(`doc_hub.tmpl_${templateInfo.type}_desc`, { defaultValue: templateInfo.description })}
            </Text>
          </View>
        </View>

        {/* Category Picker — only the custom flow needs one; a template already fixes it */}
        {custom && (
          <>
            <Text style={styles.sectionTitle}>{t('doc_hub.select_category')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryPickerRow}>
              {ALL_CATEGORIES.map((cat) => {
                const active = category === cat.key;
                return (
                  <Pressable
                    key={cat.key}
                    style={[styles.categoryChip, active && styles.categoryChipActive]}
                    onPress={() => setCategory(cat.key)}>
                    {getCategoryIcon(cat.key, 14, active ? '#FFFFFF' : styles.primaryIcon.color)}
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(cat.labelKey)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* General Form Fields */}
        <View style={styles.card}>
          <Text style={styles.inputLabel}>{t('doc_hub.title_label')} *</Text>
          <TextInput
            style={styles.textInput}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Indian Passport (Animesh)"
            placeholderTextColor={styles.placeholder.color}
          />

          <Text style={styles.inputLabel}>{t('doc_hub.owner_member_label')} *</Text>
          <TextInput
            style={styles.textInput}
            value={memberName}
            onChangeText={setMemberName}
            placeholder={t('doc_hub.owner_name_placeholder')}
            placeholderTextColor={styles.placeholder.color}
          />

          <Text style={styles.inputLabel}>
            {t('doc_hub.doc_num_label')}
          </Text>
          <TextInput
            style={styles.textInput}
            value={docNumber}
            onChangeText={setDocNumber}
            placeholder={t('doc_hub.doc_num_placeholder')}
            placeholderTextColor={styles.placeholder.color}
          />
        </View>

        {/* Expiration & Dates Fields */}
        <Text style={styles.sectionTitle}>{t('doc_hub.dates_validity')}</Text>
        <View style={styles.card}>
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, styles.dateFieldLabel]}>
                {t('doc_hub.issue_date')} (YYYY-MM-DD)
              </Text>
              <TextInput
                style={styles.textInput}
                value={issueDate}
                onChangeText={setIssueDate}
                placeholder="2020-04-12"
                placeholderTextColor={styles.placeholder.color}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, styles.dateFieldLabel]}>
                {t('doc_hub.expiration_date')} * (YYYY-MM-DD)
              </Text>
              <TextInput
                style={styles.textInput}
                value={expiryDate}
                onChangeText={setExpiryDate}
                placeholder="2030-04-11"
                placeholderTextColor={styles.placeholder.color}
              />
            </View>
          </View>
        </View>

        {/* Template Specific Specialized Fields */}
        <Text style={styles.sectionTitle}>{t('doc_hub.template_details')}</Text>
        <View style={styles.card}>
          <Text style={styles.inputLabel}>{t('doc_hub.issuing_authority')}</Text>
          <TextInput
            style={styles.textInput}
            value={issuingAuthority}
            onChangeText={setIssuingAuthority}
            placeholder={
              custom
                ? t('doc_hub.auth_placeholder_default')
                : templateType === 'passport'
                ? t('doc_hub.auth_placeholder_passport')
                : templateType === 'insurance'
                ? t('doc_hub.auth_placeholder_insurance')
                : t('doc_hub.auth_placeholder_default')
            }
            placeholderTextColor={styles.placeholder.color}
          />

          {!custom && templateType === 'insurance' && (
            <>
              <Text style={styles.inputLabel}>{t('doc_hub.covered_members')}</Text>
              <TextInput
                style={styles.textInput}
                value={coveredMembers}
                onChangeText={setCoveredMembers}
                placeholder="e.g. Animesh, Priya, Rahul"
                placeholderTextColor={styles.placeholder.color}
              />
            </>
          )}

          {!custom && (templateType === 'passport' || templateType === 'visa') && (
            <>
              <Text style={styles.inputLabel}>{t('doc_hub.country')}</Text>
              <TextInput
                style={styles.textInput}
                value={country}
                onChangeText={setCountry}
                placeholder="e.g. India / United States"
                placeholderTextColor={styles.placeholder.color}
              />
            </>
          )}

          <Text style={styles.inputLabel}>{t('doc_hub.notes_label')}</Text>
          <TextInput
            style={[styles.textInput, { height: 70 }]}
            multiline
            value={notes}
            onChangeText={setNotes}
            placeholder={t('doc_hub.notes_placeholder')}
            placeholderTextColor={styles.placeholder.color}
          />
        </View>

        {/* Upload Attachment Card */}
        <Text style={styles.sectionTitle}>{t('doc_hub.doc_attachment')}</Text>
        <Pressable style={styles.uploadCard} onPress={handlePickFile}>
          <Upload size={22} color={styles.primaryIcon.color} />
          <View style={{ flex: 1 }}>
            <Text style={styles.uploadTitle}>
              {pickedFile ? pickedFile.name : t('doc_hub.attach_file')}
            </Text>
            <Text style={styles.uploadSub}>
              {pickedFile ? t('doc_hub.file_ready_vault') : t('doc_hub.select_file')}
            </Text>
          </View>
        </Pressable>

        {/* Save Button */}
        <Button
          title={t('doc_hub.save_doc')}
          onPress={handleSave}
          loading={saving}
          style={styles.saveBtn}
        />
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardContainer: {
      flex: 1,
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      backgroundColor: colors.background,
    },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.soft,
    },
    headerIcon: {
      color: colors.textPrimary,
    },
    primaryIcon: {
      color: colors.primary,
    },
    headerTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 18,
      color: colors.textPrimary,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    formHeroCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginTop: spacing.md,
      marginBottom: spacing.lg,
      ...shadow.soft,
    },
    formHeroBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    formHeroTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
    },
    formHeroSub: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    customIconBadge: {
      backgroundColor: colors.surfaceElevated,
    },
    categoryPickerRow: {
      paddingBottom: spacing.sm,
      gap: 8,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.glassSurface || colors.surface,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 7,
      gap: 6,
    },
    categoryChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.textPrimary,
    },
    chipTextActive: {
      color: colors.textOnPrimary,
      fontFamily: fonts.sansBold,
    },
    sectionTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.md,
      ...shadow.soft,
    },
    inputLabel: {
      fontFamily: fonts.sansMedium,
      fontSize: 12.5,
      color: colors.textSecondary,
      marginBottom: 4,
      marginTop: 8,
    },
    dateFieldLabel: {
      minHeight: 32,
    },
    textInput: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.textPrimary,
      fontFamily: fonts.sans,
    },
    placeholder: {
      color: colors.textMuted,
    },
    dateRow: {
      flexDirection: 'row',
      gap: 12,
    },
    uploadCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    uploadTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 13.5,
      color: colors.primary,
    },
    uploadSub: {
      fontFamily: fonts.sans,
      fontSize: 11.5,
      color: colors.textSecondary,
      marginTop: 2,
    },
    saveBtn: {
      marginTop: spacing.xl,
    },
  });
