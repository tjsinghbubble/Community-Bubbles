import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { API_URL } from '../../config/api';
import { Colors, Spacing, Radius } from '../../styles/theme';
import { NavHeader } from '../../components/ScreenHeader';
import BubbleButton from '../../components/BubbleButton';
import { EyeIcon, EyeOffIcon, ChevronDownIcon } from '../../components/icons';
import { requestPhotoLibraryAccess } from '../../utils/permissions';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Signup'>;
};

// Must match the min() constraint in shared/schema.ts insertUserSchema
const PASSWORD_MIN_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const MAX_DOB_DATE = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d;
})();

type CalDate = { year: number; month: number; day: number };

function buildCalendarGrid(year: number, month: number): ({ day: number; inMonth: boolean; date: CalDate })[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells: { day: number; inMonth: boolean; date: CalDate }[] = [];

  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    cells.push({ day: d, inMonth: false, date: { year: prevYear, month: prevMonth, day: d } });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true, date: { year, month, day: d } });
  }
  const remainder = 42 - cells.length;
  for (let d = 1; d <= remainder; d++) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    cells.push({ day: d, inMonth: false, date: { year: nextYear, month: nextMonth, day: d } });
  }
  return cells;
}

function isAfterMax(date: CalDate): boolean {
  const d = new Date(date.year, date.month, date.day);
  return d > MAX_DOB_DATE;
}

function isBeforeMin(date: CalDate): boolean {
  return date.year < 1910;
}

