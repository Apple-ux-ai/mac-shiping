import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { useLanguageStore } from '../stores/useLanguageStore';

const I18nContext = createContext(null);

const ATTR_NAMES = ['placeholder', 'title', 'aria-label'];

const LANGUAGE_NAMES = {
  ar: 'Arabic',
  bn: 'Bengali',
  de: 'German',
  en: 'English',
  es: 'Spanish',
  fa: 'Farsi',
  fr: 'French',
  he: 'Hebrew',
  hi: 'Hindi',
  id: 'Indonesian',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  ms: 'Malay',
  nl: 'Dutch',
  pl: 'Polish',
  pt: 'Portuguese',
  pt_BR: 'Brazilian Portuguese',
  ru: 'Russian',
  sw: 'Swahili',
  ta: 'Tamil',
  th: 'Thai',
  tl: 'Tagalog',
  tr: 'Turkish',
  uk: 'Ukrainian',
  ur: 'Urdu',
  vi: 'Vietnamese',
  zh_CN: '中文',
  zh_TW: '繁體中文',
};

const normalizeLanguageCode = (code) => {
  if (!code || typeof code !== 'string') {
    return '';
  }
  return code.replace('-', '_').trim();
};

const localeModules = import.meta.glob('../../../locales/*.json', { eager: true });

const flattenLocale = (obj, prefix = '', acc = {}) => {
  Object.entries(obj || {}).forEach(([key, value]) => {
    const cleanKey = key || '';
    const cleanPrefix = prefix || '';
    const pathKey = [cleanPrefix, cleanKey].filter(Boolean).join('.');

    if (typeof value === 'string') {
      if (pathKey) {
        acc[pathKey] = value;
      }
      return;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenLocale(value, pathKey, acc);
    }
  });
  return acc;
};

const extractLanguageCode = (modulePath) => {
  const match = modulePath.match(/([^/\\]+)\.json$/i);
  if (!match) {
    return '';
  }
  return normalizeLanguageCode(match[1]);
};

const localeMapByLanguage = Object.entries(localeModules).reduce((acc, [modulePath, mod]) => {
  const code = extractLanguageCode(modulePath);
  if (!code) {
    return acc;
  }
  const localeRaw = mod && typeof mod === 'object' && 'default' in mod ? mod.default : mod;
  acc[code] = flattenLocale(localeRaw || {});
  return acc;
}, {});

const fallbackLanguage = localeMapByLanguage.zh_CN ? 'zh_CN' : (Object.keys(localeMapByLanguage)[0] || 'zh_CN');
const zhLocale = localeMapByLanguage[fallbackLanguage] || {};

const languageOptions = Object.keys(localeMapByLanguage)
  .sort((a, b) => {
    if (a === 'zh_CN') return -1;
    if (b === 'zh_CN') return 1;
    if (a === 'en') return -1;
    if (b === 'en') return 1;
    return a.localeCompare(b);
  })
  .map((code) => ({
    code,
    label: LANGUAGE_NAMES[code] || code,
  }));

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeSource = (source) => {
  if (typeof source !== 'string') {
    return source;
  }
  return source.replace(/\s+/g, ' ').trim();
};

const applyParams = (template, params) => {
  if (typeof template !== 'string' || !params || typeof params !== 'object') {
    return template;
  }

  return template.replace(/\{\{\s*([^{}]+)\s*\}\}/g, (match, key) => {
    const value = params[key.trim()];
    return value === undefined || value === null ? match : String(value);
  });
};

const buildTemplateMatchers = () => {
  return Object.keys(zhLocale)
    .filter((key) => key.includes('{{'))
    .map((key) => {
      const placeholders = [];
      const regexBody = key.replace(/\{\{\s*([^{}]+)\s*\}\}/g, (match, name) => {
        placeholders.push(name.trim());
        return '([\\s\\S]*?)';
      });

      const escaped = escapeRegExp(regexBody).replace(/\(\[\\s\\S\]\*\?\)/g, '([\\s\\S]*?)');
      return {
        key,
        regex: new RegExp(`^${escaped}$`),
        placeholders,
      };
    });
};

const templateMatchers = buildTemplateMatchers();

