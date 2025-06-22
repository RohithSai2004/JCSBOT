
/**
 * Generates a random session ID for new conversations
 * @returns {string} A random UUID v4 string
 */
export function generateSessionId() {
  // Simple UUID v4 implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Clears the current session data from local storage
 */
export function clearSessionData() {
  // If you're storing any session-specific data in localStorage, clear it here
  // For example:
  // localStorage.removeItem('currentSessionData');
}
