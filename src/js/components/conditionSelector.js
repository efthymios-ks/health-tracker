import { LitElement, html } from "../../lib/lit.min.js";
import { state } from "../state.js";
import { normalizeSearch } from "../utils.js";

class ConditionSelector extends LitElement {
  static properties = {
    _search: { state: true },
  };

  selectedConditionId = "";
  optional            = false;
  required            = false;

  constructor() {
    super();
    this._search = "";
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

  reset(conditionId = "") {
    this._search = "";
    this.selectedConditionId = conditionId || (this.optional ? "" : state.allMedicalConditions[0]?.Id || "");
    this.requestUpdate();
  }

  render() {
    const t    = (key, fallback) => window.localization?.t(key) ?? fallback;
    const lang = window.localization.getLanguage();

    const filtered = this._search
      ? state.allMedicalConditions.filter((c) =>
          normalizeSearch(lang === "el" ? (c.El || c.En) : c.En).includes(normalizeSearch(this._search)))
      : state.allMedicalConditions;

    const selectedId = (this.optional && this.selectedConditionId === "") || filtered.find((c) => c.Id === this.selectedConditionId)
      ? this.selectedConditionId
      : (this.selectedConditionId = this.optional ? "" : (filtered[0]?.Id || ""));

    return html`
      <div class="mb-3">
        <div class="input-group input-group-sm mb-1">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input type="text" class="form-control"
            placeholder="${t("label.search", "Search…")}"
            .value=${this._search}
            @input=${(e) => { this._search = e.target.value; }} />
        </div>
        <div class="form-floating">
          <select class="form-select"
            .value=${selectedId}
            @change=${(e) => { this.selectedConditionId = e.target.value; }}>
            ${this.optional ? html`<option value="" .selected=${selectedId === ""}>—</option>` : ""}
            ${filtered.map((c) => html`
              <option value="${c.Id}" .selected=${c.Id === selectedId}>
                ${lang === "el" ? (c.El || c.En) : c.En}
              </option>`)}
          </select>
          <label><i class="bi bi-heart-pulse me-1"></i>${t("cond.condition", "Medical Condition")}${this.required ? html` <span class="text-danger">*</span>` : ""}</label>
        </div>
      </div>
    `;
  }
}

customElements.define("condition-selector", ConditionSelector);
