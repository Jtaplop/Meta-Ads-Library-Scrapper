import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Formats byte size into human-readable format (B, KB, MB, GB).
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeI = Math.min(i, sizes.length - 1);
  const formatted = parseFloat((bytes / Math.pow(k, safeI)).toFixed(dm));
  return `${formatted} ${sizes[safeI]}`;
}

/**
 * Formats duration in seconds to MM:SS or HH:MM:SS string.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (hours > 0) {
    return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Formats duration into Spanish human words, e.g. "2 min 40 s"
 */
export function formatDurationHuman(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0 s";
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} h`);
  if (mins > 0) parts.push(`${mins} min`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs} s`);

  return parts.join(" ");
}

function parseDateInput(dateInput: string | Date | number): Date | null {
  if (dateInput instanceof Date) {
    return isValid(dateInput) ? dateInput : null;
  }
  if (typeof dateInput === "number") {
    const d = new Date(dateInput);
    return isValid(d) ? d : null;
  }
  if (typeof dateInput === "string") {
    // If it's a timestamp string from filename e.g. "20261109_191111"
    const fnTsRegex = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/;
    const m = dateInput.match(fnTsRegex);
    if (m) {
      const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`);
      return isValid(d) ? d : null;
    }
    const parsedIso = parseISO(dateInput);
    if (isValid(parsedIso)) return parsedIso;
    const fallback = new Date(dateInput);
    return isValid(fallback) ? fallback : null;
  }
  return null;
}

/**
 * Formats a date relative to now in Spanish, e.g. "hace 5 minutos"
 */
export function formatRelativeDate(dateInput: string | Date | number): string {
  const d = parseDateInput(dateInput);
  if (!d) return "—";
  return formatDistanceToNow(d, { addSuffix: true, locale: es });
}

/**
 * Formats a date/time using date-fns in Spanish. Default pattern: "d MMM yyyy, HH:mm"
 */
export function formatDateTime(
  dateInput: string | Date | number,
  formatStr: string = "d MMM yyyy, HH:mm"
): string {
  const d = parseDateInput(dateInput);
  if (!d) return "—";
  return format(d, formatStr, { locale: es });
}

/**
 * Formats a number using the Spanish (es-ES) locale, e.g. 12500 -> "12.500"
 */
export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("es-ES", options).format(value);
}
