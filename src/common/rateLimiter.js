export const RateLimiter = (() => {
  let lastRequestAt = 0;
  let requestCount = 0;
  let windowStart = Date.now();

  /**
   * Returns true if the caller should be throttled.
   * Allows at most 100 requests per 10-second window with a minimum
   * 50 ms gap between consecutive requests.
   * @param {number} [ms=50] - Minimum milliseconds between requests.
   */
  function isLimited(ms = 50) {
    const now = Date.now();

    if (now - windowStart > 10000) {
      requestCount = 0;
      windowStart = now;
    }

    if (requestCount >= 100) {
      return true;
    }

    if (now - lastRequestAt < ms) {
      return true;
    }

    lastRequestAt = now;
    requestCount++;
    return false;
  }

  return { isLimited };
})();
