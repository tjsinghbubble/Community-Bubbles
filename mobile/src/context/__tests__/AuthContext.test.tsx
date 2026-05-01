import React, { useEffect, useRef } from 'react';
import { act, create } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../AuthContext';
import { setSentryUser, clearSentryUser } from '../../utils/crashReporter';
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
    login: jest.fn(),
    signup: jest.fn(),
    startSession: jest.fn().mockResolvedValue({ id: 'session-1' }),
    endSession: jest.fn().mockResolvedValue(undefined),
    serverLogout: jest.fn().mockResolvedValue(undefined),
  },
  default: {
    setToken: jest.fn(),
    setOnTokenRevoked: jest.fn(),
    getProfile: jest.fn(),
    login: jest.fn(),
    signup: jest.fn(),
    startSession: jest.fn().mockResolvedValue({ id: 'session-1' }),
    endSession: jest.fn().mockResolvedValue(undefined),
    serverLogout: jest.fn().mockResolvedValue(undefined),
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
const mockLogin = (apiService.login as jest.Mock);
const mockSignup = (apiService.signup as jest.Mock);
const mockSetSentryUser = (setSentryUser as jest.Mock);
const mockClearSentryUser = (clearSentryUser as jest.Mock);

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
type LogoutFn = () => Promise<void>;
type LoginFn = (email: string, password: string) => Promise<void>;
type SignupFn = (name: string, email: string, password: string, interests: string[]) => Promise<void>;

function makeRefreshRef(): React.MutableRefObject<RefreshFn> {
  return { current: async () => {} };
}

function makeLogoutRef(): React.MutableRefObject<LogoutFn> {
  return { current: async () => {} };
}

function makeLoginRef(): React.MutableRefObject<LoginFn> {
  return { current: async () => {} };
}

function makeSignupRef(): React.MutableRefObject<SignupFn> {
  return { current: async () => {} };
}

function TestConsumer({ refreshRef }: { refreshRef: React.MutableRefObject<RefreshFn> }) {
  const { refreshUser } = useAuth();
  useEffect(() => {
    refreshRef.current = refreshUser;
  });
  return null;
}

function TestLogoutConsumer({ logoutRef }: { logoutRef: React.MutableRefObject<LogoutFn> }) {
  const { logout } = useAuth();
  useEffect(() => {
    logoutRef.current = logout;
  });
  return null;
}

function TestLoginConsumer({ loginRef }: { loginRef: React.MutableRefObject<LoginFn> }) {
  const { login } = useAuth();
  useEffect(() => {
    loginRef.current = login;
  });
  return null;
}

function TestSignupConsumer({ signupRef }: { signupRef: React.MutableRefObject<SignupFn> }) {
  const { signup } = useAuth();
  useEffect(() => {
    signupRef.current = signup;
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

describe('logout — Sentry user cleanup', () => {
  async function renderWithStoredUserForLogout(
    storedUser: typeof STORED_USER_REGULAR,
  ): Promise<React.MutableRefObject<LogoutFn>> {
    mockAsyncStorage.getItem.mockImplementation((key: string) => {
      if (key === 'authToken') return Promise.resolve('test-token');
      if (key === 'user') return Promise.resolve(JSON.stringify(storedUser));
      return Promise.resolve(null);
    });
    mockAsyncStorage.removeItem.mockResolvedValue(undefined);

    const logoutRef = makeLogoutRef();

    await act(async () => {
      create(
        <AuthProvider>
          <TestLogoutConsumer logoutRef={logoutRef} />
        </AuthProvider>,
      );
    });

    return logoutRef;
  }

  it('calls clearSentryUser exactly once when the user logs out', async () => {
    const logoutRef = await renderWithStoredUserForLogout(STORED_USER_REGULAR);

    mockClearSentryUser.mockClear();

    await act(async () => {
      await logoutRef.current();
    });

    expect(mockClearSentryUser).toHaveBeenCalledTimes(1);
  });

  it('does not call setSentryUser after clearSentryUser during logout', async () => {
    const logoutRef = await renderWithStoredUserForLogout(STORED_USER_REGULAR);

    mockSetSentryUser.mockClear();
    mockClearSentryUser.mockClear();

    await act(async () => {
      await logoutRef.current();
    });

    expect(mockClearSentryUser).toHaveBeenCalledTimes(1);
    const clearOrder = mockClearSentryUser.mock.invocationCallOrder[0] ?? Infinity;
    const lastSetOrder = mockSetSentryUser.mock.invocationCallOrder.at(-1) ?? 0;
    expect(lastSetOrder).toBeLessThan(clearOrder);
  });
});

describe('login — Sentry user identification', () => {
  const LOGIN_RESPONSE_USER = {
    id: 'user-42',
    name: 'Bob',
    email: 'bob@example.com',
    interests: [],
    isSuperAdmin: false,
  };

  const LOGIN_RESPONSE_SUPER_USER = {
    ...LOGIN_RESPONSE_USER,
    isSuperAdmin: true,
  };

  async function renderForLogin(): Promise<React.MutableRefObject<LoginFn>> {
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);

    const loginRef = makeLoginRef();

    await act(async () => {
      create(
        <AuthProvider>
          <TestLoginConsumer loginRef={loginRef} />
        </AuthProvider>,
      );
    });

    return loginRef;
  }

  it('calls setSentryUser with correct id, name, and isSuperAdmin=false after successful login', async () => {
    const loginRef = await renderForLogin();

    mockLogin.mockResolvedValue({ token: 'login-token', user: LOGIN_RESPONSE_USER });
    mockSetSentryUser.mockClear();

    await act(async () => {
      await loginRef.current('bob@example.com', 'password123');
    });

    expect(mockSetSentryUser).toHaveBeenCalledTimes(1);
    expect(mockSetSentryUser).toHaveBeenCalledWith(
      LOGIN_RESPONSE_USER.id,
      LOGIN_RESPONSE_USER.name,
      false,
    );
  });

  it('calls setSentryUser with isSuperAdmin=true when logging in as a super-admin', async () => {
    const loginRef = await renderForLogin();

    mockLogin.mockResolvedValue({ token: 'login-token', user: LOGIN_RESPONSE_SUPER_USER });
    mockSetSentryUser.mockClear();

    await act(async () => {
      await loginRef.current('bob@example.com', 'password123');
    });

    expect(mockSetSentryUser).toHaveBeenCalledTimes(1);
    expect(mockSetSentryUser).toHaveBeenCalledWith(
      LOGIN_RESPONSE_SUPER_USER.id,
      LOGIN_RESPONSE_SUPER_USER.name,
      true,
    );
  });
});

describe('signup — Sentry user identification', () => {
  const SIGNUP_RESPONSE_USER = {
    id: 'user-99',
    name: 'Carol',
    email: 'carol@example.com',
    interests: ['hiking', 'music'],
    isSuperAdmin: false,
  };

  async function renderForSignup(): Promise<React.MutableRefObject<SignupFn>> {
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);

    const signupRef = makeSignupRef();

    await act(async () => {
      create(
        <AuthProvider>
          <TestSignupConsumer signupRef={signupRef} />
        </AuthProvider>,
      );
    });

    return signupRef;
  }

  it('calls setSentryUser with correct id, name, and isSuperAdmin=false after successful signup', async () => {
    const signupRef = await renderForSignup();

    mockSignup.mockResolvedValue({ token: 'signup-token', user: SIGNUP_RESPONSE_USER });
    mockSetSentryUser.mockClear();

    await act(async () => {
      await signupRef.current('Carol', 'carol@example.com', 'pass456', ['hiking', 'music']);
    });

    expect(mockSetSentryUser).toHaveBeenCalledTimes(1);
    expect(mockSetSentryUser).toHaveBeenCalledWith(
      SIGNUP_RESPONSE_USER.id,
      SIGNUP_RESPONSE_USER.name,
      false,
    );
  });

  it('calls setSentryUser with isSuperAdmin=true when the newly signed-up user is a super-admin', async () => {
    const signupRef = await renderForSignup();

    const superAdminUser = { ...SIGNUP_RESPONSE_USER, isSuperAdmin: true };
    mockSignup.mockResolvedValue({ token: 'signup-token', user: superAdminUser });
    mockSetSentryUser.mockClear();

    await act(async () => {
      await signupRef.current('Carol', 'carol@example.com', 'pass456', ['hiking', 'music']);
    });

    expect(mockSetSentryUser).toHaveBeenCalledTimes(1);
    expect(mockSetSentryUser).toHaveBeenCalledWith(
      superAdminUser.id,
      superAdminUser.name,
      true,
    );
  });
});
