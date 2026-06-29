import net from 'net'
import { execSync } from 'child_process'
import os from 'os'

/**
 * 检查端口是否被占用 (true = 空闲, false = 被占用)
 * @param {number} port 
 * @returns {Promise<boolean>}
 */
export function isPortOpen(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', (err) => {
      resolve(false) // 端口被占用
    })
    server.once('listening', () => {
      server.close()
      resolve(true) // 端口可用
    })
    server.listen(port, '127.0.0.1')
  })
}

/**
 * 获取占用端口的进程信息
 * @param {number} port 
 * @returns {string|null} 进程名称(PID)，例如 "mihomo (PID: 1234)"
 */
export function getPortOccupier(port) {
  try {
    const platform = os.platform()
    if (platform === 'win32') {
      // Windows 实现
      try {
        const output = execSync(`netstat -ano | findstr :${port}`).toString()
        const lines = output.trim().split('\n')
        if(lines.length > 0) {
            const parts = lines[0].trim().split(/\s+/)
            const pid = parts[parts.length - 1]
            try {
              const tasklist = execSync(`tasklist /fi "pid eq ${pid}" /fo csv /nh`).toString().trim()
              // "Image Name","PID","Session Name","Session#","Mem Usage"
              // "node.exe","24424","Console","1","38,824 K"
              const match = tasklist.match(/^"([^"]+)"/);
              if (match) return `${match[1]} (PID: ${pid})`
            } catch (e) {}
            return `PID: ${pid}`
        }
      } catch (e) { return null }
    } else {
        // macOS / Linux
        // lsof output format: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
        const output = execSync(`lsof -i :${port} -sTCP:LISTEN -P -n`).toString().trim()
        const lines = output.split('\n')
        if (lines.length > 1) {
            const parts = lines[1].trim().split(/\s+/)
            return `${parts[0]} (PID: ${parts[1]})`
        }
    }
  } catch (e) {
    // lsof 找不到时会返回非 0 退出码，抛出错误
    return null
  }
  return null
}

/**
 * 寻找可用端口
 * @param {number} startPort 
 * @returns {Promise<number>}
 */
export function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.on('error', (err) => {
      if (startPort <= 65535) {
        // 核心逻辑：如果报错，递归尝试 +1 的端口
        resolve(findAvailablePort(startPort + 1))
      } else {
        reject(err)
      }
    })
    server.on('listening', () => {
      server.close(() => {
        resolve(startPort)
      })
    })
    server.listen(startPort, '127.0.0.1')
  })
}

/**
 * 从配置值中提取端口号
 * @param {string|number} val - 例如 9090, ":9090", "127.0.0.1:9090"
 * @returns {number|null}
 */
export function extractPort(val) {
  if (!val) return null
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    // 移除空白
    val = val.trim()
    // 如果是纯数字字符串
    if (/^\d+$/.test(val)) return parseInt(val, 10)
    
    // 如果包含冒号，取最后一部分
    if (val.includes(':')) {
      const parts = val.split(':')
      const lastPart = parts[parts.length - 1]
      const port = parseInt(lastPart, 10)
      return isNaN(port) ? null : port
    }
  }
  return null
}
