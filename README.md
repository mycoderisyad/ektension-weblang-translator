# WebLang Translator - Chrome Extension

Professional multi-language translation and AI analysis for web pages.

## Features

- **Multi-language Support**: 60+ languages with auto-detection
- **Translation Modes**: Paragraph (inline) or Full Page (replace text)
- **AI Analysis**: Text summarization, sentiment analysis, keyword extraction
- **Smart Content Detection**: Translates text while preserving code blocks and images
- **Export Options**: PDF and TXT export for translations and AI results
- **Multiple Translation APIs**: Google Translate, Azure, MyMemory, LibreTranslate
- **Highlight Translation**: Select any text for instant translation
- **Free Mode**: Works without API keys using free translation services

## Installation

1. Download or clone this repository
2. Open Chrome Extensions page (chrome://extensions/)
3. Enable Developer mode
4. Click "Load unpacked" and select the extension folder
5. Extension is ready to use

## Usage

### Basic Translation
1. Click the extension icon to open settings
2. Select source language (Auto-detect recommended) 
3. Select target language
4. Choose translation mode (Paragraph or Full Page)
5. Click "Translate" to translate the current page

### Highlight Translation
- Select any text on a webpage
- Translation popup appears automatically
- Works with auto-detection for any language pair

### AI Features (Requires Gemini API Key)
- **Summarize**: Generate page summary
- **Analyze**: Sentiment and readability analysis  
- **Keywords**: Extract key terms from content
- Get API key from Google AI Studio

## Supported Languages

Arabic, Chinese, Danish, Dutch, English, French, German, Hindi, Indonesian, Italian, Japanese, Korean, Malay, Norwegian, Portuguese, Russian, Spanish, Swedish, Thai, Vietnamese, and more.

## Configuration

### Free Mode (Default)
No setup required - extension works immediately with free translation services.

### Premium Mode (Optional)
Configure API keys in extension settings for enhanced features:

- **Google Translate API**: Better accuracy and higher limits
- **Azure Translator**: Enterprise-grade translation
- **Gemini AI**: Required for summarization and analysis features

Get API keys from respective service providers and enter in extension settings.

## Export Options

- **Translation Export**: Save original and translated text as PDF or TXT
- **AI Results Export**: Export summaries, analysis, and keywords
- **Bilingual Format**: Original and translation side-by-side
- **Translation Only**: Translated text without original

## Technical Details

- Manifest V3 Chrome extension
- Content script injection for page translation
- Background service worker for API communication
- Local storage for settings and API keys
- No data collection or tracking
- Works on all websites with proper permissions

## Privacy

- All translations processed through selected APIs only
- API keys stored locally in browser
- No user data collected or transmitted to extension servers
- Translation history not stored permanently