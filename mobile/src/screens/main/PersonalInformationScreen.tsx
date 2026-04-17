import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { Colors, Spacing, Typography, CardShadow } from '../../styles/theme';
import { NavHeader } from '../../components/ScreenHeader';


export default function PersonalInformationScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const handleEdit = (field: string) => {
    Alert.alert('Coming Soon', `Editing ${field} will be available in a future update.`);
  };

  const fields = [
    { label: 'Legal Name', value: user?.name || 'Not provided' },
    { label: 'Phone Number', value: 'Not provided' },
    { label: 'Email', value: user?.email || 'Not provided' },
    { label: 'ID Verification', value: 'Not verified' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NavHeader title="Personal Information" onBack={() => navigation.goBack()} />

      <View style={styles.content}>
        <View style={styles.section}>
          {fields.map((field, index) => (
            <View
              key={field.label}
              style={[styles.fieldRow, index < fields.length - 1 && styles.fieldBorder]}
            >
              <View style={styles.fieldInfo}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <Text style={styles.fieldValue}>{field.value}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleEdit(field.label)}
                testID={`button-edit-${field.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
  },
  section: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    paddingHorizontal: Spacing.lg,
    ...CardShadow,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  fieldBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#D9D9D9',
  },
  fieldInfo: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.charcoal,
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
  },
  editText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.bubbleBlue,
    textDecorationLine: 'underline',
  },
});
