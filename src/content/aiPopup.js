import { UI } from './ui.js';

class AIPopup {
  constructor() {
    this.popup = null;
    this.currentType = 'AI_RESULT';
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.theme = UI.getColorScheme('default');
    this.outsideClickTimer = null;
    this.boundDrag = this.drag.bind(this);
    this.boundStopDrag = this.stopDrag.bind(this);
    this.boundHandleOutsideClick = this.handleOutsideClick.bind(this);
  }

  async show(result, type) {
    this.hide(true);
    this.currentType = type;
    this.theme = await this.getTheme();

    const popup = document.createElement('div');
    popup.className = 'weblang-ai-popup';
    popup.innerHTML = this.getPopupHTML(result, type);
    this.applyTheme(popup);

    document.body.appendChild(popup);
    this.popup = popup;
    this.positionPopup();
    this.attachEventListeners();

    requestAnimationFrame(() => {
      if (this.popup === popup) {
        popup.classList.add('weblang-ai-popup-visible');
      }
    });
  }

  hide(immediate = false) {
    if (!this.popup) {
      return;
    }

    const popup = this.popup;
    this.detachEventListeners();

    if (immediate) {
      popup.remove();
      return;
    }

    popup.classList.remove('weblang-ai-popup-visible');
    window.setTimeout(() => {
      if (popup.parentNode) {
        popup.remove();
      }
    }, 180);
  }

  async getTheme() {
    const prefs = await UI.getUserPreferences().catch(() => ({ translationColor: 'default' }));
    return UI.getColorScheme(prefs.translationColor || 'default');
  }

  applyTheme(popup) {
    popup.style.setProperty('--weblang-ai-text', this.theme.color);
    popup.style.setProperty('--weblang-ai-bg', this.theme.bg);
    popup.style.setProperty('--weblang-ai-border', this.theme.border);
  }

  positionPopup() {
    if (!this.popup) {
      return;
    }

    const rect = this.popup.getBoundingClientRect();
    const left = Math.max(10, (window.innerWidth - rect.width) / 2);
    const top = Math.max(10, (window.innerHeight - rect.height) / 2);

    this.popup.style.left = `${left}px`;
    this.popup.style.top = `${top}px`;
  }

  getPopupHTML(result, type) {
    const typeNames = {
      AI_SUMMARIZE: 'Summary',
      AI_ANALYZE: 'Analysis',
      AI_KEYWORDS: 'Keywords'
    };

    return `
      <div class="weblang-ai-header">
        <div class="weblang-ai-title">
          <span class="weblang-ai-title-badge">AI</span>
          <span>${typeNames[type] || 'Result'}</span>
        </div>
        <button class="weblang-ai-close" type="button" aria-label="Close AI popup">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="weblang-ai-content">
        <div class="weblang-ai-result">${this.formatResult(result, type)}</div>
      </div>
      <div class="weblang-ai-footer">
        <button class="weblang-ai-btn weblang-ai-btn-ghost" type="button" data-action="copy">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy
        </button>
        <button class="weblang-ai-btn weblang-ai-btn-ghost" type="button" data-action="export-txt">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          Export TXT
        </button>
        <button class="weblang-ai-btn weblang-ai-btn-solid" type="button" data-action="export-pdf">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Export PDF
        </button>
      </div>
    `;
  }

  formatResult(result, type) {
    if (!result) {
      return '<p class="weblang-ai-paragraph">No result available.</p>';
    }

    if (type === 'AI_KEYWORDS') {
      const keywords = result
        .split(',')
        .map((keyword) => this.escapeHtml(keyword.trim()))
        .filter(Boolean);

      return `
        <div class="weblang-ai-keyword-wrap">
          ${keywords.map((keyword) => `<span class="weblang-ai-keyword">${keyword}</span>`).join('')}
        </div>
      `;
    }

    if (type === 'AI_ANALYZE') {
      return this.formatAnalysisText(result);
    }

    return this.formatSummaryText(result);
  }

  formatAnalysisText(text) {
    const escaped = this.escapeHtml(text).replace(/\r\n/g, '\n');
    const paragraphs = escaped
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    return paragraphs.map((paragraph) => {
      const lines = paragraph.split('\n').map((line) => line.trim()).filter(Boolean);
      const renderedLines = lines.map((line) => {
        const numbered = line.match(/^(\d+)\.\s+(.*)$/);
        if (numbered) {
          return `<div class="weblang-ai-line"><span class="weblang-ai-marker">${numbered[1]}.</span>${this.applyInlineFormatting(numbered[2])}</div>`;
        }

        const bullet = line.match(/^[-*]\s+(.*)$/);
        if (bullet) {
          return `<div class="weblang-ai-line"><span class="weblang-ai-marker">-</span>${this.applyInlineFormatting(bullet[1])}</div>`;
        }

        return `<div class="weblang-ai-line">${this.applyInlineFormatting(line)}</div>`;
      });

      return `<section class="weblang-ai-block">${renderedLines.join('')}</section>`;
    }).join('');
  }

