import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PageHeader, Spacing } from '../styles/theme';

type Props = {
  title: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  showBorder?: boolean;
};

export default function ScreenHeader({ title, onBack, rightElement, showBorder = true }: Props) {
  const backIcon = Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back';

  return (
    <View style={[styles.header, showBorder && styles.headerBorder]}>
      <View style={styles.side}>
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            testID="button-back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={backIcon}
              size={PageHeader.backArrowSize}
              color={PageHeader.backArrowColor}
            />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.side}>
        {rightElement ?? null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: PageHeader.height,
    backgroundColor: PageHeader.backgroundColor,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  headerBorder: {
    borderBottomWidth: PageHeader.borderBottomWidth,
    borderBottomColor: PageHeader.borderBottomColor,
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
});
