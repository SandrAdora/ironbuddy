import { createContext, useContext, useState, useEffect,  } from "react";
import React from "react";
import type {ReactNode} from "react"
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
  email: string;
  password: string;
}

interface UserContextType {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
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
  email: "",
  password: "",
};

// --- Context ---
const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: UserProviderProps) => {
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem("ironbuddy_profile");
    return saved ? (JSON.parse(saved) as UserProfile) : defaultProfile;
  });

  useEffect(() => {
    // Nutze den Namen als Key, falls vorhanden, sonst Fallback auf "ironbuddy"
    const key = profile.name
      ? `${profile.name}_profile`
      : "ironbuddy_profile";
    localStorage.setItem(key, JSON.stringify(profile));
  }, [profile]);

  return (
    <UserContext.Provider value={{ profile, setProfile }}>
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