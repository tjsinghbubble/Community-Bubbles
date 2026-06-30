/**
 * Navigation tests for MyBubblesScreen.
 *
 * These tests FAIL until the fix is applied:
 *   handleBubblePress must navigate within the Bubbles stack
 *   (navigate('BubbleDetails', { bubble })) instead of cross-navigating
 *   to the Explore tab (navigate('Explore', { screen: 'BubbleDetails', ... })).
 *
 * The bug: tapping a bubble in the Bubbles tab switches focus to the Explore
 * tab and makes the back button return to ExploreList instead of MyBubblesList.
 *
 * The fix requires two changes:
 *   1. Add BubbleDetails (and related detail screens) to BubblesNavigator.
 *   2. Change handleBubblePress to call navigation.navigate('BubbleDetails', { bubble }).
 */

import React from 'react';
import { act, create } from 'react-test-renderer';

// ─── Native dependency mocks ──────────────────────────────────────────────────
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));

// ─── Navigation mock ──────────────────────────────────────────────────────────
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => { cb(); },
  useNavigation: () => ({ navigate: mockNavigate }),
}));

// ─── Internal component mocks ─────────────────────────────────────────────────
jest.mock('../../../components/AnimatedPressable', () => {
  const React = require('react');
  return function AnimatedPressable({ onPress, testID, children }: any) {
    return React.createElement('AnimatedPressable', { onPress, testID }, children);
  };
});

jest.mock('../../../components/icons', () => ({
  CreateBubbleEventIcon: () => null,
}));

jest.mock('../../../utils/mediaUrl', () => ({
  resolveMediaUrl: () => null,
}));

jest.mock('../../../utils/categoryImages', () => ({
  getFallbackImage: () => null,
}));

jest.mock('../../../styles/theme', () => ({
  Colors: {
    text: { primary: '#000', secondary: '#666' },
    background: { primary: '#fff', secondary: '#f5f5f5' },
    brand: { primary: '#6200ee', bubbleBlue: '#0088ff', skyWhite: '#fff' },
    neutral: { charcoal: '#333' },
    status: { error: '#f44336' },
  },
  Spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 },
  Radius: { sm: 4, md: 8, lg: 12, xl: 16 },
  Typography: {
    sizes: { xs: 10, sm: 12, md: 14, lg: 16 },
    weights: { medium: '500', bold: '700' },
  },
  Gradients: {},
  NotificationBadge: { badge: {}, badgeText: {} },
  CardShadow: {},
  Layout: { gridColumnGap: 12, gridScreenPadding: 16 },
}));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', campusVerified: false } }),
}));

// ─── API mock ─────────────────────────────────────────────────────────────────
const mockGetMyBubbles = jest.fn();
const mockGetMyCreatedBubbles = jest.fn();
const mockGetUnreadNotificationCount = jest.fn();

jest.mock('../../../services/api.service', () => ({
  __esModule: true,
  default: {
    getMyBubbles: (...args: any[]) => mockGetMyBubbles(...args),
    getMyCreatedBubbles: (...args: any[]) => mockGetMyCreatedBubbles(...args),
    getUnreadNotificationCount: (...args: any[]) => mockGetUnreadNotificationCount(...args),
  },
}));

// ─── Test data ────────────────────────────────────────────────────────────────
const MOCK_BUBBLE = {
  id: 'bubble-1',
  title: 'Studio Hoppers',
  tagline: 'Art crawls across the city',
  category: 'Art',
  members: 12,
  coverImage: null,
  distance: '0.5 mi',
  creatorId: 'user-2',
  status: 'approved' as const,
  campusId: null,
};

// ─── Setup ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  mockGetMyBubbles.mockResolvedValue([MOCK_BUBBLE]);
  mockGetMyCreatedBubbles.mockResolvedValue([]);
  mockGetUnreadNotificationCount.mockResolvedValue({ count: 0 });
});

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('MyBubblesScreen — bubble card navigation', () => {
  it('navigates within the Bubbles stack (not to Explore tab) when a bubble card is pressed', async () => {
    const MyBubblesScreen = require('../MyBubblesScreen').default;

    let rendered: any;
    await act(async () => {
      rendered = create(<MyBubblesScreen />);
    });

    const cards = rendered.root.findAll(
      (node: any) => node.props.testID === `card-bubble-${MOCK_BUBBLE.id}`,
    );
    expect(cards.length).toBeGreaterThan(0);

    await act(async () => {
      cards[0].props.onPress();
    });

    // Must NOT cross-navigate to the Explore tab
    expect(mockNavigate).not.toHaveBeenCalledWith('Explore', expect.anything());

    // Must navigate within the Bubbles stack
    expect(mockNavigate).toHaveBeenCalledWith('BubbleDetails', {
      bubble: expect.objectContaining({ id: MOCK_BUBBLE.id }),
    });
  });

  it('passes the correct bubble data when navigating to BubbleDetails', async () => {
    const MyBubblesScreen = require('../MyBubblesScreen').default;

    let rendered: any;
    await act(async () => {
      rendered = create(<MyBubblesScreen />);
    });

    const cards = rendered.root.findAll(
      (node: any) => node.props.testID === `card-bubble-${MOCK_BUBBLE.id}`,
    );
    if (cards.length === 0) return;

    await act(async () => {
      cards[0].props.onPress();
    });

    const [, params] = mockNavigate.mock.calls[0];
    expect(params.bubble).toMatchObject({
      id: MOCK_BUBBLE.id,
      title: MOCK_BUBBLE.title,
      category: MOCK_BUBBLE.category,
    });
  });
});
