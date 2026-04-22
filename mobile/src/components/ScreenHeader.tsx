import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PageHeader, BackArrow, Spacing } from '../styles/theme';

const backIcon = Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back';

function BaseHeader({
  title,
  subtitle,
  onBack,
  rightElement,
  showBorder = true,
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  showBorder?: boolean;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        showBorder && styles.headerBorder,
        { paddingTop: insets.top, paddingBottom: PageHeader.paddingBottom },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.side}>
          {onBack && (
            <TouchableOpacity
              onPress={onBack}
              style={styles.backButton}
              testID="button-back"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={backIcon} size={BackArrow.size} color={BackArrow.color} />
            </TouchableOpacity>
          )}
        </View>

        {title ? (
          subtitle ? (
            <View style={styles.titleGroup}>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
            </View>
          ) : (
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          )
        ) : (
          <View style={styles.titlePlaceholder} />
        )}

        <View style={styles.side}>
          {rightElement ?? null}
        </View>
      </View>
    </View>
  );
}

/**
 * NavHeader — Standard back-navigation header.
 * Use for all secondary/detail screens that require a back arrow and title.
 */
export function NavHeader({
  title,
  onBack,
  showBorder,
}: {
  title?: string;
  onBack: () => void;
  showBorder?: boolean;
}) {
  return <BaseHeader title={title} onBack={onBack} showBorder={showBorder} />;
}

/**
 * FlowHeader — Wizard or tool-screen header with back arrow, title, and a
 * right-side action element (e.g. Cancel button, Post button, icon action).
 */
export function FlowHeader({
  title,
  onBack,
  rightElement,
  showBorder,
}: {
  title: string;
  onBack: () => void;
  rightElement: React.ReactNode;
  showBorder?: boolean;
}) {
  return <BaseHeader title={title} onBack={onBack} rightElement={rightElement} showBorder={showBorder} />;
}

/**
 * SectionHeader — Sub-section header with back arrow, primary title, and a
 * secondary subtitle (e.g. parent bubble name).
 */
export function SectionHeader({
  title,
  subtitle,
  onBack,
  showBorder,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  showBorder?: boolean;
}) {
  return <BaseHeader title={title} subtitle={subtitle} onBack={onBack} showBorder={showBorder} />;
}

export default NavHeader;

const styles = StyleSheet.create({
  header: {
    backgroundColor: PageHeader.background,
  },
  headerBorder: {
    borderBottomWidth: PageHeader.borderWidth,
    borderBottomColor: PageHeader.borderColor,
  },
  row: {
    height: PageHeader.height,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  side: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    padding: 4,
  },
  title: {
    flex: 1,
    fontSize: PageHeader.titleFontSize,
    fontWeight: PageHeader.titleFontWeight,
    color: PageHeader.titleColor,
    textAlign: 'center',
  },
  titleGroup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: PageHeader.titleColor,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 1,
  },
  titlePlaceholder: {
    flex: 1,
  },
});
