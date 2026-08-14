export const MIN_HOURLY_RATE_SECONDS = 60;

export function calculateHourlyRate(income: number, totalSeconds: number): number | null {
  if (!Number.isFinite(income) || !Number.isFinite(totalSeconds) || totalSeconds < MIN_HOURLY_RATE_SECONDS) {
    return null;
  }
  return income / (totalSeconds / 3600);
}
