"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient, User } from "@/lib/api";
import { Navigation } from "@/components/shared";
import { logger } from "@/lib/logger";

export default function SettingsPage() {
  const [, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<
    "profile" | "email" | "password"
  >("profile");

  // Profile form state
  const [profileData, setProfileData] = useState({
    first_name: "",
    last_name: "",
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  // Email form state
  const [emailData, setEmailData] = useState({
    email: "",
    current_password: "",
  });
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");

  // Password form state
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");

  const router = useRouter();

  useEffect(() => {
    loadUserData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadUserData = async () => {
    try {
      if (!apiClient.isAuthenticated()) {
        router.push("/login");
        return;
      }

      const response = await apiClient.getCurrentUser();
      setUser(response.user);
      setProfileData({
        first_name: response.user.first_name,
        last_name: response.user.last_name,
      });
      setEmailData((prev) => ({
        ...prev,
        email: response.user.email,
      }));
    } catch (error) {
      logger.error("Failed to load user data:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMessage("");

    try {
      const response = await apiClient.updateProfile(
        profileData.first_name,
        profileData.last_name
      );
      setUser(response.user);
      setProfileMessage("Profile updated successfully!");
    } catch (error) {
      logger.error("Failed to update profile:", error);
      setProfileMessage("Failed to update profile. Please try again.");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailLoading(true);
    setEmailMessage("");

    if (!emailData.current_password) {
      setEmailMessage("Current password is required to change email.");
      setEmailLoading(false);
      return;
    }

    try {
      const response = await apiClient.updateEmail(
        emailData.email,
        emailData.current_password
      );
      setUser(response.user);
      setEmailMessage("Email updated successfully!");
      setEmailData((prev) => ({ ...prev, current_password: "" }));
    } catch (error: unknown) {
      logger.error("Failed to update email:", error);
      setEmailMessage(
        error instanceof Error
          ? error.message
          : "Failed to update email. Please try again."
      );
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordMessage("");

    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordMessage("New passwords do not match.");
      setPasswordLoading(false);
      return;
    }

    if (passwordData.new_password.length < 6) {
      setPasswordMessage("New password must be at least 6 characters long.");
      setPasswordLoading(false);
      return;
    }

    try {
      await apiClient.updatePassword(
        passwordData.current_password,
        passwordData.new_password
      );
      setPasswordMessage("Password updated successfully!");
      setPasswordData({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
    } catch (error: unknown) {
      logger.error("Failed to update password:", error);
      setPasswordMessage(
        error instanceof Error
          ? error.message
          : "Failed to update password. Please try again."
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation currentPage="Settings" />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Account Settings
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage your account information and preferences.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Settings Navigation */}
          <div className="lg:w-1/4">
            <nav className="space-y-1">
              <button
                onClick={() => setActiveSection("profile")}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                  activeSection === "profile"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                    : "text-gray-700 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700"
                }`}
              >
                Profile Information
              </button>
              <button
                onClick={() => setActiveSection("email")}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                  activeSection === "email"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                    : "text-gray-700 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700"
                }`}
              >
                Email Address
              </button>
              <button
                onClick={() => setActiveSection("password")}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                  activeSection === "password"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                    : "text-gray-700 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700"
                }`}
              >
                Password
              </button>
            </nav>
          </div>

          {/* Settings Content */}
          <div className="lg:w-3/4">
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
              {/* Profile Information Section */}
              {activeSection === "profile" && (
                <div className="p-6">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Profile Information
                  </h2>
                  <form onSubmit={handleProfileSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="first_name"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          First Name
                        </label>
                        <input
                          type="text"
                          id="first_name"
                          name="first_name"
                          value={profileData.first_name}
                          onChange={(e) =>
                            setProfileData((prev) => ({
                              ...prev,
                              first_name: e.target.value,
                            }))
                          }
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="last_name"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          Last Name
                        </label>
                        <input
                          type="text"
                          id="last_name"
                          name="last_name"
                          value={profileData.last_name}
                          onChange={(e) =>
                            setProfileData((prev) => ({
                              ...prev,
                              last_name: e.target.value,
                            }))
                          }
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>

                    {profileMessage && (
                      <div
                        className={`p-3 rounded-md ${
                          profileMessage.includes("successfully")
                            ? "bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-200"
                            : "bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-200"
                        }`}
                      >
                        {profileMessage}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={profileLoading}
                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {profileLoading ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Email Address Section */}
              {activeSection === "email" && (
                <div className="p-6">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Email Address
                  </h2>
                  <form onSubmit={handleEmailSubmit} className="space-y-4">
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Email Address
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={emailData.email}
                        onChange={(e) =>
                          setEmailData((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="current_password_email"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Current Password
                      </label>
                      <input
                        type="password"
                        id="current_password_email"
                        name="current_password"
                        value={emailData.current_password}
                        onChange={(e) =>
                          setEmailData((prev) => ({
                            ...prev,
                            current_password: e.target.value,
                          }))
                        }
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Required to confirm your identity before changing email.
                      </p>
                    </div>

                    {emailMessage && (
                      <div
                        className={`p-3 rounded-md ${
                          emailMessage.includes("successfully")
                            ? "bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-200"
                            : "bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-200"
                        }`}
                      >
                        {emailMessage}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={emailLoading}
                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {emailLoading ? "Updating..." : "Update Email"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Password Section */}
              {activeSection === "password" && (
                <div className="p-6">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Change Password
                  </h2>
                  <form onSubmit={handlePasswordSubmit} className="space-y-4">
                    <div>
                      <label
                        htmlFor="current_password"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Current Password
                      </label>
                      <input
                        type="password"
                        id="current_password"
                        name="current_password"
                        value={passwordData.current_password}
                        onChange={(e) =>
                          setPasswordData((prev) => ({
                            ...prev,
                            current_password: e.target.value,
                          }))
                        }
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="new_password"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        New Password
                      </label>
                      <input
                        type="password"
                        id="new_password"
                        name="new_password"
                        value={passwordData.new_password}
                        onChange={(e) =>
                          setPasswordData((prev) => ({
                            ...prev,
                            new_password: e.target.value,
                          }))
                        }
                        required
                        minLength={6}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Must be at least 6 characters long.
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="confirm_password"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        id="confirm_password"
                        name="confirm_password"
                        value={passwordData.confirm_password}
                        onChange={(e) =>
                          setPasswordData((prev) => ({
                            ...prev,
                            confirm_password: e.target.value,
                          }))
                        }
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    {passwordMessage && (
                      <div
                        className={`p-3 rounded-md ${
                          passwordMessage.includes("successfully")
                            ? "bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-200"
                            : "bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-200"
                        }`}
                      >
                        {passwordMessage}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={passwordLoading}
                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {passwordLoading ? "Updating..." : "Update Password"}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
