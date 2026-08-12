import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type WebUser = {
  id: string;
  name: string;
  email: string;
  interests: string[];
  profilePhoto?: string | null;
  isSuperAdmin?: boolean;
};

type AuthContextType = {
  user: WebUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: { name: string; email: string; password: string; interests: string[] }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "bubble_web_token";
const USER_KEY = "bubble_web_user";

export function getStoredToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<WebUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore the persisted session, but only treat it as authenticated after
  // the server confirms the token is still valid. On 401/403 the stale
  // credentials are cleared so login pages work again (no forced redirect to
  // the app with a dead token). On network failure we keep the cached
  // session rather than logging the user out while offline.
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      let storedToken: string | null = null;
      let storedUser: string | null = null;
      try {
        storedToken = localStorage.getItem(TOKEN_KEY);
        storedUser = localStorage.getItem(USER_KEY);
      } catch {}
      if (!storedToken || !storedUser) {
        if (!cancelled) setIsLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json().catch(() => null);
          setToken(storedToken);
          // Prefer fresh server data; fall back to the cached copy.
          setUser(data?.user ?? data ?? JSON.parse(storedUser));
        } else if (res.status === 401 || res.status === 403) {
          try {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
          } catch {}
        } else {
          // Server hiccup (5xx etc.) — keep the cached session.
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch {
        // Network failure — keep the cached session.
        if (!cancelled) {
          try {
            setToken(storedToken);
            setUser(JSON.parse(storedUser!));
          } catch {}
        }
      }
      if (!cancelled) setIsLoading(false);
    };
    restore();
    return () => { cancelled = true; };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Invalid email or password");
    }
    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  };

  const signup = async (body: { name: string; email: string; password: string; interests: string[] }) => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Sign up failed");
    }
    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
