import { DateTime, Info } from 'luxon';

// occurred_at is a date (YYYY-MM-DD); created_at/updated_at are ISO-8601 UTC. (PRD §4)
export const todayISODate = () => DateTime.now().toISODate();

// Localized short month names (Jan…Dec), index 0 = January — for the transactions month filter (ADR-015).
export const monthShortNames = (locale) => Info.months('short', { locale });

export const formatDate = (iso) =>
  iso ? DateTime.fromISO(iso).toLocaleString(DateTime.DATE_MED) : '';

export const formatDateTime = (iso) =>
  iso ? DateTime.fromISO(iso, { zone: 'utc' }).toLocal().toLocaleString(DateTime.DATETIME_MED) : '';
