export const RateLimiter = (() => {
  let lastRequestAt = 0;
  let requestCount = 0;
  let windowStart = Date.now();
  
  function isLimited(ms = 25) { // ⚡ INSTANT: Super fast like Chrome
    const now = Date.now();
    
    // Reset counter every 3 seconds for instant reset
    if (now - windowStart > 3000) {
      requestCount = 0;
      windowStart = now;
    }
    
    // ⚡ INSTANT: Maximum limit for Chrome-like speed
    if (requestCount >= 500) { // 10x higher limit for instant translation
      console.log('Rate limit hit: too many requests');
      return true;
    }
    
    // ⚡ INSTANT: Minimal delay for maximum speed
    if (now - lastRequestAt < ms) {
      return true;
    }
    
    lastRequestAt = now;
    requestCount++;
    return false;
  }
  
  return { isLimited };
})();


