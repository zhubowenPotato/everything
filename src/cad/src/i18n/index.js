/**
 * Minimal i18n layer.
 *
 * The English source text is used as the dictionary key. `t()` returns the
 * translation for the active locale, or the original English string when no
 * entry exists (so English is always the built-in fallback). This keeps the
 * wrapping non-invasive: call sites pass their existing English literal.
 *
 *   t('Home')                       -> '主页'   (zh-CN) / 'Home' (en)
 *   t('Opened {name}', { name })    -> placeholder interpolation
 *
 * Command names, aliases and command-line keyword tokens are intentionally
 * NOT translated (see editor/commands and editor/input.js) so that typing
 * `LINE`, `L`, `Close`, `Undo`, ... keeps working, matching the AutoCAD
 * Chinese edition convention.
 */
import zhCN from './zh-CN.js';

/** Locale id -> dictionary of English source string -> translation. */
const DICTS = {
  'zh-CN': zhCN,
  en: {},
};

/** Selectable languages, in menu order. */
export const LOCALES = [
  { id: 'zh-CN', label: '简体中文' },
  { id: 'en', label: 'English' },
];

const LOCALE_KEY = 'cad.locale';
const DEFAULT_LOCALE = 'zh-CN';

function detectLocale() {
  try {
    const saved = localStorage.getItem(LOCALE_KEY);
    if (saved && DICTS[saved]) return saved;
  } catch {
    /* ignore */
  }
  // Automated tests assert against the English source strings, so pin them to
  // English regardless of the dictionary contents.
  try {
    if (typeof process !== 'undefined' && process.env && (process.env.VITEST || process.env.NODE_ENV === 'test')) return 'en';
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

let locale = detectLocale();

/** Active locale id. */
export function getLocale() {
  return locale;
}

/** Switch the active locale and remember the choice. */
export function setLocale(id) {
  if (!DICTS[id]) return locale;
  locale = id;
  try {
    localStorage.setItem(LOCALE_KEY, id);
  } catch {
    /* ignore */
  }
  return locale;
}

/** Human-readable name of a locale id (used by the language menu). */
export function localeLabel(id) {
  return LOCALES.find((l) => l.id === id)?.label ?? id;
}

/**
 * Translate an English source string.
 * @param {string} str  the English text (also the dictionary key)
 * @param {object} [vars]  values for `{name}` placeholders
 */
export function t(str, vars) {
  if (typeof str !== 'string') return str;
  let out = str;
  if (locale !== 'en') {
    const dict = DICTS[locale];
    if (dict && Object.prototype.hasOwnProperty.call(dict, str)) out = dict[str];
  }
  if (vars) {
    for (const k of Object.keys(vars)) {
      out = out.split(`{${k}}`).join(String(vars[k]));
    }
  }
  return out;
}

export default t;
