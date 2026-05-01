import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  ActivityIndicator,
  Animated,
  Dimensions,
  DimensionValue,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import { API_URL } from '../../config/api';
import { Colors, Spacing, Typography, CardShadow } from '../../styles/theme';
import { FlowHeader } from '../../components/ScreenHeader';
import { logAppEvent, logAppWarn } from '../../utils/crashReporter';

interface CategoryItem {
  id: number;
  name: string;
  displayName: string;
  image: string | null;
  parentId: number | null;
}

type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'ViewProfile'>;
};

type CompletionHintRowProps = {
  label: string;
  hint: string;
  done: boolean;
  testID?: string;
  last?: boolean;
  onPress?: () => void;
};

function CompletionHintRow({ label, hint, done, testID, last, onPress }: CompletionHintRowProps) {
  const inner = (
    <>
      <Ionicons
        name={done ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={done ? '#34C759' : '#C7C7CC'}
        style={hintRowStyles.icon}
        testID={done ? `${testID}-done` : `${testID}-missing`}
      />
      <View style={hintRowStyles.textBlock}>
        <Text style={[hintRowStyles.label, done && hintRowStyles.labelDone]}>{label}</Text>
        {!done && <Text style={hintRowStyles.hint}>{hint}</Text>}
      </View>
      {!done && onPress && (
        <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
      )}
    </>
  );

  if (!done && onPress) {
    return (
      <TouchableOpacity
        style={[hintRowStyles.row, !last && hintRowStyles.rowBorder]}
        testID={testID}
        onPress={onPress}
        activeOpacity={0.6}
      >
        {inner}
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[hintRowStyles.row, !last && hintRowStyles.rowBorder]}
      testID={testID}
    >
      {inner}
    </View>
  );
}

const hintRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  icon: {
    marginRight: 12,
  },
  textBlock: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4D4D4D',
  },
  labelDone: {
    color: '#34C759',
  },
  hint: {
    fontSize: 12,
    color: '#969696',
    marginTop: 2,
  },
});

const CONFETTI_COLORS = ['#35A8F7', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#FFD60A', '#5856D6'];
const PARTICLE_COUNT = 28;

type Particle = {
  x: Animated.Value;
  y: Animated.Value;
  rotate: Animated.Value;
  opacity: Animated.Value;
  color: string;
  size: number;
  isCircle: boolean;
  initialX: number;
};

function useConfettiParticles(screenWidth: number): Particle[] {
  return useRef<Particle[]>(
    Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const initialX = Math.random() * screenWidth;
      return {
        x: new Animated.Value(initialX),
        y: new Animated.Value(-20 - Math.random() * 60),
        rotate: new Animated.Value(0),
        opacity: new Animated.Value(1),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + Math.floor(Math.random() * 7),
        isCircle: Math.random() > 0.5,
        initialX,
      };
    })
  ).current;
}

type ConfettiOverlayProps = {
  visible: boolean;
  screenWidth: number;
  screenHeight: number;
  onDone: () => void;
};

