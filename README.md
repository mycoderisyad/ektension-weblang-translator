WebLang Translator (Chrome Extension)

WebLang Translator is a Chrome extension for fast, accurate web page translation with advanced features and a modular architecture.

Features
- Translate selected text, paragraphs, or full pages with layout-safe injection
- Quick-translate popup on text highlight
- Multiple translation providers: Google, Azure, Libre, MyMemory (free and paid modes)
- AI-powered analysis, summary, and keyword extraction with export to TXT/PDF
- Caching, batching, and adaptive retries for reliability
- Customizable options: API keys, default languages, highlight color

Installation (Development)
1. Clone this repository
2. Run `npm install`
3. Run `npm run build`
4. Open Chrome extensions (chrome://extensions), enable Developer mode, and load the `build` folder

Usage
- Use the popup to select translation mode and target language
- Highlight text to trigger the quick-translate popup
- Configure settings in the Options page
- Export results directly from the popup

Project Structure
- `src/background/`: translation providers, AI, export logic, API logging
- `src/content/`: content runtime, translation engine, quick translate, UI
- `src/popup/`: modular popup controllers (`translate`, `ai`, `export`, `settings`)
- `src/options/`: modular options controllers and form helpers
- `src/styles/`: modular CSS for popup, options, and content AI popup
- `build/`: compiled output for Chrome extension

Notes
- Free mode available without API keys (limits and accuracy depend on provider)
- For best results, set your own Google or Azure API key in Options