import fs from 'fs'
import path from 'path'
import axios from 'axios'
import ora from 'ora'
import * as api from './api.js'
import YAML from 'yaml'
import { CONFIG_PATH, CURRENT_PROFILE_PATH, PROFILES_DIR } from './paths.js'

export { CONFIG_PATH, CURRENT_PROFILE_PATH, PROFILES_DIR }

export async function downloadSubscription(url, name, userAgent) {
  const ua = userAgent || 'clash-verge/2.4.0' // 默认伪装成 clash-verge，大多数机场都兼容
  const spinner = ora(`正在下载订阅 ${name}...`).start()
  try {
    const res = await axios.get(url, {
      responseType: 'text',
      timeout: 30000,
      headers: {
        'User-Agent': ua,
        'Accept': 'text/yaml, text/plain, */*',
      },
      validateStatus: null, // 手动处理状态码以输出详细日志
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
        const preview = typeof res.data === 'string'
          ? res.data.substring(0, 2000)
          : String(res.data).substring(0, 2000)
        console.error(`响应体(前2000字符):\n${preview}`)
      }
      console.error(`--- 诊断信息结束 ---\n`)
      throw new Error(`下载订阅失败: HTTP ${res.status}${res.status === 403 ? ' (403 Forbidden — 订阅链接可能需要更新或包含认证信息)' : ''}`)
    }

    let content = res.data

    // 尝试解析 YAML，如果不是对象或者看起来不像配置，尝试 Base64 解码
    let isConfig = false
    try {
      const parsed = YAML.parse(content)
      if (parsed && typeof parsed === 'object' && (parsed.proxies || parsed.Proxy || parsed.port)) {
        isConfig = true
      }
    } catch (e) {
      console.warn('订阅服务商返回的不是有效 YAML，尝试 Base64 解码...')
    }

    if (!isConfig) {
      try {
        // 尝试 Base64 解码
        const decoded = Buffer.from(content, 'base64').toString('utf-8')
        // 再次检查解码后是否为有效 YAML 配置
        const parsedDecoded = YAML.parse(decoded)
        if (
          parsedDecoded &&
          typeof parsedDecoded === 'object' &&
          (parsedDecoded.proxies || parsedDecoded.Proxy || parsedDecoded.port)
        ) {
          content = decoded
        }
      } catch (e) {
        console.warn('Base64 解码失败，保留原始内容')
      }
    }

    const filePath = path.join(PROFILES_DIR, `${name}.yaml`)
    fs.writeFileSync(filePath, content)
    spinner.succeed(`订阅 ${name} 下载成功`)
    return filePath
  } catch (err) {
    // 如果已经在上面处理过（抛出了自定义Error），直接重新抛出
    if (err.message && err.message.startsWith('下载订阅失败:')) {
      throw err
    }
    // 网络错误/超时等 axios 层面异常
    spinner.fail(`下载订阅失败: ${err.message}`)
    console.error(`\n--- 订阅下载诊断信息 ---`)
    console.error(`请求URL: ${url}`)
    console.error(`订阅名称: ${name}`)
    console.error(`错误类型: ${err.code || '未知'}`)
    if (err.response) {
      console.error(`HTTP状态码: ${err.response.status}`)
      console.error(`响应头:`)
      for (const [key, value] of Object.entries(err.response.headers)) {
        console.error(`  ${key}: ${value}`)
      }
      if (err.response.data) {
        const preview = typeof err.response.data === 'string'
          ? err.response.data.substring(0, 2000)
          : JSON.stringify(err.response.data).substring(0, 2000)
        console.error(`响应体(前2000字符):\n${preview}`)
      }
    }
    console.error(`--- 诊断信息结束 ---\n`)
    throw new Error(`下载订阅失败: ${err.message}`)
  }
}

export function listProfiles() {
  return fs
    .readdirSync(PROFILES_DIR)
    .filter(f => f.endsWith('.yaml'))
    .map(f => f.replace('.yaml', ''))
}

export async function getCurrentProfile() {
  if (fs.existsSync(CURRENT_PROFILE_PATH)) {
    return fs.readFileSync(CURRENT_PROFILE_PATH, 'utf8').trim()
  }
  return null
}

