import { LitElement, html } from "../../lib/lit.min.js";
import { state } from "../state.js";
import { normalizeSearch } from "../utils.js";

let _uid = 0;

class DoctorSelector extends LitElement {
  static properties = {
    _specialtyFilter: { state: true },
    _specialtySearch: { state: true },
  };

  selectedDoctorId = "";
  labelKey         = "appt.doctor";
  labelFallback    = "Doctor";
  optional         = false;

  #uid = `ds-${_uid++}`;

  constructor() {
    super();
    this._specialtyFilter = new Set();
    this._specialtySearch = "";
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

  reset(doctorId = "") {
    this._specialtyFilter = new Set();
    this._specialtySearch = "";
    this.selectedDoctorId = doctorId || (this.optional ? "" : state.allDoctors[0]?.Id || "");
    this.requestUpdate();
  }

  #specialtyLabel(doctor, lang) {
    return lang === "el" ? (doctor.SpecialtyEl || doctor.SpecialtyEn || "") : (doctor.SpecialtyEn || "");
  }

  render() {
    const t    = (key, fallback) => window.localization?.t(key) ?? fallback;
    const lang = window.localization.getLanguage();
    const specialties = state.allDoctorSpecialties;
    const filter      = this._specialtyFilter;
    const searchVal   = this._specialtySearch;

    const visible = searchVal
      ? specialties.filter((s) => normalizeSearch(lang === "el" ? (s.El || s.En) : s.En).includes(normalizeSearch(searchVal)))
      : specialties;

    const filterLabel = filter.size === 0
      ? html`<span class="text-muted">${t("appt.all-specialties", "All Specialties")}</span>`
      : specialties.filter((s) => filter.has(s.Id)).map((s) => lang === "el" ? (s.El || s.En) : s.En).join(", ");

    const doctors = filter.size === 0
      ? state.allDoctors
      : state.allDoctors.filter((d) => filter.has(d.SpecialtyId));

    // Ensure selection is always valid
    const selectedId = (this.optional && this.selectedDoctorId === "") || doctors.find((d) => d.Id === this.selectedDoctorId)
      ? this.selectedDoctorId
      : (this.selectedDoctorId = this.optional ? "" : (doctors[0]?.Id || ""));

    return html`
      <div class="mb-3">
        <label class="form-label small"><i class="bi bi-clipboard2-pulse me-1"></i>${t("doctors.specialty", "Specialty")}</label>
        <div class="dropdown">
          <button type="button" class="btn btn-outline-secondary btn-sm dropdown-toggle w-100 text-start"
            data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
            ${filterLabel}
          </button>
          <div class="dropdown-menu p-2" style="min-width:100%;width:100%">
            <input type="text" class="form-control form-control-sm mb-2"
              placeholder="${t("label.search", "Search…")}"
              .value=${searchVal}
              @click=${(e) => e.stopPropagation()}
              @input=${(e) => { this._specialtySearch = e.target.value; }} />
            <div style="max-height:200px;overflow-y:auto">
              ${visible.map((s) => html`
                <div class="form-check">
                  <input type="checkbox" class="form-check-input" id="${this.#uid}-${s.Id}"
                    .checked=${filter.has(s.Id)}
                    @change=${(e) => {
                      const next = new Set(filter);
                      if (e.target.checked) { next.add(s.Id); } else { next.delete(s.Id); }
                      this._specialtyFilter = next;
                      const filtered = next.size === 0 ? state.allDoctors : state.allDoctors.filter((d) => next.has(d.SpecialtyId));
                      if (!filtered.find((d) => d.Id === this.selectedDoctorId)) {
                        this.selectedDoctorId = filtered[0]?.Id || "";
                      }
                    }} />
                  <label class="form-check-label" for="${this.#uid}-${s.Id}">
                    ${lang === "el" ? (s.El || s.En) : s.En}
                  </label>
                </div>`)}
            </div>
          </div>
        </div>
      </div>
      <div class="form-floating mb-3">
        <select class="form-select"
          .value=${selectedId}
          @change=${(e) => { this.selectedDoctorId = e.target.value; }}>
          ${this.optional ? html`<option value="" .selected=${selectedId === ""}>—</option>` : ""}
          ${doctors.map((d) => html`
            <option value="${d.Id}" .selected=${d.Id === selectedId}>
              ${d.FullName}${this.#specialtyLabel(d, lang) ? ` — ${this.#specialtyLabel(d, lang)}` : ""}
            </option>`)}
        </select>
        <label><i class="bi bi-person-badge me-1"></i>${t(this.labelKey, this.labelFallback)}</label>
      </div>
    `;
  }
}

customElements.define("doctor-selector", DoctorSelector);
