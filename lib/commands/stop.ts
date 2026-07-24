import ora from 'ora'
import * as sysproxy from '../sysproxy.js'
import * as tun from '../tun.js'
import { setTun } from './tun.js'
import { killClashProcess } from '../kernel.js'
import boxen from 'boxen'
import chalk from 'chalk'

export async function stop(): Promise<void> {
  const spinner = ora('正在停止服务...').start()
  try {
    let wasTunEnabled = false

    spinner.text = '正在关闭系统代理...'
    await sysproxy.disableSystemProxy().catch(() => {})

    const tunEnabled = await tun.isTunEnabled().catch(() => false)
    if (tunEnabled) {
      wasTunEnabled = true
      spinner.text = '正在关闭 TUN 模式...'
      const result = await setTun('off', { silent: true }).catch(() => ({ success: false }))
      if (result && !result.success) {
        spinner.text = 'TUN 关闭失败，继续停止进程...'
      }
    }

    spinner.text = '正在停止 Clash 核心进程...'
    const stopped = killClashProcess()
    spinner.stop()

    if (stopped) {
      const content: string[] = []
      content.push(`Clash 服务: ${chalk.yellow('已停止')}`)
      content.push(`系统代理: ${chalk.gray('已关闭')}`)
      if (wasTunEnabled) content.push(`TUN 模式: ${chalk.gray('已关闭 (DNS 已恢复)')}`)

      console.log(
        boxen(content.join('\n'), {
          title: ' Clash Kit ',
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'green',
          titleAlignment: 'center',
        }),
      )
    } else {
      console.log(
        boxen(chalk.yellow('未找到运行中的 Clash 服务'), {
          title: ' Clash Kit ',
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'yellow',
          titleAlignment: 'center',
        }),
      )
    }
  } catch (err: unknown) {
    if (spinner.isSpinning) spinner.stop()
    const message = err instanceof Error ? err.message : String(err)
    console.error(`\n停止服务时出错: ${message}`)
  }
}
