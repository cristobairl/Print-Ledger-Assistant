import * as net from 'net'
import type { PrinterStatusSnapshot, TemperatureTelemetry } from './printer-status'

type PrinterRuntime = PrinterStatusSnapshot

export class PrinterRadar {
  private printers: PrinterRuntime[] = [
    {
      id: 'handshake-only',
      name: 'Printer 70',
      ip: '192.168.137.162',
      authorization: {
        state: 'unauthorized',
      },
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
        mode: 'observe-only',
        state: 'idle',
        lastAction: 'none',
        reason: 'Observe-only mode. Abort commands are not enabled in the current backend.',
      },
    },
  ]
  private interval: NodeJS.Timeout | null = null
  private readonly POLL_INTERVAL = 2000
  private readonly PRINTER_PORTS = [8899, 8000]

  async start() {
    console.log(
      `PrinterRadar diagnostics enabled for ${this.printers[0].ip} using ~M27 and ~M105 on ports ${this.PRINTER_PORTS.join(', ')}`,
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
          printer.enforcement = {
            ...printer.enforcement,
            state: activity.state === 'printing' && printer.authorization.state === 'unauthorized'
              ? 'monitoring'
              : 'idle',
          }

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
          printer.enforcement = {
            ...printer.enforcement,
            state: 'idle',
          }
          console.error(`[Radar] Diagnostics failed for ${printer.name} (${printer.ip})`, error)
        }
      }),
    )
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
        return {
          state: 'printing',
          source: 'm27-status',
          reason: 'Printer reported an active print via ~M27.',
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
    const fallback = this.deriveTemperatureActivity(telemetry)

    return {
      ...fallback,
      reason: `${fallbackReasonPrefix}${fallback.reason}`,
      command: '~M27',
      rawResponse: normalizedResponse || null,
    }
  }

  private deriveTemperatureActivity(
    telemetry: Omit<PrinterStatusSnapshot['telemetry'], 'rawResponse'>,
  ): Omit<PrinterStatusSnapshot['activity'], 'command' | 'rawResponse'> {
    const nozzleTarget = telemetry.nozzle.target ?? 0
    const bedTarget = telemetry.bed.target ?? 0
    const nozzleCurrent = telemetry.nozzle.current
    const bedCurrent = telemetry.bed.current
    const maxTarget = Math.max(nozzleTarget, bedTarget)

    if (maxTarget <= 0) {
      return {
        state: 'idle',
        source: 'temperature-heuristic',
        reason: 'No nozzle or bed target temperature is set.',
      }
    }

    const nozzleHeating = nozzleCurrent !== null && nozzleTarget > 0 && nozzleCurrent + 2 < nozzleTarget
    const bedHeating = bedCurrent !== null && bedTarget > 0 && bedCurrent + 2 < bedTarget

    if (nozzleHeating || bedHeating) {
      return {
        state: 'heating',
        source: 'temperature-heuristic',
        reason: 'A heater target is set and the printer is still warming toward that target.',
      }
    }

    return {
      state: 'printing',
      source: 'temperature-heuristic',
      reason: 'Heater targets are active and current temperatures are near those targets.',
    }
  }

  private formatTelemetry(telemetry: TemperatureTelemetry): string {
    if (telemetry.current === null || telemetry.target === null) {
      return 'n/a'
    }

    return `${telemetry.current}/${telemetry.target}`
  }

  public authorize(printerId: string) {
    const printer = this.printers.find((item) => item.id === printerId)
    if (!printer) {
      return false
    }

    printer.authorization.state = 'authorized'
    return true
  }

  public deauthorize(printerId: string) {
    const printer = this.printers.find((item) => item.id === printerId)
    if (!printer) {
      return false
    }

    printer.authorization.state = 'unauthorized'
    return true
  }

  public getStatus(): PrinterStatusSnapshot[] {
    return this.printers.map((printer) => ({ ...printer }))
  }
}
