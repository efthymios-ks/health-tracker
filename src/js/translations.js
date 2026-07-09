import { getSettings, updateSettings } from "./settings.js";

let _data = {};
let _current = getSettings().selectedLanguage || "en";

async function loadTranslations() {
  const response = await fetch("translations.json");
  _data = await response.json();
  if (!_data[_current]) { _current = Object.keys(_data)[0] || "en"; }
  applyTranslations();
  document.dispatchEvent(new CustomEvent("translations-loaded"));
}

export function t(key, fallback = "", params = {}) {
  const keys = _data[_current]?.keys || {};
  let str = keys[key] ?? (_data["en"]?.keys || {})[key] ?? fallback ?? key;
  Object.entries(params).forEach(([k, v]) => {
    str = str.replace(new RegExp(`\\{${k}\\}`, "g"), v);
  });
  return str;
}

export function setLanguage(code) {
  if (!_data[code]) { return; }
  _current = code;
  updateSettings({ selectedLanguage: code });
  applyTranslations();
  document.dispatchEvent(new CustomEvent("language-changed", { detail: { code } }));
}

export function getLanguage() { return _current; }

export function getLanguages() {
  return Object.entries(_data).map(([code, entry]) => ({ code, label: entry.label }));
}

function applyTranslations() {
  document.querySelectorAll("[data-translations-key]").forEach((el) => {
    const key = el.dataset.translationsKey;
    const field = el.dataset.translationsField;
    const value = t(key, el.textContent);
    if (!field || field === "textContent") {
      el.textContent = value;
    } else {
      el.setAttribute(field, value);
    }
  });
}

export function subscribeLanguage(callback) {
  document.addEventListener("language-changed", callback);
  document.addEventListener("translations-loaded", callback);
  return () => {
    document.removeEventListener("language-changed", callback);
    document.removeEventListener("translations-loaded", callback);
  };
}

window.setLanguage = setLanguage;
window.getLanguage = getLanguage;
window.getLanguages = getLanguages;
window.applyTranslations = applyTranslations;
window.t = t;

loadTranslations().catch((err) => console.error("Failed to load translations:", err));
