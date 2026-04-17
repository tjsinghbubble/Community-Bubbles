import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PageHeader, BackArrow, Spacing } from '../styles/theme';

type Props = {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  showBorder?: boolean;
};

export default function ScreenHeader({ title, subtitle, onBack, rightElement, showBorder = true }: Props) {
  const insets = useSafeAreaInsets();
  const backIcon = Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back';

  return (
    <View
      style={[
        styles.header,
        showBorder && styles.headerBorder,
        { paddingTop: insets.top, height: PageHeader.height + insets.top },
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
              <Ionicons
                name={backIcon}
                size={BackArrow.size}
                color={BackArrow.color}
              />
            </TouchableOpacity>
          )}
        </View>

        {title ? (
          subtitle ? (
            <View style={styles.titleGroup}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
          ) : (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
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

const styles = StyleSheet.create({
  header: {
    backgroundColor: PageHeader.background,
    borderBottomWidth: 0,
    justifyContent: 'flex-end',
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
