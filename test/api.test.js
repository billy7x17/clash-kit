import { describe, it, expect, vi } from 'vitest'

// Mock dependencies before importing the module under test
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}))

vi.mock('yaml', () => ({
  default: {
    parse: vi.fn(),
  },
}))

vi.mock('../lib/paths.ts', () => ({
  CONFIG_PATH: '/fake/.clash-kit/config.yaml',
}))

import fs from 'fs'
import YAML from 'yaml'
import { getApiBase, getProxyPort } from '../lib/api.ts'

describe('getApiBase', () => {
  it('should return default API base when config file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    expect(getApiBase()).toBe('http://127.0.0.1:9090')
  })

  it('should return default API base when no external-controller in config', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('port: 7890\n')
    vi.mocked(YAML.parse).mockReturnValue({})

    expect(getApiBase()).toBe('http://127.0.0.1:9090')
  })

  it('should handle external-controller with port only (":port")', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('external-controller: :8080\n')
    vi.mocked(YAML.parse).mockReturnValue({
      'external-controller': ':8080',
    })

    expect(getApiBase()).toBe('http://127.0.0.1:8080')
  })

  it('should handle external-controller with 0.0.0.0', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('external-controller: 0.0.0.0:9090\n')
    vi.mocked(YAML.parse).mockReturnValue({
      'external-controller': '0.0.0.0:9090',
    })

    expect(getApiBase()).toBe('http://127.0.0.1:9090')
  })

  it('should handle custom host and port', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('external-controller: 192.168.1.1:9091\n')
    vi.mocked(YAML.parse).mockReturnValue({
      'external-controller': '192.168.1.1:9091',
    })

    expect(getApiBase()).toBe('http://192.168.1.1:9091')
  })
})

describe('getProxyPort', () => {
  it('should read port and socks-port from config', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('port: 7890\nsocks-port: 7891\n')
    vi.mocked(YAML.parse).mockReturnValue({
      port: 7890,
      'socks-port': 7891,
    })

    const result = getProxyPort()
    expect(result.http).toBe(7890)
    expect(result.socks).toBe(7891)
  })

  it('should use mixed-port when port is not set', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('mixed-port: 7890\nsocks-port: 7891\n')
    vi.mocked(YAML.parse).mockReturnValue({
      'mixed-port': 7890,
      'socks-port': 7891,
    })

    const result = getProxyPort()
    expect(result.http).toBe(7890)
  })

  it('should throw when config file cannot be read', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT')
    })
    vi.mocked(YAML.parse).mockImplementation(() => {
      throw new Error('parse error')
    })

    expect(() => getProxyPort()).toThrow('读取配置文件失败')
  })
})
