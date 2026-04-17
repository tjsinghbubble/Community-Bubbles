import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing, Typography } from '../../styles/theme';
import ScreenHeader from '../../components/ScreenHeader';

export default function GiveFeedbackScreen() {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Give us Feedback" onBack={() => navigation.goBack()} />

      <View style={styles.content}>
        <Text style={styles.heading}>Share your feedback</Text>

        <Text style={styles.body}>
          Thanks for sending us your ideas, issues, or appreciations. We can't respond individually, but we'll pass it on to the teams who are working to help make Bubble better for everyone.
        </Text>

        <Text style={styles.body}>
          If you do have a specific question, or need help resolving a problem, you can{' '}
          <Text
            style={styles.link}
            onPress={() => Alert.alert('Coming Soon', 'Contact support will be available in a future update.')}
          >
            contact us
          </Text>
          {' '}to connect with our support team.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  heading: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.midnight,
    marginBottom: Spacing.lg,
  },
  body: {
    fontSize: Typography.sizes.base,
    color: Colors.neutral.charcoal,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  link: {
    color: Colors.brand.bubbleBlue,
    textDecorationLine: 'underline',
  },
});
