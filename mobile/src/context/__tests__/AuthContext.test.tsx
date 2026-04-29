import React, { useEffect, useRef } from 'react';
import { act, create } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../AuthContext';
import { setSentryUser } from '../../utils/crashReporter';
import { apiService } from '../../services/api.service';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Platform: {
    OS: 'ios',
    select: (obj: Record<string, unknown>) => obj.ios,
  },
}));

jest.mock('../../services/api.service', () => ({
  __esModule: true,
  apiService: {
    setToken: jest.fn(),
    setOnTokenRevoked: jest.fn(),
    getProfile: jest.fn(),
    startSession: jest.fn().mockResolvedValue({ id: 'session-1' }),
    endSession: jest.fn().mockResolvedValue(undefined),
  },
  default: {
    setToken: jest.fn(),
    setOnTokenRevoked: jest.fn(),
    getProfile: jest.fn(),
    startSession: jest.fn().mockResolvedValue({ id: 'session-1' }),
    endSession: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../utils/crashReporter', () => ({
  __esModule: true,
  setSentryUser: jest.fn(),
  clearSentryUser: jest.fn(),
  logAppEvent: jest.fn(),
}));

jest.mock('../../services/cometchat.service', () => ({
  __esModule: true,
  default: {
    init: jest.fn().mockResolvedValue(undefined),
    logoutUser: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const mockAsyncStorage = jest.requireMock('@react-native-async-storage/async-storage').default;
const mockGetProfile = (apiService.getProfile as jest.Mock);
const mockSetSentryUser = (setSentryUser as jest.Mock);

const STORED_USER_REGULAR = {
  id: 'user-1',
  name: 'Alice',
  email: 'alice@example.com',
  interests: [],
  isSuperAdmin: false,
};

const STORED_USER_PROMOTED = {
  ...STORED_USER_REGULAR,
  isSuperAdmin: true,
};

type RefreshFn = () => Promise<void>;

function makeRefreshRef(): React.MutableRefObject<RefreshFn> {
  return { current: async () => {} };
}

function TestConsumer({ refreshRef }: { refreshRef: React.MutableRefObject<RefreshFn> }) {
  const { refreshUser } = useAuth();
  useEffect(() => {
    refreshRef.current = refreshUser;
  });
  return null;
}

async function renderWithStoredUser(
  storedUser: typeof STORED_USER_REGULAR,
): Promise<React.MutableRefObject<RefreshFn>> {
  mockAsyncStorage.getItem.mockImplementation((key: string) => {
    if (key === 'authToken') return Promise.resolve('test-token');
    if (key === 'user') return Promise.resolve(JSON.stringify(storedUser));
    return Promise.resolve(null);
  });
  mockAsyncStorage.setItem.mockResolvedValue(undefined);

  const refreshRef = makeRefreshRef();

  await act(async () => {
    create(
      <AuthProvider>
        <TestConsumer refreshRef={refreshRef} />
      </AuthProvider>,
    );
  });

  return refreshRef;
}

beforeEach(() => {
  jest.clearAllMocks();
  const cometchatMock = jest.requireMock('../../services/cometchat.service').default;
  cometchatMock.init.mockResolvedValue(undefined);
  cometchatMock.logoutUser.mockResolvedValue(undefined);
  const { AppState } = jest.requireMock('react-native');
  AppState.addEventListener.mockReturnValue({ remove: jest.fn() });
  mockAsyncStorage.setItem.mockResolvedValue(undefined);
});

describe('refreshUser — Sentry role propagation', () => {
  it('calls setSentryUser with isSuperAdmin=true after a user is promoted', async () => {
    const refreshRef = await renderWithStoredUser(STORED_USER_REGULAR);

    mockGetProfile.mockResolvedValue(STORED_USER_PROMOTED);
    mockSetSentryUser.mockClear();

    await act(async () => {
      await refreshRef.current();
    });

    expect(mockGetProfile).toHaveBeenCalledTimes(1);
    expect(mockSetSentryUser).toHaveBeenCalledTimes(1);
    expect(mockSetSentryUser).toHaveBeenCalledWith(
      STORED_USER_PROMOTED.id,
      STORED_USER_PROMOTED.name,
      true,
    );
  });

  it('calls setSentryUser with isSuperAdmin=false when a super-admin role is removed', async () => {
    const refreshRef = await renderWithStoredUser({
      ...STORED_USER_REGULAR,
      isSuperAdmin: true,
    });

    mockGetProfile.mockResolvedValue(STORED_USER_REGULAR);
    mockSetSentryUser.mockClear();

    await act(async () => {
      await refreshRef.current();
    });

    expect(mockSetSentryUser).toHaveBeenCalledTimes(1);
    expect(mockSetSentryUser).toHaveBeenCalledWith(
      STORED_USER_REGULAR.id,
      STORED_USER_REGULAR.name,
      false,
    );
  });

  it('does not call setSentryUser when getProfile throws a network error', async () => {
    const refreshRef = await renderWithStoredUser(STORED_USER_REGULAR);

    mockGetProfile.mockRejectedValue(new TypeError('Network request failed'));
    mockSetSentryUser.mockClear();

    await act(async () => {
      await refreshRef.current();
    });

    expect(mockSetSentryUser).not.toHaveBeenCalled();
  });
});
