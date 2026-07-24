import { execSync } from 'child_process'

/**
 * 获取 macOS 当前主要的网络服务名称 (Wi-Fi, Ethernet 等)
 */
function getMainNetworkService(): string | null {
  try {
    const output = execSync('networksetup -listallnetworkservices', { encoding: 'utf-8' })
    const services = output.split('\n').filter(s => s && !s.includes('An asterisk'))

    const wifi = services.find(s => s === 'Wi-Fi')
    const ethernet = services.find(s => s.includes('Ethernet') || s.includes('LAN'))

    return wifi || ethernet || services[0] || null
  } catch {
    console.error('获取网络服务失败')
    return null
  }
}

/**
 * 设置系统 DNS
 */
export function setDNS(servers: string[]): { success: boolean; error?: string } {
  if (process.platform !== 'darwin') {
    return { success: true }
  }

  const service = getMainNetworkService()
  if (!service) {
    return { success: false, error: '无法获取网络服务' }
  }

  const serversArg = servers.length > 0 ? servers.join(' ') : '"Empty"'

  try {
    execSync(`sudo networksetup -setdnsservers "${service}" ${serversArg}`)
    return { success: true }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return { success: false, error: message }
  }
}
