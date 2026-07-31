import { DateTime, Info } from 'luxon';

// occurred_at is a date (YYYY-MM-DD); created_at/updated_at are ISO-8601 UTC. (PRD §4)
export const todayISODate = () => DateTime.now().toISODate();

// Localized short month names (Jan…Dec), index 0 = January — for the transactions month filter (ADR-015).
export const monthShortNames = (locale) => Info.months('short', { locale });

export const formatDate = (iso) =>
  iso ? DateTime.fromISO(iso).toLocaleString(DateTime.DATE_MED) : '';

export const formatDateTime = (iso) =>
  iso ? DateTime.fromISO(iso, { zone: 'utc' }).toLocal().toLocaleString(DateTime.DATETIME_MED) : '';

// Relative feed timestamps ("3 hours ago"), locale-aware; created_at is ISO-8601 UTC (ADR-017).
export const timeAgo = (iso, locale) =>
  iso ? DateTime.fromISO(iso, { zone: 'utc' }).toRelative({ locale }) : '';

// Relative time from an epoch-millis timestamp ("2h ago") — RTK Query's fulfilledTimeStamp is millis,
// not ISO, so it needs its own conversion. Used by StaleBadge (ADR-019).
export const timeAgoMillis = (millis, locale) =>
  millis ? DateTime.fromMillis(millis).toRelative({ locale }) : '';
