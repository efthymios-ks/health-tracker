/**
 * localization.js — standalone i18n framework
 *
 * HTML usage:
 *   <span data-localization-key="nav.dashboard">Dashboard</span>
 *   <input data-localization-key="search.placeholder" data-localization-property="placeholder">
 *
 * JS usage:
 *   await window.localization.init();               // call once on page load
 *   await window.localization.setLanguage('el');    // switch language
 *   window.localization.t('nav.dashboard')          // → translated string or null
 *   window.localization.t('nav.dashboard', 'Dashboard') // → translated string or fallback
 *
 * Event:
 *   window.addEventListener('languagechange', e => console.log(e.detail.language))
 *
 * File convention:
 *   localization.json          → base/English (always loaded)
 *   localization.{language}.json   → overrides for that language (merged over base)
 */
(function () {
  "use strict";

  const STORAGE_KEY = "app_lang";
  const DEFAULT_LANGUAGE = "en";
  const BASE_URL = "localization.json";

  let _currentLanguage = DEFAULT_LANGUAGE;
  let _baseTranslations = {};        // localization.json — always loaded, used as fallback
  let _overrideTranslations = {};   // localization.{language}.json — merged over base
  let _observer = null;
  let _isBaseLoaded = false;

  // ── Translation lookup ─────────────────────────────────────────────────────

  function t(key, fallback = null) {
    if (key in _overrideTranslations) { return _overrideTranslations[key]; }
    if (key in _baseTranslations) {
      if (_isBaseLoaded && _currentLanguage !== DEFAULT_LANGUAGE) {
        // Key exists in base but not in the override — untranslated for this language
        console.warn(`[localization] Untranslated key "${key}" for language "${_currentLanguage}"`);
        if (!window.missingLocalizations) { window.missingLocalizations = {}; }
        if (!window.missingLocalizations[_currentLanguage]) { window.missingLocalizations[_currentLanguage] = {}; }
        if (!(key in window.missingLocalizations[_currentLanguage])) {
          window.missingLocalizations[_currentLanguage][key] = _baseTranslations[key];
        }
      }
      return _baseTranslations[key];
    }
    if (_isBaseLoaded) {
      console.warn(`[localization] Missing key "${key}" for language "${_currentLanguage}"`);
      if (!window.missingLocalizations) { window.missingLocalizations = {}; }
      if (!window.missingLocalizations[_currentLanguage]) { window.missingLocalizations[_currentLanguage] = {}; }
      if (!(key in window.missingLocalizations[_currentLanguage])) {
        window.missingLocalizations[_currentLanguage][key] = fallback ?? "";
      }
    }
    return fallback;
  }

  // ── DOM application ────────────────────────────────────────────────────────

  function applyElement(element) {
    if (!(element instanceof Element)) { return; }
    const key = element.dataset.localizationKey;
    if (!key) { return; }
    const prop = element.dataset.localizationProperty || "textContent";
    const value = t(key);
    if (value !== null) { element[prop] = value; }
    // if null → leave existing content as the built-in fallback
  }

  function applySubtree(root) {
    if (!root) { return; }
    // Check root itself first
    if (root.dataset?.localizationKey) { applyElement(root); }
    // Then all descendants
    if (typeof root.querySelectorAll === "function") {
      root.querySelectorAll("[data-localization-key]").forEach(applyElement);
    }
  }

  // ── JSON loading ───────────────────────────────────────────────────────────

  async function fetchJSON(url) {
    const response = await fetch(url);
    if (!response.ok) { throw new Error(`HTTP ${response.status} loading ${url}`); }
    return response.json();
  }

  async function loadLanguage(language) {
    // Load base file once
    if (!_isBaseLoaded) {
      try {
        _baseTranslations = await fetchJSON(BASE_URL);
        _isBaseLoaded = true;
      } catch (loadError) {
        console.warn("[localization] Could not load base file:", loadError.message);
        _baseTranslations = {};
      }
    }

    if (language === DEFAULT_LANGUAGE) {
      _overrideTranslations = {};
      return;
    }

    try {
      _overrideTranslations = await fetchJSON(`localization.${language}.json`);
    } catch {
      console.warn(`[localization] No translation file for "${language}", using base.`);
      _overrideTranslations = {};
    }
  }

  // ── MutationObserver ───────────────────────────────────────────────────────

  function setupObserver() {
    if (_observer) { return; }

    _observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          // New elements added to the DOM
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) { applySubtree(node); }
          });
        } else if (mutation.type === "attributes") {
          // data-localization-key or data-localization-property changed
          applyElement(mutation.target);
        }
      }
    });

    _observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-localization-key", "data-localization-property"],
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Switch the active language. Loads the translation file, re-applies all
   * data-localization-key elements, and dispatches a `languagechange` event.
   */
  async function setLanguage(language) {
    _currentLanguage = language;
    localStorage.setItem(STORAGE_KEY, language);
    await loadLanguage(language);
    applySubtree(document.body);
    document.documentElement.lang = language;
    window.dispatchEvent(new CustomEvent("languagechange", { detail: { lang: language } }));
  }

  /**
   * Initialize the framework. Detects saved or browser language, loads
   * translations, applies to the current DOM, and starts the observer.
   * Call once before auth / first render.
   */
  async function init() {
    const saved = localStorage.getItem(STORAGE_KEY);
    const browser = (navigator.language || "").split("-")[0];
    const language = saved || browser || DEFAULT_LANGUAGE;

    await loadLanguage(language);
    _currentLanguage = language;
    document.documentElement.lang = language;

    if (document.body) { applySubtree(document.body); }
    setupObserver();
    window.dispatchEvent(new CustomEvent("languagechange", { detail: { lang: language } }));
  }

  /** Returns the currently active language code, defaulting to "en". */
  function getLanguage() {
    return _currentLanguage || DEFAULT_LANGUAGE;
  }

  window.localization = { init, setLanguage, getLanguage, t, applySubtree };
})();
