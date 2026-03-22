import { LitElement, html } from "../../../lib/lit.min.js";
import { showConfirm } from "../../confirm.js";
import { state } from "../../state.js";
import { formatDate, todayStr } from "../../utils.js";

class MhDiagnosticTests extends LitElement {
  static properties = {
    _items:       { state: true },
    _addSaving:   { state: true },
    _editSaving:  { state: true },
    _addErrors:   { state: true },
    _editErrors:  { state: true },
    _addResults:  { state: true },
    _editResults: { state: true },
    _expandedId:  { state: true },
  };

  #memberId = "";

  constructor() {
    super();
    this._items       = [];
    this._addSaving   = false;
    this._editSaving  = false;
    this._addErrors   = [];
    this._editErrors  = [];
    this._addResults  = [];
    this._editResults = [];
    this._expandedId  = null;
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
    this._items = state.allDiagnosticTests.filter((t) => t.MemberId === memberId);
  }

  async #reload() {
    try { await window.api.loadAll(); } catch (e) { alert(e.message); }
    this.load(this.#memberId);
  }

  #isOutOfRange(r) {
    const val = parseFloat(r.value);
    if (isNaN(val)) { return false; }
    if (r.rangeMin !== "" && r.rangeMin != null) {
      const min = parseFloat(r.rangeMin);
      if (!isNaN(min) && val < min) { return true; }
    }
    if (r.rangeMax !== "" && r.rangeMax != null) {
      const max = parseFloat(r.rangeMax);
      if (!isNaN(max) && val > max) { return true; }
    }
    return false;
  }

  #doctorLabel(doctorId) {
    const lang = window.localization.getLanguage();
    const doctor = state.allDoctors.find((d) => d.Id === doctorId);
    if (!doctor) { return ""; }
    const specialty = lang === "el" ? (doctor.SpecialtyEl || doctor.SpecialtyEn || "") : (doctor.SpecialtyEn || "");
    return specialty ? `${doctor.FullName} — ${specialty}` : doctor.FullName;
  }

  #openAdd() {
    this._addErrors  = [];
    this._addSaving  = false;
    this._addResults = [];
    bootstrap.Modal.getOrCreateInstance(this.querySelector("#testAddModal")).show();
    this.updateComplete.then(() => {
      this.querySelector("#testAddDate").value   = todayStr();
      this.querySelector("#testAddType").value   = "";
      this.querySelector("#testAddDoctor").value = "";
      this.querySelector("#testAddNotes").value  = "";
    });
  }

  #openEdit(item) {
    this._editErrors  = [];
    this._editSaving  = false;
    this._editResults = Array.isArray(item.ResultsJson) ? item.ResultsJson.map((r) => ({ ...r, rangeMin: r.rangeMin ?? "", rangeMax: r.rangeMax ?? "" })) : [];
    bootstrap.Modal.getOrCreateInstance(this.querySelector("#testEditModal")).show();
    this.updateComplete.then(() => {
      this.querySelector("#testEditId").value     = item.Id;
      this.querySelector("#testEditType").value   = item.TestType || "";
      this.querySelector("#testEditDate").value   = item.DateUtc || "";
      this.querySelector("#testEditDoctor").value = item.DoctorId || "";
      this.querySelector("#testEditNotes").value  = item.Notes || "";
    });
  }

  #collectData(prefix, results) {
    const val = (id) => this.querySelector(`#${id}`).value;
    return {
      MemberId:    this.#memberId,
      TestType:    val(`${prefix}Type`).trim(),
      DateUtc:     val(`${prefix}Date`),
      DoctorId:    val(`${prefix}Doctor`),
      ResultsJson: results,
      Notes:       val(`${prefix}Notes`).trim(),
    };
  }

  async #submitAdd() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const data = this.#collectData("testAdd", this._addResults);
    const errors = [];
    if (!data.TestType)           { errors.push(t("error.required-test-type", "Test type is required.")); }
    if (!data.DateUtc)            { errors.push(t("error.required-date", "Date is required.")); }
    if (!data.ResultsJson.length) { errors.push(t("error.required-test-results", "At least one result is required.")); }
    if (data.ResultsJson.some((r) => !r.name.trim() || !r.value.trim())) { errors.push(t("error.required-result-fields", "Each result requires a parameter name and value.")); }
    if (errors.length) { this._addErrors = errors; return; }
    this._addErrors = [];
    this._addSaving = true;
    try {
      await window.api.addDiagnosticTest(data);
      bootstrap.Modal.getInstance(this.querySelector("#testAddModal")).hide();
      await this.#reload();
    } catch (e) {
      this._addErrors = [e.message];
    } finally {
      this._addSaving = false;
    }
  }

  async #submitEdit() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const id   = this.querySelector("#testEditId").value;
    const data = this.#collectData("testEdit", this._editResults);
    const errors = [];
    if (!data.TestType)           { errors.push(t("error.required-test-type", "Test type is required.")); }
    if (!data.DateUtc)            { errors.push(t("error.required-date", "Date is required.")); }
    if (!data.ResultsJson.length) { errors.push(t("error.required-test-results", "At least one result is required.")); }
    if (data.ResultsJson.some((r) => !r.name.trim() || !r.value.trim())) { errors.push(t("error.required-result-fields", "Each result requires a parameter name and value.")); }
    if (errors.length) { this._editErrors = errors; return; }
    this._editErrors = [];
    this._editSaving = true;
    try {
      await window.api.updateDiagnosticTest(id, data);
      bootstrap.Modal.getInstance(this.querySelector("#testEditModal")).hide();
      await this.#reload();
    } catch (e) {
      this._editErrors = [e.message];
    } finally {
      this._editSaving = false;
    }
  }

  #confirmDelete(item) {
    showConfirm("Delete Test", `Delete ${item.TestType}?`, "Delete", "btn-danger", (done) => {
      window.api.deleteDiagnosticTest(item.Id).then(() => { done(); this.#reload(); }).catch((e) => { done(); alert(e.message); });
    });
  }

  #renderErrors(errors) {
    if (!errors.length) { return ""; }
    return html`<div class="alert alert-danger py-2 mb-0 mt-2"><ul class="mb-0 ps-3">${errors.map((m) => html`<li>${m}</li>`)}</ul></div>`;
  }

  #renderResultsEditor(results, onUpdate, onAdd, onRemove, t) {
    return html`
      <div class="mb-3">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <label class="form-label mb-0 small"><i class="bi bi-list-check me-1"></i>${t("test.results", "Results")}</label>
          <button type="button" class="btn btn-outline-secondary btn-sm" @click=${onAdd}><i class="bi bi-plus-lg"></i></button>
        </div>
        ${results.length ? results.map((row, i) => html`
          <div class="border rounded p-2 mb-2">
            <div class="d-flex gap-1 mb-2">
              <input type="text" class="form-control form-control-sm flex-grow-1"
                placeholder="${t("test.result-name", "Parameter")}"
                .value=${row.name}
                @input=${(e) => onUpdate(i, "name", e.target.value)} />
              <button type="button" class="btn btn-sm btn-outline-danger px-2" @click=${() => onRemove(i)}><i class="bi bi-x-lg"></i></button>
            </div>
            <div class="row g-1">
              <div class="col-6">
                <input type="text" class="form-control form-control-sm"
                  placeholder="${t("test.result", "Value")}"
                  .value=${row.value}
                  @input=${(e) => onUpdate(i, "value", e.target.value)} />
              </div>
              <div class="col-6">
                <input type="text" class="form-control form-control-sm"
                  placeholder="${t("test.unit", "Unit")}"
                  .value=${row.unit}
                  @input=${(e) => onUpdate(i, "unit", e.target.value)} />
              </div>
              <div class="col-6 mt-1">
                <input type="text" class="form-control form-control-sm"
                  placeholder="${t("test.range-min", "Range min")}"
                  .value=${row.rangeMin}
                  @input=${(e) => onUpdate(i, "rangeMin", e.target.value)} />
              </div>
              <div class="col-6 mt-1">
                <input type="text" class="form-control form-control-sm"
                  placeholder="${t("test.range-max", "Range max")}"
                  .value=${row.rangeMax}
                  @input=${(e) => onUpdate(i, "rangeMax", e.target.value)} />
              </div>
            </div>
          </div>`)
        : html`<div class="text-muted small">${t("test.no-results", "No results added.")}</div>`}
      </div>`;
  }

  #renderModalBody(prefix, results, onResultUpdate, onResultAdd, onResultRemove, errors) {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    return html`
      <div class="form-floating mb-3">
        <input type="text" id="${prefix}Type" class="form-control" placeholder="${t("test.type", "Test Type")}" />
        <label>${t("test.type", "Test Type")}</label>
      </div>
      <div class="form-floating mb-3">
        <input type="date" id="${prefix}Date" class="form-control" placeholder="${t("test.date", "Date")}" />
        <label>${t("test.date", "Date")}</label>
      </div>
      <div class="form-floating mb-3">
        <select id="${prefix}Doctor" class="form-select">
          <option value="">—</option>
          ${state.allDoctors.map((d) => html`<option value="${d.Id}">${this.#doctorLabel(d.Id)}</option>`)}
        </select>
        <label><i class="bi bi-person-badge me-1"></i>${t("test.ordered-by", "Ordered By")}</label>
      </div>
      ${this.#renderResultsEditor(results, onResultUpdate, onResultAdd, onResultRemove, t)}
      <div class="form-floating mb-3">
        <textarea id="${prefix}Notes" class="form-control" placeholder="${t("label.notes", "Notes")}" style="height:70px"></textarea>
        <label>${t("label.notes", "Notes")}</label>
      </div>
      ${this.#renderErrors(errors)}
    `;
  }

  render() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;

    const emptyResult = () => ({ name: "", value: "", unit: "", rangeMin: "", rangeMax: "" });
    const onAddUpdate  = (i, f, v) => { this._addResults  = this._addResults.map((r, idx)  => idx === i ? { ...r, [f]: v } : r); };
    const onAddAdd     = ()        => { this._addResults  = [...this._addResults,  emptyResult()]; };
    const onAddRemove  = (i)       => { this._addResults  = this._addResults.filter((_, idx)  => idx !== i); };
    const onEditUpdate = (i, f, v) => { this._editResults = this._editResults.map((r, idx) => idx === i ? { ...r, [f]: v } : r); };
    const onEditAdd    = ()        => { this._editResults = [...this._editResults, emptyResult()]; };
    const onEditRemove = (i)       => { this._editResults = this._editResults.filter((_, idx) => idx !== i); };

    return html`
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><i class="bi bi-clipboard2-pulse me-1"></i>${t("section.diagnostic-tests", "Diagnostic Tests")}</span>
          <button class="btn btn-primary btn-sm" @click=${this.#openAdd}><i class="bi bi-plus-lg"></i></button>
        </div>
        <div>
          ${this._items.length ? html`
            <ul class="list-group list-group-flush">
              ${this._items.map((item) => {
                const expanded = this._expandedId === item.Id;
                const toggle = () => { this._expandedId = expanded ? null : item.Id; };
                return html`
                  <li class="list-group-item p-0">
                    <div class="d-flex align-items-center gap-2 px-3 py-2" style="cursor:pointer" @click=${toggle}>
                      <i class="bi bi-chevron-${expanded ? "down" : "right"} text-muted small"></i>
                      <div class="flex-grow-1">
                        <span class="fw-semibold">${item.TestType}</span>
                        ${item.DateUtc ? html`<span class="text-muted small ms-2">${formatDate(item.DateUtc)}</span>` : ""}
                      </div>
                      <div class="d-flex gap-1" @click=${(e) => e.stopPropagation()}>
                        <button class="btn btn-sm btn-outline-secondary" @click=${() => this.#openEdit(item)}><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger" @click=${() => this.#confirmDelete(item)}><i class="bi bi-trash"></i></button>
                      </div>
                    </div>
                    ${expanded ? html`
                      <div class="px-4 pb-2 border-top pt-2 text-muted small">
                        ${item.DoctorId ? html`<div><i class="bi bi-person-badge me-1"></i>${this.#doctorLabel(item.DoctorId)}</div>` : ""}
                        ${item.ResultsJson.length ? html`
                          <div class="mt-1">
                            ${item.ResultsJson.map((r) => html`
                              <div class="${this.#isOutOfRange(r) ? "rounded px-1 bg-danger-subtle" : ""}">
                                <span class="fw-medium">${r.name}:</span>
                                ${r.value}${r.unit ? ` ${r.unit}` : ""}
                                ${(r.rangeMin || r.rangeMax) ? html` <span class="text-body-tertiary">(${r.rangeMin}–${r.rangeMax})</span>` : ""}
                              </div>`)}
                          </div>` : ""}
                        ${item.Notes ? html`<div class="fst-italic mt-1">${item.Notes}</div>` : ""}
                      </div>` : ""}
                  </li>`;
              })}
            </ul>` : html`<p class="text-muted p-3 mb-0">${t("test.none", "No diagnostic tests.")}</p>`}
        </div>
      </div>

      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="testAddModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">${t("test.add", "Add Diagnostic Test")}</h5></div>
            <div class="modal-body">${this.#renderModalBody("testAdd", this._addResults, onAddUpdate, onAddAdd, onAddRemove, this._addErrors)}</div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal" ?disabled=${this._addSaving}>${t("btn.cancel", "Cancel")}</button>
              <button class="btn btn-primary" @click=${this.#submitAdd} ?disabled=${this._addSaving}>
                ${this._addSaving ? html`<span class="spinner-border spinner-border-sm me-1"></span>${t("btn.saving", "Saving…")}` : html`<i class="bi bi-check-lg me-1"></i>${t("btn.save", "Save")}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="testEditModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">${t("test.edit", "Edit Diagnostic Test")}</h5></div>
            <div class="modal-body">
              <input type="hidden" id="testEditId" />
              ${this.#renderModalBody("testEdit", this._editResults, onEditUpdate, onEditAdd, onEditRemove, this._editErrors)}
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

customElements.define("mh-diagnostic-tests", MhDiagnosticTests);
