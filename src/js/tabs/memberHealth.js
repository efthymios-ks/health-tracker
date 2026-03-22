import { LitElement, html } from "../../lib/lit.min.js";
import { state } from "../state.js";
import "./memberHealth/mhAppointments.js";
import "./memberHealth/mhPrescriptions.js";
import "./memberHealth/mhVitals.js";
import "./memberHealth/mhDiagnosticTests.js";
import "./memberHealth/mhSurgeries.js";
import "./memberHealth/mhVaccinations.js";
import "./memberHealth/mhConditions.js";

const SECTIONS = [
  { key: "appointments",     element: "mh-appointments",     icon: "bi-calendar-check",   labelKey: "section.appointments" },
  { key: "prescriptions",    element: "mh-prescriptions",    icon: "bi-capsule",          labelKey: "section.prescriptions" },
  { key: "vitals",           element: "mh-vitals",           icon: "bi-activity",         labelKey: "section.vitals" },
  { key: "diagnostic-tests", element: "mh-diagnostic-tests", icon: "bi-clipboard2-pulse", labelKey: "section.diagnostic-tests" },
  { key: "surgeries",        element: "mh-surgeries",        icon: "bi-scissors",         labelKey: "section.surgeries" },
  { key: "vaccinations",     element: "mh-vaccinations",     icon: "bi-shield-plus",      labelKey: "section.vaccinations" },
  { key: "conditions",       element: "mh-conditions",       icon: "bi-heart-pulse",      labelKey: "section.conditions" },
];

class MemberHealthTab extends LitElement {
  static properties = {
    _selectedMemberId: { state: true },
    _activeSection:    { state: true },
  };

  constructor() {
    super();
    this._selectedMemberId = "";
    this._activeSection = "appointments";
  }

  createRenderRoot() { return this; }

  connectedCallback() {
    super.connectedCallback();
    this._onLangChange = () => this.requestUpdate();
    window.addEventListener("languagechange", this._onLangChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("languagechange", this._onLangChange);
  }

  load() {
    if (!this._selectedMemberId && state.allMembers.length) {
      const currentEmail = window.currentUser?.email;
      const match = currentEmail
        ? state.allMembers.find((m) => m.Emails.includes(currentEmail))
        : null;
      this._selectedMemberId = (match ?? state.allMembers[0]).Id;
    }
    this.requestUpdate();
    if (this._selectedMemberId) {
      this.updateComplete.then(() => this.#loadSections(this._selectedMemberId));
    }
  }

  #loadSections(memberId) {
    SECTIONS.forEach((sec) => {
      this.querySelector(sec.element)?.load(memberId);
    });
  }

  #onMemberSelect(event) {
    const memberId = event.target.value;
    this._selectedMemberId = memberId;
    if (memberId) {
      this.updateComplete.then(() => this.#loadSections(memberId));
    }
  }

  render() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const members = state.allMembers;

    return html`
      <!-- Member Selector -->
      <div class="card mb-3">
        <div class="card-body py-2">
          <div class="row g-2 align-items-center">
            <div class="col-auto">
              <label class="form-label mb-0 fw-semibold">
                <i class="bi bi-person-heart me-1"></i>${t("member-health.select-label", "Select Member")}
              </label>
            </div>
            <div class="col">
              <select
                class="form-select form-select-sm"
                style="max-width:300px"
                .value=${this._selectedMemberId}
                @change=${this.#onMemberSelect}
              >
                ${members.map((m) => html`<option value="${m.Id}" .selected=${m.Id === this._selectedMemberId}>${m.FullName}</option>`)}
              </select>
            </div>
          </div>
        </div>
      </div>

      ${this._selectedMemberId ? html`
        <!-- Section Nav -->
        <div class="card mb-3">
          <div class="card-body py-2">
            <div class="d-flex flex-wrap gap-1">
              ${SECTIONS.map((sec) => html`
                <button
                  class="btn btn-sm ${this._activeSection === sec.key ? "btn-primary" : "btn-outline-secondary"}"
                  @click=${() => { this._activeSection = sec.key; }}
                >
                  <i class="bi ${sec.icon} me-1"></i>${t(sec.labelKey, sec.key)}
                </button>`)}
            </div>
          </div>
        </div>

        <!-- Section Content -->
        <div style="${this._activeSection !== "appointments"     ? "display:none" : ""}"><mh-appointments></mh-appointments></div>
        <div style="${this._activeSection !== "prescriptions"    ? "display:none" : ""}"><mh-prescriptions></mh-prescriptions></div>
        <div style="${this._activeSection !== "vitals"           ? "display:none" : ""}"><mh-vitals></mh-vitals></div>
        <div style="${this._activeSection !== "diagnostic-tests" ? "display:none" : ""}"><mh-diagnostic-tests></mh-diagnostic-tests></div>
        <div style="${this._activeSection !== "surgeries"        ? "display:none" : ""}"><mh-surgeries></mh-surgeries></div>
        <div style="${this._activeSection !== "vaccinations"     ? "display:none" : ""}"><mh-vaccinations></mh-vaccinations></div>
        <div style="${this._activeSection !== "conditions"       ? "display:none" : ""}"><mh-conditions></mh-conditions></div>
      ` : ""}
    `;
  }
}

customElements.define("member-health-tab", MemberHealthTab);
