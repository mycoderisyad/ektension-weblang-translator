// ==========================================================
//  WebLang Translator - Content Script FINAL (Optimized)
// ==========================================================

// ================== [CACHE UTILS] ==================
const Cache = (() => {
  function slugifyKey(str) {
    return btoa(encodeURIComponent(str).slice(0, 96));
  }
  function set(key, value) {
    try {
      sessionStorage.setItem(
        "weblang_" + slugifyKey(key),
        JSON.stringify(value)
      );
    } catch {}
  }
  function get(key) {
    try {
      let data = sessionStorage.getItem("weblang_" + slugifyKey(key));
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }
  function clear() {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith("weblang_"))
      .forEach((k) => sessionStorage.removeItem(k));
  }
  return { set, get, clear };
})();

// ============== [DOM UTILS] ================
const DomUtils = (() => {
  function isValidTextNode(el) {
    if (!el) return false;
    if (el.classList.contains("weblang-translation")) return false;
    if (el.closest("script, style, noscript, code, pre, .weblang-translation"))
      return false;
    
    // Skip code blocks and syntax highlighted content
    if (el.closest(".prettyprint, .linenums, .prettyprinted, .highlight, .code-block, .language-, [class*='lang-'], [class*='language-']"))
      return false;
    
    // Skip elements that are purely interactive/media (but allow elements that contain both text and media)
    if (el.matches("img, video, audio, canvas, svg, iframe, object, embed, input, button, select, textarea"))
      return false;
    
    // Check if element has text content (even if it also contains images)
    const hasTextContent = el.innerText && el.innerText.trim().length > 0;
    if (!hasTextContent) return false;

    // ALLOW nav and sidebar content to be translated (remove this filter)
    const links = el.querySelectorAll("a");
    if (
      links.length &&
      el.innerText.trim() ===
        Array.from(links)
          .map((a) => a.innerText.trim())
          .join(" ")
    )
      return false;
    return true;
  }
  function getContentArea() {
    const selectors = [
      "article",
      "main",
      '[role="main"]',
      ".content",
      ".post-content",
      ".article-content",
      ".entry-content",
      ".text-content",
      ".prose",
      ".markdown-body",
      ".post-body",
      ".article-body",
      ".container",
      ".wrapper",
      ".inner",
      ".page-content",
      "#content",
      "#main",
    ];
    for (let sel of selectors) {
      let el = document.querySelector(sel);
      if (el) return el;
    }
    return document.body;
  }
  function getParagraphs(area) {
    return Array.from(
      area.querySelectorAll(
        "p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th, caption"
      )
    ).filter(isValidTextNode);
  }
  function filterFullPage(elements) {
    return elements.filter((el) => {
      // Use extractTextOnly to get text without images/media
      let text = DomUtils.extractTextOnly ? DomUtils.extractTextOnly(el) : el.innerText.trim();
      if (!text || text.length < 8 || text.split(" ").length < 2) return false;
      if (/^[\d\s\-_=.,:;!?\/]*$/.test(text)) return false;
      return true;
    });
  }
  function extractTextOnly(element) {
    // Create a clone to avoid modifying the original element
    const clone = element.cloneNode(true);
    
    // Remove all image and media elements from the clone
    const mediaElements = clone.querySelectorAll("img, video, audio, canvas, svg, iframe, object, embed");
    mediaElements.forEach(media => media.remove());
    
    // Return only the text content
    return clone.innerText.trim();
  }
  function markTranslated(el, origText) {
    el.setAttribute("data-weblang-translated", "true");
    if (origText) el.setAttribute("data-weblang-original", origText);
  }
  function isTranslated(el) {
    return (
      el.hasAttribute("data-weblang-translated") ||
      el.classList.contains("weblang-translation")
    );
  }
  return {
    isValidTextNode,
    getContentArea,
    getParagraphs,
    filterFullPage,
    extractTextOnly,
    markTranslated,
    isTranslated,
  };
})();

