/**
 * Centralized number and date formatting utilities.
 *
 * WHY THIS EXISTS:
 * Never call .toLocaleString() without an explicit locale.
 * Without a locale, the browser uses the OS language setting.
 * On Spanish-language systems (es-ES, es-MX, etc.) the decimal separator
 * is a comma, so 9.196 renders as "9,196" — which looks like nine thousand.
 *
 * Always import from here instead of calling .toLocaleString() directly.
 */

/** Format a monetary value: e.g. 9.196 → "9.20", 1234.5 → "1,234.50" */
export const fmt = (value: number | null | undefined, decimals = 2): string =>
    Number(value ?? 0).toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });

/** Format an integer count: e.g. 1234 → "1,234" */
export const fmtInt = (value: number | null | undefined): string =>
    Number(value ?? 0).toLocaleString('en-US');

/** Format a date/time string for display in the admin panel. */
export const fmtDate = (
    value: string | Date | null | undefined,
    options: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }
): string => {
    if (!value) return '—';
    return new Date(value).toLocaleString('en-US', options);
};
