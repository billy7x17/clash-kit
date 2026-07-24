import fs from 'fs'
import path from 'path'
import axios from 'axios'
import ora from 'ora'
import * as api from './api.js'
import YAML from 'yaml'
import { CONFIG_PATH, CURRENT_PROFILE_PATH, PROFILES_DIR } from './paths.js'

export { CONFIG_PATH, CURRENT_PROFILE_PATH, PROFILES_DIR }

export async function downloadSubscription(url: string, name: string, userAgent?: string): Promise<string> {
  const ua = userAgent || 'clash-verge/2.4.0'
  const spinner = ora(`正在下载订阅 ${name}...`).start()
  try {
    const res = await axios.get(url, {
      responseType: 'text',
      timeout: 30000,
      headers: {
        'User-Agent': ua,
        Accept: 'text/yaml, text/plain, */*',
      },
      validateStatus: null,
    })

    if (res.status !== 200) {
      spinner.fail(`下载订阅失败: HTTP ${res.status}`)
      console.error(`\n--- 订阅下载诊断信息 ---`)
      console.error(`请求URL: ${url}`)
      console.error(`订阅名称: ${name}`)
      console.error(`HTTP状态码: ${res.status} ${res.statusText}`)
      console.error(`响应头:`)
      for (const [key, value] of Object.entries(res.headers)) {
        console.error(`  ${key}: ${value}`)
      }
      if (res.data) {
        const preview = typeof res.data === 'string' ? res.data.substring(0, 2000) : String(res.data).substring(0, 2000)
        console.error(`响应体(前2000字符):\n${preview}`)
      }
      console.error(`--- 诊断信息结束 ---\n`)
      throw new Error(
        `下载订阅失败: HTTP ${res.status}${res.status === 403 ? ' (403 Forbidden — 订阅链接可能需要更新或包含认证信息)' : ''}`,
      )
    }

    let content: string = res.data

    let isConfig = false
    try {
      const parsed = YAML.parse(content)
      if (parsed && typeof parsed === 'object' && (parsed.proxies || parsed.Proxy || parsed.port)) {
        isConfig = true
      }
    } catch {
      console.warn('订阅服务商返回的不是有效 YAML，尝试 Base64 解码...')
    }

    if (!isConfig) {
      try {
        const decoded = Buffer.from(content, 'base64').toString('utf-8')
        const parsedDecoded = YAML.parse(decoded)
        if (
          parsedDecoded &&
          typeof parsedDecoded === 'object' &&
          (parsedDecoded.proxies || parsedDecoded.Proxy || parsedDecoded.port)
        ) {
          content = decoded
        }
      } catch {
        console.warn('Base64 解码失败，保留原始内容')
      }
    }

    const filePath = path.join(PROFILES_DIR, `${name}.yaml`)
    fs.writeFileSync(filePath, content)
    spinner.succeed(`订阅 ${name} 下载成功`)
    return filePath
  } catch (err: unknown) {
    const error = err as Error & {
      code?: string
      response?: { status: number; headers: Record<string, unknown>; data: unknown }
    }
    if (error.message && error.message.startsWith('下载订阅失败:')) {
      throw err
    }
    spinner.fail(`下载订阅失败: ${error.message}`)
    console.error(`\n--- 订阅下载诊断信息 ---`)
    console.error(`请求URL: ${url}`)
    console.error(`订阅名称: ${name}`)
    console.error(`错误类型: ${error.code || '未知'}`)
    if (error.response) {
      console.error(`HTTP状态码: ${error.response.status}`)
      console.error(`响应头:`)
      for (const [key, value] of Object.entries(error.response.headers)) {
        console.error(`  ${key}: ${value}`)
      }
      if (error.response.data) {
        const preview =
          typeof error.response.data === 'string'
            ? error.response.data.substring(0, 2000)
            : JSON.stringify(error.response.data).substring(0, 2000)
        console.error(`响应体(前2000字符):\n${preview}`)
      }
    }
    console.error(`--- 诊断信息结束 ---\n`)
    throw new Error(`下载订阅失败: ${error.message}`)
  }
}

export function listProfiles(): string[] {
  return fs
    .readdirSync(PROFILES_DIR)
    .filter(f => f.endsWith('.yaml'))
    .map(f => f.replace('.yaml', ''))
}

