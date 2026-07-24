import { execSync } from 'child_process'
import fs from 'fs'
import YAML from 'yaml'
import { reloadConfig } from './api.js'
import { CLASH_BIN_PATH, CONFIG_PATH } from './paths.js'

export function checkTunPermissions(): boolean {
  if (process.platform === 'win32') return true

  try {
    const stats = fs.statSync(CLASH_BIN_PATH)
    const isRootOwned = stats.uid === 0
    const hasSuid = (stats.mode & 0o4000) === 0o4000
    return isRootOwned && hasSuid
  } catch {
    return false
  }
}

export function setupPermissions(): boolean {
  if (process.platform === 'win32') {
    throw new Error('Windows 请使用管理员身份运行终端即可')
  }

  const group = process.platform === 'darwin' ? 'admin' : 'root'
  const cmdChown = `chown root:${group} "${CLASH_BIN_PATH}"`
  const cmdChmod = `chmod +sx "${CLASH_BIN_PATH}"`

  try {
    console.log('正在提升内核权限 (需要 sudo 密码)...')
    execSync(`sudo ${cmdChown}`, { stdio: 'inherit' })
    execSync(`sudo ${cmdChmod}`, { stdio: 'inherit' })
    return true
  } catch {
    throw new Error('权限设置失败')
  }
}

export async function isTunEnabled(): Promise<boolean> {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return false
    const file = fs.readFileSync(CONFIG_PATH, 'utf8')
    const config = YAML.parse(file)
    return config?.tun?.enable === true
  } catch {
    return false
  }
}

export async function enableTun(): Promise<void> {
  await updateTunConfig(true)
}

export async function disableTun(): Promise<void> {
  await updateTunConfig(false)
}

async function updateTunConfig(enable: boolean): Promise<void> {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      throw new Error('配置文件不存在')
    }

    const file = fs.readFileSync(CONFIG_PATH, 'utf8')
    const config = YAML.parse(file) || {}

    if (!config.tun) {
      config.tun = {}
    }

    config.tun.enable = enable
    if (enable) {
      config.tun.stack = 'mixed'
      config.tun['auto-route'] = true
      config.tun['auto-detect-interface'] = true
      config.tun['dns-hijack'] = ['any:53']
      if (process.platform === 'darwin') {
        config.tun.device = 'utun1500'
      }
    }

    if (enable) {
      if (!config.dns) config.dns = {}

      config.dns.enable = true
      config.dns['enhanced-mode'] = 'fake-ip'
      config.dns.listen = config.dns.listen || '0.0.0.0:1053'
      config.dns.ipv6 = false

      const defaultNameservers = ['https://223.5.5.5/dns-query', 'https://doh.pub/dns-query', '8.8.8.8']

      if (!config.dns.nameserver || config.dns.nameserver.length === 0) {
        config.dns.nameserver = defaultNameservers
      }

      if (!config.dns['fake-ip-filter']) {
        config.dns['fake-ip-filter'] = ['*', '+.lan', '+.local']
      }
    }

    const newYaml = YAML.stringify(config)
    fs.writeFileSync(CONFIG_PATH, newYaml, 'utf8')

    await reloadConfig(CONFIG_PATH)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`修改 TUN 配置失败: ${message}`)
  }
}
