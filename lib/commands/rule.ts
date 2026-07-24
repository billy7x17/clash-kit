import fs from 'fs'
import chalk from 'chalk'
import YAML from 'yaml'
import { CONFIG_PATH } from '../paths.js'

// 规则类型映射
const RULE_TYPES: Record<string, string> = {
  domain: 'DOMAIN',
  suffix: 'DOMAIN-SUFFIX',
  keyword: 'DOMAIN-KEYWORD',
  ip: 'IP-CIDR',
  geosite: 'GEOSITE',
  geoip: 'GEOIP',
}

interface ParsedRule {
  type: string
  pattern: string
  target: string
  original: string
}

interface RuleGroups {
  DOMAIN: ParsedRule[]
  'DOMAIN-SUFFIX': ParsedRule[]
  'DOMAIN-KEYWORD': ParsedRule[]
  'IP-CIDR': ParsedRule[]
  GEOSITE: ParsedRule[]
  GEOIP: ParsedRule[]
  OTHER: { pattern: string; target: string }[]
}

// 解析单条规则
function parseRule(ruleStr: string): ParsedRule | null {
  const parts = ruleStr.split(',')
  if (parts.length < 3) return null

  const type = parts[0].toUpperCase()
  const pattern = parts[1]
  const target = parts[2]

  return { type, pattern, target, original: ruleStr }
}

// 按类型分组规则
function groupRules(rules: string[]): RuleGroups {
  const groups: RuleGroups = {
    DOMAIN: [],
    'DOMAIN-SUFFIX': [],
    'DOMAIN-KEYWORD': [],
    'IP-CIDR': [],
    GEOSITE: [],
    GEOIP: [],
    OTHER: [],
  }

  for (const rule of rules) {
    const parsed = parseRule(rule)
    if (!parsed) {
      groups.OTHER.push({ pattern: rule, target: '' })
      continue
    }
    const group = groups[parsed.type as keyof Omit<RuleGroups, 'OTHER'>]
    if (group) {
      group.push(parsed)
    } else {
      groups.OTHER.push(parsed)
    }
  }

  return groups
}

// 列出规则
export async function listRules(keyword?: string): Promise<void> {
  if (!fs.existsSync(CONFIG_PATH)) {
    return console.log(chalk.yellow('配置文件不存在，请先添加订阅'))
  }

  const configContent = fs.readFileSync(CONFIG_PATH, 'utf8')
  const config = YAML.parse(configContent)
  const rules: string[] = config.rules || []

  if (rules.length === 0) {
    console.log(chalk.yellow('暂未配置规则'))
    return
  }

  const filteredRules = keyword ? rules.filter(r => r.toLowerCase().includes(keyword.toLowerCase())) : rules
  const groups = groupRules(filteredRules)

  console.log(chalk.cyan('\n=== 代理规则 ===\n'))

  for (const [type, items] of Object.entries(groups)) {
    if (items.length === 0) continue

    console.log(chalk.white(`【${type}】`))
    for (const item of items) {
      console.log(`  ${chalk.green(item.pattern)} -> ${chalk.yellow(item.target)}`)
    }
    console.log()
  }

  if (keyword && filteredRules.length < rules.length) {
    console.log(chalk.gray(`(显示 ${filteredRules.length}/${rules.length} 条规则)`))
  }
}

interface AddRuleOptions {
  type: string
  pattern: string
  target: string
}

// 添加规则
export async function addRule(options: AddRuleOptions): Promise<void> {
  const { type, pattern, target } = options

  if (!type || !pattern || !target) {
    return console.error(chalk.red('错误: 需要指定类型、模式和目标'))
  }

  const ruleType = RULE_TYPES[type.toLowerCase()]
  if (!ruleType) {
    return console.error(chalk.red(`不支持的规则类型: ${type}`))
  }

  if (!fs.existsSync(CONFIG_PATH)) {
    return console.error(chalk.red('配置文件不存在，请先添加订阅'))
  }

  const configContent = fs.readFileSync(CONFIG_PATH, 'utf8')
  const config = YAML.parse(configContent)

  if (!config.rules) {
    config.rules = []
  }

  const newRule = `${ruleType},${pattern},${target}`
  const exists = config.rules.some((r: string) => {
    const parsed = parseRule(r)
    return parsed && parsed.type === ruleType && parsed.pattern === pattern
  })

  if (exists) {
    return console.log(chalk.yellow(`规则已存在: ${pattern}`))
  }

  config.rules.push(newRule)

  fs.writeFileSync(CONFIG_PATH, YAML.stringify(config, { lineWidth: -1 }))

  console.log(chalk.green(`规则添加成功: ${ruleType},${pattern},${target}`))
}

// 删除规则
export async function deleteRule(pattern?: string): Promise<void> {
  if (!pattern) {
    return console.error(chalk.red('错误: 需要指定要删除的模式'))
  }

  if (!fs.existsSync(CONFIG_PATH)) {
    return console.error(chalk.red('配置文件不存在'))
  }

  const configContent = fs.readFileSync(CONFIG_PATH, 'utf8')
  const config = YAML.parse(configContent)

  if (!config.rules || config.rules.length === 0) {
    return console.log(chalk.yellow('暂未配置规则'))
  }

  const beforeCount = config.rules.length
  config.rules = config.rules.filter((r: string) => {
    const parsed = parseRule(r)
    return !parsed || parsed.pattern !== pattern
  })

  if (config.rules.length === beforeCount) {
    return console.log(chalk.yellow(`未找到匹配规则: ${pattern}`))
  }

  fs.writeFileSync(CONFIG_PATH, YAML.stringify(config, { lineWidth: -1 }))

  console.log(chalk.green(`规则删除成功: ${pattern}`))
}