export async function useProfile(name) {
  const source = path.join(PROFILES_DIR, `${name}.yaml`)
  if (!fs.existsSync(source)) throw new Error(`配置文件 ${name} 不存在`)

  const spinner = ora(`正在切换到配置 ${name}...`).start()

  // 读取订阅配置
  const subscriptionConfig = YAML.parse(fs.readFileSync(source, 'utf8'))

  // 读取现有配置（如果存在）
  const hasExistingConfig = fs.existsSync(CONFIG_PATH)
  let existingConfig = {}
  if (hasExistingConfig) {
    existingConfig = YAML.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
  }

  // 默认安全 DNS 配置（仅在订阅和现有配置都没有 DNS 时使用）
  const defaultDNS = {
    enable: true,
    ipv6: false,
    'enhanced-mode': 'redir-host',
    nameserver: [
      '223.5.5.5',
      '119.29.29.29',
      '114.114.114.114'
    ],
    fallback: [
      'https://1.1.1.1/dns-query',
      'https://8.8.8.8/dns-query'
    ],
    'fallback-filter': {
      geoip: true,
      'geoip-code': 'CN',
      ipcidr: [
        '240.0.0.0/4',
        '0.0.0.0/32'
      ]
    }
  }

  // 首次设置时的用户配置默认值（确保 CLI 正常工作，不受订阅方设置影响）
  const USER_DEFAULTS = {
    port: 7890,
    'socks-port': 7891,
    'allow-lan': true,
    mode: 'Rule',
    'log-level': 'info',
    'external-controller': '127.0.0.1:9090',
  }

  // 订阅中需要应用到配置的字段
  const SUBSCRIPTION_KEYS = ['proxies', 'proxy-groups', 'rules']

  let mergedConfig

  if (hasExistingConfig) {
    // 保留现有配置的所有字段，只替换订阅相关的字段
    mergedConfig = { ...existingConfig }
    for (const key of SUBSCRIPTION_KEYS) {
      if (subscriptionConfig[key] !== undefined) {
        mergedConfig[key] = subscriptionConfig[key]
      }
    }
    // DNS：优先使用订阅的，其次保留现有的，最后用默认值
    mergedConfig.dns = subscriptionConfig.dns || existingConfig.dns || defaultDNS
  } else {
    // 首次设置：以订阅配置为基础，用户关键配置使用默认值
    mergedConfig = { ...subscriptionConfig }
    // 用户配置字段强制使用默认值（不被订阅方覆盖）
    for (const [key, value] of Object.entries(USER_DEFAULTS)) {
      mergedConfig[key] = value
    }
    // DNS：优先使用订阅提供的，否则用默认值
    if (!mergedConfig.dns) {
      mergedConfig.dns = defaultDNS
    }
  }

  // 写入合并后的配置
  fs.writeFileSync(CONFIG_PATH, YAML.stringify(mergedConfig))

  // 记录当前使用的配置文件
  fs.writeFileSync(CURRENT_PROFILE_PATH, name)

  // 尝试热重载
  if (await api.isClashRunning()) {
    try {
      await api.reloadConfig(CONFIG_PATH)
      spinner.succeed('Clash 配置已切换并热重载生效')
    } catch (err) {
      spinner.warn(`配置已切换，但热重载失败: ${err.message}`)
    }
  } else {
    spinner.succeed('配置已切换（Clash 未运行，将在下次启动时生效）')
  }
}

export function deleteProfile(name) {
  const filePath = path.join(PROFILES_DIR, `${name}.yaml`)
  if (!fs.existsSync(filePath)) throw new Error(`订阅 ${name} 不存在`)
  fs.unlinkSync(filePath)
  // 若删除的是当前使用的订阅，清除记录
  if (fs.existsSync(CURRENT_PROFILE_PATH)) {
    const current = fs.readFileSync(CURRENT_PROFILE_PATH, 'utf8').trim()
    if (current === name) fs.unlinkSync(CURRENT_PROFILE_PATH)
  }
}

export function renameProfile(oldName, newName) {
  const oldPath = path.join(PROFILES_DIR, `${oldName}.yaml`)
  const newPath = path.join(PROFILES_DIR, `${newName}.yaml`)
  if (!fs.existsSync(oldPath)) throw new Error(`订阅 ${oldName} 不存在`)
  if (fs.existsSync(newPath)) throw new Error(`订阅名称 ${newName} 已存在`)
  fs.renameSync(oldPath, newPath)
  // 同步更新当前使用记录
  if (fs.existsSync(CURRENT_PROFILE_PATH)) {
    const current = fs.readFileSync(CURRENT_PROFILE_PATH, 'utf8').trim()
    if (current === oldName) fs.writeFileSync(CURRENT_PROFILE_PATH, newName)
  }
}
