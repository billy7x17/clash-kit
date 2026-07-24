import { describe, it, expect } from 'vitest'
import {
  DATA_DIR,
  PROFILES_DIR,
  CONFIG_PATH,
  CURRENT_PROFILE_PATH,
  LOG_PATH,
  DEFAULT_CONFIG_PATH,
  BUNDLED_RESOURCE_FILES,
  dataPath,
  packagePath,
} from '../lib/paths.ts'

describe('path constants', () => {
  it('DATA_DIR should be a non-empty string ending with .clash-kit', () => {
    expect(DATA_DIR).toBeTruthy()
    expect(typeof DATA_DIR).toBe('string')
    expect(DATA_DIR).toContain('.clash-kit')
  })

  it('PROFILES_DIR should be under DATA_DIR', () => {
    expect(PROFILES_DIR).toContain(DATA_DIR)
    expect(PROFILES_DIR).toContain('profiles')
  })

  it('CONFIG_PATH should be under DATA_DIR', () => {
    expect(CONFIG_PATH).toContain(DATA_DIR)
    expect(CONFIG_PATH).toContain('config.yaml')
  })

  it('CURRENT_PROFILE_PATH should be under DATA_DIR', () => {
    expect(CURRENT_PROFILE_PATH).toContain(DATA_DIR)
    expect(CURRENT_PROFILE_PATH).toContain('.current_profile')
  })

  it('LOG_PATH should be under DATA_DIR', () => {
    expect(LOG_PATH).toContain(DATA_DIR)
    expect(LOG_PATH).toContain('clash.log')
  })

  it('DEFAULT_CONFIG_PATH should be under PACKAGE_ROOT', () => {
    expect(DEFAULT_CONFIG_PATH).toBeTruthy()
    expect(DEFAULT_CONFIG_PATH).toContain('default.yaml')
  })

  it('BUNDLED_RESOURCE_FILES should be a non-empty array', () => {
    expect(Array.isArray(BUNDLED_RESOURCE_FILES)).toBe(true)
    expect(BUNDLED_RESOURCE_FILES.length).toBeGreaterThan(0)
  })
})

describe('dataPath', () => {
  it('should join paths under DATA_DIR', () => {
    const result = dataPath('test.yaml')
    expect(result).toContain(DATA_DIR)
    expect(result).toContain('test.yaml')
  })

  it('should handle multiple path segments', () => {
    const result = dataPath('sub', 'dir', 'file.txt')
    expect(result).toContain(DATA_DIR)
    expect(result).toContain('sub')
    expect(result).toContain('dir')
    expect(result).toContain('file.txt')
  })
})

describe('packagePath', () => {
  it('should join paths under PACKAGE_ROOT', () => {
    const result = packagePath('test.yaml')
    expect(result).toBeTruthy()
    expect(result).toContain('test.yaml')
  })

  it('should handle multiple path segments', () => {
    const result = packagePath('sub', 'dir', 'file.txt')
    expect(result).toContain('sub')
    expect(result).toContain('dir')
    expect(result).toContain('file.txt')
  })
})
