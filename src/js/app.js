import "./components/appHeader.js";
import "./components/loadingOverlay.js";
import { state } from "./state.js";
import "./tabs/configuration.js";
import "./tabs/dashboard.js";
import "./tabs/doctors.js";
import "./tabs/memberHealth.js";
import "./tabs/members.js";

function setLoading(visible, text = "") {
  if (visible) {
    window.loadingModal.show(text);
  } else {
    window.loadingModal.hide();
  }
}

async function onAuthReady() {
  setLoading(true);
  try {
    await window.sheets.init();
    await window.api.loadAll();
  } catch (error) {
    window.loadingModal.showError(error.message);
    return;
  }
  setLoading(false);
  showTab("dashboard");
}

function showTab(tabName) {
  state.currentTab = tabName;
  const tabNames = ["dashboard", "member-health", "settings", "doctors", "members"];
  tabNames.forEach((name) => {
    document.getElementById(`tab-${name}`).classList.toggle("d-none", name !== tabName);
  });
  document.querySelectorAll("[data-tab]").forEach((link) => {
    if (link.dataset.tab === tabName) {
      link.setAttribute("data-selected", "");
    } else {
      link.removeAttribute("data-selected");
    }
  });
  if (tabName === "dashboard") { document.getElementById("tab-dashboard").load(); }
  if (tabName === "member-health") { document.getElementById("tab-member-health").load(); }
  if (tabName === "settings") { document.getElementById("tab-settings").load(); }
  if (tabName === "doctors") { document.getElementById("tab-doctors").load(); }
  if (tabName === "members") { document.getElementById("tab-members").load(); }
}

async function refreshCurrentTab() {
  setLoading(true);
  try {
    await window.api.loadAll();
  } catch (error) {
    window.loadingModal.showError(error.message);
    return;
  }
  setLoading(false);
  showTab(state.currentTab);
}

window.onAuthReady = onAuthReady;
window.showTab = showTab;
window.refreshCurrentTab = refreshCurrentTab;
window.setLoading = setLoading;

window.onload = async () => {
  await window.localization.init();
  window.auth.initAuth(onAuthReady);
};
