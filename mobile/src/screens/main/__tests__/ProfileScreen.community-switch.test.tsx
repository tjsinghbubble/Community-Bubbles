import React from 'react';
import { act, create } from 'react-test-renderer';

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator',
  Image: 'Image',
  Platform: { OS: 'ios' },
  StatusBar: { currentHeight: 0 },
  Alert: { alert: jest.fn() },
  Clipboard: { setString: jest.fn() },
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
    hairlineWidth: 1,
  },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
  },
}));
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaView: ({ children, ...props }: any) => React.createElement('SafeAreaView', props, children),
  };
});

const mockNavigate = jest.fn();
const mockParentNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useNavigation: () => ({
      navigate: mockNavigate,
      getParent: () => ({ navigate: mockParentNavigate }),
    }),
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(callback, []);
    },
  };
});

jest.mock('../../../components/AnimatedPressable', () => {
  const React = require('react');
  return function AnimatedPressable({ onPress, testID, children }: any) {
    return React.createElement('AnimatedPressable', { onPress, testID }, children);
  };
});

jest.mock('../../../components/icons', () => ({
  ClockIcon: () => null,
  EditIcon: () => null,
}));

jest.mock('../../../utils/crashReporter', () => ({
  logAppEvent: jest.fn(),
  logAppWarn: jest.fn(),
}));

jest.mock('../../../styles/theme', () => ({
  Colors: {
    text: { primary: '#111', secondary: '#555', tertiary: '#999' },
    background: {
      primary: '#fff',
      secondary: '#fafafa',
      surface: '#f5f6f8',
      brandTint: '#ebf5ff',
    },
    border: { light: '#f0f0f0' },
    brand: { primary: '#35a8f7', bubbleBlue: '#35a8f7', midnight: '#111', skyWhite: '#fff' },
    neutral: { charcoal: '#555', lightSilver: '#ddd' },
    status: { error: '#f00', warning: '#f90' },
  },
  Spacing: { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 },
  Radius: { sm: 8, md: 12, lg: 16, xl: 24 },
  Typography: {
    sizes: { xxs: 9, xs: 10, sm: 11, base: 14, md: 16, lg: 18, xl: 20, xxl: 24, hero: 34 },
    lineHeight: { sm: 15, base: 19 },
    weights: { medium: '500', semiBold: '600', bold: '700' },
  },
  CardShadow: {},
}));

let mockUser: any;
const mockLogout = jest.fn();

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    token: 'test-token',
    logout: mockLogout,
  }),
}));

const mockGetMyCampus = jest.fn();

jest.mock('../../../services/api.service', () => ({
  __esModule: true,
  default: {
    setToken: jest.fn(),
    getMyCampus: (...args: any[]) => mockGetMyCampus(...args),
    getMyBubbles: jest.fn().mockResolvedValue([]),
    getUnreadNotificationCount: jest.fn().mockResolvedValue({ count: 0 }),
    getAdminPendingCount: jest.fn().mockResolvedValue({ count: 0 }),
    getErrorLogCount: jest.fn().mockResolvedValue({ count: 0 }),
  },
}));

const baseUser = {
  id: 'user-1',
  name: 'Alex',
  email: 'alex@example.com',
  interests: ['Running'],
  campusVerified: false,
  isSuperAdmin: false,
  cityName: 'Oakland',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { ...baseUser };
  mockGetMyCampus.mockResolvedValue({
    campus: { id: 'campus-1', name: 'UC Berkeley', domain: 'berkeley.edu' },
    verified: true,
  });
});

describe('ProfileScreen community switch', () => {
  it('stays hidden until campus verification is complete', async () => {
    const ProfileScreen = require('../ProfileScreen').default;
    let rendered: any;

    await act(async () => {
      rendered = create(<ProfileScreen />);
    });

    expect(rendered.root.findAll((node: any) => node.props.testID === 'card-explore-mode-switch')).toHaveLength(0);

    await act(async () => {
      rendered.unmount();
    });
  });

  it('shows dynamic campus and city labels and opens the requested Explore mode', async () => {
    mockUser = { ...baseUser, campusVerified: true };
    const ProfileScreen = require('../ProfileScreen').default;
    let rendered: any;

    await act(async () => {
      rendered = create(<ProfileScreen />);
    });

    expect(rendered.root.findAll((node: any) => node.props.testID === 'card-explore-mode-switch')).toHaveLength(1);

    const campusButton = rendered.root.find((node: any) => node.props.testID === 'button-switch-campus');
    const cityButton = rendered.root.find((node: any) => node.props.testID === 'button-switch-city');
    expect(campusButton.props.accessibilityLabel).toBe('Switch to Campus, UC Berkeley');
    expect(cityButton.props.accessibilityLabel).toBe('Switch to City, Oakland');

    await act(async () => {
      campusButton.props.onPress();
      cityButton.props.onPress();
    });

    expect(mockParentNavigate).toHaveBeenNthCalledWith(1, 'Explore', {
      screen: 'ExploreList',
      params: { mode: 'campus' },
    });
    expect(mockParentNavigate).toHaveBeenNthCalledWith(2, 'Explore', {
      screen: 'ExploreList',
      params: { mode: 'city' },
    });

    await act(async () => {
      rendered.unmount();
    });
  });
});