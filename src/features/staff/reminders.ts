import {
  alertId,
  cancelGroup,
  scheduleGroup,
  type LocalAlert,
} from '../notifications/localScheduler';
import type { StaffSalaryPush } from '../notifications/types';
import { monthEndDate } from './payroll';
import type { PayrollSettings, Payslip } from './types';

/**
 * Salary-due reminders.
 *
 * A Wise Home ships "automated reminders ... for staff and vendor payments"
 * (`docs/AWH_FEATURE_GAP_ANALYSIS.md` §1.3 gap 3.4). Habita AI had none: the
 * staff screen showed an amount, and remembering to act on it before month end
 * was entirely the household's problem.
 *
 * Same shape as `features/money/document_hub/reminders.ts` — a pure builder plus
 * a scheduling call — and for the same reason: the payloads fired here are the
 * `STAFF_SALARY_DUE` / `STAFF_SALARY_OVERDUE` messages §3.2.1 specifies for the
 * backend, so the server scheduler replaces these without touching parsing,
 * routing, the inbox or the alerts card.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `"2026-09-30"` at `hour` in the device's timezone.
 *
 * Local-parts construction, not `new Date(iso)` — see the note on the same
 * helper in the document-hub reminders module.
 */
function localDateAt(isoDate: string, hour: number): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    return null;
  }
  const [, y, m, d] = match;
  const at = new Date(Number(y), Number(m) - 1, Number(d), hour, 0, 0, 0);
  return Number.isNaN(at.getTime()) ? null : at.getTime();
}

/** 10am — a household errand, so late enough to be actionable, not an overnight ping. */
export const SALARY_REMINDER_HOUR = 10;

/**
 * Reminders for a month's payroll run.
 *
 * Only unsettled payslips produce an alert, and the amount carried is the
 * *outstanding* figure rather than `netPayable`: a partly-paid month reminding
 * for the full salary is worse than not reminding at all, because acting on it
 * overpays.
 *
 * Two alerts per member: one `salaryReminderLeadDays` before month end, and one
 * the day after it, escalating to `STAFF_SALARY_OVERDUE`. Pure — the clock is an
 * argument — so the awkward cases (a month already ended, a lead day already
 * passed, a fully-paid member) are testable.
 */
export function buildSalaryAlerts(
  payslips: Payslip[],
  settings: PayrollSettings,
  now: number = Date.now(),
): LocalAlert[] {
  if (!settings.remindersEnabled) {
    return [];
  }

  const alerts: LocalAlert[] = [];

  for (const slip of payslips) {
    if (slip.status === 'PAID' || slip.outstanding <= 0) {
      continue;
    }
    const dueDate = slip.dueDate || monthEndDate(slip.month);
    const dueAt = localDateAt(dueDate, SALARY_REMINDER_HOUR);
    if (dueAt === null) {
      continue;
    }

    const base = {
      staffId: slip.caregiverId,
      staffName: slip.name,
      month: slip.month,
      amount: slip.outstanding,
      dueDate,
      clickAction: 'OPEN_STAFF_SCREEN' as const,
    };

    const dueReminderAt = dueAt - settings.salaryReminderLeadDays * DAY_MS;
    if (dueReminderAt > now) {
      const payload: StaffSalaryPush = { ...base, type: 'STAFF_SALARY_DUE' };
      alerts.push({
        id: alertId('staff', slip.caregiverId, slip.month, 'due'),
        payload,
        fireAt: dueReminderAt,
      });
    }

    const overdueAt = dueAt + DAY_MS;
    if (overdueAt > now) {
      const payload: StaffSalaryPush = { ...base, type: 'STAFF_SALARY_OVERDUE' };
      alerts.push({
        id: alertId('staff', slip.caregiverId, slip.month, 'overdue'),
        payload,
        fireAt: overdueAt,
      });
    }
  }

  return alerts;
}

/**
 * Recomputes and reschedules salary reminders from the current payroll run.
 *
 * Cheap to call after any change that moves a payslip — marking attendance,
 * recording a payment, adding an adjustment — because `scheduleGroup` replaces
 * the group and the ids are stable per member per month. Paying a salary
 * therefore cancels its own reminder on the next sync, with no separate
 * invalidation path to forget.
 */
export async function syncSalaryReminders(
  payslips: Payslip[],
  settings: PayrollSettings,
): Promise<number> {
  if (!settings.remindersEnabled) {
    await cancelGroup('staff');
    return 0;
  }
  return scheduleGroup('staff', buildSalaryAlerts(payslips, settings));
}
