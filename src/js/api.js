const SCHEMA = {
  members:            { sheet: "Members",            columns: ["Id","FirstName","LastName","Gender","DateOfBirth","SIN","BloodType","Emails","CustomFieldsJson"] },
  doctorSpecialties:  { sheet: "DoctorSpecialties",  columns: ["Id","En","El"] },
  doctors:            { sheet: "Doctors",             columns: ["Id","SpecialtyId","SpecialtyEn","SpecialtyEl","FirstName","LastName","PhoneNumber","Email","Address","Notes"] },
  medicalConditions:  { sheet: "MedicalConditions",  columns: ["Id","En","El"] },
  doctorAppointments: { sheet: "DoctorAppointments", columns: ["Id","MemberId","DoctorId","DateOfAppointmentUtc","ReasonOfAppointment","Notes"] },
  vitalSigns:         { sheet: "VitalSigns",         columns: ["Id","MemberId","DateOfMeasurementUtc","WeightKg","HeightCm","ExtraMeasurementsJson","Notes"] },
  prescriptions:      { sheet: "Prescriptions",      columns: ["Id","MemberId","DoctorId","MedicationName","Dosage","Frequency","DateStarted","DateEnded","Notes"] },
  diagnosticTests:    { sheet: "DiagnosticTests",    columns: ["Id","MemberId","DoctorId","TestType","DateUtc","ResultsJson","Notes"] },
  surgeries:          { sheet: "Surgeries",          columns: ["Id","MemberId","DoctorId","DateOfSurgeryUtc","Name","Notes"] },
  vaccinations:       { sheet: "Vaccinations",       columns: ["Id","MemberId","DoctorId","DateOfVaccinationUtc","Name","Notes"] },
  diagnoses:          { sheet: "Diagnoses",          columns: ["Id","MemberId","MedicalConditionId","Symptoms","DiagnosedByDoctorId","AppointmentId","DateDiagnosed","DateResolved"] },
};

function SheetDb(schemaDef) {
  return {
    append:          (rowData)            => window.sheets.append(schemaDef.sheet, schemaDef.columns, rowData),
    updateRow:       (rowIndex, rowData)  => window.sheets.updateRow(schemaDef.sheet, schemaDef.columns, rowIndex, rowData),
    deleteRow:       (rowIndex)           => window.sheets.deleteRow(schemaDef.sheet, rowIndex),
    newId:           ()                   => window.sheets.newId(),
    getRowIndexById: (id)                 => window.sheets.getRowIndexById(schemaDef.sheet, id),
  };
}

function toDateString(value) {
  if (!value) { return ""; }
  if (typeof value === "string") { return value.substring(0, 10); }
  if (typeof value === "number") {
    const date = new Date((value - 25569) * 86400000);
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }
  return "";
}


function normalizeMember(rawRow) {
  const emails = rawRow.Emails ? String(rawRow.Emails).split(",").map((e) => e.trim()).filter(Boolean) : [];
  let customFieldsJson = {};
  try { customFieldsJson = rawRow.CustomFieldsJson ? JSON.parse(rawRow.CustomFieldsJson) : {}; } catch {}
  return {
    ...rawRow,
    SIN: rawRow.SIN || "",
    BloodType: rawRow.BloodType || "",
    Emails: emails,
    CustomFieldsJson: customFieldsJson,
    FullName: `${rawRow.FirstName || ""} ${rawRow.LastName || ""}`.trim(),
  };
}

function normalizeDoctor(rawRow) {
  const phoneNumbers = rawRow.PhoneNumber ? String(rawRow.PhoneNumber).split(",").map((p) => p.trim()).filter(Boolean) : [];
  return {
    ...rawRow,
    PhoneNumbers: phoneNumbers,
    FullName: `${rawRow.FirstName || ""} ${rawRow.LastName || ""}`.trim(),
  };
}

