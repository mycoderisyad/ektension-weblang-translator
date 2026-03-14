export const LANGUAGES = [
  { code: 'id', name: 'Indonesian' },
  { code: 'en', name: 'English' },
  { code: 'ms', name: 'Malay' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese (Simplified)' },
  { code: 'zh-TW', name: 'Chinese (Traditional)' },
  { code: 'ar', name: 'Arabic' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'ru', name: 'Russian' },
  { code: 'ko', name: 'Korean' },
  { code: 'th', name: 'Thai' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'hi', name: 'Hindi' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'it', name: 'Italian' },
  { code: 'nl', name: 'Dutch' },
  { code: 'sv', name: 'Swedish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'da', name: 'Danish' },
  { code: 'fi', name: 'Finnish' },
  { code: 'pl', name: 'Polish' },
  { code: 'tr', name: 'Turkish' },
  { code: 'he', name: 'Hebrew' },
  { code: 'cs', name: 'Czech' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'ro', name: 'Romanian' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'hr', name: 'Croatian' },
  { code: 'sk', name: 'Slovak' },
  { code: 'sl', name: 'Slovenian' },
  { code: 'et', name: 'Estonian' },
  { code: 'lv', name: 'Latvian' },
  { code: 'lt', name: 'Lithuanian' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'be', name: 'Belarusian' },
  { code: 'is', name: 'Icelandic' },
  { code: 'ga', name: 'Irish' },
  { code: 'mt', name: 'Maltese' },
  { code: 'cy', name: 'Welsh' },
  { code: 'eu', name: 'Basque' },
  { code: 'ca', name: 'Catalan' },
  { code: 'gl', name: 'Galician' },
  { code: 'af', name: 'Afrikaans' },
  { code: 'sw', name: 'Swahili' },
  { code: 'am', name: 'Amharic' },
  { code: 'bn', name: 'Bengali' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'mr', name: 'Marathi' },
  { code: 'ne', name: 'Nepali' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'si', name: 'Sinhala' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'ur', name: 'Urdu' },
  { code: 'fa', name: 'Persian' },
  { code: 'ps', name: 'Pashto' },
  { code: 'sd', name: 'Sindhi' },
  { code: 'ky', name: 'Kyrgyz' },
  { code: 'kk', name: 'Kazakh' },
  { code: 'uz', name: 'Uzbek' },
  { code: 'tg', name: 'Tajik' },
  { code: 'mn', name: 'Mongolian' },
  { code: 'my', name: 'Myanmar' },
  { code: 'km', name: 'Khmer' },
  { code: 'lo', name: 'Lao' },
  { code: 'ka', name: 'Georgian' },
  { code: 'hy', name: 'Armenian' },
  { code: 'az', name: 'Azerbaijani' },
];

/**
 * Populates a <select> element with language options.
 * @param {string} selectId - The ID of the <select> element.
 * @param {boolean} [includeAuto=false] - Whether to prepend an "Auto Detect" option.
 */
export function populateLanguageSelect(selectId, includeAuto = false) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const fragment = document.createDocumentFragment();

  if (includeAuto) {
    const autoOption = document.createElement('option');
    autoOption.value = 'auto';
    autoOption.textContent = 'Auto Detect';
    fragment.appendChild(autoOption);
  }

  for (const lang of LANGUAGES) {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = lang.name;
    fragment.appendChild(option);
  }

  select.appendChild(fragment);
}
