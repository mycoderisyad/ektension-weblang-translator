// Tooltip Module — Shows original text on mouseover after full-page translation
// Inspired by XTranslate's data-xtranslate-tooltip system

export const Tooltip = (() => {
  let tooltipEl = null;
  let isActive = false;
  let hideTimeout = null;
  let currentTarget = null;

  // Inject tooltip styles
  function injectStyles() {
    if (document.getElementById('weblang-tooltip-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'weblang-tooltip-styles';
    style.textContent = `
      .weblang-tooltip {
        position: fixed;
        z-index: 2147483646;
        max-width: 480px;
        min-width: 120px;
        padding: 10px 14px;
        background: var(--weblang-tooltip-bg, #DCD7C9);
        color: var(--weblang-tooltip-color, #2C3E50);
        border: 2px dashed var(--weblang-tooltip-border, #BDB7AA);
        border-radius: 8px;
        font-size: 13px;
        line-height: 1.55;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        pointer-events: none;
        opacity: 0;
        transform: translateY(4px);
        transition: opacity 0.2s ease, transform 0.2s ease;
        word-wrap: break-word;
        white-space: pre-wrap;
      }
      .weblang-tooltip.visible {
        opacity: 1;
        transform: translateY(0);
      }
      .weblang-tooltip-text {
        color: inherit;
      }
      [data-weblang-tooltip] {
        cursor: help;
        border-bottom: 2px dotted rgba(0, 0, 0, 0.2);
        transition: border-color 0.2s;
      }
      [data-weblang-tooltip]:hover {
        border-bottom-color: rgba(0, 0, 0, 0.5);
      }
    `;
    document.head.appendChild(style);
  }

  // Create tooltip element
  function createTooltipEl() {
    if (tooltipEl) return;
    
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'weblang-tooltip';
    tooltipEl.innerHTML = `
      <div class="weblang-tooltip-text"></div>
    `;
    document.body.appendChild(tooltipEl);
  }

  // Position tooltip near element
  function positionTooltip(targetEl) {
    if (!tooltipEl || !targetEl) return;
    
    const rect = targetEl.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    
    let left = rect.left;
    let top = rect.bottom + 6;
    
    // Prevent overflow right
    if (left + tooltipRect.width > viewW - 10) {
      left = viewW - tooltipRect.width - 10;
    }
    // Prevent overflow left
    if (left < 10) left = 10;
    
    // If tooltip would go below viewport, show above
    if (top + tooltipRect.height > viewH - 10) {
      top = rect.top - tooltipRect.height - 6;
    }
    
    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
  }

  // Show tooltip with original text
  function showTooltip(targetEl) {
    if (!tooltipEl || !targetEl) return;
    
    const originalText = targetEl.getAttribute('data-weblang-original');
    if (!originalText) return;
    
    clearTimeout(hideTimeout);
    currentTarget = targetEl;
    
    const textEl = tooltipEl.querySelector('.weblang-tooltip-text');
    textEl.textContent = originalText;
    
    // Apply dynamic pastel theme based on the target element's colored container
    const colorContainer = targetEl.closest('.weblang-translation') || targetEl;
    const computedBg = window.getComputedStyle(colorContainer).backgroundColor;
    let themeBg = '#DCD7C9'; let themeBorder = '#BDB7AA';
    
    // Simple heuristic to match the hover tooltip with the parent's pastel color
    if (computedBg.includes('191, 146, 100') || colorContainer.style.background.includes('#BF9264')) { themeBg = '#BF9264'; themeBorder = '#A67D55'; } // Red
    else if (computedBg.includes('174, 198, 207') || colorContainer.style.background.includes('#AEC6CF')) { themeBg = '#AEC6CF'; themeBorder = '#92A8B0'; } // Blue
    else if (computedBg.includes('168, 187, 163') || colorContainer.style.background.includes('#A8BBA3')) { themeBg = '#A8BBA3'; themeBorder = '#8A9A86'; } // Green
    else if (computedBg.includes('246, 239, 189') || colorContainer.style.background.includes('#F6EFBD')) { themeBg = '#F6EFBD'; themeBorder = '#D0CA9F'; } // Yellow

    tooltipEl.style.setProperty('--weblang-tooltip-bg', themeBg);
    tooltipEl.style.setProperty('--weblang-tooltip-border', themeBorder);
    
    // Show and position
    tooltipEl.classList.add('visible');
    
    // Need to position after making visible (to get accurate dimensions)
    requestAnimationFrame(() => positionTooltip(targetEl));
  }

  // Hide tooltip
  function hideTooltip() {
    if (!tooltipEl) return;
    
    hideTimeout = setTimeout(() => {
      tooltipEl.classList.remove('visible');
      currentTarget = null;
    }, 100);
  }

  // Mouse move handler — check if hovering over a tooltip-eligible element
  function onMouseMove(e) {
    if (!isActive) return;
    
    const target = e.target;
    if (!target || !(target instanceof HTMLElement)) return;
    
    // Find closest element with tooltip attribute
    const tooltipTarget = target.closest('[data-weblang-tooltip]');
    
    if (tooltipTarget) {
      if (tooltipTarget !== currentTarget) {
        showTooltip(tooltipTarget);
      }
    } else if (currentTarget) {
      hideTooltip();
    }
  }

  // Enable tooltip tracking
  function enable() {
    if (isActive) return;
    
    injectStyles();
    createTooltipEl();
    isActive = true;
    document.addEventListener('mousemove', onMouseMove, { passive: true });
  }

  // Disable tooltip tracking
  function disable() {
    isActive = false;
    document.removeEventListener('mousemove', onMouseMove);
    
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }
    currentTarget = null;
  }

  // Check if tooltip is active
  function isEnabled() {
    return isActive;
  }

  return {
    enable,
    disable,
    isEnabled,
  };
})();
