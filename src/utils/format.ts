export const fmt = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? 'Нет данных'
    : new Intl.NumberFormat('ru-RU', {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(v);
export const pct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? 'Нет данных' : `${fmt(v * 100, digits)}%`;
export const rub = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined ? 'Нет данных' : `${fmt(v, digits)} ₽`;
export const date = (s: string) => new Date(s).toLocaleDateString('ru-RU', { timeZone: 'UTC' });
export const shortDate = (s: string) =>
  new Date(s).toLocaleDateString('ru-RU', { month: 'short', year: '2-digit', timeZone: 'UTC' });
export const escapeHtml = (s: unknown) =>
  String(s ?? 'Нет данных').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
