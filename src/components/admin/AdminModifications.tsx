interface Modification {
  id: number;
  name: string;
  status: string;
  card?: {
    name: string;
  };
  submitter?: {
    first_name: string;
    last_name: string;
  };
  created_date: string;
  phone_number?: string;
  description?: string;
  tags_text?: string;
  review_notes?: string;
}

interface AdminModificationsProps {
  modifications: Modification[];
  processingModification: number | null;
  onApproveModification: (id: number) => void;
  onRejectModification: (id: number) => void;
  getStatusColor: (status: string) => string;
}

export default function AdminModifications({
  modifications,
  processingModification,
  onApproveModification,
  onRejectModification,
  getStatusColor,
}: AdminModificationsProps) {
  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {modifications.length === 0 ? (
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
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No modifications
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            No card modifications pending review.
          </p>
        </div>
      ) : (
        modifications.map((modification) => (
          <div key={modification.id} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {modification.name}
                  </h3>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(modification.status)}`}
                  >
                    {modification.status.charAt(0).toUpperCase() +
                      modification.status.slice(1)}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                  <div>
                    <span className="font-medium">Original Card:</span>{" "}
                    {modification.card?.name}
                  </div>
                  <div>
                    <span className="font-medium">Submitted by:</span>{" "}
                    {modification.submitter?.first_name}{" "}
                    {modification.submitter?.last_name}
                  </div>
                  <div>
                    <span className="font-medium">Date:</span>{" "}
                    {new Date(modification.created_date).toLocaleDateString()}
                  </div>
                  {modification.phone_number && (
                    <div>
                      <span className="font-medium">Phone:</span>{" "}
                      {modification.phone_number}
                    </div>
                  )}
                </div>

                {modification.description && (
                  <p className="text-gray-700 dark:text-gray-300 mb-3">
                    {modification.description}
                  </p>
                )}

                {modification.tags_text && (
                  <div className="mb-3">
                    <span className="font-medium text-gray-600 dark:text-gray-400 text-sm">
                      Tags:
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {modification.tags_text.split(",").map((tag, index) => (
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

                {modification.review_notes && (
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Review notes:</span>{" "}
                      {modification.review_notes}
                    </p>
                  </div>
                )}
              </div>

              {modification.status === "pending" && (
                <div className="ml-4 flex flex-col space-y-2">
                  <button
                    onClick={() => onApproveModification(modification.id)}
                    disabled={processingModification === modification.id}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingModification === modification.id
                      ? "Processing..."
                      : "Approve"}
                  </button>
                  <button
                    onClick={() => onRejectModification(modification.id)}
                    disabled={processingModification === modification.id}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingModification === modification.id
                      ? "Processing..."
                      : "Reject"}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
