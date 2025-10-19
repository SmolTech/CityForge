"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient, User } from "@/lib/api";
import { useConfig } from "@/contexts/ConfigContext";
import { logger } from "@/lib/logger";
import { NAV_ITEMS, AUTH_NAV_ITEMS, NavItem } from "@/lib/navigation-config";

interface NavigationProps {
  currentPage?: string;
  showWelcomeMessage?: boolean;
  siteTitle?: string;
}

export default function Navigation({
  currentPage = "",
  showWelcomeMessage = false,
  siteTitle,
}: NavigationProps) {
  const config = useConfig();
  const actualSiteTitle = siteTitle || config.site.title;
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Skip auth check on pages that already do their own auth check
    // This prevents redundant API calls and rate limiting
    const pagesWithAuthCheck = ["Dashboard", "Settings", "Admin"];
    if (!pagesWithAuthCheck.includes(currentPage)) {
      checkAuth();
    } else {
      // Still need to mark as not loading even if we skip the check
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (userMenuOpen && !target.closest(".user-menu-container")) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userMenuOpen]);

  const checkAuth = async () => {
    if (apiClient.isAuthenticated()) {
      try {
        const userResponse = await apiClient.getCurrentUser();
        setUser(userResponse.user);
        setIsAuthenticated(true);
      } catch (error) {
        logger.error("Failed to get user:", error);
        setIsAuthenticated(false);
      }
    } else {
      setIsAuthenticated(false);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await apiClient.logout();
    setUser(null);
    setIsAuthenticated(false);
    router.push("/");
  };

  // Helper function to determine if a nav item should be shown
  const shouldShowNavItem = (item: NavItem): boolean => {
    if (item.requiresAuth && !isAuthenticated) {
      return item.showLockedWhenGuest || false;
    }
    if (item.requiresGuest && isAuthenticated) {
      return false;
    }
    return true;
  };

  // Helper function to determine if a nav item is locked (shown but disabled)
  const isNavItemLocked = (item: NavItem): boolean => {
    return !!item.showLockedWhenGuest && !isAuthenticated;
  };

  // Helper to get desktop nav link classes
  const getDesktopNavClass = (itemLabel: string): string => {
    return currentPage === itemLabel
      ? "text-blue-600 dark:text-blue-400 font-semibold"
      : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400";
  };

  // Helper to get mobile nav link classes
  const getMobileNavClass = (itemLabel: string): string => {
    return `block px-3 py-2 rounded-md text-base font-medium ${
      currentPage === itemLabel
        ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900"
        : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700"
    }`;
  };

  return (
    <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm border-b border-gray-200 dark:border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center">
            <Link
              href="/"
              className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white"
            >
              {actualSiteTitle}
            </Link>
            {showWelcomeMessage && user && (
              <p className="hidden sm:block text-sm text-gray-600 dark:text-gray-400 ml-4">
                Welcome back, {user.first_name}!
              </p>
            )}
            {showWelcomeMessage && currentPage && (
              <p className="hidden sm:block text-sm text-gray-600 dark:text-gray-400 ml-4">
                {currentPage}
              </p>
            )}
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            {NAV_ITEMS.map((item) => {
              // Skip rendering auth-dependent items while loading
              if (loading && (item.requiresAuth || item.showLockedWhenGuest)) {
                return null;
              }

              if (!shouldShowNavItem(item)) return null;

              const isLocked = isNavItemLocked(item);

              if (isLocked) {
                return (
                  <div key={item.href} className="relative group">
                    <span className="text-gray-400 dark:text-gray-500 cursor-not-allowed">
                      {item.label}
                    </span>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-200 whitespace-nowrap z-50">
                      {item.lockedTooltip}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900 dark:border-b-gray-700"></div>
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={getDesktopNavClass(item.label)}
                >
                  {item.label}
                </Link>
              );
            })}
            {!loading && (
              <>
                {isAuthenticated ? (
                  <div className="relative user-menu-container">
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex items-center text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium"
                    >
                      {user?.first_name}
                      <svg
                        className="ml-1 h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                        />
                      </svg>
                    </button>
                    {userMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl py-1 border border-gray-200 dark:border-slate-700 z-50">
                        <Link
                          href="/settings"
                          className="block px-4 py-2 text-sm text-right text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-lg mx-1"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          My Settings
                        </Link>
                        {user?.role === "admin" && (
                          <>
                            <Link
                              href="/site-config"
                              className="block px-4 py-2 text-sm text-right text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-lg mx-1"
                              onClick={() => setUserMenuOpen(false)}
                            >
                              Site Settings
                            </Link>
                            <Link
                              href="/admin"
                              className="block px-4 py-2 text-sm text-right text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-lg mx-1"
                              onClick={() => setUserMenuOpen(false)}
                            >
                              Admin
                            </Link>
                          </>
                        )}
                        <button
                          onClick={() => {
                            handleLogout();
                            setUserMenuOpen(false);
                          }}
                          className="block w-full text-right px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-lg mx-1"
                        >
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {AUTH_NAV_ITEMS.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={
                          item.label === "Sign Up"
                            ? "bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                            : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                        }
                      >
                        {item.label}
                      </Link>
                    ))}
                  </>
                )}
              </>
            )}
          </nav>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {!mobileMenuOpen ? (
                <svg
                  className="block h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                </svg>
              ) : (
                <svg
                  className="block h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-gray-200 dark:border-gray-700">
              {showWelcomeMessage && user && (
                <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                  Welcome back, {user.first_name}!
                </div>
              )}
              {NAV_ITEMS.map((item) => {
                // Skip rendering auth-dependent items while loading
                if (
                  loading &&
                  (item.requiresAuth || item.showLockedWhenGuest)
                ) {
                  return null;
                }

                if (!shouldShowNavItem(item)) return null;

                const isLocked = isNavItemLocked(item);

                if (isLocked) {
                  return (
                    <div key={item.href} className="relative group">
                      <span className="block px-3 py-2 rounded-md text-base font-medium text-gray-400 dark:text-gray-500 cursor-not-allowed">
                        {item.label}
                      </span>
                      <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-200 whitespace-nowrap z-50">
                        {item.lockedTooltip}
                        <div className="absolute right-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-900 dark:border-r-gray-700"></div>
                      </div>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={getMobileNavClass(item.label)}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
              {!loading && (
                <>
                  {isAuthenticated ? (
                    <>
                      <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
                      <div className="px-3 py-2">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                          {user?.first_name}
                        </p>
                        <Link
                          href="/settings"
                          className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          My Settings
                        </Link>
                        {user?.role === "admin" && (
                          <>
                            <Link
                              href="/site-config"
                              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              Site Settings
                            </Link>
                            <Link
                              href="/admin"
                              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              Admin
                            </Link>
                          </>
                        )}
                        <button
                          onClick={() => {
                            handleLogout();
                            setMobileMenuOpen(false);
                          }}
                          className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          Logout
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {AUTH_NAV_ITEMS.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={
                            item.label === "Sign Up"
                              ? "block px-3 py-2 rounded-md text-base font-medium bg-blue-600 text-white hover:bg-blue-700"
                              : "block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                          }
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
