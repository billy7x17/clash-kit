import ora from 'ora'
import path from 'path'
import * as api from '../api.js'
import * as sub from '../subscription.js'
import * as tun from '../tun.js'
import * as sysproxy from '../sysproxy.js'
import { getClashProcessInfo } from '../kernel.js'
import chalk from 'chalk'
import boxen from 'boxen'
import { LOG_PATH, PROFILES_DIR } from '../paths.js'

export async function status(): Promise<void> {
  const spinner = ora('正在获取 Clash 状态...').start()
  try {
    const [config, currentProfile, tunEnabled, sysProxyStatus, proxies, processInfo] = await Promise.all([
      api.getConfig(),
      sub.getCurrentProfile(),
      tun.isTunEnabled(),
      sysproxy.getSystemProxyStatus(),
      api.getProxies() as Promise<
        Record<
          string,
          { type: string; name: string; all: string[]; now: string; history?: { delay: number; time: string }[] }
        >
      >,
      getClashProcessInfo(),
    ])

    spinner.stop()
    const apiBase = api.getApiBase()
    const configPath = sub.CONFIG_PATH
    const logPath = LOG_PATH

    let profileNodeCount = ''
    if (currentProfile) {
      try {
        const profilePath = path.join(PROFILES_DIR, `${currentProfile}.yaml`)
        const YAML = (await import('yaml')).default
        const fsModule = (await import('fs')).default
        if (fsModule.existsSync(profilePath)) {
          const parsed = YAML.parse(fsModule.readFileSync(profilePath, 'utf8'))
          const count = parsed?.proxies?.length || 0
          if (count > 0) profileNodeCount = chalk.gray(` (${count} 个节点)`)
        }
      } catch {
        /* process info may be unavailable */
      }
    }

    const content: string[] = []
    let statusLine = `状态：${chalk.green('运行中')}`
    if (processInfo?.pid) {
      statusLine += ` (PID: ${chalk.yellow(processInfo.pid)})`
    }
    content.push(statusLine)
    content.push(`当前配置: ${currentProfile || '未知'}${profileNodeCount}`)
    content.push(`运行模式: ${(config as Record<string, unknown>).mode}`)
    content.push(`API 地址:    ${chalk.cyan(apiBase)}`)
    content.push(
      `HTTP 代理:   ${chalk.cyan(`http://127.0.0.1:${(config as Record<string, unknown>)['port'] || '未设置'}`)}`,
    )
    content.push(
      `SOCKS5 代理: ${chalk.cyan(`socks5://127.0.0.1:${(config as Record<string, unknown>)['socks-port'] || '未设置'}`)}`,
    )
    content.push(
      `混合代理:    ${(config as Record<string, unknown>)['mixed-port'] ? chalk.cyan(`127.0.0.1:${(config as Record<string, unknown>)['mixed-port']}`) : chalk.gray('未设置')}`,
    )
    content.push('')
    const sysProxyText = sysProxyStatus?.enabled
      ? chalk.green(`已开启 (${sysProxyStatus.server}:${sysProxyStatus.port})`)
      : chalk.gray('未开启')
    content.push(`系统代理: ${sysProxyText}`)
    content.push(`TUN 模式(拦截所有流量): ${tunEnabled ? chalk.green('已开启') : chalk.gray('未开启')}`)
    if (tunEnabled && (config as Record<string, unknown>).dns) {
      const dns = (config as Record<string, unknown>).dns as Record<string, unknown>
      const dnsServers = (dns.nameserver as string[])?.slice(0, 2).join(', ') || ''
      const dnsMode = dns['enhanced-mode'] || ''
      content.push(
        `DNS 模式: ${chalk.cyan(dnsMode || '默认')}${dnsServers ? '  服务器: ' + chalk.cyan(dnsServers) : ''}`,
      )
    }
    content.push(`配置文件: ${chalk.blueBright.underline(configPath)}`)
    content.push(`日志文件: ${chalk.blueBright.underline(logPath)}`)
    content.push('')

    content.push('')
    content.push(
      `${chalk.gray('系统代理: ck sys <on|off> , TUN 模式: ck tun <on|off>')} , 更多命令: ${chalk.blue('ck help')}`,
    )

    console.log(
      boxen(content.join('\n'), {
        title: chalk.bold.whiteBright.bgGreen(' Clash Kit '),
        titleAlignment: 'center',
        padding: 1,
        borderStyle: 'bold',
        borderColor: 'green',
        margin: { top: 1, bottom: 0, left: 0, right: 0 },
      }),
    )

    const group = proxies['Proxy'] || Object.values(proxies).find(p => p.type === 'Selector')
    if (group?.now) {
      const testUrl = group.now === 'DIRECT' ? 'http://connect.rom.miui.com/generate_204' : undefined
      const delay = await api.getProxyDelay(group.now, testUrl)
      let delayStr = ''
      if (delay > 0) {
        if (delay < 200) delayStr = chalk.green(`${delay}ms`)
        else if (delay < 500) delayStr = chalk.yellow(`${delay}ms`)
        else delayStr = chalk.red(`${delay}ms`)
      } else {
        delayStr = chalk.red('超时/失败')
      }
      console.log(`🚀 节点延迟 [${group.name}: ${group.now}]: ${delayStr}\n`)
    }
  } catch (err: unknown) {
    if (spinner.isSpinning) spinner.stop()
    const message = err instanceof Error ? err.message : String(err)
    if (message && (message.includes('ECONNREFUSED') || message.includes('无法连接'))) {
      const configPath = sub.CONFIG_PATH
      const content: string[] = []
      content.push(`状态：${chalk.yellow('未运行')}`)
      content.push('提示：请使用 `ck start` 启动服务')
      content.push(`当前配置文件: ${configPath || '未知'}`)
      console.log(
        boxen(content.join('\n'), {
          title: chalk.bold.bgYellow(' Clash Kit '),
          titleAlignment: 'center',
          padding: 1,
          borderStyle: 'single',
          margin: { top: 1, bottom: 1, left: 0, right: 0 },
        }),
      )
    } else {
      console.error(`获取状态失败: ${message}`)
    }
  }
}
