import * as net from 'net'
import { supabase } from './db'
import type { PrinterStatusSnapshot, TemperatureTelemetry } from './printer-status'

type PrinterRuntime = PrinterStatusSnapshot & {
  enforcementRuntime: {
    incidentActive: boolean
    lastAbortAttemptAt: number | null
  }
}
type PrinterConfigRow = {
  id: string | number
  ip: string | null
  name: string | null
}
type AuthorizationRequest = {
  studentId?: string | null
  cardId?: string | null
  firstName?: string | null
  durationMinutes?: number | null
}

export class PrinterRadar {
  private printers: PrinterRuntime[] = [
    this.createPrinterRuntime({
      id: 'handshake-only',
      name: 'Printer 70',
      ip: '192.168.137.162',
    }),
  ]
  private interval: NodeJS.Timeout | null = null
  private readonly POLL_INTERVAL = 1000
  private readonly PRINTER_PORTS = [8899, 8000]
  private readonly PRINTER_CONFIG_REFRESH_MS = 10000
  private readonly DEFAULT_SESSION_MINUTES = 2
  private readonly ABORT_COMMAND = '~M26'
  private readonly ABORT_RETRY_COOLDOWN_MS = 10000
  private lastPrinterConfigRefreshAt = 0

  async start() {
    await this.refreshPrinterConfigs(true)
    console.log(
      `PrinterRadar diagnostics enabled for ${this.describeConfiguredPrinters()} using ~M27 and ~M105 on ports ${this.PRINTER_PORTS.join(', ')}`,
    )

    if (this.interval) {
      clearInterval(this.interval)
    }

    this.interval = setInterval(() => {
      void this.poll()
    }, this.POLL_INTERVAL)

    void this.poll()
  }

  private async poll() {
    await this.refreshPrinterConfigs()

    console.log(
      `[Radar] Handshake poll started at ${new Date().toISOString()} for ${this.printers.length} printer(s)`,
    )

    await Promise.all(
      this.printers.map(async (printer) => {
        const seenAt = new Date().toISOString()

        try {
          console.log(
            `[Radar] Connecting to ${printer.name} (${printer.ip}) using ports ${this.PRINTER_PORTS.join(', ')}`,
          )
          const errors: string[] = []

          const activityProbe = await this.tryProbe(printer.ip, '~M27')
          if (!activityProbe.ok) {
            errors.push(activityProbe.error)
          }

          const telemetryPorts = this.getPortOrder(activityProbe.ok ? activityProbe.port : null)
          const telemetryProbe = await this.tryProbe(printer.ip, '~M105', telemetryPorts)
          if (!telemetryProbe.ok) {
            errors.push(telemetryProbe.error)
          }

          if (!activityProbe.ok && !telemetryProbe.ok) {
            throw new Error(errors.join(' | '))
          }

          const telemetry = telemetryProbe.ok
            ? this.parseTelemetry(telemetryProbe.response)
            : this.emptyTelemetry()
          const activity = this.deriveActivity(
            activityProbe.ok ? activityProbe.response : null,
            telemetryProbe.ok,
            telemetry,
          )
          const lastPort = activityProbe.ok
            ? activityProbe.port
            : telemetryProbe.ok
              ? telemetryProbe.port
              : null

          printer.telemetry = {
            ...telemetry,
            rawResponse: telemetryProbe.ok ? telemetryProbe.response.trim() : null,
          }
          printer.connectivity = {
            state: 'online',
            lastError: errors.length > 0 ? errors.join(' | ') : null,
            lastSeenAt: seenAt,
            lastPort,
          }
          printer.activity = activity
          this.syncAuthorizationState(printer, seenAt)
          await this.updateEnforcement(printer, seenAt)

          console.log(
            `[Radar] Activity response from ${printer.name}: ${activity.rawResponse ?? '(empty)'}`,
          )
          console.log(
            `[Radar] Activity for ${printer.name}: ${activity.state} | ${activity.reason}`,
          )
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          printer.connectivity = {
            state: 'offline',
            lastError: message,
            lastSeenAt: printer.connectivity.lastSeenAt ?? seenAt,
            lastPort: null,
          }
          printer.activity = {
            state: 'unknown',
            source: 'm27-status',
            reason: 'Printer did not return a usable ~M27 or ~M105 response.',
            command: '~M27',
            rawResponse: null,
          }
          printer.telemetry = {
            ...this.emptyTelemetry(),
            rawResponse: null,
          }
          this.syncAuthorizationState(printer, seenAt)
          this.updateEnforcementWhenOffline(printer)
          console.error(`[Radar] Diagnostics failed for ${printer.name} (${printer.ip})`, error)
        }
      }),
    )
  }

