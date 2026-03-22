import { LitElement, html } from "../../../lib/lit.min.js";
import { showConfirm } from "../../confirm.js";
import { state } from "../../state.js";
import { formatDate, todayStr } from "../../utils.js";
import "../../components/doctorSelector.js";

class MhVaccinations extends LitElement {
  static properties = {
    _items:      { state: true },
    _addSaving:  { state: true },
    _editSaving: { state: true },
    _addErrors:  { state: true },
    _editErrors: { state: true },
  };

  #memberId = "";

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

  load(memberId) {
    this.#memberId = memberId;
    this._items = state.allVaccinations.filter((v) => v.MemberId === memberId);
  }

  async #reload() {
    try { await window.api.loadAll(); } catch (e) { alert(e.message); }
    this.load(this.#memberId);
  }

  #doctorLabel(doctorId) {
    const lang = window.localization.getLanguage();
    const doctor = state.allDoctors.find((d) => d.Id === doctorId);
    if (!doctor) { return ""; }
    const specialty = lang === "el" ? (doctor.SpecialtyEl || doctor.SpecialtyEn || "") : (doctor.SpecialtyEn || "");
    return specialty ? `${doctor.FullName} — ${specialty}` : doctor.FullName;
  }

  #openAdd() {
    this._addErrors = [];
    this._addSaving = false;
    bootstrap.Modal.getOrCreateInstance(this.querySelector("#vaxAddModal")).show();
    this.updateComplete.then(() => {
      this.querySelector("#vaxAddName").value = "";
      this.querySelector("#vaxAddDate").value = todayStr();
      this.querySelector("#vaxAddNotes").value = "";
      this.querySelector("#vaxAddDoctorSel")?.reset();
    });
  }

  #openEdit(item) {
    this._editErrors = [];
    this._editSaving = false;
    bootstrap.Modal.getOrCreateInstance(this.querySelector("#vaxEditModal")).show();
    this.updateComplete.then(() => {
      this.querySelector("#vaxEditId").value = item.Id;
      this.querySelector("#vaxEditName").value = item.Name || "";
      this.querySelector("#vaxEditDate").value = item.DateOfVaccinationUtc || "";
      this.querySelector("#vaxEditNotes").value = item.Notes || "";
      this.querySelector("#vaxEditDoctorSel")?.reset(item.DoctorId || "");
    });
  }

  async #submitAdd() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const name     = this.querySelector("#vaxAddName").value.trim();
    const date     = this.querySelector("#vaxAddDate").value;
    const doctorId = this.querySelector("#vaxAddDoctorSel")?.selectedDoctorId ?? "";
    const errors   = [];
    if (!name)     { errors.push(t("error.required-vaccine-name", "Vaccine name is required.")); }
    if (!date)     { errors.push(t("error.required-date", "Date is required.")); }
    if (!doctorId) { errors.push(t("error.required-doctor", "Doctor is required.")); }
    if (errors.length) { this._addErrors = errors; return; }
    this._addErrors = [];
    this._addSaving = true;
    try {
      await window.api.addVaccination({
        MemberId:              this.#memberId,
        Name:                  name,
        DateOfVaccinationUtc:  date,
        DoctorId:              doctorId,
        Notes:                 this.querySelector("#vaxAddNotes").value.trim(),
      });
      bootstrap.Modal.getInstance(this.querySelector("#vaxAddModal")).hide();
      await this.#reload();
    } catch (e) {
      this._addErrors = [e.message];
    } finally {
      this._addSaving = false;
    }
  }

  async #submitEdit() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const id       = this.querySelector("#vaxEditId").value;
    const name     = this.querySelector("#vaxEditName").value.trim();
    const date     = this.querySelector("#vaxEditDate").value;
    const doctorId = this.querySelector("#vaxEditDoctorSel")?.selectedDoctorId ?? "";
    const errors   = [];
    if (!name)     { errors.push(t("error.required-vaccine-name", "Vaccine name is required.")); }
    if (!date)     { errors.push(t("error.required-date", "Date is required.")); }
    if (!doctorId) { errors.push(t("error.required-doctor", "Doctor is required.")); }
    if (errors.length) { this._editErrors = errors; return; }
    this._editErrors = [];
    this._editSaving = true;
    try {
      await window.api.updateVaccination(id, {
        MemberId:              this.#memberId,
        Name:                  name,
        DateOfVaccinationUtc:  date,
        DoctorId:              doctorId,
        Notes:                 this.querySelector("#vaxEditNotes").value.trim(),
      });
      bootstrap.Modal.getInstance(this.querySelector("#vaxEditModal")).hide();
      await this.#reload();
    } catch (e) {
      this._editErrors = [e.message];
    } finally {
      this._editSaving = false;
    }
  }

  #confirmDelete(item) {
    showConfirm("Delete Vaccination", `Delete ${item.Name}?`, "Delete", "btn-danger", (done) => {
      window.api.deleteVaccination(item.Id).then(() => { done(); this.#reload(); }).catch((e) => { done(); alert(e.message); });
    });
  }

  #renderErrors(errors) {
    if (!errors.length) { return ""; }
    return html`<div class="alert alert-danger py-2 mb-0 mt-2"><ul class="mb-0 ps-3">${errors.map((m) => html`<li>${m}</li>`)}</ul></div>`;
  }

  #renderModalBody(prefix, errors) {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    return html`
      <div class="form-floating mb-3">
        <input type="text" id="${prefix}Name" class="form-control" placeholder="${t("vax.name", "Vaccine Name")}" />
        <label>${t("vax.name", "Vaccine Name")}</label>
      </div>
      <div class="form-floating mb-3">
        <input type="date" id="${prefix}Date" class="form-control" placeholder="${t("vax.date", "Date")}" />
        <label>${t("vax.date", "Date")}</label>
      </div>
      <doctor-selector id="${prefix}DoctorSel"
        .labelKey=${"vax.doctor"} .labelFallback=${"Doctor"}></doctor-selector>
      <div class="form-floating mb-3">
        <textarea id="${prefix}Notes" class="form-control" placeholder="${t("label.notes", "Notes")}" style="height:70px"></textarea>
        <label>${t("label.notes", "Notes")}</label>
      </div>
      ${this.#renderErrors(errors)}
    `;
  }

  render() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    return html`
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><i class="bi bi-shield-plus me-1"></i>${t("section.vaccinations", "Vaccinations")}</span>
          <button class="btn btn-primary btn-sm" @click=${this.#openAdd}><i class="bi bi-plus-lg"></i></button>
        </div>
        <div>
          ${this._items.length ? html`
            <ul class="list-group list-group-flush">
              ${this._items.map((item) => html`
                <li class="list-group-item d-flex align-items-start gap-3 py-2">
                  <div class="flex-grow-1">
                    <span class="fw-semibold">${item.Name}</span>
                    ${item.DateOfVaccinationUtc ? html`<span class="text-muted small ms-2">${formatDate(item.DateOfVaccinationUtc)}</span>` : ""}
                    ${item.DoctorId ? html`<div class="text-muted small"><i class="bi bi-person-badge me-1"></i>${this.#doctorLabel(item.DoctorId)}</div>` : ""}
                    ${item.Notes ? html`<div class="text-muted small fst-italic">${item.Notes}</div>` : ""}
                  </div>
                  <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-secondary" @click=${() => this.#openEdit(item)}><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" @click=${() => this.#confirmDelete(item)}><i class="bi bi-trash"></i></button>
                  </div>
                </li>`)}
            </ul>` : html`<p class="text-muted p-3 mb-0">${t("vax.none", "No vaccinations.")}</p>`}
        </div>
      </div>

      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="vaxAddModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">${t("vax.add", "Add Vaccination")}</h5></div>
            <div class="modal-body">${this.#renderModalBody("vaxAdd", this._addErrors)}</div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal" ?disabled=${this._addSaving}>${t("btn.cancel", "Cancel")}</button>
              <button class="btn btn-primary" @click=${this.#submitAdd} ?disabled=${this._addSaving}>
                ${this._addSaving ? html`<span class="spinner-border spinner-border-sm me-1"></span>${t("btn.saving", "Saving…")}` : html`<i class="bi bi-check-lg me-1"></i>${t("btn.save", "Save")}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="vaxEditModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">${t("vax.edit", "Edit Vaccination")}</h5></div>
            <div class="modal-body">
              <input type="hidden" id="vaxEditId" />
              ${this.#renderModalBody("vaxEdit", this._editErrors)}
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal" ?disabled=${this._editSaving}>${t("btn.cancel", "Cancel")}</button>
              <button class="btn btn-primary" @click=${this.#submitEdit} ?disabled=${this._editSaving}>
                ${this._editSaving ? html`<span class="spinner-border spinner-border-sm me-1"></span>${t("btn.saving", "Saving…")}` : html`<i class="bi bi-check-lg me-1"></i>${t("btn.save", "Save")}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define("mh-vaccinations", MhVaccinations);
