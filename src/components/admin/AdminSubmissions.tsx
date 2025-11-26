import { useState } from "react";
import { CardSubmission } from "@/lib/api";

interface AdminSubmissionsProps {
  activeTab: "pending" | "submissions";
  submissions: CardSubmission[];
  processingSubmission: number | null;
  onApproveSubmission: (submissionId: number, featured?: boolean) => void;
  onRejectSubmission: (submissionId: number, notes?: string) => void;
}

export function AdminSubmissions({
  activeTab,
  submissions,
  processingSubmission,
  onApproveSubmission,
  onRejectSubmission,
}: AdminSubmissionsProps) {
  const [rejectingSubmissionId, setRejectingSubmissionId] = useState<
    number | null
  >(null);
  const [rejectionNotes, setRejectionNotes] = useState("");

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    }
  };

  const filteredSubmissions = submissions.filter((s) =>
    activeTab === "pending" ? s.status === "pending" : true
  );

  const handleRejectWithNotes = () => {
    if (rejectingSubmissionId) {
      onRejectSubmission(rejectingSubmissionId, rejectionNotes);
      setRejectingSubmissionId(null);
      setRejectionNotes("");
    }
  };

  return (
    <>
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {submissions.length === 0 ? (
          <div className="p-6 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              No submissions
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              No submissions to review at this time.
            </p>
          </div>
        ) : (
          filteredSubmissions.map((submission) => (
            <div key={submission.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      {submission.name}
                    </h3>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(submission.status)}`}
                    >
                      {submission.status.charAt(0).toUpperCase() +
                        submission.status.slice(1)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                    <div>
                      <span className="font-medium">Submitted by:</span>{" "}
                      {submission.submitter?.first_name}{" "}
                      {submission.submitter?.last_name}
                    </div>
                    <div>
                      <span className="font-medium">Date:</span>{" "}
                      {new Date(submission.created_date).toLocaleDateString()}
                    </div>
                    {submission.phone_number && (
                      <div>
                        <span className="font-medium">Phone:</span>{" "}
                        {submission.phone_number}
                      </div>
                    )}
                  </div>

                  {submission.description && (
                    <p className="text-gray-700 dark:text-gray-300 mb-3">
                      {submission.description}
                    </p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    {submission.email && (
                      <div>
                        <span className="font-medium text-gray-600 dark:text-gray-400">
                          Email:
                        </span>
                        <div>{submission.email}</div>
                      </div>
                    )}
                    {submission.website_url && (
                      <div>
                        <span className="font-medium text-gray-600 dark:text-gray-400">
                          Website:
                        </span>
                        <div>
                          <a
                            href={submission.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {submission.website_url}
                          </a>
                        </div>
                      </div>
                    )}
                    {submission.address && (
                      <div>
                        <span className="font-medium text-gray-600 dark:text-gray-400">
                          Address:
                        </span>
                        <div>{submission.address}</div>
                      </div>
                    )}
                  </div>

                  {submission.tags_text && (
                    <div className="mt-3">
                      <span className="font-medium text-gray-600 dark:text-gray-400 text-sm">
                        Tags:
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {submission.tags_text.split(",").map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                          >
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {submission.review_notes && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                      <span className="font-medium text-gray-600 dark:text-gray-400 text-sm">
                        Review notes:
                      </span>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        {submission.review_notes}
                      </p>
                    </div>
                  )}
                </div>

                {submission.status === "pending" && (
                  <div className="ml-4 flex flex-col space-y-2">
                    <button
                      onClick={() => onApproveSubmission(submission.id, false)}
                      disabled={processingSubmission === submission.id}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onApproveSubmission(submission.id, true)}
                      disabled={processingSubmission === submission.id}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded disabled:opacity-50"
                    >
                      Approve & Feature
                    </button>
                    <button
                      onClick={() => {
                        setRejectingSubmissionId(submission.id);
                        setRejectionNotes("");
                      }}
                      disabled={processingSubmission === submission.id}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Rejection Modal */}
      {rejectingSubmissionId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Reject Submission
            </h3>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rejection Reason (Optional)
              </label>
              <textarea
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Enter rejection reason..."
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setRejectingSubmissionId(null);
                  setRejectionNotes("");
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectWithNotes}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
