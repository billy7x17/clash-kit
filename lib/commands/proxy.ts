import { select } from '@inquirer/prompts'
import ora from 'ora'
import chalk from 'chalk'
import * as api from '../api.js'

export async function proxy(): Promise<void> {
  let spinner = ora('正在获取最新代理列表...').start()
  try {
    let proxies = (await api.getProxies()) as Record<
      string,
      { type: string; name: string; all: string[]; now: string; history?: { delay: number; time: string }[] }
    >
    spinner.stop()
    const groups = Object.values(proxies).filter(p => p.type === 'Selector')

    if (groups.length === 0) {
      console.log('没有找到可选的节点组')
      return
    }

    const groupName = await select({
      message: '请选择节点组:',
      choices: groups.map(g => ({ name: g.name, value: g.name })),
    })

    const group = proxies[groupName]

    spinner = ora(`测速后选择合适的节点，正在对 [${groupName}] 进行测速...`).start()
    await Promise.all(group.all.map(n => api.getProxyDelay(n).catch(() => {})))

    proxies = (await api.getProxies()) as Record<
      string,
      { type: string; name: string; all: string[]; now: string; history?: { delay: number; time: string }[] }
    >
    spinner.stop()

    const updatedGroup = proxies[groupName]

    const nodeEntries = updatedGroup.all.map(n => {
      const node = proxies[n]
      const lastHistory = node?.history && node.history.length ? node.history[node.history.length - 1] : null
      let delay = Infinity
      let delayInfo: string

      if (lastHistory && lastHistory.delay > 0) {
        delay = lastHistory.delay
        if (delay < 200) {
          delayInfo = chalk.green(` ${delay}ms`)
        } else if (delay < 800) {
          delayInfo = chalk.yellow(` ${delay}ms`)
        } else {
          delayInfo = chalk.red(` ${delay}ms`)
        }
      } else if (lastHistory && lastHistory.delay === 0) {
        delayInfo = chalk.red(' [超时]')
      } else {
        delayInfo = chalk.gray(' [未测速]')
      }

      return { name: `${n}${delayInfo}`, value: n, delay }
    })

    nodeEntries.sort((a, b) => a.delay - b.delay)

    const proxyName = await select({
      message: `[${groupName}] 当前: ${updatedGroup.now}, 请选择节点:`,
      pageSize: 15,
      choices: nodeEntries.map(({ name, value }) => ({ name, value })),
    })

    spinner = ora(`正在切换到 ${proxyName}...`).start()
    await api.switchProxy(groupName, proxyName)
    spinner.succeed(`已切换 ${groupName} -> ${proxyName}`)
  } catch (err: unknown) {
    if (spinner && spinner.isSpinning) spinner.stop()
    const message = err instanceof Error ? err.message : String(err)
    if (message && (message.includes('ECONNREFUSED') || message.includes('无法连接'))) {
      console.error(chalk.red('\nClash 服务未运行，请先执行: ck start\n'))
    } else {
      console.error(chalk.red(message))
    }
  }
}
