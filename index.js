const { spawn } = require('child_process')
const axios = require('axios')
const path = require('path')

// ---------------- 1. 配置项 ----------------
const CLASH_BIN_PATH = path.join(__dirname, 'clash-meta') // 解压后的二进制文件路径
const CLASH_CONFIG_PATH = path.join(__dirname, 'config.yaml') // 配置文件路径
const API_BASE = 'http://127.0.0.1:9090'
const API_SECRET = 'your-strong-secret-key' // 和 config.yaml 一致

// 通用请求头
const headers = {
  Authorization: `Bearer ${API_SECRET}`,
}

// ---------------- 2. 启动 Clash.Meta 进程 ----------------
function startClash() {
  const clashProcess = spawn(CLASH_BIN_PATH, [
    '-f',
    CLASH_CONFIG_PATH, // 指定配置文件
    '-d',
    './', // 工作目录，用于存放日志等文件
  ])

  // 监听进程输出
  clashProcess.stdout.on('data', data => {
    console.log(`[Clash.Meta 输出]: ${data.toString().trim()}`)
  })

  // 监听进程错误
  clashProcess.stderr.on('data', data => {
    console.error(`[Clash.Meta 错误]: ${data.toString().trim()}`)
  })

  // 监听进程退出
  clashProcess.on('exit', code => {
    console.log(`[Clash.Meta 退出] 退出码: ${code}`)
  })

  return clashProcess
}

// ---------------- 3. API 调用示例 ----------------
// 示例1: 查询所有节点
async function getProxies() {
  try {
    const res = await axios.get(`${API_BASE}/proxies`, { headers })
    console.log('\n=== 节点列表 ===')
    const proxyGroup = res.data.proxies.Proxy // 对应 config 里的 Proxy 组
    console.log('当前选中节点:', proxyGroup.now)
    console.log('所有可选节点:', proxyGroup.all)
  } catch (err) {
    console.error('查询节点失败:', err.message)
  }
}

// 示例2: 切换节点
async function switchProxy(groupName, proxyName) {
  try {
    await axios.put(`${API_BASE}/proxies/${encodeURIComponent(groupName)}`, { name: proxyName }, { headers })
    console.log(`\n已切换 ${groupName} 组到节点: ${proxyName}`)
  } catch (err) {
    console.error('切换节点失败:', err.message)
  }
}

// ---------------- 4. 执行流程 ----------------
async function main() {
  // 启动 Clash.Meta
  const clashProcess = startClash()

  // 等待 3 秒，确保进程和 API 完全启动
  setTimeout(async () => {
    await getProxies()
    // 替换成你的节点名
    await switchProxy('Proxy', 'your-proxy-node')
    await getProxies()
  }, 3000)

  // 监听脚本退出信号，关闭 Clash.Meta 进程
  process.on('SIGINT', () => {
    console.log('\n正在关闭 Clash.Meta...')
    clashProcess.kill()
    process.exit()
  })
}

// 运行脚本
if (require.main === module) {
  main()
}

module.exports = { main }
