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

  async start() {
    await this.loadPrinters()

    if (this.interval) {
      clearInterval(this.interval)
    }

    this.interval = setInterval(() => {
      void this.poll()
    }, this.POLL_INTERVAL)

    void this.poll()
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

  private async poll() {
    await Promise.all(
      this.printers.map(async (printer) => {
        try {
          const response = await this.sendCommand(printer.ip, 'M105')
          const targetBedTemp = this.parseTargetBedTemp(response)

          if (targetBedTemp > 0) {
            if (printer.authorized) {
              printer.status = 'printing'
            } else {
              await this.sendCommand(printer.ip, 'M26')
              printer.status = 'sniped'
              await this.logSnipe(printer)
            }
            return
          }

          printer.status = printer.authorized ? 'armed' : 'idle'
        } catch (error) {
          console.error(`Radar poll failed for ${printer.name} (${printer.ip})`, error)
          printer.status = printer.authorized ? 'armed' : 'idle'
        }
      }),
    )
  }

  private sendCommand(ip: string, command: string): Promise<string> {
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

      socket.setTimeout(1500)

      socket.connect(this.PRINTER_PORT, ip, () => {
        socket.write(`${command}\n`)
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
    const match = response.match(/B:[^\r\n/]*\/([0-9]+(?:\.[0-9]+)?)/)
    return match ? Number.parseFloat(match[1]) : 0
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
    const { error } = await supabase.from('events').insert({
      printer: printer.printerId,
      event_type: 'snipe_fired',
      timestamp: new Date().toISOString(),
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