  private createPrinterRuntime(
    config: Pick<PrinterStatusSnapshot, 'id' | 'name' | 'ip'>,
    previous?: PrinterRuntime,
  ): PrinterRuntime {
    if (previous) {
      return {
        ...previous,
        id: config.id,
        name: config.name,
        ip: config.ip,
        enforcementRuntime: { ...previous.enforcementRuntime },
      }
    }

    return {
      id: config.id,
      name: config.name,
      ip: config.ip,
      authorization: this.createUnauthorizedAuthorization(),
      connectivity: {
        state: 'offline',
        lastSeenAt: null,
        lastError: null,
        lastPort: null,
      },
      activity: {
        state: 'unknown',
        source: 'm27-status',
        reason: 'No handshake response received yet.',
        command: '~M27',
        rawResponse: null,
      },
      telemetry: {
        command: '~M105',
        rawResponse: null,
        nozzle: {
          current: null,
          target: null,
        },
        bed: {
          current: null,
          target: null,
        },
      },
      enforcement: {
        mode: 'auto-snipe',
        state: 'idle',
        lastAction: 'none',
        reason: 'Auto-snipe is armed. Unauthorized bed heating or print activity will receive ~M26 once per incident.',
      },
      enforcementRuntime: {
        incidentActive: false,
        lastAbortAttemptAt: null,
      },
    }
  }

  private createUnauthorizedAuthorization(): PrinterStatusSnapshot['authorization'] {
    return {
      state: 'unauthorized',
      sessionState: 'idle',
      grantedAt: null,
      expiresAt: null,
      activatedAt: null,
      studentId: null,
      cardId: null,
      firstName: null,
    }
  }

  private async refreshPrinterConfigs(force = false) {
    const now = Date.now()
    if (!force && now - this.lastPrinterConfigRefreshAt < this.PRINTER_CONFIG_REFRESH_MS) {
      return
    }

    this.lastPrinterConfigRefreshAt = now

    try {
      const { data, error } = await supabase
        .from('printers')
        .select('id, name, ip')
        .order('name', { ascending: true })

      if (error) {
        throw error
      }

      const configs = (data ?? [])
        .map((row) => this.normalizePrinterConfigRow(row))
        .filter((row): row is Pick<PrinterStatusSnapshot, 'id' | 'name' | 'ip'> => row !== null)

      if (configs.length === 0) {
        console.warn('[Radar] Supabase returned no usable printers. Keeping the current runtime config.')
        return
      }

      this.printers = configs.map((config) => {
        const previous = this.printers.find(
          (printer) => printer.id === config.id || printer.ip === config.ip,
        )

        return this.createPrinterRuntime(config, previous)
      })
    } catch (error) {
      console.error('[Radar] Failed to refresh printers from Supabase. Keeping current config.', error)
    }
  }

  private normalizePrinterConfigRow(
    row: Partial<PrinterConfigRow>,
  ): Pick<PrinterStatusSnapshot, 'id' | 'name' | 'ip'> | null {
    const ip = typeof row.ip === 'string' ? row.ip.trim() : ''
    if (!ip) {
      return null
    }

    const rawId = row.id
    const id = rawId === undefined || rawId === null ? ip : String(rawId)
    const name = typeof row.name === 'string' && row.name.trim().length > 0
      ? row.name.trim()
      : `Printer ${id}`

    return {
      id,
      name,
      ip,
    }
  }

  private describeConfiguredPrinters() {
    return this.printers.map((printer) => `${printer.name} (${printer.ip})`).join(', ')
  }

