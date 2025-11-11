"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { apiClient, User } from "@/lib/api";
import { SupportTicket } from "@/types/support";
import { Navigation } from "@/components/shared";
import { logger } from "@/lib/logger";

export default function SupportTicketDetailPage() {
  const [user, setUser] = useState<User | null>(null);
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();
  const params = useParams();
  const ticketId = parseInt(params["id"] as string);

  useEffect(() => {
    loadData();
  }, [ticketId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      const [userResponse, ticketResponse] = await Promise.all([
        apiClient.getCurrentUser(),
        apiClient.getTicket(ticketId),
      ]);

      setUser(userResponse.user);
      setTicket(ticketResponse);
    } catch (error) {
      logger.error("Failed to load ticket:", error);
      if ((error as Error & { status?: number }).status === 401) {
        router.push(`/login?redirect=/support/${ticketId}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      await apiClient.addTicketMessage(ticketId, {
        content: messageText,
        is_internal_note: false,
      });
      setMessageText("");
      await loadData(); // Reload ticket with new message
    } catch (err: unknown) {
      let errorMessage = "Failed to add message. Please try again.";

      if (err && typeof err === "object" && "message" in err) {
        errorMessage = String(err.message);
      }

      setError(errorMessage);
      logger.error("Failed to add message:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await apiClient.updateTicket(ticketId, { status: newStatus });
      await loadData();
    } catch (err) {
      logger.error("Failed to update status:", err);
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

  if (loading) {
    return (
      <>
        <Navigation />
        <main className="min-h-screen bg-[rgb(var(--background-rgb))] text-[rgb(var(--foreground-rgb))] pt-20 px-4">
          <div className="max-w-4xl mx-auto py-8">
            <p className="text-center">Loading...</p>
          </div>
        </main>
      </>
    );
  }

  if (!ticket) {
    return (
      <>
        <Navigation />
        <main className="min-h-screen bg-[rgb(var(--background-rgb))] text-[rgb(var(--foreground-rgb))] pt-20 px-4">
          <div className="max-w-4xl mx-auto py-8">
            <p className="text-center">Ticket not found</p>
          </div>
        </main>
      </>
    );
  }

  const canUpdateStatus =
    user?.is_supporter || user?.is_admin || ticket.creator.id === user?.id;

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-[rgb(var(--background-rgb))] text-[rgb(var(--foreground-rgb))] pt-20 px-4">
        <div className="max-w-4xl mx-auto py-8">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/support"
              className="text-blue-600 hover:underline mb-4 inline-block"
            >
              &larr; Back to Support Requests
            </Link>
          </div>

          {/* Ticket Details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 mb-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {ticket.title}
                  </h1>
                  <span
                    className={`px-3 py-1 rounded text-sm ${getStatusColor(ticket.status)}`}
                  >
                    {ticket.status.replace("_", " ")}
                  </span>
                </div>
                <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
                  <span className="capitalize">{ticket.category}</span>
                  <span>Priority: {ticket.priority}</span>
                  <span>Created by {ticket.creator.username}</span>
                  <span>{new Date(ticket.created_date).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-4">
              {ticket.description}
            </p>

            {canUpdateStatus && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <label className="block text-sm font-medium mb-2">
                  Update Status:
                </label>
                <div className="flex gap-2">
                  {["open", "in_progress", "resolved", "closed"].map(
                    (status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        disabled={ticket.status === status}
                        className={`px-4 py-2 rounded transition-colors ${
                          ticket.status === status
                            ? "bg-gray-300 dark:bg-gray-600 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                      >
                        {status.replace("_", " ")}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Messages
            </h2>

            {ticket.messages && ticket.messages.length > 0 ? (
              <div className="space-y-4 mb-6">
                {ticket.messages.map((message) => {
                  if (!message) return null; // Skip internal notes for non-supporters

                  return (
                    <div
                      key={message.id}
                      className="border-l-4 border-blue-500 pl-4 py-2"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {message.creator.username}
                          {message.is_internal_note && (
                            <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                              Internal Note
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(message.created_date).toLocaleString()}
                        </div>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {message.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                No messages yet
              </p>
            )}

            {/* Add Message Form */}
            {error && (
              <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            <form onSubmit={handleAddMessage}>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] mb-4"
                placeholder="Add a message..."
                required
              />
              <button
                type="submit"
                disabled={submitting || !messageText.trim()}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {submitting ? "Sending..." : "Send Message"}
              </button>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
