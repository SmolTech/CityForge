"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { apiClient, User } from "@/lib/api";
import { logger } from "@/lib/logger";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = async () => {
    try {
      setError(null);
      const response = await apiClient.getCurrentUser();
      setUser(response.user);
    } catch (error) {
      logger.debug(
        "Failed to get current user (likely not authenticated):",
        error
      );
      setUser(null);
      setError(null); // Don't show errors for unauthenticated state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const isAuthenticated = !!user;
  const isEmailVerified = user?.email_verified ?? false;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        refreshUser,
        isAuthenticated,
        isEmailVerified,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
