import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  Platform,
  StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { Colors, Radius } from '../../styles/theme';
import BubbleButton from '../../components/BubbleButton';
import { BubbleLogoIcon } from '../../components/icons';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;
};

const GRID_IMAGES = [
  require('../../assets/images/LandingPage/pickleball.jpg'),
  require('../../assets/images/LandingPage/dog_meeting.png'),
  require('../../assets/images/LandingPage/volunteer_group.png'),
  require('../../assets/images/LandingPage/group_cheers.jpg'),
  require('../../assets/images/LandingPage/fitness_class.jpg'),
  require('../../assets/images/LandingPage/picnic.jpg'),
  require('../../assets/images/LandingPage/group_craft.png'),
  require('../../assets/images/LandingPage/badminton.jpg'),
  require('../../assets/images/LandingPage/mask_group.jpg'),
];

export default function WelcomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.photoGrid}>
          {GRID_IMAGES.map((img, index) => (
            <View key={index} style={styles.photoWrapper}>
              <Image
                source={img}
                style={styles.photo}
                resizeMode="cover"
              />
            </View>
          ))}
        </View>

        <View style={styles.branding}>
          <View style={styles.logoRow}>
            <BubbleLogoIcon width={40} height={37} />
            <Text style={styles.logoText}>Bubble</Text>
          </View>
          <Text style={styles.tagline}>
            Connect locally. Create moments.
          </Text>
          <Text style={styles.tagline}>
            Build lasting community.
          </Text>
        </View>

        <View style={styles.buttons}>
          <BubbleButton
            title="Sign Up"
            onPress={() => navigation.navigate('Signup')}
            testID="button-sign-up"
          />

          <BubbleButton
            title="Log In"
            variant="outline"
            onPress={() => navigation.navigate('Login')}
            testID="button-log-in"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.skyWhite,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  photoWrapper: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  branding: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.brand.bubbleBlue,
  },
  tagline: {
    fontSize: 16,
    color: Colors.neutral.coolMist,
    textAlign: 'center',
    lineHeight: 24,
  },
  buttons: {
    marginTop: 'auto',
    gap: 12,
    paddingBottom: 20,
  },
});
