"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient, User } from "@/lib/api";
import { CLIENT_CONFIG } from "@/lib/client-config";

interface NavigationProps {
  currentPage?: string;
  showWelcomeMessage?: boolean;
  siteTitle?: string;
}

export default function Navigation({
  currentPage = "",
  showWelcomeMessage = false,
  siteTitle = CLIENT_CONFIG.SITE_TITLE,
}: NavigationProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

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
        console.error("Failed to get user:", error);
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

  return (
    <header className="bg-white dark:bg-gray-800 shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center">
            <Link
              href="/"
              className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white"
            >
              {siteTitle}
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
            {!loading && (
              <>
                {isAuthenticated ? (
                  <Link
                    href="/help-wanted"
                    className={`${
                      currentPage === "Help Wanted"
                        ? "text-blue-600 dark:text-blue-400 font-semibold"
                        : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                    }`}
                  >
                    Help Wanted
                  </Link>
                ) : (
                  <div className="relative group">
                    <span className="text-gray-400 dark:text-gray-500 cursor-not-allowed">
                      Help Wanted
                    </span>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-200 whitespace-nowrap z-50">
                      Login To View Help Wanted
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900 dark:border-b-gray-700"></div>
                    </div>
                  </div>
                )}
              </>
            )}
            <Link
              href="/"
              className={`${
                currentPage === "Directory"
                  ? "text-blue-600 dark:text-blue-400 font-semibold"
                  : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
              }`}
            >
              Directory
            </Link>
            <Link
              href="/search"
              className={`${
                currentPage === "Search"
                  ? "text-blue-600 dark:text-blue-400 font-semibold"
                  : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
              }`}
            >
              Search
            </Link>
            <Link
              href="/resources"
              className={`${
                currentPage === "Resources"
                  ? "text-blue-600 dark:text-blue-400 font-semibold"
                  : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
              }`}
            >
              Resources
            </Link>
            {!loading && (
              <>
                {isAuthenticated ? (
                  <>
                    <Link
                      href="/dashboard"
                      className={`${
                        currentPage === "Dashboard"
                          ? "text-blue-600 dark:text-blue-400 font-semibold"
                          : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                      }`}
                    >
                      Dashboard
                    </Link>
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
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 z-50">
                          <Link
                            href="/settings"
                            className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            Settings
                          </Link>
                          {user?.role === "admin" && (
                            <Link
                              href="/admin"
                              className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              onClick={() => setUserMenuOpen(false)}
                            >
                              Admin
                            </Link>
                          )}
                          <button
                            onClick={() => {
                              handleLogout();
                              setUserMenuOpen(false);
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            Logout
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      Login
                    </Link>
                    <Link
                      href="/register"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                    >
                      Sign Up
                    </Link>
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
              {!loading && (
                <>
                  {isAuthenticated ? (
                    <Link
                      href="/help-wanted"
                      className={`block px-3 py-2 rounded-md text-base font-medium ${
                        currentPage === "Help Wanted"
                          ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900"
                          : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Help Wanted
                    </Link>
                  ) : (
                    <div className="relative group">
                      <span className="block px-3 py-2 rounded-md text-base font-medium text-gray-400 dark:text-gray-500 cursor-not-allowed">
                        Help Wanted
                      </span>
                      <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-200 whitespace-nowrap z-50">
                        Login To View Help Wanted
                        <div className="absolute right-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-900 dark:border-r-gray-700"></div>
                      </div>
                    </div>
                  )}
                </>
              )}
              <Link
                href="/"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  currentPage === "Directory"
                    ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900"
                    : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Directory
              </Link>
              <Link
                href="/search"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  currentPage === "Search"
                    ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900"
                    : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Search
              </Link>
              <Link
                href="/resources"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  currentPage === "Resources"
                    ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900"
                    : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Resources
              </Link>
              {!loading && (
                <>
                  {isAuthenticated ? (
                    <>
                      <Link
                        href="/dashboard"
                        className={`block px-3 py-2 rounded-md text-base font-medium ${
                          currentPage === "Dashboard"
                            ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900"
                            : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                        }`}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Dashboard
                      </Link>
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
                          Settings
                        </Link>
                        {user?.role === "admin" && (
                          <Link
                            href="/admin"
                            className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            Admin
                          </Link>
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
                      <Link
                        href="/login"
                        className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Login
                      </Link>
                      <Link
                        href="/register"
                        className="block px-3 py-2 rounded-md text-base font-medium bg-blue-600 text-white hover:bg-blue-700"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Sign Up
                      </Link>
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
