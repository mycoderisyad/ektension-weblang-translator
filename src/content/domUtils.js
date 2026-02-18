// DOM Utilities - Simplified for new architecture
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