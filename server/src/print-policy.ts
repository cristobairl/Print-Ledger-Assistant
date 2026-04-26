export type PrintPolicySettings = {
  maxPrintHours: number
  maxWeeklyGrams: number
}

const DEFAULT_SETTINGS: PrintPolicySettings = {
  maxPrintHours: 5,
  maxWeeklyGrams: 500,
}

let settings: PrintPolicySettings = { ...DEFAULT_SETTINGS }

export function getPrintPolicySettings() {
  return { ...settings }
}

export function updatePrintPolicySettings(input: Partial<PrintPolicySettings>) {
  if (typeof input.maxPrintHours === 'number' && Number.isFinite(input.maxPrintHours)) {
    settings.maxPrintHours = clampHours(input.maxPrintHours)
  }

  if (typeof input.maxWeeklyGrams === 'number' && Number.isFinite(input.maxWeeklyGrams)) {
    settings.maxWeeklyGrams = clampWeeklyGrams(input.maxWeeklyGrams)
  }

  return getPrintPolicySettings()
}

function clampHours(value: number) {
  return Math.min(Math.max(Math.round(value), 1), 24)
}

function clampWeeklyGrams(value: number) {
  return Math.min(Math.max(Math.round(value), 1), 10000)
}
