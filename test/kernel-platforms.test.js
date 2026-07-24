import { describe, it, expect } from 'vitest'
import { getTargetBinName, getKernelTarget, KERNEL_TARGETS, DEFAULT_BUNDLED_TARGETS } from '../lib/kernel-platforms.ts'

describe('getTargetBinName', () => {
  it('should return clash-kit.exe on Windows', () => {
    expect(getTargetBinName('win32')).toBe('clash-kit.exe')
  })

  it('should return clash-kit on macOS', () => {
    expect(getTargetBinName('darwin')).toBe('clash-kit')
  })

  it('should return clash-kit on Linux', () => {
    expect(getTargetBinName('linux')).toBe('clash-kit')
  })

  it('should default to current platform when no argument passed', () => {
    const result = getTargetBinName()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    expect(result.startsWith('clash-kit')).toBe(true)
  })
})

describe('getKernelTarget', () => {
  it('should return target info for win32-x64', () => {
    const target = getKernelTarget('win32', 'x64')
    expect(target).toBeTruthy()
    expect(target.assetName).toBe('mihomo-windows-amd64-compatible')
    expect(target.isWindows).toBe(true)
    expect(target.key).toBe('win32-x64')
  })

  it('should return target info for darwin-arm64', () => {
    const target = getKernelTarget('darwin', 'arm64')
    expect(target).toBeTruthy()
    expect(target.assetName).toBe('mihomo-darwin-arm64')
    expect(target.isWindows).toBe(false)
    expect(target.key).toBe('darwin-arm64')
  })

  it('should return target info for linux-x64', () => {
    const target = getKernelTarget('linux', 'x64')
    expect(target).toBeTruthy()
    expect(target.assetName).toBe('mihomo-linux-amd64-compatible')
    expect(target.isWindows).toBe(false)
    expect(target.key).toBe('linux-x64')
  })

  it('should return null for unsupported platform/arch', () => {
    expect(getKernelTarget('freebsd', 'x64')).toBeNull()
    expect(getKernelTarget('linux', 'mips')).toBeNull()
  })
})

describe('KERNEL_TARGETS', () => {
  it('should have entries for all DEFAULT_BUNDLED_TARGETS', () => {
    for (const key of DEFAULT_BUNDLED_TARGETS) {
      expect(KERNEL_TARGETS[key]).toBeTruthy()
    }
  })

  it('each target should have required fields', () => {
    for (const [, target] of Object.entries(KERNEL_TARGETS)) {
      expect(target.assetName).toBeTruthy()
      expect(typeof target.assetName).toBe('string')
      expect(target.archiveExt).toBeTruthy()
      expect(['zip', 'gz']).toContain(target.archiveExt)
      expect(target.platform).toBeTruthy()
    }
  })
})
