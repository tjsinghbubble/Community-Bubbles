import React, { useState, useCallback } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { Colors, Spacing } from '../../styles/theme';
import { NavHeader } from '../../components/ScreenHeader';
import BubbleButton from '../../components/BubbleButton';
import { ChevronDownIcon } from '../../components/icons';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'SocialProfile'>;
  route: RouteProp<AuthStackParamList, 'SocialProfile'>;
};

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

const MAX_DOB_DATE = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d;
})();

const MIN_DOB_DATE = new Date(1910, 0, 1);

const DEFAULT_PICKER_DATE = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 22);
  return d;
})();

export default function SocialProfileScreen({ navigation, route }: Props) {
  const { prefillName, token } = route.params;
  const { updateSocialUser } = useAuth();

  const [name, setName] = useState(prefillName || '');
  const [gender, setGender] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(DEFAULT_PICKER_DATE);
  const [loading, setLoading] = useState(false);

  const isFormValid = !!(name.trim() && gender && dateOfBirth);

  const handleConfirmDate = useCallback(() => {
    const mm = String(pickerDate.getMonth() + 1).padStart(2, '0');
    const dd = String(pickerDate.getDate()).padStart(2, '0');
    setDateOfBirth(`${mm}/${dd}/${pickerDate.getFullYear()}`);
    setShowDatePicker(false);
  }, [pickerDate]);

  const handleContinue = useCallback(async () => {
    if (!isFormValid) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/complete-social-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim(), gender, dateOfBirth }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save profile');

      // Update the local user with the completed name
      if (updateSocialUser) {
        updateSocialUser({ name: name.trim() });
      }

      navigation.navigate('Interests', {
        name: name.trim(),
        email: '',
        password: '',
        gender,
        dateOfBirth,
        isSocialSignup: true,
        socialToken: token,
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isFormValid, name, gender, dateOfBirth, token, navigation, updateSocialUser]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NavHeader title="About You" onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.subtitle}>
            Just a few details to set up your account.
          </Text>

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
                onPress={() => setShowDatePicker(true)}
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
              <TouchableOpacity
                onPress={() => setShowGenderPicker(false)}
                testID="button-close-gender-picker"
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
              >
                <Text style={[styles.modalOptionText, gender === option && styles.modalOptionSelected]}>
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
        <View style={styles.calOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setShowDatePicker(false)}
          />
          <View style={styles.calModal}>
            <View style={styles.calModalHeader}>
              <TouchableOpacity
                onPress={() => setShowDatePicker(false)}
                style={styles.calBackBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                testID="button-close-date-picker"
              >
                <Ionicons name="arrow-back" size={22} color={Colors.brand.midnight} />
              </TouchableOpacity>
              <Text style={styles.calModalTitle}>Date of Birth</Text>
              <View style={styles.calBackBtn} />
            </View>
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display="spinner"
              onChange={(_event, date) => { if (date) setPickerDate(date); }}
              maximumDate={MAX_DOB_DATE}
              minimumDate={MIN_DOB_DATE}
              themeVariant="light"
              style={styles.spinner}
            />
            <View style={styles.calFooter}>
              <BubbleButton
                title="Confirm"
                onPress={handleConfirmDate}
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
  flex: { flex: 1 },
  content: { padding: 24, paddingBottom: 40 },
  subtitle: {
    fontSize: 15,
    color: Colors.neutral.coolMist,
    marginBottom: 24,
    lineHeight: 22,
  },
  form: { gap: 24 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.neutral.charcoal },
  input: {
    borderWidth: 1,
    borderColor: '#969696',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: Colors.brand.skyWhite,
    color: Colors.neutral.charcoal,
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
  selectText: { fontSize: 16, color: Colors.neutral.charcoal },
  selectPlaceholder: { fontSize: 16, color: Colors.neutral.coolMist },
  helperText: { fontSize: 12, color: Colors.neutral.coolMist, lineHeight: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
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
  modalTitle: { fontSize: 18, fontWeight: '600', color: Colors.brand.midnight },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#D9D9D9',
  },
  modalOptionText: { fontSize: 16, color: Colors.neutral.charcoal },
  modalOptionSelected: { color: Colors.brand.bubbleBlue, fontWeight: '600' },
  calOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  calModal: {
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  calModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  calBackBtn: { width: 36, alignItems: 'flex-start' },
  calModalTitle: { fontSize: 17, fontWeight: '600', color: Colors.brand.midnight },
  spinner: { width: '100%' },
  calFooter: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 },
});
