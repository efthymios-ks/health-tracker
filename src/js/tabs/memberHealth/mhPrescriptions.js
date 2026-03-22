import { LitElement, html } from "../../../lib/lit.min.js";
import { showConfirm } from "../../confirm.js";
import { state } from "../../state.js";
import { formatDate, todayStr } from "../../utils.js";
import "../../components/doctorSelector.js";

class MhPrescriptions extends LitElement {
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
    this._items      = [];
    this._addSaving  = false;
    this._editSaving = false;
    this._addErrors  = [];
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
    this._items = state.allPrescriptions.filter((rx) => rx.MemberId === memberId);
  }

  async #reload() {
    try { await window.api.loadAll(); } catch (e) { alert(e.message); }
    this.load(this.#memberId);
  }

  #isActive(rx) {
    const today = new Date().toISOString().substring(0, 10);
    return !rx.DateEnded || rx.DateEnded >= today;
  }

  #openAdd() {
    this._addErrors = [];
    this._addSaving = false;
    bootstrap.Modal.getOrCreateInstance(this.querySelector("#rxAddModal")).show();
    this.updateComplete.then(() => {
      this.querySelector("#rxAddMedication").value = "";
      this.querySelector("#rxAddDosage").value     = "";
      this.querySelector("#rxAddFrequency").value  = "";
      this.querySelector("#rxAddStartDate").value  = todayStr();
      this.querySelector("#rxAddEndDate").value    = "";
      this.querySelector("#rxAddNotes").value      = "";
      this.querySelector("#rxAddDoctorSel")?.reset();
    });
  }

  #openEdit(item) {
    this._editErrors = [];
    this._editSaving = false;
    bootstrap.Modal.getOrCreateInstance(this.querySelector("#rxEditModal")).show();
    this.updateComplete.then(() => {
      this.querySelector("#rxEditId").value         = item.Id;
      this.querySelector("#rxEditMedication").value = item.MedicationName || "";
      this.querySelector("#rxEditDosage").value     = item.Dosage || "";
      this.querySelector("#rxEditFrequency").value  = item.Frequency || "";
      this.querySelector("#rxEditStartDate").value  = item.DateStarted || "";
      this.querySelector("#rxEditEndDate").value    = item.DateEnded || "";
      this.querySelector("#rxEditNotes").value      = item.Notes || "";
      this.querySelector("#rxEditDoctorSel")?.reset(item.DoctorId || "");
    });
  }

  #collectData(prefix) {
    return {
      MemberId:             this.#memberId,
      DoctorId: this.querySelector(`#${prefix}DoctorSel`)?.selectedDoctorId ?? "",
      MedicationName:       this.querySelector(`#${prefix}Medication`).value.trim(),
      Dosage:               this.querySelector(`#${prefix}Dosage`).value.trim(),
      Frequency:            this.querySelector(`#${prefix}Frequency`).value.trim(),
      DateStarted:          this.querySelector(`#${prefix}StartDate`).value,
      DateEnded:            this.querySelector(`#${prefix}EndDate`).value,
      Notes:                this.querySelector(`#${prefix}Notes`).value.trim(),
    };
  }

  async #submitAdd() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const data   = this.#collectData("rxAdd");
    const errors = [];
    if (!data.MedicationName)       { errors.push(t("error.required-medication", "Medication name is required.")); }
    if (!data.DoctorId) { errors.push(t("error.required-doctor",     "Doctor is required.")); }
    if (!data.DateStarted)          { errors.push(t("error.required-date",        "Date is required.")); }
    if (errors.length) { this._addErrors = errors; return; }
    this._addErrors = [];
    this._addSaving = true;
    try {
      await window.api.addPrescription(data);
      bootstrap.Modal.getInstance(this.querySelector("#rxAddModal")).hide();
      await this.#reload();
    } catch (e) {
      this._addErrors = [e.message];
    } finally {
      this._addSaving = false;
    }
  }

  async #submitEdit() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const id     = this.querySelector("#rxEditId").value;
    const data   = this.#collectData("rxEdit");
    const errors = [];
    if (!data.MedicationName)       { errors.push(t("error.required-medication", "Medication name is required.")); }
    if (!data.DoctorId) { errors.push(t("error.required-doctor",     "Doctor is required.")); }
    if (!data.DateStarted)          { errors.push(t("error.required-date",        "Date is required.")); }
    if (errors.length) { this._editErrors = errors; return; }
    this._editErrors = [];
    this._editSaving = true;
    try {
      await window.api.updatePrescription(id, data);
      bootstrap.Modal.getInstance(this.querySelector("#rxEditModal")).hide();
      await this.#reload();
    } catch (e) {
      this._editErrors = [e.message];
    } finally {
      this._editSaving = false;
    }
  }

  #confirmDelete(item) {
    showConfirm("Delete Prescription", `Delete ${item.MedicationName}?`, "Delete", "btn-danger", (done) => {
      window.api.deletePrescription(item.Id).then(() => { done(); this.#reload(); }).catch((e) => { done(); alert(e.message); });
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
        <input type="text" id="${prefix}Medication" class="form-control" placeholder="${t("rx.medication", "Medication Name")}" />
        <label>${t("rx.medication", "Medication Name")}</label>
      </div>
      <div class="row g-2 mb-3">
        <div class="col-6">
          <div class="form-floating">
            <input type="text" id="${prefix}Dosage" class="form-control" placeholder="${t("rx.dosage", "Dosage")}" />
            <label>${t("rx.dosage", "Dosage")}</label>
          </div>
        </div>
        <div class="col-6">
          <div class="form-floating">
            <input type="text" id="${prefix}Frequency" class="form-control" placeholder="${t("rx.frequency", "Frequency")}" />
            <label>${t("rx.frequency", "Frequency")}</label>
          </div>
        </div>
      </div>
      <doctor-selector id="${prefix}DoctorSel"
        .labelKey=${"rx.prescribed-by"} .labelFallback=${"Prescribed By"}></doctor-selector>
      <div class="row g-2 mb-3">
        <div class="col-6">
          <div class="form-floating">
            <input type="date" id="${prefix}StartDate" class="form-control" placeholder="${t("rx.start-date", "Start Date")}" />
            <label>${t("rx.start-date", "Start Date")}</label>
          </div>
        </div>
        <div class="col-6">
          <div class="form-floating">
            <input type="date" id="${prefix}EndDate" class="form-control" placeholder="${t("rx.end-date", "End Date")}" />
            <label>${t("rx.end-date", "End Date")}</label>
          </div>
        </div>
      </div>
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
          <span><i class="bi bi-capsule me-1"></i>${t("section.prescriptions", "Prescriptions")}</span>
          <button class="btn btn-primary btn-sm" @click=${this.#openAdd}><i class="bi bi-plus-lg"></i></button>
        </div>
        <div>
          ${this._items.length ? html`
            <ul class="list-group list-group-flush">
              ${this._items.map((item) => html`
                <li class="list-group-item d-flex align-items-start gap-3 py-2">
                  <div class="flex-grow-1">
                    <div class="d-flex align-items-center gap-2">
                      <span class="fw-semibold">${item.MedicationName}</span>
                      ${this.#isActive(item) ? html`<span class="badge bg-success-subtle text-success-emphasis">${t("rx.active", "Active")}</span>` : html`<span class="badge bg-secondary-subtle text-secondary-emphasis">${t("rx.ended", "Ended")}</span>`}
                    </div>
                    ${item.Dosage || item.Frequency ? html`<div class="text-muted small">${item.Dosage}${item.Frequency ? ` — ${item.Frequency}` : ""}</div>` : ""}
                    <div class="text-muted small">
                      ${item.DateStarted ? html`<span>${formatDate(item.DateStarted)}</span>` : ""}
                      ${item.DateEnded ? html`<span> → ${formatDate(item.DateEnded)}</span>` : ""}
                    </div>
                  </div>
                  <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-secondary" @click=${() => this.#openEdit(item)}><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" @click=${() => this.#confirmDelete(item)}><i class="bi bi-trash"></i></button>
                  </div>
                </li>`)}
            </ul>` : html`<p class="text-muted p-3 mb-0">${t("rx.none", "No prescriptions.")}</p>`}
        </div>
      </div>

      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="rxAddModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">${t("rx.add", "Add Prescription")}</h5></div>
            <div class="modal-body">${this.#renderModalBody("rxAdd", this._addErrors)}</div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal" ?disabled=${this._addSaving}>${t("btn.cancel", "Cancel")}</button>
              <button class="btn btn-primary" @click=${this.#submitAdd} ?disabled=${this._addSaving}>
                ${this._addSaving ? html`<span class="spinner-border spinner-border-sm me-1"></span>${t("btn.saving", "Saving…")}` : html`<i class="bi bi-check-lg me-1"></i>${t("btn.save", "Save")}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="rxEditModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">${t("rx.edit", "Edit Prescription")}</h5></div>
            <div class="modal-body">
              <input type="hidden" id="rxEditId" />
              ${this.#renderModalBody("rxEdit", this._editErrors)}
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

customElements.define("mh-prescriptions", MhPrescriptions);
