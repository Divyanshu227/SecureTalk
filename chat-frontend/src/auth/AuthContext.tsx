import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import type { AuthContextType, User } from "../types";
import { clearLocalDb } from "../db/localDb";

const AuthContext = createContext<AuthContextType | undefined>(undefined);
// explanation: This file defines an authentication context for a React application. It provides a way to manage and access authentication state (like the current user and token) throughout the app using React's Context API.
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token")
  );

  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const login = (jwt: string, userData: User) => {
    localStorage.setItem("token", jwt);
    localStorage.setItem("user", JSON.stringify(userData));
    setToken(jwt);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    clearLocalDb().catch(console.error);
  };

  const value: AuthContextType = {
    token,
    user,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
};
