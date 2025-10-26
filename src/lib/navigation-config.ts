/**
 * Navigation configuration for the application.
 *
 * This module defines the navigation menu structure used across desktop
 * and mobile navigation, providing a single source of truth for menu items.
 */

export interface NavItem {
  label: string;
  href: string;
  /** If true, only show when user is authenticated */
  requiresAuth?: boolean;
  /** If true, only show when user is NOT authenticated */
  requiresGuest?: boolean;
  /**
   * If true, show a disabled state with tooltip when not authenticated
   * (instead of hiding the item)
   */
  showLockedWhenGuest?: boolean;
  /** Tooltip text to show for locked items */
  lockedTooltip?: string;
}

/**
 * Main navigation items shown in the nav bar
 */
export const NAV_ITEMS: NavItem[] = [
  {
    label: "Directory",
    href: "/",
  },
  {
    label: "Search",
    href: "/search",
  },
  {
    label: "Resources",
    href: "/resources",
  },
  {
    label: "Forums",
    href: "/forums",
    requiresAuth: true,
    showLockedWhenGuest: true,
    lockedTooltip: "Login To View Forums",
  },
  {
    label: "Classifieds",
    href: "/classifieds",
    requiresAuth: true,
    showLockedWhenGuest: true,
    lockedTooltip: "Login To View Classifieds",
  },
  {
    label: "Community Support",
    href: "/support",
    requiresAuth: true,
    showLockedWhenGuest: true,
    lockedTooltip: "Login To View Support Requests",
  },
  {
    label: "Dashboard",
    href: "/dashboard",
    requiresAuth: true,
  },
];

/**
 * Authentication-related nav items (shown when NOT authenticated)
 */
export const AUTH_NAV_ITEMS: NavItem[] = [
  {
    label: "Login",
    href: "/login",
    requiresGuest: true,
  },
  {
    label: "Sign Up",
    href: "/register",
    requiresGuest: true,
  },
];
