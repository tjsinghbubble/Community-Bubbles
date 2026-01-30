import React, { useState } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../config/api';

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
  
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');

  const isFormValid = name && email && password && gender && dateOfBirth;

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
            <Ionicons name="arrow-back" size={24} color="#000" />
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
                placeholderTextColor="#999"
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
                <Ionicons name="chevron-down" size={20} color="#666" />
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
                <Ionicons name="chevron-down" size={20} color="#666" />
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
                placeholderTextColor="#999"
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
              <TextInput
                style={styles.input}
                placeholder="Create a password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                (!isFormValid || loading) && styles.buttonDisabled,
              ]}
              onPress={handleContinue}
              disabled={!isFormValid || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Continue</Text>
              )}
            </TouchableOpacity>
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
                <Ionicons name="close" size={24} color="#000" />
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
                  <Ionicons name="checkmark" size={20} color="hsl(210, 95%, 55%)" />
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Date of Birth</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <View style={styles.dateInputRow}>
              <View style={styles.dateInputGroup}>
                <Text style={styles.dateLabel}>Month</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="MM"
                  placeholderTextColor="#999"
                  value={birthMonth}
                  onChangeText={(text) => setBirthMonth(text.slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              <View style={styles.dateInputGroup}>
                <Text style={styles.dateLabel}>Day</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="DD"
                  placeholderTextColor="#999"
                  value={birthDay}
                  onChangeText={(text) => setBirthDay(text.slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              <View style={styles.dateInputGroup}>
                <Text style={styles.dateLabel}>Year</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="YYYY"
                  placeholderTextColor="#999"
                  value={birthYear}
                  onChangeText={(text) => setBirthYear(text.slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.modalButton,
                (!birthMonth || !birthDay || !birthYear) && styles.buttonDisabled
              ]}
              onPress={handleDateConfirm}
              disabled={!birthMonth || !birthDay || !birthYear}
            >
              <Text style={styles.buttonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
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
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    color: '#000',
  },
  selectInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#f9f9f9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectText: {
    fontSize: 16,
    color: '#000',
  },
  selectPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  button: {
    backgroundColor: 'hsl(210, 95%, 55%)',
    borderRadius: 25,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
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
    color: '#000',
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
  },
  modalOptionSelected: {
    color: 'hsl(210, 95%, 55%)',
    fontWeight: '600',
  },
  dateInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  dateInputGroup: {
    flex: 1,
    gap: 8,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    color: '#000',
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: 'hsl(210, 95%, 55%)',
    borderRadius: 25,
    padding: 16,
    alignItems: 'center',
  },
});
