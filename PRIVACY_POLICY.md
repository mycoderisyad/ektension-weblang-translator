# Privacy Policy for WebLang Translator

**Last Updated:** March 13, 2026

## Overview

WebLang Translator is a browser extension that translates web page text into the user's preferred language. This privacy policy explains how the extension handles user data.

## Data Collection

WebLang Translator does **not** collect, store, or transmit any personally identifiable information (PII). The extension operates locally on your device and does not have any server-side data storage.

## Data Usage

### What We Store Locally

The extension uses Chrome's `storage` API to save the following data **locally on your device only**:

- Your preferred target language
- Selected translation service (Google Translate, DeepL, etc.)
- UI preferences (font size, theme, etc.)
- Cached translations for performance improvement

This data never leaves your device and is not accessible to us or any third party.

### What We Send Externally

When you request a translation, the **text to be translated** is sent to the selected third-party translation API (e.g., Google Translate, DeepL, or LibreTranslate). This is necessary to perform the translation. No other data is sent alongside the text.

We do not control how these third-party services handle the data they receive. Please refer to their respective privacy policies:

- [Google Translate Privacy Policy](https://policies.google.com/privacy)
- [DeepL Privacy Policy](https://www.deepl.com/privacy)
- [LibreTranslate Privacy Policy](https://libretranslate.com/)

## Permissions Used

| Permission | Purpose |
|---|---|
| `storage` | Save user preferences locally |
| `activeTab` | Access the current tab for translation |
| `scripting` | Inject translation functionality into web pages |
| `downloads` | Allow users to export translation results |
| `sidePanel` | Display the translator UI in Chrome's side panel |
| Host permissions | Enable translation on any website the user visits |

## Data Sharing

We do **not** sell, transfer, or share any user data with third parties, except for the text sent to translation APIs as described above.

## Data Security

All user preferences are stored locally using Chrome's built-in storage API, which is sandboxed and protected by the browser's security model.

## Changes to This Policy

We may update this privacy policy from time to time. Any changes will be reflected in the "Last Updated" date at the top of this document.

## Contact

If you have any questions or concerns about this privacy policy, please open an issue on the [GitHub repository](https://github.com/mycoderisyad/ektension-weblang-translator/issues).