export async function getCurrentProfile(): Promise<string | null> {
  if (fs.existsSync(CURRENT_PROFILE_PATH)) {
    return fs.readFileSync(CURRENT_PROFILE_PATH, 'utf8').trim()
  }
  return null
}

export async function useProfile(name: string): Promise<void> {
  const source = path.join(PROFILES_DIR, `${name}.yaml`)
  if (!fs.existsSync(source)) throw new Error(`配置文件 ${name} 不存在`)

  const spinner = ora(`正在切换到配置 ${name}...`).start()

  const subscriptionConfig = YAML.parse(fs.readFileSync(source, 'utf8'))

  const hasExistingConfig = fs.existsSync(CONFIG_PATH)
  let existingConfig: Record<string, unknown> = {}
  if (hasExistingConfig) {
    existingConfig = YAML.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
  }

  const defaultDNS: Record<string, unknown> = {
    enable: true,
    ipv6: false,
    'enhanced-mode': 'redir-host',
    nameserver: ['223.5.5.5', '119.29.29.29', '114.114.114.114'],
    fallback: ['https://1.1.1.1/dns-query', 'https://8.8.8.8/dns-query'],
    'fallback-filter': {
      geoip: true,
      'geoip-code': 'CN',
      ipcidr: ['240.0.0.0/4', '0.0.0.0/32'],
    },
  }

  const USER_DEFAULTS: Record<string, unknown> = {
    port: 7890,
    'socks-port': 7891,
    'allow-lan': true,
    mode: 'Rule',
    'log-level': 'info',
    'external-controller': '127.0.0.1:9090',
  }

  const SUBSCRIPTION_KEYS = ['proxies', 'proxy-groups', 'rules']

  let mergedConfig: Record<string, unknown>

  if (hasExistingConfig) {
    mergedConfig = { ...existingConfig }
    for (const key of SUBSCRIPTION_KEYS) {
      if (subscriptionConfig[key] !== undefined) {
        mergedConfig[key] = subscriptionConfig[key]
      }
    }
    mergedConfig.dns = subscriptionConfig.dns || existingConfig.dns || defaultDNS
  } else {
    mergedConfig = { ...subscriptionConfig }
    for (const [key, value] of Object.entries(USER_DEFAULTS)) {
      mergedConfig[key] = value
    }
    if (!mergedConfig.dns) {
      mergedConfig.dns = defaultDNS
    }
  }

  fs.writeFileSync(CONFIG_PATH, YAML.stringify(mergedConfig))
  fs.writeFileSync(CURRENT_PROFILE_PATH, name)

  if (await api.isClashRunning()) {
    try {
      await api.reloadConfig(CONFIG_PATH)
      spinner.succeed('Clash 配置已切换并热重载生效')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      spinner.warn(`配置已切换，但热重载失败: ${message}`)
    }
  } else {
    spinner.succeed('配置已切换（Clash 未运行，将在下次启动时生效）')
  }
}

export function deleteProfile(name: string): void {
  const filePath = path.join(PROFILES_DIR, `${name}.yaml`)
  if (!fs.existsSync(filePath)) throw new Error(`订阅 ${name} 不存在`)
  fs.unlinkSync(filePath)
  if (fs.existsSync(CURRENT_PROFILE_PATH)) {
    const current = fs.readFileSync(CURRENT_PROFILE_PATH, 'utf8').trim()
    if (current === name) fs.unlinkSync(CURRENT_PROFILE_PATH)
  }
}

export function renameProfile(oldName: string, newName: string): void {
  const oldPath = path.join(PROFILES_DIR, `${oldName}.yaml`)
  const newPath = path.join(PROFILES_DIR, `${newName}.yaml`)
  if (!fs.existsSync(oldPath)) throw new Error(`订阅 ${oldName} 不存在`)
  if (fs.existsSync(newPath)) throw new Error(`订阅名称 ${newName} 已存在`)
  fs.renameSync(oldPath, newPath)
  if (fs.existsSync(CURRENT_PROFILE_PATH)) {
    const current = fs.readFileSync(CURRENT_PROFILE_PATH, 'utf8').trim()
    if (current === oldName) fs.writeFileSync(CURRENT_PROFILE_PATH, newName)
  }
}
