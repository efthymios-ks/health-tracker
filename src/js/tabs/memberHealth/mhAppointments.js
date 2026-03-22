import { LitElement, html } from "../../../lib/lit.min.js";
import { showConfirm } from "../../confirm.js";
import { state } from "../../state.js";
import { formatDate, nowDatetimeLocal, toDatetimeLocal } from "../../utils.js";
import "../../components/doctorSelector.js";

class MhAppointments extends LitElement {
  static properties = {
    _items:      { state: true },
    _expandedId: { state: true },
    _addSaving:  { state: true },
    _editSaving: { state: true },
    _addErrors:  { state: true },
    _editErrors: { state: true },
  };

  #memberId = "";

  constructor() {
    super();
    this._items      = [];
    this._expandedId = null;
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
    this._items = state.allDoctorAppointments.filter((a) => a.MemberId === memberId);
  }

  async #reload() {
    try { await window.api.loadAll(); } catch (e) { alert(e.message); }
    this.load(this.#memberId);
  }

  #doctorLabel(doctorId) {
    const doctor = state.allDoctors.find((d) => d.Id === doctorId);
    if (!doctor) { return ""; }
    const lang = window.localization.getLanguage();
    const specialty = lang === "el" ? (doctor.SpecialtyEl || doctor.SpecialtyEn || "") : (doctor.SpecialtyEn || "");
    return specialty ? `${doctor.FullName} — ${specialty}` : doctor.FullName;
  }

  #doctorName(doctorId) {
    return state.allDoctors.find((d) => d.Id === doctorId)?.FullName ?? "";
  }

  #doctorSpecialty(doctorId) {
    const doctor = state.allDoctors.find((d) => d.Id === doctorId);
    if (!doctor) { return ""; }
    const lang = window.localization.getLanguage();
    return lang === "el" ? (doctor.SpecialtyEl || doctor.SpecialtyEn || "") : (doctor.SpecialtyEn || "");
  }

  #openAdd() {
    this._addErrors = [];
    this._addSaving = false;
    bootstrap.Modal.getOrCreateInstance(this.querySelector("#apptAddModal")).show();
    this.updateComplete.then(() => {
      this.querySelector("#apptAddDate").value = nowDatetimeLocal();
      this.querySelector("#apptAddReason").value = "";
      this.querySelector("#apptAddNotes").value = "";
      this.querySelector("#apptAddDoctorSel")?.reset();
    });
  }

  #openEdit(item) {
    this._editErrors = [];
    this._editSaving = false;
    bootstrap.Modal.getOrCreateInstance(this.querySelector("#apptEditModal")).show();
    this.updateComplete.then(() => {
      this.querySelector("#apptEditId").value = item.Id;
      this.querySelector("#apptEditDate").value = toDatetimeLocal(item.DateOfAppointmentUtc);
      this.querySelector("#apptEditReason").value = item.ReasonOfAppointment || "";
      this.querySelector("#apptEditNotes").value = item.Notes || "";
      this.querySelector("#apptEditDoctorSel")?.reset(item.DoctorId || "");
    });
  }

  async #submitAdd() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const date     = this.querySelector("#apptAddDate").value;
    const reason   = this.querySelector("#apptAddReason").value.trim();
    const doctorId = this.querySelector("#apptAddDoctorSel")?.selectedDoctorId ?? "";
    const errors   = [];
    if (!date)     { errors.push(t("error.required-date",   "Date is required.")); }
    if (!doctorId) { errors.push(t("error.required-doctor", "Doctor is required.")); }
    if (errors.length) { this._addErrors = errors; return; }
    this._addErrors = [];
    this._addSaving = true;
    try {
      await window.api.addDoctorAppointment({
        MemberId:             this.#memberId,
        DoctorId:             doctorId,
        DateOfAppointmentUtc: new Date(date).toISOString(),
        ReasonOfAppointment:  reason,
        Notes:                this.querySelector("#apptAddNotes").value.trim(),
      });
      bootstrap.Modal.getInstance(this.querySelector("#apptAddModal")).hide();
      await this.#reload();
    } catch (e) {
      this._addErrors = [e.message];
    } finally {
      this._addSaving = false;
    }
  }

  async #submitEdit() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const id       = this.querySelector("#apptEditId").value;
    const date     = this.querySelector("#apptEditDate").value;
    const reason   = this.querySelector("#apptEditReason").value.trim();
    const doctorId = this.querySelector("#apptEditDoctorSel")?.selectedDoctorId ?? "";
    const errors   = [];
    if (!date)     { errors.push(t("error.required-date",   "Date is required.")); }
    if (!doctorId) { errors.push(t("error.required-doctor", "Doctor is required.")); }
    if (errors.length) { this._editErrors = errors; return; }
    this._editErrors = [];
    this._editSaving = true;
    try {
      await window.api.updateDoctorAppointment(id, {
        MemberId:             this.#memberId,
        DoctorId:             doctorId,
        DateOfAppointmentUtc: new Date(date).toISOString(),
        ReasonOfAppointment:  reason,
        Notes:                this.querySelector("#apptEditNotes").value.trim(),
      });
      bootstrap.Modal.getInstance(this.querySelector("#apptEditModal")).hide();
      await this.#reload();
    } catch (e) {
      this._editErrors = [e.message];
    } finally {
      this._editSaving = false;
    }
  }

  #confirmDelete(item) {
    showConfirm("Delete Appointment", "Delete this appointment?", "Delete", "btn-danger", (done) => {
      window.api.deleteDoctorAppointment(item.Id).then(() => { done(); this.#reload(); }).catch((e) => { done(); alert(e.message); });
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
        <input type="datetime-local" id="${prefix}Date" class="form-control" placeholder="${t("appt.date", "Date")}" />
        <label>${t("appt.date", "Date")}</label>
      </div>
      <doctor-selector id="${prefix}DoctorSel"></doctor-selector>
      <div class="form-floating mb-3">
        <textarea id="${prefix}Reason" class="form-control" placeholder="${t("appt.reason", "Reason")}" style="height:80px"></textarea>
        <label>${t("appt.reason", "Reason")}</label>
      </div>
      <div class="form-floating mb-3">
        <textarea id="${prefix}Notes" class="form-control" placeholder="${t("label.notes", "Notes")}" style="height:80px"></textarea>
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
          <span><i class="bi bi-calendar-check me-1"></i>${t("section.appointments", "Appointments")}</span>
          <button class="btn btn-primary btn-sm" @click=${this.#openAdd}><i class="bi bi-plus-lg"></i></button>
        </div>
        <div>
          ${this._items.length ? html`
            <ul class="list-group list-group-flush">
              ${this._items.map((item) => {
                const expanded = this._expandedId === item.Id;
                const toggle   = () => { this._expandedId = expanded ? null : item.Id; };
                const specialty = item.DoctorId ? this.#doctorSpecialty(item.DoctorId) : "";
                return html`
                  <li class="list-group-item p-0">
                    <div class="d-flex align-items-center gap-2 px-3 py-2" style="cursor:pointer" @click=${toggle}>
                      <i class="bi bi-chevron-${expanded ? "down" : "right"} text-muted small"></i>
                      <div class="flex-grow-1 d-flex align-items-center gap-2 flex-wrap">
                        <span class="fw-semibold">${formatDate(item.DateOfAppointmentUtc)}</span>
                        ${item.DoctorId ? html`<span class="text-muted small"><i class="bi bi-person-badge me-1"></i>${this.#doctorName(item.DoctorId)}</span>` : ""}
                        ${specialty ? html`<span class="badge bg-primary-subtle text-primary-emphasis">${specialty}</span>` : ""}
                      </div>
                      <div class="d-flex gap-1" @click=${(e) => e.stopPropagation()}>
                        <button class="btn btn-sm btn-outline-secondary" @click=${() => this.#openEdit(item)}><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger" @click=${() => this.#confirmDelete(item)}><i class="bi bi-trash"></i></button>
                      </div>
                    </div>
                    ${expanded ? html`
                      <div class="px-4 pb-2 border-top pt-2 text-muted small">
                        ${item.ReasonOfAppointment ? html`<div>${item.ReasonOfAppointment}</div>` : ""}
                        ${item.Notes ? html`<div class="fst-italic">${item.Notes}</div>` : ""}
                      </div>` : ""}
                  </li>`;
              })}
            </ul>` : html`<p class="text-muted p-3 mb-0">${t("appt.none", "No appointments.")}</p>`}
        </div>
      </div>

      <!-- Add Modal -->
      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="apptAddModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">${t("appt.add", "Add Appointment")}</h5></div>
            <div class="modal-body">${this.#renderModalBody("apptAdd", this._addErrors)}</div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal" ?disabled=${this._addSaving}>${t("btn.cancel", "Cancel")}</button>
              <button class="btn btn-primary" @click=${this.#submitAdd} ?disabled=${this._addSaving}>
                ${this._addSaving ? html`<span class="spinner-border spinner-border-sm me-1"></span>${t("btn.saving", "Saving…")}` : html`<i class="bi bi-check-lg me-1"></i>${t("btn.save", "Save")}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Edit Modal -->
      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="apptEditModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">${t("appt.edit", "Edit Appointment")}</h5></div>
            <div class="modal-body">
              <input type="hidden" id="apptEditId" />
              ${this.#renderModalBody("apptEdit", this._editErrors)}
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

customElements.define("mh-appointments", MhAppointments);
