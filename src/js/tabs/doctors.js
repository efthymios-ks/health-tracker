import { LitElement, html } from "../../lib/lit.min.js";
import { showConfirm } from "../confirm.js";
import { state } from "../state.js";
import { normalizeSearch } from "../utils.js";

class DoctorsTab extends LitElement {
  static properties = {
    _doctors: { state: true },
    _specialties: { state: true },
    _addSaving: { state: true },
    _editSaving: { state: true },
    _addErrors: { state: true },
    _editErrors: { state: true },
    _addSpecialtySearch: { state: true },
    _editSpecialtySearch: { state: true },
    _addSelectedSpecialtyId: { state: true },
    _editSelectedSpecialtyId: { state: true },
    _addPhones: { state: true },
    _editPhones: { state: true },
  };

  #search = "";

  constructor() {
    super();
    this._doctors = [];
    this._specialties = [];
    this._addSaving = false;
    this._editSaving = false;
    this._addErrors = [];
    this._editErrors = [];
    this._addSpecialtySearch = "";
    this._editSpecialtySearch = "";
    this._addSelectedSpecialtyId = "";
    this._editSelectedSpecialtyId = "";
    this._addPhones = [""];
    this._editPhones = [""];
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
    this._doctors = state.allDoctors;
    this._specialties = state.allDoctorSpecialties;
  }