function normalizeDoctorAppointment(rawRow) {
  const raw = rawRow.DateOfAppointmentUtc;
  let normalized = "";
  if (raw) {
    if (typeof raw === "number") {
      // Google Sheets serial number — convert to ISO string (UTC)
      normalized = new Date((raw - 25569) * 86400000).toISOString();
    } else if (typeof raw === "string") {
      // Keep full ISO string; if date-only, treat as UTC midnight
      normalized = raw.length === 10 ? raw + "T00:00:00.000Z" : raw;
    }
  }
  return { ...rawRow, DateOfAppointmentUtc: normalized };
}

function normalizeVitalSigns(rawRow) {
  const parseNum = (v) => (v !== "" && v != null ? parseFloat(v) : null);
  let measurements = [];
  try { measurements = rawRow.ExtraMeasurementsJson ? JSON.parse(rawRow.ExtraMeasurementsJson) : []; } catch {}
  return {
    ...rawRow,
    DateOfMeasurementUtc: toDateString(rawRow.DateOfMeasurementUtc),
    WeightKg: parseNum(rawRow.WeightKg),
    HeightCm: parseNum(rawRow.HeightCm),
    ExtraMeasurementsJson: measurements,
  };
}

function normalizePrescription(rawRow) {
  return { ...rawRow, DateStarted: toDateString(rawRow.DateStarted), DateEnded: toDateString(rawRow.DateEnded) };
}

function normalizeDiagnosticTest(rawRow) {
  let results = [];
  if (rawRow.ResultsJson) {
    try { results = JSON.parse(rawRow.ResultsJson); } catch { results = []; }
  }
  return { ...rawRow, DateUtc: toDateString(rawRow.DateUtc), ResultsJson: results };
}

function normalizeSurgery(rawRow) {
  return { ...rawRow, DateOfSurgeryUtc: toDateString(rawRow.DateOfSurgeryUtc), DoctorId: rawRow.DoctorId || "" };
}

function normalizeVaccination(rawRow) {
  return { ...rawRow, DateOfVaccinationUtc: toDateString(rawRow.DateOfVaccinationUtc) };
}

function normalizeDiagnosis(rawRow) {
  return { ...rawRow, DateDiagnosed: toDateString(rawRow.DateDiagnosed), DateResolved: toDateString(rawRow.DateResolved) };
}

function normalizeMedicalCondition(rawRow) {
  return { ...rawRow };
}

function normalizeDoctorSpecialty(rawRow) {
  return { ...rawRow };
}

