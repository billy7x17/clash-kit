import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { getTargetBinName } from './kernel-platforms.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const binName = getTargetBinName()

function resolvePackageRoot(): string {
  // Try one level up (works for source: lib/.. = project root)
  const candidate = path.resolve(__dirname, '..')
  if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate
  // Try two levels up (works for dist: dist/lib/../.. = project root)
  return path.resolve(__dirname, '../..')
}

export const PACKAGE_ROOT = resolvePackageRoot()
export const DATA_DIR = path.join(os.homedir(), '.clash-kit')
export const PROFILES_DIR = path.join(DATA_DIR, 'profiles')
export const CONFIG_PATH = path.join(DATA_DIR, 'config.yaml')
export const CURRENT_PROFILE_PATH = path.join(DATA_DIR, '.current_profile')
export const LOG_PATH = path.join(DATA_DIR, 'clash.log')
export const STARTUP_LOG_PATH = path.join(DATA_DIR, 'startup.log')
export const CLASH_BIN_PATH = path.join(DATA_DIR, binName)
export const DEFAULT_CONFIG_PATH = path.join(PACKAGE_ROOT, 'default.yaml')
export const BUNDLED_RESOURCE_FILES = ['country.mmdb']

export function dataPath(...parts: string[]): string {
  return path.join(DATA_DIR, ...parts)
}

export function packagePath(...parts: string[]): string {
  return path.join(PACKAGE_ROOT, ...parts)
}

export function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.mkdirSync(PROFILES_DIR, { recursive: true })
}

function isSamePath(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b)
}

function copyFileIfMissing(src: string, dest: string, label: string, migrated: string[]): void {
  if (isSamePath(src, dest) || !fs.existsSync(src) || fs.existsSync(dest)) return

  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)

  try {
    fs.chmodSync(dest, fs.statSync(src).mode & 0o7777)
  } catch {
    /* hide system-level lookup failures */
  }

  migrated.push(label)
}

function copyDirFilesIfMissing(
  srcDir: string,
  destDir: string,
  label: string,
  migrated: string[],
  filter: (file: string) => boolean = () => true,
): void {
  if (isSamePath(srcDir, destDir) || !fs.existsSync(srcDir)) return

  fs.mkdirSync(destDir, { recursive: true })
  let count = 0

  for (const file of fs.readdirSync(srcDir)) {
    const src = path.join(srcDir, file)
    if (!fs.statSync(src).isFile() || !filter(file)) continue

    const dest = path.join(destDir, file)
    if (fs.existsSync(dest)) continue

    fs.copyFileSync(src, dest)
    count += 1
  }

  if (count > 0) migrated.push(`${label} (${count})`)
}

export function migrateLegacyData(): string[] {
  const migrated: string[] = []
  if (isSamePath(DATA_DIR, PACKAGE_ROOT)) return migrated

  ensureDataDir()

  copyFileIfMissing(packagePath('config.yaml'), CONFIG_PATH, 'config.yaml', migrated)
  copyFileIfMissing(packagePath('.current_profile'), CURRENT_PROFILE_PATH, '.current_profile', migrated)
  copyFileIfMissing(packagePath('clash.log'), LOG_PATH, 'clash.log', migrated)
  copyFileIfMissing(packagePath(binName), CLASH_BIN_PATH, binName, migrated)

  for (const file of ['geoip.metadb', 'geosite.dat', 'geoip.dat', 'ASN.mmdb', 'cache.db']) {
    copyFileIfMissing(packagePath(file), dataPath(file), file, migrated)
  }

  copyDirFilesIfMissing(packagePath('profiles'), PROFILES_DIR, 'profiles', migrated, file => file.endsWith('.yaml'))

  return migrated
}

export function copyBundledResources(): string[] {
  const copied: string[] = []
  ensureDataDir()

  for (const file of BUNDLED_RESOURCE_FILES) {
    copyFileIfMissing(packagePath(file), dataPath(file), file, copied)
  }

  return copied
}
