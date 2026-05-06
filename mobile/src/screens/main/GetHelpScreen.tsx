import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing, Typography, CardShadow } from '../../styles/theme';
import AnimatedPressable from '../../components/AnimatedPressable';
import { NavHeader } from '../../components/ScreenHeader';


export default function GetHelpScreen() {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NavHeader title="Get Help" onBack={() => navigation.goBack()} />

      <View style={styles.content}>
        <View style={styles.section}>
          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={() => navigation.navigate('HelpCenter')}
            testID="button-report-concern"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="flag-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Report a Bubble or Concern</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>

          <View style={styles.divider} />

          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={() => navigation.navigate('GiveFeedback')}
            testID="button-give-feedback"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="chatbubble-ellipses-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Give us Feedback</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>

          <View style={styles.divider} />

          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={() => navigation.navigate('FeatureRequest')}
            testID="button-feature-request"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="bulb-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Request a Feature</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>

          <View style={styles.divider} />

          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={() => navigation.navigate('DefectReport')}
            testID="button-defect-report"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="bug-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Report a Bug</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
  },
  section: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    ...CardShadow,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border.light,
    marginLeft: 40,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  menuItemText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.tertiary,
  },
});
