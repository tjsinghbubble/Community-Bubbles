import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Modal,
  Alert,
  Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { API_URL } from '../../config/api';
import { Colors, Spacing, Radius, Typography } from '../../styles/theme';
import BubbleButton from '../../components/BubbleButton';
import { EyeIcon, EyeOffIcon, ChevronDownIcon } from '../../components/icons';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Signup'>;
};

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  return days;
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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear() - 20);
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const isFormValid = name && email && password && gender && dateOfBirth && termsAccepted;

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library to add a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setProfilePhotoUri(result.assets[0].uri);
    }
  };

  const handleContinue = async () => {
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

      if (data.devCode) {
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
  };

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(calYear - 1);
    } else {
      setCalMonth(calMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(calYear + 1);
    } else {
      setCalMonth(calMonth + 1);
    }
  };

  const handleDaySelect = (day: number) => {
    const dob = new Date(calYear, calMonth, day);
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

    setSelectedDate(dob);
    const mm = String(calMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    setDateOfBirth(`${mm}/${dd}/${calYear}`);
    setTimeout(() => setShowDatePicker(false), 300);
  };

  const calendarDays = getCalendarDays(calYear, calMonth);
  const isSelectedDay = (day: number) => {
    if (!selectedDate) return false;
    return selectedDate.getFullYear() === calYear && selectedDate.getMonth() === calMonth && selectedDate.getDate() === day;
  };

  const isTodayDay = (day: number) => {
    return today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === day;
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.brand.midnight} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sign up</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
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
                onPress={() => setShowDatePicker(true)}
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
              />
              <Text style={styles.helperText}>
                We'll email you with occasional updates on your communities.
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, { paddingRight: 48 }]}
                  placeholder="Create a password"
                  placeholderTextColor={Colors.neutral.coolMist}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeIcon size={22} color="#969696" /> : <EyeOffIcon size={22} color="#969696" />}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setTermsAccepted(!termsAccepted)}
              activeOpacity={0.7}
              testID="checkbox-terms"
            >
              <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                {termsAccepted && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
              </View>
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text
                  style={styles.termsLink}
                  onPress={() => navigation.navigate('TermsOfService')}
                >
                  Terms of Service
                </Text>
                {' '}and acknowledge the{' '}
                <Text
                  style={styles.termsLink}
                  onPress={() => navigation.navigate('PrivacyPolicy')}
                >
                  Privacy Policy
                </Text>
              </Text>
            </TouchableOpacity>

            <BubbleButton
              title="Continue"
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
        onRequestClose={() => setShowGenderPicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowGenderPicker(false)}
        >
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
        onRequestClose={() => setShowDatePicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDatePicker(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.calendarModalContent} onPress={() => {}}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.calendarBackButton}>
                <Ionicons name="arrow-back" size={22} color={Colors.brand.midnight} />
              </TouchableOpacity>
              <Text style={styles.calendarTitle}>Date of Birth</Text>
              <View style={{ width: 32 }} />
            </View>

            <View style={styles.calendarNav}>
              <TouchableOpacity onPress={handlePrevMonth}>
                <Text style={styles.calendarMonthLabel}>{MONTH_NAMES[calMonth]} {calYear} {'>'}</Text>
              </TouchableOpacity>
              <View style={styles.calendarArrows}>
                <TouchableOpacity onPress={handlePrevMonth} style={styles.calendarArrowButton}>
                  <Ionicons name="chevron-back" size={20} color={Colors.brand.bubbleBlue} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleNextMonth} style={styles.calendarArrowButton}>
                  <Ionicons name="chevron-forward" size={20} color={Colors.brand.bubbleBlue} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.calendarGrid}>
              {DAYS_OF_WEEK.map((d) => (
                <View key={d} style={styles.calendarDayHeader}>
                  <Text style={styles.calendarDayHeaderText}>{d}</Text>
                </View>
              ))}
              {calendarDays.map((day, idx) => (
                <View key={idx} style={styles.calendarDayCell}>
                  {day !== null ? (
                    <TouchableOpacity
                      style={[
                        styles.calendarDay,
                        isSelectedDay(day) && styles.calendarDaySelected,
                        isTodayDay(day) && !isSelectedDay(day) && styles.calendarDayToday,
                      ]}
                      onPress={() => handleDaySelect(day)}
                    >
                      <Text style={[
                        styles.calendarDayText,
                        isSelectedDay(day) && styles.calendarDayTextSelected,
                        isTodayDay(day) && !isSelectedDay(day) && styles.calendarDayTextToday,
                      ]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.skyWhite,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand.midnight,
  },
  headerSpacer: {
    width: 40,
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
    marginTop: 1,
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
  calendarModalContent: {
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  calendarBackButton: {
    padding: 4,
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.brand.midnight,
  },
  calendarNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarMonthLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.brand.midnight,
  },
  calendarArrows: {
    flexDirection: 'row',
    gap: 16,
  },
  calendarArrowButton: {
    padding: 4,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayHeader: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  calendarDayHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.neutral.coolMist,
  },
  calendarDayCell: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: 6,
  },
  calendarDay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDaySelected: {
    backgroundColor: Colors.brand.bubbleBlue,
  },
  calendarDayToday: {
    backgroundColor: Colors.brand.bubbleBlue + '20',
  },
  calendarDayText: {
    fontSize: 15,
    color: Colors.brand.midnight,
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  calendarDayTextToday: {
    color: Colors.brand.bubbleBlue,
    fontWeight: '600',
  },
});
