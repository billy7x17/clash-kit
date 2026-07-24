import { describe, it, expect, vi } from 'vitest'

// Mock fs before importing the module under test
vi.mock('fs', () => ({
  default: {
    readdirSync: vi.fn(),
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    renameSync: vi.fn(),
  },
}))

// Mock paths module
vi.mock('../lib/paths.ts', () => ({
  CONFIG_PATH: '/fake/.clash-kit/config.yaml',
  CURRENT_PROFILE_PATH: '/fake/.clash-kit/.current_profile',
  PROFILES_DIR: '/fake/.clash-kit/profiles',
}))

// Mock yaml
vi.mock('yaml', () => ({
  default: {
    parse: vi.fn(() => ({})),
    stringify: vi.fn(() => ''),
  },
}))

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn().mockRejectedValue(new Error('not running')),
    put: vi.fn().mockRejectedValue(new Error('not running')),
  },
}))

// Mock ora
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn(),
    fail: vi.fn(),
    warn: vi.fn(),
  })),
}))

const fs = await import('fs')
const { listProfiles, deleteProfile, renameProfile, getCurrentProfile } = await import('../lib/subscription.ts')

describe('listProfiles', () => {
  it('should return profile names without .yaml extension', () => {
    vi.mocked(fs.default.readdirSync).mockReturnValue([
      'profile1.yaml',
      'profile2.yaml',
      'not-a-profile.txt',
      'profile3.yaml',
    ])

    const profiles = listProfiles()
    expect(profiles).toEqual(['profile1', 'profile2', 'profile3'])
  })

  it('should return empty array when no yaml files exist', () => {
    vi.mocked(fs.default.readdirSync).mockReturnValue(['readme.txt', 'notes.md'])

    const profiles = listProfiles()
    expect(profiles).toEqual([])
  })

  it('should return empty array when directory is empty', () => {
    vi.mocked(fs.default.readdirSync).mockReturnValue([])

    const profiles = listProfiles()
    expect(profiles).toEqual([])
  })
})

describe('getCurrentProfile', () => {
  it('should return current profile name when file exists', async () => {
    vi.mocked(fs.default.existsSync).mockReturnValue(true)
    vi.mocked(fs.default.readFileSync).mockReturnValue('my-profile')

    const result = await getCurrentProfile()
    expect(result).toBe('my-profile')
  })

  it('should return null when no current profile file', async () => {
    vi.mocked(fs.default.existsSync).mockReturnValue(false)

    const result = await getCurrentProfile()
    expect(result).toBeNull()
  })
})

describe('deleteProfile', () => {
  it('should throw if profile does not exist', () => {
    vi.mocked(fs.default.existsSync).mockReturnValue(false)

    expect(() => deleteProfile('nonexistent')).toThrow('订阅 nonexistent 不存在')
  })

  it('should delete the profile file and clear current if active', () => {
    vi.mocked(fs.default.existsSync).mockImplementation(p => {
      if (p.toString().includes('.current_profile')) return true
      if (p.toString().includes('nonexistent')) return false
      return true
    })
    vi.mocked(fs.default.readFileSync).mockReturnValue('my-profile')

    expect(() => deleteProfile('my-profile')).not.toThrow()
    expect(fs.default.unlinkSync).toHaveBeenCalled()
  })
})

describe('renameProfile', () => {
  it('should throw if old profile does not exist', () => {
    vi.mocked(fs.default.existsSync).mockReturnValue(false)

    expect(() => renameProfile('old', 'new')).toThrow('订阅 old 不存在')
  })

  it('should throw if new name already exists', () => {
    vi.mocked(fs.default.existsSync).mockImplementation(p => {
      if (p.toString().endsWith('new.yaml')) return true
      return true
    })

    expect(() => renameProfile('old', 'new')).toThrow('订阅名称 new 已存在')
  })

  it('should rename profile and update current record if active', () => {
    const existsCalls = []
    vi.mocked(fs.default.existsSync).mockImplementation(p => {
      const path = p.toString()
      existsCalls.push(path)
      if (path.endsWith('new.yaml')) return false
      if (path.endsWith('old.yaml')) return true
      if (path.includes('.current_profile')) return true
      return false
    })
    vi.mocked(fs.default.readFileSync).mockReturnValue('old')

    expect(() => renameProfile('old', 'new')).not.toThrow()
    expect(fs.default.renameSync).toHaveBeenCalled()
    expect(fs.default.writeFileSync).toHaveBeenCalled()
  })
})
