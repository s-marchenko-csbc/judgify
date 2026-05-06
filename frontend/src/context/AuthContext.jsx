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
const PROFILE_STORAGE_FIELDS = [
  "accountKey",
  "id",
  "email",
  "username",
  "displayName",
  "primaryRole",
  "language",
  "country",
  "organization",
  "bio",
  "position",
  "phone",
  "city",
  "skills",
  "interests",
  "notifications",
  "links",
];

function stripSensitiveFields(value = {}) {
  return Object.entries(value || {}).reduce((acc, [key, item]) => {
    if (!SENSITIVE_PROFILE_KEYS.has(key)) acc[key] = item;
    return acc;
  }, {});
}

function isDataUrl(value) {
  return typeof value === "string" && value.trim().toLowerCase().startsWith("data:");
}

function compactString(value, maxLength = 1000) {
  return typeof value === "string" ? value.slice(0, maxLength) : value;
}

function compactStringList(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string").map((item) => item.slice(0, 120)).slice(0, 50)
    : [];
}

function compactLinks(value = {}) {
  return Object.entries(value || {}).reduce((acc, [key, item]) => {
    if (typeof item === "string" && item && !isDataUrl(item)) {
      acc[key] = item.slice(0, 500);
    }
    return acc;
  }, {});
}

function compactNotifications(value = {}) {
  return Object.entries(value || {}).reduce((acc, [key, item]) => {
    acc[key] = Boolean(item);
    return acc;
  }, {});
}

function compactStoredProfile(value = {}) {
  const safe = stripSensitiveFields(value);
  const compact = {};
  PROFILE_STORAGE_FIELDS.forEach((key) => {
    if (safe[key] === undefined || safe[key] === null) return;
    if (key === "skills" || key === "interests") {
      compact[key] = compactStringList(safe[key]);
    } else if (key === "links") {
      compact[key] = compactLinks(safe[key]);
    } else if (key === "notifications") {
      compact[key] = compactNotifications(safe[key]);
    } else if (typeof safe[key] === "string") {
      compact[key] = isDataUrl(safe[key]) ? "" : compactString(safe[key]);
    } else if (typeof safe[key] === "number" || typeof safe[key] === "boolean") {
      compact[key] = safe[key];
    }
  });
  return compact;
}

function sanitizeProfileStore(store = {}) {
  return Object.entries(store || {}).reduce((acc, [key, value]) => {
    const compact = compactStoredProfile(value);
    if (Object.keys(compact).length > 0) {
      acc[key] = compact;
    }
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
  const sanitized = sanitizeProfileStore(store);
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (error) {
    if (error?.name === "QuotaExceededError") {
      try {
        localStorage.removeItem(PROFILE_STORAGE_KEY);
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(sanitized));
      } catch {
        localStorage.removeItem(PROFILE_STORAGE_KEY);
      }
      return;
    }
    throw error;
  }
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
      const storedProfile = compactStoredProfile({
        ...userStorageKeys(mergedUser).reduce((acc, key) => ({ ...acc, ...(store[key] || {}) }), {}),
        ...safeUserData,
        ...mergedUser,
      });
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
      const storedProfile = compactStoredProfile({
        ...userStorageKeys(prev).reduce((acc, key) => ({ ...acc, ...(store[key] || {}) }), {}),
        ...userStorageKeys(next).reduce((acc, key) => ({ ...acc, ...(store[key] || {}) }), {}),
        ...stripSensitiveFields(next),
      });
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
      authSessionKey: user ? userKey(user) : "anonymous",
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
