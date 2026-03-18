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

        <Text style={styles.body}>
          These Terms of Service ("Terms") are a binding legal agreement between you and MyBubble Inc. ("Bubble," "we," "us," or "our") that govern your use of the Bubble platform, including our mobile application, website at trybubble.io, and all related services (collectively, the "Platform"). By accessing or using the Platform, you agree to be bound by these Terms.
        </Text>
        <Text style={styles.body}>
          Thank you for using Bubble! Our mission is Connection Over Clicks — we help people build genuine community where they live by connecting them with local events, groups, and venues.
        </Text>
        <Text style={styles.body}>
          The Platform enables users ("Members") to discover, create, and join local community groups ("Bubbles"), RSVP to events, and book venue time slots. Members who create and lead groups are "Bubble Leaders." Local businesses that offer available time slots are "Venue Partners." As the provider of the Platform, Bubble does not own, control, or operate any venues and is not a party to agreements between Members and Venue Partners, except as specified in these Terms.
        </Text>

        <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>MEMBER TERMS</Text>

        <Text style={styles.sectionTitle}>1. Your Bubble Account</Text>
        <Text style={styles.body}>
          1.1 Registration: To access most features of the Platform, you must create an account. You agree to provide accurate, current, and complete information during registration and to update such information as necessary. You may only maintain one personal account.
        </Text>
        <Text style={styles.body}>
          1.2 Account Security: You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to immediately notify Bubble of any unauthorized use of your account.
        </Text>
        <Text style={styles.body}>
          1.3 Age Requirements: You must be at least 18 years of age to create an account and use the Platform. By creating an account, you represent and warrant that you meet this age requirement.
        </Text>

        <Text style={styles.sectionTitle}>2. Discovering and Booking on Bubble</Text>
        <Text style={styles.body}>
          2.1 Searching: You can browse Bubbles (community groups) and events based on your location, interests, and availability. Search results are influenced by factors including proximity, group activity, member engagement, and relevance to your preferences.
        </Text>
        <Text style={styles.body}>
          2.2 Joining a Bubble: When you join a Bubble, you become a member of that community group. Some Bubbles are open to all; others may require approval from the Bubble Leader. By joining, you agree to abide by any group-specific guidelines set by the Bubble Leader, in addition to these Terms.
        </Text>
        <Text style={styles.body}>
          2.3 RSVPing to Events and Booking Slots: When you RSVP to an event or book a venue time slot through the Platform, you are committing to attend. Some bookings may require a Seat Fee (see Section 3). By completing a booking, you agree to pay all applicable charges, including Seat Fees, service fees, and any applicable taxes.
        </Text>

        <Text style={styles.sectionTitle}>3. Seat Fees, Cancellations, and Refunds</Text>
        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>These provisions apply when payment features are available through the Service.</Text>
        </View>
        <Text style={styles.body}>
          3.1 Seat Fees: Certain venue bookings require a Seat Fee, which is collected at the time of booking through our payment processor (Stripe). Seat Fees help Venue Partners offer discounted availability and reduce no-shows. The amount of the Seat Fee will be clearly displayed before you confirm your booking.
        </Text>
        <Text style={styles.body}>
          3.2 Cancellations: You may cancel a booking through the Platform. Refund eligibility depends on when you cancel relative to the event:
          {"\n"}• More than [48] hours before the event: Full refund of Seat Fee.
          {"\n"}• [24–48] hours before the event: [50%] refund of Seat Fee.
          {"\n"}• Less than [24] hours before the event: No refund.
        </Text>
        <Text style={styles.body}>
          3.3 No-Shows: If you RSVP or book a slot and do not attend without canceling, you will be charged the full Seat Fee. Repeated no-shows may result in account restrictions or suspension.
        </Text>
        <Text style={styles.body}>
          3.4 Event Cancellations by Bubble Leaders or Venues: If an event is canceled by a Bubble Leader or Venue Partner, you will receive a full refund of any Seat Fees paid.
        </Text>

        <Text style={styles.sectionTitle}>4. Your Responsibilities and Assumption of Risk</Text>
        <Text style={styles.body}>
          4.1 Your Responsibilities: You are responsible for your own conduct when participating in Bubble events and activities. This includes treating other Members, Bubble Leaders, Venue Partners, and venue staff with respect; complying with all applicable laws; and following any venue-specific rules or guidelines.
        </Text>
        <Text style={styles.body}>
          4.2 Assumption of Risk: You acknowledge that participation in community events and activities, including but not limited to sports (such as pickleball), social gatherings, and venue visits, may carry inherent risks of injury, illness, or property damage. You voluntarily assume these risks by choosing to participate. Bubble is a platform that connects people — we do not supervise, direct, or control activities that occur at events. You are responsible for evaluating whether an activity is appropriate for you, including any physical, health, or safety considerations.
        </Text>

        <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>BUBBLE LEADER TERMS</Text>

        <Text style={styles.sectionTitle}>5. Leading a Bubble</Text>
        <Text style={styles.body}>
          5.1 Creating a Bubble: Any Member can create a Bubble (community group) on the Platform. As a Bubble Leader, you are responsible for setting the group’s purpose, guidelines, and managing its membership. Bubble Leaders are independent individuals, not employees or agents of Bubble.
        </Text>
        <Text style={styles.body}>
          5.2 Leader Responsibilities: As a Bubble Leader, you agree to:
          {"\n"}• Maintain accurate and up-to-date group information
          {"\n"}• Foster a welcoming, inclusive environment within your Bubble
          {"\n"}• Communicate clearly with Members about event details, changes, or cancellations
          {"\n"}• Comply with these Terms and Bubble’s Community Guidelines
        </Text>

        <Text style={styles.sectionTitle}>6. Managing Your Bubble and Events</Text>
        <Text style={styles.body}>
          6.1 Event Creation: Bubble Leaders can create events within their Bubble, including specifying the date, time, location, capacity, and any applicable Seat Fee. Event details must be accurate and complete. You are responsible for ensuring any venue used for your event is appropriate and available.
        </Text>
        <Text style={styles.body}>
          6.2 Member Management: Bubble Leaders may set membership criteria (open or approval-required), remove Members who violate group guidelines, and manage RSVPs. Membership decisions must comply with Bubble’s Nondiscrimination Policy.
        </Text>
        <Text style={styles.body}>
          6.3 Cancellations: If you need to cancel an event, please do so as early as possible through the Platform. Members who have paid Seat Fees will be automatically refunded upon cancellation.
        </Text>

        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>These provisions apply to users who participate as venue partners when such features are offered.</Text>
        </View>
        <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>VENUE PARTNER TERMS</Text>

        <Text style={styles.sectionTitle}>7. Partnering with Bubble</Text>
        <Text style={styles.body}>
          7.1 Venue Registration: Local venues may partner with Bubble to offer available time slots during low-utilization periods ("Bubble Hours"). As a Venue Partner, you are responsible for providing accurate information about your venue, including address, photos, available spaces, capacity, and availability windows.
        </Text>
        <Text style={styles.body}>
          7.2 Independence: Your relationship with Bubble is that of an independent business partner. Bubble does not direct or control your venue operations, pricing, or staffing. You are solely responsible for compliance with all applicable laws, regulations, licenses, and permits related to your business.
        </Text>

        <Text style={styles.sectionTitle}>8. Managing Your Venue Listing</Text>
        <Text style={styles.body}>
          8.1 Listing Accuracy: You are responsible for keeping your venue listing information (including Bubble Hours, pricing, capacity, and any venue rules) accurate and up-to-date at all times.
        </Text>
        <Text style={styles.body}>
          8.2 Booking Confirmation: When a booking is confirmed for your venue through the Platform, you agree to honor the booking terms, including the time slot, capacity, and any agreed-upon pricing or arrangements.
        </Text>
        <Text style={styles.body}>
          8.3 Member Verification: Venue Partners may verify Members upon arrival using the Bubble Digital Pass displayed in the app. Venue staff may request to see a Member’s pass for verification purposes.
        </Text>

        <Text style={styles.sectionTitle}>9. Payouts and Settlement</Text>
        <Text style={styles.body}>
          9.1 Consolidated Payouts: Bubble collects Seat Fees from Members and remits consolidated payouts to Venue Partners on a [weekly/biweekly] basis, less any applicable Bubble service fees. Payouts are processed via bank transfer.
        </Text>
        <Text style={styles.body}>
          9.2 Payout Ledger: Venue Partners will have access to a payout ledger showing Seat Fees collected, service fees deducted, and payout amounts. You are responsible for your own tax reporting and compliance related to payouts received.
        </Text>

        <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>GENERAL TERMS</Text>

        <Text style={styles.sectionTitle}>10. Community Guidelines and Standards</Text>
        <Text style={styles.body}>
          Bubble is built on the principle that real-world connection matters. All Members, Bubble Leaders, and Venue Partners are expected to:
          {"\n"}• Treat others with respect, kindness, and good faith
          {"\n"}• Not engage in harassment, discrimination, hate speech, or threatening behavior
          {"\n"}• Not use the Platform for commercial solicitation, spam, or fraud
          {"\n"}• Respect the safety and property of others at all events and venues
          {"\n"}• Report any concerns about safety or policy violations to Bubble
        </Text>
        <Text style={styles.body}>
          Bubble reserves the right to investigate and take appropriate action, including content removal, account suspension, or termination, for violations of these guidelines.
        </Text>

        <Text style={styles.sectionTitle}>11. Content</Text>
        <Text style={styles.body}>
          11.1 Your Content: You are responsible for the content you post to the Platform, including group descriptions, event details, comments, photos, and messages (collectively, "Your Content"). You represent that you have all necessary rights to post Your Content and that it does not violate any applicable laws or third-party rights.
        </Text>
        <Text style={styles.body}>
          11.2 License to Bubble: By posting content on the Platform, you grant Bubble a non-exclusive, worldwide, royalty-free, transferable license to use, reproduce, modify, display, and distribute Your Content in connection with operating and promoting the Platform. This license ends when you delete Your Content, except where it has been shared with others who have not deleted it.
        </Text>
        <Text style={styles.body}>
          11.3 Prohibited Content: You may not post content that is illegal, harmful, threatening, abusive, harassing, defamatory, obscene, or otherwise objectionable. Bubble reserves the right to remove any content that violates these Terms or our Community Guidelines.
        </Text>

        <Text style={styles.sectionTitle}>12. Fees</Text>
        <Text style={styles.body}>
          Bubble may charge service fees to Members, Bubble Leaders, and/or Venue Partners in connection with the use of the Platform. Applicable fees will be disclosed before any transaction is completed. Bubble reserves the right to change its fee structure with reasonable advance notice.
        </Text>

        <Text style={styles.sectionTitle}>13. Identity Verification</Text>
        <Text style={styles.body}>
          Bubble may use third-party identity verification services (currently Stripe Identity) to verify the identity of Members. By using the Platform, you consent to providing information for identity verification purposes. Identity verification helps maintain trust and safety within the Bubble community.
        </Text>
        <Text style={styles.body}>
          Important: Bubble’s identity verification is designed to confirm you are a real person. We do not conduct background checks, and verification does not constitute an endorsement or guarantee of any Member’s behavior.
        </Text>

        <Text style={styles.sectionTitle}>14. Bubble’s Role</Text>
        <Text style={styles.body}>
          Bubble is a technology platform that connects community members with local events, groups, and venues. Bubble is not a venue operator, event organizer, insurer, or employer. Bubble does not own, control, supervise, or direct the activities that occur at events or venues listed on the Platform.
        </Text>
        <Text style={styles.body}>
          Bubble does not guarantee the quality, safety, legality, or suitability of any event, venue, or activity listed on the Platform. Members are responsible for making their own informed decisions about participation. Bubble is not a party to any agreements made between Members and Venue Partners outside of the Platform.
        </Text>

        <Text style={styles.sectionTitle}>15. Privacy and Data</Text>
        <Text style={styles.body}>
          Bubble collects, uses, and shares personal information as described in our Privacy Policy. By using the Platform, you acknowledge that you have read and understand our Privacy Policy. Our collection and use of personal information complies with applicable laws, including the California Consumer Privacy Act (CCPA).
        </Text>

        <Text style={styles.sectionTitle}>16. Termination, Suspension, and Moderation</Text>
        <Text style={styles.body}>
          Bubble may restrict, suspend, or terminate your account or access to the Platform at our discretion if we believe you have violated these Terms, our Community Guidelines, or applicable law, or if your conduct poses a risk to the safety of the Bubble community. We will provide notice and an opportunity to appeal where reasonably practicable.
        </Text>
        <Text style={styles.body}>
          You may delete your account at any time through your account settings or by contacting us. Upon account deletion, we will handle your personal data in accordance with our Privacy Policy.
        </Text>

        <Text style={styles.sectionTitle}>17. Disclaimer of Warranties</Text>
        <Text style={styles.body}>
          THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY. BUBBLE DISCLAIMS ALL WARRANTIES, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. BUBBLE DOES NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
        </Text>

        <Text style={styles.sectionTitle}>18. Limitation of Liability</Text>
        <Text style={styles.body}>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, BUBBLE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE PLATFORM OR ANY EVENT, ACTIVITY, OR INTERACTION FACILITATED THROUGH THE PLATFORM. BUBBLE’S TOTAL LIABILITY FOR ANY CLAIM ARISING UNDER THESE TERMS SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID TO BUBBLE IN THE 12 MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED DOLLARS ($100).
        </Text>

        <Text style={styles.sectionTitle}>19. Indemnification</Text>
        <Text style={styles.body}>
          You agree to indemnify, defend, and hold harmless MyBubble Inc., its officers, directors, employees, and agents from and against any and all claims, liabilities, damages, losses, and expenses (including reasonable attorneys’ fees) arising out of or in connection with: (a) your use of the Platform; (b) Your Content; (c) your participation in any event or activity facilitated through the Platform; (d) your violation of these Terms; or (e) your violation of any applicable law or third-party rights.
        </Text>

        <Text style={styles.sectionTitle}>20. Dispute Resolution and Arbitration</Text>
        <Text style={styles.body}>
          [This section should include provisions for binding arbitration, class action waiver, and dispute resolution procedures. Consult with WSGR to draft language appropriate for your business. Consider including an opt-out period for new users.]
        </Text>

        <Text style={styles.sectionTitle}>21. Governing Law</Text>
        <Text style={styles.body}>
          These Terms shall be governed by and construed in accordance with the laws of the State of [Delaware/California], without regard to its conflict of law provisions.
        </Text>

        <Text style={styles.sectionTitle}>22. Modifications to These Terms</Text>
        <Text style={styles.body}>
          Bubble may modify these Terms at any time. We will notify you of material changes by posting the updated Terms on the Platform and, where appropriate, by sending you an email notification. Your continued use of the Platform after changes become effective constitutes your acceptance of the modified Terms. If you do not agree to the modified Terms, you must stop using the Platform.
        </Text>

        <Text style={styles.sectionTitle}>23. Miscellaneous</Text>
        <Text style={styles.body}>
          Entire Agreement. These Terms, together with the Privacy Policy and any other referenced policies, constitute the entire agreement between you and Bubble regarding the use of the Platform.
          {"\n\n"}Severability. If any provision of these Terms is found to be unenforceable, the remaining provisions shall continue in full force and effect.
          {"\n\n"}Waiver. Bubble’s failure to enforce any right or provision of these Terms shall not constitute a waiver of that right or provision.
          {"\n\n"}Assignment. You may not assign your rights under these Terms without Bubble’s prior written consent. Bubble may assign its rights without restriction.
          {"\n\n"}Notices. Bubble may provide notices to you via the Platform, email, or other reasonable means. Notices to Bubble should be sent to: legal@trybubble.io or MyBubble Inc., [Stable Address], San Francisco, CA [ZIP].
        </Text>

        <Text style={styles.sectionTitle}>Contact Us</Text>
        <Text style={styles.body}>
          If you have questions about these Terms, please contact us at legal@trybubble.io.
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
    marginBottom: Spacing.md,
  },
  disclaimerBox: {
    backgroundColor: Colors.background.warningTint,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.status.warning,
  },
  disclaimerText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.status.warning,
    lineHeight: 18,
  },
});

export default TermsOfServiceScreen;
