import { Card } from "@/lib/api";

interface AdminCardsProps {
  cards: Card[];
  onToggleFeatured: (cardId: number, featured: boolean) => void;
  onEditCard: (card: Card) => void;
  onDeleteCard: (card: Card) => void;
}

export default function AdminCards({
  cards,
  onToggleFeatured,
  onEditCard,
  onDeleteCard,
}: AdminCardsProps) {
  if (cards.length === 0) {
    return (
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
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
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No cards
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            No published cards found.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {cards.map((card) => (
        <div key={card.id} className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {card.name}
                </h3>
                {card.featured && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                    Featured
                  </span>
                )}
              </div>

              {card.description && (
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  {card.description}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                {card.email && (
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">
                      Email:
                    </span>
                    <div>{card.email}</div>
                  </div>
                )}
                {card.website_url && (
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">
                      Website:
                    </span>
                    <div>
                      <a
                        href={card.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {card.website_url}
                      </a>
                    </div>
                  </div>
                )}
                {card.address && (
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">
                      Address:
                    </span>
                    <div>{card.address}</div>
                  </div>
                )}
              </div>

              {card.tags.length > 0 && (
                <div className="mt-3">
                  <span className="font-medium text-gray-600 dark:text-gray-400 text-sm">
                    Tags:
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {card.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Created: {new Date(card.created_date).toLocaleDateString()} •
                Last updated: {new Date(card.updated_date).toLocaleDateString()}
                {card.creator && (
                  <>
                    {" "}
                    • Created by: {card.creator.first_name}{" "}
                    {card.creator.last_name}
                  </>
                )}
              </div>
            </div>

            <div className="ml-4 flex flex-col space-y-2">
              <button
                onClick={() => onToggleFeatured(card.id, !card.featured)}
                className={`px-3 py-1 text-sm font-medium rounded ${
                  card.featured
                    ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white"
                }`}
              >
                {card.featured ? "Unfeature" : "Feature"}
              </button>
              <button
                onClick={() => onEditCard(card)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded"
              >
                Edit
              </button>
              <button
                onClick={() => onDeleteCard(card)}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
