import { LitElement, html, nothing } from "../../lib/lit.min.js";

const TABS = [
  { name: "dashboard",    key: "nav.dashboard",    label: "Dashboard",    icon: "bi-speedometer2" },
  { name: "member-health",key: "nav.member-health",label: "Member Health",icon: "bi-person-heart" },
  { name: "members",      key: "nav.members",      label: "Members",      icon: "bi-people" },
  { name: "doctors",      key: "nav.doctors",      label: "Doctors",      icon: "bi-person-badge" },
  { name: "settings",     key: "nav.settings",     label: "Settings",     icon: "bi-gear" },
];

const navItem = (tab, currentLanguage, { dismiss = false } = {}) => html`
  <a
    href="#"
    class="nav-link rounded px-3"
    data-tab="${tab.name}"
    data-bs-dismiss=${dismiss ? "offcanvas" : nothing}
    @click=${(event) => { event.preventDefault(); window.showTab(tab.name); }}
  >${window.t?.(tab.key, tab.label) ?? tab.label}</a>
`;

class AppHeader extends LitElement {
  static properties = {
    _currentLanguage: { state: true },
  };

  constructor() {
    super();
    this._currentLanguage = window.getLanguage?.() || "en";
  }

  connectedCallback() {
    super.connectedCallback();
    this._onLangChange = (event) => {
      this._currentLanguage = event.detail?.code || window.getLanguage?.() || "en";
      this.requestUpdate();
    };
    document.addEventListener("language-changed", this._onLangChange);
    document.addEventListener("translations-loaded", this._onLangChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("language-changed", this._onLangChange);
    document.removeEventListener("translations-loaded", this._onLangChange);
  }

  createRenderRoot() { return this; }

  #onLangSelect(event) {
    window.setLanguage?.(event.target.value);
  }

  #renderLangSelector() {
    const languages = window.getLanguages?.() || [];
    return html`
      <div class="px-2 pb-3 mt-auto">
        <select
          class="form-select form-select-sm bg-primary-subtle border-0 text-body"
          .value=${this._currentLanguage}
          @change=${this.#onLangSelect}
        >
          ${languages.map((languageOption) => html`
            <option
              value="${languageOption.code}"
              .selected=${languageOption.code === this._currentLanguage}
            >${languageOption.label}</option>
          `)}
        </select>
      </div>
    `;
  }

  render() {
    const currentLanguage = this._currentLanguage;
    const languages = window.getLanguages?.() || [];
    return html`
      <!-- Desktop Sidebar -->
      <nav
        class="d-none d-md-flex flex-column bg-primary flex-shrink-0 position-sticky top-0 vh-100 overflow-auto navbar-dark"
        style="width: 220px"
      >
        <div class="px-3 py-3 fw-bold text-white border-bottom border-white border-opacity-25 small">
          🏥 Health Tracker
        </div>
        <div class="navbar-nav flex-column p-2 flex-grow-1 gap-1">
          ${TABS.map((tab) => navItem(tab, currentLanguage))}
        </div>
        ${this.#renderLangSelector()}
      </nav>

      <!-- Mobile Offcanvas -->
      <div
        class="offcanvas offcanvas-start bg-primary"
        tabindex="-1"
        id="mobileOffcanvas"
      >
        <div class="offcanvas-header border-bottom border-white border-opacity-25">
          <h6 class="offcanvas-title fw-bold text-white">🏥 Health Tracker</h6>
          <button
            type="button"
            class="btn-close btn-close-white"
            data-bs-dismiss="offcanvas"
          ></button>
        </div>
        <div class="offcanvas-body p-2 navbar-dark d-flex flex-column">
          <nav class="navbar-nav flex-column gap-1 flex-grow-1">
            ${TABS.map((tab) => navItem(tab, currentLanguage, { dismiss: true }))}
          </nav>
          <div class="pb-2 pt-3">
            <select
              class="form-select form-select-sm bg-primary-subtle border-0 text-body"
              .value=${this._currentLanguage}
              @change=${this.#onLangSelect}
            >
              ${languages.map((languageOption) => html`
                <option
                  value="${languageOption.code}"
                  .selected=${languageOption.code === this._currentLanguage}
                >${languageOption.label}</option>
              `)}
            </select>
          </div>
        </div>
      </div>

      <!-- Mobile Top Navbar -->
      <nav
        class="navbar navbar-dark bg-primary d-md-none position-fixed top-0 start-0 end-0"
        style="z-index: 1030"
      >
        <div class="container-fluid">
          <span class="navbar-brand fw-bold">🏥 Health Tracker</span>
          <button
            class="navbar-toggler border-0"
            type="button"
            data-bs-toggle="offcanvas"
            data-bs-target="#mobileOffcanvas"
          >
            <span class="navbar-toggler-icon"></span>
          </button>
        </div>
      </nav>
    `;
  }
}

customElements.define("app-header", AppHeader);
