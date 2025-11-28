import { useState, useEffect } from "react";
import { AdminTag } from "@/lib/api";

interface AddTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string) => Promise<void>;
  isLoading: boolean;
}

export function AddTagModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: AddTagModalProps) {
  const [tagName, setTagName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tagName.trim()) {
      await onConfirm(tagName.trim());
      setTagName("");
    }
  };

  const handleClose = () => {
    setTagName("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Add New Tag
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tag Name
            </label>
            <input
              type="text"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              maxLength={50}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter tag name..."
              required
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Maximum 50 characters
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !tagName.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creating..." : "Create Tag"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EditTagModalProps {
  isOpen: boolean;
  tag: AdminTag | null;
  onClose: () => void;
  onConfirm: (id: number, name: string) => Promise<void>;
  isLoading: boolean;
}

export function EditTagModal({
  isOpen,
  tag,
  onClose,
  onConfirm,
  isLoading,
}: EditTagModalProps) {
  const [tagName, setTagName] = useState(tag?.name || "");

  // Update tag name when tag prop changes
  useEffect(() => {
    if (tag) {
      setTagName(tag.name);
    }
  }, [tag]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tag && tagName.trim()) {
      await onConfirm(tag.id, tagName.trim());
    }
  };

  const handleClose = () => {
    setTagName(tag?.name || "");
    onClose();
  };

  if (!isOpen || !tag) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Edit Tag
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tag Name
            </label>
            <input
              type="text"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              maxLength={50}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter tag name..."
              required
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Maximum 50 characters
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !tagName.trim() || tagName === tag.name}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Updating..." : "Update Tag"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface DeleteTagModalProps {
  isOpen: boolean;
  tag: AdminTag | null;
  onClose: () => void;
  onConfirm: (id: number) => Promise<void>;
  isLoading: boolean;
}

export function DeleteTagModal({
  isOpen,
  tag,
  onClose,
  onConfirm,
  isLoading,
}: DeleteTagModalProps) {
  const handleConfirm = async () => {
    if (tag) {
      await onConfirm(tag.id);
    }
  };

  if (!isOpen || !tag) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Delete Tag
        </h3>
        <div className="mb-6">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Are you sure you want to delete the tag{" "}
            <span className="font-semibold text-red-600 dark:text-red-400">
              &ldquo;{tag.name}&rdquo;
            </span>
            ?
          </p>
          {tag.card_count > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex">
                <svg
                  className="h-5 w-5 text-yellow-400 mr-3 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    This tag is currently used by {tag.card_count}{" "}
                    {tag.card_count === 1 ? "business card" : "business cards"}.
                    Deleting it will remove the tag from all associated cards.
                  </p>
                </div>
              </div>
            </div>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            This action cannot be undone.
          </p>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Deleting..." : "Delete Tag"}
          </button>
        </div>
      </div>
    </div>
  );
}
