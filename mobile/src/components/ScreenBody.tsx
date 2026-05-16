/**
 * ScreenBody — standard content-area wrappers to use below any ScreenHeader.
 *
 * These components enforce PageBody tokens (horizontal gutter, top/bottom breathing
 * room) so individual screens never need to roll their own container or listContent
 * styles with magic numbers.
 *
 * Usage
 * ─────
 *   // Scrollable screen
 *   <SafeAreaView style={styles.root} edges={['bottom']}>
 *     <NavHeader title="..." onBack={...} />
 *     <ScrollBody>
 *       <Text>Content here</Text>
 *     </ScrollBody>
 *   </SafeAreaView>
 *
 *   // FlatList screen — spread listContentStyle into contentContainerStyle
 *   <SafeAreaView style={styles.root} edges={['bottom']}>
 *     <NavHeader title="..." onBack={...} />
 *     <FlatList ... contentContainerStyle={listContentStyle} />
 *   </SafeAreaView>
 *
 *   // Non-scrollable (flex) screen
 *   <SafeAreaView style={styles.root} edges={['bottom']}>
 *     <NavHeader title="..." onBack={...} />
 *     <FlatBody>
 *       <Text>Content here</Text>
 *     </FlatBody>
 *   </SafeAreaView>
 *
 * Standard root style
 * ───────────────────
 *   import { screenRootStyle } from './ScreenBody';
 *   const styles = StyleSheet.create({ root: screenRootStyle });
 */

import React from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type ScrollViewProps,
} from 'react-native';
import { PageBody, Colors } from '../styles/theme';

/** Standard root style for the SafeAreaView that wraps every screen. */
export const screenRootStyle: ViewStyle = {
  flex: 1,
  backgroundColor: Colors.background.secondary,
};

/** Standard contentContainerStyle for FlatList / SectionList screens. */
export const listContentStyle: ViewStyle = {
  paddingTop: PageBody.paddingTop,
  paddingBottom: PageBody.paddingBottom,
};

/** Standard contentContainerStyle with horizontal gutter (for simpler list screens). */
export const listContentStylePadded: ViewStyle = {
  paddingTop: PageBody.paddingTop,
  paddingBottom: PageBody.paddingBottom,
  paddingHorizontal: PageBody.paddingHorizontal,
};

/**
 * ScrollBody — standard vertically-scrolling content area.
 * Applies the standard gutter and breathing room automatically.
 */
export function ScrollBody({
  children,
  style,
  contentStyle,
  noPadding = false,
  ...rest
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  noPadding?: boolean;
} & Omit<ScrollViewProps, 'style' | 'contentContainerStyle'>) {
  return (
    <ScrollView
      style={[styles.scroll, style]}
      contentContainerStyle={[
        noPadding ? styles.contentNoPadding : styles.content,
        contentStyle,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

/**
 * FlatBody — standard non-scrolling flex content area.
 * Use for screens where the content fills the remaining space (e.g. chat).
 */
export function FlatBody({
  children,
  style,
  noPadding = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  noPadding?: boolean;
}) {
  return (
    <View style={[styles.flat, noPadding ? undefined : styles.content, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  flat: {
    flex: 1,
  },
  content: {
    paddingHorizontal: PageBody.paddingHorizontal,
    paddingTop: PageBody.paddingTop,
    paddingBottom: PageBody.paddingBottom,
  },
  contentNoPadding: {
    paddingTop: PageBody.paddingTop,
    paddingBottom: PageBody.paddingBottom,
  },
});
