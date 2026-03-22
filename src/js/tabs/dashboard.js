import { LitElement, html } from "../../lib/lit.min.js";
import { state } from "../state.js";
import { formatDate } from "../utils.js";

class DashboardTab extends LitElement {
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

  load() { this.requestUpdate(); }

  #memberName(memberId) {
    return state.allMembers.find((m) => m.Id === memberId)?.FullName ?? "Unknown";
  }

  #doctorName(doctorId) {
    return state.allDoctors.find((d) => d.Id === doctorId)?.FullName ?? "";
  }

  #doctorSpecialty(doctorId) {
    const lang = window.localization.getLanguage();
    const doc = state.allDoctors.find((d) => d.Id === doctorId);
    if (!doc) { return ""; }
    return lang === "el" ? (doc.SpecialtyEl || doc.SpecialtyEn || "") : (doc.SpecialtyEn || "");
  }

  #conditionName(conditionId) {
    const lang = window.localization.getLanguage();
    const cond = state.allMedicalConditions.find((c) => c.Id === conditionId);
    if (!cond) { return conditionId || "—"; }
    return lang === "el" ? (cond.El || cond.En) : cond.En;
  }

  #upcomingAppointments() {
    const now = new Date();
    const limit = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);
    return state.allDoctorAppointments
      .filter((a) => {
        if (!a.DateOfAppointmentUtc) { return false; }
        const apptDate = new Date(a.DateOfAppointmentUtc);
        return apptDate >= now && apptDate <= limit;
      })
      .sort((a, b) => a.DateOfAppointmentUtc.localeCompare(b.DateOfAppointmentUtc));
  }

  #activePrescriptions() {
    const todayStr = new Date().toISOString().substring(0, 10);
    return state.allPrescriptions.filter((rx) => !rx.DateEnded || rx.DateEnded >= todayStr);
  }

  #recentConditions() {
    return state.allDiagnoses.slice(0, 5);
  }

  render() {
    const t = (key, fallback) => window.localization?.t(key) ?? fallback;
    const appointments = this.#upcomingAppointments();
    const prescriptions = this.#activePrescriptions();
    const conditions = this.#recentConditions();

    return html`
      <div class="row g-3">
        <!-- Upcoming Appointments -->
        <div class="col-12 col-lg-6">
          <div class="card h-100">
            <div class="card-header d-flex align-items-center gap-2">
              <i class="bi bi-calendar-check text-primary"></i>
              ${t("dashboard.upcoming-appointments", "Upcoming Appointments (30 days)")}
              <span class="badge bg-primary ms-auto">${appointments.length}</span>
            </div>
            <div class="list-group list-group-flush">
              ${appointments.length
                ? appointments.map((appt) => html`
                  <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-start">
                      <div>
                        <div class="fw-semibold">${this.#memberName(appt.MemberId)}</div>
                        ${appt.ReasonOfAppointment ? html`<div class="text-muted small">${appt.ReasonOfAppointment}</div>` : ""}
                        ${appt.DoctorId ? html`<div class="text-muted small"><i class="bi bi-person-badge me-1"></i>${this.#doctorName(appt.DoctorId)}${this.#doctorSpecialty(appt.DoctorId) ? html` <span class="text-secondary">(${this.#doctorSpecialty(appt.DoctorId)})</span>` : ""}</div>` : ""}
                      </div>
                      <span class="badge bg-primary-subtle text-primary-emphasis">${formatDate(appt.DateOfAppointmentUtc)}</span>
                    </div>
                  </div>`)
                : html`<div class="list-group-item text-muted small">${t("dashboard.no-appointments", "No upcoming appointments.")}</div>`}
            </div>
          </div>
        </div>

        <!-- Active Prescriptions -->
        <div class="col-12 col-lg-6">
          <div class="card h-100">
            <div class="card-header d-flex align-items-center gap-2">
              <i class="bi bi-capsule text-success"></i>
              ${t("dashboard.active-prescriptions", "Active Prescriptions")}
              <span class="badge bg-success ms-auto">${prescriptions.length}</span>
            </div>
            <div class="list-group list-group-flush">
              ${prescriptions.length
                ? prescriptions.map((rx) => html`
                  <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-start">
                      <div>
                        <div class="fw-semibold">${this.#memberName(rx.MemberId)}</div>
                        <div class="text-muted small">
                          ${rx.MedicationName}
                          ${rx.Dosage ? html` — ${rx.Dosage}` : ""}
                          ${rx.Frequency ? html` (${rx.Frequency})` : ""}
                        </div>
                      </div>
                      ${rx.DateStarted ? html`<span class="badge bg-success-subtle text-success-emphasis">${formatDate(rx.DateStarted)}</span>` : ""}
                    </div>
                  </div>`)
                : html`<div class="list-group-item text-muted small">${t("dashboard.no-prescriptions", "No active prescriptions.")}</div>`}
            </div>
          </div>
        </div>

        <!-- Recent Conditions -->
        <div class="col-12 col-lg-6">
          <div class="card h-100">
            <div class="card-header d-flex align-items-center gap-2">
              <i class="bi bi-heart-pulse text-danger"></i>
              ${t("dashboard.recent-conditions", "Recent Conditions")}
            </div>
            <div class="list-group list-group-flush">
              ${conditions.length
                ? conditions.map((cond) => html`
                  <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-start">
                      <div>
                        <div class="fw-semibold">${this.#memberName(cond.MemberId)}</div>
                        <div class="text-muted small">${this.#conditionName(cond.MedicalConditionId)}</div>
                      </div>
                      <div class="text-end">
                        <span class="badge bg-danger-subtle text-danger-emphasis">${formatDate(cond.DateDiagnosed)}</span>
                        ${cond.DateResolved ? html`<div class="text-muted small mt-1">✓ ${formatDate(cond.DateResolved)}</div>` : ""}
                      </div>
                    </div>
                  </div>`)
                : html`<div class="list-group-item text-muted small">${t("dashboard.no-conditions", "No recent conditions.")}</div>`}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define("dashboard-tab", DashboardTab);