  async #reload() {
    try {
      await window.api.loadAll();
    } catch (loadError) {
      alert(loadError.message);
    }
    this.load();
  }

  #specialtyName(doctor) {
    const lang = window.localization.getLanguage();
    return lang === "el" ? (doctor.SpecialtyEl || doctor.SpecialtyEn || "") : (doctor.SpecialtyEn || "");
  }

  #filtered() {
    if (!this.#search) { return this._doctors; }
    return this._doctors.filter((d) =>
      normalizeSearch(d.FullName).includes(this.#search) ||
      normalizeSearch(d.SpecialtyEn).includes(this.#search) ||
      normalizeSearch(d.SpecialtyEl).includes(this.#search) ||
      normalizeSearch(d.PhoneNumbers.join(" ")).includes(this.#search) ||
      normalizeSearch(d.Email).includes(this.#search)
    );
  }

  #openAdd() {
    this._addErrors = [];
    this._addSaving = false;
    this._addSpecialtySearch = "";
    this._addSelectedSpecialtyId = "";
    this._addPhones = [""];
    bootstrap.Modal.getOrCreateInstance(this.querySelector("#addDoctorModal")).show();
    this.updateComplete.then(() => {
      this.querySelector("#addDoctorFirstName").value = "";
      this.querySelector("#addDoctorLastName").value = "";
      this.querySelector("#addDoctorEmail").value = "";
      this.querySelector("#addDoctorAddress").value = "";
      this.querySelector("#addDoctorNotes").value = "";
    });
  }

  #openEdit(doctor) {
    this._editErrors = [];
    this._editSaving = false;
    this._editSpecialtySearch = "";
    this._editSelectedSpecialtyId = doctor.SpecialtyId || "";
    this._editPhones = doctor.PhoneNumbers.length ? [...doctor.PhoneNumbers] : [""];
    bootstrap.Modal.getOrCreateInstance(this.querySelector("#editDoctorModal")).show();
    this.updateComplete.then(() => {
      this.querySelector("#editDoctorId").value = doctor.Id;
      this.querySelector("#editDoctorFirstName").value = doctor.FirstName || "";
      this.querySelector("#editDoctorLastName").value = doctor.LastName || "";
      this.querySelector("#editDoctorEmail").value = doctor.Email || "";
      this.querySelector("#editDoctorAddress").value = doctor.Address || "";
      this.querySelector("#editDoctorNotes").value = doctor.Notes || "";
    });
  }

  #buildDoctorData(prefix) {
    const specialtyKey = prefix === "add" ? "_addSelectedSpecialtyId" : "_editSelectedSpecialtyId";
    const phonesKey = prefix === "add" ? "_addPhones" : "_editPhones";
    const specialtyId = this[specialtyKey];
    const specialty = this._specialties.find((s) => s.Id === specialtyId) || null;
    return {
      FirstName: this.querySelector(`#${prefix}DoctorFirstName`).value.trim(),
      LastName: this.querySelector(`#${prefix}DoctorLastName`).value.trim(),
      SpecialtyId: specialty?.Id || "",
      SpecialtyEn: specialty?.En || "",
      SpecialtyEl: specialty?.El || "",
      PhoneNumbers: this[phonesKey].map((p) => p.trim()).filter(Boolean),
      Email: this.querySelector(`#${prefix}DoctorEmail`).value.trim(),
      Address: this.querySelector(`#${prefix}DoctorAddress`).value.trim(),
      Notes: this.querySelector(`#${prefix}DoctorNotes`).value.trim(),
    };
  }

  #validateDoctor(data) {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const errors = [];
    if (!data.FirstName)           { errors.push(t("error.required-first-name", "First name is required.")); }
    if (!data.LastName)            { errors.push(t("error.required-last-name", "Last name is required.")); }
    if (!data.SpecialtyId)         { errors.push(t("error.required-specialty", "Specialty is required.")); }
    if (!data.PhoneNumbers.length) { errors.push(t("error.required-phone", "At least one phone number is required.")); }
    return errors;
  }

  async #submitAdd() {
    const data = this.#buildDoctorData("add");
    this._addErrors = this.#validateDoctor(data);
    if (this._addErrors.length) { return; }
    this._addErrors = [];
    this._addSaving = true;
    try {
      await window.api.addDoctor(data);
      bootstrap.Modal.getInstance(this.querySelector("#addDoctorModal")).hide();
      await this.#reload();
    } catch (saveError) {
      this._addErrors = [saveError.message];
    } finally {
      this._addSaving = false;
    }
  }

  async #submitEdit() {
    const id = this.querySelector("#editDoctorId").value;
    const data = this.#buildDoctorData("edit");
    this._editErrors = this.#validateDoctor(data);
    if (this._editErrors.length) { return; }
    this._editErrors = [];
    this._editSaving = true;
    try {
      await window.api.updateDoctor(id, data);
      bootstrap.Modal.getInstance(this.querySelector("#editDoctorModal")).hide();
      await this.#reload();
    } catch (saveError) {
      this._editErrors = [saveError.message];
    } finally {
      this._editSaving = false;
    }
  }

  #confirmDelete(doctor) {
    showConfirm("Delete Doctor", `Delete ${doctor.FullName}? This cannot be undone.`, "Delete", "btn-danger", (done) => {
      window.api.deleteDoctor(doctor.Id).then(() => { done(); this.#reload(); }).catch((deleteError) => { done(); alert(deleteError.message); });
    });
  }

  #renderErrors(errors) {
    if (!errors.length) { return ""; }
    return html`<div class="alert alert-danger py-2 mb-0 mt-2"><ul class="mb-0 ps-3">${errors.map((msg) => html`<li>${msg}</li>`)}</ul></div>`;
  }

  #renderSpecialtyDropdown(prefix, isAdd) {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const lang = window.localization.getLanguage();
    const searchKey = isAdd ? "_addSpecialtySearch" : "_editSpecialtySearch";
    const selectedKey = isAdd ? "_addSelectedSpecialtyId" : "_editSelectedSpecialtyId";
    const searchVal = this[searchKey];
    const selectedId = this[selectedKey];
    const toggleId = `${prefix}SpecialtyDropdownToggle`;

    const sorted = [...this._specialties].sort((a, b) => (a.Id < b.Id ? -1 : a.Id > b.Id ? 1 : 0));
    const filtered = searchVal
      ? sorted.filter((s) => normalizeSearch(lang === "el" ? (s.El || s.En) : s.En).includes(normalizeSearch(searchVal)))
      : sorted;

    const selectedSpecialty = this._specialties.find((s) => s.Id === selectedId);
    const selectedName = selectedSpecialty
      ? (lang === "el" ? (selectedSpecialty.El || selectedSpecialty.En) : selectedSpecialty.En)
      : "";

    return html`
      <div class="mb-3">
        <label class="form-label small"><i class="bi bi-clipboard2-pulse me-1"></i>${t("doctors.specialty", "Specialty")}</label>
        <div class="dropdown">
          <button id="${toggleId}" type="button"
            class="btn btn-outline-secondary btn-sm dropdown-toggle w-100 text-start"
            data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
            ${selectedName || html`<span class="text-muted">${t("doctors.specialty", "Specialty")}…</span>`}
          </button>
          <div class="dropdown-menu p-2" style="min-width:100%;width:100%">
            <input type="text" class="form-control form-control-sm mb-2"
              placeholder="${t("doctors.specialty", "Specialty")}…"
              .value=${searchVal}
              @click=${(e) => e.stopPropagation()}
              @input=${(e) => { this[searchKey] = e.target.value; }} />
            <div style="max-height:200px;overflow-y:auto">
              ${filtered.map((s) => html`
                <button type="button"
                  class="dropdown-item ${s.Id === selectedId ? "active" : ""}"
                  @click=${() => {
                    this[selectedKey] = s.Id;
                    const toggle = this.querySelector(`#${toggleId}`);
                    bootstrap.Dropdown.getInstance(toggle)?.hide();
                  }}>
                  ${lang === "el" ? (s.El || s.En) : s.En}
                </button>`)}
            </div>
          </div>
        </div>
      </div>`;
  }

  #renderPhonesField(prefix, isAdd) {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const phonesKey = isAdd ? "_addPhones" : "_editPhones";
    const phones = this[phonesKey];
    return html`
      <div class="mb-3">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <label class="form-label small mb-0"><i class="bi bi-telephone me-1"></i>${t("doctors.phone", "Phone")}</label>
          <button type="button" class="btn btn-outline-secondary btn-sm py-0 px-1"
            @click=${() => { this[phonesKey] = [...this[phonesKey], ""]; }}>
            <i class="bi bi-plus-lg"></i>
          </button>
        </div>
        ${phones.map((phone, i) => html`
          <div class="input-group input-group-sm mb-1">
            <input type="tel" class="form-control" .value=${phone}
              @input=${(e) => {
                const arr = [...this[phonesKey]];
                arr[i] = e.target.value;
                this[phonesKey] = arr;
              }} />
            ${phones.length > 1 ? html`
              <button type="button" class="btn btn-outline-danger"
                @click=${() => {
                  const arr = [...this[phonesKey]];
                  arr.splice(i, 1);
                  this[phonesKey] = arr;
                }}>
                <i class="bi bi-x-lg"></i>
              </button>` : ""}
          </div>`)}
      </div>`;
  }

  #renderModalBody(prefix, saveFlag, errors, isAdd) {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    return html`
      <div class="row g-2 mb-3">
        <div class="col-6">
          <div class="form-floating">
            <input type="text" id="${prefix}DoctorFirstName" class="form-control" placeholder="${t("doctors.first-name", "First Name")}" />
            <label>${t("doctors.first-name", "First Name")}</label>
          </div>
        </div>
        <div class="col-6">
          <div class="form-floating">
            <input type="text" id="${prefix}DoctorLastName" class="form-control" placeholder="${t("doctors.last-name", "Last Name")}" />
            <label>${t("doctors.last-name", "Last Name")}</label>
          </div>
        </div>
      </div>
      ${this.#renderSpecialtyDropdown(prefix, isAdd)}
      ${this.#renderPhonesField(prefix, isAdd)}
      <div class="form-floating mb-3">
        <input type="email" id="${prefix}DoctorEmail" class="form-control" placeholder="${t("doctors.email", "Email")}" />
        <label><i class="bi bi-envelope me-1"></i>${t("doctors.email", "Email")}</label>
      </div>
      <div class="form-floating mb-3">
        <input type="text" id="${prefix}DoctorAddress" class="form-control" placeholder="${t("doctors.address", "Address")}" />
        <label><i class="bi bi-geo-alt me-1"></i>${t("doctors.address", "Address")}</label>
      </div>
      <div class="form-floating mb-3">
        <textarea id="${prefix}DoctorNotes" class="form-control" placeholder="${t("doctors.notes", "Notes")}" style="height:80px"></textarea>
        <label>${t("doctors.notes", "Notes")}</label>
      </div>
      ${this.#renderErrors(errors)}
    `;
  }

  #renderAddModal() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    return html`
      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="addDoctorModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-person-plus me-2"></i>${t("doctors.add", "Add Doctor")}</h5>
            </div>
            <div class="modal-body">${this.#renderModalBody("add", this._addSaving, this._addErrors, true)}</div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal" ?disabled=${this._addSaving}>${t("btn.cancel", "Cancel")}</button>
              <button class="btn btn-primary" @click=${this.#submitAdd} ?disabled=${this._addSaving}>
                ${this._addSaving ? html`<span class="spinner-border spinner-border-sm me-1"></span>${t("btn.saving", "Saving…")}` : html`<i class="bi bi-check-lg me-1"></i>${t("btn.save", "Save")}`}
              </button>
            </div>
          </div>
        </div>
      </div>`;
  }

  #renderEditModal() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    return html`
      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="editDoctorModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-pencil me-2"></i>${t("doctors.edit", "Edit Doctor")}</h5>
            </div>
            <div class="modal-body">
              <input type="hidden" id="editDoctorId" />
              ${this.#renderModalBody("edit", this._editSaving, this._editErrors, false)}
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal" ?disabled=${this._editSaving}>${t("btn.cancel", "Cancel")}</button>
              <button class="btn btn-primary" @click=${this.#submitEdit} ?disabled=${this._editSaving}>
                ${this._editSaving ? html`<span class="spinner-border spinner-border-sm me-1"></span>${t("btn.saving", "Saving…")}` : html`<i class="bi bi-check-lg me-1"></i>${t("btn.save", "Save")}`}
              </button>
            </div>
          </div>
        </div>
      </div>`;
  }

  render() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const list = this.#filtered();
    return html`
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><i class="bi bi-person-badge me-1"></i> ${t("doctors.title", "Doctors")}</span>
          <button class="btn btn-primary btn-sm" @click=${this.#openAdd}><i class="bi bi-plus-lg"></i></button>
        </div>
        <div class="card-body border-bottom py-2">
          <div class="input-group input-group-sm" style="max-width:300px">
            <span class="input-group-text"><i class="bi bi-search"></i></span>
            <input type="text" class="form-control" placeholder="${t("label.search", "Search…")}"
              @input=${(event) => { this.#search = normalizeSearch(event.target.value); this.requestUpdate(); }} />
          </div>
        </div>
        <div>
          ${list.length ? html`
            <ul class="list-group list-group-flush">
              ${list.map((doctor) => html`
                <li class="list-group-item d-flex align-items-center justify-content-between gap-2 py-2">
                  <div>
                    <span class="fw-semibold">${doctor.FullName}</span>
                    ${this.#specialtyName(doctor) ? html`<span class="badge bg-primary-subtle text-primary-emphasis ms-2">${this.#specialtyName(doctor)}</span>` : ""}
                  </div>
                  <div class="d-flex align-items-center gap-1">
                    ${doctor.PhoneNumbers.length === 1 ? html`
                      <a href="tel:${doctor.PhoneNumbers[0]}" class="btn btn-sm btn-outline-secondary" title="${doctor.PhoneNumbers[0]}"><i class="bi bi-telephone-fill"></i></a>`
                    : doctor.PhoneNumbers.length > 1 ? html`
                      <div class="dropdown">
                        <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-toggle="dropdown" aria-expanded="false" title="Phone numbers">
                          <i class="bi bi-telephone-fill"></i>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end shadow-sm">
                          ${doctor.PhoneNumbers.map((phone) => html`
                            <li><a class="dropdown-item" href="tel:${phone}"><i class="bi bi-telephone me-2"></i>${phone}</a></li>`)}
                        </ul>
                      </div>` : ""}
                    ${doctor.Email ? html`<a href="mailto:${doctor.Email}" class="btn btn-sm btn-outline-secondary" title="${doctor.Email}"><i class="bi bi-envelope-fill"></i></a>` : ""}
                    ${doctor.Address ? html`<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(doctor.Address)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-secondary" title="${doctor.Address}"><i class="bi bi-map-fill"></i></a>` : ""}
                    <button class="btn btn-sm btn-outline-secondary" @click=${() => this.#openEdit(doctor)}><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" @click=${() => this.#confirmDelete(doctor)}><i class="bi bi-trash"></i></button>
                  </div>
                </li>`)}
            </ul>` : html`<p class="text-muted p-3">${t("doctors.none", "No doctors found.")}</p>`}
        </div>
      </div>
      ${this.#renderAddModal()}
      ${this.#renderEditModal()}
    `;
  }
}

customElements.define("doctors-tab", DoctorsTab);
