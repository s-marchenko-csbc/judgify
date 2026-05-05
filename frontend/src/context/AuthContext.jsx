import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { devLogin, fetchCurrentUser, logoutUser } from "../api/authApi";
import { ensureCsrfCookie } from "../api/client";

const AuthContext = createContext(undefined);
const PROFILE_STORAGE_KEY = "judgify_profile_state";

function readProfileStore() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeProfileStore(store) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(store));
}

function userKey(user) {
  if (!user) return "demo_user";
  if (user.accountKey) return String(user.accountKey);
  if (user.id) return `id:${user.id}`;
  if (user.username) return `username:${user.username}`;
  const email = user.email || "demo@example.com";
  const role = user.primaryRole || "participant";
  return `email:${email}:role:${role}`;
}

function withStoredProfile(user) {
  if (!user) return null;
  const store = readProfileStore();
  const stored = store[userKey(user)] || {};
  const merged = {
    primaryRole: "participant",
    country: "Ukraine",
    organization: "",
    bio: "",
    language: "",
    interests: [],
    skills: [],
    ...user,
    ...stored,
  };

  return {
    ...merged,
    links: {
      github: "",
      linkedin: "",
      website: "",
      ...(user.links || {}),
      ...(stored.links || {}),
    },
    notifications: {
      saved: true,
      applications: true,
      judging: false,
      ...(user.notifications || {}),
      ...(stored.notifications || {}),
    },
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      await ensureCsrfCookie();
      const data = await fetchCurrentUser();
      setUser(data.authenticated ? withStoredProfile(data.user) : null);
      return data;
    } catch (error) {
      console.error("Failed to load current user", error);
      setUser(null);
      return { authenticated: false, user: null };
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (userData = {}) => {
    const data = await devLogin(userData);
    const mergedUser = withStoredProfile({ ...(data.user || {}), ...userData });

    if (mergedUser) {
      const store = readProfileStore();
      store[userKey(mergedUser)] = {
        ...(store[userKey(mergedUser)] || {}),
        ...userData,
      };
      writeProfileStore(store);
    }

    setUser(mergedUser);
    return mergedUser;
  }, []);

  const updateProfile = useCallback((patch = {}) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        ...patch,
        links: { ...(prev.links || {}), ...(patch.links || {}) },
        notifications: {
          ...(prev.notifications || {}),
          ...(patch.notifications || {}),
        },
      };
      const store = readProfileStore();
      const previousKey = userKey(prev);
      const nextKey = userKey(next);
      const storedProfile = {
        ...(store[previousKey] || {}),
        ...(store[nextKey] || {}),
        ...next,
      };
      store[previousKey] = storedProfile;
      store[nextKey] = storedProfile;
      writeProfileStore(store);
      return next;
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error("Failed to logout", error);
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      updateProfile,
      refreshUser,
      isAuthenticated: Boolean(user?.isRegistered),
    }),
    [user, loading, login, logout, updateProfile, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
