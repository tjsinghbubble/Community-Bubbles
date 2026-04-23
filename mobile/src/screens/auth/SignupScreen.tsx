import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
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
import { Colors, Spacing, Radius, Typography } from '../../styles/theme';
import { NavHeader } from '../../components/ScreenHeader';
import BubbleButton from '../../components/BubbleButton';
import { EyeIcon, EyeOffIcon, ChevronDownIcon } from '../../components/icons';
import { requestPhotoLibraryAccess } from '../../utils/permissions';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Signup'>;
};

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const PICKER_ITEM_HEIGHT = 36;
const PICKER_VISIBLE_COUNT = 5;
const PICKER_HEIGHT = PICKER_ITEM_HEIGHT * PICKER_VISIBLE_COUNT;
const PICKER_PADDING = PICKER_ITEM_HEIGHT * 2;
const YEAR_MIN = 1910;
const YEAR_MAX = new Date().getFullYear() - 18;

const DAYS_LIST: number[] = Array.from({ length: 31 }, (_, i) => i + 1);
const YEARS_LIST: number[] = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i);

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

  const initialYear = YEAR_MAX - 20 > YEAR_MIN ? YEAR_MAX - 20 : YEAR_MIN + 30;
  const [pickerDay, setPickerDay] = useState(15);
  const [pickerMonth, setPickerMonth] = useState(5);
  const [pickerYear, setPickerYear] = useState(initialYear);

  const dayScrollRef = useRef<ScrollView>(null);
  const monthScrollRef = useRef<ScrollView>(null);
  const yearScrollRef = useRef<ScrollView>(null);

  const isFormValid = !!(name && email && password && gender && dateOfBirth && termsAccepted);

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
        Alert.alert(
          'Email Delivery Failed',
          `We couldn't send the email, but your verification code is:\n\n${data.fallbackCode}\n\nPlease copy it before continuing.`,
          [{ text: 'OK' }]
        );
      } else if (data.devCode) {
        Alert.alert(
          'Development Mode',
          `Your verification code is: ${data.devCode}\n\nCopy this code to verify your email.`,
          [{ text: 'OK' }]
        );
      }

      navigation.navigate('EmailVerification', {
        name,
        email,
        password,
        gender,
        dateOfBirth,
        profilePhotoUri: profilePhotoUri || undefined,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isFormValid, email, name, password, gender, dateOfBirth, profilePhotoUri, navigation]);

  const scrollToValue = useCallback((ref: React.RefObject<ScrollView>, index: number) => {
    setTimeout(() => {
      ref.current?.scrollTo({ y: index * PICKER_ITEM_HEIGHT, animated: false });
    }, 50);
  }, []);

  useEffect(() => {
    if (showDatePicker) {
      scrollToValue(dayScrollRef as React.RefObject<ScrollView>, pickerDay - 1);
      scrollToValue(monthScrollRef as React.RefObject<ScrollView>, pickerMonth);
      scrollToValue(yearScrollRef as React.RefObject<ScrollView>, pickerYear - YEAR_MIN);
    }
  }, [showDatePicker]);

  const handlePickerScroll = useCallback((
    e: any,
    setter: (v: number) => void,
    offset: number,
  ) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.round(y / PICKER_ITEM_HEIGHT);
    setter(idx + offset);
  }, []);

  const handleConfirmDate = useCallback(() => {
    const maxDay = new Date(pickerYear, pickerMonth + 1, 0).getDate();
    const day = Math.min(pickerDay, maxDay);
    const dob = new Date(pickerYear, pickerMonth, day);
    const todayDate = new Date();

    if (dob > todayDate) {
      Alert.alert('Invalid Date', 'Date of birth cannot be in the future.');
      return;
    }

    let age = todayDate.getFullYear() - dob.getFullYear();
    const monthDiff = todayDate.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && todayDate.getDate() < dob.getDate())) {
      age--;
    }

    if (age < 18) {
      Alert.alert('Age Requirement', 'You must be at least 18 years old to sign up.');
      return;
    }

    const mm = String(pickerMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    setDateOfBirth(`${mm}/${dd}/${pickerYear}`);
    setShowDatePicker(false);
  }, [pickerDay, pickerMonth, pickerYear]);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);
  const togglePassword = useCallback(() => setShowPassword(v => !v), []);
  const openGenderPicker = useCallback(() => setShowGenderPicker(true), []);
  const closeGenderPicker = useCallback(() => setShowGenderPicker(false), []);
  const openDatePicker = useCallback(() => setShowDatePicker(true), []);
  const closeDatePicker = useCallback(() => setShowDatePicker(false), []);
  const toggleTerms = useCallback(() => setTermsAccepted(v => !v), []);
  const goToTerms = useCallback(() => navigation.navigate('TermsOfService'), [navigation]);
  const goToPrivacy = useCallback(() => navigation.navigate('PrivacyPolicy'), [navigation]);

  const renderWheelColumn = (
    data: (string | number)[],
    selectedIndex: number,
    scrollRef: React.RefObject<ScrollView>,
    onSelect: (e: any) => void,
    flex: number,
    align: 'flex-start' | 'center' | 'flex-end' = 'center',
  ) => (
    <View style={[styles.wheelColumn, { flex }]}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={PICKER_ITEM_HEIGHT}
        decelerationRate="fast"
        nestedScrollEnabled
        onMomentumScrollEnd={onSelect}
        onScrollEndDrag={onSelect}
        contentContainerStyle={{ paddingVertical: PICKER_PADDING }}
        style={{ height: PICKER_HEIGHT }}
      >
        {data.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          const distance = Math.abs(idx - selectedIndex);
          const opacity = isSelected ? 1 : distance === 1 ? 0.5 : 0.25;
          return (
            <View key={idx} style={[styles.wheelItem, { alignItems: align }]}>
              <Text style={{
                fontSize: isSelected ? 16 : 14,
                fontWeight: isSelected ? '600' : '400',
                color: Colors.brand.midnight,
                opacity,
                fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
              }}>
                {item}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );

  const dayScrollHandler = useCallback(
    (e: any) => handlePickerScroll(e, setPickerDay, 1),
    [handlePickerScroll],
  );
  const monthScrollHandler = useCallback(
    (e: any) => handlePickerScroll(e, setPickerMonth, 0),
    [handlePickerScroll],
  );
  const yearScrollHandler = useCallback(
    (e: any) => handlePickerScroll(e, (v: number) => setPickerYear(v + YEAR_MIN), 0),
    [handlePickerScroll],
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NavHeader title="Sign up" onBack={handleBack} />
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
              <TouchableOpacity
                style={styles.selectInput}
                onPress={openGenderPicker}
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
                style={styles.input}
                placeholder="john.doe@gmail.com"
                placeholderTextColor={Colors.neutral.coolMist}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
              />
              <Text style={styles.helperText}>
                We'll email you with occasional updates on your communities.
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Create a password"
                  placeholderTextColor={Colors.neutral.coolMist}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  textContentType="newPassword"
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={togglePassword}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {showPassword
                    ? <EyeIcon size={22} color="#969696" />
                    : <EyeOffIcon size={22} color="#969696" />}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.termsRow}>
              <TouchableOpacity
                onPress={toggleTerms}
                activeOpacity={0.7}
                testID="checkbox-terms"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                  {termsAccepted && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
              </TouchableOpacity>
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text style={styles.termsLink} onPress={goToTerms}>
                  Terms of Service
                </Text>
                {' '}and acknowledge the{' '}
                <Text style={styles.termsLink} onPress={goToPrivacy}>
                  Privacy Policy
                </Text>
              </Text>
            </View>

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

      <Modal
        visible={showGenderPicker}
        transparent
        animationType="slide"
        onRequestClose={closeGenderPicker}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeGenderPicker}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Gender</Text>
              <TouchableOpacity onPress={closeGenderPicker}>
                <Ionicons name="close" size={24} color={Colors.brand.midnight} />
              </TouchableOpacity>
            </View>
            {GENDER_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.modalOption}
                onPress={() => {
                  setGender(option);
                  setShowGenderPicker(false);
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  gender === option && styles.modalOptionSelected
                ]}>
                  {option}
                </Text>
                {gender === option && (
                  <Ionicons name="checkmark" size={20} color={Colors.brand.bubbleBlue} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showDatePicker}
        transparent
        animationType="slide"
        onRequestClose={closeDatePicker}
      >
        <View style={styles.wheelOverlay}>
          <Pressable style={styles.wheelBackdrop} onPress={closeDatePicker} />
          <View style={styles.wheelModalContent}>
            <View style={styles.wheelHeader}>
              <TouchableOpacity onPress={closeDatePicker} style={styles.wheelHeaderButton}>
                <Text style={styles.wheelCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.wheelTitle}>Date of Birth</Text>
              <TouchableOpacity onPress={handleConfirmDate} style={styles.wheelHeaderButton}>
                <Text style={styles.wheelDoneText}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.wheelContainer}>
              <View style={[styles.wheelHighlight, { top: PICKER_PADDING + 3 }]} pointerEvents="none" />

              {renderWheelColumn(
                DAYS_LIST,
                pickerDay - 1,
                dayScrollRef as React.RefObject<ScrollView>,
                dayScrollHandler,
                1,
                'flex-start',
              )}

              {renderWheelColumn(
                MONTH_NAMES,
                pickerMonth,
                monthScrollRef as React.RefObject<ScrollView>,
                monthScrollHandler,
                2,
                'center',
              )}

              {renderWheelColumn(
                YEARS_LIST,
                pickerYear - YEAR_MIN,
                yearScrollRef as React.RefObject<ScrollView>,
                yearScrollHandler,
                1.2,
                'flex-end',
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.coolMist,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  form: {
    gap: 24,
  },
  photoPickerContainer: {
    alignSelf: 'center',
    width: 100,
    height: 100,
    marginBottom: 8,
  },
  profilePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.neutral.cloudGrey,
    borderWidth: 2,
    borderColor: Colors.neutral.coolMist,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.brand.bubbleBlue,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.brand.skyWhite,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
  },
  input: {
    borderWidth: 1,
    borderColor: '#969696',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: Colors.brand.skyWhite,
    color: Colors.neutral.charcoal,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  selectInput: {
    borderWidth: 1,
    borderColor: '#969696',
    borderRadius: 8,
    padding: 16,
    backgroundColor: Colors.brand.skyWhite,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectText: {
    fontSize: 16,
    color: Colors.neutral.charcoal,
  },
  selectPlaceholder: {
    fontSize: 16,
    color: Colors.neutral.coolMist,
  },
  helperText: {
    fontSize: 12,
    color: Colors.neutral.coolMist,
    lineHeight: 16,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.neutral.coolMist,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    marginTop: 4,
  },
  checkboxChecked: {
    backgroundColor: Colors.brand.bubbleBlue,
    borderColor: Colors.brand.bubbleBlue,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  termsLink: {
    color: Colors.brand.bubbleBlue,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.brand.midnight,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#D9D9D9',
  },
  modalOptionText: {
    fontSize: 16,
    color: Colors.neutral.charcoal,
  },
  modalOptionSelected: {
    color: Colors.brand.bubbleBlue,
    fontWeight: '600',
  },
  wheelOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  wheelModalContent: {
    backgroundColor: '#FAFAFA',
    borderRadius: 20,
    marginHorizontal: 24,
    alignSelf: 'stretch',
    paddingBottom: 20,
  },
  wheelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  wheelHeaderButton: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  wheelCancelText: {
    fontSize: 14,
    color: Colors.neutral.coolMist,
    fontWeight: '500',
  },
  wheelTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand.midnight,
  },
  wheelDoneText: {
    fontSize: 14,
    color: Colors.brand.bubbleBlue,
    fontWeight: '600',
  },
  wheelContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  wheelColumn: {
    overflow: 'hidden',
    paddingHorizontal: 2,
  },
  wheelItem: {
    height: 36,
    justifyContent: 'center',
    alignContent: 'center',
    paddingHorizontal: 8,
  },
  wheelHighlight: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 36,
    backgroundColor: Colors.brand.bubbleBlue + '20',
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
});
