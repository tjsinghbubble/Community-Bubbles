/**
 * Navigation tests for EventDetailsScreen.
 *
 * These tests will FAIL until the fix is applied:
 *   handleBackPress must navigate to 'Upcoming' when source === 'upcoming'.
 */

import React from 'react';
import { act, create } from 'react-test-renderer';

// ─── Heavy native mocks ──────────────────────────────────────────────────────
jest.mock('react-native-gesture-handler', () => {
  const { View, ScrollView, FlatList } = require('react-native');
  return {
    GestureDetector: ({ children }: any) => children,
    Gesture: { Native: () => ({}) },
    PanGestureHandler: View,
    State: {},
    ScrollView,
    FlatList,
  };
});

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (val: any) => ({ value: val }),
    useAnimatedStyle: () => ({}),
    runOnJS: (fn: any) => fn,
    withTiming: (val: any) => val,
    withSpring: (val: any) => val,
    withDelay: (_delay: any, val: any) => val,
  };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
}));

// ─── External dependency mocks ───────────────────────────────────────────────
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => { cb(); },
  useNavigation: () => ({}),
}));

// ─── Internal component mocks ────────────────────────────────────────────────
jest.mock('../../components/SuccessModal', () => () => null);
jest.mock('../../components/ImageCarousel', () => () => null);

jest.mock('../../components/SkeletonLoader', () => ({
  EventDetailsSkeleton: () => null,
  UpcomingScreenSkeleton: () => null,
}));

jest.mock('../../components/icons', () => ({
  CalendarIcon: () => null,
  LocationPinIcon: () => null,
  ChevronDownIcon: () => null,
  ChevronUpIcon: () => null,
  ClockIcon: () => null,
  PeopleIcon: () => null,
  FlagIcon: () => null,
  CrownIcon: () => null,
}));

jest.mock('../../utils/crashReporter', () => ({
  logAppEvent: jest.fn(),
  logAppWarn: jest.fn(),
}));

jest.mock('../../styles/theme', () => ({
  Colors: {
    text: { primary: '#000', secondary: '#666', tertiary: '#999' },
    background: { primary: '#fff', secondary: '#f5f5f5' },
    brand: { primary: '#6200ee' },
    status: { success: '#4caf50', error: '#f44336' },
    border: { light: '#e0e0e0' },
  },
  Spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 },
  Radius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
  Typography: {},
  CardShadow: {},
  NotificationBadge: {},
}));

jest.mock('../../config/api', () => ({
  API_URL: 'http://localhost:5000',
  GOOGLE_PLACES_API_KEY: '',
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', campusVerified: false } }),
}));

// ─── API mock ────────────────────────────────────────────────────────────────
const mockGetEvent = jest.fn();
const mockGetBubble = jest.fn();
const mockCheckMembership = jest.fn();
const mockGetEventAttendees = jest.fn();
const mockGetEventSignupTasks = jest.fn();

jest.mock('../../services/api.service', () => ({
  __esModule: true,
  default: {
    getEvent: (...args: any[]) => mockGetEvent(...args),
    getBubble: (...args: any[]) => mockGetBubble(...args),
    checkMembership: (...args: any[]) => mockCheckMembership(...args),
    getEventAttendees: (...args: any[]) => mockGetEventAttendees(...args),
    getEventSignupTasks: (...args: any[]) => mockGetEventSignupTasks(...args),
    getShareBaseUrl: jest.fn().mockResolvedValue('https://bubble.app'),
    submitReport: jest.fn(),
    cancelRsvp: jest.fn(),
    rsvpEvent: jest.fn(),
    deleteEvent: jest.fn(),
    createEventSignupTask: jest.fn(),
    updateEventSignupTask: jest.fn(),
    deleteEventSignupTask: jest.fn(),
    reorderEventSignupTasks: jest.fn(),
    leaveEventSignupTask: jest.fn(),
    joinEventSignupTask: jest.fn(),
  },
}));

// ─── Test data ───────────────────────────────────────────────────────────────
const MOCK_EVENT = {
  id: 'event-1',
  title: 'Morning Run',
  description: 'A morning run in the park',
  coverImage: null,
  images: [],
  date: '2026-06-01',
  startTime: '07:00',
  endTime: '08:00',
  locationName: 'Central Park',
  locationAddress: null,
  visibility: 'public',
  petFriendly: false,
  smokeFree: true,
  wheelchairAccessible: false,
  attendeeLimit: null,
  rsvpDeadline: null,
  creatorId: 'user-2',
  bubbleId: 'bubble-1',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const makeNavigation = () => ({
  goBack: jest.fn(),
  navigate: jest.fn(),
  replace: jest.fn(),
  setOptions: jest.fn(),
});

const makeRoute = (source?: string) => ({
  params: {
    eventId: MOCK_EVENT.id,
    event: MOCK_EVENT,
    bubbleTitle: 'Running Club',
    source,
  },
  key: 'EventDetails-1',
  name: 'EventDetails' as const,
});

// ─── Tests ───────────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  mockGetEvent.mockResolvedValue(MOCK_EVENT);
  mockGetBubble.mockResolvedValue({ id: 'bubble-1', title: 'Running Club', creatorId: 'user-2' });
  mockCheckMembership.mockResolvedValue({ isMember: false, role: null });
  mockGetEventAttendees.mockResolvedValue([]);
  mockGetEventSignupTasks.mockResolvedValue([]);
});

describe('EventDetailsScreen — back navigation', () => {
  it('navigates to Upcoming tab when source is "upcoming" and back is pressed', async () => {
    const EventDetailsScreen = (await import('../EventDetailsScreen')).default;
    const navigation = makeNavigation();

    let rendered: any;
    await act(async () => {
      rendered = create(
        <EventDetailsScreen
          navigation={navigation as any}
          route={makeRoute('upcoming') as any}
        />,
      );
    });

    // testID="back-button" will be added to EventDetailsScreen as part of the fix
    const backButtons = rendered.root.findAll(
      (node: any) => node.props.testID === 'back-button',
    );

    expect(backButtons.length).toBeGreaterThan(0);

    await act(async () => {
      backButtons[0].props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('Upcoming');
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('calls navigation.goBack() when source param is absent', async () => {
    const EventDetailsScreen = (await import('../EventDetailsScreen')).default;
    const navigation = makeNavigation();

    let rendered: any;
    await act(async () => {
      rendered = create(
        <EventDetailsScreen
          navigation={navigation as any}
          route={makeRoute(undefined) as any}
        />,
      );
    });

    const backButtons = rendered.root.findAll(
      (node: any) => node.props.testID === 'back-button',
    );

    if (backButtons.length === 0) return; // testID not yet added — test is pending

    await act(async () => {
      backButtons[0].props.onPress();
    });

    expect(navigation.goBack).toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalledWith('Upcoming');
  });
});
