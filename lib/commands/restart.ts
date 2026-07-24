import { stop } from './stop.js'
import { start } from './start.js'

interface RestartOptions {
  sysproxy?: boolean
  tun?: boolean
}

export async function restart(options: RestartOptions): Promise<void> {
  console.log('正在重启 Clash 服务...')
  await stop()
  await new Promise(resolve => setTimeout(resolve, 1000))
  await start(options)
}
