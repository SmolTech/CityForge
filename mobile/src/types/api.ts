export interface User {
  id: number;
  email: string;
  username: string;
  is_admin: boolean;
  created_at: string;
}

export interface Tag {
  id: number;
  name: string;
}

export interface Card {
  id: number;
  name: string;
  description: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  hours?: string;
  image_url?: string;
  logo_url?: string;
  slug: string;
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface CardSubmission {
  id: number;
  name: string;
  description: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  status: "pending" | "approved" | "rejected";
  submitted_by?: User;
  created_at: string;
}

export interface ResourceCategory {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  order: number;
}

export interface ResourceItem {
  id: number;
  title: string;
  description?: string;
  url?: string;
  category_id: number;
  category?: ResourceCategory;
  order: number;
}

export interface QuickAccessItem {
  id: number;
  title: string;
  description?: string;
  icon?: string;
  url?: string;
  order: number;
}

export interface SiteConfig {
  site: {
    title: string;
    description: string;
    copyright: string;
    contact_email?: string;
  };
  resources: {
    title: string;
    description: string;
  };
  quickAccess: QuickAccessItem[];
  resourceItems: ResourceItem[];
  footer: {
    copyright: string;
  };
  pagination: {
    defaultLimit: number;
  };
}

export interface SearchResult {
  id: string;
  card_id: number;
  title: string;
  content: string;
  url: string;
  score: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface ApiError {
  error: {
    message: string;
    code: number;
    details?: Record<string, unknown>;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}
