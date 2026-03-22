export function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function nowDatetimeLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function toDatetimeLocal(utcString) {
  if (!utcString) { return ""; }
  const d = new Date(utcString);
  if (isNaN(d)) { return ""; }
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function formatDate(dateString) {
  if (!dateString) { return "—"; }
  const pad = (n) => String(n).padStart(2, "0");

  // Datetime string (contains T or Z) — parse as UTC, display in local time
  if (dateString.includes("T") || dateString.endsWith("Z")) {
    // Ensure UTC interpretation if no Z suffix
    const normalized = dateString.endsWith("Z") || dateString.includes("+") ? dateString : dateString + "Z";
    const d = new Date(normalized);
    if (isNaN(d)) { return dateString; }
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // Date-only string (YYYY-MM-DD) — no timezone conversion
  const parts = dateString.split("-");
  return parts.length !== 3 ? dateString : `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function normalizeSearch(value) {
  return String(value == null ? "" : value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function escHtml(value) {
  if (!value) { return ""; }
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escAttr(value) {
  if (!value) { return ""; }
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function setBtnLoading(buttonId) {
  const button = document.getElementById(buttonId);
  button.disabled = true;
  button.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status"></span>Saving…`;
}

export function resetBtn(buttonId, label) {
  const button = document.getElementById(buttonId);
  button.disabled = false;
  button.innerHTML = `<i class="bi bi-check-lg me-1"></i>${label}`;
}

export function showErrors(containerId, errors) {
  const container = document.getElementById(containerId);
  const items = errors.map((message) => `<div><i class="bi bi-exclamation-circle me-1"></i>${escHtml(message)}</div>`).join("");
  container.innerHTML = `<div class="alert alert-danger py-2 mb-2">${items}</div>`;
  container.classList.remove("d-none");
}

export function clearErrors(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = "";
    container.classList.add("d-none");
  }
}
