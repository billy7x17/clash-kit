import { spawn, ChildProcess } from 'child_process'
import fs from 'fs'
import chalk from 'chalk'
import axios from 'axios'
import ora from 'ora'
import YAML from 'yaml'
import { getApiBase } from './api.js'
import { status } from './commands/status.js'
import * as sysproxy from './sysproxy.js'
import * as tun from './tun.js'
import { isPortOpen, extractPort, getPortOccupier } from './port.js'
import { killClashProcess } from './kernel.js'
import { CLASH_BIN_PATH, CONFIG_PATH, DATA_DIR, LOG_PATH, copyBundledResources } from './paths.js'

// ----------------  配置项 ----------------
export { CLASH_BIN_PATH }
export const CLASH_CONFIG_PATH = CONFIG_PATH

async function checkPorts(): Promise<void> {
  try {
    if (fs.existsSync(CLASH_CONFIG_PATH)) {
      const configContent = fs.readFileSync(CLASH_CONFIG_PATH, 'utf8')
      const config = YAML.parse(configContent)

      const checks: Array<{ key: string; name: string }> = [
        { key: 'mixed-port', name: 'Mixed Port' },
        { key: 'port', name: 'HTTP Port' },
        { key: 'socks-port', name: 'SOCKS Port' },
        { key: 'external-controller', name: 'External Controller' },
      ]

      for (const check of checks) {
        const val = config[check.key]
        const port = extractPort(val)
        if (port) {
          const isOpen = await isPortOpen(port)
          if (!isOpen) {
            const occupier = getPortOccupier(port)
            const occupierInfo = occupier ? ` (被 ${occupier} 占用)` : ''

            console.error(chalk.red(`\n启动失败: 端口 ${port} (${check.name}) 已被占用${occupierInfo}`))
            console.error(chalk.yellow(`请检查是否有其他代理软件正在运行，或修改 config.yaml 中的 ${check.key} \n`))

            if (!occupierInfo) {
              console.error(`占用进程未知，可能是权限不足或系统进程`)
              console.error(chalk.yellow(`提示: 可尝试使用 'sudo lsof -i :${port}' 手动查看端口占用情况`))
            }
            process.exit(1)
          }
        }
      }
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(chalk.yellow('警告: 端口检查预检失败，将尝试直接启动内核:', message))
  }
}

// ---------------- 启动 Clash.Meta 进程 ----------------
async function startClash(): Promise<ChildProcess> {
  killClashProcess()
  await new Promise(resolve => setTimeout(resolve, 500))

  await checkPorts()

  const logFd = fs.openSync(LOG_PATH, 'a')

  const clashProcess = spawn(CLASH_BIN_PATH, ['-f', CLASH_CONFIG_PATH, '-d', DATA_DIR], {
    cwd: DATA_DIR,
    detached: true,
    stdio: ['ignore', logFd, logFd],
  })

  clashProcess.on('error', err => {
    console.error(`启动 Clash.Meta 失败: ${err.message}`)
    process.exit(1)
  })

  clashProcess.on('exit', (code, signal) => {
    if (code !== 0) {
      console.log(`Clash 进程异常退出，代码: ${code}, 信号: ${signal}。请查看 clash.log 获取详情。`)
    }
  })

  clashProcess.unref()

  return clashProcess
}

// 清理函数
async function cleanup(): Promise<void> {
  try {
    await sysproxy.disableSystemProxy()

    const tunEnabled = await tun.isTunEnabled()
    if (tunEnabled) {
      await tun.disableTun()
      console.log('TUN 模式已关闭')
    }

    if (killClashProcess()) {
      console.log('Clash 服务已停止')
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('清理过程出错:', message)
  }
}

// 注册进程退出处理
function setupExitHandlers(): void {
  process.on('SIGINT', async () => {
    console.log('\n\n正在清理配置并退出...')
    await cleanup()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.log('\n正在清理配置并退出...')
    await cleanup()
    process.exit(0)
  })

  process.on('uncaughtException', async err => {
    console.error('未捕获的异常:', err)
    await cleanup()
    process.exit(1)
  })
}

// 检查服务健康状态
async function checkServiceHealth(apiBase: string, maxRetries = 20): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await axios.get(apiBase, { timeout: 1000 })
      return true
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'response' in e) return true
      await new Promise(r => setTimeout(r, 200))
    }
  }
  return false
}

export async function main(): Promise<void> {
  copyBundledResources()

  if (!fs.existsSync(CLASH_BIN_PATH)) {
    return console.error(
      chalk.red(`\n找不到 Clash.Meta 内核文件: ${CLASH_BIN_PATH}\n请先运行 clash init 命令初始化内核！\n`),
    )
  }
  if (!fs.existsSync(CLASH_CONFIG_PATH)) {
    return console.error(
      chalk.red(`\n找不到配置文件: ${CLASH_CONFIG_PATH}\n请先通过 clash sub 命令添加或选择订阅配置！\n`),
    )
  }

  setupExitHandlers()

  const clashProcess = await startClash()

  const spinner = ora('正在等待服务启动...').start()
  const started = await checkServiceHealth(getApiBase())

  if (!started) {
    spinner.fail(chalk.red('启动失败'))
    if (fs.existsSync(LOG_PATH)) {
      console.log(chalk.yellow('\n------- clash.log (Last 20 lines) -------'))
      const lines = fs.readFileSync(LOG_PATH, 'utf8').trim().split('\n')
      console.log(lines.slice(-20).join('\n'))
      console.log(chalk.yellow('-----------------------------------------\n'))
    }
    try {
      process.kill(clashProcess.pid!)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('停止 Clash 进程时出错:', message)
    }
    process.exit(1)
  }

  spinner.succeed(chalk.green('启动成功'))

  await status()
}
