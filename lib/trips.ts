import type { TripRecord, TripStatus } from "./types";
import { TRIP_STATUSES } from "./types";
import { todayInDhaka } from "./dates";

export const isTripStatus = (v: unknown): v is TripStatus => TRIP_STATUSES.includes(v as TripStatus);

/** A trip whose checkout has passed reads as completed, unless it was cancelled. */
export function effectiveStatus(stored: unknown, checkout: string): TripStatus {
  const status = isTripStatus(stored) ? stored : "upcoming";
  if (status === "cancelled" || status === "completed") return status;
  return checkout < todayInDhaka() ? "completed" : status;
}

/** Build a TripRecord from a trips row (JSON data plus the status column). */
export function rowToTrip(row: Record<string, unknown>): TripRecord {
  const trip = JSON.parse(String(row.data)) as TripRecord;
  return { ...trip, status: effectiveStatus(row.status, String(row.checkout)) };
}
