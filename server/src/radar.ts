import * as net from 'net'
import { supabase } from './db'

interface Printer {
  ip: string
  name: string
  authorized: boolean
  status: 'idle' | 'armed' | 'printing' | 'sniped'
  printerId: string
}

type PrinterRow = {
  id: string
  ip: string
  name: string
  status: Printer['status'] | null
}

export class PrinterRadar {
  private printers: Printer[] = []
  private interval: NodeJS.Timeout | null = null
  private readonly POLL_INTERVAL = 2000
  private readonly PRINTER_PORT = 8899
  private readonly HOTSPOT_SUBNET = '192.168.137'
  private readonly DISCOVERY_TIMEOUT = 1000
  private readonly DISCOVERY_CONCURRENCY = 20

  async start() {
    await this.discoverPrinters()
    await this.loadPrinters()
    console.log(`PrinterRadar loaded ${this.printers.length} printer(s)`)

    if (this.interval) {
      clearInterval(this.interval)
    }

    this.interval = setInterval(() => {
      void this.poll()
    }, this.POLL_INTERVAL)

    void this.poll()
  }

  private async discoverPrinters() {
    console.log(`Starting printer discovery on ${this.HOTSPOT_SUBNET}.0/24`)
    const candidates = Array.from({ length: 254 }, (_, index) => {
      return `${this.HOTSPOT_SUBNET}.${index + 1}`
    })

    for (let index = 0; index < candidates.length; index += this.DISCOVERY_CONCURRENCY) {
      const batch = candidates.slice(index, index + this.DISCOVERY_CONCURRENCY)
      await Promise.all(batch.map(async (ip) => this.probeAndRegister(ip)))
    }
  }

  private async loadPrinters() {
    const { data, error } = await supabase
      .from('printers')
      .select('id, ip, name, status')

    if (error) {
      console.error('Failed to load printers from Supabase', error)
      this.printers = []
      return
    }

    this.printers = ((data ?? []) as PrinterRow[]).map((printer) => ({
      ip: printer.ip,
      name: printer.name,
      authorized: false,
      status: this.normalizeStatus(printer.status),
      printerId: printer.id,
    }))
  }

  private async probeAndRegister(ip: string) {
    try {
      const response = await this.sendCommand(ip, 'M105', this.DISCOVERY_TIMEOUT)
      if (!this.looksLikeMarlin(response)) {
        return
      }

      const { data: existingPrinter, error: lookupError } = await supabase
        .from('printers')
        .select('id')
        .eq('ip', ip)
        .maybeSingle()

      if (lookupError) {
        console.error(`Failed to check printer record for ${ip}`, lookupError)
        return
      }

      if (existingPrinter) {
        return
      }

      const suffix = ip.split('.').at(-1) ?? 'unknown'
      const { error: insertError } = await supabase.from('printers').insert({
        ip,
        name: `Printer ${suffix}`,
        status: 'idle',
      })

      if (insertError) {
        console.error(`Failed to register discovered printer ${ip}`, insertError)
        return
      }

      console.log(`Discovered and registered printer at ${ip}`)
    } catch {
      // Most IPs on the subnet will not be printers. Silence routine misses.
    }
  }

  private async poll() {
    console.log(
      `[Radar] Poll cycle started at ${new Date().toISOString()} for ${this.printers.length} printer(s)`,
    )

    await Promise.all(
      this.printers.map(async (printer) => {
        try {
          console.log(`[Radar] Sending M105 to ${printer.name} (${printer.ip})`)
          const response = await this.sendCommand(printer.ip, 'M105')
          const targetBedTemp = this.parseTargetBedTemp(response)
          console.log(
            `[Radar] Response from ${printer.name} (${printer.ip}): ${response.trim()} | target bed ${targetBedTemp}`,
          )

          if (targetBedTemp > 0) {
            if (printer.authorized) {
              printer.status = 'printing'
              console.log(`[Radar] ${printer.name} is authorized and currently printing`)
            } else {
              console.log(
                `[Radar] Unauthorized print detected on ${printer.name}; sending M26 and M140 S0`,
              )
              await this.sendCommand(printer.ip, 'M26')
              await this.sendCommand(printer.ip, 'M140 S0')
              printer.status = 'sniped'
              await this.logSnipe(printer)
              setTimeout(() => {
                if (!printer.authorized) {
                  printer.status = 'idle'
                }
              }, 5000)
            }
            return
          }

          printer.status = printer.authorized ? 'armed' : 'idle'
          console.log(`[Radar] ${printer.name} is ${printer.status} after poll`)
        } catch (error) {
          console.error(`Radar poll failed for ${printer.name} (${printer.ip})`, error)
          printer.status = printer.authorized ? 'armed' : 'idle'
        }
      }),
    )
  }

  private sendCommand(ip: string, command: string, timeoutMs = 2500): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket()
      let response = ''
      let settled = false

      const finish = (callback: () => void) => {
        if (settled) {
          return
        }

        settled = true
        socket.destroy()
        callback()
      }

      socket.setTimeout(timeoutMs)

      socket.connect(this.PRINTER_PORT, ip, () => {
        socket.write(`${command}\r\n`)
      })

      socket.on('data', (chunk) => {
        response += chunk.toString()

        if (response.includes('ok')) {
          finish(() => resolve(response))
        }
      })

      socket.on('timeout', () => {
        finish(() => reject(new Error(`Timed out sending ${command} to ${ip}`)))
      })

      socket.on('error', (error) => {
        finish(() => reject(error))
      })

      socket.on('close', () => {
        if (!settled) {
          settled = true
          if (response.length > 0) {
            resolve(response)
          } else {
            reject(new Error(`Connection closed before response from ${ip}`))
          }
        }
      })
    })
  }

  private parseTargetBedTemp(response: string): number {
    const match = response.match(/B:(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/)
    if (!match) {
      console.log(`[Radar] Could not parse target bed temp from response: ${response.trim()}`)
      return 0
    }

    const currentBedTemp = Number.parseFloat(match[1])
    const targetBedTemp = Number.parseFloat(match[2])
    console.log(
      `[Radar] Parsed bed temps -> current: ${currentBedTemp}, target: ${targetBedTemp}`,
    )

    return targetBedTemp
  }

  private looksLikeMarlin(response: string): boolean {
    return response.includes('ok') && response.includes('B:')
  }

  public authorize(ip: string) {
    const printer = this.printers.find((item) => item.ip === ip)
    if (!printer) {
      return
    }

    printer.authorized = true
    if (printer.status === 'idle') {
      printer.status = 'armed'
    }
  }

  public deauthorize(ip: string) {
    const printer = this.printers.find((item) => item.ip === ip)
    if (!printer) {
      return
    }

    printer.authorized = false
    if (printer.status === 'armed' || printer.status === 'sniped') {
      printer.status = 'idle'
    }
  }

  public getStatus(): Printer[] {
    return this.printers.map((printer) => ({ ...printer }))
  }

  private async logSnipe(printer: Printer) {
    console.log(`[Radar] Logging snipe_fired event for ${printer.name} (${printer.ip})`)
    const { error } = await supabase.from('events').insert({
      printer_id: printer.printerId,
      event_type: 'snipe_fired',
    })

    if (error) {
      console.error(`Failed to log snipe event for ${printer.name}`, error)
    }
  }

  private normalizeStatus(status: Printer['status'] | null): Printer['status'] {
    if (
      status === 'idle' ||
      status === 'armed' ||
      status === 'printing' ||
      status === 'sniped'
    ) {
      return status
    }

    return 'idle'
  }
}
