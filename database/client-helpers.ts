// database/client-helpers.ts
// Client-side helpers for database operations (replaces direct Supabase calls)
// These call API routes which use Prisma DAOs on the server

import { apiFetch } from '@/api/fetch';

/**
 * Client-side profile operations
 * Replaces: supabase.from("profiles").upsert/select/update
 */
export const profileClient = {
  /**
   * Upsert profile data
   * Replaces: supabase.from("profiles").upsert(data, { onConflict: 'id' })
   */
  async upsert(profileData: any) {
    const response = await apiFetch('/api/profile/upsert', {
      method: 'POST',
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to upsert profile');
    }

    return response.json();
  },

  /**
   * Get profile data
   * Replaces: supabase.from("profiles").select().single()
   */
  async get() {
    const response = await apiFetch('/api/profile/get', {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get profile');
    }

    return response.json();
  },

  /**
   * Update profile data (same as upsert)
   * Replaces: supabase.from("profiles").update(data)
   */
  async update(profileData: any) {
    return this.upsert(profileData);
  },
};

/**
 * Client-side campaign operations
 * Replaces: supabase.from("campaigns").*
 */
export const campaignClient = {
  /**
   * Create a new campaign
   * Replaces: supabase.from("campaigns").insert([data])
   */
  async create(campaignData: { name: string; status?: string; data?: any }) {
    const response = await apiFetch('/api/campaigns/create', {
      method: 'POST',
      body: JSON.stringify(campaignData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create campaign');
    }

    return response.json();
  },

  /**
   * List all campaigns for user
   * Replaces: supabase.from("campaigns").select()
   */
  async list() {
    const response = await apiFetch('/api/campaigns/list', {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to list campaigns');
    }

    return response.json();
  },

  /**
   * Get a single campaign
   * Replaces: supabase.from("campaigns").select().eq('id', id).single()
   */
  async get(id: string) {
    const response = await apiFetch(`/api/campaigns/${id}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get campaign');
    }

    return response.json();
  },

  /**
   * Update a campaign
   * Replaces: supabase.from("campaigns").update(data).eq('id', id)
   */
  async update(id: string, campaignData: { name?: string; status?: string; data?: any }) {
    const response = await apiFetch(`/api/campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(campaignData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update campaign');
    }

    return response.json();
  },

  /**
   * Delete a campaign
   * Replaces: supabase.from("campaigns").delete().eq('id', id)
   */
  async delete(id: string) {
    const response = await apiFetch(`/api/campaigns/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete campaign');
    }

    return response.json();
  },
};

/**
 * Client-side credits operations
 * Replaces: supabase.from("user_credits").*
 */
export const creditsClient = {
  /**
   * Deduct credits from user account
   * Replaces: supabase.rpc("decrement_credit", { user_id: userId })
   */
  async deduct(_amount = 1) {
    throw new Error(
      'Direct credit deduction is disabled. Credits are consumed by generation APIs only.'
    );
  },

  /**
   * Get current credit balance
   * Replaces: supabase.from("user_credits").select('credits').eq('id', userId).single()
   */
  async getBalance() {
    const response = await apiFetch('/api/credits/balance', {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get balance');
    }

    return response.json();
  },
};

/**
 * Client-side recommendations operations
 * Replaces: supabase.from("recommendations").*
 */
export const recommendationsClient = {
  /**
   * List recommendations for user
   * Replaces: supabase.from("recommendations").select().eq('user_id', userId)
   */
  async list(options?: { status?: string; campaignId?: string }) {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.campaignId) params.append('campaignId', options.campaignId);

    const url = `/api/recommendations/list${params.toString() ? `?${params.toString()}` : ''}`;

    const response = await apiFetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to list recommendations');
    }

    return response.json();
  },
};
