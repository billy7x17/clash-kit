import path from 'path'
import fs from 'fs'
import { downloadClash } from '../kernel.js'
import axios from 'axios'
import ora from 'ora'
import chalk from 'chalk'
import { CLASH_BIN_PATH, CONFIG_PATH, DATA_DIR, DEFAULT_CONFIG_PATH, migrateLegacyData, packagePath } from '../paths.js'

const DEFAULT_CONFIG = `mixed-port: 7890\n`

const RESOURCES = [
  {
    filename: 'country.mmdb',
    url: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/country-lite.mmdb',
  },
  // {
  //   filename: 'geoip.metadb',
  //   url: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.metadb',
  // },
  // {
  //   filename: 'geosite.dat',
  //   url: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat',
  // },
  // {
  //   filename: 'geoip.dat',
  //   url: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.dat',
  // },
  // {
  //   filename: 'ASN.mmdb',
  //   url: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/GeoLite2-ASN.mmdb',
  // },
]

async function downloadResource(resource, targetDir) {
  const filePath = path.join(targetDir, resource.filename)
  const spinner = ora(`正在下载 ${resource.filename}...`).start()

  try {
    const response = await axios({
      url: resource.url,
      method: 'GET',
      responseType: 'arraybuffer',
      timeout: 30 * 1000, // 30s timeout
    })
    fs.writeFileSync(filePath, response.data)
    spinner.succeed(`${resource.filename} 下载完成`)
  } catch (e) {
    spinner.fail(`${resource.filename} 下载失败: ${e.message}`)
    // 不要抛出错误，让其他资源继续下载
    // throw e
  }
}

export async function init(options = {}) {
  try {
    const migrated = migrateLegacyData()
    const rootDir = DATA_DIR
    const binPath = CLASH_BIN_PATH
    const configPath = CONFIG_PATH
    let hadElevatedTunPermission = false

    if (migrated.length > 0) {
      console.log(chalk.gray(`已迁移历史运行数据到 ${DATA_DIR}: ${migrated.join(', ')}`))
    }

    // 创建默认配置文件（如果不存在）
    if (!fs.existsSync(configPath)) {
      if (fs.existsSync(DEFAULT_CONFIG_PATH)) {
        fs.copyFileSync(DEFAULT_CONFIG_PATH, configPath)
        console.log(`已从 default.yaml 创建配置文件: ${configPath}`)
      } else {
        console.warn(chalk.yellow('警告: 未找到 default.yaml，将创建最小配置文件'))
        fs.writeFileSync(configPath, DEFAULT_CONFIG, 'utf8')
      }
    }

    // 检查并下载资源文件
    console.log(chalk.blue('\n正在检查资源文件...'))
    for (const resource of RESOURCES) {
      const filePath = path.join(rootDir, resource.filename)
      const bundledPath = packagePath(resource.filename)

      if (!fs.existsSync(filePath)) {
        if (fs.existsSync(bundledPath)) {
          fs.copyFileSync(bundledPath, filePath)
          console.log(chalk.gray(`资源 ${resource.filename} 已从内置文件复制`))
        } else {
          await downloadResource(resource, rootDir)
        }
      } else {
        console.log(chalk.gray(`资源 ${resource.filename} 已存在`))
      }
    }
    console.log(chalk.green('资源检查完成\n'))

    const shouldReinstallKernel = options.force || options.remote

    if (fs.existsSync(binPath) && !shouldReinstallKernel) {
      console.log(`Clash 内核已存在: ${binPath}`)
      console.log('正在检查权限...')
      if (process.platform !== 'win32') {
        // 检查是否已有 SUID 权限，如果有则不再重置为 755
        const stats = fs.statSync(binPath)
        const hasSuid = (stats.mode & 0o4000) === 0o4000

        if (!hasSuid) {
          fs.chmodSync(binPath, 0o755)
          console.log('权限已设置为 755 (普通执行权限)。')
        } else {
          console.log('检测到 SUID 权限，保持不变。')
        }
      }
      console.log('权限检查通过！')
      return
    }

    if (shouldReinstallKernel && fs.existsSync(binPath)) {
      if (process.platform !== 'win32') {
        const stats = fs.statSync(binPath)
        hadElevatedTunPermission = stats.uid === 0 && (stats.mode & 0o4000) === 0o4000
      }
      console.log(options.remote ? '远程更新模式，将重新安装内核...' : '强制更新模式，将重新安装内核...')
    }

    console.log(options.remote ? '正在从 GitHub 更新 Clash 内核...' : '正在初始化 Clash 内核...')
    await downloadClash(rootDir, { remote: options.remote })
    console.log('Clash 内核初始化成功！')
    if (hadElevatedTunPermission) {
      console.log(chalk.yellow('内核已更新，TUN 模式所需的 SUID 权限需要重新授权；下次执行 `ck tun on` 时会提示处理。'))
    }

    console.log(chalk.bold.green('\n✅ 初始化完成！接下来：'))
    console.log(chalk.cyan('  1. ck sub      ') + chalk.gray('添加订阅'))
    console.log(chalk.cyan('  2. ck on    ') + chalk.gray('启动 Clash 服务'))
    console.log(chalk.cyan('  3. ck sys on   ') + chalk.gray('开启系统代理'))
    console.log(chalk.gray('\n  更多帮助: ck help\n'))
  } catch (err) {
    console.error(`初始化失败: ${err.message}`)
    process.exit(1)
  }
}