  private syncAuthorizationState(printer: PrinterRuntime, nowIso = new Date().toISOString()) {
    if (printer.authorization.state !== 'authorized') {
      return
    }

    const activityIsLive =
      printer.activity.state === 'heating' || printer.activity.state === 'printing'

    if (printer.authorization.sessionState === 'pending_start' && activityIsLive) {
      printer.authorization = {
        ...printer.authorization,
        sessionState: 'active_print',
        activatedAt: printer.authorization.activatedAt ?? nowIso,
        expiresAt: null,
      }
      return
    }

    if (printer.authorization.sessionState === 'active_print') {
      if (
        activityIsLive ||
        printer.activity.state === 'unknown' ||
        printer.connectivity.state === 'offline'
      ) {
        return
      }

      printer.authorization = this.createUnauthorizedAuthorization()
      return
    }

    const expiresAt = printer.authorization.expiresAt
    if (!expiresAt) {
      return
    }

    if (Date.parse(expiresAt) <= Date.parse(nowIso)) {
      printer.authorization = this.createUnauthorizedAuthorization()
    }
  }

  private clonePrinter(printer: PrinterRuntime): PrinterStatusSnapshot {
    return {
      id: printer.id,
      name: printer.name,
      ip: printer.ip,
      authorization: { ...printer.authorization },
      connectivity: { ...printer.connectivity },
      activity: { ...printer.activity },
      telemetry: {
        ...printer.telemetry,
        nozzle: { ...printer.telemetry.nozzle },
        bed: { ...printer.telemetry.bed },
      },
      enforcement: { ...printer.enforcement },
    }
  }

  private async updateEnforcement(printer: PrinterRuntime, nowIso: string) {
    const unauthorizedActivity =
      printer.authorization.state === 'unauthorized' &&
      (printer.activity.state === 'heating' || printer.activity.state === 'printing')

    if (!unauthorizedActivity) {
      if (printer.enforcementRuntime.incidentActive && printer.activity.state === 'idle') {
        printer.enforcement = {
          mode: 'auto-snipe',
          state: 'aborted',
          lastAction: 'abort_sent',
          reason: 'The printer returned to idle after the watchdog sent ~M26.',
        }
        printer.enforcementRuntime.incidentActive = false
        printer.enforcementRuntime.lastAbortAttemptAt = null
        return
      }

      if (printer.authorization.state === 'authorized') {
        printer.enforcementRuntime.incidentActive = false
        printer.enforcementRuntime.lastAbortAttemptAt = null
        printer.enforcement = {
          mode: 'auto-snipe',
          state: 'idle',
          lastAction: printer.enforcement.lastAction,
          reason: 'Printer is authorized. Auto-snipe is armed but inactive for this session.',
        }
        return
      }

      if (printer.activity.state === 'idle') {
        printer.enforcementRuntime.lastAbortAttemptAt = null
      }

      printer.enforcement = {
        mode: 'auto-snipe',
        state: 'idle',
        lastAction: printer.enforcement.lastAction,
        reason: 'Auto-snipe is armed. Unauthorized bed heating or print activity will receive ~M26 once per incident.',
      }
      return
    }

    if (printer.enforcementRuntime.incidentActive) {
        printer.enforcement = {
          mode: 'auto-snipe',
          state: 'aborting',
          lastAction: 'abort_sent',
          reason: 'Unauthorized printer activity detected. The watchdog already sent ~M26 and is waiting for the printer to return to idle.',
        }
      return
    }

    const nowMs = Date.now()
    if (
      printer.enforcement.lastAction === 'abort_failed' &&
      printer.enforcementRuntime.lastAbortAttemptAt !== null &&
      nowMs - printer.enforcementRuntime.lastAbortAttemptAt < this.ABORT_RETRY_COOLDOWN_MS
    ) {
      const retrySeconds = Math.max(
        1,
        Math.ceil(
          (this.ABORT_RETRY_COOLDOWN_MS - (nowMs - printer.enforcementRuntime.lastAbortAttemptAt)) / 1000,
        ),
      )
      printer.enforcement = {
        mode: 'auto-snipe',
        state: 'error',
        lastAction: 'abort_failed',
        reason: `Unauthorized printer activity detected, but the last ~M26 attempt failed. Retrying in about ${retrySeconds} second${retrySeconds === 1 ? '' : 's'}.`,
      }
      return
    }

    printer.enforcement = {
      mode: 'auto-snipe',
      state: 'aborting',
      lastAction: printer.enforcement.lastAction,
      reason: `Unauthorized ${printer.activity.state} detected. Sending ~M26 now.`,
    }
    printer.enforcementRuntime.lastAbortAttemptAt = nowMs

    const abortProbe = await this.tryProbe(
      printer.ip,
      this.ABORT_COMMAND,
      this.getPortOrder(printer.connectivity.lastPort),
    )

    if (abortProbe.ok) {
      printer.connectivity = {
        ...printer.connectivity,
        lastPort: abortProbe.port,
      }
      printer.enforcementRuntime.incidentActive = true
      printer.enforcement = {
        mode: 'auto-snipe',
        state: 'aborting',
        lastAction: 'abort_sent',
        reason: `Unauthorized ${printer.activity.state} detected. Sent ~M26 on port ${abortProbe.port}; waiting for the printer to settle back to idle.`,
      }
      return
    }

    printer.enforcement = {
      mode: 'auto-snipe',
      state: 'error',
      lastAction: 'abort_failed',
      reason: `Unauthorized ${printer.activity.state} detected, but ~M26 failed: ${abortProbe.error}`,
    }
  }

