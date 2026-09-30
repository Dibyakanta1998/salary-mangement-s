import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import {
  ApiError,
  createPerson,
  fetchPerson,
  updatePerson,
  type HistoryRow,
  type PersonDetail,
} from "../api/client";
import { COPY } from "../copy";
import { formatAmount } from "../formatAmount";
import lookups from "../lookups";
import {
  Main,
  Notice,
  PageTitle,
  Shell,
  TableHead,
  cardClass,
  controlClass,
  primaryButtonClass,
  quietButtonClass,
  readOnlyClass,
  tableClass,
  tdClass,
  thClass,
  trClass,
} from "../shell";
import {
  asStatus,
  currencyFor,
  emptyForm,
  formFromPerson,
  historyChange,
  personFields,
  saveNeedsNote,
  type FormState,
} from "./personForm";

const areaClass =
  "min-h-24 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30";

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? "sm:col-span-2" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex flex-col gap-1">
      <span>{label}</span>
      <span className={readOnlyClass}>{value}</span>
    </p>
  );
}

function PersonForm({
  person,
  form,
  saving,
  saveError,
  onChange,
  onSubmit,
}: {
  person: PersonDetail | null;
  form: FormState;
  saving: boolean;
  saveError: string;
  onChange: (partial: Partial<FormState>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const needsNote = saveNeedsNote(form, person);
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
      {person ? (
        <ReadOnlyField label={COPY.employeeIdLabel} value={person.employeeId} />
      ) : (
        <Field label={COPY.employeeIdLabel}>
          <input
            name="employeeId"
            required
            maxLength={64}
            value={form.employeeId}
            className={controlClass}
            onChange={(event) => onChange({ employeeId: event.target.value })}
          />
        </Field>
      )}
      <Field label={COPY.legalNameLabel}>
        <input
          name="legalName"
          required
          maxLength={200}
          value={form.legalName}
          className={controlClass}
          onChange={(event) => onChange({ legalName: event.target.value })}
        />
      </Field>
      <Field label={COPY.countryLabel}>
        <select
          name="country"
          value={form.country}
          className={controlClass}
          onChange={(event) => onChange({ country: event.target.value })}
        >
          {lookups.countries.map((country) => (
            <option key={country.name} value={country.name}>
              {country.name}
            </option>
          ))}
        </select>
      </Field>
      <ReadOnlyField label={COPY.currencyLabel} value={currencyFor(form.country)} />
      <Field label={COPY.levelLabel}>
        <select
          name="level"
          value={form.level}
          className={controlClass}
          onChange={(event) => onChange({ level: event.target.value })}
        >
          {lookups.levels.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </Field>
      <Field label={COPY.departmentLabel}>
        <select
          name="department"
          value={form.department}
          className={controlClass}
          onChange={(event) => onChange({ department: event.target.value })}
        >
          <option value="">{COPY.noDepartment}</option>
          {lookups.departments.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </select>
      </Field>
      <Field label={COPY.annualBaseLabel}>
        <input
          name="annualBase"
          required
          inputMode="decimal"
          pattern="(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?"
          value={form.annualBase}
          className={controlClass}
          onChange={(event) => onChange({ annualBase: event.target.value })}
        />
      </Field>
      {person ? (
        <p className={readOnlyClass}>
          {COPY.monthlyLabel} {formatAmount(person.monthlyBase, person.currency)}
        </p>
      ) : null}
      <Field label={COPY.statusLabel}>
        <select
          name="status"
          value={form.status}
          className={controlClass}
          onChange={(event) => onChange({ status: asStatus(event.target.value) })}
        >
          <option value="active">{COPY.statusActive}</option>
          <option value="left">{COPY.statusLeft}</option>
        </select>
      </Field>
      {form.status === "left" ? (
        <Field label={COPY.leaveDateLabel}>
          <input
            name="leaveDate"
            type="date"
            required
            value={form.leaveDate}
            className={controlClass}
            onChange={(event) => onChange({ leaveDate: event.target.value })}
          />
        </Field>
      ) : null}
      <Field label={COPY.managerLabel}>
        <input
          name="managerEmployeeId"
          maxLength={64}
          value={form.managerEmployeeId}
          className={controlClass}
          onChange={(event) => onChange({ managerEmployeeId: event.target.value })}
        />
      </Field>
      <Field label={COPY.startDateLabel}>
        <input
          name="startDate"
          type="date"
          value={form.startDate}
          className={controlClass}
          onChange={(event) => onChange({ startDate: event.target.value })}
        />
      </Field>
      {needsNote ? (
        <Field label={COPY.noteLabel} wide>
          <textarea
            name="note"
            required
            maxLength={1000}
            value={form.note}
            className={areaClass}
            onChange={(event) => onChange({ note: event.target.value })}
          />
          <span>{COPY.noteHint}</span>
        </Field>
      ) : null}
      {saveError ? (
        <p className="sm:col-span-2" role="alert">
          {saveError}
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <button type="submit" disabled={saving} className={primaryButtonClass}>
          {saving ? COPY.saving : COPY.save}
        </button>
      </div>
    </form>
  );
}

function HistoryTable({ history }: { history: HistoryRow[] }) {
  const rows = history.slice(0, 10);
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-lg font-semibold">{COPY.changesTitle}</h2>
      {rows.length === 0 ? <Notice>{COPY.noChanges}</Notice> : null}
      {rows.length > 0 ? (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className={tableClass}>
            <TableHead>
              <tr>
                <th className={thClass}>{COPY.columnDate}</th>
                <th className={thClass}>{COPY.columnWhatChanged}</th>
                <th className={thClass}>{COPY.columnNote}</th>
              </tr>
            </TableHead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.changedAt}-${index}`} className={trClass}>
                  <td className={tdClass}>{row.changedAt.slice(0, 10)}</td>
                  <td className={tdClass}>{historyChange(row)}</td>
                  <td className={tdClass}>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export function Person({ employeeId }: { employeeId: string | null }) {
  const [reloadKey, setReloadKey] = useState(0);
  const [phase, setPhase] = useState<"loading" | "error" | "ready">(employeeId === null ? "ready" : "loading");
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (employeeId === null) return;
    const controller = new AbortController();
    fetchPerson(employeeId, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        setPerson(next);
        setForm(formFromPerson(next));
        setSaveError("");
        setPhase("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!controller.signal.aborted) setPhase("error");
      });
    return () => controller.abort();
  }, [employeeId, reloadKey]);

  function onChange(partial: Partial<FormState>): void {
    setSaveError("");
    setForm((current) => {
      const next = { ...current, ...partial };
      if (partial.status === "active") next.leaveDate = "";
      return next;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (saving) return;
    if (form.status === "left" && !form.leaveDate) {
      setSaveError(COPY.leaveDateRequired);
      return;
    }
    const needsNote = saveNeedsNote(form, person);
    if (needsNote && !form.note.trim()) {
      setSaveError(COPY.noteRequired);
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      if (!person) {
        const created = await createPerson({ ...personFields(form), employeeId: form.employeeId.trim() });
        window.location.assign(`/people?id=${encodeURIComponent(created.employeeId)}`);
        return;
      }
      const fields = personFields(form);
      await updatePerson(person.employeeId, needsNote ? { ...fields, note: form.note.trim() } : fields);
      setReloadKey((value) => value + 1);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 409) setSaveError(COPY.duplicateId);
      else if (error instanceof ApiError && error.message) setSaveError(error.message);
      else setSaveError(COPY.saveError);
    } finally {
      setSaving(false);
    }
  }

  const title = person?.legalName || (employeeId === null ? COPY.addPerson : COPY.employeeIdLabel);

  return (
    <Shell>
      <Main>
        <PageTitle>{title}</PageTitle>
        <div className="max-w-3xl">
          {phase === "loading" ? <Notice>{COPY.personLoading}</Notice> : null}
          {phase === "error" ? (
            <Notice>
              {COPY.personLoadError}{" "}
              <button type="button" className={quietButtonClass} onClick={() => setReloadKey((value) => value + 1)}>
                {COPY.retry}
              </button>
            </Notice>
          ) : null}
          {phase === "ready" ? (
            <>
              <div className={`${cardClass} p-4`}>
                <PersonForm
                  person={person}
                  form={form}
                  saving={saving}
                  saveError={saveError}
                  onChange={onChange}
                  onSubmit={(event) => void onSubmit(event)}
                />
              </div>
              {person ? <HistoryTable history={person.history} /> : null}
            </>
          ) : null}
        </div>
      </Main>
    </Shell>
  );
}
