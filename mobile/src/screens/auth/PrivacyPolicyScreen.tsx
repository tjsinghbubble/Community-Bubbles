import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../../styles/theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

const EFFECTIVE_DATE = 'March 7, 2026';
const VERSION = '1.0';

const PrivacyPolicyScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} testID="button-back">
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.versionBadge}>
          <Text style={styles.versionText}>Version {VERSION} — Effective {EFFECTIVE_DATE}</Text>
        </View>

        <Text style={styles.sectionTitle}>1. Information We Collect</Text>
        <Text style={styles.body}>
          We collect information you provide directly, including your name, email address, date of birth, gender, profile photo, and interests. We also collect usage data such as how you interact with bubbles, events, and other users.
        </Text>

        <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
        <Text style={styles.body}>
          We use your information to provide and improve Bubble, personalize your experience, connect you with relevant communities, send notifications about activity in your bubbles, and communicate updates about the service.
        </Text>

        <Text style={styles.sectionTitle}>3. Location Data</Text>
        <Text style={styles.body}>
          With your permission, we collect location data to show you nearby bubbles and events. You can disable location services at any time through your device settings.
        </Text>

        <Text style={styles.sectionTitle}>4. Sharing of Information</Text>
        <Text style={styles.body}>
          We do not sell your personal information. We may share your information with other Bubble users as part of the service (e.g., your profile in a bubble you've joined), and with service providers who help us operate the platform.
        </Text>

        <Text style={styles.sectionTitle}>5. Campus Mode Data</Text>
        <Text style={styles.body}>
          If you use Campus Mode, we collect and verify your .edu email address to confirm your university affiliation. This information is used solely for campus verification and access to campus-specific content.
        </Text>

        <Text style={styles.sectionTitle}>6. Messaging</Text>
        <Text style={styles.body}>
          Messages sent through Bubble are processed by our messaging partner to enable real-time communication. Message content is not used for advertising or shared with third parties beyond what is necessary to deliver the service.
        </Text>

        <Text style={styles.sectionTitle}>7. Data Retention</Text>
        <Text style={styles.body}>
          We retain your account information for as long as your account is active. You can request deletion of your account and associated data at any time by contacting us.
        </Text>

        <Text style={styles.sectionTitle}>8. Security</Text>
        <Text style={styles.body}>
          We implement reasonable security measures to protect your information, including encryption of data in transit and secure storage of credentials. However, no method of transmission over the Internet is 100% secure.
        </Text>

        <Text style={styles.sectionTitle}>9. Children's Privacy</Text>
        <Text style={styles.body}>
          Bubble is not intended for children under 13. We do not knowingly collect personal information from children under 13. If we learn we have collected such information, we will promptly delete it.
        </Text>

        <Text style={styles.sectionTitle}>10. Your Rights</Text>
        <Text style={styles.body}>
          You have the right to access, correct, or delete your personal information. You may also opt out of promotional communications at any time. To exercise these rights, contact us at support@trybubble.io.
        </Text>

        <Text style={styles.sectionTitle}>11. Changes to This Policy</Text>
        <Text style={styles.body}>
          We may update this Privacy Policy from time to time. We will notify you of material changes through the app or by email. The version date at the top of this policy indicates when it was last updated.
        </Text>

        <Text style={styles.sectionTitle}>12. Contact Us</Text>
        <Text style={styles.body}>
          If you have questions about this Privacy Policy, please contact us at support@trybubble.io.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  versionBadge: {
    backgroundColor: Colors.brand.bubbleBlue + '14',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.lg,
    alignSelf: 'flex-start',
  },
  versionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.brand.bubbleBlue,
  },
  sectionTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  body: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 21,
  },
});

export default PrivacyPolicyScreen;
