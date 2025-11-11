import { User } from "./api";

export { User };

export interface Instance {
  id: string; // Unique identifier (e.g., "worcester-community")
  name: string; // Display name (e.g., "Worcester Community")
  apiUrl: string; // Backend API URL
  token: string | null; // Auth token for this instance
  user: User | null; // User data for this instance
  lastActive: number; // Timestamp of last use
  createdAt: number; // When this instance was added
}

export interface MultiInstanceState {
  instances: Instance[];
  activeInstanceId: string | null;
}
