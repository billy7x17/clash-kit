export interface ClashConfig {
  port?: number | string
  'socks-port'?: number
  'mixed-port'?: number
  'external-controller'?: string
  secret?: string
  mode?: 'Rule' | 'Global' | 'Direct'
  'log-level'?: 'info' | 'warning' | 'error' | 'debug' | 'silent'
  'allow-lan'?: boolean
  proxies?: ProxyNode[]
  'proxy-groups'?: ProxyGroup[]
  rules?: string[]
  dns?: DnsConfig
  tun?: TunConfig
}

export interface ProxyNode {
  name: string
  type: string
  server: string
  port: number
  [key: string]: unknown
}

export interface ProxyGroup {
  name: string
  type: 'Selector' | 'URLTest' | 'Fallback' | 'LoadBalance'
  proxies: string[]
}

export interface DnsConfig {
  enable?: boolean
  ipv6?: boolean
  'enhanced-mode'?: string
  nameserver?: string[]
  fallback?: string[]
  'fallback-filter'?: Record<string, unknown>
}

export interface TunConfig {
  enable?: boolean
  stack?: string
  'auto-route'?: boolean
  'auto-detect-interface'?: boolean
  'dns-hijack'?: string[]
  device?: string
}

export interface ProxyInfo {
  name: string
  type: string
  now?: string
  all: string[]
  history?: { delay: number; time: string }[]
}

export interface ApiProxiesResponse {
  proxies: Record<string, ProxyInfo>
}
