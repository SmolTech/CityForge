"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { Navigation } from "@/components/shared";
import { logger } from "@/lib/logger";
import AdminUsers from "@/components/admin/AdminUsers";
import { User } from "@/lib/api";

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPasswordReset, setShowPasswordReset] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const router = useRouter();

  const loadUsers = useCallback(async () => {
    try {
      const params: { page: number; limit: number; search?: string } = {
        page: currentPage,
        limit: 20,
      };

      if (searchQuery) {
        params.search = searchQuery;
      }

      const response = await apiClient.adminGetUsers(params);

      setUsers(response.users);
      setTotalUsers(response.total);
    } catch (error) {
      logger.error("Failed to load users:", error);
    }
  }, [currentPage, searchQuery]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userResponse = await apiClient.getCurrentUser();

        if (userResponse.user.role !== "admin") {
          router.push("/");
          return;
        }

        await loadUsers();
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, loadUsers]);

  const handleEditUser = async (userId: number, data: Partial<User>) => {
    try {
      await apiClient.adminUpdateUser(userId, data);
      await loadUsers();
      setEditingUser(null);
    } catch (error) {
      logger.error("Failed to update user:", error);
      alert("Failed to update user. Please try again.");
    }
  };

  const handleResetPassword = async (userId: number, newPassword: string) => {
    try {
      await apiClient.adminResetUserPassword(userId, newPassword);
      setShowPasswordReset(null);
      alert("Password reset successfully");
    } catch (error) {
      logger.error("Failed to reset password:", error);
      alert("Failed to reset password. Please try again.");
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      await apiClient.adminDeleteUser(userId);
      await loadUsers();
      setDeletingUser(null);
    } catch (error) {
      logger.error("Failed to delete user:", error);
      alert("Failed to delete user. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navigation currentPage="Admin" />
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-600 dark:text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation currentPage="Admin" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with breadcrumb */}
        <div className="mb-6">
          <nav className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
            <Link
              href="/admin"
              className="hover:text-gray-700 dark:hover:text-gray-300"
            >
              Admin
            </Link>
            <span>/</span>
            <span className="text-gray-900 dark:text-white">Users</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            User Management
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage user accounts, roles, and permissions
          </p>
        </div>

        {/* Admin Users Component */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <AdminUsers
            users={users}
            searchQuery={searchQuery}
            currentPage={currentPage}
            totalUsers={totalUsers}
            onSearchQueryChange={setSearchQuery}
            onLoadUsers={loadUsers}
            onSetCurrentPage={(page) => {
              setCurrentPage(page);
              setTimeout(loadUsers, 0);
            }}
            onSetEditingUser={setEditingUser}
            onSetShowPasswordReset={setShowPasswordReset}
            onSetDeletingUser={setDeletingUser}
          />
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Edit User
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleEditUser(editingUser.id, {
                  first_name: formData.get("first_name") as string,
                  last_name: formData.get("last_name") as string,
                  email: formData.get("email") as string,
                  role: formData.get("role") as "user" | "admin",
                  is_active: formData.get("is_active") === "true",
                });
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    defaultValue={editingUser.first_name}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="last_name"
                    defaultValue={editingUser.last_name}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={editingUser.email}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Role
                  </label>
                  <select
                    name="role"
                    defaultValue={editingUser.role}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    name="is_active"
                    defaultValue={editingUser.is_active ? "true" : "false"}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-500 dark:hover:text-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordReset && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Reset Password
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Reset password for {showPasswordReset.first_name}{" "}
              {showPasswordReset.last_name}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const password = formData.get("password") as string;
                const confirmPassword = formData.get(
                  "confirm_password"
                ) as string;

                if (password !== confirmPassword) {
                  alert("Passwords do not match");
                  return;
                }

                if (password.length < 8) {
                  alert("Password must be at least 8 characters");
                  return;
                }

                handleResetPassword(showPasswordReset.id, password);
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    required
                    minLength={8}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    name="confirm_password"
                    required
                    minLength={8}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowPasswordReset(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-500 dark:hover:text-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Delete User
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to delete {deletingUser.first_name}{" "}
              {deletingUser.last_name}? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-500 dark:hover:text-gray-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteUser(deletingUser.id)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
