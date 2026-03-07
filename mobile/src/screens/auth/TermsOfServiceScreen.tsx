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

const TermsOfServiceScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} testID="button-back">
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.versionBadge}>
          <Text style={styles.versionText}>Version {VERSION} — Effective {EFFECTIVE_DATE}</Text>
        </View>

        <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
        <Text style={styles.body}>
          By creating an account or using the Bubble app, you agree to be bound by these Terms of Service. If you do not agree, please do not use the app.
        </Text>

        <Text style={styles.sectionTitle}>2. Eligibility</Text>
        <Text style={styles.body}>
          You must be at least 13 years of age to use Bubble. By using the app, you represent that you meet this requirement. Users under 18 must have consent from a parent or legal guardian.
        </Text>

        <Text style={styles.sectionTitle}>3. Account Registration</Text>
        <Text style={styles.body}>
          You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to provide accurate and complete information during registration.
        </Text>

        <Text style={styles.sectionTitle}>4. User Conduct</Text>
        <Text style={styles.body}>
          You agree not to use Bubble to post or transmit content that is unlawful, threatening, abusive, harassing, defamatory, obscene, or otherwise objectionable. You agree not to impersonate any person or entity, or engage in any activity that disrupts or interferes with the service.
        </Text>

        <Text style={styles.sectionTitle}>5. Content Ownership</Text>
        <Text style={styles.body}>
          You retain ownership of content you post on Bubble. By posting content, you grant Bubble a non-exclusive, royalty-free, worldwide license to use, display, and distribute your content within the app and for promotional purposes.
        </Text>

        <Text style={styles.sectionTitle}>6. Community Guidelines</Text>
        <Text style={styles.body}>
          All users must adhere to Bubble's Community Guidelines. Violations may result in content removal, account suspension, or permanent bans at our discretion.
        </Text>

        <Text style={styles.sectionTitle}>7. Termination</Text>
        <Text style={styles.body}>
          We reserve the right to suspend or terminate your account at any time for conduct that we determine violates these Terms or is harmful to other users, us, or third parties.
        </Text>

        <Text style={styles.sectionTitle}>8. Disclaimers</Text>
        <Text style={styles.body}>
          Bubble is provided "as is" without warranties of any kind, either express or implied. We do not guarantee the accuracy, completeness, or usefulness of any content on the platform.
        </Text>

        <Text style={styles.sectionTitle}>9. Limitation of Liability</Text>
        <Text style={styles.body}>
          To the fullest extent permitted by law, Bubble shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the app.
        </Text>

        <Text style={styles.sectionTitle}>10. Changes to Terms</Text>
        <Text style={styles.body}>
          We may update these Terms from time to time. We will notify you of significant changes through the app or by email. Your continued use of Bubble after changes are posted constitutes acceptance of the updated Terms.
        </Text>

        <Text style={styles.sectionTitle}>11. Contact Us</Text>
        <Text style={styles.body}>
          If you have questions about these Terms, please contact us at support@trybubble.io.
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

export default TermsOfServiceScreen;
