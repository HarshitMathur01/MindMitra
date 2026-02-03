/**
 * SessionManager - Unified session ID management for Mind-Mate
 * 
 * Fixes the critical session fragmentation issue where games and chat
 * were using different storage mechanisms and generating different session IDs.
 * 
 * This ensures:
 * - Single source of truth for session IDs
 * - Consistent UUID format validation
 * - Synchronized storage across localStorage and sessionStorage
 * - Game data and chat data link to the same session
 */

export class SessionManager {
  private static readonly SESSION_KEY = 'mind_mate_session_id';
  private static readonly UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /**
   * Get the current session ID, or create a new one if none exists.
   * This is the primary method to use throughout the application.
   * 
   * @returns A valid UUID session ID
   */
  static getSessionId(): string {
    // Check localStorage first (primary storage)
    let sessionId = localStorage.getItem(this.SESSION_KEY);
    
    // Validate it's a proper UUID
    if (sessionId && this.isValidUUID(sessionId)) {
      // Sync to sessionStorage to ensure consistency
      this.syncToSessionStorage(sessionId);
      console.log('[SessionManager] Retrieved session ID from localStorage:', sessionId);
      return sessionId;
    }
    
    // Fallback: Check sessionStorage
    sessionId = sessionStorage.getItem(this.SESSION_KEY);
    if (sessionId && this.isValidUUID(sessionId)) {
      // Sync back to localStorage (primary storage)
      this.syncToLocalStorage(sessionId);
      console.log('[SessionManager] Retrieved session ID from sessionStorage:', sessionId);
      return sessionId;
    }
    
    // No valid session found - generate new UUID
    sessionId = crypto.randomUUID();
    this.setSessionId(sessionId);
    console.log('[SessionManager] Generated NEW session ID:', sessionId);
    return sessionId;
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
    
    // Store in both locations for consistency
    localStorage.setItem(this.SESSION_KEY, id);
    sessionStorage.setItem(this.SESSION_KEY, id);
    console.log('[SessionManager] Session ID set successfully:', id);
  }

  /**
   * Clear the current session. Useful for logout or starting fresh.
   */
  static clearSession(): void {
    localStorage.removeItem(this.SESSION_KEY);
    sessionStorage.removeItem(this.SESSION_KEY);
    console.log('[SessionManager] Session cleared');
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
   * Sync session ID to localStorage (primary storage)
   */
  private static syncToLocalStorage(id: string): void {
    localStorage.setItem(this.SESSION_KEY, id);
  }

  /**
   * Sync session ID to sessionStorage (secondary storage)
   */
  private static syncToSessionStorage(id: string): void {
    sessionStorage.setItem(this.SESSION_KEY, id);
  }

  /**
   * Check if a valid session currently exists
   * 
   * @returns true if valid session exists, false otherwise
   */
  static hasValidSession(): boolean {
    const sessionId = localStorage.getItem(this.SESSION_KEY) || sessionStorage.getItem(this.SESSION_KEY);
    return sessionId !== null && this.isValidUUID(sessionId);
  }

  /**
   * Get session info for debugging
   * 
   * @returns Object with session status information
   */
  static getSessionInfo(): { hasSession: boolean; sessionId: string | null; isValid: boolean } {
    const sessionId = localStorage.getItem(this.SESSION_KEY) || sessionStorage.getItem(this.SESSION_KEY);
    const isValid = sessionId ? this.isValidUUID(sessionId) : false;
    
    return {
      hasSession: sessionId !== null,
      sessionId: sessionId,
      isValid: isValid
    };
  }
}
