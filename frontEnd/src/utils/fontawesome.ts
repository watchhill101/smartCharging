import { library } from '@fortawesome/fontawesome-svg-core'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import * as regularIcons from '@fortawesome/free-regular-svg-icons'
import * as brandIcons from '@fortawesome/free-brands-svg-icons'

// 全量导入所有 FontAwesome 图标
const allSolidIcons = Object.values(solidIcons).filter(icon => icon.iconName)
const allRegularIcons = Object.values(regularIcons).filter(icon => icon.iconName)
const allBrandIcons = Object.values(brandIcons).filter(icon => icon.iconName)

// 添加所有图标到库中
library.add(...allSolidIcons)
library.add(...allRegularIcons)
library.add(...allBrandIcons)

// 导出常用图标名称，方便使用
export const SOLID_ICONS = {
  HOME: 'home',
  MAP: 'map-marker-alt',
  BOLT: 'bolt',
  USER: 'user',
  CHARGING_STATION: 'charging-station',
  BATTERY: 'battery-full',
  LOCATION: 'location-dot',
  SEARCH: 'magnifying-glass',
  SETTINGS: 'gear',
  HISTORY: 'clock-rotate-left',
  WALLET: 'wallet',
  CREDIT_CARD: 'credit-card',
  QR_CODE: 'qrcode',
  PHONE: 'phone',
  EMAIL: 'envelope',
  LOCK: 'lock',
  UNLOCK: 'unlock',
  EYE: 'eye',
  EYE_SLASH: 'eye-slash',
  CHECK: 'check',
  TIMES: 'times',
  PLUS: 'plus',
  MINUS: 'minus',
  ARROW_LEFT: 'arrow-left',
  ARROW_RIGHT: 'arrow-right',
  STAR: 'star',
  HEART: 'heart',
  SHARE: 'share',
  DOWNLOAD: 'download'
} as const

export const REGULAR_ICONS = {
  STAR: ['far', 'star'],
  HEART: ['far', 'heart'],
  USER: ['far', 'user'],
  CLOCK: ['far', 'clock']
} as const

export const BRAND_ICONS = {
  WECHAT: 'weixin',
  ALIPAY: 'alipay',
  APPLE: 'apple',
  GOOGLE: 'google'
} as const