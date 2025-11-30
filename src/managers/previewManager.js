// Preview timeout in milliseconds (15 minutes)
const PREVIEW_TIMEOUT_MS = 15 * 60 * 1000;

// In-memory storage for pending previews
const pendingPreviews = new Map();

/**
 * Store a preview event
 * @param {string} previewId - Unique preview ID
 * @param {Object} data - Preview data (event, interaction info)
 */
export function storePreview(previewId, data) {
  pendingPreviews.set(previewId, {
    ...data,
    createdAt: Date.now()
  });
}

/**
 * Get a preview event
 * @param {string} previewId - Preview ID to retrieve
 * @returns {Object|null} - Preview data or null if not found/expired
 */
export function getPreview(previewId) {
  return pendingPreviews.get(previewId) || null;
}

/**
 * Delete a preview event
 * @param {string} previewId - Preview ID to delete
 */
export function deletePreview(previewId) {
  pendingPreviews.delete(previewId);
}

/**
 * Check if a preview exists and is valid
 * @param {string} previewId - Preview ID to check
 * @returns {boolean} - True if preview exists and hasn't expired
 */
export function hasPreview(previewId) {
  return pendingPreviews.has(previewId);
}

/**
 * Clean up expired previews (older than 15 minutes)
 * Should be called periodically or before storing new previews
 */
export function cleanupExpiredPreviews() {
  const now = Date.now();
  const expirationTime = now - PREVIEW_TIMEOUT_MS;

  for (const [key, value] of pendingPreviews.entries()) {
    if (value.createdAt < expirationTime) {
      pendingPreviews.delete(key);
    }
  }
}
