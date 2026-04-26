export type PrintPolicySettings = {
  maxPrintHours: number
}

const DEFAULT_SETTINGS: PrintPolicySettings = {
  maxPrintHours: 5,
}

let settings: PrintPolicySettings = { ...DEFAULT_SETTINGS }

export function getPrintPolicySettings() {
  return { ...settings }
}

export function updatePrintPolicySettings(input: Partial<PrintPolicySettings>) {
  if (typeof input.maxPrintHours === 'number' && Number.isFinite(input.maxPrintHours)) {
    settings.maxPrintHours = clampHours(input.maxPrintHours)
  }

  return getPrintPolicySettings()
}

function clampHours(value: number) {
  return Math.min(Math.max(Math.round(value), 1), 24)
}