function ConfettiOverlay({ visible, screenWidth, screenHeight, onDone }: ConfettiOverlayProps) {
  const particles = useConfettiParticles(screenWidth);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!visible) {
      hasAnimated.current = false;
      return;
    }
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    particles.forEach((p) => {
      p.x.setValue(p.initialX);
      p.y.setValue(-20 - Math.random() * 60);
      p.rotate.setValue(0);
      p.opacity.setValue(1);
    });

    const animations = particles.map((p) => {
      const delay = Math.random() * 300;
      const duration = 1200 + Math.random() * 800;
      const targetX = p.initialX + (Math.random() - 0.5) * 120;

      return Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(p.y, {
            toValue: screenHeight * 0.7,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(p.x, {
            toValue: targetX,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(p.rotate, {
            toValue: (Math.random() > 0.5 ? 1 : -1) * (3 + Math.random() * 5),
            duration,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(p.opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
            Animated.delay(duration - 400),
            Animated.timing(p.opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]),
        ]),
      ]);
    });

    Animated.parallel(animations).start(() => {
      onDone();
    });
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={confettiStyles.overlay} pointerEvents="none" testID="confetti-overlay">
      {particles.map((p, i) => {
        const rotate = p.rotate.interpolate({
          inputRange: [-10, 10],
          outputRange: ['-360deg', '360deg'],
        });
        return (
          <Animated.View
            key={i}
            style={[
              confettiStyles.particle,
              p.isCircle && confettiStyles.circle,
              {
                width: p.size,
                height: p.size,
                borderRadius: p.isCircle ? p.size / 2 : 2,
                backgroundColor: p.color,
                transform: [
                  { translateX: p.x },
                  { translateY: p.y },
                  { rotate },
                ],
                opacity: p.opacity,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const confettiStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  particle: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  circle: {},
});

type CelebrationBannerProps = {
  visible: boolean;
  onDone: () => void;
};

function CelebrationBanner({ visible, onDone }: CelebrationBannerProps) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const exitAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!visible) return;

    translateY.setValue(-120);
    opacity.setValue(0);
    scale.setValue(0.9);

    const entry = Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 12,
        bounciness: 8,
      }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 6 }),
    ]);
    entryAnimRef.current = entry;

    entry.start(() => {
      holdTimerRef.current = setTimeout(() => {
        const exit = Animated.parallel([
          Animated.timing(translateY, { toValue: -120, duration: 300, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]);
        exitAnimRef.current = exit;
        exit.start(onDone);
      }, 3200);
    });

    return () => {
      entryAnimRef.current?.stop();
      exitAnimRef.current?.stop();
      if (holdTimerRef.current !== null) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        bannerStyles.container,
        { transform: [{ translateY }, { scale }], opacity },
      ]}
      pointerEvents="none"
      testID="celebration-banner"
    >
      <LinearGradient
        colors={['#34C759', '#35A8F7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={bannerStyles.gradient}
      >
        <Text style={bannerStyles.emoji}>🎉</Text>
        <View style={bannerStyles.textBlock}>
          <Text style={bannerStyles.title}>Profile complete!</Text>
          <Text style={bannerStyles.subtitle}>Your community will love getting to know you.</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const bannerStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 68,
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 200,
    borderRadius: 16,
    overflow: 'hidden',
    ...CardShadow,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 12,
  },
  emoji: {
    fontSize: 28,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: Typography.sizes.base,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.88)',
    marginTop: 2,
  },
});

type BubbleItem = {
  id: string;
  title: string;
  category?: string;
  coverImage?: string | null;
  role?: string;
};

