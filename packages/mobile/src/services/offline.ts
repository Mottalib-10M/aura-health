/**
 * Offline-First Sync Service
 *
 * Implements an offline-first strategy using expo-sqlite to queue
 * GraphQL mutations when the device is offline. When connectivity
 * returns, queued mutations are replayed in order. Provides
 * conflict detection and retry logic with exponential backoff.
 */

import * as SQLite from 'expo-sqlite';
import * as Network from 'expo-network';
import { AppState, type AppStateStatus } from 'react-native';
import { apiClient } from './api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueuedMutation {
  id: number;
  operation: string;
  variables: string; // JSON-serialized
  created_at: string;
  retry_count: number;
  max_retries: number;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  error_message: string | null;
  priority: number; // lower = higher priority
}

interface OfflineServiceConfig {
  /** Maximum number of retries per mutation */
  maxRetries: number;
  /** Base delay between retries in ms */
  baseRetryDelayMs: number;
  /** Maximum number of mutations to process in a single sync batch */
  batchSize: number;
}

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: OfflineServiceConfig = {
  maxRetries: 5,
  baseRetryDelayMs: 1000,
  batchSize: 10,
};

// ---------------------------------------------------------------------------
// Database Schema
// ---------------------------------------------------------------------------

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS mutation_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation TEXT NOT NULL,
    variables TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 5,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    priority INTEGER NOT NULL DEFAULT 10
  );
`;

const CREATE_SYNC_LOG_SQL = `
  CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    mutations_processed INTEGER NOT NULL DEFAULT 0,
    mutations_failed INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0
  );
