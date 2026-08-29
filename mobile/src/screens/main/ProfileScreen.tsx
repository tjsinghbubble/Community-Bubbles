import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, NavigationProp } from '@react-navigation/native';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import { logAppEvent, logAppWarn } from '../../utils/crashReporter';
import { Colors, Spacing, Radius, Typography, CardShadow } from '../../styles/theme';
import { ClockIcon, EditIcon } from '../../components/icons';
import AnimatedPressable from '../../components/AnimatedPressable';


export default function ProfileScreen() {
  const { user, token, logout } = useAuth();
  const navigation = useNavigation<any>();
  const [hasAdminItems, setHasAdminItems] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [errorLogCount, setErrorLogCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [myBubbles, setMyBubbles] = useState<any[]>([]);
  const [campusInfo, setCampusInfo] = useState<{ name: string } | null>(null);
  const [campusTileDismissed, setCampusTileDismissed] = useState(false);
  const isSuperAdmin = user?.isSuperAdmin === true;
  const isBubbleAdmin = useRef(false);
  const isCampusVerified = user?.campusVerified === true;

  const fetchCampusInfo = useCallback(async () => {
    if (!user || !isCampusVerified || !token) {
      setCampusInfo(null);
      return;
    }

    try {
      apiService.setToken(token);
      const response = await apiService.getMyCampus();
      setCampusInfo(response.campus ? { name: response.campus.name } : null);
    } catch (error) {
      logAppWarn('profile.campus_load_failed', { error: String(error) });
      setCampusInfo(null);
    }
  }, [user, token, isCampusVerified]);

  const fetchErrorLogCount = useCallback(async () => {
    if (!user || !isSuperAdmin) {
      setErrorLogCount(0);
      return;
    }
    try {
      const { count } = await apiService.getErrorLogCount();
      setErrorLogCount(count);
    } catch {
      setErrorLogCount(0);
    }
  }, [user, isSuperAdmin]);

  useFocusEffect(
    useCallback(() => {
      checkAdminItems();
      fetchBubbles();
      fetchCampusInfo();
      apiService.getUnreadNotificationCount().then(r => setUnreadNotifCount(r.count)).catch(() => {});
      fetchErrorLogCount();
      const errorLogInterval = setInterval(fetchErrorLogCount, 30000);
      return () => {
        clearInterval(errorLogInterval);
      };
    }, [user, fetchCampusInfo, fetchErrorLogCount])
  );

  const fetchBubbles = async () => {
    try {
      const bubbles: any[] = await apiService.getMyBubbles() as any[];
      setMyBubbles(bubbles);
      logAppEvent('profile.loaded', {
        bubbleCount: bubbles.length,
        adminBubbleCount: bubbles.filter((b: any) => b.role === 'admin').length,
        isSuperAdmin: user?.isSuperAdmin === true,
        hasProfilePhoto: !!user?.profilePhoto,
        interestCount: user?.interests?.length ?? 0,
      });
    } catch (error) {
      logAppWarn('profile.bubbles_load_failed', { error: String(error) });
      setMyBubbles([]);
    }
  };

  const checkAdminItems = async () => {
    if (!user) return;
    try {
      const { count } = await apiService.getAdminPendingCount();
      setPendingCount(count);
      if (!isSuperAdmin) {
        const bubbles: any[] = await apiService.getMyBubbles() as any[];
        isBubbleAdmin.current = bubbles.some((b: any) => b.role === 'admin');
      } else {
        AsyncStorage.getItem('errorLogLastSeenAt').then(since => {
          return apiService.getErrorLogCount(since ?? undefined);
        }).then(r => setErrorLogCount(r?.count ?? 0)).catch(() => {});
      }
      setHasAdminItems(count > 0 || isSuperAdmin || isBubbleAdmin.current);
    } catch (error) {
      setHasAdminItems(isSuperAdmin || isBubbleAdmin.current);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Log Out', 
          style: 'destructive',
          onPress: async () => {
            await logout();
          }
        },
      ]
    );
  };

  const handleNavigateToBubbles = () => {
    navigation.getParent()?.navigate('MyBubbles', { screen: 'MyBubblesList' });
  };

  const handleExploreMode = (mode: 'campus' | 'city') => {
    navigation.getParent()?.navigate('Explore', {
      screen: 'ExploreList',
      params: { mode },
    });
  };

  const handleJoinCampus = () => {
    navigation.getParent()?.navigate('Explore', {
      screen: 'CampusJoin',
    });
  };

  const handleDismissCampusTile = async () => {
    setCampusTileDismissed(true);

    if (!token) return;

    try {
      apiService.setToken(token);
      await apiService.dismissCampusPrompt();
    } catch (error) {
      logAppWarn('profile.campus_prompt_dismiss_failed', { error: String(error) });
      setCampusTileDismissed(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.brand.bubbleBlue} />
        </View>
      </SafeAreaView>
    );
  }

  const bubbleImages = myBubbles
    .filter((b: any) => b.coverImage)
    .slice(0, 3)
    .map((b: any) => b.coverImage);

  const locationAwareUser = user as typeof user & {
    city?: string | null;
    cityName?: string | null;
  };
  const cityName = locationAwareUser.cityName?.trim() || locationAwareUser.city?.trim() || 'your city';
  const campusName = campusInfo?.name?.trim() || 'your campus';
  const shouldShowCampusJoinTile = !isCampusVerified && !user.dismissedCampusPrompt && !campusTileDismissed;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('EditProfile')} testID="button-edit-profile">
          <EditIcon size={22} color={Colors.neutral.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity
          style={styles.bellButton}
          onPress={() => navigation.navigate('Notifications')}
          testID="button-notifications"
          accessibilityLabel="Notifications"
        >
          <View>
            <Ionicons name="notifications-outline" size={24} color={Colors.neutral.charcoal} />
            {unreadNotifCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadNotifCount > 99 ? '99+' : unreadNotifCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileCard} testID="card-profile">
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
          <Text style={styles.userRole}>
            {isSuperAdmin ? 'Super Admin' : isBubbleAdmin.current ? 'Admin' : 'Member'}
          </Text>
        </View>

        {isCampusVerified && (
          <View style={styles.modeSwitchCard} testID="card-explore-mode-switch">
            <Text style={styles.modeSwitchTitle}>Explore your community</Text>
            <Text style={styles.modeSwitchSubtitle}>Choose where you want to discover bubbles and events.</Text>
            <View style={styles.modeOptions}>
              <TouchableOpacity
                style={styles.modeOption}
                onPress={() => handleExploreMode('campus')}
                testID="button-switch-campus"
                accessibilityRole="button"
                accessibilityLabel={`Switch to Campus, ${campusName}`}
              >
                <View style={[styles.modeIcon, styles.modeIconCampus]}>
                  <Ionicons name="school-outline" size={24} color={Colors.brand.bubbleBlue} />
                </View>
                <View style={styles.modeOptionCopy}>
                  <Text style={styles.modeOptionTitle}>Switch to Campus</Text>
                  <Text style={styles.modeOptionDescription} numberOfLines={2}>
                    See bubbles and events at {campusName}.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
              </TouchableOpacity>
              <View style={styles.modeDivider} />
              <TouchableOpacity
                style={styles.modeOption}
                onPress={() => handleExploreMode('city')}
                testID="button-switch-city"
                accessibilityRole="button"
                accessibilityLabel={`Switch to City, ${cityName}`}
              >
                <View style={[styles.modeIcon, styles.modeIconCity]}>
                  <Ionicons name="location-outline" size={24} color={Colors.text.secondary} />
                </View>
                <View style={styles.modeOptionCopy}>
                  <Text style={styles.modeOptionTitle}>Switch to City</Text>
                  <Text style={styles.modeOptionDescription} numberOfLines={2}>
                    See bubbles and events in {cityName}.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {shouldShowCampusJoinTile && (
          <View style={styles.modeSwitchCard} testID="card-campus-join">
            <View style={styles.joinCampusTileHeader}>
              <View style={[styles.modeIcon, styles.modeIconCampus]}>
                <Ionicons name="school-outline" size={24} color={Colors.brand.bubbleBlue} />
              </View>
              <View style={styles.modeOptionCopy}>
                <Text style={styles.modeSwitchTitle}>Join Campus</Text>
                <Text style={styles.modeSwitchSubtitle}>
                  Verify your .edu email to find campus bubbles and events.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.joinCampusTileButton}
              onPress={handleJoinCampus}
              testID="button-join-campus"
              accessibilityRole="button"
              accessibilityLabel="Join Campus"
            >
              <Text style={styles.joinCampusTileButtonText}>Join Campus</Text>
              <Ionicons name="arrow-forward" size={18} color={Colors.brand.bubbleBlue} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dismissCampusTileButton}
              onPress={handleDismissCampusTile}
              testID="button-dismiss-campus-tile"
              accessibilityRole="button"
              accessibilityLabel="I'm not a student"
            >
              <Text style={styles.dismissCampusTileText}>I'm not a student</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.cardsRow}>
          <View style={styles.halfCard} testID="card-interests">
            <Text style={styles.cardTitle}>Interests</Text>
            <View style={styles.interestsContainer}>
              {user.interests && user.interests.length > 0 ? (
                user.interests.slice(0, 6).map((interest, index) => (
                  <View key={index} style={styles.interestTag}>
                    <Text style={styles.interestText}>{interest}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No interests selected</Text>
              )}
              {user.interests && user.interests.length > 6 && (
                <View style={styles.interestTag}>
                  <Text style={styles.interestText}>+{user.interests.length - 6}</Text>
                </View>
              )}
            </View>
          </View>

          <AnimatedPressable
            style={styles.halfCard}
            scaleValue={0.97}
            onPress={handleNavigateToBubbles}
            testID="card-bubbles"
          >
            <Text style={styles.cardTitle}>Bubbles</Text>
            {myBubbles.length > 0 ? (
              <>
                <View style={styles.bubblePreview}>
                  {bubbleImages.length > 0 ? (
                    <View style={styles.stackedImages}>
                      {bubbleImages.map((img: string, idx: number) => (
                        <Image
                          key={idx}
                          source={{ uri: img }}
                          style={[
                            styles.stackedImage,
                            { marginLeft: idx > 0 ? -10 : 0, zIndex: 3 - idx },
                          ]}
                        />
                      ))}
                    </View>
                  ) : (
                    <View style={styles.bubbleIconCircle}>
                      <Ionicons name="people" size={24} color={Colors.brand.bubbleBlue} />
                    </View>
                  )}
                </View>
                <Text style={styles.bubbleCount}>{myBubbles.length} {myBubbles.length === 1 ? 'bubble' : 'bubbles'}</Text>
              </>
            ) : (
              <Text style={styles.emptyText}>No bubbles yet</Text>
            )}
            <View style={styles.cardChevron}>
              <Ionicons name="chevron-forward" size={16} color={Colors.text.tertiary} />
            </View>
          </AnimatedPressable>
        </View>

        {hasAdminItems && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Administration</Text>
              <View style={[styles.adminBadge, isSuperAdmin && styles.superAdminBadge]}>
                <Ionicons name="shield-checkmark" size={14} color={Colors.brand.skyWhite} />
                <Text style={styles.adminBadgeText}>{isSuperAdmin ? 'Super Admin' : 'Admin'}</Text>
              </View>
            </View>
            <AnimatedPressable
              style={styles.menuItem}
              scaleValue={0.97}
              onPress={() => navigation.navigate('PendingReviews')}
              testID="link-needs-attention"
              accessibilityLabel="Needs Attention"
            >
              <View style={styles.menuItemLeft}>
                <ClockIcon size={24} color={Colors.text.secondary} />
                <Text style={styles.menuItemText}>Needs Attention</Text>
                {pendingCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{pendingCount}</Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
            </AnimatedPressable>
            {isSuperAdmin && (
              <AnimatedPressable
                style={styles.menuItem}
                scaleValue={0.97}
                onPress={() => navigation.navigate('ManageRules')}
                testID="link-manage-rules"
              >
                <View style={styles.menuItemLeft}>
                  <Ionicons name="list-outline" size={24} color={Colors.text.secondary} />
                  <Text style={styles.menuItemText}>Manage Rules</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
              </AnimatedPressable>
            )}
            {isSuperAdmin && (
              <AnimatedPressable
                style={styles.menuItem}
                scaleValue={0.97}
                onPress={() => {
                  setErrorLogCount(0);
                  navigation.navigate('ErrorLog');
                }}
                testID="link-error-log"
              >
                <View style={styles.menuItemLeft}>
                  <Ionicons name="warning-outline" size={24} color={Colors.text.secondary} />
                  <Text style={styles.menuItemText}>Error Log</Text>
                  {errorLogCount > 0 && (
                    <View style={[styles.badge, styles.errorBadge]} testID="badge-error-log-count">
                      <Text style={styles.badgeText}>{errorLogCount > 99 ? '99+' : errorLogCount}</Text>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
              </AnimatedPressable>
            )}
            {isSuperAdmin && (
              <AnimatedPressable
                style={styles.menuItem}
                scaleValue={0.97}
                onPress={() => navigation.navigate('SlowCallTrends')}
                testID="link-slow-call-trends"
              >
                <View style={styles.menuItemLeft}>
                  <Ionicons name="speedometer-outline" size={24} color={Colors.text.secondary} />
                  <Text style={styles.menuItemText}>Slow-Call Trends</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
              </AnimatedPressable>
            )}
            {isSuperAdmin && (
              <AnimatedPressable
                style={styles.menuItem}
                scaleValue={0.97}
                onPress={() => navigation.navigate('SpanHealth')}
                testID="link-span-health"
              >
                <View style={styles.menuItemLeft}>
                  <Ionicons name="pulse-outline" size={24} color={Colors.text.secondary} />
                  <Text style={styles.menuItemText}>Span Health</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
              </AnimatedPressable>
            )}
            {isSuperAdmin && (
              <AnimatedPressable
                style={styles.menuItem}
                scaleValue={0.97}
                onPress={async () => {
                  const token = await AsyncStorage.getItem('authToken');
                  if (token) {
                    Clipboard.setString(token);
                    Alert.alert('Copied', 'JWT token copied to clipboard.');
                  } else {
                    Alert.alert('Not found', 'No auth token in storage.');
                  }
                }}
                testID="button-copy-jwt-token"
              >
                <View style={styles.menuItemLeft}>
                  <Ionicons name="key-outline" size={24} color={Colors.text.secondary} />
                  <Text style={styles.menuItemText}>Copy JWT Token</Text>
                </View>
                <Ionicons name="copy-outline" size={20} color={Colors.text.tertiary} />
              </AnimatedPressable>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={() => navigation.navigate('ViewProfile')}
            testID="link-view-profile"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="person-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>View Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>
          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={() => (navigation as NavigationProp<ProfileStackParamList>).navigate('AccountSettings')}
            testID="link-settings"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="settings-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>
          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={() => (navigation as NavigationProp<ProfileStackParamList>).navigate('PrivacySettings')}
            testID="link-privacy"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="shield-checkmark-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Privacy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>
          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={() => (navigation as NavigationProp<ProfileStackParamList>).navigate('GetHelp')}
            testID="link-get-help"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="help-circle-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Get help</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={() => (navigation as NavigationProp<ProfileStackParamList>).navigate('TermsOfService')}
            testID="link-terms-of-service"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="document-text-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Terms of Service</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>
          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={() => (navigation as NavigationProp<ProfileStackParamList>).navigate('PrivacyPolicy')}
            testID="link-privacy-policy"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="shield-checkmark-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>
        </View>

        <View style={styles.section}>
          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={handleLogout}
            testID="button-logout"
            accessibilityLabel="Log Out"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="log-out-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Log Out</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>

          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={() => (navigation as NavigationProp<ProfileStackParamList>).navigate('TermsOfService')}
            testID="link-terms-of-service"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="document-text-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Terms of Service</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>

          <AnimatedPressable
            style={styles.menuItem}
            scaleValue={0.97}
            onPress={() => (navigation as NavigationProp<ProfileStackParamList>).navigate('PrivacyPolicy')}
            testID="link-privacy-policy"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="shield-checkmark-outline" size={24} color={Colors.text.secondary} />
              <Text style={styles.menuItemText}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
          </AnimatedPressable>
        </View>
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: Colors.background.secondary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.lightSilver,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: Colors.status.error,
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    color: Colors.brand.skyWhite,
    fontSize: Typography.sizes.xxs,
    fontWeight: Typography.weights.bold,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    marginBottom: 12,
    justifyContent: 'center',
    ...CardShadow,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.brand.midnight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 10,
  },
  avatarText: {
    fontSize: Typography.sizes.hero,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.skyWhite,
  },
  userName: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  modeSwitchCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: 12,
    ...CardShadow,
  },
  modeSwitchTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
  },
  modeSwitchSubtitle: {
    fontSize: Typography.sizes.sm,
    lineHeight: Typography.lineHeight.sm,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  modeOptions: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  modeIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeIconCampus: {
    backgroundColor: Colors.background.brandTint,
  },
  modeIconCity: {
    backgroundColor: Colors.background.surface,
  },
  modeOptionCopy: {
    flex: 1,
  },
  modeOptionTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
  },
  modeOptionDescription: {
    fontSize: Typography.sizes.sm,
    lineHeight: Typography.lineHeight.sm,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  modeDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border.light,
    marginLeft: 60,
  },
  joinCampusTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  joinCampusTileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border.light,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
  },
  joinCampusTileButtonText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.bubbleBlue,
  },
  dismissCampusTileButton: {
    alignItems: 'center',
    paddingTop: Spacing.md,
  },
  dismissCampusTileText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
  },
  userRole: {
    fontSize: 12,
    color: Colors.neutral.charcoal,
    marginTop: 2,
  },
  userEmail: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  halfCard: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    padding: 16,
    minHeight: 140,
    ...CardShadow,
  },
  cardTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
    marginBottom: 10,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  interestTag: {
    backgroundColor: Colors.background.brandTint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.md,
  },
  interestText: {
    color: Colors.brand.primary,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium,
  },
  emptyText: {
    color: Colors.text.tertiary,
    fontSize: Typography.sizes.sm,
    fontStyle: 'italic',
  },
  bubblePreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  stackedImages: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackedImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.background.primary,
  },
  bubbleIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background.brandTint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleCount: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  cardChevron: {
    position: 'absolute',
    top: 16,
    right: 14,
  },
  section: {
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    marginBottom: 12,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    ...CardShadow,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.charcoal,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
    gap: Spacing.xs,
  },
  superAdminBadge: {
    backgroundColor: Colors.status.warning,
  },
  adminBadgeText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.skyWhite,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  menuItemText: {
    fontSize: Typography.sizes.base,
    color: Colors.neutral.charcoal,
  },
  badge: {
    backgroundColor: Colors.brand.primary,
    borderRadius: Radius.md,
    minWidth: Spacing.xxl,
    height: Spacing.xxl,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  errorBadge: {
    backgroundColor: Colors.status.error,
  },
  badgeText: {
    color: Colors.brand.skyWhite,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semiBold,
  },
  badge: {
    backgroundColor: Colors.brand.bubbleBlue,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginLeft: 8,
  },
  badgeText: {
    color: Colors.brand.skyWhite,
    fontSize: 12,
    fontWeight: '600',
  },
});
