import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { devLogin, fetchCurrentUser, loginUser, logoutUser, registerUser } from "../api/authApi";
import { ensureCsrfCookie } from "../api/client";

const AuthContext = createContext(undefined);
const PROFILE_STORAGE_KEY = "judgify_profile_state";
const SENSITIVE_PROFILE_KEYS = new Set(["password", "confirmPassword", "currentPassword", "newPassword"]);

function stripSensitiveFields(value = {}) {
  return Object.entries(value || {}).reduce((acc, [key, item]) => {
    if (!SENSITIVE_PROFILE_KEYS.has(key)) acc[key] = item;
    return acc;
  }, {});
}

function sanitizeProfileStore(store = {}) {
  return Object.entries(store || {}).reduce((acc, [key, value]) => {
    acc[key] = stripSensitiveFields(value);
    return acc;
  }, {});
}

function readProfileStore() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY) || "{}";
    const parsed = JSON.parse(raw);
    const sanitized = sanitizeProfileStore(parsed);
    if (JSON.stringify(parsed) !== JSON.stringify(sanitized)) {
      writeProfileStore(sanitized);
    }
    return sanitized;
  } catch {
    return {};
  }
}

function writeProfileStore(store) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(sanitizeProfileStore(store)));
}

function userKey(user) {
  if (!user) return "demo_user";
  if (user.accountKey) return String(user.accountKey);
  const email = (user.email || "").trim().toLowerCase();
  const role = user.primaryRole || "participant";
  if (email) return `email:${email}:role:${role}`;
  if (user.id) return `id:${user.id}`;
  if (user.username) return `username:${user.username}`;
  return `role:${role}`;
}

function userStorageKeys(user) {
  if (!user) return [];
  const keys = new Set([userKey(user)]);
  const email = (user.email || "").trim().toLowerCase();
  const role = user.primaryRole || "participant";
  if (email) keys.add(`email:${email}:role:${role}`);
  if (user.id) keys.add(`id:${user.id}`);
  if (user.username) keys.add(`username:${user.username}`);
  return [...keys];
}

function withStoredProfile(user) {
  if (!user) return null;
  const store = readProfileStore();
  const stored = userStorageKeys(user).reduce((acc, key) => ({ ...acc, ...(store[key] || {}) }), {});
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
    const isDemoLogin = String(userData.accountKey || "").startsWith("demo:");
    const data = isDemoLogin
      ? await devLogin(userData)
      : userData.register
        ? await registerUser(userData)
        : await loginUser(userData);
    const safeUserData = stripSensitiveFields(userData);
    const mergedUser = withStoredProfile({ ...(data.user || {}), ...safeUserData });

    if (mergedUser) {
      const store = readProfileStore();
      const storedProfile = {
        ...userStorageKeys(mergedUser).reduce((acc, key) => ({ ...acc, ...(store[key] || {}) }), {}),
        ...safeUserData,
        ...mergedUser,
      };
      userStorageKeys(mergedUser).forEach((key) => {
        store[key] = storedProfile;
      });
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
      const storedProfile = {
        ...userStorageKeys(prev).reduce((acc, key) => ({ ...acc, ...(store[key] || {}) }), {}),
        ...userStorageKeys(next).reduce((acc, key) => ({ ...acc, ...(store[key] || {}) }), {}),
        ...stripSensitiveFields(next),
      };
      [...userStorageKeys(prev), ...userStorageKeys(next)].forEach((key) => {
        store[key] = storedProfile;
      });
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
