import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing, Typography, InputStyles, CardShadow } from '../../styles/theme';
import AnimatedPressable from '../../components/AnimatedPressable';
import ScreenHeader from '../../components/ScreenHeader';

const FEEDBACK_OPTIONS = ['Bubble', 'Event', 'Other'] as const;
type FeedbackType = (typeof FEEDBACK_OPTIONS)[number];

type LinkOption = 'yes' | 'no';

export default function ReportConcernScreen() {
  const navigation = useNavigation<any>();

  const [step, setStep] = useState<1 | 2>(1);
  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [hasLink, setHasLink] = useState<LinkOption | null>(null);

  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());

  const canProceed = feedbackType !== null && hasLink !== null;
  const canSubmit = name.trim() && date.trim() && description.trim() && fullName.trim() && email.trim();

  const nameLabel = feedbackType === 'Event' ? 'Event name' : feedbackType === 'Other' ? 'Name' : 'Bubble name';

  const handleSubmit = () => {
    Alert.alert('Submitted', 'Your concern has been submitted. We will review it shortly.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const handleDaySelect = (day: number) => {
    const m = String(calendarMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    setDate(`${m}/${d}/${calendarYear}`);
    setShowDatePicker(false);
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(calendarYear, calendarMonth);
    const firstDay = getFirstDayOfMonth(calendarYear, calendarMonth);
    const weeks: (number | null)[][] = [];
    let currentWeek: (number | null)[] = Array(firstDay).fill(null);

    for (let day = 1; day <= daysInMonth; day++) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      weeks.push(currentWeek);
    }

    const selectedParts = date.split('/');
    const selectedDay =
      selectedParts.length === 3 &&
      parseInt(selectedParts[0]) === calendarMonth + 1 &&
      parseInt(selectedParts[2]) === calendarYear
        ? parseInt(selectedParts[1])
        : null;

    return (
      <View style={styles.calendarOverlay}>
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity
              onPress={() => {
                if (calendarMonth === 0) {
                  setCalendarMonth(11);
                  setCalendarYear(calendarYear - 1);
                } else {
                  setCalendarMonth(calendarMonth - 1);
                }
              }}
              testID="button-calendar-prev"
            >
              <Ionicons name="chevron-back" size={24} color={Colors.brand.midnight} />
            </TouchableOpacity>
            <Text style={styles.calendarMonthYear}>
              {MONTH_NAMES[calendarMonth]} {calendarYear}
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (calendarMonth === 11) {
                  setCalendarMonth(0);
                  setCalendarYear(calendarYear + 1);
                } else {
                  setCalendarMonth(calendarMonth + 1);
                }
              }}
              testID="button-calendar-next"
            >
              <Ionicons name="chevron-forward" size={24} color={Colors.brand.midnight} />
            </TouchableOpacity>
          </View>

          <View style={styles.dayHeaderRow}>
            {DAY_HEADERS.map((d) => (
              <Text key={d} style={styles.dayHeaderText}>{d}</Text>
            ))}
          </View>

          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((day, di) => (
                <TouchableOpacity
                  key={di}
                  style={[
                    styles.dayCell,
                    day === selectedDay && styles.dayCellSelected,
                  ]}
                  disabled={day === null}
                  onPress={() => day && handleDaySelect(day)}
                  testID={day ? `button-day-${day}` : undefined}
                >
                  <Text
                    style={[
                      styles.dayText,
                      day === selectedDay && styles.dayTextSelected,
                      day === null && styles.dayTextEmpty,
                    ]}
                  >
                    {day ?? ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}

          <TouchableOpacity
            style={styles.calendarClose}
            onPress={() => setShowDatePicker(false)}
            testID="button-calendar-close"
          >
            <Text style={styles.calendarCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader
        title="Report a Concern"
        onBack={() => {
          if (step === 2) {
            setStep(1);
          } else {
            navigation.goBack();
          }
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === 1 && (
            <>
              <Text style={styles.question}>What's your feedback about?</Text>
              <View style={styles.optionsGroup}>
                {FEEDBACK_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.optionPill,
                      feedbackType === opt && styles.optionPillSelected,
                    ]}
                    onPress={() => setFeedbackType(opt)}
                    testID={`option-feedback-${opt.toLowerCase()}`}
                  >
                    <Text
                      style={[
                        styles.optionPillText,
                        feedbackType === opt && styles.optionPillTextSelected,
                      ]}
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.question}>Do you have link to the Bubble or Event?</Text>
              <View style={styles.optionsGroup}>
                <TouchableOpacity
                  style={[
                    styles.optionPill,
                    hasLink === 'yes' && styles.optionPillSelected,
                  ]}
                  onPress={() => setHasLink('yes')}
                  testID="option-link-yes"
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      hasLink === 'yes' && styles.optionPillTextSelected,
                    ]}
                  >
                    Yes, I have the Link
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.optionPill,
                    hasLink === 'no' && styles.optionPillSelected,
                  ]}
                  onPress={() => setHasLink('no')}
                  testID="option-link-no"
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      hasLink === 'no' && styles.optionPillTextSelected,
                    ]}
                  >
                    No, I do not have the Link
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.footer}>
                <Text style={styles.pageIndicator}>Page 1/2</Text>
                <AnimatedPressable
                  style={[
                    styles.nextButton,
                    !canProceed && styles.nextButtonDisabled,
                  ]}
                  scaleValue={0.97}
                  onPress={() => canProceed && setStep(2)}
                  disabled={!canProceed}
                  testID="button-next"
                >
                  <Text style={[styles.nextButtonText, !canProceed && styles.nextButtonTextDisabled]}>
                    Next
                  </Text>
                </AnimatedPressable>
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.requiredNote}>All fields are required unless otherwise noted.</Text>

              <Text style={styles.fieldLabel}>What's the name?</Text>
              <TextInput
                style={InputStyles.field}
                placeholder={nameLabel}
                placeholderTextColor={Colors.text.disabled}
                value={name}
                onChangeText={setName}
                testID="input-name"
              />

              <Text style={[styles.fieldLabel, { marginTop: Spacing.lg }]}>When did this take place</Text>
              <TouchableOpacity
                style={InputStyles.field}
                onPress={() => setShowDatePicker(true)}
                testID="button-date-picker"
              >
                <Text style={{ color: date ? Colors.text.primary : Colors.text.disabled, fontSize: Typography.sizes.base, lineHeight: 56 }}>
                  {date || 'Select a date'}
                </Text>
              </TouchableOpacity>

              {showDatePicker && renderCalendar()}

              <Text style={[styles.fieldLabel, { marginTop: Spacing.lg }]}>Describe the situation</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Describe what happened..."
                placeholderTextColor={Colors.text.disabled}
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
                testID="input-description"
              />

              <View style={styles.contactSection}>
                <Text style={styles.contactTitle}>Your contact details</Text>
                <Text style={styles.contactDisclaimer}>
                  Your information will not be shared with the Bubble or Event Admins
                </Text>
              </View>

              <Text style={styles.fieldLabel}>Full Name</Text>
              <TextInput
                style={InputStyles.field}
                placeholder="Full Name"
                placeholderTextColor={Colors.text.disabled}
                value={fullName}
                onChangeText={setFullName}
                testID="input-full-name"
              />

              <Text style={[styles.fieldLabel, { marginTop: Spacing.lg }]}>Email</Text>
              <TextInput
                style={InputStyles.field}
                placeholder="Email"
                placeholderTextColor={Colors.text.disabled}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                testID="input-email"
              />

              <View style={styles.footer}>
                <TouchableOpacity onPress={() => setStep(1)} testID="button-step-back">
                  <Text style={styles.backLink}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.pageIndicator}>Page 2/2</Text>
                <AnimatedPressable
                  style={[
                    styles.submitButton,
                    !canSubmit && styles.submitButtonDisabled,
                  ]}
                  scaleValue={0.97}
                  onPress={() => canSubmit && handleSubmit()}
                  disabled={!canSubmit}
                  testID="button-submit"
                >
                  <Text style={[styles.submitButtonText, !canSubmit && styles.submitButtonTextDisabled]}>
                    Submit
                  </Text>
                </AnimatedPressable>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: 40,
  },
  question: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.midnight,
    marginBottom: Spacing.md,
  },
  optionsGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  optionPill: {
    borderWidth: 1,
    borderColor: '#D9D9D9',
    borderRadius: 100,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background.primary,
  },
  optionPillSelected: {
    borderColor: Colors.brand.bubbleBlue,
    backgroundColor: Colors.background.brandTint,
  },
  optionPillText: {
    fontSize: Typography.sizes.base,
    color: Colors.neutral.charcoal,
  },
  optionPillTextSelected: {
    color: Colors.brand.bubbleBlue,
    fontWeight: Typography.weights.semiBold,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xxxl,
  },
  pageIndicator: {
    fontSize: Typography.sizes.base,
    color: Colors.text.tertiary,
  },
  nextButton: {
    backgroundColor: Colors.brand.bubbleBlue,
    borderRadius: 100,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.sm,
  },
  nextButtonDisabled: {
    backgroundColor: Colors.neutral.coolMist,
  },
  nextButtonText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: '#FFFFFF',
  },
  nextButtonTextDisabled: {
    color: '#FFFFFF',
  },
  requiredNote: {
    fontSize: Typography.sizes.base,
    color: Colors.text.tertiary,
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  fieldLabel: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.neutral.charcoal,
    marginBottom: Spacing.sm,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#969696',
    borderRadius: 8,
    padding: Spacing.lg,
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    backgroundColor: Colors.background.primary,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  contactSection: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  contactTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.midnight,
    marginBottom: 6,
  },
  contactDisclaimer: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    lineHeight: 18,
  },
  backLink: {
    fontSize: Typography.sizes.base,
    color: Colors.brand.bubbleBlue,
    fontWeight: Typography.weights.semiBold,
  },
  submitButton: {
    backgroundColor: Colors.brand.bubbleBlue,
    borderRadius: 100,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.sm,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.neutral.coolMist,
  },
  submitButtonText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: '#FFFFFF',
  },
  submitButtonTextDisabled: {
    color: '#FFFFFF',
  },
  calendarOverlay: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  calendarCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    padding: Spacing.lg,
    ...CardShadow,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  calendarMonthYear: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.midnight,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.sm,
  },
  dayHeaderText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.text.tertiary,
    width: 36,
    textAlign: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 4,
  },
  dayCell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: {
    backgroundColor: Colors.brand.bubbleBlue,
  },
  dayText: {
    fontSize: Typography.sizes.base,
    color: Colors.brand.midnight,
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: Typography.weights.semiBold,
  },
  dayTextEmpty: {
    color: 'transparent',
  },
  calendarClose: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  calendarCloseText: {
    fontSize: Typography.sizes.base,
    color: Colors.brand.bubbleBlue,
    fontWeight: Typography.weights.semiBold,
  },
});
