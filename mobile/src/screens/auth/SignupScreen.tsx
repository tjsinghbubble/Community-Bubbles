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
  Keyboard,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../config/api';
import { Colors, Spacing, Radius, Typography } from '../../styles/theme';
import BubbleButton from '../../components/BubbleButton';
import { EyeIcon, EyeOffIcon, ChevronDownIcon } from '../../components/icons';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Signup'>;
};

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

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
  
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');

  const dayRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  const isFormValid = name && email && password && gender && dateOfBirth && termsAccepted;

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
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDateConfirm = () => {
    if (birthMonth && birthDay && birthYear) {
      setDateOfBirth(`${birthMonth}/${birthDay}/${birthYear}`);
      setShowDatePicker(false);
    }
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
                {' '}and{' '}
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
          <TouchableOpacity activeOpacity={1} style={styles.modalContent} onPress={() => {}}>

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Date of Birth</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Ionicons name="close" size={24} color={Colors.brand.midnight} />
              </TouchableOpacity>
            </View>
            <View style={styles.dateInputRow}>
              <TextInput
                style={styles.dateInput}
                placeholder="MM"
                placeholderTextColor="#969696"
                value={birthMonth}
                onChangeText={(text) => {
                  const val = text.replace(/[^0-9]/g, '').slice(0, 2);
                  setBirthMonth(val);
                  if (val.length === 2) {
                    Keyboard.dismiss();
                    const m = parseInt(val, 10);
                    if (m < 1 || m > 12) {
                      Alert.alert('Invalid Month', 'Month must be between 01 and 12.');
                      setBirthMonth('');
                    }
                  }
                }}
                keyboardType="number-pad"
                maxLength={2}
              />
              <TextInput
                ref={dayRef}
                style={styles.dateInput}
                placeholder="DD"
                placeholderTextColor="#969696"
                value={birthDay}
                onChangeText={(text) => {
                  const val = text.replace(/[^0-9]/g, '').slice(0, 2);
                  setBirthDay(val);
                  if (val.length === 2) {
                    Keyboard.dismiss();
                    const d = parseInt(val, 10);
                    const m = birthMonth ? parseInt(birthMonth, 10) : 0;
                    const maxDays = m >= 1 && m <= 12 ? new Date(2000, m, 0).getDate() : 31;
                    if (d < 1 || d > maxDays) {
                      Alert.alert('Invalid Day', `Day must be between 01 and ${maxDays}.`);
                      setBirthDay('');
                    }
                  }
                }}
                keyboardType="number-pad"
                maxLength={2}
              />
              <TextInput
                ref={yearRef}
                style={[styles.dateInput, { flex: 1.5 }]}
                placeholder="YYYY"
                placeholderTextColor="#969696"
                value={birthYear}
                onChangeText={(text) => {
                  const val = text.replace(/[^0-9]/g, '').slice(0, 4);
                  setBirthYear(val);
                  if (val.length === 4) {
                    Keyboard.dismiss();
                    const y = parseInt(val, 10);
                    const m = parseInt(birthMonth, 10);
                    const d = parseInt(birthDay, 10);

                    if (y < 1900) {
                      Alert.alert('Invalid Year', 'Year must be 1900 or later.');
                      setBirthYear('');
                      return;
                    }

                    const today = new Date();
                    const dob = new Date(y, m - 1, d);

                    if (dob > today) {
                      Alert.alert('Invalid Date', 'Date of birth cannot be in the future.');
                      setBirthYear('');
                      return;
                    }

                    const daysInMonth = new Date(y, m, 0).getDate();
                    if (d > daysInMonth) {
                      Alert.alert('Invalid Day', `${birthMonth}/${birthDay} is not a valid date in ${val}.`);
                      setBirthDay('');
                      return;
                    }

                    let age = today.getFullYear() - dob.getFullYear();
                    const monthDiff = today.getMonth() - dob.getMonth();
                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
                      age--;
                    }

                    if (age < 18) {
                      Alert.alert('Age Requirement', 'You must be at least 18 years old to sign up.');
                      setBirthYear('');
                      return;
                    }

                    setDateOfBirth(`${birthMonth}/${birthDay}/${val}`);
                    setTimeout(() => setShowDatePicker(false), 2000);
                  }
                }}
                keyboardType="number-pad"
                maxLength={4}
              />
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
  button: {
    borderRadius: Radius.full,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  dateInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#969696',
    borderRadius: 8,
    height: 57,
    paddingHorizontal: 8,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: Colors.brand.midnight,
    textAlign: 'center',
  },
  modalButton: {
    borderRadius: Radius.full,
    padding: 16,
    alignItems: 'center',
  },
});