// =============== [TRANSLATOR] ================
const Translator = (() => {
  function detectLanguage(text) {
    if (text.length < 5) return "en";

    // More comprehensive language detection
    const ind =
      /\b(dan|yang|ini|itu|adalah|akan|untuk|dari|dengan|tidak|belum|sudah|juga|harus|karena|jika|saya|kita|mereka)\b/gi;
    const eng =
      /\b(the|and|that|this|is|will|for|from|with|not|can|should|when|why|how|because|if|while|you|we|they)\b/gi;
    const jpn = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g; // Hiragana, Katakana, Kanji
    const chn = /[\u4E00-\u9FAF]/g; // Chinese characters
    const kor = /[\uAC00-\uD7AF]/g; // Korean characters
    const ara = /[\u0600-\u06FF\u0750-\u077F]/g; // Arabic characters
    const rus = /[а-яё]/gi; // Russian characters
    const fra = /\b(le|la|les|de|du|des|et|est|une|un|dans|pour|avec|sur|par|comme|mais|ce|qui|que|se|ne|pas)\b/gi; // French
    const deu = /\b(der|die|das|und|ist|in|zu|den|von|mit|sich|auf|für|als|bei|war|hat|ein|eine|nicht|wird)\b/gi; // German
    const spa = /\b(el|la|de|que|y|en|un|es|se|no|te|lo|le|da|su|por|son|con|para|al|del|los|las)\b/gi; // Spanish

    // Count matches
    const iCount = (text.match(ind) || []).length;
    const eCount = (text.match(eng) || []).length;
    const jCount = (text.match(jpn) || []).length;
    const cCount = (text.match(chn) || []).length;
    const kCount = (text.match(kor) || []).length;
    const aCount = (text.match(ara) || []).length;
    const rCount = (text.match(rus) || []).length;
    const fCount = (text.match(fra) || []).length;
    const gCount = (text.match(deu) || []).length;
    const sCount = (text.match(spa) || []).length;

    // Determine language based on character/word patterns
    if (aCount > 2) return "ar"; // Arabic
    if (jCount > 0) return "ja"; // Japanese
    if (kCount > 0) return "ko"; // Korean
    if (cCount > 3) return "zh"; // Chinese
    if (rCount >= 2) return "ru"; // Russian
    if (fCount >= 2 && fCount > eCount) return "fr"; // French
    if (gCount >= 2 && gCount > eCount) return "de"; // German
    if (sCount >= 2 && sCount > eCount) return "es"; // Spanish
    if (iCount >= 2 && iCount > eCount) return "id"; // Indonesian
    if (eCount >= 2) return "en"; // English

    // Fallback based on character sets if no word patterns found
    if (/[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/gi.test(text)) return "fr"; // French accents
    if (/[äöüß]/gi.test(text)) return "de"; // German umlauts
    if (/[ñáéíóúü]/gi.test(text)) return "es"; // Spanish accents

    return "en"; // Default to English
  }
  function request(text, from, to, retry = 0) {
    return new Promise((resolve) => {
      if (!text || text.trim().length < 2) return resolve(null);
      if (from === to && from !== "auto") return resolve(text);
      if (text.length < 3 || /^[\d\s\-_=.,:;!?\/\(\)\[\]{}'"]*$/.test(text))
        return resolve(null);
      if (!chrome.runtime || !chrome.runtime.sendMessage) return resolve(null);
      chrome.runtime.sendMessage(
        { type: "TRANSLATE_TEXT", text: text.trim(), from, to },
        (resp) => {
          if (chrome.runtime.lastError || !resp || !resp.success) {
            if (retry < 1) {
              setTimeout(
                () => resolve(Translator.request(text, from, to, retry + 1)),
                700
              );
            } else {
              resolve(null);
            }
            return;
          }
          if (
            resp.translation &&
            resp.translation !== "[failed]" &&
            resp.translation !== text &&
            !resp.translation.includes(
              "PLEASE SELECT TWO DISTINCT LANGUAGES"
            ) &&
            !resp.translation.includes("Translation failed") &&
            resp.translation.length > 0
          ) {
            resolve(resp.translation);
          } else {
            resolve(null);
          }
        }
      );
    });
  }
  return { detectLanguage, request };
})();

// ================== [UI/UX] ====================
const UI = (() => {
  function showPopup(x, y, text, isError) {
    document
      .querySelectorAll(".weblang-translation-popup")
      .forEach((p) => p.remove());
    let div = document.createElement("div");
    div.className = "weblang-translation-popup";
    div.style = `
      position: fixed; top: ${y + 25}px; left: ${x}px; z-index: 99999;
      background: ${isError ? "#fef2f2" : "#fff"}; color: ${
      isError ? "#dc2626" : "#374151"
    };
      padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,.15); font-size: 14px;
      max-width: 400px; word-break: break-word; display: flex; align-items: flex-start;
      gap: 12px; font-family: inherit; opacity:1; transition:opacity .2s;
    `;
    let span = document.createElement("span");
    span.textContent = text;
    div.appendChild(span);
    let btn = document.createElement("button");
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    btn.style =
      "background:none;border:none;color:#64748b;cursor:pointer;padding:4px;border-radius:4px;";
    btn.onclick = (e) => {
      e.stopPropagation();
      div.style.opacity = "0";
      setTimeout(() => div.remove(), 200);
    };
    div.appendChild(btn);
    document.body.appendChild(div);
    div.onclick = (e) => e.stopPropagation();
    setTimeout(() => {
      if (div.parentNode) {
        div.style.opacity = "0";
        setTimeout(() => div.remove(), 200);
      }
    }, 15000);
  }
  function showTranslateBtn(x, y, text, onClick) {
    let btn = document.createElement("button");
    btn.innerHTML = `Translate`;
    btn.style = `position:fixed;top:${y}px;left:${x}px;z-index:99999;background:#667eea;color:#fff;border:none;border-radius:8px;padding:8px 12px;cursor:pointer;font-size:13px;font-weight:500;`;
    btn.onclick = () => {
      onClick && onClick();
      btn.remove();
    };
    setTimeout(() => btn.remove(), 1250);
    document.body.appendChild(btn);
  }
  function getColors(theme = "default") {
    // Define color schemes based on theme
    const colorSchemes = {
      default: {
        color: "#374151",
        background: "rgba(55,65,81,0.1)",
        border: "#374151",
      },
      blue: {
        color: "#1e40af",
        background: "rgba(59,130,246,0.1)",
        border: "#3b82f6",
      },
      green: {
        color: "#059669",
        background: "rgba(16,185,129,0.1)",
        border: "#10b981",
      },
      red: {
        color: "#dc2626",
        background: "rgba(239,68,68,0.1)",
        border: "#ef4444",
      },
      yellow: {
        color: "#d97706",
        background: "rgba(245,158,11,0.1)",
        border: "#f59e0b",
      }
    };
    
    return colorSchemes[theme] || colorSchemes.default;
  }
  
  async function injectTranslationAfter(el, text, customTheme = null) {
    if (!text || text.length < 2 || text.includes("failed")) return; // filter error
    
    // Get color theme from storage if not provided
    let theme = customTheme;
    if (!theme) {
      try {
        const result = await chrome.storage.sync.get(['translationColor']);
        theme = result.translationColor || 'default';
      } catch (error) {
        theme = 'default';
      }
    }
    
    const colors = getColors(theme);
    let div = document.createElement("div");
    div.className = "weblang-translation";
    div.style = `margin:3px 0 6px 0;padding:8px 12px;color:${colors.color};background:${colors.background};border-left:3px solid ${colors.border};border-radius:4px;font-style:italic;display:block;opacity:0.9;`;
    div.textContent = text;
    if (el.nextSibling) el.parentNode.insertBefore(div, el.nextSibling);
    else el.parentNode.appendChild(div);
  }
  return { showPopup, showTranslateBtn, injectTranslationAfter, getColors };
})();

// ========== [SPLIT TEXT SMART] ==========
function splitTextSmart(text, maxLen = 420) {
  if (!text || text.length <= maxLen) return [text];
  const sentences = text.split(/([.?!;]\s+)/g);
  let result = [],
    buffer = "";
  for (let part of sentences) {
    if ((buffer + part).length > maxLen) {
      if (buffer) result.push(buffer);
      buffer = "";
    }
    buffer += part;
  }
  if (buffer) result.push(buffer);
  return result.map((s) => s.trim()).filter(Boolean);
}

// =========== [TRANSLATION PIPELINE] ===========
const TranslationPipeline = (() => {
  let TRANSLATIONS = {
    originalTexts: [],
    translatedTexts: [],
    sourceLang: "auto",
    targetLang: "id",
    mode: "paragraph",
  };
  let IS_TRANSLATING = false;
  let SHOULD_STOP = false;

  async function translateParagraphs(sourceLang, targetLang, callback) {
    if (sourceLang === "auto") {
    }

    const contentArea = DomUtils.getContentArea();

    // EXPANDED selectors to include nav, sidebar, and more content areas
    const importantElements = contentArea.querySelectorAll(`
      p, h1, h2, h3, h4, h5, h6, li, blockquote, caption, 
      nav li, nav p, nav span, nav div,
      .sidebar p, .sidebar li, .sidebar span, .sidebar div, .sidebar h1, .sidebar h2, .sidebar h3,
      .menu p, .menu li, .menu span, .menu div,
      .navigation p, .navigation li, .navigation span, .navigation div,
      .nav-item, .menu-item, .sidebar-item,
      aside p, aside li, aside span, aside div, aside h1, aside h2, aside h3,
      [class*="nav"] p, [class*="nav"] li, [class*="nav"] span, [class*="nav"] div,
      [class*="sidebar"] p, [class*="sidebar"] li, [class*="sidebar"] span, [class*="sidebar"] div,
      [class*="menu"] p, [class*="menu"] li, [class*="menu"] span, [class*="menu"] div,
      .doc-nav p, .doc-nav li, .doc-nav span, .doc-nav div,
      .toc p, .toc li, .toc span, .toc div,
      dt, dd, figcaption, summary
    `);

    let validParagraphs = Array.from(importantElements).filter((p) => {
      // Extract text only (without images/media) for validation
      const text = DomUtils.extractTextOnly(p);

      // Skip jika sudah ada translation di bawahnya
      const nextElement = p.nextElementSibling;
      if (
        nextElement &&
        nextElement.classList.contains("weblang-translation")
      ) {
        return false;
      }

      // Skip jika element sudah pernah diterjemahkan (full page mode)
      if (p.hasAttribute("data-weblang-translated")) {
        return false;
      }

      // More flexible: minimal 3 char, minimal 1 kata untuk nav/sidebar content
      return (
        text &&
        text.length >= 3 &&
        text.split(" ").length >= 1 &&
        DomUtils.isValidTextNode(p)
      );
    });

    if (validParagraphs.length === 0) {
      if (callback)
        callback({ success: true, message: "All content already translated" });
      return;
    }

    // Set translation state
    IS_TRANSLATING = true;
    SHOULD_STOP = false;

    TRANSLATIONS.originalTexts = [];
    TRANSLATIONS.translatedTexts = [];
    TRANSLATIONS.mode = "paragraph";
    TRANSLATIONS.sourceLang = sourceLang;
    TRANSLATIONS.targetLang = targetLang;

    let translatedCount = 0,
      totalCount = validParagraphs.length;

    // Proses paragraphs dengan stop functionality
    for (const paragraph of validParagraphs) {
      // Check if user clicked stop
      if (SHOULD_STOP) {
        IS_TRANSLATING = false;
        if (callback)
          callback({
            success: true,
            message: `Translation stopped. Translated ${translatedCount} of ${totalCount}`,
          });
        return;
      }

      // Extract only text content, skip images and media
      const text = DomUtils.extractTextOnly(paragraph);

      // Skip if no text content after removing media
      if (!text || text.length < 3) {
        continue;
      }

      // Determine actual source language for this paragraph
      let actualSourceLang = sourceLang;
      if (sourceLang === "auto") {
        actualSourceLang = Translator.detectLanguage(text);
      }

      // Ensure we have valid language codes
      if (actualSourceLang === "auto") actualSourceLang = "en"; // Fallback

      // Skip jika bahasa sumber dan target sama
      if (actualSourceLang === targetLang) {
        console.log(
          `⏭️ Skipping same language: ${actualSourceLang} → ${targetLang} for "${text.substring(
            0,
            30
          )}..."`
        );
        continue;
      }

      const parts = splitTextSmart(text);
      let translations = [];

      for (const part of parts) {
        let translated = await Translator.request(
          part,
          actualSourceLang,
          targetLang
        );

        // Retry otomatis jika gagal (tanpa perlu tombol retry terpisah)
        if (!translated || translated === part) {
          console.log(
            `Auto retry for: "${part.substring(
              0,
              20
            )}..." (${actualSourceLang}→${targetLang})`
          );
          await new Promise((r) => setTimeout(r, 500));
          translated = await Translator.request(
            part,
            actualSourceLang,
            targetLang,
            1
          );
        }

        // Retry kedua jika masih gagal
        if (!translated || translated === part) {
          console.log(
            `Second retry for: "${part.substring(
              0,
              20
            )}..." (${actualSourceLang}→${targetLang})`
          );
          await new Promise((r) => setTimeout(r, 800));
          translated = await Translator.request(
            part,
            actualSourceLang,
            targetLang,
            2
          );
        }

        translations.push(translated || part);
      }

      const translation = translations.join(" ");
      if (
        translation &&
        translation !== text &&
        !translation.includes("failed")
      ) {
        await UI.injectTranslationAfter(paragraph, translation);
        TRANSLATIONS.originalTexts.push(text);
        TRANSLATIONS.translatedTexts.push(translation);
        translatedCount++;
        console.log(
          `[${translatedCount}/${totalCount}] Translated: "${text.substring(
            0,
            30
          )}..." → "${translation.substring(0, 30)}..."`
        );
      } else {
        console.log(
          `Failed to translate after 3 attempts: "${text.substring(
            0,
            30
          )}..."`
        );
      }

      await new Promise((r) => setTimeout(r, 150)); // avoid spam
    }

    // Reset translation state
    IS_TRANSLATING = false;
    SHOULD_STOP = false;

    console.log(
      `Translation complete: ${translatedCount}/${totalCount} paragraphs translated`
    );
    if (callback)
      callback({
        success: true,
        message: `Translated ${translatedCount} of ${totalCount} paragraphs`,
      });
  }

  async function translateFullPage(sourceLang, targetLang, callback) {
    console.log("WebLang: Start full page translation...");

    // Handle "auto" source language properly
    if (sourceLang === "auto") {
      console.log(
        "Auto-detection mode: will detect language for each text node"
      );
    }

    const contentArea = DomUtils.getContentArea();
    const walker = document.createTreeWalker(
      contentArea,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (!node.nodeValue || !node.nodeValue.trim())
            return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (
            !parent ||
            parent.closest(
              "script, style, noscript, code, pre, .weblang-translation, .prettyprint, .linenums, .prettyprinted, .highlight, .code-block, .language-, [class*='lang-'], [class*='language-']"
            )
          )
            return NodeFilter.FILTER_REJECT;
          if (parent.tagName === "A" || parent.closest("a"))
            return NodeFilter.FILTER_REJECT;

          // Skip jika sudah diterjemahkan sebelumnya
          if (parent.hasAttribute("data-weblang-translated")) {
            return NodeFilter.FILTER_REJECT;
          }

          if (node.nodeValue.trim().length < 3) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    let textNodes = [],
      node;
    while ((node = walker.nextNode())) textNodes.push(node);

    if (!textNodes.length) {
      console.log(
        "All text nodes already translated or no valid content found"
      );
      if (callback)
        callback({ success: true, message: "All content already translated" });
      return;
    }

    // Set translation state
    IS_TRANSLATING = true;
    SHOULD_STOP = false;

    TRANSLATIONS.originalTexts = [];
    TRANSLATIONS.translatedTexts = [];
    TRANSLATIONS.mode = "fullpage";
    TRANSLATIONS.sourceLang = sourceLang;
    TRANSLATIONS.targetLang = targetLang;

    let translatedCount = 0;
    console.log(
      `Found ${textNodes.length} untranslated text nodes to process`
    );

    for (const node of textNodes) {
      if (SHOULD_STOP) {
        console.log("Translation stopped by user");
        IS_TRANSLATING = false;
        if (callback)
          callback({
            success: true,
            message: `Translation stopped. Translated ${translatedCount} of ${textNodes.length}`,
          });
        return;
      }

      const text = node.nodeValue.trim();

      // Determine actual source language for this text node
      let actualSourceLang = sourceLang;
      if (sourceLang === "auto") {
        actualSourceLang = Translator.detectLanguage(text);
        console.log(
          `Detected language for "${text.substring(
            0,
            20
          )}...": ${actualSourceLang}`
        );
      }

      // Ensure we have valid language codes
      if (actualSourceLang === "auto") actualSourceLang = "en"; // Fallback

      // Skip jika bahasa sumber dan target sama
      if (actualSourceLang === targetLang) {
        console.log(
          `Skipping same language: ${actualSourceLang} → ${targetLang} for "${text.substring(
            0,
            30
          )}..."`
        );
        continue;
      }

      const parts = splitTextSmart(text);
      let translations = [];

      for (const part of parts) {
        // Use actualSourceLang instead of sourceLang to avoid "auto" in API call
        let translated = await Translator.request(
          part,
          actualSourceLang,
          targetLang
        );

        // Retry otomatis jika gagal (tanpa perlu tombol retry terpisah)
        if (!translated || translated === part) {
          console.log(
            `Auto retry for text node: "${part.substring(0, 20)}..."`
          );
          await new Promise((r) => setTimeout(r, 500));
          translated = await Translator.request(
            part,
            actualSourceLang,
            targetLang,
            1
          );
        }

        // Retry kedua jika masih gagal
        if (!translated || translated === part) {
          console.log(
            `Second retry for text node: "${part.substring(0, 20)}..."`
          );
          await new Promise((r) => setTimeout(r, 800));
          translated = await Translator.request(
            part,
            actualSourceLang,
            targetLang,
            2
          );
        }

        translations.push(translated || part);
      }

      const translation = translations.join(" ");
      if (
        translation &&
        translation !== text &&
        !translation.includes("failed")
      ) {
        node.nodeValue = translation;
        TRANSLATIONS.originalTexts.push(text);
        TRANSLATIONS.translatedTexts.push(translation);
        translatedCount++;
        DomUtils.markTranslated(node.parentElement, text);
        console.log(
          `[${translatedCount}/${
            textNodes.length
          }] Text node translated: "${text.substring(
            0,
            30
          )}..." → "${translation.substring(0, 30)}..."`
        );
      } else {
        console.log(
          `Failed to translate text node after 3 attempts: "${text.substring(
            0,
            30
          )}..."`
        );
      }

      await new Promise((r) => setTimeout(r, 100)); // avoid spam
    }

    // Reset translation state
    IS_TRANSLATING = false;
    SHOULD_STOP = false;

    console.log(
      `Full page translation complete: ${translatedCount}/${textNodes.length} text nodes translated`
    );
    if (callback)
      callback({
        success: true,
        message: `Translated ${translatedCount} of ${textNodes.length} text nodes`,
      });
  }

  return {
    translateParagraphs,
    translateFullPage,
    getTranslations: () => TRANSLATIONS,
    isTranslating: () => IS_TRANSLATING,
    stopTranslation: () => {
      SHOULD_STOP = true;
    },
    clearTranslations: () => {
      TRANSLATIONS.originalTexts = [];
      TRANSLATIONS.translatedTexts = [];
      TRANSLATIONS.mode = "";
      TRANSLATIONS.sourceLang = "";
      TRANSLATIONS.targetLang = "";
      IS_TRANSLATING = false;
      SHOULD_STOP = false;
    },
  };
})();

// =================== [MAIN HANDLER] =====================

// Quick translate on text select
document.addEventListener("mouseup", function (e) {
  let selected = window.getSelection().toString().trim();
  if (selected.length > 0) {
    UI.showTranslateBtn(e.clientX, e.clientY, selected, async () => {
      chrome.storage.sync.get(["sourceLang", "targetLang"], async (data) => {
        let sourceLang = data.sourceLang || "auto";
        let targetLang = data.targetLang || "id";

        // Handle auto detection properly
        if (sourceLang === "auto") {
          const detectedLang = Translator.detectLanguage(selected);
          console.log(
            `Auto-detected language: ${detectedLang} for text: "${selected.substring(
              0,
              30
            )}..."`
          );
          sourceLang = detectedLang;
        }

        console.log(`Translation settings: ${sourceLang} → ${targetLang}`);

        // Ensure we have valid language codes (not "auto")
        if (sourceLang === "auto") {
          console.log("Fallback: sourceLang was still 'auto', setting to 'en'");
          sourceLang = "en";
        }
        if (targetLang === "auto") {
          console.log("Fallback: targetLang was 'auto', setting to 'id'");
          targetLang = "id";
        }

        // Skip jika bahasa sama untuk hindari error
        if (sourceLang === targetLang) {
          // Auto switch target language based on source
          if (sourceLang === "id") targetLang = "en";
          else if (sourceLang === "en") {
            // If target was originally Arabic, keep it Arabic
            const originalTarget = data.targetLang || "id";
            if (originalTarget === "ar") targetLang = "ar";
            else targetLang = "id";
          }
          else if (sourceLang === "ar") targetLang = "en";
          else if (sourceLang === "ja") targetLang = "en";
          else if (sourceLang === "zh") targetLang = "en";
          else if (sourceLang === "fr") targetLang = "en";
          else if (sourceLang === "de") targetLang = "en";
          else if (sourceLang === "es") targetLang = "en";
          else if (sourceLang === "ru") targetLang = "en";
          else targetLang = "en"; // Default

          console.log(
            `Same language detected, switching target: ${sourceLang} → ${targetLang}`
          );
        }

        UI.showPopup(e.clientX, e.clientY, "Translating...", false);
        console.log(
          `Translation request: "${selected.substring(
            0,
            30
          )}..." from ${sourceLang} to ${targetLang}`
        );

        // Retry otomatis untuk highlight translate juga
        let translation = await Translator.request(
          selected,
          sourceLang,
          targetLang
        );

        if (!translation || translation === selected) {
          console.log("Auto retry for highlight translate");
          await new Promise((r) => setTimeout(r, 500));
          translation = await Translator.request(
            selected,
            sourceLang,
            targetLang,
            1
          );
        }

        if (!translation || translation === selected) {
          console.log("Second retry for highlight translate");
          await new Promise((r) => setTimeout(r, 800));
          translation = await Translator.request(
            selected,
            sourceLang,
            targetLang,
            2
          );
        }

        if (translation && translation !== selected) {
          UI.showPopup(e.clientX, e.clientY, translation, false);
        } else {
          UI.showPopup(
            e.clientX,
            e.clientY,
            "Translation failed after 3 attempts",
            true
          );
        }
      });
    });
  }
});

// Message listeners
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "TRANSLATE_PAGE") {
    if (msg.mode === "paragraph") {
      TranslationPipeline.translateParagraphs(
        msg.sourceLang || "auto",
        msg.targetLang,
        sendResponse
      );
    } else if (msg.mode === "fullpage") {
      TranslationPipeline.translateFullPage(
        msg.sourceLang || "auto",
        msg.targetLang,
        sendResponse
      );
    }
    return true;
  }
  if (msg.type === "STOP_TRANSLATION") {
    TranslationPipeline.stopTranslation();
    sendResponse({ success: true, message: "Translation stopped" });
    return true;
  }
  if (msg.type === "GET_TRANSLATION_STATUS") {
    sendResponse({
      success: true,
      isTranslating: TranslationPipeline.isTranslating(),
      data: TranslationPipeline.getTranslations(),
    });
    return true;
  }
  if (msg.type === "RESTORE_ORIGINAL") {
    restoreOriginalText();
    sendResponse({ success: true });
    return true;
  }
  if (msg.type === "GET_TRANSLATION_DATA") {
    sendResponse({
      success: true,
      data: TranslationPipeline.getTranslations(),
    });
    return true;
  }
  if (msg.type === "RETRY_FAILED_TRANSLATIONS") {
    retryFailedTranslations();
    sendResponse({ success: true });
    return true;
  }
  if (msg.type === "CLEANUP_DUPLICATES") {
    cleanupDuplicateTranslations();
    sendResponse({ success: true });
    return true;
  }
  
  // AI Features
  if (msg.type === "AI_SUMMARIZE") {
    const text = extractPageText();
    if (!text) {
      sendResponse({ error: "No text content found on this page" });
      return true;
    }
    
    chrome.runtime.sendMessage(
      { type: "AI_SUMMARIZE", text: text },
      (response) => {
        if (response && response.success) {
          sendResponse({ summary: response.result });
        } else {
          sendResponse({ error: response?.error || "Summarization failed" });
        }
      }
    );
    return true;
  }
  
  if (msg.type === "ANALYZE_PAGE") {
    const text = extractPageText();
    if (!text) {
      sendResponse({ error: "No text content found on this page" });
      return true;
    }
    
    chrome.runtime.sendMessage(
      { type: "AI_ANALYZE", text: text },
      (response) => {
        if (response && response.success) {
          sendResponse({ analysis: response.result });
        } else {
          sendResponse({ error: response?.error || "Analysis failed" });
        }
      }
    );
    return true;
  }
  
  if (msg.type === "EXTRACT_KEYWORDS") {
    const text = extractPageText();
    if (!text) {
      sendResponse({ error: "No text content found on this page" });
      return true;
    }
    
    chrome.runtime.sendMessage(
      { type: "AI_KEYWORDS", text: text },
      (response) => {
        if (response && response.success) {
          sendResponse({ keywords: response.result });
        } else {
          sendResponse({ error: response?.error || "Keyword extraction failed" });
        }
      }
    );
    return true;
  }
});

// =============== [AI HELPER FUNCTIONS] ===============
function extractPageText() {
  const contentArea = DomUtils.getContentArea();
  const paragraphs = DomUtils.getParagraphs(contentArea);
  
  let text = "";
  paragraphs.forEach(p => {
    const pText = p.innerText.trim();
    if (pText && pText.length > 10) {
      text += pText + "\n\n";
    }
  });
  
  // If no paragraphs found, get all text from content area
  if (!text.trim()) {
    text = contentArea.innerText.trim();
  }
  
  // Limit text length for AI processing (max ~3000 chars)
  if (text.length > 3000) {
    text = text.substring(0, 2800) + "...";
  }
  
  return text;
}

// =============== [UTILITY FUNGSI TAMBAHAN] ===============

// Retry is now built-in to translate functions - just press translate again for retry
function retryFailedTranslations() {
  console.log(
    "Retry is now automatic! Just press the Translate button again."
  );
  console.log(
    "The extension will automatically retry failed translations and skip already translated content."
  );
}

// Cleanup duplicate translations
function cleanupDuplicateTranslations() {
  const allTranslations = document.querySelectorAll(".weblang-translation");
  let duplicatesRemoved = 0;
  allTranslations.forEach((translation, index) => {
    const nextTranslations = Array.from(allTranslations).slice(index + 1);
    const duplicates = nextTranslations.filter(
      (nextTrans) =>
        nextTrans.textContent.trim() === translation.textContent.trim()
    );
    duplicates.forEach((dup) => {
      dup.remove();
      duplicatesRemoved++;
    });
  });
  // Also check for multiple translations after same element
  const allElements = document.querySelectorAll(
    "p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th, caption"
  );
  allElements.forEach((element) => {
    let nextSibling = element.nextElementSibling,
      translationCount = 0;
    while (
      nextSibling &&
      nextSibling.classList.contains("weblang-translation")
    ) {
      if (translationCount > 0) {
        nextSibling.remove();
        duplicatesRemoved++;
      }
      translationCount++;
      nextSibling = nextSibling.nextElementSibling;
    }
  });
}

// Restore original text
function restoreOriginalText() {
  const contentArea = DomUtils.getContentArea();
  const translatedElements = contentArea.querySelectorAll(
    "[data-weblang-original]"
  );
  const injectedTranslations = contentArea.querySelectorAll(
    ".weblang-translation"
  );
  Array.from(translatedElements).forEach((element) => {
    const originalText = element.getAttribute("data-weblang-original");
    if (originalText) {
      element.innerText = originalText;
      element.removeAttribute("data-weblang-original");
      element.removeAttribute("data-weblang-translated");
    }
  });
  Array.from(injectedTranslations).forEach((element) => {
    element.remove();
  });
  TranslationPipeline.clearTranslations();
}