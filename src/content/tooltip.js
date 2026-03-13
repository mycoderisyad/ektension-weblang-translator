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
        background: #1e293b;
        color: #e2e8f0;
        border: 1px solid #475569;
        border-radius: 8px;
        font-size: 13px;
        line-height: 1.55;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2);
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
      .weblang-tooltip-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #94a3b8;
        margin-bottom: 4px;
        font-weight: 600;
      }
      .weblang-tooltip-text {
        color: #f1f5f9;
      }
      [data-weblang-tooltip] {
        cursor: help;
        border-bottom: 1px dotted rgba(148, 163, 184, 0.3);
        transition: border-color 0.2s;
      }
      [data-weblang-tooltip]:hover {
        border-bottom-color: rgba(148, 163, 184, 0.6);
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
    console.log('[Tooltip] Mouseover tooltip enabled');
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
    console.log('[Tooltip] Mouseover tooltip disabled');
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