  private updateEnforcementWhenOffline(printer: PrinterRuntime) {
    if (printer.enforcementRuntime.incidentActive) {
      printer.enforcement = {
        mode: 'auto-snipe',
        state: 'aborting',
        lastAction: 'abort_sent',
        reason: 'The watchdog already sent ~M26 for this incident. Waiting for the printer to reconnect or return to idle.',
      }
      return
    }

    printer.enforcement = {
      mode: 'auto-snipe',
      state: 'idle',
      lastAction: printer.enforcement.lastAction,
      reason: 'Printer is offline, so auto-snipe cannot evaluate a new print right now.',
    }
  }

  private async tryHandshakePorts(
    ip: string,
    command: string,
    ports = this.PRINTER_PORTS,
  ): Promise<{ response: string; port: number }> {
    const errors: string[] = []

    for (const port of ports) {
      try {
        const response = await this.sendCommand(ip, port, command)
        return { response, port }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        errors.push(`${port}: ${message}`)
      }
    }

    throw new Error(`No response to ${command} from ${ip}. Tried ${errors.join(' | ')}`)
  }

  private async tryProbe(
    ip: string,
    command: string,
    ports = this.PRINTER_PORTS,
  ): Promise<
    | { ok: true; response: string; port: number }
    | { ok: false; error: string }
  > {
    try {
      const result = await this.tryHandshakePorts(ip, command, ports)
      return {
        ok: true,
        ...result,
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private getPortOrder(preferredPort: number | null) {
    if (preferredPort === null) {
      return this.PRINTER_PORTS
    }

    return [preferredPort, ...this.PRINTER_PORTS.filter((port) => port !== preferredPort)]
  }

  private sendCommand(ip: string, port: number, command: string, timeoutMs = 2500): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket()
      let response = ''
      let settled = false
      let idleTimer: NodeJS.Timeout | null = null

      const cleanup = () => {
        if (idleTimer) {
          clearTimeout(idleTimer)
          idleTimer = null
        }
      }

      const finish = (callback: () => void) => {
        if (settled) {
          return
        }

        settled = true
        cleanup()
        socket.destroy()
        callback()
      }

      const resolveSoon = () => {
        cleanup()
        idleTimer = setTimeout(() => {
          finish(() => resolve(response))
        }, 200)
      }

      socket.setTimeout(timeoutMs)

      socket.connect(port, ip, () => {
        console.log(`[Radar] Connected to ${ip}:${port}, sending ${command}`)
        socket.write(`${command}\r\n`)
      })

      socket.on('data', (chunk) => {
        response += chunk.toString()
        console.log(`[Radar] Received ${chunk.length} byte(s) from ${ip}:${port}`)
        resolveSoon()
      })

      socket.on('timeout', () => {
        finish(() => {
          if (response.length > 0) {
            resolve(response)
            return
          }

          reject(new Error(`Timed out waiting for response to ${command} from ${ip}:${port}`))
        })
      })

      socket.on('error', (error) => {
        finish(() => reject(error))
      })

      socket.on('close', () => {
        if (!settled) {
          finish(() => {
            if (response.length > 0) {
              resolve(response)
              return
            }

            reject(new Error(`Connection closed before response from ${ip}:${port}`))
          })
        }
      })
    })
  }

