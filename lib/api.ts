import axios from 'axios'
import fs from 'fs'
import YAML from 'yaml'
import { CONFIG_PATH } from './paths.js'

export function getProxyPort(): { http: number; socks: number } {
  try {
    const configContent = fs.readFileSync(CONFIG_PATH, 'utf8')
    const config = YAML.parse(configContent)
    const httpPort = config['port'] || config['mixed-port']
    const socksPort = config['socks-port']
    return { http: httpPort, socks: socksPort }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`读取配置文件失败: ${message}`)
  }
}

export function getApiBase(): string {
  let apiBase = 'http://127.0.0.1:9090'
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const configContent = fs.readFileSync(CONFIG_PATH, 'utf8')
      const config = YAML.parse(configContent)
      if (config['external-controller']) {
        let host: string = config['external-controller']
        // 处理 :9090 这种情况
        if (host.startsWith(':')) {
          host = '127.0.0.1' + host
        }
        // 处理 0.0.0.0
        host = host.replace('0.0.0.0', '127.0.0.1')
        apiBase = `http://${host}`
      }
    }
  } catch {
    console.error('读取配置文件失败，使用默认 API 地址')
  }
  return apiBase
}

function readSecretFromConfig(): string | null {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const config = YAML.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
      return config.secret || null
    }
  } catch {
    /* config read failure — no secret */
  }
  return null
}

function getHeaders(): Record<string, string> {
  const secret = readSecretFromConfig()
  if (!secret) return {}
  return { Authorization: `Bearer ${secret}` }
}

// 获取所有代理节点信息
export async function getProxies(): Promise<Record<string, unknown>> {
  try {
    const res = await axios.get(`${getApiBase()}/proxies`, { headers: getHeaders() })
    return res.data.proxies
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`
      无法连接到 Clash API: ${message}

      请确保 Clash 正在运行，并且配置文件中的 external-controller 已正确设置。
      你可以通过 ck status 命令检查状态。
    `)
  }
}

export async function switchProxy(groupName: string, proxyName: string): Promise<void> {
  try {
    await axios.put(
      `${getApiBase()}/proxies/${encodeURIComponent(groupName)}`,
      { name: proxyName },
      { headers: getHeaders() },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`切换节点失败: ${message}`)
  }
}

export async function getProxyDelay(
  proxyName: string,
  testUrl = 'http://www.gstatic.com/generate_204',
): Promise<number> {
  try {
    const res = await axios.get(`${getApiBase()}/proxies/${encodeURIComponent(proxyName)}/delay`, {
      params: {
        timeout: 3000,
        url: testUrl,
      },
      headers: getHeaders(),
    })
    return res.data.delay
  } catch {
    return -1 // 超时或失败
  }
}

export async function getConfig(): Promise<Record<string, unknown>> {
  try {
    const res = await axios.get(`${getApiBase()}/configs`, { headers: getHeaders() })
    return res.data
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`获取配置失败: ${message}`)
  }
}

// 重新加载基本配置，必须发送数据，URL 需携带 ?force=true 强制执行
export async function reloadBaseConfig(): Promise<void> {
  try {
    await axios.put(`${getApiBase()}/configs?force=true`, {}, { headers: getHeaders() })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`重新加载配置失败: ${message}`)
  }
}

// 获取策略组信息
export async function getProxyGroups(): Promise<unknown> {
  try {
    const res = await axios.get(`${getApiBase()}/group`, { headers: getHeaders() })
    return res.data
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`获取策略组失败: ${message}`)
  }
}

// 获取所有代理集合的所有信息
export async function getProxyProviders(): Promise<unknown> {
  try {
    const res = await axios.get(`${getApiBase()}/providers/proxies`, { headers: getHeaders() })
    return res.data
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`获取代理提供者失败: ${message}`)
  }
}

// 获取规则信息
export async function getRules(): Promise<unknown> {
  try {
    const res = await axios.get(`${getApiBase()}/rules`, { headers: getHeaders() })
    return res.data
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`获取规则失败: ${message}`)
  }
}

// 获取连接信息 /connections
export async function getConnections(): Promise<unknown> {
  try {
    const res = await axios.get(`${getApiBase()}/connections`, { headers: getHeaders() })
    return res.data
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`获取连接信息失败: ${message}`)
  }
}

// 域名解析信息 /dns/query
export async function getDnsQueries(name: string, type = 'A'): Promise<unknown> {
  try {
    const res = await axios.get(`${getApiBase()}/dns/query`, {
      params: { name, type },
      headers: getHeaders(),
    })
    return res.data
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`获取域名解析信息失败: ${message}`)
  }
}

export async function reloadConfig(configPath: string): Promise<void> {
  try {
    await axios.put(`${getApiBase()}/configs?force=true`, { path: configPath }, { headers: getHeaders() })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`重载配置失败: ${message}`)
  }
}

export async function isClashRunning(): Promise<boolean> {
  try {
    // 使用较短的超时时间快速检查
    await axios.get(`${getApiBase()}/version`, { timeout: 200 })
    return true
  } catch {
    return false
  }
}
