import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { useAuth } from '../../context/AuthContext';
import { Colors, Spacing, Radius, Typography } from '../../styles/theme';
import { NavHeader } from '../../components/ScreenHeader';
import { EyeIcon, EyeOffIcon } from '../../components/icons';
import BubbleButton from '../../components/BubbleButton';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
};

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();

  const handleLogin = useCallback(async () => {
    if (!email || !password) return;

    setIsLoading(true);
    try {
      await login(email, password);
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  }, [email, password, login]);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);
  const togglePassword = useCallback(() => setShowPassword(v => !v), []);
  const goToSignup = useCallback(() => navigation.navigate('Signup'), [navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NavHeader title="Log In" onBack={handleBack} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Welcome back!</Text>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder=""
                placeholderTextColor="#969696"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                testID="input-email"
                accessibilityLabel="Email"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder=""
                  placeholderTextColor="#969696"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  testID="input-password"
                  accessibilityLabel="Password"
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={togglePassword}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  testID="button-toggle-password"
                  accessibilityLabel="Toggle password visibility"
                >
                  {showPassword
                    ? <EyeIcon size={24} color="#969696" />
                    : <EyeOffIcon size={24} color="#969696" />}
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => {}}
                testID="button-forgot-password"
                accessibilityLabel="Forgot your password"
              >
                <Text style={styles.forgotPassword}>Forgot your password?</Text>
              </TouchableOpacity>
            </View>

            <BubbleButton
              title="Log In"
              onPress={handleLogin}
              disabled={!email || !password || isLoading}
              loading={isLoading}
              testID="button-log-in"
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity
              onPress={goToSignup}
              testID="button-go-to-signup"
              accessibilityLabel="Sign Up"
            >
              <Text style={styles.footerLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
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
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginTop: 33,
    marginBottom: 32,
  },
  form: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4D4D4D',
  },
  input: {
    borderWidth: 1,
    borderColor: '#969696',
    borderRadius: 8,
    paddingVertical: 18,
    paddingHorizontal: 8,
    fontSize: 16,
    backgroundColor: Colors.brand.skyWhite,
    color: Colors.neutral.charcoal,
  },
  passwordInput: {
    paddingRight: 48,
  },
  passwordContainer: {
    position: 'relative',
  },
  eyeIcon: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  forgotPassword: {
    fontSize: 12,
    color: Colors.brand.bubbleBlue,
    textDecorationLine: 'underline',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 14,
    color: Colors.neutral.coolMist,
  },
  footerLink: {
    fontSize: 14,
    color: Colors.brand.bubbleBlue,
    fontWeight: '600',
  },
});