  private parseTelemetry(response: string): Omit<PrinterStatusSnapshot['telemetry'], 'rawResponse'> {
    const nozzle = this.parseTemperaturePair(response, /(?:^|\s)T:(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/)
    const bed = this.parseTemperaturePair(response, /(?:^|\s)B:(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/)

    console.log(
      `[Radar] Parsed temps -> nozzle: ${this.formatTelemetry(nozzle)}, bed: ${this.formatTelemetry(bed)}`,
    )

    return {
      command: '~M105',
      nozzle,
      bed,
    }
  }

  private emptyTelemetry(): Omit<PrinterStatusSnapshot['telemetry'], 'rawResponse'> {
    return {
      command: '~M105',
      nozzle: {
        current: null,
        target: null,
      },
      bed: {
        current: null,
        target: null,
      },
    }
  }

  private parseTemperaturePair(response: string, pattern: RegExp): TemperatureTelemetry {
    const match = response.match(pattern)
    if (!match) {
      return {
        current: null,
        target: null,
      }
    }

    return {
      current: Number.parseFloat(match[1]),
      target: Number.parseFloat(match[2]),
    }
  }

  private deriveActivity(
    activityResponse: string | null,
    hasTelemetryResponse: boolean,
    telemetry: Omit<PrinterStatusSnapshot['telemetry'], 'rawResponse'>,
  ): PrinterStatusSnapshot['activity'] {
    const normalizedResponse = activityResponse?.trim() ?? ''
    const progress = this.parseM27Progress(normalizedResponse)
    const temperatureFallback = this.deriveTemperatureActivity(telemetry)

    if (normalizedResponse.length > 0) {
      if (/not sd printing|no print job|sd print paused|idle/i.test(normalizedResponse)) {
        return {
          state: 'idle',
          source: 'm27-status',
          reason: 'Printer reported no active SD print via ~M27.',
          command: '~M27',
          rawResponse: normalizedResponse,
        }
      }

      if (/sd printing byte|printing byte|sd printing|print progress/i.test(normalizedResponse)) {
        if (this.hasStrongProgressSignal(progress)) {
          if (temperatureFallback.state === 'heating' || temperatureFallback.state === 'printing') {
            return {
              ...temperatureFallback,
              reason: 'The printer reported active SD print progress and heater targets are active.',
              command: '~M27',
              rawResponse: normalizedResponse,
            }
          }

          return {
            state: 'printing',
            source: 'm27-status',
            reason: 'The printer reported active SD print progress via ~M27.',
            command: '~M27',
            rawResponse: normalizedResponse,
          }
        }

        if (temperatureFallback.state === 'idle') {
          return {
            state: 'idle',
            source: 'temperature-heuristic',
            reason:
              'The printer reported an SD print placeholder via ~M27, but heater targets are off, so the printer is treated as idle.',
            command: '~M27',
            rawResponse: normalizedResponse,
          }
        }

        return {
          ...temperatureFallback,
          reason:
            'The ~M27 reply looked like a placeholder, so availability followed the live heater targets instead.',
          command: '~M27',
          rawResponse: normalizedResponse,
        }
      }
    }

    if (!hasTelemetryResponse) {
      return {
        state: 'unknown',
        source: 'm27-status',
        reason: normalizedResponse.length > 0
          ? 'The printer acknowledged ~M27, but the reply did not include a recognizable print-state string.'
          : 'The printer did not return a recognizable ~M27 print-state string.',
        command: '~M27',
        rawResponse: normalizedResponse || null,
      }
    }

    const fallbackReasonPrefix = normalizedResponse.length > 0
      ? 'The ~M27 reply did not expose a recognizable print-state string, so activity fell back to temperature telemetry. '
      : 'The ~M27 probe did not return usable state, so activity fell back to temperature telemetry. '

    return {
      ...temperatureFallback,
      reason: `${fallbackReasonPrefix}${temperatureFallback.reason}`,
      command: '~M27',
      rawResponse: normalizedResponse || null,
    }
  }

  private parseM27Progress(response: string) {
    const byteMatch = response.match(/printing byte\s+(\d+)\s*\/\s*(\d+)/i)
    const layerMatch = response.match(/layer:\s*(\d+)\s*\/\s*(\d+)/i)

    return {
      bytesCurrent: byteMatch ? Number.parseInt(byteMatch[1], 10) : null,
      bytesTotal: byteMatch ? Number.parseInt(byteMatch[2], 10) : null,
      layerCurrent: layerMatch ? Number.parseInt(layerMatch[1], 10) : null,
      layerTotal: layerMatch ? Number.parseInt(layerMatch[2], 10) : null,
    }
  }

  private hasStrongProgressSignal(progress: {
    bytesCurrent: number | null
    bytesTotal: number | null
    layerCurrent: number | null
    layerTotal: number | null
  }) {
    const byteProgress =
      progress.bytesCurrent !== null &&
      progress.bytesTotal !== null &&
      progress.bytesTotal > 0 &&
      progress.bytesCurrent > 0
    const layerProgress =
      progress.layerCurrent !== null &&
      progress.layerTotal !== null &&
      progress.layerTotal > 0 &&
      progress.layerCurrent > 0

    return byteProgress || layerProgress
  }

  private deriveTemperatureActivity(
    telemetry: Omit<PrinterStatusSnapshot['telemetry'], 'rawResponse'>,
  ): Omit<PrinterStatusSnapshot['activity'], 'command' | 'rawResponse'> {
    const bedTarget = telemetry.bed.target ?? 0
    const bedCurrent = telemetry.bed.current

    if (bedTarget <= 0) {
      return {
        state: 'idle',
        source: 'temperature-heuristic',
        reason: 'No bed target temperature is set.',
      }
    }

    const bedHeating = bedCurrent === null || bedCurrent + 2 < bedTarget

    if (bedHeating) {
      return {
        state: 'heating',
        source: 'temperature-heuristic',
        reason: 'A bed target is set and the printer is still warming toward that target.',
      }
    }

    return {
      state: 'printing',
      source: 'temperature-heuristic',
      reason: 'The bed target is active and the current bed temperature is near that target.',
    }
  }

  private formatTelemetry(telemetry: TemperatureTelemetry): string {
    if (telemetry.current === null || telemetry.target === null) {
      return 'n/a'
    }

    return `${telemetry.current}/${telemetry.target}`
  }

  public authorize(printerId: string, request: AuthorizationRequest = {}) {
    const printer = this.printers.find((item) => item.id === printerId)
    if (!printer) {
      return false
    }

    const requestedMinutes =
      typeof request.durationMinutes === 'number' && Number.isFinite(request.durationMinutes)
        ? request.durationMinutes
        : this.DEFAULT_SESSION_MINUTES
    const durationMinutes = Math.min(Math.max(requestedMinutes, 1), 30)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000).toISOString()

    printer.authorization = {
      state: 'authorized',
      sessionState: 'pending_start',
      grantedAt: now.toISOString(),
      expiresAt,
      activatedAt: null,
      studentId: request.studentId?.trim() || null,
      cardId: request.cardId?.trim() || null,
      firstName: request.firstName?.trim() || null,
    }
    return true
  }

  public deauthorize(printerId: string) {
    const printer = this.printers.find((item) => item.id === printerId)
    if (!printer) {
      return false
    }

    printer.authorization = this.createUnauthorizedAuthorization()
    return true
  }

  public getStatus(): PrinterStatusSnapshot[] {
    const nowIso = new Date().toISOString()
    this.printers.forEach((printer) => {
      this.syncAuthorizationState(printer, nowIso)
    })

    return this.printers.map((printer) => this.clonePrinter(printer))
  }
}
