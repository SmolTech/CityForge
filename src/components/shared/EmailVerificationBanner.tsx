"use client";

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { logger } from "@/lib/logger";

interface EmailVerificationBannerProps {
  className?: string;
}

export function EmailVerificationBanner({
  className = "",
}: EmailVerificationBannerProps) {
  const { user, isAuthenticated, isEmailVerified } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show banner if user is not authenticated, email is verified, or banner is dismissed
  if (!isAuthenticated || isEmailVerified || isDismissed) {
    return null;
  }

  const handleResendVerification = async () => {
    if (!user?.email) return;

    setIsResending(true);
    setResendMessage("");

    try {
      await apiClient.resendVerification(user.email);
      setResendMessage("Verification email sent! Please check your inbox.");
      logger.info("Verification email resent successfully");
    } catch (error) {
      setResendMessage("Failed to send verification email. Please try again.");
      logger.error("Failed to resend verification email:", error);
    } finally {
      setIsResending(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  return (
    <div
      className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-yellow-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-yellow-800">
              Email Verification Required
            </h3>
            <div className="mt-1 text-sm text-yellow-700">
              <p>
                Please verify your email address ({user?.email}) to access all
                features of your account.
              </p>
              {resendMessage && (
                <p className="mt-2 font-medium">{resendMessage}</p>
              )}
            </div>
            <div className="mt-3">
              <button
                onClick={handleResendVerification}
                disabled={isResending}
                className="text-sm bg-yellow-200 hover:bg-yellow-300 disabled:bg-yellow-100 disabled:cursor-not-allowed text-yellow-800 px-3 py-2 rounded-md font-medium transition-colors"
              >
                {isResending ? "Sending..." : "Resend Verification Email"}
              </button>
            </div>
          </div>
        </div>
        <div className="flex-shrink-0">
          <button
            onClick={handleDismiss}
            className="text-yellow-400 hover:text-yellow-600 transition-colors"
            aria-label="Dismiss verification banner"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
