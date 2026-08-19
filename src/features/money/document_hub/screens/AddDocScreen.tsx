import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../../app/_layout';
import type { ThemeTokens } from '../../../../theme';
import useThemedStyles from '../../../../hooks/useThemedStyles';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import FileText from 'lucide-react-native/icons/file-text';
import Globe from 'lucide-react-native/icons/globe';
import CreditCard from 'lucide-react-native/icons/credit-card';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import FilePlus from 'lucide-react-native/icons/file-plus';
import { DOC_TEMPLATES, type DocTemplateType } from '../types';

type Props = StackScreenProps<RootStackParamList, 'AddDoc'>;

export default function AddDocScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  const getTemplateIcon = (type: DocTemplateType, color: string) => {
    switch (type) {
      case 'passport':
        return <FileText size={22} color={color} />;
      case 'visa':
        return <Globe size={22} color={color} />;
      case 'license':
        return <CreditCard size={22} color={color} />;
      case 'insurance':
        return <ShieldCheck size={22} color={color} />;
    }
  };

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={20} color={styles.headerIcon.color} />
        </Pressable>
        <Text style={styles.headerTitle}>Add Document</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Subtitle */}
        <Text style={styles.sectionSubtitle}>
          Choose a pre-built document template or create a custom entry.
        </Text>

        {/* Templates List */}
        <Text style={styles.sectionTitle}>Pre-Built Templates</Text>
        <View style={styles.templatesWrap}>
          {DOC_TEMPLATES.map((tmpl) => (
            <Pressable
              key={tmpl.type}
              style={styles.templateCard}
              onPress={() =>
                navigation.navigate('DocTemplateForm', { templateType: tmpl.type })
              }>
              <View style={[styles.templateIconBadge, { backgroundColor: tmpl.bgColor }]}>
                {getTemplateIcon(tmpl.type, tmpl.accentColor)}
              </View>
              <View style={styles.templateTextWrap}>
                <Text style={styles.templateTitle}>{tmpl.title}</Text>
                <Text style={styles.templateDesc}>{tmpl.description}</Text>
              </View>
              <ChevronRight size={18} color="#004F63" />
            </Pressable>
          ))}
        </View>

        {/* Custom Upload Option */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Custom Document</Text>
        <Pressable
          style={styles.customCard}
          onPress={() =>
            navigation.navigate('DocTemplateForm', { templateType: 'passport' })
          }>
          <View style={styles.customIconBadge}>
            <FilePlus size={22} color="#004F63" />
          </View>
          <View style={styles.templateTextWrap}>
            <Text style={styles.templateTitle}>Custom Document Entry</Text>
            <Text style={styles.templateDesc}>
              Upload any bill, tax paper, property deed, or home warranty contract.
            </Text>
          </View>
          <ChevronRight size={18} color="#004F63" />
        </Pressable>
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
    sectionSubtitle: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: spacing.xs,
      marginBottom: spacing.md,
      lineHeight: 18,
    },
    sectionTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    templatesWrap: {
      gap: 12,
    },
    templateCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: 14,
      ...shadow.soft,
    },
    templateIconBadge: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
    },
    templateTextWrap: {
      flex: 1,
    },
    templateTitle: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.textPrimary,
    },
    templateDesc: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
      lineHeight: 16,
    },
    customCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: 14,
      ...shadow.soft,
    },
    customIconBadge: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: '#E0F2FE',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
