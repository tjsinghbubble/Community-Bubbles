import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PageHeader, BackArrow, Spacing } from '../styles/theme';

type Props = {
  title?: string;
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
              size={BackArrow.size}
              color={BackArrow.color}
            />
          </TouchableOpacity>
        )}
      </View>

      {title ? (
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.titlePlaceholder} />
      )}

      <View style={styles.side}>
        {rightElement ?? null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: PageHeader.height,
    backgroundColor: PageHeader.background,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  headerBorder: {
    borderBottomWidth: PageHeader.borderWidth,
    borderBottomColor: PageHeader.borderColor,
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
  titlePlaceholder: {
    flex: 1,
  },
});
