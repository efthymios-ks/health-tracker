import { LitElement, html } from "../../../lib/lit.min.js";
import { showConfirm } from "../../confirm.js";
import { state } from "../../state.js";
import { formatDate, todayStr } from "../../utils.js";

class MhVitals extends LitElement {
  static properties = {
    _items:            { state: true },
    _addSaving:        { state: true },
    _editSaving:       { state: true },
    _addErrors:        { state: true },
    _editErrors:       { state: true },
    _addMeasurements:  { state: true },
    _editMeasurements: { state: true },
    _expandedId:       { state: true },
  };

  #memberId = "";

  constructor() {
    super();
    this._items = [];
    this._addSaving = false;
    this._editSaving = false;
    this._addErrors = [];
    this._editErrors = [];
    this._addMeasurements = [];
    this._editMeasurements = [];
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
    this._items = state.allVitalSigns.filter((v) => v.MemberId === memberId);
  }

  async #reload() {
    try { await window.api.loadAll(); } catch (e) { alert(e.message); }
    this.load(this.#memberId);
  }

  // Collect unique past measurement names and units from this member's vitals
  #pastNames() {
    const names = new Set();
    for (const item of this._items) {
      for (const m of (item.ExtraMeasurementsJson || [])) {
        if (m.name) { names.add(m.name); }
      }
    }
    return [...names];
  }

  #pastUnits() {
    const units = new Set();
    for (const item of this._items) {
      for (const m of (item.ExtraMeasurementsJson || [])) {
        if (m.unit) { units.add(m.unit); }
      }
    }
    return [...units];
  }

  #mfValidate(rows) {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    for (const row of rows) {
      const hasName = row.name.trim() !== "";
      const hasValue = row.value.trim() !== "";
      if (hasName && !hasValue) { return t("error.mf-missing-value", `"${row.name.trim()}" is missing a value.`).replace("{name}", row.name.trim()); }
      if (!hasName && hasValue) { return t("error.mf-missing-name", `A measurement with value "${row.value.trim()}" is missing a name.`).replace("{value}", row.value.trim()); }
    }
    return null;
  }

  #mfToArray(rows) {
    return rows
      .filter((row) => row.name.trim() && row.value.trim())
      .map((row) => ({ name: row.name.trim(), value: row.value.trim(), unit: row.unit.trim() }));
  }

  #openAdd() {
    this._addErrors = [];
    this._addSaving = false;
    this._addMeasurements = [];
    bootstrap.Modal.getOrCreateInstance(this.querySelector("#vitalAddModal")).show();
    this.updateComplete.then(() => {
      this.querySelector("#vitalAddDate").value = todayStr();
      this.querySelector("#vitalAddWeight").value = "";
      this.querySelector("#vitalAddHeight").value = "";
      this.querySelector("#vitalAddNotes").value = "";
    });
  }

  #openEdit(item) {
    this._editErrors = [];
    this._editSaving = false;
    this._editMeasurements = (item.ExtraMeasurementsJson || []).map((m) => ({ name: m.name || "", value: m.value || "", unit: m.unit || "" }));
    bootstrap.Modal.getOrCreateInstance(this.querySelector("#vitalEditModal")).show();
    this.updateComplete.then(() => {
      this.querySelector("#vitalEditId").value = item.Id;
      this.querySelector("#vitalEditDate").value = item.DateOfMeasurementUtc || "";
      this.querySelector("#vitalEditWeight").value = item.WeightKg ?? "";
      this.querySelector("#vitalEditHeight").value = item.HeightCm ?? "";
      this.querySelector("#vitalEditNotes").value = item.Notes || "";
    });
  }

  async #submitAdd() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const date   = this.querySelector("#vitalAddDate").value;
    const weight = this.querySelector("#vitalAddWeight").value;
    const height = this.querySelector("#vitalAddHeight").value;
    const notes  = this.querySelector("#vitalAddNotes").value.trim();
    const errors = [];
    if (!date) { errors.push(t("error.required-date", "Date is required.")); }
    const mfError = this.#mfValidate(this._addMeasurements);
    if (mfError) { errors.push(mfError); }
    const measurements = this.#mfToArray(this._addMeasurements);
    if (!weight && !height && !measurements.length) { errors.push(t("error.required-vital-measurement", "At least one measurement is required.")); }
    if (errors.length) { this._addErrors = errors; return; }
    this._addErrors = [];
    this._addSaving = true;
    try {
      await window.api.addVitalSigns({ MemberId: this.#memberId, DateOfMeasurementUtc: date, WeightKg: weight || "", HeightCm: height || "", ExtraMeasurementsJson: measurements, Notes: notes });
      bootstrap.Modal.getInstance(this.querySelector("#vitalAddModal")).hide();
      await this.#reload();
    } catch (e) {
      this._addErrors = [e.message];
    } finally {
      this._addSaving = false;
    }
  }

  async #submitEdit() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const id     = this.querySelector("#vitalEditId").value;
    const date   = this.querySelector("#vitalEditDate").value;
    const weight = this.querySelector("#vitalEditWeight").value;
    const height = this.querySelector("#vitalEditHeight").value;
    const notes  = this.querySelector("#vitalEditNotes").value.trim();
    const errors = [];
    if (!date) { errors.push(t("error.required-date", "Date is required.")); }
    const mfError = this.#mfValidate(this._editMeasurements);
    if (mfError) { errors.push(mfError); }
    const measurements = this.#mfToArray(this._editMeasurements);
    if (!weight && !height && !measurements.length) { errors.push(t("error.required-vital-measurement", "At least one measurement is required.")); }
    if (errors.length) { this._editErrors = errors; return; }
    this._editErrors = [];
    this._editSaving = true;
    try {
      await window.api.updateVitalSigns(id, { MemberId: this.#memberId, DateOfMeasurementUtc: date, WeightKg: weight || "", HeightCm: height || "", ExtraMeasurementsJson: measurements, Notes: notes });
      bootstrap.Modal.getInstance(this.querySelector("#vitalEditModal")).hide();
      await this.#reload();
    } catch (e) {
      this._editErrors = [e.message];
    } finally {
      this._editSaving = false;
    }
  }

  #confirmDelete(item) {
    showConfirm("Delete Vitals", "Delete this vitals record?", "Delete", "btn-danger", (done) => {
      window.api.deleteVitalSigns(item.Id).then(() => { done(); this.#reload(); }).catch((e) => { done(); alert(e.message); });
    });
  }

  #renderErrors(errors) {
    if (!errors.length) { return ""; }
    return html`<div class="alert alert-danger py-2 mb-0 mt-2"><ul class="mb-0 ps-3">${errors.map((m) => html`<li>${m}</li>`)}</ul></div>`;
  }

  #renderMeasurementsEditor(rows, onUpdate, onAdd, onRemove, t) {
    const pastNames = this.#pastNames();
    const pastUnits = this.#pastUnits();
    const namesId = "vital-past-names";
    const unitsId = "vital-past-units";
    return html`
      <datalist id="${namesId}">${pastNames.map((n) => html`<option value="${n}"></option>`)}</datalist>
      <datalist id="${unitsId}">${pastUnits.map((u) => html`<option value="${u}"></option>`)}</datalist>
      <div class="mb-3">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <label class="form-label mb-0 small"><i class="bi bi-activity me-1"></i>${t("vital.extra-measurements", "Extra Measurements")}</label>
          <button type="button" class="btn btn-outline-secondary btn-sm" @click=${onAdd}><i class="bi bi-plus-lg"></i></button>
        </div>
        ${rows.length ? rows.map((row, i) => html`
          <div class="d-flex gap-1 mb-1">
            <input type="text" class="form-control form-control-sm" style="flex:2" .value=${row.name}
              list="${namesId}"
              placeholder="${t("vital.mf-name-placeholder", "Name")}"
              @input=${(e) => onUpdate(i, "name", e.target.value)} />
            <input type="text" class="form-control form-control-sm" style="flex:2" .value=${row.value}
              placeholder="${t("vital.mf-value-placeholder", "Value")}"
              @input=${(e) => onUpdate(i, "value", e.target.value)} />
            <input type="text" class="form-control form-control-sm" style="flex:1" .value=${row.unit}
              list="${unitsId}"
              placeholder="${t("vital.mf-unit-placeholder", "Unit")}"
              @input=${(e) => onUpdate(i, "unit", e.target.value)} />
            <button type="button" class="btn btn-sm btn-outline-danger px-2" @click=${() => onRemove(i)}><i class="bi bi-x-lg"></i></button>
          </div>`)
        : html`<div class="text-muted small">${t("vital.no-extra-measurements", "No extra measurements.")}</div>`}
      </div>
    `;
  }

  #renderModalBody(prefix, measurements, onUpdate, onAdd, onRemove, errors) {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    return html`
      <div class="form-floating mb-3">
        <input type="date" id="${prefix}Date" class="form-control" placeholder="${t("vital.date", "Measurement Date")}" />
        <label>${t("vital.date", "Measurement Date")}</label>
      </div>
      <div class="row g-2 mb-3">
        <div class="col-6">
          <div class="form-floating">
            <input type="number" step="0.1" min="0" id="${prefix}Weight" class="form-control" placeholder="${t("vital.weight", "Weight (kg)")}" />
            <label>${t("vital.weight", "Weight (kg)")}</label>
          </div>
        </div>
        <div class="col-6">
          <div class="form-floating">
            <input type="number" step="0.1" min="0" id="${prefix}Height" class="form-control" placeholder="${t("vital.height", "Height (cm)")}" />
            <label>${t("vital.height", "Height (cm)")}</label>
          </div>
        </div>
      </div>
      ${this.#renderMeasurementsEditor(measurements, onUpdate, onAdd, onRemove, t)}
      <div class="form-floating mb-3">
        <textarea id="${prefix}Notes" class="form-control" placeholder="${t("label.notes", "Notes")}" style="height:70px"></textarea>
        <label>${t("label.notes", "Notes")}</label>
      </div>
      ${this.#renderErrors(errors)}
    `;
  }

  render() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;

    const onAddMfUpdate = (i, field, value) => { this._addMeasurements = this._addMeasurements.map((r, idx) => idx === i ? { ...r, [field]: value } : r); };
    const onAddMfAdd    = () => { this._addMeasurements = [...this._addMeasurements, { name: "", value: "", unit: "" }]; };
    const onAddMfRemove = (i) => { this._addMeasurements = this._addMeasurements.filter((_, idx) => idx !== i); };

    const onEditMfUpdate = (i, field, value) => { this._editMeasurements = this._editMeasurements.map((r, idx) => idx === i ? { ...r, [field]: value } : r); };
    const onEditMfAdd    = () => { this._editMeasurements = [...this._editMeasurements, { name: "", value: "", unit: "" }]; };
    const onEditMfRemove = (i) => { this._editMeasurements = this._editMeasurements.filter((_, idx) => idx !== i); };

    return html`
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><i class="bi bi-activity me-1"></i>${t("section.vitals", "Vitals")}</span>
          <button class="btn btn-primary btn-sm" @click=${this.#openAdd}><i class="bi bi-plus-lg"></i></button>
        </div>
        <div>
          ${this._items.length ? html`
            <ul class="list-group list-group-flush">
              ${this._items.map((item) => {
                const expanded = this._expandedId === item.Id;
                const toggle = () => { this._expandedId = expanded ? null : item.Id; };
                const measurements = item.ExtraMeasurementsJson || [];
                return html`
                  <li class="list-group-item p-0">
                    <div class="d-flex align-items-center gap-2 px-3 py-2" style="cursor:pointer" @click=${toggle}>
                      <i class="bi bi-chevron-${expanded ? "down" : "right"} text-muted small"></i>
                      <div class="flex-grow-1">
                        <span class="fw-semibold">${formatDate(item.DateOfMeasurementUtc)}</span>
                        <div class="text-muted small d-flex flex-wrap gap-2">
                          ${item.WeightKg != null ? html`<span><i class="bi bi-speedometer me-1"></i>${item.WeightKg} kg</span>` : ""}
                          ${item.HeightCm != null ? html`<span><i class="bi bi-arrow-up me-1"></i>${item.HeightCm} cm</span>` : ""}
                        </div>
                      </div>
                      <div class="d-flex gap-1" @click=${(e) => e.stopPropagation()}>
                        <button class="btn btn-sm btn-outline-secondary" @click=${() => this.#openEdit(item)}><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger" @click=${() => this.#confirmDelete(item)}><i class="bi bi-trash"></i></button>
                      </div>
                    </div>
                    ${expanded && (measurements.length || item.Notes) ? html`
                      <div class="px-4 pb-2 text-muted small border-top pt-2">
                        ${measurements.length ? html`
                          <ul class="mb-0 ps-0 list-unstyled">
                            ${measurements.map((m) => html`<li>${m.name}: ${m.value}${m.unit ? html` ${m.unit}` : ""}</li>`)}
                          </ul>` : ""}
                        ${item.Notes ? html`<div class="fst-italic mt-1">${item.Notes}</div>` : ""}
                      </div>` : ""}
                  </li>`;
              })}
            </ul>` : html`<p class="text-muted p-3 mb-0">${t("vital.none", "No vitals recorded.")}</p>`}
        </div>
      </div>

      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="vitalAddModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">${t("vital.add", "Add Vitals")}</h5></div>
            <div class="modal-body">${this.#renderModalBody("vitalAdd", this._addMeasurements, onAddMfUpdate, onAddMfAdd, onAddMfRemove, this._addErrors)}</div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal" ?disabled=${this._addSaving}>${t("btn.cancel", "Cancel")}</button>
              <button class="btn btn-primary" @click=${this.#submitAdd} ?disabled=${this._addSaving}>
                ${this._addSaving ? html`<span class="spinner-border spinner-border-sm me-1"></span>${t("btn.saving", "Saving…")}` : html`<i class="bi bi-check-lg me-1"></i>${t("btn.save", "Save")}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="vitalEditModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">${t("vital.edit", "Edit Vitals")}</h5></div>
            <div class="modal-body">
              <input type="hidden" id="vitalEditId" />
              ${this.#renderModalBody("vitalEdit", this._editMeasurements, onEditMfUpdate, onEditMfAdd, onEditMfRemove, this._editErrors)}
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

customElements.define("mh-vitals", MhVitals);
