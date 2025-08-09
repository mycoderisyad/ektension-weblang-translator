export const ExportUtils = (() => {
  async function doExport({ fileType, content, filename = 'weblang-export' }) {
    try {
      if (fileType === 'pdf') {
        const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${filename}</title>
<style>@page{margin:2cm;size:A4}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:none;margin:0;padding:20px;background:white}.header{text-align:center;border-bottom:2px solid #2563eb;padding-bottom:15px;margin-bottom:30px}.header h1{color:#2563eb;margin:0 0 10px 0;font-size:28px;font-weight:600}.header .meta{color:#64748b;font-size:14px}.content{white-space:pre-wrap;word-wrap:break-word;font-size:14px;line-height:1.8}.footer{margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;text-align:center;color:#64748b;font-size:12px}@media print{body{margin:0;padding:15px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none}.header h1{color:#2563eb!important}}</style></head><body>
<div class="header"><h1>WebLang Export</h1><div class="meta">Generated on ${new Date().toLocaleString('id-ID',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div></div>
<div class="content">${content.replace(/\n/g,'<br>')}</div>
<div class="footer"><p>Exported by WebLang Translator Chrome Extension</p></div>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),800));window.addEventListener('afterprint',()=>setTimeout(()=>window.close(),1000));</script>
</body></html>`;
        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
        await chrome.tabs.create({ url: dataUrl, active: true });
        return true;
      } else {
        const mimeType = 'text/plain';
        const base64Content = btoa(unescape(encodeURIComponent(content)));
        await chrome.downloads.download({ url: `data:${mimeType};base64,${base64Content}`, filename: `${filename}.${fileType}`, conflictAction: 'uniquify', saveAs: true });
        return true;
      }
    } catch (err) {
      console.error('Export failed:', err);
      throw err;
    }
  }

  async function exportTranslation({ fileType, originalTexts, translatedTexts, mode = 'bilingual', sourceLang = 'en', targetLang = 'id' }) {
    try {
      let content = '', filename = `translation-${sourceLang}-to-${targetLang}`;
      if (mode === 'translation-only') {
        filename += '-translated';
        content = translatedTexts.join('\n\n');
      } else {
        filename += '-bilingual';
        for (let i = 0; i < originalTexts.length; i++) {
          content += `[${sourceLang.toUpperCase()}]: ${originalTexts[i]}\n[${targetLang.toUpperCase()}]: ${translatedTexts[i]}\n\n`;
        }
      }
      const result = await doExport({ fileType, content, filename });
      if (!result) throw new Error('Export failed');
      return result;
    } catch (err) {
      console.error('Translation export failed:', err);
      throw err;
    }
  }

  return { doExport, exportTranslation };
})();