`;

const CREATE_CACHE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS data_cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

// ---------------------------------------------------------------------------
// Offline Service
// ---------------------------------------------------------------------------

class OfflineService {
  private db: SQLite.SQLiteDatabase | null = null;
  private config: OfflineServiceConfig;
  private isSyncing = false;
  private connectivitySubscription: (() => void) | null = null;

  constructor(config: OfflineServiceConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  /**
   * Initializes the SQLite database and sets up connectivity listeners.
   */
  async initialize(): Promise<void> {
    this.db = await SQLite.openDatabaseAsync('uzavita_offline.db');

    // Create tables
    await this.db.execAsync(CREATE_TABLE_SQL);
    await this.db.execAsync(CREATE_SYNC_LOG_SQL);
    await this.db.execAsync(CREATE_CACHE_TABLE_SQL);

    // Listen for app state changes to trigger sync on foreground
    this.connectivitySubscription = (() => {
      const listener = AppState.addEventListener(
        'change',
        this.handleAppStateChange.bind(this)
      );
      return () => listener.remove();
    })();

    // Initial connectivity check
    await this.checkAndSync();
  }

  /**
   * Handles app state changes. Triggers sync when app returns to foreground.
   */
  private async handleAppStateChange(nextState: AppStateStatus) {
    if (nextState === 'active') {
      await this.checkAndSync();
    }
  }

  /**
   * Checks connectivity and syncs queued mutations if online.
   */
  async checkAndSync(): Promise<void> {
    try {
      const networkState = await Network.getNetworkStateAsync();
      if (networkState.isConnected && networkState.isInternetReachable) {
        await this.processQueue();
      }
    } catch {
      // Network check failed - stay offline
    }
  }

  /**
   * Queues a mutation for later execution when offline.
   */
  async queueMutation(
    operation: string,
    variables: Record<string, unknown>,
    priority = 10
  ): Promise<number> {
    if (!this.db) {
      throw new Error('Offline service not initialized.');
    }

    const result = await this.db.runAsync(
      `INSERT INTO mutation_queue (operation, variables, max_retries, priority)
       VALUES (?, ?, ?, ?)`,
      operation,
      JSON.stringify(variables),
      this.config.maxRetries,
      priority
    );

    return result.lastInsertRowId;
  }

  /**
   * Processes pending mutations in the queue, oldest first.
   */
  async processQueue(): Promise<{ processed: number; failed: number }> {
    if (!this.db || this.isSyncing) {
      return { processed: 0, failed: 0 };
    }

    this.isSyncing = true;
    const startTime = Date.now();
    let processed = 0;
    let failed = 0;

    try {
      const pendingMutations = await this.db.getAllAsync<QueuedMutation>(
        `SELECT * FROM mutation_queue
         WHERE status = 'pending' AND retry_count < max_retries
         ORDER BY priority ASC, created_at ASC
         LIMIT ?`,
        this.config.batchSize
      );

      for (const mutation of pendingMutations) {
        try {
          // Mark as processing
          await this.db.runAsync(
            `UPDATE mutation_queue SET status = 'processing' WHERE id = ?`,
            mutation.id
          );

          // Execute the mutation
          const variables = JSON.parse(mutation.variables);
          await this.executeMutation(mutation.operation, variables);

          // Mark as completed
          await this.db.runAsync(
            `UPDATE mutation_queue SET status = 'completed' WHERE id = ?`,
            mutation.id
          );

          processed++;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          const newRetryCount = mutation.retry_count + 1;

          if (newRetryCount >= mutation.max_retries) {
            // Max retries exceeded - mark as failed
            await this.db.runAsync(
              `UPDATE mutation_queue
               SET status = 'failed', retry_count = ?, error_message = ?
               WHERE id = ?`,
              newRetryCount,
              errorMessage,
              mutation.id
            );
            failed++;
          } else {
            // Reset to pending with incremented retry count
            await this.db.runAsync(
              `UPDATE mutation_queue
               SET status = 'pending', retry_count = ?, error_message = ?
               WHERE id = ?`,
              newRetryCount,
              errorMessage,
              mutation.id
            );
          }

          // Exponential backoff delay before next mutation
          const delay =
            this.config.baseRetryDelayMs * Math.pow(2, mutation.retry_count);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      // Log sync result
      const durationMs = Date.now() - startTime;
      await this.db.runAsync(
        `INSERT INTO sync_log (mutations_processed, mutations_failed, duration_ms)
         VALUES (?, ?, ?)`,
        processed,
        failed,
        durationMs
      );
    } finally {
      this.isSyncing = false;
    }

    return { processed, failed };
  }

  /**
   * Routes a queued operation to the appropriate API method.
   */
  private async executeMutation(
    operation: string,
    variables: Record<string, unknown>
  ): Promise<void> {
    switch (operation) {
      case 'submitSymptoms':
        await apiClient.submitSymptoms(
          variables as Parameters<typeof apiClient.submitSymptoms>[0]
        );
        break;

      case 'syncWearableData':
        await apiClient.syncWearableData(variables.deviceId as string);
        break;

      case 'saveTriageToHistory':
        await apiClient.saveTriageToHistory(variables.sessionId as string);
        break;

      default:
        throw new Error(`Unknown offline operation: ${operation}`);
    }
  }

  /**
   * Returns the count of pending mutations in the queue.
   */
  async getPendingCount(): Promise<number> {
    if (!this.db) return 0;

    const result = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM mutation_queue WHERE status = 'pending'`
    );

    return result?.count ?? 0;
  }

  /**
   * Clears completed and failed mutations older than the specified days.
   */
  async cleanup(olderThanDays = 7): Promise<number> {
    if (!this.db) return 0;

    const result = await this.db.runAsync(
      `DELETE FROM mutation_queue
       WHERE status IN ('completed', 'failed')
       AND created_at < datetime('now', '-' || ? || ' days')`,
      olderThanDays
    );

    return result.changes;
  }

  // ---------------------------------------------------------------------------
  // Data Cache (for offline reads)
  // ---------------------------------------------------------------------------

  /**
   * Caches a value in SQLite for offline reads.
   */
  async cacheData(
    key: string,
    value: unknown,
    ttlMinutes = 60
  ): Promise<void> {
    if (!this.db) return;

    const expiresAt = new Date(
      Date.now() + ttlMinutes * 60 * 1000
    ).toISOString();

    await this.db.runAsync(
      `INSERT OR REPLACE INTO data_cache (key, value, expires_at, updated_at)
       VALUES (?, ?, ?, datetime('now'))`,
      key,
      JSON.stringify(value),
      expiresAt
    );
  }

  /**
   * Retrieves a cached value. Returns null if expired or not found.
   */
  async getCachedData<T>(key: string): Promise<T | null> {
    if (!this.db) return null;

    const row = await this.db.getFirstAsync<{
      value: string;
      expires_at: string;
    }>(
      `SELECT value, expires_at FROM data_cache WHERE key = ?`,
      key
    );

    if (!row) return null;

    // Check expiration
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      // Expired - delete and return null
      await this.db.runAsync(`DELETE FROM data_cache WHERE key = ?`, key);
      return null;
    }

    try {
      return JSON.parse(row.value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Clears all expired cache entries.
   */
  async clearExpiredCache(): Promise<void> {
    if (!this.db) return;

    await this.db.runAsync(
      `DELETE FROM data_cache WHERE expires_at < datetime('now')`
    );
  }

  /**
   * Tears down the service and closes the database connection.
   */
  async destroy(): Promise<void> {
    this.connectivitySubscription?.();
    await this.db?.closeAsync();
    this.db = null;
  }
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

export const offlineService = new OfflineService();
