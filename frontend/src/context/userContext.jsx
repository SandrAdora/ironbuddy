import { createContext, useContext, useState, useEffect } from "react";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem("ironbuddy_profile");
    return saved
      ? JSON.parse(saved)
      : {
          onboarded: false,   // wichtig: Onboarding soll starten
          name: "",
          age: null,
          weight: null,
          fitnessGoals: "",
          experienceLevel: "",
          equipments: [],
          allergies: [],
          injuries: [],
          email: "",
          password: "",
        };
  });

  useEffect(() => {
    localStorage.setItem("ironbuddy_profile", JSON.stringify(profile));
  }, [profile]);

  return (
    <UserContext.Provider value={{ profile, setProfile }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
