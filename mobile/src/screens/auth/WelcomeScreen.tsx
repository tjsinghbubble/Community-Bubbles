import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  Platform,
  StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Radius, Typography, Gradients } from '../../styles/theme';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;
};

const PHOTOS = [
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=200',
  'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=200',
  'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=200',
  'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=200',
  'https://images.unsplash.com/photo-1506869640319-fe1a24fd76dc?w=200',
  'https://images.unsplash.com/photo-1543807535-eceef0bc6599?w=200',
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=200',
  'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=200',
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=200',
];

export default function WelcomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.photoGrid}>
          {PHOTOS.map((photo, index) => (
            <View key={index} style={styles.photoWrapper}>
              <Image
                source={{ uri: photo }}
                style={styles.photo}
                resizeMode="cover"
              />
            </View>
          ))}
        </View>

        <View style={styles.branding}>
          <View style={styles.logoRow}>
            <View style={styles.logoCircles}>
              <View style={[styles.circle, styles.circle1]} />
              <View style={[styles.circle, styles.circle2]} />
            </View>
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
          <TouchableOpacity
            onPress={() => navigation.navigate('Signup')}
          >
            <LinearGradient
              colors={Gradients.button.colors as [string, string]}
              start={Gradients.button.start}
              end={Gradients.button.end}
              style={styles.signUpButton}
            >
              <Text style={styles.signUpText}>Sign Up</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logInButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.logInText}>Log In</Text>
          </TouchableOpacity>
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
    marginBottom: 12,
  },
  logoCircles: {
    flexDirection: 'row',
    marginRight: 8,
  },
  circle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  circle1: {
    borderColor: Colors.brand.bubbleBlue,
    backgroundColor: 'transparent',
  },
  circle2: {
    borderColor: Colors.brand.bubbleBlue,
    backgroundColor: Colors.brand.bubbleBlue,
    marginLeft: -6,
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
  signUpButton: {
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: 'center',
  },
  signUpText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  logInButton: {
    backgroundColor: Colors.brand.skyWhite,
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.brand.bubbleBlue,
  },
  logInText: {
    color: Colors.brand.bubbleBlue,
    fontSize: 16,
    fontWeight: '600',
  },
});
