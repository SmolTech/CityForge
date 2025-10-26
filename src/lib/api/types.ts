// User types
export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_admin: boolean;
  is_supporter: boolean;
  is_active: boolean;
  created_date: string;
  last_login?: string;
}

// Card types
export interface Card {
  id: number;
  name: string;
  description: string;
  website_url?: string;
  phone_number?: string;
  email?: string;
  address?: string;
  address_override_url?: string;
  contact_name?: string;
  featured: boolean;
  image_url?: string;
  approved: boolean;
  created_date: string;
  updated_date: string;
  tags: string[];
  creator?: User;
  approver?: User;
  approved_date?: string;
  slug?: string;
  share_url?: string;
  average_rating?: number | null;
  review_count?: number;
}

export interface CardSubmission {
  id: number;
  name: string;
  description: string;
  website_url?: string;
  phone_number?: string;
  email?: string;
  address?: string;
  address_override_url?: string;
  contact_name?: string;
  image_url?: string;
  tags_text: string;
  status: "pending" | "approved" | "rejected";
  review_notes?: string;
  created_date: string;
  reviewed_date?: string;
  submitter?: User;
  reviewer?: User;
  card_id?: number;
}

export interface CardModification {
  id: number;
  card_id: number;
  name: string;
  description: string;
  website_url?: string;
  phone_number?: string;
  email?: string;
  address?: string;
  address_override_url?: string;
  contact_name?: string;
  image_url?: string;
  tags_text: string;
  status: "pending" | "approved" | "rejected";
  review_notes?: string;
  created_date: string;
  reviewed_date?: string;
  submitter?: User;
  reviewer?: User;
  card?: Card;
}

export interface Tag {
  name: string;
  count: number;
}

export interface CardsResponse {
  cards: Card[];
  total: number;
  offset: number;
  limit: number;
}

export interface SubmissionsResponse {
  submissions: CardSubmission[];
  total: number;
  offset: number;
  limit: number;
}

export interface ModificationsResponse {
  modifications: CardModification[];
  total: number;
  offset: number;
  limit: number;
}

// Authentication types
export interface AuthResponse {
  user: User;
}

// Resource types
export interface ResourceConfig {
  id: number;
  key: string;
  value: string;
  description?: string;
  created_date: string;
  updated_date: string;
}

export interface QuickAccessItem {
  id: string;
  title: string;
  subtitle: string;
  phone: string;
  color: string;
  icon: string;
}

export interface QuickAccessItemInput {
  identifier: string;
  title: string;
  subtitle: string;
  phone: string;
  color?: string;
  icon?: string;
  display_order?: number;
  is_active?: boolean;
}

export interface ResourceItem {
  id: number;
  title: string;
  url: string;
  description: string;
  category: string;
  phone?: string;
  address?: string;
  icon: string;
}

export interface ResourceItemInput {
  title: string;
  url: string;
  description: string;
  category: string;
  phone?: string;
  address?: string;
  icon?: string;
  display_order?: number;
  is_active?: boolean;
}

// Help Wanted types
export interface HelpWantedPost {
  id: number;
  title: string;
  description: string;
  category: "hiring" | "collaboration" | "general";
  status: "open" | "closed";
  location?: string;
  budget?: string;
  contact_preference?: string;
  report_count: number;
  created_date: string;
  updated_date: string;
  creator?: User;
  comment_count: number;
  comments?: HelpWantedComment[];
}

export interface HelpWantedComment {
  id: number;
  post_id: number;
  content: string;
  parent_id?: number;
  created_date: string;
  updated_date: string;
  creator?: User;
  replies?: HelpWantedComment[];
}

export interface HelpWantedReport {
  id: number;
  post_id: number;
  reason: "spam" | "inappropriate" | "misleading" | "other";
  details?: string;
  status: "pending" | "reviewed" | "resolved";
  created_date: string;
  reviewed_date?: string;
  reporter?: User;
  reviewer?: User;
  resolution_notes?: string;
  post?: HelpWantedPost;
}

export interface HelpWantedPostsResponse {
  posts: HelpWantedPost[];
  total: number;
  offset: number;
  limit: number;
}

export interface HelpWantedReportsResponse {
  reports: HelpWantedReport[];
  total: number;
  offset: number;
  limit: number;
}

// Review types
export interface AdminReview {
  id: number;
  card_id: number;
  rating: number;
  title?: string;
  comment?: string;
  hidden: boolean;
  created_date: string;
  updated_date: string;
  reported: boolean;
  reported_date?: string;
  reported_reason?: string;
  user?: {
    id: number;
    first_name: string;
    last_name: string;
  };
  reporter?: {
    id: number;
    first_name: string;
    last_name: string;
  };
  card?: {
    id: number;
    name: string;
    image_url?: string;
  };
}

export interface AdminReviewsResponse {
  reviews: AdminReview[];
  total: number;
  offset: number;
  limit: number;
}

// Forum types
export interface ForumCategory {
  id: number;
  name: string;
  description: string;
  slug: string;
  display_order: number;
  is_active: boolean;
  created_date: string;
  updated_date: string;
  creator?: User;
  thread_count?: number;
  post_count?: number;
  latest_thread?: ForumThread;
}

export interface ForumCategoryRequest {
  id: number;
  name: string;
  description: string;
  justification: string;
  status: "pending" | "approved" | "rejected";
  created_date: string;
  reviewed_date?: string;
  review_notes?: string;
  requester?: User;
  reviewer?: User;
  category_id?: number;
}

export interface ForumThread {
  id: number;
  category_id: number;
  category?: {
    id: number;
    name: string;
    slug: string;
  };
  title: string;
  slug: string;
  is_pinned: boolean;
  is_locked: boolean;
  report_count: number;
  created_date: string;
  updated_date: string;
  creator?: User;
  post_count: number;
  posts?: ForumPost[];
}

export interface ForumPost {
  id: number;
  thread_id: number;
  content: string;
  is_first_post: boolean;
  report_count: number;
  created_date: string;
  updated_date: string;
  edited_date?: string;
  creator_id: number;
  creator?: User;
  editor?: User;
}

export interface ForumReport {
  id: number;
  thread_id: number;
  post_id?: number;
  reason: "spam" | "inappropriate" | "harassment" | "off_topic" | "other";
  details?: string;
  status: "pending" | "reviewed" | "resolved";
  created_date: string;
  reviewed_date?: string;
  reporter?: User;
  reviewer?: User;
  resolution_notes?: string;
  thread?: ForumThread;
  post?: ForumPost;
}

export interface ForumThreadsResponse {
  threads: ForumThread[];
  total: number;
  offset: number;
  limit: number;
  category?: ForumCategory;
}

export interface ForumReportsResponse {
  reports: ForumReport[];
  total: number;
  offset: number;
  limit: number;
}

export interface ForumCategoryRequestsResponse {
  requests: ForumCategoryRequest[];
  total: number;
  offset: number;
  limit: number;
}
