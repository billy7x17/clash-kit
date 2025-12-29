#!/usr/bin/env node

const path = require('path')
const fs = require('fs')
const { main } = require('../index.js')

const command = process.argv[2]

if (command === 'init') {
  // 获取 clash-meta 的绝对路径
  // __dirname 是当前脚本 (bin/index.js) 所在的目录
  // 所以 clash-meta 在 ../clash-meta
  const binPath = path.join(__dirname, '../clash-meta')
  
  console.log(`正在设置权限: ${binPath}`)
  
  try {
    // 检查文件是否存在
    if (!fs.existsSync(binPath)) {
      console.error(`错误: 找不到文件 ${binPath}`)
      process.exit(1)
    }

    // 设置为可执行 (rwxr-xr-x)
    fs.chmodSync(binPath, 0o755)
    console.log('权限设置成功！现在你可以运行 clash start 或 node index.js 了。')
  } catch (err) {
    console.error(`权限设置失败: ${err.message}`)
    process.exit(1)
  }
} else if (command === 'start') {
  main()
} else {
  console.log('Usage:')
  console.log('  clash init   - 初始化权限')
  console.log('  clash start  - 启动服务')
}