export default function ViewProfileScreen({ navigation }: Props) {
  const { user, token } = useAuth();

  const completionFields = [
    !!user?.profilePhoto,
    !!user?.aboutMe,
    Array.isArray(user?.interests) && (user?.interests?.length ?? 0) > 0,
  ];
  const completedCount = completionFields.filter(Boolean).length;
  const totalCount = completionFields.length;
  const completionRatio = completedCount / totalCount;
  const progressPercent = `${Math.round(completionRatio * 100)}%`;
  const isProfileComplete = completedCount === totalCount;

  const [myBubbles, setMyBubbles] = useState<BubbleItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const isBubbleAdmin = useRef(false);

  const [showCompleteCard, setShowCompleteCard] = useState(!isProfileComplete);
  const cardOpacity = useRef(new Animated.Value(isProfileComplete ? 0 : 1)).current;
  const cardScale = useRef(new Animated.Value(isProfileComplete ? 0.9 : 1)).current;
  const cardTranslateY = useRef(new Animated.Value(isProfileComplete ? -12 : 0)).current;

  const [showConfetti, setShowConfetti] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  useEffect(() => {
    setCategoriesLoading(true);
    fetch(`${API_URL}/api/categories/flat`)
      .then(res => res.ok ? res.json() : Promise.reject('Failed to fetch categories'))
      .then((data: CategoryItem[]) => setCategories(data.filter(c => c.parentId !== null)))
      .catch((err: any) => {
        logAppWarn('ViewProfile:categoriesLoadFailed', { error: err?.message ?? String(err) });
      })
      .finally(() => setCategoriesLoading(false));
  }, []);

  const getDisplayName = (name: string): string => {
    const cat = categories.find(c => c.name === name);
    return cat ? cat.displayName : name;
  };

  const animateCardOut = useCallback((onFinish?: () => void) => {
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(cardScale, {
        toValue: 0.9,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslateY, {
        toValue: -12,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowCompleteCard(false);
      onFinish?.();
    });
  }, [cardOpacity, cardScale, cardTranslateY]);

  useFocusEffect(
    useCallback(() => {
      if (token) {
        apiService.setToken(token);
        apiService.getMyBubbles().then((bubbles: any) => {
          const list = bubbles || [];
          setMyBubbles(list);
          isBubbleAdmin.current = list.some((b: any) => b.role === 'admin');
          logAppEvent('ViewProfile:bubblesLoaded', {
            bubblesCount: list.length,
            isBubbleAdmin: isBubbleAdmin.current,
          });
        }).catch((err: any) => {
          logAppWarn('ViewProfile:bubblesLoadFailed', { error: err?.message ?? 'unknown' });
        });
      }

      if (!user?.id) return;

      const celebrationKey = `bubble:profile_celebrated:${user.id}`;

      if (isProfileComplete) {
        AsyncStorage.getItem(celebrationKey).then((alreadyCelebrated) => {
          if (!alreadyCelebrated) {
            AsyncStorage.setItem(celebrationKey, 'true').catch(() => {});
            animateCardOut(() => {
              setShowConfetti(true);
              setShowBanner(true);
            });
          } else {
            animateCardOut();
          }
        }).catch(() => {
          animateCardOut();
        });
      } else {
        cardOpacity.setValue(1);
        cardScale.setValue(1);
        cardTranslateY.setValue(0);
        setShowCompleteCard(true);
        setShowConfetti(false);
        setShowBanner(false);
      }
    }, [token, isProfileComplete, user?.id, animateCardOut])
  );

  if (!user) return null;

  const isSuperAdmin = user.isSuperAdmin === true;
  const roleLabel = isSuperAdmin ? 'Super Admin' : isBubbleAdmin.current ? 'Admin' : 'Member';
  const previewBubbles = myBubbles.slice(0, 3);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlowHeader
        title="My Profile"
        onBack={() => navigation.goBack()}
        rightElement={
          <TouchableOpacity onPress={() => navigation.navigate('EditProfile')} testID="button-edit-header">
            <Text style={styles.editHeaderText}>Edit</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.profileCard, CardShadow]}>
          {user.profilePhoto ? (
            <Image source={{ uri: user.profilePhoto }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userRole}>{roleLabel}</Text>

          <TouchableOpacity
            onPress={() => navigation.navigate('EditProfile')}
            activeOpacity={0.7}
            testID="button-edit-bio"
          >
            <Text
              style={[styles.aboutMe, !user.aboutMe && styles.aboutMePlaceholder]}
              testID="text-my-about"
            >
              {user.aboutMe || 'Add a bio…'}
            </Text>
          </TouchableOpacity>
        </View>

        {showCompleteCard && (
          <Animated.View
            style={[
              styles.completeSection,
              {
                opacity: cardOpacity,
                transform: [{ scale: cardScale }, { translateY: cardTranslateY }],
              },
            ]}
            testID="section-complete-profile"
          >
            <View style={styles.progressHeader} testID="progress-header">
              <Text style={styles.progressLabel} testID="text-progress-count">
                {completedCount} of {totalCount} complete
              </Text>
            </View>
            <View style={styles.progressBarTrack} testID="progress-bar-track">
              <View
                style={[styles.progressBarFill, { width: progressPercent as DimensionValue }]}
                testID="progress-bar-fill"
              />
            </View>
            <Text style={styles.completeTitle}>Complete your profile</Text>
            <Text style={styles.completeSubtitle}>
              Your Bubble profile is an important part of every community. Complete yours to help other admins and members get to know you.
            </Text>

            <View style={styles.hintList}>
              <CompletionHintRow
                label="Profile photo"
                hint="Add a photo so people can recognise you"
                done={!!user.profilePhoto}
                testID="hint-photo"
                onPress={() => navigation.navigate('EditProfile', { focusField: 'photo' })}
              />
              <CompletionHintRow
                label="Bio"
                hint="Tell people a little about yourself"
                done={!!user.aboutMe}
                testID="hint-bio"
                onPress={() => navigation.navigate('EditProfile', { focusField: 'bio' })}
              />
              <CompletionHintRow
                label="Interests"
                hint="Pick at least one interest"
                done={Array.isArray(user.interests) && user.interests.length > 0}
                testID="hint-interests"
                last
                onPress={() => navigation.navigate('EditProfile', { focusField: 'interests' })}
              />
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate('EditProfile')}
              activeOpacity={0.7}
              style={styles.getStartedBtn}
              testID="button-get-started"
            >
              <LinearGradient
                colors={['#35A8F7', '#FFFFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.7, y: 3.6 }}
                style={styles.getStartedGradient}
              >
                <Text style={styles.getStartedText}>Get started</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {Array.isArray(user.interests) && user.interests.length > 0 && (
          <View style={[styles.interestsCard, CardShadow]} testID="section-my-interests">
            <Text style={styles.interestsCardTitle}>My Interests</Text>
            {categoriesLoading ? (
              <ActivityIndicator size="small" color={Colors.brand.bubbleBlue} style={{ marginVertical: 8 }} testID="loading-interests" />
            ) : (
              <View style={styles.interestsGrid}>
                {user.interests.map((name) => (
                  <View key={name} style={styles.interestChip} testID={`chip-interest-${name}`}>
                    <Text style={styles.interestChipText}>{getDisplayName(name)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.bubblesCard, CardShadow]}
          onPress={() => navigation.navigate('MyBubblesFromProfile')}
          activeOpacity={0.7}
          testID="card-my-bubbles"
        >
          <View style={styles.bubblesCardHeader}>
            <Text style={styles.bubblesCardTitle}>My Bubbles</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.text.tertiary} />
          </View>
          {myBubbles.length === 0 ? (
            <Text style={styles.emptyText}>You haven't joined any bubbles yet.</Text>
          ) : (
            <>
              {previewBubbles.map((bubble) => (
                <View key={bubble.id} style={styles.bubbleRow}>
                  {bubble.coverImage ? (
                    <Image source={{ uri: bubble.coverImage }} style={styles.bubbleThumb} />
                  ) : (
                    <View style={[styles.bubbleThumb, styles.bubbleThumbPlaceholder]}>
                      <Ionicons name="people" size={16} color={Colors.brand.bubbleBlue} />
                    </View>
                  )}
                  <View style={styles.bubbleInfo}>
                    <Text style={styles.bubbleName}>{bubble.title}</Text>
                    {bubble.category && (
                      <Text style={styles.bubbleCategory}>{bubble.category}</Text>
                    )}
                  </View>
                </View>
              ))}
              {myBubbles.length > 3 && (
                <Text style={styles.seeAllText}>See all {myBubbles.length} bubbles</Text>
              )}
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      <ConfettiOverlay
        visible={showConfetti}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        onDone={() => setShowConfetti(false)}
      />
      <CelebrationBanner
        visible={showBanner}
        onDone={() => setShowBanner(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  editHeaderText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.brand.bubbleBlue,
  },
  separator: {
    height: 1,
    backgroundColor: '#D9D9D9',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  profileCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
    marginBottom: 15,
    justifyContent: 'center',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 14,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.brand.midnight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    fontSize: Typography.sizes.hero,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.brand.skyWhite,
  },
  userName: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  userRole: {
    fontSize: 12,
    color: Colors.neutral.charcoal,
    marginTop: 2,
  },
  aboutMe: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  aboutMePlaceholder: {
    color: Colors.text.tertiary,
    fontStyle: 'italic',
  },
  completeSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  progressHeader: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.brand.bubbleBlue,
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#E8E8E8',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 18,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.brand.bubbleBlue,
    borderRadius: 3,
  },
  completeTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.regular as any,
    color: Colors.neutral.charcoal,
    textAlign: 'center',
    marginBottom: 12,
  },
  completeSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.charcoal,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  hintList: {
    width: '100%',
    backgroundColor: Colors.background.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  getStartedBtn: {
    width: '100%',
  },
  getStartedGradient: {
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  getStartedText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold as any,
    color: '#1E1F26',
  },
  interestsCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
  },
  interestsCardTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.neutral.charcoal,
    marginBottom: 12,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.brand.bubbleBlue + '15',
    borderWidth: 1,
    borderColor: Colors.brand.bubbleBlue,
  },
  interestChipText: {
    fontSize: Typography.sizes.sm,
    color: Colors.brand.bubbleBlue,
    fontWeight: Typography.weights.semiBold as any,
  },
  bubblesCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    padding: 20,
  },
  bubblesCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bubblesCardTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.neutral.charcoal,
  },
  emptyText: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.charcoal,
    fontStyle: 'italic',
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  bubbleThumb: {
    width: 36,
    height: 36,
    borderRadius: 10,
    marginRight: 12,
  },
  bubbleThumbPlaceholder: {
    backgroundColor: Colors.brand.bubbleBlue + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleInfo: {
    flex: 1,
  },
  bubbleName: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.neutral.charcoal,
  },
  bubbleCategory: {
    fontSize: Typography.sizes.xs,
    color: Colors.neutral.charcoal,
    marginTop: 2,
  },
  seeAllText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.brand.bubbleBlue,
    textAlign: 'center',
    marginTop: 12,
  },
});