window.api = {
  async loadAll() {
    const [
      rawMembers, rawDoctorSpecialties, rawDoctors, rawMedicalConditions,
      rawDoctorAppointments, rawVitalSigns, rawPrescriptions, rawDiagnosticTests,
      rawSurgeries, rawVaccinations, rawDiagnoses,
    ] = await window.sheets.batchGetAll([
      SCHEMA.members, SCHEMA.doctorSpecialties, SCHEMA.doctors, SCHEMA.medicalConditions,
      SCHEMA.doctorAppointments, SCHEMA.vitalSigns, SCHEMA.prescriptions, SCHEMA.diagnosticTests,
      SCHEMA.surgeries, SCHEMA.vaccinations, SCHEMA.diagnoses,
    ]);

    const members = rawMembers.map(normalizeMember).sort((a, b) => a.FullName.localeCompare(b.FullName));
    const doctorSpecialties = rawDoctorSpecialties.map(normalizeDoctorSpecialty).sort((a, b) => (a.Id < b.Id ? -1 : a.Id > b.Id ? 1 : 0));
    const doctors = rawDoctors.map(normalizeDoctor).sort((a, b) => a.FullName.localeCompare(b.FullName));
    const medicalConditions = rawMedicalConditions.map(normalizeMedicalCondition).sort((a, b) => (a.Id < b.Id ? -1 : a.Id > b.Id ? 1 : 0));

    window.state.allMembers           = members;
    window.state.allDoctorSpecialties = doctorSpecialties;
    window.state.allDoctors           = doctors;
    window.state.allMedicalConditions = medicalConditions;
    window.state.allDoctorAppointments = rawDoctorAppointments.map(normalizeDoctorAppointment).sort((a, b) => b.DateOfAppointmentUtc.localeCompare(a.DateOfAppointmentUtc));
    window.state.allVitalSigns        = rawVitalSigns.map(normalizeVitalSigns).sort((a, b) => b.DateOfMeasurementUtc.localeCompare(a.DateOfMeasurementUtc));
    window.state.allPrescriptions     = rawPrescriptions.map(normalizePrescription).sort((a, b) => (a.MedicationName || "").localeCompare(b.MedicationName || ""));
    window.state.allDiagnosticTests   = rawDiagnosticTests.map(normalizeDiagnosticTest).sort((a, b) => b.DateUtc.localeCompare(a.DateUtc));
    window.state.allSurgeries         = rawSurgeries.map(normalizeSurgery).sort((a, b) => b.DateOfSurgeryUtc.localeCompare(a.DateOfSurgeryUtc));
    window.state.allVaccinations      = rawVaccinations.map(normalizeVaccination).sort((a, b) => b.DateOfVaccinationUtc.localeCompare(a.DateOfVaccinationUtc));
    window.state.allDiagnoses         = rawDiagnoses.map(normalizeDiagnosis).sort((a, b) => b.DateDiagnosed.localeCompare(a.DateDiagnosed));
  },

  // ── DoctorSpecialties ────────────────────────────────────────────────────

  async addDoctorSpecialty(id, en, el) {
    await window.sheets.append(SCHEMA.doctorSpecialties.sheet, SCHEMA.doctorSpecialties.columns, { Id: id, En: en, El: el });
  },
  async updateDoctorSpecialty(id, en, el) {
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.doctorSpecialties.sheet, id);
    await window.sheets.updateRow(SCHEMA.doctorSpecialties.sheet, SCHEMA.doctorSpecialties.columns, rowIndex, { En: en, El: el });
  },
  async deleteDoctorSpecialty(id) {
    if (window.state.allDoctors.some((d) => d.SpecialtyId === id)) {
      throw new Error("Cannot delete: specialty is used by one or more doctors.");
    }
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.doctorSpecialties.sheet, id);
    await window.sheets.deleteRow(SCHEMA.doctorSpecialties.sheet, rowIndex);
  },

  // ── MedicalConditions ────────────────────────────────────────────────────

  async addMedicalCondition(id, en, el) {
    await window.sheets.append(SCHEMA.medicalConditions.sheet, SCHEMA.medicalConditions.columns, { Id: id, En: en, El: el });
  },
  async updateMedicalCondition(id, en, el) {
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.medicalConditions.sheet, id);
    await window.sheets.updateRow(SCHEMA.medicalConditions.sheet, SCHEMA.medicalConditions.columns, rowIndex, { En: en, El: el });
  },
  async deleteMedicalCondition(id) {
    if (window.state.allDiagnoses.some((d) => d.MedicalConditionId === id)) {
      throw new Error("Cannot delete: condition is linked to one or more diagnoses.");
    }
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.medicalConditions.sheet, id);
    await window.sheets.deleteRow(SCHEMA.medicalConditions.sheet, rowIndex);
  },

  // ── Members ──────────────────────────────────────────────────────────────

  async addMember(memberData) {
    const sheetDb = SheetDb(SCHEMA.members);
    await sheetDb.append({
      Id: sheetDb.newId(),
      FirstName: memberData.FirstName,
      LastName: memberData.LastName,
      Gender: memberData.Gender || "",
      DateOfBirth: memberData.DateOfBirth || "",
      SIN: memberData.SIN || "",
      BloodType: memberData.BloodType || "",
      Emails: Array.isArray(memberData.Emails) ? memberData.Emails.join(",") : (memberData.Emails || ""),
      CustomFieldsJson: memberData.CustomFieldsJson ? JSON.stringify(memberData.CustomFieldsJson) : "",
    });
  },
  async updateMember(id, memberData) {
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.members.sheet, id);
    await SheetDb(SCHEMA.members).updateRow(rowIndex, {
      FirstName: memberData.FirstName,
      LastName: memberData.LastName,
      Gender: memberData.Gender || "",
      DateOfBirth: memberData.DateOfBirth || "",
      SIN: memberData.SIN || "",
      BloodType: memberData.BloodType || "",
      Emails: Array.isArray(memberData.Emails) ? memberData.Emails.join(",") : (memberData.Emails || ""),
      CustomFieldsJson: memberData.CustomFieldsJson ? JSON.stringify(memberData.CustomFieldsJson) : "",
    });
  },
  async deleteMember(id) {
    const linked = [
      window.state.allDoctorAppointments, window.state.allVitalSigns,
      window.state.allPrescriptions, window.state.allDiagnosticTests,
      window.state.allSurgeries, window.state.allVaccinations, window.state.allDiagnoses,
    ];
    if (linked.some((arr) => arr.some((r) => r.MemberId === id))) {
      throw new Error("Cannot delete member with existing health records.");
    }
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.members.sheet, id);
    await SheetDb(SCHEMA.members).deleteRow(rowIndex);
  },

  // ── Doctors ──────────────────────────────────────────────────────────────

  async addDoctor(doctorData) {
    const sheetDb = SheetDb(SCHEMA.doctors);
    await sheetDb.append({
      Id: sheetDb.newId(),
      SpecialtyId: doctorData.SpecialtyId || "",
      SpecialtyEn: doctorData.SpecialtyEn || "",
      SpecialtyEl: doctorData.SpecialtyEl || "",
      FirstName: doctorData.FirstName,
      LastName: doctorData.LastName || "",
      PhoneNumber: Array.isArray(doctorData.PhoneNumbers) ? doctorData.PhoneNumbers.join(",") : "",
      Email: doctorData.Email || "",
      Address: doctorData.Address || "",
      Notes: doctorData.Notes || "",
    });
  },
  async updateDoctor(id, doctorData) {
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.doctors.sheet, id);
    await SheetDb(SCHEMA.doctors).updateRow(rowIndex, {
      SpecialtyId: doctorData.SpecialtyId || "",
      SpecialtyEn: doctorData.SpecialtyEn || "",
      SpecialtyEl: doctorData.SpecialtyEl || "",
      FirstName: doctorData.FirstName,
      LastName: doctorData.LastName || "",
      PhoneNumber: Array.isArray(doctorData.PhoneNumbers) ? doctorData.PhoneNumbers.join(",") : "",
      Email: doctorData.Email || "",
      Address: doctorData.Address || "",
      Notes: doctorData.Notes || "",
    });
  },
  async deleteDoctor(id) {
    const linked = [
      window.state.allDoctorAppointments.some((r) => r.DoctorId === id),
      window.state.allPrescriptions.some((r) => r.DoctorId === id),
      window.state.allDiagnosticTests.some((r) => r.DoctorId === id),
      window.state.allSurgeries.some((r) => r.DoctorId === id),
      window.state.allVaccinations.some((r) => r.DoctorId === id),
      window.state.allDiagnoses.some((r) => r.DiagnosedByDoctorId === id),
    ];
    if (linked.some(Boolean)) { throw new Error("Cannot delete doctor linked to existing health records."); }
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.doctors.sheet, id);
    await SheetDb(SCHEMA.doctors).deleteRow(rowIndex);
  },

  // ── DoctorAppointments ───────────────────────────────────────────────────

  async addDoctorAppointment(data) {
    const sheetDb = SheetDb(SCHEMA.doctorAppointments);
    await sheetDb.append({ Id: sheetDb.newId(), MemberId: data.MemberId, DoctorId: data.DoctorId || "", DateOfAppointmentUtc: data.DateOfAppointmentUtc || "", ReasonOfAppointment: data.ReasonOfAppointment || "", Notes: data.Notes || "" });
  },
  async updateDoctorAppointment(id, data) {
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.doctorAppointments.sheet, id);
    await SheetDb(SCHEMA.doctorAppointments).updateRow(rowIndex, { MemberId: data.MemberId, DoctorId: data.DoctorId || "", DateOfAppointmentUtc: data.DateOfAppointmentUtc || "", ReasonOfAppointment: data.ReasonOfAppointment || "", Notes: data.Notes || "" });
  },
  async deleteDoctorAppointment(id) {
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.doctorAppointments.sheet, id);
    await SheetDb(SCHEMA.doctorAppointments).deleteRow(rowIndex);
  },

  // ── VitalSigns ───────────────────────────────────────────────────────────

  async addVitalSigns(data) {
    const sheetDb = SheetDb(SCHEMA.vitalSigns);
    await sheetDb.append({ Id: sheetDb.newId(), MemberId: data.MemberId, DateOfMeasurementUtc: data.DateOfMeasurementUtc || "", WeightKg: data.WeightKg ?? "", HeightCm: data.HeightCm ?? "", ExtraMeasurementsJson: data.ExtraMeasurementsJson?.length ? JSON.stringify(data.ExtraMeasurementsJson) : "", Notes: data.Notes || "" });
  },
  async updateVitalSigns(id, data) {
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.vitalSigns.sheet, id);
    await SheetDb(SCHEMA.vitalSigns).updateRow(rowIndex, { MemberId: data.MemberId, DateOfMeasurementUtc: data.DateOfMeasurementUtc || "", WeightKg: data.WeightKg ?? "", HeightCm: data.HeightCm ?? "", ExtraMeasurementsJson: data.ExtraMeasurementsJson?.length ? JSON.stringify(data.ExtraMeasurementsJson) : "", Notes: data.Notes || "" });
  },
  async deleteVitalSigns(id) {
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.vitalSigns.sheet, id);
    await SheetDb(SCHEMA.vitalSigns).deleteRow(rowIndex);
  },

  // ── Prescriptions ────────────────────────────────────────────────────────

  async addPrescription(data) {
    const sheetDb = SheetDb(SCHEMA.prescriptions);
    await sheetDb.append({ Id: sheetDb.newId(), MemberId: data.MemberId, DoctorId: data.DoctorId || "", MedicationName: data.MedicationName || "", Dosage: data.Dosage || "", Frequency: data.Frequency || "", DateStarted: data.DateStarted || "", DateEnded: data.DateEnded || "", Notes: data.Notes || "" });
  },
  async updatePrescription(id, data) {
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.prescriptions.sheet, id);
    await SheetDb(SCHEMA.prescriptions).updateRow(rowIndex, { MemberId: data.MemberId, DoctorId: data.DoctorId || "", MedicationName: data.MedicationName || "", Dosage: data.Dosage || "", Frequency: data.Frequency || "", DateStarted: data.DateStarted || "", DateEnded: data.DateEnded || "", Notes: data.Notes || "" });
  },
  async deletePrescription(id) {
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.prescriptions.sheet, id);
    await SheetDb(SCHEMA.prescriptions).deleteRow(rowIndex);
  },

  // ── DiagnosticTests ──────────────────────────────────────────────────────

  async addDiagnosticTest(data) {
    const sheetDb = SheetDb(SCHEMA.diagnosticTests);
    const resultsJson = Array.isArray(data.ResultsJson) ? JSON.stringify(data.ResultsJson) : "";
    await sheetDb.append({ Id: sheetDb.newId(), MemberId: data.MemberId, DoctorId: data.DoctorId || "", TestType: data.TestType || "", DateUtc: data.DateUtc || "", ResultsJson: resultsJson, Notes: data.Notes || "" });
  },
  async updateDiagnosticTest(id, data) {
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.diagnosticTests.sheet, id);
    const resultsJson = Array.isArray(data.ResultsJson) ? JSON.stringify(data.ResultsJson) : "";
    await SheetDb(SCHEMA.diagnosticTests).updateRow(rowIndex, { MemberId: data.MemberId, DoctorId: data.DoctorId || "", TestType: data.TestType || "", DateUtc: data.DateUtc || "", ResultsJson: resultsJson, Notes: data.Notes || "" });
  },
  async deleteDiagnosticTest(id) {
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.diagnosticTests.sheet, id);
    await SheetDb(SCHEMA.diagnosticTests).deleteRow(rowIndex);
  },

  // ── Surgeries ────────────────────────────────────────────────────────────

  async addSurgery(data) {
    const sheetDb = SheetDb(SCHEMA.surgeries);
    await sheetDb.append({ Id: sheetDb.newId(), MemberId: data.MemberId, DoctorId: data.DoctorId || "", DateOfSurgeryUtc: data.DateOfSurgeryUtc || "", Name: data.Name || "", Notes: data.Notes || "" });
  },
  async updateSurgery(id, data) {
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.surgeries.sheet, id);
    await SheetDb(SCHEMA.surgeries).updateRow(rowIndex, { MemberId: data.MemberId, DoctorId: data.DoctorId || "", DateOfSurgeryUtc: data.DateOfSurgeryUtc || "", Name: data.Name || "", Notes: data.Notes || "" });
  },
  async deleteSurgery(id) {
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.surgeries.sheet, id);
    await SheetDb(SCHEMA.surgeries).deleteRow(rowIndex);
  },

  // ── Vaccinations ─────────────────────────────────────────────────────────

  async addVaccination(data) {
    const sheetDb = SheetDb(SCHEMA.vaccinations);
    await sheetDb.append({ Id: sheetDb.newId(), MemberId: data.MemberId, DoctorId: data.DoctorId || "", DateOfVaccinationUtc: data.DateOfVaccinationUtc || "", Name: data.Name || "", Notes: data.Notes || "" });
  },
  async updateVaccination(id, data) {
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.vaccinations.sheet, id);
    await SheetDb(SCHEMA.vaccinations).updateRow(rowIndex, { MemberId: data.MemberId, DoctorId: data.DoctorId || "", DateOfVaccinationUtc: data.DateOfVaccinationUtc || "", Name: data.Name || "", Notes: data.Notes || "" });
  },
  async deleteVaccination(id) {
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.vaccinations.sheet, id);
    await SheetDb(SCHEMA.vaccinations).deleteRow(rowIndex);
  },

  // ── Diagnoses (member health conditions) ─────────────────────────────────

  async addDiagnosis(data) {
    const sheetDb = SheetDb(SCHEMA.diagnoses);
    await sheetDb.append({ Id: sheetDb.newId(), MemberId: data.MemberId, MedicalConditionId: data.MedicalConditionId || "", Symptoms: data.Symptoms || "", DiagnosedByDoctorId: data.DiagnosedByDoctorId || "", AppointmentId: data.AppointmentId || "", DateDiagnosed: data.DateDiagnosed || "", DateResolved: data.DateResolved || "" });
  },
  async updateDiagnosis(id, data) {
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.diagnoses.sheet, id);
    await SheetDb(SCHEMA.diagnoses).updateRow(rowIndex, { MemberId: data.MemberId, MedicalConditionId: data.MedicalConditionId || "", Symptoms: data.Symptoms || "", DiagnosedByDoctorId: data.DiagnosedByDoctorId || "", AppointmentId: data.AppointmentId || "", DateDiagnosed: data.DateDiagnosed || "", DateResolved: data.DateResolved || "" });
  },
  async deleteDiagnosis(id) {
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.diagnoses.sheet, id);
    await SheetDb(SCHEMA.diagnoses).deleteRow(rowIndex);
  },
};
