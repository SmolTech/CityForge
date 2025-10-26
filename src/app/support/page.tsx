"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient, User } from "@/lib/api";
import { SupportTicket, SupportTicketStats } from "@/types/support";
import { Navigation } from "@/components/shared";
import { logger } from "@/lib/logger";

export default function SupportTicketsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [stats, setStats] = useState<SupportTicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("open");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const router = useRouter();

  useEffect(() => {
    loadData();
  }, [statusFilter, categoryFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      if (!apiClient.isAuthenticated()) {
        router.push("/login?redirect=/support");
        return;
      }

      const [userResponse, ticketsResponse, statsResponse] = await Promise.all([
        apiClient.getCurrentUser(),
        apiClient.getTickets({
          ...(statusFilter !== "all" && { status: statusFilter }),
          ...(categoryFilter !== "all" && { category: categoryFilter }),
          limit: 50,
          offset: 0,
        }),
        apiClient.getTicketStats(),
      ]);

      setUser(userResponse.user);
      setTickets(ticketsResponse.tickets);
      setStats(statsResponse);
    } catch (error) {
      logger.error("Failed to load support tickets:", error);
      if (!apiClient.isAuthenticated()) {
        router.push("/login?redirect=/support");
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-100 text-blue-800";
      case "in_progress":
        return "bg-yellow-100 text-yellow-800";
      case "resolved":
        return "bg-green-100 text-green-800";
      case "closed":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "text-red-600 font-bold";
      case "high":
        return "text-orange-600 font-semibold";
      case "normal":
        return "text-gray-600";
      case "low":
        return "text-gray-400";
      default:
        return "text-gray-600";
    }
  };

  if (loading) {
    return (
      <>
        <Navigation />
        <main className="min-h-screen bg-[rgb(var(--background-rgb))] text-[rgb(var(--foreground-rgb))] pt-20 px-4">
          <div className="max-w-6xl mx-auto py-8">
            <p className="text-center">Loading...</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-[rgb(var(--background-rgb))] text-[rgb(var(--foreground-rgb))] pt-20 px-4">
        <div className="max-w-6xl mx-auto py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Community Support</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Request and offer support within our community
            </p>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.open}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Open
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="text-2xl font-bold text-yellow-600">
                  {stats.in_progress}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  In Progress
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="text-2xl font-bold text-green-600">
                  {stats.resolved}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Resolved
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                  {stats.total}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Total
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mb-6 flex justify-between items-center">
            <Link
              href="/support/new"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Request Support
            </Link>

            {/* Filters */}
            <div className="flex gap-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                <option value="housing">Housing</option>
                <option value="food">Food</option>
                <option value="transportation">Transportation</option>
                <option value="healthcare">Healthcare</option>
                <option value="financial">Financial</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Tickets List */}
          {tickets.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                No support requests found. Create your first request to get
                started.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/support/${ticket.id}`}
                  className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:border-blue-500 hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                          {ticket.title}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded text-xs ${getStatusColor(ticket.status)}`}
                        >
                          {ticket.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                        {ticket.description}
                      </p>
                      <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="capitalize">{ticket.category}</span>
                        <span className={getPriorityColor(ticket.priority)}>
                          {ticket.priority} priority
                        </span>
                        <span>
                          {ticket.message_count}{" "}
                          {ticket.message_count === 1 ? "message" : "messages"}
                        </span>
                        <span>
                          by {ticket.creator.username}
                          {ticket.is_anonymous &&
                            user?.is_supporter &&
                            " (Anonymous)"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                      {new Date(ticket.created_date).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
