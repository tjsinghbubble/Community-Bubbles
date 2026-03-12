import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
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
import { requestPhotoLibraryAccess } from '../../utils/permissions';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Signup'>;
};

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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
  const [tosViewed, setTosViewed] = useState(false);
  const [privacyViewed, setPrivacyViewed] = useState(false);
  const pendingTosView = useRef(false);
  const pendingPrivacyView = useRef(false);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);

  const canCheckBox = tosViewed && privacyViewed;

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (pendingTosView.current) {
        setTosViewed(true);
        pendingTosView.current = false;
      }
      if (pendingPrivacyView.current) {
        setPrivacyViewed(true);
        pendingPrivacyView.current = false;
      }
    });
    return unsubscribe;
  }, [navigation]);

  const today = new Date();
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear() - 20);
  const [selectedDate, setSelectedDate] = useState<{ day: number; month: number; year: number } | null>(null);

  const isFormValid = name && email && password && gender && dateOfBirth && termsAccepted;

  const handlePickPhoto = async () => {
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

  const YEAR_MIN = 1910;
  const YEAR_MAX = today.getFullYear() - 18;
  const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const getCalendarDays = (month: number, year: number) => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  };

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      if (calYear > YEAR_MIN) { setCalMonth(11); setCalYear(calYear - 1); }
    } else {
      setCalMonth(calMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      if (calYear < YEAR_MAX) { setCalMonth(0); setCalYear(calYear + 1); }
    } else {
      setCalMonth(calMonth + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    setSelectedDate({ day, month: calMonth, year: calYear });
  };

  const handleConfirmDate = () => {
    if (!selectedDate) return;
    const { day, month, year } = selectedDate;
    const dob = new Date(year, month, day);
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

    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    setDateOfBirth(`${mm}/${dd}/${year}`);
    setShowDatePicker(false);
  };

  const calendarDays = getCalendarDays(calMonth, calYear);

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

            <View style={styles.termsRow}>
              <TouchableOpacity
                onPress={() => setTermsAccepted(!termsAccepted)}
                disabled={!canCheckBox}
                activeOpacity={0.7}
                testID="checkbox-terms"
              >
                <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked, !canCheckBox && styles.checkboxDisabled]}>
                  {termsAccepted && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
              </TouchableOpacity>
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text
                  style={[styles.termsLink, tosViewed && styles.termsLinkViewed]}
                  onPress={() => { pendingTosView.current = true; navigation.navigate('TermsOfService'); }}
                >
                  Terms of Service
                </Text>
                {' '}and acknowledge the{' '}
                <Text
                  style={[styles.termsLink, privacyViewed && styles.termsLinkViewed]}
                  onPress={() => { pendingPrivacyView.current = true; navigation.navigate('PrivacyPolicy'); }}
                >
                  Privacy Policy
                </Text>
              </Text>
            </View>

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
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.calOverlay}>
          <Pressable style={styles.calBackdrop} onPress={() => setShowDatePicker(false)} />
          <View style={styles.calModal}>
            <View style={styles.calHeader}>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.calBackBtn}>
                <Ionicons name="arrow-back" size={22} color={Colors.brand.midnight} />
              </TouchableOpacity>
              <Text style={styles.calTitle}>Date of Birth</Text>
              <View style={{ width: 38 }} />
            </View>

            <View style={styles.calNav}>
              <TouchableOpacity onPress={handlePrevMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-back" size={22} color={Colors.brand.midnight} />
              </TouchableOpacity>
              <Text style={styles.calMonthYear}>{MONTH_NAMES[calMonth]} {calYear}</Text>
              <TouchableOpacity onPress={handleNextMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-forward" size={22} color={Colors.brand.midnight} />
              </TouchableOpacity>
            </View>

            <View style={styles.calDayHeaders}>
              {DAY_LABELS.map((d) => (
                <Text key={d} style={styles.calDayHeaderText}>{d}</Text>
              ))}
            </View>

            <View style={styles.calGrid}>
              {calendarDays.map((day, idx) => {
                if (day === null) {
                  return <View key={`empty-${idx}`} style={styles.calCell} />;
                }
                const isSelected = selectedDate && selectedDate.day === day && selectedDate.month === calMonth && selectedDate.year === calYear;
                return (
                  <TouchableOpacity
                    key={`day-${day}`}
                    style={[styles.calCell, isSelected && styles.calCellSelected]}
                    onPress={() => handleSelectDay(day)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.calDayText, isSelected && styles.calDayTextSelected]}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.calConfirmBtn, !selectedDate && styles.calConfirmBtnDisabled]}
              onPress={handleConfirmDate}
              disabled={!selectedDate}
            >
              <Text style={styles.calConfirmText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    marginTop: 4,
  },
  checkboxChecked: {
    backgroundColor: Colors.brand.bubbleBlue,
    borderColor: Colors.brand.bubbleBlue,
  },
  checkboxDisabled: {
    opacity: 0.5,
    borderColor: Colors.neutral.coolMist,
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
  termsLinkViewed: {
    color: '#2B8AD0',
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
  calOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  calModal: {
    backgroundColor: '#FAFAFA',
    borderRadius: 24,
    marginHorizontal: 20,
    alignSelf: 'stretch',
    paddingBottom: 20,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  calBackBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand.midnight,
  },
  calNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  calMonthYear: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand.midnight,
  },
  calDayHeaders: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  calDayHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: Colors.neutral.coolMist,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  calCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calCellSelected: {
    backgroundColor: Colors.brand.bubbleBlue,
    borderRadius: 100,
  },
  calDayText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.brand.midnight,
  },
  calDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  calConfirmBtn: {
    backgroundColor: Colors.brand.bubbleBlue,
    borderRadius: 100,
    paddingVertical: 14,
    marginHorizontal: 20,
    marginTop: 12,
    alignItems: 'center',
  },
  calConfirmBtnDisabled: {
    backgroundColor: Colors.neutral.coolMist,
  },
  calConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
