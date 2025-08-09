export const RateLimiter = (() => {
  let lastRequestAt = 0;
  let requestCount = 0;
  let windowStart = Date.now();
  
  function isLimited(ms = 200) { // Reduced from 500ms to 200ms
    const now = Date.now();
    
    // Reset counter every 10 seconds
    if (now - windowStart > 10000) {
      requestCount = 0;
      windowStart = now;
    }
    
    // Allow up to 50 requests per 10 seconds
    if (requestCount >= 50) {
      console.log('Rate limit hit: too many requests');
      return true;
    }
    
    // Simple time-based limiting
    if (now - lastRequestAt < ms) {
      return true;
    }
    
    lastRequestAt = now;
    requestCount++;
    return false;
  }
  
  return { isLimited };
})();


