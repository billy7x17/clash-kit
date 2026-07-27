import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import { confirm } from '@inquirer/prompts'
import { CLASH_BIN_PATH, CONFIG_PATH, DATA_DIR, PACKAGE_ROOT, STARTUP_LOG_PATH } from '../paths.js'

export async function install(): Promise<void> {
  if (process.platform === 'win32') {
    await installWindows()
  } else if (process.platform === 'linux') {
    await installLinux()
  } else {
    console.error(chalk.red('错误: 不支持此操作系统'))
    process.exit(1)
  }
}

async function installWindows(): Promise<void> {
  if (!fs.existsSync(CLASH_BIN_PATH)) {
    console.error(chalk.red(`错误: 找不到内核文件 ${CLASH_BIN_PATH}`))
    console.error('请先运行: ck init')
    process.exit(1)
  }

  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(chalk.red(`错误: 找不到配置文件 ${CONFIG_PATH}`))
    console.error('请先添加订阅: ck sub -a <url>')
    process.exit(1)
  }

  const startupFolder = path.join(process.env.APPDATA!, 'Microsoft/Windows/Start Menu/Programs/Startup')
  const batPath = path.join(startupFolder, 'clash-kit.bat')
  const distBinPath = path.join(PACKAGE_ROOT, 'dist', 'bin', 'index.js')
  const batContent = `@echo off\r\n"${process.execPath}" "${distBinPath}" start >> "${STARTUP_LOG_PATH}" 2>&1\r\n`

  if (fs.existsSync(batPath)) {
    const existingContent = fs.readFileSync(batPath, 'utf8')
    if (existingContent === batContent) {
      console.log(chalk.green('开机自启动已配置，无需重复安装。'))
      return
    }
    const answer = await confirm({
      message: 'clash-kit 开机自启动已存在但内容不同，是否覆盖？',
      default: false,
    })
    if (!answer) return
  }

  fs.writeFileSync(batPath, batContent, 'utf8')

  console.log(chalk.green('\n开机自启动设置成功！'))
  console.log(`启动脚本: ${batPath}`)
}

async function installLinux(): Promise<void> {
  if (process.getuid!() !== 0) {
    const answer = await confirm({
      message: '需要 root 权限创建 systemd 服务，是否使用 sudo 运行？',
      default: true,
    })
    if (answer) {
      const scriptPath = process.argv[1]
      execSync(`sudo "${process.execPath}" "${scriptPath}" install`, { stdio: 'inherit' })
      return
    }
    console.error(chalk.red('错误: 需要 root 权限'))
    process.exit(1)
  }

  if (!fs.existsSync(CLASH_BIN_PATH)) {
    console.error(chalk.red(`错误: 找不到内核文件 ${CLASH_BIN_PATH}`))
    console.error('请先运行: ck init')
    process.exit(1)
  }

  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(chalk.red(`错误: 找不到配置文件 ${CONFIG_PATH}`))
    console.error('请先添加订阅: ck sub -a <url>')
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
Description=Clash Kit - Mihomo Proxy Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=${DATA_DIR}
ExecStart=${CLASH_BIN_PATH} -f ${CONFIG_PATH} -d ${DATA_DIR}
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
