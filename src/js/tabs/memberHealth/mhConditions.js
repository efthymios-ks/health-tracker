import { LitElement, html } from "../../../lib/lit.min.js";
import { showConfirm } from "../../confirm.js";
import { state } from "../../state.js";
import { formatDate, todayStr } from "../../utils.js";
import "../../components/doctorSelector.js";
import "../../components/conditionSelector.js";

class MhConditions extends LitElement {
  static properties = {
    _items:       { state: true },
    _addSaving:   { state: true },
    _editSaving:  { state: true },
    _addErrors:   { state: true },
    _editErrors:  { state: true },
    _addApptId:   { state: true },
    _editApptId:  { state: true },
    _expandedId:  { state: true },
  };

  #memberId = "";

  constructor() {
    super();
    this._items      = [];
    this._addSaving  = false;
    this._editSaving = false;
    this._addErrors  = [];
    this._editErrors = [];
    this._addApptId  = "";
    this._editApptId = "";
    this._expandedId = null;
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
    this._items = state.allDiagnoses.filter((d) => d.MemberId === memberId);
  }

  async #reload() {
    try { await window.api.loadAll(); } catch (e) { alert(e.message); }
    this.load(this.#memberId);
  }

  #conditionName(conditionId) {
    const lang = window.localization.getLanguage();
    const cond = state.allMedicalConditions.find((c) => c.Id === conditionId);
    if (!cond) { return conditionId || "—"; }
    return lang === "el" ? (cond.El || cond.En) : cond.En;
  }

  #doctorLabel(doctorId) {
    const lang = window.localization.getLanguage();
    const doctor = state.allDoctors.find((d) => d.Id === doctorId);
    if (!doctor) { return ""; }
    const specialty = lang === "el" ? (doctor.SpecialtyEl || doctor.SpecialtyEn || "") : (doctor.SpecialtyEn || "");
    return specialty ? `${doctor.FullName} — ${specialty}` : doctor.FullName;
  }

  #apptLabel(appt) {
    const lang    = window.localization.getLanguage();
    const doctor  = state.allDoctors.find((d) => d.Id === appt.DoctorId);
    if (!doctor) { return formatDate(appt.DateOfAppointmentUtc); }
    const specialty = lang === "el" ? (doctor.SpecialtyEl || doctor.SpecialtyEn || "") : (doctor.SpecialtyEn || "");
    const doctorStr = specialty ? `${doctor.FullName} — ${specialty}` : doctor.FullName;
    return `${formatDate(appt.DateOfAppointmentUtc)} · ${doctorStr}`;
  }

  #memberAppts() {
    return state.allDoctorAppointments.filter((a) => a.MemberId === this.#memberId);
  }

  #openAdd() {
    this._addErrors = [];
    this._addSaving = false;
    this._addApptId = "";
    bootstrap.Modal.getOrCreateInstance(this.querySelector("#condAddModal")).show();
    this.updateComplete.then(() => {
      this.querySelector("#condAddConditionSel")?.reset();
      this.querySelector("#condAddSymptoms").value        = "";
      this.querySelector("#condAddAppt").value            = "";
      this.querySelector("#condAddDateDiagnosed").value   = todayStr();
      this.querySelector("#condAddDateResolved").value    = "";
      this.querySelector("#condAddDoctorSel")?.reset();
    });
  }

  #openEdit(item) {
    this._editErrors = [];
    this._editSaving = false;
    this._editApptId = item.AppointmentId || "";
    bootstrap.Modal.getOrCreateInstance(this.querySelector("#condEditModal")).show();
    this.updateComplete.then(() => {
      this.querySelector("#condEditId").value             = item.Id;
      this.querySelector("#condEditConditionSel")?.reset(item.MedicalConditionId || "");
      this.querySelector("#condEditSymptoms").value       = item.Symptoms || "";
      this.querySelector("#condEditAppt").value           = item.AppointmentId || "";
      this.querySelector("#condEditDateDiagnosed").value  = item.DateDiagnosed || "";
      this.querySelector("#condEditDateResolved").value   = item.DateResolved || "";
      if (!item.AppointmentId) {
        this.querySelector("#condEditDoctorSel")?.reset(item.DiagnosedByDoctorId || "");
      }
    });
  }

  #collectData(prefix, apptId) {
    const val = (id) => this.querySelector(`#${id}`).value;
    const appt = apptId ? state.allDoctorAppointments.find((a) => a.Id === apptId) : null;
    const doctorId = appt
      ? (appt.DoctorId || "")
      : (this.querySelector(`#${prefix}DoctorSel`)?.selectedDoctorId ?? "");
    return {
      MemberId:           this.#memberId,
      MedicalConditionId: this.querySelector(`#${prefix}ConditionSel`)?.selectedConditionId ?? "",
      Symptoms:           val(`${prefix}Symptoms`).trim(),
      AppointmentId:      apptId || "",
      DiagnosedByDoctorId: doctorId,
      DateDiagnosed:      val(`${prefix}DateDiagnosed`),
      DateResolved:       val(`${prefix}DateResolved`),
    };
  }

  async #submitAdd() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const data = this.#collectData("condAdd", this._addApptId);
    const errors = [];
    if (!data.MedicalConditionId) { errors.push(t("error.required-condition", "Medical condition is required.")); }
    if (!data.DateDiagnosed)      { errors.push(t("error.required-date", "Date is required.")); }
    if (errors.length) { this._addErrors = errors; return; }
    this._addErrors = [];
    this._addSaving = true;
    try {
      await window.api.addDiagnosis(data);
      bootstrap.Modal.getInstance(this.querySelector("#condAddModal")).hide();
      await this.#reload();
    } catch (e) {
      this._addErrors = [e.message];
    } finally {
      this._addSaving = false;
    }
  }

  async #submitEdit() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const id   = this.querySelector("#condEditId").value;
    const data = this.#collectData("condEdit", this._editApptId);
    const errors = [];
    if (!data.MedicalConditionId) { errors.push(t("error.required-condition", "Medical condition is required.")); }
    if (!data.DateDiagnosed)      { errors.push(t("error.required-date", "Date is required.")); }
    if (errors.length) { this._editErrors = errors; return; }
    this._editErrors = [];
    this._editSaving = true;
    try {
      await window.api.updateDiagnosis(id, data);
      bootstrap.Modal.getInstance(this.querySelector("#condEditModal")).hide();
      await this.#reload();
    } catch (e) {
      this._editErrors = [e.message];
    } finally {
      this._editSaving = false;
    }
  }

  #confirmDelete(item) {
    showConfirm("Delete Condition", `Delete ${this.#conditionName(item.MedicalConditionId)}?`, "Delete", "btn-danger", (done) => {
      window.api.deleteDiagnosis(item.Id).then(() => { done(); this.#reload(); }).catch((e) => { done(); alert(e.message); });
    });
  }

  #renderErrors(errors) {
    if (!errors.length) { return ""; }
    return html`<div class="alert alert-danger py-2 mb-0 mt-2"><ul class="mb-0 ps-3">${errors.map((m) => html`<li>${m}</li>`)}</ul></div>`;
  }

  #renderModalBody(prefix, apptId, onApptChange, errors) {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const memberAppts = this.#memberAppts();
    const lockedAppt  = apptId ? state.allDoctorAppointments.find((a) => a.Id === apptId) : null;

    return html`
      <condition-selector id="${prefix}ConditionSel"></condition-selector>
      <div class="form-floating mb-3">
        <textarea id="${prefix}Symptoms" class="form-control" placeholder="${t("cond.symptoms", "Symptoms")}" style="height:70px"></textarea>
        <label>${t("cond.symptoms", "Symptoms")}</label>
      </div>
      <div class="form-floating mb-3">
        <select id="${prefix}Appt" class="form-select" @change=${onApptChange}>
          <option value="">—</option>
          ${memberAppts.map((a) => html`<option value="${a.Id}" .selected=${a.Id === apptId}>${this.#apptLabel(a)}</option>`)}
        </select>
        <label><i class="bi bi-calendar-check me-1"></i>${t("cond.appointment", "Appointment")}</label>
      </div>
      ${lockedAppt
        ? html`
          <div class="mb-3 px-2 py-2 border rounded text-muted small">
            <i class="bi bi-person-badge me-1"></i>${this.#doctorLabel(lockedAppt.DoctorId)}
          </div>`
        : html`
          <doctor-selector id="${prefix}DoctorSel"
            .labelKey=${"cond.diagnosed-by"} .labelFallback=${"Diagnosed By"}
            .optional=${true}></doctor-selector>`}
      <div class="row g-2 mb-3">
        <div class="col-6">
          <div class="form-floating">
            <input type="date" id="${prefix}DateDiagnosed" class="form-control" placeholder="${t("cond.date-diagnosed", "Date Diagnosed")}" />
            <label>${t("cond.date-diagnosed", "Date Diagnosed")}</label>
          </div>
        </div>
        <div class="col-6">
          <div class="form-floating">
            <input type="date" id="${prefix}DateResolved" class="form-control" placeholder="${t("cond.date-resolved", "Date Resolved")}" />
            <label>${t("cond.date-resolved", "Date Resolved")}</label>
          </div>
        </div>
      </div>
      ${this.#renderErrors(errors)}
    `;
  }

  render() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;

    const onAddApptChange  = (e) => { this._addApptId  = e.target.value; };
    const onEditApptChange = (e) => { this._editApptId = e.target.value; };

    return html`
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><i class="bi bi-heart-pulse me-1"></i>${t("section.conditions", "Conditions")}</span>
          <button class="btn btn-primary btn-sm" @click=${this.#openAdd}><i class="bi bi-plus-lg"></i></button>
        </div>
        <div>
          ${this._items.length ? html`
            <ul class="list-group list-group-flush">
              ${this._items.map((item) => {
                const expanded = this._expandedId === item.Id;
                const toggle   = () => { this._expandedId = expanded ? null : item.Id; };
                return html`
                  <li class="list-group-item p-0">
                    <div class="d-flex align-items-center gap-2 px-3 py-2" style="cursor:pointer" @click=${toggle}>
                      <i class="bi bi-chevron-${expanded ? "down" : "right"} text-muted small"></i>
                      <div class="flex-grow-1 d-flex align-items-center gap-2">
                        <span class="fw-semibold">${this.#conditionName(item.MedicalConditionId)}</span>
                        ${(!item.DateResolved || item.DateResolved > todayStr())
                          ? html`<span class="badge bg-warning-subtle text-warning-emphasis">${t("cond.active", "Active")}</span>`
                          : html`<span class="badge bg-secondary-subtle text-secondary-emphasis">${t("cond.resolved", "Resolved")}</span>`}
                      </div>
                      <div class="d-flex gap-1" @click=${(e) => e.stopPropagation()}>
                        <button class="btn btn-sm btn-outline-secondary" @click=${() => this.#openEdit(item)}><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger" @click=${() => this.#confirmDelete(item)}><i class="bi bi-trash"></i></button>
                      </div>
                    </div>
                    ${expanded ? html`
                      <div class="px-4 pb-2 border-top pt-2 text-muted small">
                        ${item.Symptoms ? html`<div>${item.Symptoms}</div>` : ""}
                        <div>
                          ${item.DateDiagnosed ? html`<span>${formatDate(item.DateDiagnosed)}</span>` : ""}
                          ${item.DateResolved  ? html`<span> → ${formatDate(item.DateResolved)}</span>` : ""}
                        </div>
                        ${item.DiagnosedByDoctorId ? html`<div><i class="bi bi-person-badge me-1"></i>${this.#doctorLabel(item.DiagnosedByDoctorId)}</div>` : ""}
                      </div>` : ""}
                  </li>`;
              })}
            </ul>` : html`<p class="text-muted p-3 mb-0">${t("cond.none", "No conditions.")}</p>`}
        </div>
      </div>

      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="condAddModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">${t("cond.add", "Add Condition")}</h5></div>
            <div class="modal-body">${this.#renderModalBody("condAdd", this._addApptId, onAddApptChange, this._addErrors)}</div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal" ?disabled=${this._addSaving}>${t("btn.cancel", "Cancel")}</button>
              <button class="btn btn-primary" @click=${this.#submitAdd} ?disabled=${this._addSaving}>
                ${this._addSaving ? html`<span class="spinner-border spinner-border-sm me-1"></span>${t("btn.saving", "Saving…")}` : html`<i class="bi bi-check-lg me-1"></i>${t("btn.save", "Save")}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="condEditModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">${t("cond.edit", "Edit Condition")}</h5></div>
            <div class="modal-body">
              <input type="hidden" id="condEditId" />
              ${this.#renderModalBody("condEdit", this._editApptId, onEditApptChange, this._editErrors)}
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

customElements.define("mh-conditions", MhConditions);