export default function SignupScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [tosViewed, setTosViewed] = useState(false);
  const [privacyViewed, setPrivacyViewed] = useState(false);
  const canCheckBox = tosViewed && privacyViewed;
  const [passwordBlurred, setPasswordBlurred] = useState(false);
  const passwordError = passwordBlurred && password.length > 0 && password.length < PASSWORD_MIN_LENGTH;
  const [emailBlurred, setEmailBlurred] = useState(false);
  const emailError = emailBlurred && (email.length === 0 || !EMAIL_REGEX.test(email));

  const [calYear, setCalYear] = useState(MAX_DOB_DATE.getFullYear() - 2);
  const [calMonth, setCalMonth] = useState(MAX_DOB_DATE.getMonth());
  const [selectedCal, setSelectedCal] = useState<CalDate | null>(null);

  const isFormValid = !!(name && email && password.length >= PASSWORD_MIN_LENGTH && gender && dateOfBirth && termsAccepted);

  const handlePickPhoto = useCallback(async () => {
    const granted = await requestPhotoLibraryAccess();
    if (!granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setProfilePhotoUri(result.assets[0].uri);
    }
  }, []);

  const handleContinue = useCallback(async () => {
    if (!isFormValid) return;
    if (!EMAIL_REGEX.test(email)) {
      setEmailBlurred(true);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/send-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        Alert.alert('Error', data.error || 'Failed to send verification code');
        return;
      }
      if (data.emailFailed && data.fallbackCode) {
        Alert.alert('Email Delivery Failed',
          `We couldn't send the email, but your verification code is:\n\n${data.fallbackCode}\n\nPlease copy it before continuing.`,
          [{ text: 'OK' }]);
      } else if (data.devCode) {
        Alert.alert('Development Mode',
          `Your verification code is: ${data.devCode}\n\nCopy this code to verify your email.`,
          [{ text: 'OK' }]);
      }
      navigation.navigate('EmailVerification', {
        name, email, password, gender, dateOfBirth,
        profilePhotoUri: profilePhotoUri || undefined,
      });
    } catch {
      Alert.alert('Error', 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isFormValid, email, name, password, gender, dateOfBirth, profilePhotoUri, navigation]);

  const prevMonth = useCallback(() => {
    setCalMonth(m => {
      if (m === 0) { setCalYear(y => y - 1); return 11; }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setCalMonth(m => {
      if (m === 11) { setCalYear(y => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  const handleDayPress = useCallback((date: CalDate) => {
    if (isAfterMax(date) || isBeforeMin(date)) return;
    setSelectedCal(date);
  }, []);

  const handleConfirmDate = useCallback(() => {
    if (!selectedCal) return;
    const mm = String(selectedCal.month + 1).padStart(2, '0');
    const dd = String(selectedCal.day).padStart(2, '0');
    setDateOfBirth(`${mm}/${dd}/${selectedCal.year}`);
    setShowDatePicker(false);
  }, [selectedCal]);

  const openDatePicker = useCallback(() => {
    setSelectedCal(null);
    setCalYear(MAX_DOB_DATE.getFullYear() - 2);
    setCalMonth(MAX_DOB_DATE.getMonth());
    setShowDatePicker(true);
  }, []);

  const canNavPrev = !(calYear <= 1910 && calMonth === 0);
  const canNavNext = !(calYear > MAX_DOB_DATE.getFullYear() ||
    (calYear === MAX_DOB_DATE.getFullYear() && calMonth >= MAX_DOB_DATE.getMonth()));

  const calCells = buildCalendarGrid(calYear, calMonth);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NavHeader title="Sign up" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.form}>
            <TouchableOpacity style={styles.photoPickerContainer} onPress={handlePickPhoto} testID="button-pick-photo">
              {profilePhotoUri ? (
                <Image source={{ uri: profilePhotoUri }} style={styles.profilePhoto} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="person" size={40} color={Colors.neutral.coolMist} />
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Legal name</Text>
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor={Colors.neutral.coolMist}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                textContentType="name"
                testID="input-name"
                accessibilityLabel="Full name"
              />
              <Text style={styles.helperText}>
                Make sure this matches the name on your government ID.
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Gender</Text>
              <TouchableOpacity
                style={styles.selectInput}
                onPress={() => setShowGenderPicker(true)}
                testID="button-select-gender"
                accessibilityLabel="Select gender"
              >
                <Text style={gender ? styles.selectText : styles.selectPlaceholder}>
                  {gender || 'Please select one'}
                </Text>
                <ChevronDownIcon size={20} color={Colors.neutral.coolMist} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date of birth</Text>
              <TouchableOpacity
                style={styles.selectInput}
                onPress={openDatePicker}
                testID="button-select-dob"
                accessibilityLabel="Select date of birth"
              >
                <Text style={dateOfBirth ? styles.selectText : styles.selectPlaceholder}>
                  {dateOfBirth || 'Birthdate'}
                </Text>
                <ChevronDownIcon size={20} color={Colors.neutral.coolMist} />
              </TouchableOpacity>
              <Text style={styles.helperText}>
                To keep the community safe, we only allow members 18 and up.
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, emailError && styles.emailInputError]}
                placeholder="john.doe@gmail.com"
                placeholderTextColor={Colors.neutral.coolMist}
                value={email}
                onChangeText={(text) => { setEmail(text); setEmailBlurred(false); }}
                onBlur={() => setEmailBlurred(true)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                testID="input-email"
                accessibilityLabel="Email"
              />
              <Text style={[styles.helperText, emailError && styles.emailHelperError]}>
                {emailError ? 'Please enter a valid email address.' : 'We\'ll email you with occasional updates on your communities.'}
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput, passwordError && styles.passwordInputError]}
                  placeholder="Create a password"
                  placeholderTextColor={Colors.neutral.coolMist}
                  value={password}
                  onChangeText={(text) => { setPassword(text); setPasswordBlurred(false); }}
                  onBlur={() => setPasswordBlurred(true)}
                  secureTextEntry={!showPassword}
                  textContentType="newPassword"
                  testID="input-password"
                  accessibilityLabel="Password"
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(v => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  testID="button-toggle-password"
                  accessibilityLabel="Toggle password visibility"
                >
                  {showPassword
                    ? <EyeIcon size={22} color="#969696" />
                    : <EyeOffIcon size={22} color="#969696" />}
                </TouchableOpacity>
              </View>
              <Text
                style={[
                  styles.helperText,
                  styles.passwordHint,
                  passwordError && styles.passwordHintError,
                  password.length >= PASSWORD_MIN_LENGTH && styles.passwordHintMet,
                ]}
                testID="text-password-hint"
              >
                {password.length >= PASSWORD_MIN_LENGTH ? '✓ ' : ''}At least {PASSWORD_MIN_LENGTH} characters
              </Text>
            </View>

            <View style={styles.termsRow}>
              <TouchableOpacity
                onPress={() => canCheckBox && setTermsAccepted(v => !v)}
                activeOpacity={canCheckBox ? 0.7 : 1}
                disabled={!canCheckBox}
                testID="checkbox-terms"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={[
                  styles.checkbox,
                  !canCheckBox && styles.checkboxDisabled,
                  termsAccepted && styles.checkboxChecked,
                ]}>
                  {termsAccepted && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
              </TouchableOpacity>
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text
                  style={styles.termsLink}
                  testID="link-terms-of-service"
                  onPress={() => { setTosViewed(true); navigation.navigate('TermsOfService'); }}
                >
                  Terms of Service
                </Text>
                {' '}and acknowledge the{' '}
                <Text
                  style={styles.termsLink}
                  testID="link-privacy-policy"
                  onPress={() => { setPrivacyViewed(true); navigation.navigate('PrivacyPolicy'); }}
                >
                  Privacy Policy
                </Text>
              </Text>
            </View>
            {!canCheckBox && (
              <Text style={styles.termsHint}>
                Read both links above to enable the checkbox
              </Text>
            )}

            <BubbleButton
              title="Agree & Continue"
              onPress={handleContinue}
              disabled={!isFormValid || loading}
              loading={loading}
              testID="button-continue"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Gender Picker */}
      <Modal visible={showGenderPicker} transparent animationType="slide" onRequestClose={() => setShowGenderPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowGenderPicker(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Gender</Text>
              <TouchableOpacity
                onPress={() => setShowGenderPicker(false)}
                testID="button-close-gender-picker"
                accessibilityLabel="Close gender picker"
              >
                <Ionicons name="close" size={24} color={Colors.brand.midnight} />
              </TouchableOpacity>
            </View>
            {GENDER_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.modalOption}
                onPress={() => { setGender(option); setShowGenderPicker(false); }}
                testID={`option-gender-${option.toLowerCase().replace(/\s+/g, '-')}`}
                accessibilityLabel={option}
              >
                <Text style={[styles.modalOptionText, gender === option && styles.modalOptionSelected]}>
                  {option}
                </Text>
                {gender === option && <Ionicons name="checkmark" size={20} color={Colors.brand.bubbleBlue} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Calendar Date Picker */}
      <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <View style={styles.calOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShowDatePicker(false)} />
          <View style={styles.calModal}>
            <View style={styles.calModalHeader}>
              <TouchableOpacity
                onPress={() => setShowDatePicker(false)}
                style={styles.calBackBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                testID="button-close-date-picker"
                accessibilityLabel="Close date picker"
              >
                <Ionicons name="arrow-back" size={22} color={Colors.brand.midnight} />
              </TouchableOpacity>
              <Text style={styles.calModalTitle}>Date of Birth</Text>
              <View style={styles.calBackBtn} />
            </View>

            <View style={styles.calNavRow}>
              <TouchableOpacity
                onPress={prevMonth}
                disabled={!canNavPrev}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[styles.calNavBtn, !canNavPrev && styles.calNavBtnDisabled]}
                testID="button-prev-month"
                accessibilityLabel="Previous month"
              >
                <Ionicons name="chevron-back" size={20} color={canNavPrev ? Colors.brand.midnight : Colors.neutral.coolMist} />
              </TouchableOpacity>
              <Text style={styles.calMonthYear}>{MONTH_NAMES[calMonth]} {calYear}</Text>
              <TouchableOpacity
                onPress={nextMonth}
                disabled={!canNavNext}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[styles.calNavBtn, !canNavNext && styles.calNavBtnDisabled]}
                testID="button-next-month"
                accessibilityLabel="Next month"
              >
                <Ionicons name="chevron-forward" size={20} color={canNavNext ? Colors.brand.midnight : Colors.neutral.coolMist} />
              </TouchableOpacity>
            </View>

            <View style={styles.calDayHeaders}>
              {DAY_LABELS.map(d => (
                <Text key={d} style={styles.calDayHeader}>{d}</Text>
              ))}
            </View>

            <View style={styles.calGrid}>
              {calCells.map((cell, idx) => {
                const disabled = isAfterMax(cell.date) || isBeforeMin(cell.date);
                const isSelected = !!(selectedCal &&
                  selectedCal.year === cell.date.year &&
                  selectedCal.month === cell.date.month &&
                  selectedCal.day === cell.date.day &&
                  cell.inMonth);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={styles.calCell}
                    onPress={() => cell.inMonth && !disabled && handleDayPress(cell.date)}
                    disabled={!cell.inMonth || disabled}
                    activeOpacity={0.7}
                    testID={`button-day-${cell.date.year}-${cell.date.month + 1}-${cell.date.day}`}
                    accessibilityLabel={`${MONTH_NAMES[cell.date.month]} ${cell.date.day} ${cell.date.year}`}
                  >
                    <View style={[styles.calDayCircle, isSelected && styles.calDayCircleSelected]}>
                      <Text style={[
                        styles.calDayText,
                        !cell.inMonth && styles.calDayTextOtherMonth,
                        disabled && styles.calDayTextDisabled,
                        isSelected && styles.calDayTextSelected,
                      ]}>
                        {cell.day}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.calFooter}>
              <BubbleButton
                title="Confirm"
                onPress={handleConfirmDate}
                disabled={!selectedCal}
                testID="button-confirm-date"
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.secondary },
  keyboardView: { flex: 1 },
  content: { padding: 24, paddingBottom: 40 },
  form: { gap: 24 },
  photoPickerContainer: { alignSelf: 'center', width: 100, height: 100, marginBottom: 8 },
  profilePhoto: { width: 100, height: 100, borderRadius: 50 },
  photoPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.neutral.cloudGrey,
    borderWidth: 2, borderColor: Colors.neutral.coolMist, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.brand.bubbleBlue,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.brand.skyWhite,
  },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.neutral.charcoal },
  input: {
    borderWidth: 1, borderColor: '#969696', borderRadius: 8,
    padding: 16, fontSize: 16,
    backgroundColor: Colors.brand.skyWhite, color: Colors.neutral.charcoal,
  },
  passwordContainer: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeIcon: { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' },
  selectInput: {
    borderWidth: 1, borderColor: '#969696', borderRadius: 8, padding: 16,
    backgroundColor: Colors.brand.skyWhite,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  selectText: { fontSize: 16, color: Colors.neutral.charcoal },
  selectPlaceholder: { fontSize: 16, color: Colors.neutral.coolMist },
  helperText: { fontSize: 12, color: Colors.neutral.coolMist, lineHeight: 16 },
  passwordHint: { marginTop: 6 },
  passwordHintError: { color: Colors.status.error },
  passwordHintMet: { color: Colors.status.success },
  passwordInputError: { borderColor: Colors.status.error },
  emailInputError: { borderColor: Colors.status.error },
  emailHelperError: { color: Colors.status.error },
  termsRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginTop: Spacing.md, marginBottom: Spacing.sm,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 1.5, borderColor: Colors.neutral.coolMist,
    alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.sm, marginTop: 4,
  },
  checkboxDisabled: { opacity: 0.4, borderColor: Colors.neutral.coolMist },
  checkboxChecked: { backgroundColor: Colors.brand.bubbleBlue, borderColor: Colors.brand.bubbleBlue },
  termsText: { flex: 1, fontSize: 13, color: Colors.text.secondary, lineHeight: 18 },
  termsLink: { color: Colors.brand.bubbleBlue, textDecorationLine: 'underline' },
  termsHint: { fontSize: 11, color: Colors.neutral.coolMist, textAlign: 'center', marginTop: -8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#FAFAFA', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: Colors.brand.midnight },
  modalOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#D9D9D9',
  },
  modalOptionText: { fontSize: 16, color: Colors.neutral.charcoal },
  modalOptionSelected: { color: Colors.brand.bubbleBlue, fontWeight: '600' },

  // Calendar
  calOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  calModal: {
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  calModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#EEEEEE',
  },
  calBackBtn: { width: 36, alignItems: 'flex-start' },
  calModalTitle: { fontSize: 17, fontWeight: '600', color: Colors.brand.midnight },
  calNavRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  calNavBtn: { padding: 4 },
  calNavBtnDisabled: { opacity: 0.3 },
  calMonthYear: { fontSize: 16, fontWeight: '600', color: Colors.brand.midnight },
  calDayHeaders: {
    flexDirection: 'row', paddingHorizontal: 12, marginBottom: 4,
  },
  calDayHeader: {
    flex: 1, textAlign: 'center', fontSize: 12,
    fontWeight: '600', color: Colors.neutral.coolMist,
    paddingVertical: 4,
  },
  calGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  calCell: {
    width: `${100 / 7}%` as any,
    aspectRatio: 1,
    alignItems: 'center', justifyContent: 'center',
    padding: 2,
  },
  calDayCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  calDayCircleSelected: { backgroundColor: Colors.brand.bubbleBlue },
  calDayText: { fontSize: 14, color: Colors.brand.midnight, fontWeight: '500' },
  calDayTextOtherMonth: { color: Colors.neutral.coolMist, opacity: 0.4 },
  calDayTextDisabled: { color: Colors.neutral.coolMist, opacity: 0.35 },
  calDayTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  calFooter: { paddingHorizontal: 24, paddingTop: 16 },
});
