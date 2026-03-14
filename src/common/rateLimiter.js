export const RateLimiter = (() => {
  let lastRequestAt = 0;
  let requestCount = 0;
  let windowStart = Date.now();

  /**
   * Returns true if the caller should be throttled.
   * Resets the counter every 3 seconds.
   * @param {number} [ms=25] - Minimum milliseconds between requests.
   */
  function isLimited(ms = 25) {
    const now = Date.now();

    // Reset counter every 3 seconds
    if (now - windowStart > 3000) {
      requestCount = 0;
      windowStart = now;
    }

    // Hard cap per window to prevent runaway requests
    if (requestCount >= 500) {
      return true;
    }

    // Enforce minimum delay between consecutive requests
    if (now - lastRequestAt < ms) {
      return true;
    }

    lastRequestAt = now;
    requestCount++;
    return false;
  }

  return { isLimited };
})();
