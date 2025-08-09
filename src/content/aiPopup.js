// AI Results Popup UI
class AIPopup {
  constructor() {
    this.popup = null;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
  }

  show(result, type, targetLang) {
    this.hide(); // Hide any existing popup
    this.currentType = type; // Store for export formatting
    
    const popup = document.createElement('div');
    popup.className = 'weblang-ai-popup';
    popup.innerHTML = this.getPopupHTML(result, type, targetLang);
    
    document.body.appendChild(popup);
    this.popup = popup;
    
    // Position popup in center of viewport
    const rect = popup.getBoundingClientRect();
    popup.style.left = `${(window.innerWidth - rect.width) / 2}px`;
    popup.style.top = `${(window.innerHeight - rect.height) / 2}px`;
    
    this.attachEventListeners();
    
    // Animate in
    setTimeout(() => popup.classList.add('weblang-ai-popup-visible'), 10);
  }

  hide() {
    if (this.popup) {
      this.popup.classList.remove('weblang-ai-popup-visible');
      setTimeout(() => {
        if (this.popup && this.popup.parentNode) {
          this.popup.parentNode.removeChild(this.popup);
        }
        this.popup = null;
      }, 200);
    }
  }

  getPopupHTML(result, type, targetLang) {
    const typeNames = {
      'AI_SUMMARIZE': 'Summary',
      'AI_ANALYZE': 'Analysis', 
      'AI_KEYWORDS': 'Keywords'
    };
    
    const typeName = typeNames[type] || 'AI Result';
    
    return `
      <div class="weblang-ai-header">
        <div class="weblang-ai-drag-handle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M9 9h6v6h-6z"></path>
            <path d="M9 3h6v6h-6z"></path>
            <path d="M9 15h6v6h-6z"></path>
            <path d="M3 9h6v6H3z"></path>
            <path d="M3 3h6v6H3z"></path>
            <path d="M3 15h6v6H3z"></path>
          </svg>
        </div>
        <div class="weblang-ai-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
          </svg>
          AI ${typeName}
        </div>
        <button class="weblang-ai-close" title="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="weblang-ai-content">
        <div class="weblang-ai-result">${this.formatResult(result, type)}</div>
      </div>
      
      <div class="weblang-ai-footer">
        <div class="weblang-ai-actions">
          <button class="weblang-ai-btn weblang-ai-btn-secondary" data-action="copy">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
            </svg>
            Copy
          </button>
          <button class="weblang-ai-btn weblang-ai-btn-secondary" data-action="export-txt">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            Export TXT
          </button>
          <button class="weblang-ai-btn weblang-ai-btn-primary" data-action="export-pdf">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"></path>
              <polyline points="7,10 12,15 17,10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export PDF
          </button>
        </div>
      </div>
    `;
  }

  formatResult(result, type) {
    if (type === 'AI_KEYWORDS') {
      // Format keywords as tags
      const keywords = result.split(',').map(k => k.trim()).filter(k => k);
      return keywords.map(keyword => 
        `<span class="weblang-ai-keyword">${keyword}</span>`
      ).join('');
    }
    
    if (type === 'AI_ANALYZE') {
      // Format analysis with proper sections
      return this.formatAnalysisText(result);
    }
    
    if (type === 'AI_SUMMARIZE') {
      // Format summary with better paragraph breaks
      return this.formatSummaryText(result);
    }
    
    // Default formatting with line breaks
    return result.replace(/\n/g, '<br>');
  }

  formatAnalysisText(text) {
    // Split by common analysis sections
    let formatted = text;
    
    // Add proper spacing and formatting for analysis sections
    formatted = formatted
      // Bold section headers
      .replace(/\*\*(.*?)\*\*/g, '<strong class="weblang-ai-section-header">$1</strong>')
      // Format bullet points
      .replace(/^\s*[-•]\s*/gm, '<span class="weblang-ai-bullet">•</span> ')
      // Format numbered lists
      .replace(/^\s*(\d+)\.\s*/gm, '<span class="weblang-ai-number">$1.</span> ')
      // Add line breaks
      .replace(/\n/g, '<br>')
      // Format categories/labels
      .replace(/([A-Z][a-z\s]+):\s*/g, '<span class="weblang-ai-label">$1:</span> ')
      // Clean up extra spaces
      .replace(/\s+/g, ' ')
      .trim();
    
    return formatted;
  }

  formatSummaryText(text) {
    // Format summary with better paragraph structure
    let formatted = text;
    
    formatted = formatted
      // Format emphasis
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Add proper paragraph breaks for double line breaks
      .replace(/\n\n/g, '</p><p class="weblang-ai-paragraph">')
      // Single line breaks become <br>
      .replace(/\n/g, '<br>')
      // Wrap in paragraph if not already wrapped
      .replace(/^(?!<p)/, '<p class="weblang-ai-paragraph">')
      .replace(/(?!<\/p>)$/, '</p>')
      // Clean up
      .replace(/\s+/g, ' ')
      .trim();
    
    return formatted;
  }

