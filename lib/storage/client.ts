/**
 * Supabase Storage Client
 *
 * Unified storage using Supabase Storage for both local and production:
 * - Local: Supabase local dev stack (supabase start)
 * - Production: Supabase cloud storage
 *
 * Buckets:
 * - campaign-assets: Public bucket for campaign images
 * - user-uploads: Public bucket for user-uploaded files
 */

import { supabase, supabaseAdmin } from '@/auth/supabase/client';

// Default bucket names
export const BUCKETS = {
  CAMPAIGN_ASSETS: 'campaign-assets',
  USER_UPLOADS: 'user-uploads',
} as const;

/**
 * Storage Client Interface
 * Provides unified API for Supabase Storage (local + production)
 */
export const storageClient = {
  /**
   * Upload a file to storage
   * @param bucket - Bucket name (e.g., "campaign-assets", "user-uploads")
   * @param path - File path within bucket (e.g., "campaigns/user123/image.png")
   * @param file - File data (Blob, Buffer, or File object)
   * @param options - Upload options (cacheControl, upsert, contentType)
   * @returns { error, data } - Error or success data with path and publicUrl
   */
  async upload(
    bucket: string,
    path: string,
    file: Blob | Buffer | File,
    options: {
      cacheControl?: string;
      upsert?: boolean;
      contentType?: string;
    } = {}
  ): Promise<{ error: Error | null; data: { path: string; publicUrl: string } | null }> {
    try {
      // Convert Buffer to Blob if needed (for Node.js environments)
      const uploadFile = file instanceof Buffer
        ? new Blob([new Uint8Array(file)], { type: options.contentType || 'application/octet-stream' })
        : file;

      const { error, data } = await supabase.storage
        .from(bucket)
        .upload(path, uploadFile, {
          cacheControl: options.cacheControl || '3600',
          upsert: options.upsert ?? true,
          contentType: options.contentType,
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);

      return {
        error: null,
        data: {
          path: data?.path || path,
          publicUrl: urlData?.publicUrl || ''
        }
      };
    } catch (err) {
      console.error(`[Storage] Upload failed:`, err);
      return { error: err as Error, data: null };
    }
  },

  /**
   * Get public URL for a file
   * @param bucket - Bucket name
   * @param path - File path within bucket
   * @returns Public URL string
   */
  getPublicUrl(bucket: string, path: string): string {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl || '';
  },

  /**
   * Get signed URL for private files (time-limited access)
   * @param bucket - Bucket name
   * @param path - File path within bucket
   * @param expiresIn - Seconds until URL expires (default: 3600 = 1 hour)
   * @returns { error, signedUrl }
   */
  async getSignedUrl(
    bucket: string,
    path: string,
    expiresIn: number = 3600
  ): Promise<{ error: Error | null; signedUrl: string | null }> {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);

      if (error) throw error;
      return { error: null, signedUrl: data?.signedUrl || null };
    } catch (err) {
      console.error(`[Storage] Signed URL failed:`, err);
      return { error: err as Error, signedUrl: null };
    }
  },

  /**
   * Delete a file from storage
   * @param bucket - Bucket name
   * @param path - File path within bucket (or array of paths)
   * @returns { error } - Error or null on success
   */
  async delete(
    bucket: string,
    path: string | string[]
  ): Promise<{ error: Error | null }> {
    try {
      const paths = Array.isArray(path) ? path : [path];
      const { error } = await supabase.storage.from(bucket).remove(paths);
      if (error) throw error;
      return { error: null };
    } catch (err) {
      console.error(`[Storage] Delete failed:`, err);
      return { error: err as Error };
    }
  },

  /**
   * List files in a bucket
   * @param bucket - Bucket name
   * @param path - Folder path (optional)
   * @param options - List options (limit, offset, sortBy)
   * @returns List of files
   */
  async list(
    bucket: string,
    path?: string,
    options?: {
      limit?: number;
      offset?: number;
      sortBy?: { column: string; order: 'asc' | 'desc' };
    }
  ): Promise<{ error: Error | null; data: any[] | null }> {
    try {
      const { data, error } = await supabase.storage.from(bucket).list(path, options);
      if (error) throw error;
      return { error: null, data };
    } catch (err) {
      console.error(`[Storage] List failed:`, err);
      return { error: err as Error, data: null };
    }
  },

  /**
   * Download a file from storage
   * @param bucket - Bucket name
   * @param path - File path within bucket
   * @returns { error, data } - Blob data or error
   */
  async download(
    bucket: string,
    path: string
  ): Promise<{ error: Error | null; data: Blob | null }> {
    try {
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (error) throw error;
      return { error: null, data };
    } catch (err) {
      console.error(`[Storage] Download failed:`, err);
      return { error: err as Error, data: null };
    }
  },

  /**
   * Move/rename a file
   * @param bucket - Bucket name
   * @param fromPath - Source path
   * @param toPath - Destination path
   * @returns { error }
   */
  async move(
    bucket: string,
    fromPath: string,
    toPath: string
  ): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.storage.from(bucket).move(fromPath, toPath);
      if (error) throw error;
      return { error: null };
    } catch (err) {
      console.error(`[Storage] Move failed:`, err);
      return { error: err as Error };
    }
  },

  /**
   * Copy a file
   * @param bucket - Bucket name
   * @param fromPath - Source path
   * @param toPath - Destination path
   * @returns { error }
   */
  async copy(
    bucket: string,
    fromPath: string,
    toPath: string
  ): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.storage.from(bucket).copy(fromPath, toPath);
      if (error) throw error;
      return { error: null };
    } catch (err) {
      console.error(`[Storage] Copy failed:`, err);
      return { error: err as Error };
    }
  },

  /**
   * Get storage provider info
   * @returns 'supabase'
   */
  getProvider(): 'supabase' {
    return 'supabase';
  },

  /**
   * Check if storage is available
   * @returns boolean
   */
  isAvailable(): boolean {
    return true;
  },
};

/**
 * Admin Storage Operations (server-side only)
 * Uses service role key for bucket management
 */
export const storageAdmin = {
  /**
   * Create a storage bucket (admin only)
   * @param bucketId - Unique bucket identifier
   * @param options - Bucket options
   */
  async createBucket(
    bucketId: string,
    options: {
      public?: boolean;
      fileSizeLimit?: number;
      allowedMimeTypes?: string[];
    } = {}
  ): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabaseAdmin.storage.createBucket(bucketId, {
        public: options.public ?? true,
        fileSizeLimit: options.fileSizeLimit,
        allowedMimeTypes: options.allowedMimeTypes,
      });
      
      // Ignore "already exists" error
      if (error && !error.message?.includes('already exists')) {
        throw error;
      }
      return { error: null };
    } catch (err) {
      console.error(`[Storage Admin] Create bucket failed:`, err);
      return { error: err as Error };
    }
  },

  /**
   * Initialize default buckets (call on app startup)
   */
  async initializeBuckets(): Promise<void> {
    console.log('[Storage] Initializing storage buckets...');
    
    // Create campaign-assets bucket (public)
    await this.createBucket(BUCKETS.CAMPAIGN_ASSETS, {
      public: true,
      allowedMimeTypes: ['image/*', 'video/*'],
    });
    
    // Create user-uploads bucket (public)
    await this.createBucket(BUCKETS.USER_UPLOADS, {
      public: true,
      allowedMimeTypes: ['image/*', 'video/*', 'application/pdf'],
    });
    
    console.log('[Storage] Storage buckets initialized');
  },
};
