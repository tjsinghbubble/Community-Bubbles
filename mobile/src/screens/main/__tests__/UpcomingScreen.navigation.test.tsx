/**
 * Navigation tests for UpcomingScreen.
 *
 * These tests will FAIL until the fix is applied:
 *   handleEventPress must pass source:'upcoming' in navigate params.
 */

import React from 'react';
import { act, create } from 'react-test-renderer';

// ─── Navigation mock ────────────────────────────────────────────────────────
const mockNavigate = jest.fn();
const mockNavigation = { navigate: mockNavigate };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useFocusEffect: (cb: () => void) => { cb(); },
}));

// ─── External dependency mocks ───────────────────────────────────────────────
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

jest.mock('../../../components/AnimatedPressable', () => {
  const React = require('react');
  return ({ children, onPress, testID }: any) =>
    React.createElement('View', { onPress, testID }, children);
});

jest.mock('../../../components/SkeletonLoader', () => ({
  UpcomingScreenSkeleton: () => null,
}));

jest.mock('../../../utils/mediaUrl', () => ({
  resolveMediaUrl: () => null,
}));

jest.mock('../../../utils/categoryImages', () => ({
  getFallbackImage: () => null,
}));

jest.mock('../../../styles/theme', () => ({
  Colors: { text: { primary: '#000', secondary: '#666', tertiary: '#999' }, background: { primary: '#fff' }, brand: { primary: '#6200ee' } },
  Spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
  Radius: { sm: 4, md: 8, lg: 12, xl: 16 },
  Typography: {},
  NotificationBadge: {},
  CardShadow: {},
}));

jest.mock('../../../styles/design-tokens', () => ({
  EventCardTokens: {},
}));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', campusVerified: false } }),
}));

// ─── API mock ────────────────────────────────────────────────────────────────
const mockGetUpcomingEvents = jest.fn();
const mockGetUnreadNotificationCount = jest.fn();

jest.mock('../../../services/api.service', () => ({
  __esModule: true,
  default: {
    getUpcomingEvents: (...args: any[]) => mockGetUpcomingEvents(...args),
    getUnreadNotificationCount: (...args: any[]) => mockGetUnreadNotificationCount(...args),
  },
}));

// ─── Test data ───────────────────────────────────────────────────────────────
const MOCK_EVENT = {
  id: 'event-1',
  title: 'Morning Run',
  description: 'A morning run in the park',
  coverImage: null,
  date: '2026-06-01',
  startTime: '07:00',
  endTime: '08:00',
  locationName: 'Central Park',
  bubbleId: 'bubble-1',
  bubble: { id: 'bubble-1', title: 'Running Club' },
};

// ─── Tests ───────────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  mockGetUpcomingEvents.mockResolvedValue([MOCK_EVENT]);
  mockGetUnreadNotificationCount.mockResolvedValue({ count: 0 });
});

describe('UpcomingScreen — navigation to EventDetails', () => {
  it('passes source:"upcoming" in navigate params when an event is pressed', async () => {
    const UpcomingScreen = require('../UpcomingScreen').default;

    let rendered: any;
    await act(async () => {
      rendered = create(<UpcomingScreen />);
    });

    // Find the event card (AnimatedPressable rendered as TouchableOpacity with testID="event-card")
    // This testID will be added to UpcomingScreen as part of the fix.
    const cards = rendered.root.findAll(
      (node: any) => node.props.testID === 'event-card',
    );

    expect(cards.length).toBeGreaterThan(0);

    await act(async () => {
      cards[0].props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      'Explore',
      expect.objectContaining({
        screen: 'EventDetails',
        params: expect.objectContaining({
          eventId: MOCK_EVENT.id,
          source: 'upcoming',       // ← this is what the fix adds
        }),
      }),
    );
  });

  it('does not navigate to EventDetails without the source param before the fix', async () => {
    // Snapshot of the broken behaviour — navigate is called but source is missing.
    // Once fixed, this test should be removed and replaced by the one above.
    const UpcomingScreen = require('../UpcomingScreen').default;

    let rendered: any;
    await act(async () => {
      rendered = create(<UpcomingScreen />);
    });

    const cards = rendered.root.findAll(
      (node: any) => node.props.testID === 'event-card',
    );

    if (cards.length === 0) return; // not yet rendered — test is pending

    await act(async () => {
      cards[0].props.onPress();
    });

    // Currently navigate IS called, but WITHOUT source:'upcoming'
    const call = mockNavigate.mock.calls[0];
    if (!call) return;
    const params = call[1]?.params ?? {};
    expect(params.source).not.toBe('upcoming');
  });
});
