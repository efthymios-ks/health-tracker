import { LitElement, html } from "../../lib/lit.min.js";
import { showConfirm } from "../confirm.js";
import { state } from "../state.js";
import { formatDate, normalizeSearch } from "../utils.js";

class MembersTab extends LitElement {
  static properties = {
    _members: { state: true },
    _addSaving: { state: true },
    _editSaving: { state: true },
    _addErrors: { state: true },
    _editErrors: { state: true },
    _addCustomFields: { state: true },
    _editCustomFields: { state: true },
    _addEmails: { state: true },
    _editEmails: { state: true },
    _expandedMemberId: { state: true },
  };

  #search = "";

  constructor() {
    super();
    this._members = [];
    this._addSaving = false;
    this._editSaving = false;
    this._addErrors = [];
    this._editErrors = [];
    this._addCustomFields = [];
    this._editCustomFields = [];
    this._addEmails = [""];
    this._editEmails = [""];
    this._expandedMemberId = null;
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

  load() { this._members = state.allMembers; }

  async #reload() {
    try {
      await window.api.loadAll();
    } catch (loadError) {
      alert(loadError.message);
    }
    this.load();
  }

  #filtered() {
    if (!this.#search) { return this._members; }
    return this._members.filter((member) =>
      normalizeSearch(member.FullName).includes(this.#search) ||
      normalizeSearch(member.Emails.join(" ")).includes(this.#search) ||
      normalizeSearch(member.SIN).includes(this.#search)
    );
  }

  #cfFromObject(obj) {
    return Object.entries(obj).map(([key, value]) => ({ key, value: String(value) }));
  }

  #cfValidate(rows) {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    for (const row of rows) {
      const hasKey = row.key.trim() !== "";
      const hasValue = row.value.trim() !== "";
      if (hasKey && !hasValue) { return t("error.cf-missing-value", `Field "${row.key.trim()}" is missing a value.`).replace("{key}", row.key.trim()); }
      if (!hasKey && hasValue) { return t("error.cf-missing-key", `A field with value "${row.value.trim()}" is missing a key.`).replace("{value}", row.value.trim()); }
    }
    return null;
  }

