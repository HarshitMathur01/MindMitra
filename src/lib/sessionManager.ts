/**
 * SessionManager - Unified session ID management for MindMitra
 * 
 * Single source of truth for session IDs across the entire app.
 * Both chat and games use the same session key ('currentChatSession')
 * to ensure all data links to the same session.
 */

export class SessionManager {
  private static readonly SESSION_KEY = 'currentChatSession';
  private static readonly LEGACY_KEY = 'mind_mate_session_id';
  private static readonly UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  private static _migrated = false;

  /** One-time cleanup: migrate legacy key to the unified key */
  private static migrateLegacyKey(): void {
    if (this._migrated) return;
    this._migrated = true;

    const legacy = localStorage.getItem(this.LEGACY_KEY);
    if (legacy && this.isValidUUID(legacy)) {
      // Only adopt legacy ID if no current session exists
      if (!localStorage.getItem(this.SESSION_KEY)) {
        localStorage.setItem(this.SESSION_KEY, legacy);
      }
    }
    // Clean up legacy keys from both storages
    localStorage.removeItem(this.LEGACY_KEY);
    sessionStorage.removeItem(this.LEGACY_KEY);
  }

  /**
   * Get the current session ID, or create a new one if none exists.
   * This is the primary method to use throughout the application.
   * 
   * @returns A valid UUID session ID
   */
  static getSessionId(): string {
    // Migrate legacy key on first access
    this.migrateLegacyKey();

    // Check localStorage (single source of truth)
    const sessionId = localStorage.getItem(this.SESSION_KEY);
    
    if (sessionId && this.isValidUUID(sessionId)) {
      return sessionId;
    }
    
    // No valid session found — generate new UUID
    const newId = crypto.randomUUID();
    this.setSessionId(newId);
    console.log('[SessionManager] Generated NEW session ID:', newId);
    return newId;
  }

  /**
   * Set a specific session ID. Validates UUID format.
   * 
   * @param id - UUID string to set as session ID
   * @throws Error if ID is not a valid UUID
   */
  static setSessionId(id: string): void {
    if (!this.isValidUUID(id)) {
      console.error('[SessionManager] Invalid UUID format:', id);
      throw new Error(`Invalid session ID format: ${id}. Must be a valid UUID.`);
    }
    
    localStorage.setItem(this.SESSION_KEY, id);
  }

  /**
   * Clear the current session. Useful for logout or starting fresh.
   */
  static clearSession(): void {
    localStorage.removeItem(this.SESSION_KEY);
  }

  /**
   * Start a completely new session by clearing old one and generating new UUID.
   * 
   * @returns The new session ID
   */
  static startNewSession(): string {
    this.clearSession();
    const newSessionId = this.getSessionId();
    console.log('[SessionManager] Started new session:', newSessionId);
    return newSessionId;
  }

  /**
   * Check if a string is a valid UUID v4 format.
   * 
   * @param str - String to validate
   * @returns true if valid UUID, false otherwise
   */
  private static isValidUUID(str: string): boolean {
    return this.UUID_REGEX.test(str);
  }

  /**
   * Check if a valid session currently exists
   */
  static hasValidSession(): boolean {
    const sessionId = localStorage.getItem(this.SESSION_KEY);
    return sessionId !== null && this.isValidUUID(sessionId);
  }

  /**
   * Get session info for debugging
   */
  static getSessionInfo(): { hasSession: boolean; sessionId: string | null; isValid: boolean } {
    const sessionId = localStorage.getItem(this.SESSION_KEY);
    const isValid = sessionId ? this.isValidUUID(sessionId) : false;
    
    return {
      hasSession: sessionId !== null,
      sessionId: sessionId,
      isValid: isValid
    };
  }
}
