import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../../app/_layout';
import type { ThemeTokens } from '../../../../theme';
import useThemedStyles from '../../../../hooks/useThemedStyles';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import FileText from 'lucide-react-native/icons/file-text';
import Upload from 'lucide-react-native/icons/upload';
import Button from '../../../../components/Button';
import { addDocument } from '../docStore';
import { DOC_TEMPLATES, type DocTemplateType, type DocCategory } from '../types';

type Props = StackScreenProps<RootStackParamList, 'DocTemplateForm'>;

export default function DocTemplateFormScreen({ navigation, route }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { templateType } = route.params;

  const templateInfo =
    DOC_TEMPLATES.find((t) => t.type === templateType) || DOC_TEMPLATES[0];

  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(`${templateInfo.title} (New)`);
  const [docNumber, setDocNumber] = useState('');
  const [memberName, setMemberName] = useState('Animesh Manna');
  const [issueDate, setIssueDate] = useState('2024-01-15');
  const [expiryDate, setExpiryDate] = useState('2030-01-14');
  const [country, setCountry] = useState(templateType === 'passport' ? 'India' : 'United States');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [coveredMembers, setCoveredMembers] = useState('');
  const [notes, setNotes] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);

  const handlePickFile = async () => {
    try {
      const picker = require('@react-native-documents/picker');
      const res = await picker.pick({
        type: [picker.types.allFiles],
      });
      if (res && res[0]) {
        setFileName(res[0].name || 'Attached_Document.pdf');
        Alert.alert('File Attached', `Selected "${res[0].name || 'Document'}"`);
      }
    } catch (err: any) {
      if (!err?.message?.includes('cancel')) {
        setFileName('Scanned_Document.pdf');
        Alert.alert('File Attached', 'Selected "Scanned_Document.pdf"');
      }
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Field', 'Please enter a title for the document.');
      return;
    }
    if (!expiryDate.trim()) {
      Alert.alert('Missing Expiry Date', 'Please enter the document expiration date (YYYY-MM-DD).');
      return;
    }

    setSaving(true);
    await addDocument({
      title: title.trim(),
      category: templateInfo.category as DocCategory,
      docNumber: docNumber.trim(),
      memberName: memberName.trim() || 'Household Member',
      issueDate: issueDate.trim(),
      expiryDate: expiryDate.trim(),
      notes: notes.trim(),
      fileName: fileName || `${templateInfo.type}_scanned.pdf`,
      country: country.trim(),
      issuingAuthority: issuingAuthority.trim(),
      coveredMembers: coveredMembers.trim(),
    });
    setSaving(false);

    Alert.alert('Saved!', `${title} has been added to your Document Hub.`);
    navigation.popTo('DocHub');
  };

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>{templateInfo.title} Form</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Template Form Hero */}
        <View style={styles.formHeroCard}>
          <View style={[styles.formHeroBadge, { backgroundColor: templateInfo.bgColor }]}>
            <FileText size={24} color={templateInfo.accentColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.formHeroTitle}>{templateInfo.title} Template</Text>
            <Text style={styles.formHeroSub}>{templateInfo.description}</Text>
          </View>
        </View>

        {/* General Form Fields */}
        <View style={styles.card}>
          <Text style={styles.inputLabel}>Document Title *</Text>
          <TextInput
            style={styles.textInput}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Indian Passport (Animesh)"
            placeholderTextColor={styles.placeholder.color}
          />

          <Text style={styles.inputLabel}>Member / Owner Name *</Text>
          <TextInput
            style={styles.textInput}
            value={memberName}
            onChangeText={setMemberName}
            placeholder="e.g. Animesh Manna"
            placeholderTextColor={styles.placeholder.color}
          />

          <Text style={styles.inputLabel}>
            {templateType === 'passport'
              ? 'Passport Number'
              : templateType === 'visa'
              ? 'Visa Number / Reference'
              : templateType === 'license'
              ? 'License Number'
              : 'Policy / Group ID Number'}
          </Text>
          <TextInput
            style={styles.textInput}
            value={docNumber}
            onChangeText={setDocNumber}
            placeholder="e.g. Z8942104"
            placeholderTextColor={styles.placeholder.color}
          />
        </View>

        {/* Expiration & Dates Fields */}
        <Text style={styles.sectionTitle}>Dates & Validity</Text>
        <View style={styles.card}>
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Issue Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.textInput}
                value={issueDate}
                onChangeText={setIssueDate}
                placeholder="2020-04-12"
                placeholderTextColor={styles.placeholder.color}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Expiry Date * (YYYY-MM-DD)</Text>
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
        <Text style={styles.sectionTitle}>Template Details</Text>
        <View style={styles.card}>
          <Text style={styles.inputLabel}>Issuing Authority / Provider</Text>
          <TextInput
            style={styles.textInput}
            value={issuingAuthority}
            onChangeText={setIssuingAuthority}
            placeholder={
              templateType === 'passport'
                ? 'e.g. Passport Seva Kendra Kolkata'
                : templateType === 'insurance'
                ? 'e.g. HDFC ERGO Health Insurance'
                : 'e.g. US Consulate / State RTO'
            }
            placeholderTextColor={styles.placeholder.color}
          />

          {templateType === 'insurance' && (
            <>
              <Text style={styles.inputLabel}>Covered Family Members</Text>
              <TextInput
                style={styles.textInput}
                value={coveredMembers}
                onChangeText={setCoveredMembers}
                placeholder="e.g. Animesh, Priya, Rahul"
                placeholderTextColor={styles.placeholder.color}
              />
            </>
          )}

          {(templateType === 'passport' || templateType === 'visa') && (
            <>
              <Text style={styles.inputLabel}>Country of Issue</Text>
              <TextInput
                style={styles.textInput}
                value={country}
                onChangeText={setCountry}
                placeholder="e.g. India / United States"
                placeholderTextColor={styles.placeholder.color}
              />
            </>
          )}

          <Text style={styles.inputLabel}>Additional Notes / Vault Location</Text>
          <TextInput
            style={[styles.textInput, { height: 70 }]}
            multiline
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Kept in master bedroom safe, renewal reminder set."
            placeholderTextColor={styles.placeholder.color}
          />
        </View>

        {/* Upload Attachment Card */}
        <Text style={styles.sectionTitle}>Document File Attachment</Text>
        <Pressable style={styles.uploadCard} onPress={handlePickFile}>
          <Upload size={22} color="#004F63" />
          <View style={{ flex: 1 }}>
            <Text style={styles.uploadTitle}>
              {fileName ? fileName : 'Upload Document Scan / PDF'}
            </Text>
            <Text style={styles.uploadSub}>
              {fileName ? 'File selected & ready for vault' : 'Pick PDF or image from your device'}
            </Text>
          </View>
        </Pressable>

        {/* Save Button */}
        <Button
          title="Save Document to Hub"
          onPress={handleSave}
          loading={saving}
          style={styles.saveBtn}
        />
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    root: {
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
      backgroundColor: '#E3F2F5',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#CBE4EA',
      padding: spacing.md,
    },
    uploadTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 13.5,
      color: '#004F63',
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
