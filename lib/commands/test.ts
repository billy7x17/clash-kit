import chalk from 'chalk'
import * as api from '../api.js'

interface TestResult {
  name: string
  delay: number
  isCurrent: boolean
}

export async function test(): Promise<void> {
  try {
    let proxies: Record<string, { name: string; type: string; all: string[]; now: string }>
    try {
      proxies = (await api.getProxies()) as Record<string, { name: string; type: string; all: string[]; now: string }>
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message && (message.includes('ECONNREFUSED') || message.includes('无法连接'))) {
        console.error(chalk.red('\nClash 服务未运行，请先执行: ck start\n'))
      } else {
        console.error(chalk.red(message))
      }
      return
    }

    const group = proxies['Proxy'] || Object.values(proxies).find(p => p.type === 'Selector')

    if (!group) {
      console.error('找不到 Proxy 组')
      return
    }

    console.log(`\n[${group.name}]${group.all.length}个节点, 当前选中: ${group.now}\n`)

    const results: TestResult[] = []
    const total = group.all.length
    let completed = 0
    const current = group.now

    await Promise.all(
      group.all.map(async name => {
        try {
          const testUrl = name === 'DIRECT' ? 'http://connect.rom.miui.com/generate_204' : undefined
          const delay = await api.getProxyDelay(name, testUrl)
          completed++
          const progress = `[${completed}/${total}]`
          const isCurrent = name === current
          const nameDisplay = isCurrent ? chalk.bold.bgCyan(name) : chalk.cyan(name)

          if (delay > 0) {
            const color = delay < 200 ? chalk.green : delay < 800 ? chalk.yellow : chalk.red
            console.log(`${chalk.gray(progress)} ${nameDisplay}: ${color(delay + 'ms')}`)
            results.push({ name, delay, isCurrent })
          } else {
            console.log(`${chalk.gray(progress)} ${nameDisplay}: ${chalk.red('超时')}`)
            results.push({ name, delay: 99999, isCurrent })
          }
        } catch {
          completed++
          results.push({ name, delay: 99999, isCurrent: name === current })
        }
      }),
    )

    console.log(chalk.bold.blue('\n=== 测速结果 (Top 5) ==='))
    results.sort((a, b) => a.delay - b.delay)
    results.slice(0, 5).forEach((r, i) => {
      let delayInfo: string
      if (r.delay === 99999) {
        delayInfo = chalk.red('超时')
      } else {
        const color = r.delay < 200 ? chalk.green : r.delay < 800 ? chalk.yellow : chalk.red
        delayInfo = color(`${r.delay}ms`)
      }
      const nameDisplay = r.isCurrent ? chalk.bold.bgCyan(r.name) : chalk.cyan(r.name)
      console.log(`${chalk.gray(i + 1 + '.')} ${nameDisplay}: ${delayInfo}`)
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(message)
  }
}