  attachEventListeners() {
    if (!this.popup) return;

    // Close button
    const closeBtn = this.popup.querySelector('.weblang-ai-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Drag functionality
    const dragHandle = this.popup.querySelector('.weblang-ai-drag-handle');
    const header = this.popup.querySelector('.weblang-ai-header');
    
    if (dragHandle && header) {
      header.addEventListener('mousedown', this.startDrag.bind(this));
      document.addEventListener('mousemove', this.drag.bind(this));
      document.addEventListener('mouseup', this.stopDrag.bind(this));
    }

    // Action buttons
    const actionBtns = this.popup.querySelectorAll('[data-action]');
    actionBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.getAttribute('data-action');
        this.handleAction(action);
      });
    });

    // Click outside to close
    setTimeout(() => {
      document.addEventListener('click', this.handleOutsideClick.bind(this), true);
    }, 100);
  }

  startDrag(e) {
    this.isDragging = true;
    const rect = this.popup.getBoundingClientRect();
    this.dragOffset.x = e.clientX - rect.left;
    this.dragOffset.y = e.clientY - rect.top;
    
    this.popup.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }

  drag(e) {
    if (!this.isDragging || !this.popup) return;
    
    e.preventDefault();
    
    const x = e.clientX - this.dragOffset.x;
    const y = e.clientY - this.dragOffset.y;
    
    // Keep popup within viewport
    const rect = this.popup.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;
    
    this.popup.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
    this.popup.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
  }

  stopDrag() {
    this.isDragging = false;
    if (this.popup) {
      this.popup.style.cursor = '';
    }
    document.body.style.userSelect = '';
  }

  handleOutsideClick(e) {
    if (this.popup && !this.popup.contains(e.target) && !this.isDragging) {
      this.hide();
      document.removeEventListener('click', this.handleOutsideClick, true);
    }
  }

  async handleAction(action) {
    const contentElement = this.popup.querySelector('.weblang-ai-result');
    const rawContent = contentElement.textContent;
    const cleanContent = this.getCleanExportContent(contentElement, this.currentType);
    
    switch (action) {
      case 'copy':
        try {
          await navigator.clipboard.writeText(cleanContent);
          this.showToast('Copied to clipboard!');
        } catch (e) {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = cleanContent;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          this.showToast('Copied to clipboard!');
        }
        break;
        
      case 'export-txt':
        this.exportAsText(cleanContent);
        break;
        
      case 'export-pdf':
        this.exportAsPDF(cleanContent);
        break;
    }
  }

  getCleanExportContent(element, type) {
    // Get clean text for export
    let content = '';
    
    if (type === 'AI_KEYWORDS') {
      // For keywords, join with commas
      const keywords = Array.from(element.querySelectorAll('.weblang-ai-keyword'))
        .map(el => el.textContent.trim());
      content = `Keywords:\n${keywords.join(', ')}`;
    } else {
      // For analysis and summary, format nicely
      content = this.formatForExport(element.innerHTML, type);
    }
    
    return content;
  }

  formatForExport(html, type) {
    // Convert HTML back to clean text format
    let text = html
      // Convert section headers
      .replace(/<strong class="weblang-ai-section-header">(.*?)<\/strong>/g, '\n\n** $1 **\n')
      // Convert labels
      .replace(/<span class="weblang-ai-label">(.*?)<\/span>/g, '$1')
      // Convert bullets
      .replace(/<span class="weblang-ai-bullet">•<\/span>\s*/g, '• ')
      // Convert numbers
      .replace(/<span class="weblang-ai-number">(.*?)<\/span>\s*/g, '$1 ')
      // Convert paragraphs
      .replace(/<p class="weblang-ai-paragraph">/g, '\n')
      .replace(/<\/p>/g, '\n')
      // Convert line breaks
      .replace(/<br\s*\/?>/g, '\n')
      // Remove all other HTML tags
      .replace(/<[^>]*>/g, '')
      // Clean up extra whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/^\s+|\s+$/g, '')
      .trim();

    // Add header based on type
    const headers = {
      'AI_ANALYZE': '=== AI ANALYSIS RESULT ===',
      'AI_SUMMARIZE': '=== AI SUMMARY RESULT ===',
      'AI_KEYWORDS': '=== AI KEYWORDS RESULT ==='
    };

    const header = headers[type] || '=== AI RESULT ===';
    const timestamp = new Date().toLocaleString();
    
    return `${header}\nGenerated: ${timestamp}\n\n${text}\n\n--- End of Result ---`;
  }

  exportAsText(content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weblang-ai-result-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('Text file exported!');
  }

  exportAsPDF(content) {
    // Send to background script for PDF generation
    chrome.runtime.sendMessage({
      type: 'EXPORT_AI_PDF',
      content: content,
      title: 'WebLang AI Result'
    }, (response) => {
      if (response && response.success) {
        this.showToast('PDF exported!');
      } else {
        this.showToast('PDF export failed');
      }
    });
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'weblang-ai-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('weblang-ai-toast-visible'), 10);
    setTimeout(() => {
      toast.classList.remove('weblang-ai-toast-visible');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 200);
    }, 2000);
  }
}

export { AIPopup };