  #cfToObject(rows) {
    const result = {};
    for (const row of rows) {
      const key = row.key.trim();
      const value = row.value.trim();
      if (key && value) { result[key] = value; }
    }
    return result;
  }

  #openAdd() {
    this._addErrors = [];
    this._addSaving = false;
    this._addCustomFields = [];
    this._addEmails = [""];
    bootstrap.Modal.getOrCreateInstance(this.querySelector("#addMemberModal")).show();
    this.updateComplete.then(() => {
      this.querySelector("#addMemberFirstName").value = "";
      this.querySelector("#addMemberLastName").value = "";
      this.querySelector("#addMemberGender").value = "Male";
      this.querySelector("#addMemberDOB").value = "";
      this.querySelector("#addMemberSIN").value = "";
      this.querySelector("#addMemberBloodType").value = "";
    });
  }

  #openEdit(member) {
    this._editErrors = [];
    this._editSaving = false;
    this._editCustomFields = this.#cfFromObject(member.CustomFieldsJson);
    this._editEmails = member.Emails.length ? [...member.Emails] : [""];
    bootstrap.Modal.getOrCreateInstance(this.querySelector("#editMemberModal")).show();
    this.updateComplete.then(() => {
      this.querySelector("#editMemberId").value = member.Id;
      this.querySelector("#editMemberFirstName").value = member.FirstName || "";
      this.querySelector("#editMemberLastName").value = member.LastName || "";
      this.querySelector("#editMemberGender").value = member.Gender || "Male";
      this.querySelector("#editMemberDOB").value = member.DateOfBirth || "";
      this.querySelector("#editMemberSIN").value = member.SIN || "";
      this.querySelector("#editMemberBloodType").value = member.BloodType || "";
    });
  }

  async #submitAdd() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const firstName = this.querySelector("#addMemberFirstName").value.trim();
    const lastName = this.querySelector("#addMemberLastName").value.trim();
    const errors = [];
    if (!firstName) { errors.push(t("error.required-first-name", "First name is required.")); }
    if (!lastName)  { errors.push(t("error.required-last-name", "Last name is required.")); }
    const emails = this._addEmails.map((emailEntry) => emailEntry.trim()).filter(Boolean);
    const gender = this.querySelector("#addMemberGender").value;
    const dob = this.querySelector("#addMemberDOB").value;
    const sin = this.querySelector("#addMemberSIN").value.trim();
    const bloodType = this.querySelector("#addMemberBloodType").value;
    if (!dob)       { errors.push(t("error.required-dob", "Date of birth is required.")); }
    if (!sin)       { errors.push(t("error.required-sin", "SIN is required.")); }
    if (!bloodType) { errors.push(t("error.required-blood-type", "Blood type is required.")); }
    if (errors.length) { this._addErrors = errors; return; }
    const cfError = this.#cfValidate(this._addCustomFields);
    if (cfError) { this._addErrors = [cfError]; return; }
    const customFieldsJson = this.#cfToObject(this._addCustomFields);
    this._addErrors = [];
    this._addSaving = true;
    try {
      await window.api.addMember({ FirstName: firstName, LastName: lastName, Emails: emails, Gender: gender, DateOfBirth: dob, SIN: sin, BloodType: bloodType, CustomFieldsJson: customFieldsJson });
      bootstrap.Modal.getInstance(this.querySelector("#addMemberModal")).hide();
      await this.#reload();
    } catch (saveError) {
      this._addErrors = [saveError.message];
    } finally {
      this._addSaving = false;
    }
  }

  async #submitEdit() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const id = this.querySelector("#editMemberId").value;
    const firstName = this.querySelector("#editMemberFirstName").value.trim();
    const lastName = this.querySelector("#editMemberLastName").value.trim();
    const errors = [];
    if (!firstName) { errors.push(t("error.required-first-name", "First name is required.")); }
    if (!lastName)  { errors.push(t("error.required-last-name", "Last name is required.")); }
    const emails = this._editEmails.map((emailEntry) => emailEntry.trim()).filter(Boolean);
    const gender = this.querySelector("#editMemberGender").value;
    const dob = this.querySelector("#editMemberDOB").value;
    const sin = this.querySelector("#editMemberSIN").value.trim();
    const bloodType = this.querySelector("#editMemberBloodType").value;
    if (!dob)       { errors.push(t("error.required-dob", "Date of birth is required.")); }
    if (!sin)       { errors.push(t("error.required-sin", "SIN is required.")); }
    if (!bloodType) { errors.push(t("error.required-blood-type", "Blood type is required.")); }
    if (errors.length) { this._editErrors = errors; return; }
    const cfError = this.#cfValidate(this._editCustomFields);
    if (cfError) { this._editErrors = [cfError]; return; }
    const customFieldsJson = this.#cfToObject(this._editCustomFields);
    this._editErrors = [];
    this._editSaving = true;
    try {
      await window.api.updateMember(id, { FirstName: firstName, LastName: lastName, Emails: emails, Gender: gender, DateOfBirth: dob, SIN: sin, BloodType: bloodType, CustomFieldsJson: customFieldsJson });
      bootstrap.Modal.getInstance(this.querySelector("#editMemberModal")).hide();
      await this.#reload();
    } catch (saveError) {
      this._editErrors = [saveError.message];
    } finally {
      this._editSaving = false;
    }
  }

  #confirmDelete(member) {
    showConfirm("Delete Member", `Delete ${member.FullName}? This cannot be undone.`, "Delete", "btn-danger", (done) => {
      window.api.deleteMember(member.Id).then(() => { done(); this.#reload(); }).catch((deleteError) => { done(); alert(deleteError.message); });
    });
  }

  #renderErrors(errors) {
    if (!errors.length) { return ""; }
    return html`<div class="alert alert-danger py-2 mb-0 mt-2"><ul class="mb-0 ps-3">${errors.map((errorMessage) => html`<li>${errorMessage}</li>`)}</ul></div>`;
  }

  #renderEmailsEditor(emails, onUpdate, onAdd, onRemove, t) {
    return html`
      <div class="mb-3">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <label class="form-label mb-0 small"><i class="bi bi-envelope me-1"></i>${t("members.emails", "Emails")}</label>
          <button type="button" class="btn btn-outline-secondary btn-sm" @click=${onAdd}><i class="bi bi-plus-lg"></i></button>
        </div>
        ${emails.map((emailValue, emailIndex) => html`
          <div class="input-group input-group-sm mb-1">
            <input
              type="email"
              class="form-control"
              .value=${emailValue}
              placeholder="${t("members.email-placeholder", "email@example.com")}"
              @input=${(event) => onUpdate(emailIndex, event.target.value)}
            />
            <button type="button" class="btn btn-outline-danger" @click=${() => onRemove(emailIndex)} ?disabled=${emails.length === 1}><i class="bi bi-x-lg"></i></button>
          </div>`)}
      </div>
    `;
  }

  #renderCustomFieldsEditor(rows, onUpdate, onAdd, onRemove, t) {
    return html`
      <div class="mb-3">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <label class="form-label mb-0 small"><i class="bi bi-braces me-1"></i>${t("members.custom-fields", "Extra Info")}</label>
          <button type="button" class="btn btn-outline-secondary btn-sm" @click=${onAdd}><i class="bi bi-plus-lg"></i></button>
        </div>
        ${rows.length ? rows.map((row, rowIndex) => html`
          <div class="d-flex gap-1 mb-1">
            <input type="text" class="form-control form-control-sm" style="flex:1" .value=${row.key}
              placeholder="${t("members.cf-key-placeholder", "e.g. BloodType")}"
              @input=${(event) => onUpdate(rowIndex, "key", event.target.value)} />
            <input type="text" class="form-control form-control-sm" style="flex:1" .value=${row.value}
              placeholder="${t("members.cf-value-placeholder", "e.g. A+")}"
              @input=${(event) => onUpdate(rowIndex, "value", event.target.value)} />
            <button type="button" class="btn btn-sm btn-outline-danger px-2" @click=${() => onRemove(rowIndex)}><i class="bi bi-x-lg"></i></button>
          </div>`)
        : html`<div class="text-muted small">${t("members.no-custom-fields", "No extra info.")}</div>`}
      </div>
    `;
  }

  #renderAddModal() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const onCfUpdate = (rowIndex, field, value) => { this._addCustomFields = this._addCustomFields.map((row, i) => i === rowIndex ? { ...row, [field]: value } : row); };
    const onCfAdd = () => { this._addCustomFields = [...this._addCustomFields, { key: "", value: "" }]; };
    const onCfRemove = (rowIndex) => { this._addCustomFields = this._addCustomFields.filter((_, i) => i !== rowIndex); };
    const onEmailUpdate = (idx, value) => { this._addEmails = this._addEmails.map((e, i) => i === idx ? value : e); };
    const onEmailAdd = () => { this._addEmails = [...this._addEmails, ""]; };
    const onEmailRemove = (idx) => { this._addEmails = this._addEmails.filter((_, i) => i !== idx); };

    return html`
      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="addMemberModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-person-plus me-2"></i>${t("members.add", "Add Member")}</h5>
            </div>
            <div class="modal-body">
              <div class="row g-2 mb-3">
                <div class="col-6">
                  <div class="form-floating">
                    <input type="text" id="addMemberFirstName" class="form-control" placeholder="${t("members.first-name", "First Name")}" />
                    <label>${t("members.first-name", "First Name")}</label>
                  </div>
                </div>
                <div class="col-6">
                  <div class="form-floating">
                    <input type="text" id="addMemberLastName" class="form-control" placeholder="${t("members.last-name", "Last Name")}" />
                    <label>${t("members.last-name", "Last Name")}</label>
                  </div>
                </div>
              </div>
              ${this.#renderEmailsEditor(this._addEmails, onEmailUpdate, onEmailAdd, onEmailRemove, t)}
              <div class="row g-2 mb-3">
                <div class="col-6">
                  <div class="form-floating">
                    <select id="addMemberGender" class="form-select">
                      <option value="Male">${t("members.gender-male", "Male")}</option>
                      <option value="Female">${t("members.gender-female", "Female")}</option>
                    </select>
                    <label>${t("members.gender", "Gender")}</label>
                  </div>
                </div>
                <div class="col-6">
                  <div class="form-floating">
                    <select id="addMemberBloodType" class="form-select">
                      <option value="">—</option>
                      ${["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((bt) => html`<option value="${bt}">${bt}</option>`)}
                    </select>
                    <label><i class="bi bi-droplet me-1"></i>${t("members.blood-type", "Blood Type")}</label>
                  </div>
                </div>
              </div>
              <div class="form-floating mb-3">
                <input type="date" id="addMemberDOB" class="form-control" placeholder="${t("members.dob", "Date of Birth")}" />
                <label><i class="bi bi-calendar me-1"></i>${t("members.dob", "Date of Birth")}</label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="addMemberSIN" class="form-control font-monospace" placeholder="${t("members.sin", "SIN")}" />
                <label><i class="bi bi-shield-lock me-1"></i>${t("members.sin", "SIN")}</label>
              </div>
              ${this.#renderCustomFieldsEditor(this._addCustomFields, onCfUpdate, onCfAdd, onCfRemove, t)}
              ${this.#renderErrors(this._addErrors)}
            </div>
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
    const onCfUpdate = (rowIndex, field, value) => { this._editCustomFields = this._editCustomFields.map((row, i) => i === rowIndex ? { ...row, [field]: value } : row); };
    const onCfAdd = () => { this._editCustomFields = [...this._editCustomFields, { key: "", value: "" }]; };
    const onCfRemove = (rowIndex) => { this._editCustomFields = this._editCustomFields.filter((_, i) => i !== rowIndex); };
    const onEmailUpdate = (idx, value) => { this._editEmails = this._editEmails.map((e, i) => i === idx ? value : e); };
    const onEmailAdd = () => { this._editEmails = [...this._editEmails, ""]; };
    const onEmailRemove = (idx) => { this._editEmails = this._editEmails.filter((_, i) => i !== idx); };

    return html`
      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="editMemberModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-pencil me-2"></i>${t("members.edit", "Edit Member")}</h5>
            </div>
            <div class="modal-body">
              <input type="hidden" id="editMemberId" />
              <div class="row g-2 mb-3">
                <div class="col-6">
                  <div class="form-floating">
                    <input type="text" id="editMemberFirstName" class="form-control" placeholder="${t("members.first-name", "First Name")}" />
                    <label>${t("members.first-name", "First Name")}</label>
                  </div>
                </div>
                <div class="col-6">
                  <div class="form-floating">
                    <input type="text" id="editMemberLastName" class="form-control" placeholder="${t("members.last-name", "Last Name")}" />
                    <label>${t("members.last-name", "Last Name")}</label>
                  </div>
                </div>
              </div>
              ${this.#renderEmailsEditor(this._editEmails, onEmailUpdate, onEmailAdd, onEmailRemove, t)}
              <div class="row g-2 mb-3">
                <div class="col-6">
                  <div class="form-floating">
                    <select id="editMemberGender" class="form-select">
                      <option value="Male">${t("members.gender-male", "Male")}</option>
                      <option value="Female">${t("members.gender-female", "Female")}</option>
                    </select>
                    <label>${t("members.gender", "Gender")}</label>
                  </div>
                </div>
                <div class="col-6">
                  <div class="form-floating">
                    <select id="editMemberBloodType" class="form-select">
                      <option value="">—</option>
                      ${["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((bt) => html`<option value="${bt}">${bt}</option>`)}
                    </select>
                    <label><i class="bi bi-droplet me-1"></i>${t("members.blood-type", "Blood Type")}</label>
                  </div>
                </div>
              </div>
              <div class="form-floating mb-3">
                <input type="date" id="editMemberDOB" class="form-control" placeholder="${t("members.dob", "Date of Birth")}" />
                <label><i class="bi bi-calendar me-1"></i>${t("members.dob", "Date of Birth")}</label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="editMemberSIN" class="form-control font-monospace" placeholder="${t("members.sin", "SIN")}" />
                <label><i class="bi bi-shield-lock me-1"></i>${t("members.sin", "SIN")}</label>
              </div>
              ${this.#renderCustomFieldsEditor(this._editCustomFields, onCfUpdate, onCfAdd, onCfRemove, t)}
              ${this.#renderErrors(this._editErrors)}
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
          <span><i class="bi bi-people me-1"></i> ${t("members.title", "Members")}</span>
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
              ${list.map((member) => {
                const expanded = this._expandedMemberId === member.Id;
                const toggle = () => { this._expandedMemberId = expanded ? null : member.Id; };
                return html`
                  <li class="list-group-item p-0">
                    <div class="d-flex align-items-center gap-2 px-3 py-2" style="cursor:pointer" @click=${toggle}>
                      <i class="bi bi-chevron-${expanded ? "down" : "right"} text-muted small"></i>
                      <span class="fw-semibold flex-grow-1">${member.FullName}</span>
                      <div class="d-flex gap-1" @click=${(e) => e.stopPropagation()}>
                        <button class="btn btn-sm btn-outline-secondary" @click=${() => this.#openEdit(member)}><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger" @click=${() => this.#confirmDelete(member)}><i class="bi bi-trash"></i></button>
                      </div>
                    </div>
                    ${expanded ? html`
                      <div class="px-4 pb-2 text-muted small border-top pt-2">
                        ${member.Gender ? html`<div><i class="bi bi-person me-1"></i>${t(`members.gender-${member.Gender.toLowerCase()}`, member.Gender)}</div>` : ""}
                        ${member.DateOfBirth ? html`<div><i class="bi bi-calendar me-1"></i>${formatDate(member.DateOfBirth)}</div>` : ""}
                        ${member.BloodType ? html`<div><i class="bi bi-droplet me-1"></i>${t("members.blood-type", "Blood Type")}: <strong>${member.BloodType}</strong></div>` : ""}
                        ${member.SIN ? html`<div><i class="bi bi-shield-lock me-1"></i>${t("members.sin", "SIN")}: <span class="font-monospace">${member.SIN}</span></div>` : ""}
                        ${member.Emails.length ? html`<div><i class="bi bi-envelope me-1"></i>${member.Emails.join(", ")}</div>` : ""}
                        ${Object.keys(member.CustomFieldsJson).length ? html`
                          <div class="mt-1">
                            ${Object.entries(member.CustomFieldsJson).map(([key, value]) => html`<span class="badge bg-light text-dark border me-1">${key}: ${value}</span>`)}
                          </div>` : ""}
                      </div>` : ""}
                  </li>`;
              })}
            </ul>` : html`<p class="text-muted p-3">${t("members.none", "No members found.")}</p>`}
        </div>
      </div>
      ${this.#renderAddModal()}
      ${this.#renderEditModal()}
    `;
  }
}

customElements.define("members-tab", MembersTab);
