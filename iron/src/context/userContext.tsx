import { createContext, useContext, useState, useEffect, useCallback } from "react";
import React from "react";
import type { ReactNode } from "react";
import { apiLogin, apiGetProfile, apiSaveProfile } from "../api";

// --- Types ---
export interface UserProfile {
  onboarded: boolean;
  name: string;
  birthdate: string | null;
  gender: string;
  weight: number | null;
  height: number | null;
  fitnessGoals: string;
  experienceLevel: string;
  equipments: string;
  allergies: string[];
  injuries: string[];
  disclaimerAcceptedAt: string | null;
  profilePicture: string;
  communityVisible: boolean;
  preferredIngredients: string[];
  excludedIngredients: string[];
  email: string;
  password: string;
}

interface UserContextType {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  token: string | null;
  login: (email: string, password: string, initialProfile?: Partial<UserProfile>) => Promise<string>;
  logout: () => void;
}

interface UserProviderProps {
  children: ReactNode;
}

// --- Default Profile ---
const defaultProfile: UserProfile = {
  onboarded: false,
  name: "",
  birthdate: null,
  gender: "",
  weight: null,
  height: null,
  fitnessGoals: "",
  experienceLevel: "",
  equipments: "",
  allergies: [],
  injuries: [],
  disclaimerAcceptedAt: null,
  profilePicture: "",
  communityVisible: false,
  preferredIngredients: [],
  excludedIngredients: [],
  email: "",
  password: "",
};

// --- Token helpers ---
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Consider expired if less than 60 seconds remaining
    return payload.exp < Date.now() / 1000 + 60;
  } catch {
    return true;
  }
}

async function doRefresh(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch('/api/token/refresh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access ?? null;
  } catch {
    return null;
  }
}

// --- Context ---
const UserContext = createContext<UserContextType | undefined>(undefined);

const profileKey = (email: string) => `ironbuddy_profile_${email}`;

export const UserProvider = ({ children }: UserProviderProps) => {
  const [profile, setProfile] = useState<UserProfile>(() => {
    const lastEmail = localStorage.getItem("ironbuddy_last_email");
    if (lastEmail) {
      const saved = localStorage.getItem(profileKey(lastEmail));
      if (saved) return JSON.parse(saved) as UserProfile;
    }
    return defaultProfile;
  });

  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("ironbuddy_token")
  );

  // --- Token refresh logic ---
  const applyNewToken = useCallback((newToken: string) => {
    setToken(newToken);
    localStorage.setItem("ironbuddy_token", newToken);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem("ironbuddy_token");
    localStorage.removeItem("ironbuddy_refresh");
    localStorage.removeItem("ironbuddy_last_email");
    setProfile(defaultProfile);
  }, []);

  // On startup: if stored token is expired, refresh it immediately
  useEffect(() => {
    if (!token) return;
    if (!isTokenExpired(token)) return;

    const refresh = localStorage.getItem("ironbuddy_refresh");
    if (!refresh) { logout(); return; }

    doRefresh(refresh).then((newToken) => {
      if (newToken) {
        applyNewToken(newToken);
      } else {
        logout(); // refresh token also expired — force re-login
      }
    });
  }, []); // run once on mount

  // Proactive refresh every 25 minutes (access token lasts 30 min)
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(async () => {
      const refresh = localStorage.getItem("ironbuddy_refresh");
      if (!refresh) return;
      const newToken = await doRefresh(refresh);
      if (newToken) {
        applyNewToken(newToken);
      } else {
        logout();
      }
    }, 25 * 60 * 1000);

    return () => clearInterval(interval);
  }, [token, applyNewToken, logout]);

  // Sync profile to localStorage and backend on every change
  useEffect(() => {
    if (profile.email) {
      localStorage.setItem(profileKey(profile.email), JSON.stringify(profile));
      if (token && profile.onboarded) {
        const { email: _e, password: _p, onboarded: _o, ...profileData } = profile;
        apiSaveProfile(token, profileData as Record<string, unknown>).catch(() => {});
      }
    }
  }, [profile]);

  const login = async (email: string, password: string, initialProfile?: Partial<UserProfile>): Promise<string> => {
    const data = await apiLogin(email, password);
    setToken(data.access);
    localStorage.setItem("ironbuddy_token", data.access);
    localStorage.setItem("ironbuddy_refresh", data.refresh);
    localStorage.setItem("ironbuddy_last_email", email);

    if (initialProfile) {
      // Registration flow: use the provided profile directly — skip the backend
      // fetch so we don't overwrite with the blank just-created profile.
      // The useEffect will persist this full profile to the backend.
      setProfile({ ...defaultProfile, ...initialProfile, email, onboarded: true });
    } else {
      // Normal login: load profile from backend, merge with any local cache.
      try {
        const backendProfile = await apiGetProfile(data.access);
        const saved = localStorage.getItem(profileKey(email));
        const localProfile = saved ? (JSON.parse(saved) as UserProfile) : null;
        setProfile({
          ...defaultProfile,
          ...(localProfile ?? {}),
          ...(backendProfile as Partial<UserProfile>),
          email,
          onboarded: true,
        });
      } catch {
        const saved = localStorage.getItem(profileKey(email));
        if (saved) {
          setProfile({ ...JSON.parse(saved) as UserProfile, onboarded: true });
        } else {
          setProfile((p) => ({ ...p, email, onboarded: true }));
        }
      }
    }
    return data.access;
  };

  return (
    <UserContext.Provider value={{ profile, setProfile, token, login, logout }}>
      {children}
    </UserContext.Provider>
  );
};

// --- Custom Hook ---
export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
