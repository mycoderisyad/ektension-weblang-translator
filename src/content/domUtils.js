// DOM Utilities
export const DomUtils = (() => {
  let processedElements = new WeakSet();

  // Reset processed elements tracking
  function resetProcessedElements() { 
    processedElements = new WeakSet(); 
  }

  return { 
    resetProcessedElements
  };
})();