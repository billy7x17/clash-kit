import axios from 'axios'
import fs from 'fs'
import path from 'path'
import os from 'os'
import zlib from 'zlib'
import AdmZip from 'adm-zip'
import ora from 'ora'
import cliProgress from 'cli-progress'
import chalk from 'chalk'
import { execSync } from 'child_process'
import { getKernelTarget, getTargetBinName, KernelTarget } from './kernel-platforms.js'
import { DATA_DIR, packagePath } from './paths.js'

const MIHOMO_VERSION_URL = 'https://github.com/MetaCubeX/mihomo/releases/latest/download/version.txt'

interface DownloadOptions {
  remote?: boolean
}

function findBundledKernelArchive(target: KernelTarget & { key: string; isWindows: boolean }): string | null {
  const kernelsDir = packagePath('kernels')
  if (!target || !fs.existsSync(kernelsDir)) return null

  const prefix = `${target.assetName}-`
  const suffix = `.${target.archiveExt}`
  const files = fs
    .readdirSync(kernelsDir)
    .filter(file => file.startsWith(prefix) && file.endsWith(suffix))
    .sort()

  const file = files.at(-1)
  return file ? path.join(kernelsDir, file) : null
}

function extractArchive(
  archivePath: string,
  targetDir: string,
  target: KernelTarget & { key: string; isWindows: boolean },
): string {
  const targetBinName = getTargetBinName(target.platform)
  const targetBinPath = path.join(targetDir, targetBinName)
  const tempBinPath = path.join(targetDir, `${targetBinName}.tmp-${process.pid}-${Date.now()}`)

  try {
    if (target.isWindows) {
      const zip = new AdmZip(archivePath)
      const entry = zip
        .getEntries()
        .find(
          item => !item.isDirectory && (item.entryName.includes(target.assetName) || item.entryName.endsWith('.exe')),
        )
      if (!entry) throw new Error('压缩包中未找到可执行文件')

      zip.extractEntryTo(entry, targetDir, false, true)
      const extractedName = path.basename(entry.entryName)
      const extractedPath = path.join(targetDir, extractedName)
      if (targetBinName !== extractedName) {
        if (fs.existsSync(targetBinPath)) fs.unlinkSync(targetBinPath)
        fs.renameSync(extractedPath, targetBinPath)
      }
    } else {
      const fileContents = fs.readFileSync(archivePath)
      const unzipped = zlib.gunzipSync(fileContents)
      fs.writeFileSync(tempBinPath, unzipped, { mode: 0o755 })
      fs.chmodSync(tempBinPath, 0o755)
      fs.renameSync(tempBinPath, targetBinPath)
    }
  } finally {
    if (fs.existsSync(tempBinPath)) fs.unlinkSync(tempBinPath)
  }

  return targetBinPath
}

export function installBundledClash(targetDir: string): string | null {
  fs.mkdirSync(targetDir, { recursive: true })

  const target = getKernelTarget()
  if (!target) return null

  const archivePath = findBundledKernelArchive(target)
  if (!archivePath) return null

  const spinner = ora(`发现内置 Mihomo 内核，正在解压 ${path.basename(archivePath)}...`).start()
  try {
    const targetBinPath = extractArchive(archivePath, targetDir, target)
    spinner.succeed(chalk.green(`内置 Mihomo 内核已解压: ${targetBinPath}`))
    return targetBinPath
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    spinner.fail(chalk.red(`内置 Mihomo 内核解压失败: ${message}`))
    throw e
  }
}

