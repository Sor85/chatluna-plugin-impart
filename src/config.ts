import { Schema } from '@chatluna/schema'

export interface RateBand {
  min: number
  max: number
  rate: number
}

export interface Config {
  initialLengthMin: number
  initialLengthMax: number
  initialDepthMin: number
  initialDepthMax: number
  growth: number
  growthVariance: number
  setback: number
  setbackVariance: number
  cooldownSeconds: number
  rates: RateBand[]
  defaultEnabled: boolean
  imageMode: boolean
  rankingLimit: number
  allChannels: boolean
  dashboard: boolean
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    defaultEnabled: Schema.boolean().default(true).label('新群默认开放').description('未设置开关的群默认状态。开始银趴和结束银趴只改变当前群，不清空数据。'),
    cooldownSeconds: Schema.number().min(0).max(86400).step(1).default(5).label('操作冷却（秒）').description('打胶与挖矿共用冷却，跨群共享；帮助他人时双方均需冷却完成。')
  }).description('基础设置'),
  Schema.object({
    initialLengthMin: Schema.number().min(-100000).max(100000).default(0).label('初始长度下限（厘米）').description('首次打胶时长度在下限与上限之间随机取值。'),
    initialLengthMax: Schema.number().min(-100000).max(100000).default(18).label('初始长度上限（厘米）'),
    initialDepthMin: Schema.number().min(-100000).max(100000).default(-18).label('初始深度下限（厘米）').description('首次挖矿时深度在下限与上限之间随机取值。长度与深度相互独立。'),
    initialDepthMax: Schema.number().min(-100000).max(100000).default(0).label('初始深度上限（厘米）'),
    growth: Schema.number().min(0.01).max(100000).default(10).label('成功变化基数（厘米）').description('乘以 1 + 生长系数。打胶成功时长度增加，挖矿成功时深度数值减小；两者都可以为负。'),
    growthVariance: Schema.number().min(0).max(100).default(45).label('成功变化浮动（±%）'),
    setback: Schema.number().min(0.01).max(100000).default(12).label('失败反向变化（厘米）').description('不乘生长系数。打胶失败时长度减少，挖矿失败时深度数值增大。'),
    setbackVariance: Schema.number().min(0).max(100).default(45).label('失败变化浮动（±%）')
  }).description('数值规则'),
  Schema.object({
    rates: Schema.array(Schema.object({
      min: Schema.number().min(-1e12).max(1e12).default(0).required().label('下限（含，厘米）'),
      max: Schema.number().min(-1e12).max(1e12).default(100).required().label('上限（不含，厘米）'),
      rate: Schema.number().min(0).max(100).default(50).required().label('成功率（%）')
    })).role('impart:rates').default([
      { min: -1e12, max: 0, rate: 100 },
      { min: 0, max: 100, rate: 80 },
      { min: 100, max: 300, rate: 70 },
      { min: 300, max: 500, rate: 60 },
      { min: 500, max: 1000, rate: 50 },
      { min: 1000, max: 2000, rate: 40 },
      { min: 2000, max: 10000, rate: 30 },
      { min: 10000, max: 50000, rate: 20 },
      { min: 50000, max: 100000, rate: 10 },
      { min: 100000, max: 1e12, rate: 0 }
    ]).label('成功率区间').description('依次匹配第一个左闭右开区间，未匹配时为 50%。打胶使用当前长度，挖矿使用当前深度的相反数。')
  }).description('成功率'),
  Schema.object({
    imageMode: Schema.boolean().default(true).label('图片排行榜').description('使用 Takumi 与内置中文字体生成 PNG，渲染失败回退文字。'),
    rankingLimit: Schema.number().min(1).max(50).step(1).default(15).label('排行榜人数'),
    allChannels: Schema.boolean().default(false).label('跨群排行榜').description('开启后展示当前平台全部玩家；关闭时仅展示在本群参与过的玩家，不代表实时群成员名单。')
  }).description('排行榜'),
  Schema.object({
    dashboard: Schema.boolean().default(true).label('仪表盘统计').description('在 WebUI 仪表盘按群显示最长与最短各 5 名，以及玩家数和群组开关状态。')
  }).description('WebUI')
])
