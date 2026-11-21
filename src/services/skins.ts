import type { SkinId } from '@/db/schema'

export interface SkinMeta {
  id: SkinId
  name: string
  desc: string
  /** 预览卡片的纸色 / 墨色 / 强调色 */
  bg: string
  text: string
  accent: string
  font: string
  themeColor: string
  themeColorDark: string
}

export const SKINS: SkinMeta[] = [
  {
    id: 'ink',
    name: '宣纸账簿',
    desc: '纸墨朱砂 · 宋体细线',
    bg: '#f5efe3',
    text: '#201d18',
    accent: '#a63a2e',
    font: "'Songti SC', 'STSong', 'SimSun', serif",
    themeColor: '#f5efe3',
    themeColorDark: '#16140f'
  },
  {
    id: 'mono',
    name: '墨白',
    desc: '黑白编辑 · 直角无饰',
    bg: '#f6f6f4',
    text: '#111111',
    accent: '#111111',
    font: "system-ui, -apple-system, 'PingFang SC', sans-serif",
    themeColor: '#f6f6f4',
    themeColorDark: '#0f0f0f'
  },
  {
    id: 'celadon',
    name: '青瓷',
    desc: '莫兰迪青绿 · 柔圆角',
    bg: '#ecf1ed',
    text: '#243029',
    accent: '#5c7d6a',
    font: "system-ui, -apple-system, 'PingFang SC', sans-serif",
    themeColor: '#ecf1ed',
    themeColorDark: '#121a16'
  },
  {
    id: 'kraft',
    name: '牛皮纸',
    desc: '复古票据 · 砖红虚线',
    bg: '#e8dcc4',
    text: '#2f2619',
    accent: '#a8542f',
    font: "'Songti SC', 'STSong', 'SimSun', serif",
    themeColor: '#e8dcc4',
    themeColorDark: '#1a1510'
  }
]

const SKIN_IDS = new Set<string>(SKINS.map((skin) => skin.id))

export function resolveSkin(value: unknown): SkinId {
  return typeof value === 'string' && SKIN_IDS.has(value) ? (value as SkinId) : 'ink'
}

export function skinMeta(id: SkinId): SkinMeta {
  return SKINS.find((skin) => skin.id === id) ?? SKINS[0]
}