export async function downloadClash(targetDir: string, options: DownloadOptions = {}): Promise<string> {
  fs.mkdirSync(targetDir, { recursive: true })

  const platform = os.platform()
  const arch = os.arch()
  const target = getKernelTarget(platform, arch)

  if (!target) {
    throw new Error(`不支持的平台: ${platform}-${arch}`)
  }

  if (!options.remote) {
    try {
      const bundledBinPath = installBundledClash(targetDir)
      if (bundledBinPath) return bundledBinPath
    } catch {
      console.warn(chalk.yellow('将尝试从 GitHub 下载 Mihomo 内核...'))
    }
  } else {
    console.log(chalk.gray('已指定 --remote，将跳过内置 Mihomo 内核。'))
  }

  // 1. 获取最新版本
  const spinner = ora('正在获取最新 Mihomo 版本信息...').start()
  let version: string
  try {
    const { data } = await axios.get(MIHOMO_VERSION_URL, { timeout: 30 * 1000 })
    version = data.trim()
    spinner.succeed(`检测到最新版本: ${version}`)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    spinner.fail(`获取版本信息失败: ${message}`)
    throw new Error(`获取版本信息失败: ${message}`)
  }

  // 2. 构建下载 URL 和本地缓存路径
  const downloadUrl = `https://github.com/MetaCubeX/mihomo/releases/download/${version}/${target.assetName}-${version}.${target.archiveExt}`
  const archiveName = `${target.assetName}-${version}.${target.archiveExt}`
  const archivePath = path.join(targetDir, archiveName)

  // 3. 下载文件（若本地缓存不存在）
  if (fs.existsSync(archivePath)) {
    console.log(chalk.gray(`内核压缩包已缓存: ${archiveName}`))
  } else {
    console.log(`正在下载: ${downloadUrl}`)
    const bar = new cliProgress.SingleBar(
      {
        format: '下载进度 | {bar} | {percentage}% | {valueFormatted}/{totalFormatted} MB',
        hideCursor: true,
      },
      cliProgress.Presets.shades_classic,
    )

    try {
      let started = false
      let totalMB = '0.0'
      const response = await axios({
        url: downloadUrl,
        method: 'GET',
        responseType: 'arraybuffer',
        onDownloadProgress: (progressEvent: { loaded: number; total?: number }) => {
          if (progressEvent.total) {
            const loadedMB = (progressEvent.loaded / 1024 / 1024).toFixed(1)
            if (!started) {
              totalMB = (progressEvent.total / 1024 / 1024).toFixed(1)
              bar.start(progressEvent.total, 0, {
                valueFormatted: '0.0',
                totalFormatted: totalMB,
              })
              started = true
            }
            bar.update(progressEvent.loaded, {
              valueFormatted: loadedMB,
              totalFormatted: totalMB,
            })
          }
        },
      })
      bar.stop()

      fs.writeFileSync(archivePath, new Uint8Array(response.data as ArrayBuffer))
      console.log(chalk.green('下载完成，正在解压...'))
    } catch (e: unknown) {
      bar.stop()
      const message = e instanceof Error ? e.message : String(e)
      if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath)
      throw new Error(`下载失败: ${message}`)
    }
  }

  // 4. 解压文件
  try {
    const targetBinPath = extractArchive(archivePath, targetDir, target)
    spinner.succeed(chalk.green(`解压完成: ${targetBinPath}`))

    // 清理同平台旧版本压缩包
    const oldArchives = fs
      .readdirSync(targetDir)
      .filter(
        file =>
          file.startsWith(`${target.assetName}-`) && file.endsWith(`.${target.archiveExt}`) && file !== archiveName,
      )
    for (const oldFile of oldArchives) {
      fs.unlinkSync(path.join(targetDir, oldFile))
    }

    return targetBinPath
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    spinner.fail(chalk.red(`解压失败: ${message}`))
    if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath)
    throw new Error(`解压失败: ${message}`)
  }
}

export function getClashProcessInfo(): { pid: string } | null {
  try {
    let pid: string | undefined
    if (process.platform === 'win32') {
      const command = 'tasklist | findstr clash-kit.exe'
      const output = execSync(command, { encoding: 'utf-8' })
      const match = output.match(/(\d+)/)
      pid = match ? match[0] : undefined
    } else {
      const command = 'pgrep -f clash-kit'
      pid = execSync(command, { encoding: 'utf-8' }).trim()
    }
    return pid ? { pid } : null
  } catch {
    return null
  }
}

export function killClashProcess(): boolean {
  try {
    if (process.platform === 'win32') {
      execSync('taskkill /F /IM clash-kit.exe', { stdio: 'ignore' })
    } else {
      execSync('pkill -f clash-kit', { stdio: 'ignore' })
    }
    return true
  } catch {
    return false
  }
}
