import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { apiClient } from "../api/client";
import { logger } from "../utils/logger";
import type { LoginRequest, RegisterRequest } from "../types/api";
import type { User } from "../types/instance";
import { useInstance } from "./InstanceContext";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { activeInstance, updateToken, updateUser } = useInstance();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Update API client base URL when active instance changes
  useEffect(() => {
    if (activeInstance) {
      apiClient.setBaseUrl(activeInstance.apiUrl);
    }
  }, [activeInstance]);

  // Sync user from active instance
  useEffect(() => {
    if (activeInstance) {
      setUser(activeInstance.user);
      setIsLoading(false);
    } else {
      setUser(null);
      setIsLoading(false);
    }
  }, [activeInstance]);

  // Check auth when active instance changes
  useEffect(() => {
    if (activeInstance?.token) {
      checkAuth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeInstance?.token, activeInstance?.id]);

  const checkAuth = async () => {
    if (!activeInstance) return;

    try {
      if (activeInstance.token) {
        const userData = await apiClient.getCurrentUser();
        setUser(userData);
        await updateUser(activeInstance.id, userData);
      }
    } catch (error) {
      logger.error("Auth check error:", error);
      await updateToken(activeInstance.id, null);
      await updateUser(activeInstance.id, null);
      setUser(null);
    }
  };

  const login = async (credentials: LoginRequest) => {
    if (!activeInstance) {
      throw new Error("No active instance selected");
    }

    setIsLoading(true);
    try {
      const response = await apiClient.login(credentials);
      setUser(response.user);

      // Store token and user in active instance
      await updateToken(activeInstance.id, response.access_token);
      await updateUser(activeInstance.id, response.user);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterRequest) => {
    if (!activeInstance) {
      throw new Error("No active instance selected");
    }

    setIsLoading(true);
    try {
      const response = await apiClient.register(data);
      setUser(response.user);

      // Store token and user in active instance
      await updateToken(activeInstance.id, response.access_token);
      await updateUser(activeInstance.id, response.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (!activeInstance) return;

    setIsLoading(true);
    try {
      await apiClient.logout();
      setUser(null);

      // Clear token and user from active instance
      await updateToken(activeInstance.id, null);
      await updateUser(activeInstance.id, null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    if (!activeInstance) return;

    try {
      const userData = await apiClient.getCurrentUser();
      setUser(userData);
      await updateUser(activeInstance.id, userData);
    } catch (error) {
      logger.error("Error refreshing user:", error);
      setUser(null);
      await updateToken(activeInstance.id, null);
      await updateUser(activeInstance.id, null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
