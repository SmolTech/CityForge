import { ApiClient } from "./client";
import {
  ResourceConfig,
  QuickAccessItem,
  QuickAccessItemInput,
  ResourceItem,
  ResourceItemInput,
} from "./types";

export class ResourcesApi extends ApiClient {
  // Public resource methods
  async getResourcesConfig(): Promise<{
    site: {
      title: string;
      description: string;
      domain: string;
    };
    title: string;
    description: string;
    footer: {
      title: string;
      description: string;
      contactEmail: string;
      buttonText: string;
    };
  }> {
    return this.request("/api/resources/config");
  }

  async getQuickAccess(): Promise<
    Array<{
      id: string;
      title: string;
      subtitle: string;
      phone: string;
      color: string;
      icon: string;
    }>
  > {
    return this.request("/api/resources/quick-access");
  }

  async getResourceItems(category?: string): Promise<
    Array<{
      id: number;
      title: string;
      url: string;
      description: string;
      category: string;
      phone?: string;
      address?: string;
      icon: string;
    }>
  > {
    const params = category ? `?category=${encodeURIComponent(category)}` : "";
    return this.request(`/api/resources/items${params}`);
  }

  async getResourceCategories(): Promise<string[]> {
    return this.request("/api/resources/categories");
  }

  async getResources(): Promise<{
    site: {
      title: string;
      description: string;
      domain: string;
    };
    title: string;
    description: string;
    quickAccess: Array<{
      id: string;
      title: string;
      subtitle: string;
      phone: string;
      color: string;
      icon: string;
    }>;
    resources: Array<{
      id: number;
      title: string;
      url: string;
      description: string;
      category: string;
      phone?: string;
      address?: string;
      icon: string;
    }>;
    footer: {
      title: string;
      description: string;
      contactEmail: string;
      buttonText: string;
    };
  }> {
    return this.request("/api/resources");
  }

  // Admin resource methods
  async adminGetResourceConfigs(): Promise<
    Array<{
      id: number;
      key: string;
      value: string;
      description?: string;
      created_date: string;
      updated_date: string;
    }>
  > {
    return this.request("/api/admin/resources/config");
  }

  async adminUpdateResourceConfig(
    id: number,
    data: { value?: string; description?: string }
  ): Promise<{ message: string; config: ResourceConfig }> {
    return this.request(`/api/admin/resources/config/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async adminCreateResourceConfig(data: {
    key: string;
    value: string;
    description?: string;
  }): Promise<{ message: string; config: ResourceConfig }> {
    return this.request("/api/admin/resources/config", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async adminGetQuickAccessItems(): Promise<
    Array<{
      id: string;
      title: string;
      subtitle: string;
      phone: string;
      color: string;
      icon: string;
    }>
  > {
    return this.request("/api/admin/resources/quick-access");
  }

  async adminGetQuickAccessItem(id: number): Promise<{
    id: string;
    title: string;
    subtitle: string;
    phone: string;
    color: string;
    icon: string;
  }> {
    return this.request(`/api/admin/resources/quick-access/${id}`);
  }

  async adminCreateQuickAccessItem(
    data: QuickAccessItemInput
  ): Promise<{ message: string; item: QuickAccessItem }> {
    return this.request("/api/admin/resources/quick-access", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async adminUpdateQuickAccessItem(
    id: number,
    data: Partial<QuickAccessItemInput>
  ): Promise<{ message: string; item: QuickAccessItem }> {
    return this.request(`/api/admin/resources/quick-access/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async adminDeleteQuickAccessItem(id: number): Promise<{ message: string }> {
    return this.request(`/api/admin/resources/quick-access/${id}`, {
      method: "DELETE",
    });
  }

  async adminGetResourceItems(): Promise<
    Array<{
      id: number;
      title: string;
      url: string;
      description: string;
      category: string;
      phone?: string;
      address?: string;
      icon: string;
    }>
  > {
    return this.request("/api/admin/resources/items");
  }

  async adminGetResourceItem(id: number): Promise<{
    id: number;
    title: string;
    url: string;
    description: string;
    category: string;
    phone?: string;
    address?: string;
    icon: string;
  }> {
    return this.request(`/api/admin/resources/items/${id}`);
  }

  async adminCreateResourceItem(
    data: ResourceItemInput
  ): Promise<{ message: string; item: ResourceItem }> {
    return this.request("/api/admin/resources/items", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async adminUpdateResourceItem(
    id: number,
    data: Partial<ResourceItemInput>
  ): Promise<{ message: string; item: ResourceItem }> {
    return this.request(`/api/admin/resources/items/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async adminDeleteResourceItem(id: number): Promise<{ message: string }> {
    return this.request(`/api/admin/resources/items/${id}`, {
      method: "DELETE",
    });
  }
}
