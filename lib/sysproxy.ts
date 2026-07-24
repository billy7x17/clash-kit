import { triggerManualProxy } from '@mihomo-party/sysproxy'
import { execSync } from 'child_process'
import * as api from './api.js'

const defaultBypass: string[] = (() => {
  switch (process.platform) {
    case 'linux':
      return ['localhost', '127.0.0.1', '192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12', '::1']
    case 'darwin':
      return [
        '127.0.0.1',
        '192.168.0.0/16',
        '10.0.0.0/8',
        '172.16.0.0/12',
        'localhost',
        '*.local',
        '*.crashlytics.com',
        '<local>',
      ]
    case 'win32':
      return [
        'localhost',
        '127.*',
        '192.168.*',
        '10.*',
        '172.16.*',
        '172.17.*',
        '172.18.*',
        '172.19.*',
        '172.20.*',
        '172.21.*',
        '172.22.*',
        '172.23.*',
        '172.24.*',
        '172.25.*',
        '172.26.*',
        '172.27.*',
        '172.28.*',
        '172.29.*',
        '172.30.*',
        '172.31.*',
        '<local>',
      ]
    default:
      return ['localhost', '127.0.0.1', '192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12', '::1']
  }
})()

export async function enableSystemProxy(): Promise<{ success: boolean; host?: string; port?: number; error?: string }> {
  try {
    const config = await api.getConfig()
    const port = config['mixed-port'] || config['port']
    if (!port) throw new Error('未找到 HTTP 代理端口配置 (port 或 mixed-port)')
    const host = '127.0.0.1'
    const bypass = defaultBypass.join(',')

    triggerManualProxy(true, host, port as number, bypass)
    return { success: true, host, port: port as number }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

export async function disableSystemProxy(): Promise<{ success: boolean; error?: string }> {
  try {
    triggerManualProxy(false, '', 0, '')
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

export interface SystemProxyStatus {
  enabled: boolean
  server?: string
  port?: string
  error?: string
}

export async function getSystemProxyStatus(): Promise<SystemProxyStatus> {
  if (process.platform === 'darwin') {
    try {
      const output = execSync('networksetup -getwebproxy Wi-Fi', { encoding: 'utf-8' })
      const enabled = output.includes('Enabled: Yes')
      if (enabled) {
        const serverMatch = output.match(/Server: (.+)/)
        const portMatch = output.match(/Port: (\d+)/)
        const server = serverMatch ? serverMatch[1].trim() : ''
        const port = portMatch ? portMatch[1].trim() : ''
        return { enabled: true, server, port }
      }
      return { enabled: false }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      return { enabled: false, error: message }
    }
  } else if (process.platform === 'win32') {
    try {
      const regPath = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'
      const enableOutput = execSync(`reg query "${regPath}" /v ProxyEnable`, { encoding: 'utf-8' })
      const isEnabled = /ProxyEnable\s+REG_DWORD\s+0x1/.test(enableOutput)

      if (isEnabled) {
        let server = ''
        let port = ''
        try {
          const serverOutput = execSync(`reg query "${regPath}" /v ProxyServer`, { encoding: 'utf-8' })
          const match = serverOutput.match(/ProxyServer\s+REG_SZ\s+(.*)/)

          if (match && match[1]) {
            const fullAddress = match[1].trim()
            const lastColonIndex = fullAddress.lastIndexOf(':')
            if (lastColonIndex !== -1) {
              server = fullAddress.substring(0, lastColonIndex)
              port = fullAddress.substring(lastColonIndex + 1)
            } else {
              server = fullAddress
            }
          }
        } catch {
          // 忽略获取详细信息的错误
        }
        return { enabled: true, server, port }
      }
      return { enabled: false }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      return { enabled: false, error: message }
    }
  } else {
    return { enabled: false, error: '不支持的平台' }
  }
}
