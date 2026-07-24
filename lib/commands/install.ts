import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import chalk from 'chalk'
import { confirm } from '@inquirer/prompts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export async function install(): Promise<void> {
  const appDir = path.resolve(__dirname, '../..')

  if (process.platform === 'win32') {
    await installWindows(appDir)
  } else if (process.platform === 'linux') {
    await installLinux(appDir)
  } else {
    console.error(chalk.red('错误: 不支持此操作系统'))
    process.exit(1)
  }
}

async function installWindows(appDir: string): Promise<void> {
  const nodePath = process.execPath
  const scriptPath = path.join(appDir, 'bin/index.js')

  const configPath = path.join(appDir, 'config.yaml')
  if (!fs.existsSync(configPath)) {
    console.error(chalk.red(`错误: 找不到配置文件 ${configPath}`))
    console.error('请先添加订阅: clash sub -a <url>')
    process.exit(1)
  }

  const startupFolder = path.join(process.env.APPDATA!, 'Microsoft/Windows/Start Menu/Programs/Startup')
  const batPath = path.join(startupFolder, 'clash-kit.bat')

  if (fs.existsSync(batPath)) {
    const answer = await confirm({
      message: 'clash-kit 开机自启动已存在，是否重新创建？',
      default: false,
    })
    if (!answer) return
  }

  const batContent = `@echo off
"${nodePath}" "${scriptPath}" start
`
  fs.writeFileSync(batPath, batContent, 'utf8')

  console.log(chalk.green('\n开机自启动设置成功！'))
  console.log(`启动脚本: ${batPath}`)
}

async function installLinux(appDir: string): Promise<void> {
  const binPath = path.join(appDir, 'clash-kit')
  const configPath = path.join(appDir, 'config.yaml')

  if (process.getuid!() !== 0) {
    const answer = await confirm({
      message: '需要 root 权限创建 systemd 服务，是否使用 sudo 运行？',
      default: true,
    })
    if (answer) {
      const nodePath = process.execPath
      execSync(`cd "${appDir}" && sudo "${nodePath}" bin/index.js install`, { stdio: 'inherit' })
      return
    }
    console.error(chalk.red('错误: 需要 root 权限'))
    process.exit(1)
  }

  if (!fs.existsSync(binPath)) {
    console.error(chalk.red(`错误: 找不到内核文件 ${binPath}`))
    console.error('请先运行: clash init')
    process.exit(1)
  }

  if (!fs.existsSync(configPath)) {
    console.error(chalk.red(`错误: 找不到配置文件 ${configPath}`))
    console.error('请先添加订阅: clash sub -a <url>')
    process.exit(1)
  }

  try {
    execSync('systemctl is-active clash-kit', { stdio: 'ignore' })
    const answer = await confirm({
      message: 'clash-kit 服务已存在，是否重新安装？',
      default: false,
    })
    if (!answer) return
  } catch {
    // 服务不存在，继续
  }

  try {
    execSync('systemctl stop clash-kit', { stdio: 'ignore' })
  } catch {
    /* process lookup may fail on some platforms */
  }

  const serviceContent = `[Unit]
Description=Clash Kit - Clash Meta Proxy Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=${appDir}
ExecStart=${binPath} -f ${configPath} -d ${appDir}
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
`

  const servicePath = '/etc/systemd/system/clash-kit.service'
  fs.writeFileSync(servicePath, serviceContent, 'utf8')
  console.log(chalk.green(`服务文件已创建: ${servicePath}`))

  execSync('systemctl daemon-reload')
  console.log(chalk.green('systemd 已重载'))

  console.log('正在启用服务...')
  execSync('systemctl enable clash-kit')

  console.log('正在启动服务...')
  execSync('systemctl start clash-kit')

  console.log(chalk.green('\n服务安装成功！'))
  console.log('\n服务状态:')
  execSync('systemctl status clash-kit', { stdio: 'inherit' })
}
