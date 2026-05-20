import * as SecureStore from "expo-secure-store";
import { logger } from "./logger";

const TOKEN_KEY = "auth_token";

export const tokenStorage = {
  async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (error) {
      logger.error("Error getting token:", error);
      return null;
    }
  },

  async setToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch (error) {
      logger.error("Error setting token:", error);
    }
  },

  async removeToken(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch (error) {
      logger.error("Error removing token:", error);
    }
  },
};