const getTranslatedText = (source, activeLocale, params) => {
  if (typeof source !== 'string') {
    return source;
  }

  const withParams = (template) => applyParams(template, params);

  const exact = activeLocale[source];
  if (typeof exact === 'string') {
    return withParams(exact);
  }

  const trimmed = source.trim();
  if (trimmed !== source) {
    const trimmedMatch = activeLocale[trimmed];
    if (typeof trimmedMatch === 'string') {
      const leading = source.match(/^\s*/)?.[0] || '';
      const trailing = source.match(/\s*$/)?.[0] || '';
      return `${leading}${withParams(trimmedMatch)}${trailing}`;
    }
  }

  const normalized = normalizeSource(source);
  if (normalized && normalized !== source) {
    const normalizedMatch = activeLocale[normalized];
    if (typeof normalizedMatch === 'string') {
      return withParams(normalizedMatch);
    }
  }

  for (const matcher of templateMatchers) {
    const match = source.match(matcher.regex);
    if (!match) {
      continue;
    }

    const sourceTemplate = matcher.key;
    const translatedTemplate = activeLocale[sourceTemplate];
    if (typeof translatedTemplate !== 'string') {
      continue;
    }

    const extracted = { ...(params || {}) };
    matcher.placeholders.forEach((name, index) => {
      extracted[name] = match[index + 1];
    });
    return applyParams(translatedTemplate, extracted);
  }

  return source;
};

export const I18nProvider = ({ children }) => {
  const { language, setLanguage } = useLanguageStore();
  const textNodeOriginal = useRef(new WeakMap());
  const attrOriginal = useRef(new WeakMap());
  const normalizedLanguage = normalizeLanguageCode(language);

  useEffect(() => {
    if (localeMapByLanguage[normalizedLanguage]) {
      return;
    }
    setLanguage(fallbackLanguage);
  }, [normalizedLanguage, setLanguage]);

  const activeLocale = useMemo(() => {
    return localeMapByLanguage[normalizedLanguage] || localeMapByLanguage[fallbackLanguage] || zhLocale;
  }, [normalizedLanguage]);

  const t = useMemo(() => {
    return (source, params) => getTranslatedText(source, activeLocale, params);
  }, [activeLocale]);

  useEffect(() => {
    const translateTextNode = (node) => {
      if (!node || typeof node.nodeValue !== 'string') {
        return;
      }
      const current = node.nodeValue;
      if (!current || !current.trim()) {
        return;
      }
      const original = textNodeOriginal.current.get(node) || current;
      if (!textNodeOriginal.current.has(node)) {
        textNodeOriginal.current.set(node, original);
      }
      const translated = getTranslatedText(original, activeLocale);
      if (translated !== current) {
        node.nodeValue = translated;
      }
    };

    const translateElementAttrs = (element) => {
      if (!(element instanceof Element)) {
        return;
      }
      let originalMap = attrOriginal.current.get(element);
      if (!originalMap) {
        originalMap = {};
        attrOriginal.current.set(element, originalMap);
      }

      ATTR_NAMES.forEach((attrName) => {
        const current = element.getAttribute(attrName);
        if (typeof current !== 'string' || !current.trim()) {
          return;
        }
        if (!(attrName in originalMap)) {
          originalMap[attrName] = current;
        }
        const translated = getTranslatedText(originalMap[attrName], activeLocale);
        if (translated !== current) {
          element.setAttribute(attrName, translated);
        }
      });
    };

    const translateSubtree = (root) => {
      if (!root) {
        return;
      }

      if (root.nodeType === Node.TEXT_NODE) {
        translateTextNode(root);
        return;
      }

      if (!(root instanceof Element) && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
        return;
      }

      if (root instanceof Element) {
        translateElementAttrs(root);
      }

      const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (textWalker.nextNode()) {
        translateTextNode(textWalker.currentNode);
      }

      if (root instanceof Element) {
        root.querySelectorAll('*').forEach((element) => {
          translateElementAttrs(element);
        });
      }
    };

    translateSubtree(document.body);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData') {
          translateTextNode(mutation.target);
          return;
        }

        if (mutation.type === 'attributes' && mutation.target instanceof Element) {
          translateElementAttrs(mutation.target);
          return;
        }

        mutation.addedNodes.forEach((node) => {
          translateSubtree(node);
        });
      });
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTR_NAMES,
    });

    return () => {
      observer.disconnect();
    };
  }, [activeLocale]);

  const value = useMemo(() => {
    return {
      language: normalizedLanguage || fallbackLanguage,
      setLanguage,
      availableLanguages: languageOptions,
      t,
    };
  }, [normalizedLanguage, setLanguage, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return context;
};
