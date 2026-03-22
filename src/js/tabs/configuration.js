import { LitElement, html, nothing } from "../../lib/lit.min.js";
import { showConfirm } from "../confirm.js";
import { state } from "../state.js";
import { normalizeSearch } from "../utils.js";

function isValidSlug(id) {
  return /^[a-z0-9-]+$/.test(id);
}

function toSlug(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Generic lookup section for En/El tables ─────────────────────────────────

class BilingualLookupSection extends LitElement {
  static properties = {
    section:     { type: String },   // "specialties" | "conditions"
    stateKey:    { type: String },   // "allDoctorSpecialties" | "allMedicalConditions"
    titleKey:    { type: String },
    addKey:      { type: String },
    editKey:     { type: String },
    noneKey:     { type: String },
    _items:      { state: true },
    _addSaving:  { state: true },
    _editSaving: { state: true },
    _addErrors:  { state: true },
    _editErrors: { state: true },
  };

  #search = "";

  constructor() {
    super();
    this._items = [];
    this._addSaving = false;
    this._editSaving = false;
    this._addErrors = [];
    this._editErrors = [];
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
    this._items = state[this.stateKey] || [];
  }

  async #reload() {
    try {
      await window.api.loadAll();
    } catch (loadError) {
      alert(loadError.message);
    }
    this.load();
  }

  #displayName(item) {
    const lang = window.localization.getLanguage();
    return lang === "el" ? (item.El || item.En || item.Id) : (item.En || item.Id);
  }

  #filtered() {
    if (!this.#search) { return this._items; }
    return this._items.filter((item) =>
      normalizeSearch(item.En).includes(this.#search) ||
      normalizeSearch(item.El).includes(this.#search) ||
      normalizeSearch(item.Id).includes(this.#search)
    );
  }

  #openAdd() {
    this._addErrors = [];
    this._addSaving = false;
    bootstrap.Modal.getOrCreateInstance(this.querySelector(`#add-${this.section}-modal`)).show();
    this.updateComplete.then(() => {
      this.querySelector(`#add-${this.section}-en`).value = "";
      this.querySelector(`#add-${this.section}-el`).value = "";
      this.querySelector(`#add-${this.section}-id`).value = "";
      this.querySelector(`#add-${this.section}-id`)._touched = false;
    });
  }

  #openEdit(item) {
    this._editErrors = [];
    this._editSaving = false;
    bootstrap.Modal.getOrCreateInstance(this.querySelector(`#edit-${this.section}-modal`)).show();
    this.updateComplete.then(() => {
      this.querySelector(`#edit-${this.section}-id`).value = item.Id;
      this.querySelector(`#edit-${this.section}-en`).value = item.En || "";
      this.querySelector(`#edit-${this.section}-el`).value = item.El || "";
    });
  }

  async #submitAdd() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const enEl = this.querySelector(`#add-${this.section}-en`);
    const elEl = this.querySelector(`#add-${this.section}-el`);
    const idEl = this.querySelector(`#add-${this.section}-id`);
    const en = enEl.value.trim();
    const el = elEl.value.trim();
    const id = idEl.value.trim() || toSlug(en);

    const errors = [];
    if (!en) { errors.push(t("error.required-name-en", "English name is required.")); }
    if (!id) { errors.push(t("error.required-id", "ID is required.")); }
    else if (!isValidSlug(id)) { errors.push(t("error.invalid-id-format", "ID must contain only lowercase letters, digits and hyphens.")); }
    else if (this._items.some((existingItem) => existingItem.Id === id)) { errors.push(t("error.duplicate-id", `ID "${id}" already exists.`).replace("{id}", id)); }
    if (errors.length) { this._addErrors = errors; return; }

    this._addErrors = [];
    this._addSaving = true;
    try {
      if (this.section === "specialties") {
        await window.api.addDoctorSpecialty(id, en, el);
      } else {
        await window.api.addMedicalCondition(id, en, el);
      }
      bootstrap.Modal.getInstance(this.querySelector(`#add-${this.section}-modal`)).hide();
      await this.#reload();
    } catch (saveError) {
      this._addErrors = [saveError.message];
    } finally {
      this._addSaving = false;
    }
  }

  async #submitEdit() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const id = this.querySelector(`#edit-${this.section}-id`).value;
    const en = this.querySelector(`#edit-${this.section}-en`).value.trim();
    const el = this.querySelector(`#edit-${this.section}-el`).value.trim();
    if (!en) { this._editErrors = [t("error.required-name-en", "English name is required.")]; return; }

    this._editErrors = [];
    this._editSaving = true;
    try {
      if (this.section === "specialties") {
        await window.api.updateDoctorSpecialty(id, en, el);
      } else {
        await window.api.updateMedicalCondition(id, en, el);
      }
      bootstrap.Modal.getInstance(this.querySelector(`#edit-${this.section}-modal`)).hide();
      await this.#reload();
    } catch (saveError) {
      this._editErrors = [saveError.message];
    } finally {
      this._editSaving = false;
    }
  }

  #confirmDelete(item) {
    showConfirm(
      "Delete",
      `Delete "${this.#displayName(item)}" (${item.Id})?`,
      "Delete", "btn-danger",
      (done) => {
        const fn = this.section === "specialties"
          ? window.api.deleteDoctorSpecialty(item.Id)
          : window.api.deleteMedicalCondition(item.Id);
        fn.then(() => { done(); this.#reload(); }).catch((deleteError) => { done(); alert(deleteError.message); });
      },
    );
  }

  #renderErrors(errors) {
    if (!errors.length) { return nothing; }
    return html`<div class="alert alert-danger py-2 mb-0 mt-2">
      <ul class="mb-0 ps-3">${errors.map((msg) => html`<li>${msg}</li>`)}</ul>
    </div>`;
  }

  render() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const list = this.#filtered();
    const s = this.section;

    return html`
      <div class="card mb-4">
        <div class="card-header d-flex align-items-center gap-2">
          <div class="input-group input-group-sm" style="max-width:260px">
            <span class="input-group-text"><i class="bi bi-search"></i></span>
            <input type="text" class="form-control" placeholder="${t("label.search", "Search…")}"
              @input=${(event) => { this.#search = normalizeSearch(event.target.value); this.requestUpdate(); }} />
          </div>
          <button class="btn btn-primary btn-sm ms-auto flex-shrink-0" @click=${this.#openAdd}>
            <i class="bi bi-plus-lg"></i>
          </button>
        </div>
        <div>
          ${list.length ? html`
            <ul class="list-group list-group-flush">
              ${list.map((item) => html`
                <li class="list-group-item d-flex align-items-center py-2 gap-3">
                  <div class="flex-grow-1">
                    <span class="fw-semibold" title="${item.Id}">${this.#displayName(item)}</span>
                  </div>
                  <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-secondary" @click=${() => this.#openEdit(item)}>
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" @click=${() => this.#confirmDelete(item)}>
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </li>`)}
            </ul>` : html`<p class="text-muted p-3 mb-0">${t(this.noneKey, "No entries.")}</p>`}
        </div>
      </div>

      <!-- Add Modal -->
      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="add-${s}-modal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-plus-circle me-2"></i>${t(this.addKey, "Add")}</h5>
            </div>
            <div class="modal-body">
              <div class="form-floating mb-1">
                <input type="text" id="add-${s}-id" class="form-control font-monospace" placeholder="id-slug"
                  @input=${(event) => { event.target._touched = event.target.value.length > 0; }} />
                <label><i class="bi bi-key me-1"></i>${t("settings.id", "ID (slug)")}</label>
              </div>
              <div class="text-muted small mb-3 ps-1">${t("settings.id-hint", "Lowercase, digits, hyphens only. Cannot be changed after saving.")}</div>
              <div class="form-floating mb-3">
                <input type="text" id="add-${s}-en" class="form-control" placeholder="${t("settings.name-en", "Name (English)")}"
                  @input=${(event) => {
                    const idEl = this.querySelector(`#add-${s}-id`);
                    if (!idEl._touched) { idEl.value = toSlug(event.target.value); }
                  }} />
                <label>${t("settings.name-en", "Name (English)")}</label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="add-${s}-el" class="form-control" placeholder="${t("settings.name-el", "Name (Greek)")}" />
                <label>${t("settings.name-el", "Name (Greek)")}</label>
              </div>
              ${this.#renderErrors(this._addErrors)}
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal" ?disabled=${this._addSaving}>${t("btn.cancel", "Cancel")}</button>
              <button class="btn btn-primary btn-sm" @click=${this.#submitAdd} ?disabled=${this._addSaving}>
                ${this._addSaving ? html`<span class="spinner-border spinner-border-sm me-1"></span>${t("btn.saving", "Saving…")}` : html`<i class="bi bi-check-lg me-1"></i>${t("btn.save", "Save")}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Edit Modal (translations only) -->
      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="edit-${s}-modal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-pencil me-2"></i>${t(this.editKey, "Edit")}</h5>
            </div>
            <div class="modal-body">
              <input type="hidden" id="edit-${s}-id" />
              <div class="form-floating mb-3">
                <input type="text" id="edit-${s}-en" class="form-control" placeholder="${t("settings.name-en", "Name (English)")}" />
                <label>${t("settings.name-en", "Name (English)")}</label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="edit-${s}-el" class="form-control" placeholder="${t("settings.name-el", "Name (Greek)")}" />
                <label>${t("settings.name-el", "Name (Greek)")}</label>
              </div>
              ${this.#renderErrors(this._editErrors)}
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal" ?disabled=${this._editSaving}>${t("btn.cancel", "Cancel")}</button>
              <button class="btn btn-primary btn-sm" @click=${this.#submitEdit} ?disabled=${this._editSaving}>
                ${this._editSaving ? html`<span class="spinner-border spinner-border-sm me-1"></span>${t("btn.saving", "Saving…")}` : html`<i class="bi bi-check-lg me-1"></i>${t("btn.save", "Save")}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define("bilingual-lookup-section", BilingualLookupSection);

// ── Settings Tab ─────────────────────────────────────────────────────────────

class SettingsTab extends LitElement {
  static properties = {
    _activeSection: { state: true },
  };

  constructor() {
    super();
    this._activeSection = "specialties";
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
    ["specialties", "conditions"].forEach((key) => {
      this.querySelector(`bilingual-lookup-section[section="${key}"]`)?.load();
    });
    this.requestUpdate();
  }

  render() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;

    const sections = [
      {
        key: "specialties", titleKey: "settings.doctor-specialties",
        addKey: "settings.add-specialty", editKey: "settings.edit-specialty",
        noneKey: "settings.none-specialties", stateKey: "allDoctorSpecialties",
      },
      {
        key: "conditions", titleKey: "settings.medical-conditions",
        addKey: "settings.add-condition", editKey: "settings.edit-condition",
        noneKey: "settings.none-conditions", stateKey: "allMedicalConditions",
      },
    ];

    return html`
      <div class="card">
        <div class="card-header">
          <i class="bi bi-gear me-1"></i> ${t("settings.title", "Settings")}
        </div>
        <div class="card-body border-bottom py-2">
          <ul class="nav nav-pills gap-1">
            ${sections.map((sec) => html`
              <li class="nav-item">
                <button
                  class="nav-link btn btn-sm ${this._activeSection === sec.key ? "active" : ""}"
                  @click=${() => { this._activeSection = sec.key; }}
                >${t(sec.titleKey, sec.key)}</button>
              </li>`)}
          </ul>
        </div>
        <div class="card-body">
          ${sections.map((sec) => html`
            <bilingual-lookup-section
              style="${this._activeSection !== sec.key ? "display:none" : ""}"
              section="${sec.key}"
              statekey="${sec.stateKey}"
              titlekey="${sec.titleKey}"
              addkey="${sec.addKey}"
              editkey="${sec.editKey}"
              nonekey="${sec.noneKey}"
            ></bilingual-lookup-section>`)}
        </div>
      </div>
    `;
  }
}

customElements.define("settings-tab", SettingsTab);
