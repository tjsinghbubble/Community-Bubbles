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

        <Text style={styles.body}>
          This Privacy Policy describes how MyBubble Inc. ("Bubble," "we," "us," or "our") collects, uses, shares, and protects your personal information when you use the Bubble platform, including our mobile application, website at trybubble.io, and all related services (collectively, the "Platform"). This policy applies to all users of the Platform, including Members, Bubble Leaders, and Venue Partners.
        </Text>
        <Text style={[styles.body, { marginTop: Spacing.md }]}>
          At Bubble, your privacy matters. We believe in transparency about how we handle your data, and we’re committed to protecting the information you share with us. This policy is written in plain language so you can understand your rights and our practices.
        </Text>

        <Text style={styles.sectionTitle}>1. Information We Collect</Text>
        <Text style={styles.subSectionTitle}>1.1 Information You Provide Directly</Text>
        <Text style={styles.body}>
          We collect information you provide when you create an account, use the Platform, or communicate with us:
        </Text>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Account Information:</Text> Name, email address, phone number, password, profile photo.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Profile Information:</Text> Interests, neighborhood/location, bio, preferred activities.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Identity Verification:</Text> If identity verification features are introduced, we may collect government-issued ID and selfies (processed by Stripe Identity).</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Payment Information:</Text> If payment features are introduced, we may collect credit/debit card details and billing address (processed by Stripe).</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Content:</Text> Group posts, comments, photos, event descriptions, messages.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Communications:</Text> Emails, support requests, feedback you send to us.</Text>
        </View>

        <Text style={[styles.subSectionTitle, { marginTop: Spacing.md }]}>1.2 Information Collected Automatically</Text>
        <Text style={styles.body}>
          When you use the Platform, we automatically collect certain information:
        </Text>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Device Information:</Text> Device type, operating system, unique device identifiers, browser type.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Usage Data:</Text> Features used, pages viewed, events browsed, search queries, time spent.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Location Data:</Text> Approximate location based on IP address; precise location if you grant permission.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Log Data:</Text> IP address, access times, app crashes, system activity.</Text>
        </View>

        <Text style={[styles.subSectionTitle, { marginTop: Spacing.md }]}>1.3 Information from Third Parties</Text>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Stripe:</Text> If these features are introduced, we may receive payment processing and identity verification results (verified/not verified status, not raw ID images).</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Analytics Providers:</Text> Aggregated usage patterns and performance metrics.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Venue Partners:</Text> If venue partnership features are offered, we may receive attendance and check-in data for bookings at partner venues.</Text>
        </View>

        <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
        <Text style={styles.body}>We use the information we collect for the following purposes:</Text>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Provide the Platform:</Text> Create and maintain your account, match you with local Bubbles and events, process bookings and RSVPs.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Process Payments:</Text> If payment features are introduced, we will use your data to collect Seat Fees, process refunds, and send payouts.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Safety and Verification:</Text> Verify identity, prevent fraud, enforce Community Guidelines, investigate safety concerns.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Communications:</Text> Send booking confirmations, event reminders, cancellation notices, and important account updates.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Improve the Platform:</Text> Analyze usage patterns, fix bugs, develop new features, improve search and recommendations.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Legal Compliance:</Text> Comply with applicable laws, respond to legal requests, protect our rights.</Text>
        </View>
        <Text style={[styles.body, { marginTop: Spacing.md }]}>
          We do not sell your personal information. We do not use your data for third-party advertising. Your information is used to power your Bubble experience — nothing more.
        </Text>

        <Text style={styles.sectionTitle}>3. How We Share Your Information</Text>
        <Text style={styles.subSectionTitle}>3.1 With Other Members</Text>
        <Text style={styles.body}>
          When you join a Bubble or RSVP to an event, other group members may see your name, profile photo, and relevant profile information. Bubble Leaders can see the members of their group and RSVP lists for their events.
        </Text>
        <Text style={[styles.subSectionTitle, { marginTop: Spacing.md }]}>3.2 With Venue Partners</Text>
        <Text style={styles.body}>
          If venue partnership features are offered, when you book a venue time slot, the Venue Partner receives your name and the details necessary to confirm your booking (such as group size and arrival time). Venue Partners do not receive your full profile, payment details, or identity verification data.
        </Text>
        <Text style={[styles.subSectionTitle, { marginTop: Spacing.md }]}>3.3 With Service Providers</Text>
        <Text style={styles.body}>
          We share information with third-party service providers who perform services on our behalf:
        </Text>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Stripe:</Text> If payment or identity features are introduced, for payment processing and identity verification.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Analytics (Amplitude/Firebase):</Text> Platform analytics and performance monitoring.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Cloud Hosting:</Text> Data storage and infrastructure.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Communication Services:</Text> Email delivery, push notifications.</Text>
        </View>
        <Text style={[styles.body, { marginTop: Spacing.sm }]}>
          These providers are contractually required to use your information only for the services they provide to us.
        </Text>
        <Text style={[styles.subSectionTitle, { marginTop: Spacing.md }]}>3.4 For Legal Reasons</Text>
        <Text style={styles.body}>
          We may disclose your information if required by law, legal process, or government request, or if we believe disclosure is necessary to protect the rights, property, or safety of Bubble, our Members, or the public.
        </Text>
        <Text style={[styles.subSectionTitle, { marginTop: Spacing.md }]}>3.5 Business Transfers</Text>
        <Text style={styles.body}>
          If Bubble is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you of any such change.
        </Text>

        <Text style={styles.sectionTitle}>4. Your Privacy Rights (CCPA)</Text>
        <Text style={styles.body}>If you are a California resident, you have the following rights under the California Consumer Privacy Act (CCPA):</Text>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Right to Know:</Text> You can request what personal information we have collected about you, including categories and specific pieces of data.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Right to Delete:</Text> You can request that we delete the personal information we have collected from you, subject to certain exceptions.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Right to Opt-Out:</Text> You have the right to opt out of the sale of your personal information. Note: Bubble does not sell personal information.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Right to Non-Discrimination:</Text> We will not discriminate against you for exercising any of your CCPA rights.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Right to Correct:</Text> You can request that we correct inaccurate personal information we maintain about you.</Text>
        </View>
        <Text style={[styles.body, { marginTop: Spacing.sm }]}>
          To exercise any of these rights, contact us at privacy@trybubble.io or through your account settings. We will respond to verified requests within 45 days.
        </Text>

        <Text style={styles.sectionTitle}>5. Location Data</Text>
        <Text style={styles.body}>
          Bubble is a hyperlocal platform, and location data is central to how it works. Here’s how we handle it:
        </Text>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Approximate Location:</Text> We use your IP address to determine your general area for showing relevant Bubbles and events near you.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Precise Location:</Text> If you grant permission, we use your device’s GPS to provide more accurate results. You can revoke this permission at any time in your device settings.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Neighborhood Matching:</Text> We use location data to match you with Bubbles and events in your neighborhood. We do not share your precise location with other Members.</Text>
        </View>

        <Text style={styles.sectionTitle}>6. Data Retention</Text>
        <Text style={styles.body}>We retain your personal information for as long as your account is active or as needed to provide you services. Specific retention periods:</Text>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Account Data:</Text> Retained while your account is active; deleted within 30 days of account deletion request.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Payment Records:</Text> If payment features are introduced, records will be retained for 7 years for tax and legal compliance.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Identity Verification:</Text> Verification status retained; raw ID images are not stored by Bubble (processed by Stripe).</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Usage/Analytics Data:</Text> Retained in aggregated, anonymized form indefinitely for product improvement.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}><Text style={styles.bold}>Communications:</Text> Support communications retained for 2 years after resolution.</Text>
        </View>

        <Text style={styles.sectionTitle}>7. Data Security</Text>
        <Text style={styles.body}>
          We implement appropriate technical and organizational measures to protect your personal information, including:
        </Text>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>Encryption of data in transit (TLS/SSL) and at rest.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>Secure payment processing through Stripe (PCI DSS compliant) when payment features are available.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>Access controls limiting employee access to personal data on a need-to-know basis.</Text>
        </View>
        <View style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>Regular security assessments and monitoring.</Text>
        </View>
        <Text style={[styles.body, { marginTop: Spacing.md }]}>
          No system is completely secure. While we strive to protect your information, we cannot guarantee absolute security. If we become aware of a data breach that affects your personal information, we will notify you as required by applicable law.
        </Text>

        <Text style={styles.sectionTitle}>8. Children’s Privacy</Text>
        <Text style={styles.body}>
          The Platform is not intended for anyone under the age of 18. We do not knowingly collect personal information from children under 18. If we become aware that we have collected personal information from a child under 18, we will take steps to delete that information promptly. If you believe a child under 18 has provided us with personal information, please contact us at privacy@trybubble.io.
        </Text>

        <Text style={styles.sectionTitle}>9. Third-Party Links and Services</Text>
        <Text style={styles.body}>
          The Platform may contain links to third-party websites or services that are not owned or controlled by Bubble. We are not responsible for the privacy practices of these third parties. We encourage you to review the privacy policies of any third-party services you access.
        </Text>

        <Text style={styles.sectionTitle}>10. Changes to This Privacy Policy</Text>
        <Text style={styles.body}>
          We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on the Platform and, where appropriate, by sending you an email notification. Your continued use of the Platform after changes become effective constitutes your acceptance of the updated policy.
        </Text>

        <Text style={styles.sectionTitle}>11. Contact Us</Text>
        <Text style={styles.body}>
          If you have any questions about this Privacy Policy or our data practices, you can reach us at:
        </Text>
        <Text style={[styles.body, { marginTop: Spacing.sm }]}>
          Email: privacy@trybubble.io
        </Text>
        <Text style={styles.body}>
          For CCPA requests: privacy@trybubble.io
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
    marginBottom: Spacing.sm,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  body: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 21,
  },
  bulletPoint: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
    paddingRight: Spacing.lg,
  },
  bullet: {
    width: 20,
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 21,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 21,
  },
  bold: {
    fontWeight: '700',
    color: Colors.text.primary,
  },
});

export default PrivacyPolicyScreen;
