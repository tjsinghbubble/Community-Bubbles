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
import DateTimePicker from '@react-native-community/datetimepicker';
import { API_URL } from '../../config/api';
import { Colors, Spacing, Radius } from '../../styles/theme';
import { NavHeader } from '../../components/ScreenHeader';
import BubbleButton from '../../components/BubbleButton';
import { EyeIcon, EyeOffIcon, ChevronDownIcon } from '../../components/icons';
import { requestPhotoLibraryAccess } from '../../utils/permissions';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Signup'>;
};

const PASSWORD_MIN_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

const MAX_DOB_DATE = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d;
})();

const MIN_DOB_DATE = new Date(1910, 0, 1);

function formatDOB(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
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

  // Spinner date picker state — default to 22 years ago so wheel feels natural
  const defaultPickerDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 22);
    return d;
  })();
  const [pickerDate, setPickerDate] = useState<Date>(defaultPickerDate);

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
        Alert.alert('Check your email',
          `Your verification code is: ${data.devCode}`,
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

  const handleConfirmDate = useCallback(() => {
    setDateOfBirth(formatDOB(pickerDate));
    setShowDatePicker(false);
  }, [pickerDate]);

  const openDatePicker = useCallback(() => {
    setShowDatePicker(true);
  }, []);

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
              />
              <Text style={styles.helperText}>
                Make sure this matches the name on your government ID.
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Gender</Text>
              <TouchableOpacity style={styles.selectInput} onPress={() => setShowGenderPicker(true)}>
                <Text style={gender ? styles.selectText : styles.selectPlaceholder}>
                  {gender || 'Please select one'}
                </Text>
                <ChevronDownIcon size={20} color={Colors.neutral.coolMist} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date of birth</Text>
              <TouchableOpacity style={styles.selectInput} onPress={openDatePicker} testID="button-dob">
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
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(v => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
                <Text style={styles.termsLink} onPress={() => { setTosViewed(true); navigation.navigate('TermsOfService'); }}>
                  Terms of Service
                </Text>
                {' '}and acknowledge the{' '}
                <Text style={styles.termsLink} onPress={() => { setPrivacyViewed(true); navigation.navigate('PrivacyPolicy'); }}>
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
              <TouchableOpacity onPress={() => setShowGenderPicker(false)}>
                <Ionicons name="close" size={24} color={Colors.brand.midnight} />
              </TouchableOpacity>
            </View>
            {GENDER_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.modalOption}
                onPress={() => { setGender(option); setShowGenderPicker(false); }}
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

      {/* Date of Birth — native 3-wheel spinner */}
      <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <View style={styles.dobOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShowDatePicker(false)} />
          <View style={styles.dobSheet}>
            <View style={styles.dobHeader}>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.dobCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.dobTitle}>Date of Birth</Text>
              <TouchableOpacity onPress={handleConfirmDate} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.dobDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display="spinner"
              maximumDate={MAX_DOB_DATE}
              minimumDate={MIN_DOB_DATE}
              onChange={(_event, selectedDate) => {
                if (selectedDate) setPickerDate(selectedDate);
              }}
              textColor={Colors.brand.midnight}
              style={styles.spinner}
            />
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

  // DOB scroll-wheel sheet
  dobOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  dobSheet: {
    backgroundColor: '#F8F8F8',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  dobHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D9D9D9',
  },
  dobTitle: { fontSize: 16, fontWeight: '600', color: Colors.brand.midnight },
  dobCancelText: { fontSize: 16, color: Colors.neutral.coolMist },
  dobDoneText: { fontSize: 16, fontWeight: '600', color: Colors.brand.bubbleBlue },
  spinner: { width: '100%', height: 216 },
});
