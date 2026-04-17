import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing, Typography, CardShadow } from '../../styles/theme';
import AnimatedPressable from '../../components/AnimatedPressable';
import ScreenHeader from '../../components/ScreenHeader';


export default function PrivacyScreen() {
  const navigation = useNavigation<any>();
  const [showBio, setShowBio] = useState(true);
  const [showInterests, setShowInterests] = useState(true);
  const [showBubbles, setShowBubbles] = useState(true);
  const [showPastEvents, setShowPastEvents] = useState(true);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Privacy" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionHeader}>Profile</Text>
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Show my Bio</Text>
            </View>
            <Switch
              value={showBio}
              onValueChange={setShowBio}
              trackColor={{ false: Colors.neutral.lightSilver, true: Colors.brand.bubbleBlue }}
              thumbColor="#FFFFFF"
              testID="switch-show-bio"
            />
          </View>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Show my interests</Text>
            </View>
            <Switch
              value={showInterests}
              onValueChange={setShowInterests}
              trackColor={{ false: Colors.neutral.lightSilver, true: Colors.brand.bubbleBlue }}
              thumbColor="#FFFFFF"
              testID="switch-show-interests"
            />
          </View>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Show my Bubbles</Text>
            </View>
            <Switch
              value={showBubbles}
              onValueChange={setShowBubbles}
              trackColor={{ false: Colors.neutral.lightSilver, true: Colors.brand.bubbleBlue }}
              thumbColor="#FFFFFF"
              testID="switch-show-bubbles"
            />
          </View>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Show my past events</Text>
            </View>
            <Switch
              value={showPastEvents}
              onValueChange={setShowPastEvents}
              trackColor={{ false: Colors.neutral.lightSilver, true: Colors.brand.bubbleBlue }}
              thumbColor="#FFFFFF"
              testID="switch-show-past-events"
            />
          </View>
        </View>

        <Text style={styles.sectionHeader}>Data Privacy</Text>
        <View style={styles.section}>
          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={() => navigation.navigate('DataRequestReason', { flow: 'request' })}
            testID="button-request-data"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="download-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Download my data</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>
          <View style={styles.separator} />
          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={() => navigation.navigate('DataRequestReason', { flow: 'delete' })}
            testID="button-delete-data"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="trash-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Delete my data</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>
        </View>

        <Text style={styles.sectionHeader}>Deactivate My Account</Text>
        <View style={styles.section}>
          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={() => navigation.navigate('DeactivateReason')}
            testID="button-deactivate-account"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="close-circle-outline" size={24} color={Colors.status.error} />
              <Text style={styles.deleteText}>Deactivate my account</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.status.error} />
          </AnimatedPressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.charcoal,
    marginBottom: 12,
    marginTop: 8,
  },
  section: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
    ...CardShadow,
  },
  separator: {
    height: 1,
    backgroundColor: '#D9D9D9',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  toggleInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  toggleLabel: {
    fontSize: Typography.sizes.base,
    color: Colors.text.tertiary,
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
  deleteText: {
    fontSize: Typography.sizes.base,
    color: Colors.status.error,
  },
});