  formatSummaryText(text) {
    const escaped = this.escapeHtml(text).replace(/\r\n/g, '\n');
    const paragraphs = escaped
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    return paragraphs
      .map((paragraph) => `<p class="weblang-ai-paragraph">${this.applyInlineFormatting(paragraph).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  applyInlineFormatting(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/(^|[\s>])([A-Z][A-Za-z\s]+:)(?=\s|<|$)/g, '$1<span class="weblang-ai-label">$2</span>');
  }

  escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  attachEventListeners() {
    if (!this.popup) {
      return;
    }

    this.popup.querySelector('.weblang-ai-close')?.addEventListener('click', () => this.hide());
    this.popup.querySelector('.weblang-ai-header')?.addEventListener('mousedown', (event) => this.startDrag(event));
    this.popup.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', (event) => {
        const action = event.currentTarget.getAttribute('data-action');
        this.handleAction(action);
      });
    });

    document.addEventListener('mousemove', this.boundDrag);
    document.addEventListener('mouseup', this.boundStopDrag);
    this.outsideClickTimer = window.setTimeout(() => {
      document.addEventListener('click', this.boundHandleOutsideClick, true);
    }, 50);
  }

  detachEventListeners() {
    if (this.outsideClickTimer) {
      window.clearTimeout(this.outsideClickTimer);
      this.outsideClickTimer = null;
    }

    document.removeEventListener('mousemove', this.boundDrag);
    document.removeEventListener('mouseup', this.boundStopDrag);
    document.removeEventListener('click', this.boundHandleOutsideClick, true);
    document.body.style.userSelect = '';
    this.isDragging = false;
    this.popup = null;
  }

  startDrag(event) {
    if (!this.popup) {
      return;
    }

    const interactive = event.target instanceof Element && event.target.closest('button,[data-action]');
    if (interactive) {
      return;
    }

    const rect = this.popup.getBoundingClientRect();
    this.isDragging = true;
    this.dragOffset.x = event.clientX - rect.left;
    this.dragOffset.y = event.clientY - rect.top;
    document.body.style.userSelect = 'none';
  }

  drag(event) {
    if (!this.isDragging || !this.popup) {
      return;
    }

    event.preventDefault();

    const rect = this.popup.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 10;
    const maxY = window.innerHeight - rect.height - 10;
    const nextX = Math.max(10, Math.min(event.clientX - this.dragOffset.x, maxX));
    const nextY = Math.max(10, Math.min(event.clientY - this.dragOffset.y, maxY));

    this.popup.style.left = `${nextX}px`;
    this.popup.style.top = `${nextY}px`;
  }

  stopDrag() {
    this.isDragging = false;
    document.body.style.userSelect = '';
  }

  handleOutsideClick(event) {
    if (this.popup && !this.popup.contains(event.target) && !this.isDragging) {
      this.hide();
    }
  }

  async handleAction(action) {
    if (!this.popup) {
      return;
    }

    const contentElement = this.popup.querySelector('.weblang-ai-result');
    const cleanContent = this.getCleanExportContent(contentElement, this.currentType);

    switch (action) {
      case 'copy':
        try {
          await navigator.clipboard.writeText(cleanContent);
          this.showToast('Copied to clipboard');
        } catch {
          const textArea = document.createElement('textarea');
          textArea.value = cleanContent;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          textArea.remove();
          this.showToast('Copied to clipboard');
        }
        break;
      case 'export-txt':
        this.exportAsText(cleanContent);
        break;
      case 'export-pdf':
        this.exportAsPDF(cleanContent);
        break;
      default:
        break;
    }
  }

  getCleanExportContent(element, type) {
    if (!element) {
      return '';
    }

    if (type === 'AI_KEYWORDS') {
      const keywords = Array.from(element.querySelectorAll('.weblang-ai-keyword'))
        .map((item) => item.textContent.trim())
        .filter(Boolean);
      return `Keywords:\n${keywords.join(', ')}`;
    }

    return this.formatForExport(element.innerHTML, type);
  }

  formatForExport(html, type) {
    const text = html
      .replace(/<span class="weblang-ai-label">(.*?)<\/span>/g, '$1')
      .replace(/<span class="weblang-ai-marker">(.*?)<\/span>/g, '$1 ')
      .replace(/<div class="weblang-ai-line">/g, '')
      .replace(/<\/div>/g, '\n')
      .replace(/<section class="weblang-ai-block">/g, '\n')
      .replace(/<\/section>/g, '\n')
      .replace(/<p class="weblang-ai-paragraph">/g, '\n')
      .replace(/<\/p>/g, '\n')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();

    const headers = {
      AI_ANALYZE: '=== AI ANALYSIS RESULT ===',
      AI_SUMMARIZE: '=== AI SUMMARY RESULT ===',
      AI_KEYWORDS: '=== AI KEYWORDS RESULT ==='
    };

    return `${headers[type] || '=== AI RESULT ==='}\nGenerated: ${new Date().toLocaleString()}\n\n${text}\n\n--- End of Result ---`;
  }

  exportAsText(content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `weblang-ai-result-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    this.showToast('Text file exported');
  }

  exportAsPDF(content) {
    chrome.runtime.sendMessage(
      {
        type: 'EXPORT_AI_PDF',
        content,
        title: 'WebLang AI Result'
      },
      (response) => {
        this.showToast(response?.success ? 'PDF exported' : 'PDF export failed');
      }
    );
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'weblang-ai-toast';
    toast.textContent = message;
    toast.style.setProperty('--weblang-ai-text', this.theme.color);
    toast.style.setProperty('--weblang-ai-bg', this.theme.bg);
    toast.style.setProperty('--weblang-ai-border', this.theme.border);
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('weblang-ai-toast-visible'));
    window.setTimeout(() => {
      toast.classList.remove('weblang-ai-toast-visible');
      window.setTimeout(() => toast.remove(), 180);
    }, 1800);
  }
}

export { AIPopup };
