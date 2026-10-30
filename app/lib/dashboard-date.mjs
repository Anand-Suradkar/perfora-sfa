/** Date keys in the app's business timezone (India), avoiding UTC date rollover. */
export function dateKeyInTimeZone(value, timeZone = "Asia/Kolkata") {
  let date;
  try {
    if (value && typeof value.toDate === "function") date = value.toDate();
    else if (value && typeof value.toMillis === "function") date = new Date(value.toMillis());
    else if (value instanceof Date) date = value;
    else if (typeof value === "string" || typeof value === "number") date = new Date(value);
    else return "";
  } catch {
    return "";
  }
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  const year = get("year"), month = get("month"), day = get("day");
  return year && month && day ? `${year}-${month}-${day}` : "";
}

export function todayDateKey(timeZone = "Asia/Kolkata") {
  return dateKeyInTimeZone(new Date(), timeZone);
}

export function isIncludedInSalesMetrics(order) {
  if (!order || !order.createdAt || !Array.isArray(order.items)) return false;
  const status = String(order.status || "").trim().toUpperCase();
  return status !== "DRAFT" && status !== "CANCELLED";
}
