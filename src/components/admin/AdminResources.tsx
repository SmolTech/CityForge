import {
  QuickAccessItem,
  ResourceItem,
  QuickAccessItemInput,
  ResourceItemInput,
} from "@/lib/api";

interface QuickAccessFormProps {
  item?: QuickAccessItem;
  onSubmit: (data: Partial<QuickAccessItemInput>) => void;
  onCancel: () => void;
}

interface ResourceItemFormProps {
  item?: ResourceItem;
  onSubmit: (data: Partial<ResourceItemInput>) => void;
  onCancel: () => void;
}

interface AdminResourcesProps {
  resourcesTab: string;
  quickAccessItems: QuickAccessItem[];
  resourceItems: ResourceItem[];
  showAddQuickAccess: boolean;
  editingQuickAccess: QuickAccessItem | null;
  showAddResourceItem: boolean;
  editingResourceItem: ResourceItem | null;
  onSetResourcesTab: (tab: string) => void;
  onSetShowAddQuickAccess: (show: boolean) => void;
  onSetEditingQuickAccess: (item: QuickAccessItem | null) => void;
  onSetDeletingQuickAccessId: (id: number | null) => void;
  onHandleCreateQuickAccess: (data: Partial<QuickAccessItemInput>) => void;
  onHandleUpdateQuickAccess: (
    id: number,
    data: Partial<QuickAccessItemInput>
  ) => void;
  onHandleDeleteQuickAccess: (id: number) => void;
  onSetShowAddResourceItem: (show: boolean) => void;
  onSetEditingResourceItem: (item: ResourceItem | null) => void;
  onSetDeletingResourceItemId: (id: number | null) => void;
  onHandleCreateResourceItem: (data: Partial<ResourceItemInput>) => void;
  onHandleUpdateResourceItem: (
    id: number,
    data: Partial<ResourceItemInput>
  ) => void;
  onHandleDeleteResourceItem: (id: number) => void;
  QuickAccessForm: React.ComponentType<QuickAccessFormProps>;
  ResourceItemForm: React.ComponentType<ResourceItemFormProps>;
}

export default function AdminResources({
  resourcesTab,
  quickAccessItems,
  resourceItems,
  showAddQuickAccess,
  editingQuickAccess,
  showAddResourceItem,
  editingResourceItem,
  onSetResourcesTab,
  onSetShowAddQuickAccess,
  onSetEditingQuickAccess,
  onSetDeletingQuickAccessId,
  onHandleCreateQuickAccess,
  onHandleUpdateQuickAccess,
  onSetShowAddResourceItem,
  onSetEditingResourceItem,
  onSetDeletingResourceItemId,
  onHandleCreateResourceItem,
  onHandleUpdateResourceItem,
  QuickAccessForm,
  ResourceItemForm,
}: AdminResourcesProps) {
  return (
    <div className="p-6">
      <div className="mb-4">
        <nav className="flex space-x-4">
          <button
            onClick={() => onSetResourcesTab("quick-access")}
            className={`px-4 py-2 text-sm font-medium rounded ${
              resourcesTab === "quick-access"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            Quick Access
          </button>
          <button
            onClick={() => onSetResourcesTab("items")}
            className={`px-4 py-2 text-sm font-medium rounded ${
              resourcesTab === "items"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            Resource Items
          </button>
        </nav>
      </div>

      {resourcesTab === "quick-access" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Quick Access Items
            </h2>
            <button
              onClick={() => onSetShowAddQuickAccess(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Add Quick Access
            </button>
          </div>

          {showAddQuickAccess && (
            <QuickAccessForm
              onSubmit={onHandleCreateQuickAccess}
              onCancel={() => onSetShowAddQuickAccess(false)}
            />
          )}

          {quickAccessItems.map((item, index) => (
            <div
              key={item.id}
              className="border border-gray-200 dark:border-gray-700 rounded p-4"
            >
              {editingQuickAccess?.id === item.id ? (
                <QuickAccessForm
                  item={item}
                  onSubmit={(data: Partial<QuickAccessItemInput>) =>
                    onHandleUpdateQuickAccess(index + 1, data)
                  }
                  onCancel={() => onSetEditingQuickAccess(null)}
                />
              ) : (
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {item.subtitle}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Phone: {item.phone}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Color: {item.color} | Icon: {item.icon}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onSetEditingQuickAccess(item)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onSetDeletingQuickAccessId(item.id)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {resourcesTab === "items" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Resource Items
            </h2>
            <button
              onClick={() => onSetShowAddResourceItem(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Add Resource Item
            </button>
          </div>

          {showAddResourceItem && (
            <ResourceItemForm
              onSubmit={onHandleCreateResourceItem}
              onCancel={() => onSetShowAddResourceItem(false)}
            />
          )}

          {resourceItems.map((item) => (
            <div
              key={item.id}
              className="border border-gray-200 dark:border-gray-700 rounded p-4"
            >
              {editingResourceItem?.id === item.id ? (
                <ResourceItemForm
                  item={item}
                  onSubmit={(data: Partial<ResourceItemInput>) =>
                    onHandleUpdateResourceItem(item.id, data)
                  }
                  onCancel={() => onSetEditingResourceItem(null)}
                />
              ) : (
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {item.description}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Category: {item.category}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      URL:{" "}
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {item.url}
                      </a>
                    </p>
                    {item.phone && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Phone: {item.phone}
                      </p>
                    )}
                    {item.address && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Address: {item.address}
                      </p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onSetEditingResourceItem(item)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onSetDeletingResourceItemId(item.id)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
