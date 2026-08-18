import type {
  BoxType,
  Dimensions,
  ShippingQuote,
  ShippingRouteId,
  ShippingSettings,
} from '../types'

export const DEFAULT_SHIPPING_SETTINGS: ShippingSettings = {
  cnyPer100Yen: 4.8,
}

export const SHIPPING_ROUTES = [
  {
    id: 'ueno-express',
    storeName: '上野顺丰店',
    routeName: '极速路线',
    description: '仅用50×40×最高30cm可裁剪箱；体积重÷6000',
    enabled: true,
  },
  {
    id: 'ueno-bulky',
    storeName: '上野顺丰店',
    routeName: '抛重路线',
    description: '仅用50×40×最高30cm可裁剪箱；90元/kg，实重4kg起',
    enabled: true,
  },
  {
    id: 'akiba-sf',
    storeName: '秋叶原顺丰店',
    routeName: '顺丰小包',
    description: '每箱价值低于4万日元；0.5～3kg；仅限手办、玩偶',
    enabled: true,
  },
  {
    id: 'akiba-zto',
    storeName: '秋叶原顺丰店',
    routeName: '中通小包',
    description: '每箱价值低于4万日元；体积重÷12000，0.5～3kg',
    enabled: true,
  },
] as const

export function roundUpHalf(weight: number) {
  return Math.max(0.5, Math.ceil((weight - 0.0000001) * 2) / 2)
}

export function calculateCardboardWeight(box: Dimensions) {
  const cardboardArea =
    2 * box.length * box.height +
    2 * box.width * box.height +
    4 * box.length * box.width
  return cardboardArea / 15
}

function boxVolume(box: BoxType) {
  return box.length * box.width * box.height
}

export function quoteShipping(
  routeId: ShippingRouteId,
  box: BoxType,
  totalWeightGrams: number,
  settings: ShippingSettings = DEFAULT_SHIPPING_SETTINGS,
): ShippingQuote | null {
  const rawActualWeight = totalWeightGrams / 1000
  const divisor = routeId === 'ueno-express' ? 6000 : 12000
  const rawVolumetricWeight = boxVolume(box) / divisor
  const roundedActualWeight = roundUpHalf(rawActualWeight)
  const roundedVolumetricWeight = roundUpHalf(rawVolumetricWeight)

  if (routeId === 'ueno-express') {
    const actualDominates = roundedActualWeight >= roundedVolumetricWeight
    const originalPrice = actualDominates
      ? roundedActualWeight * 75
      : roundedActualWeight * 85 +
        (roundedVolumetricWeight - roundedActualWeight) * 45
    return {
      routeId,
      storeName: '上野顺丰店',
      routeName: '极速路线',
      currency: 'CNY',
      rawActualWeight,
      roundedActualWeight,
      rawVolumetricWeight,
      roundedVolumetricWeight,
      chargeableWeight: Math.max(
        roundedActualWeight,
        roundedVolumetricWeight,
      ),
      originalPrice,
      cnyPrice: originalPrice,
      formula: actualDominates
        ? `${roundedActualWeight}kg × ¥75`
        : `${roundedActualWeight}kg × ¥85 + ${roundedVolumetricWeight - roundedActualWeight}kg × ¥45`,
    }
  }

  const chargeableWeight = Math.max(
    roundedActualWeight,
    roundedVolumetricWeight,
  )

  if (routeId === 'ueno-bulky') {
    if (rawActualWeight < 4) return null
    const originalPrice = chargeableWeight * 90
    return {
      routeId,
      storeName: '上野顺丰店',
      routeName: '抛重路线',
      currency: 'CNY',
      rawActualWeight,
      roundedActualWeight,
      rawVolumetricWeight,
      roundedVolumetricWeight,
      chargeableWeight,
      originalPrice,
      cnyPrice: originalPrice,
      formula: `${chargeableWeight}kg × ¥90`,
    }
  }

  if (chargeableWeight < 0.5 || chargeableWeight > 3) return null
  const rate = routeId === 'akiba-sf' ? 1700 : 1600
  const routeName = routeId === 'akiba-sf' ? '顺丰小包' : '中通小包'
  const originalPrice = chargeableWeight * rate
  return {
    routeId,
    storeName: '秋叶原顺丰店',
    routeName,
    currency: 'JPY',
    rawActualWeight,
    roundedActualWeight,
    rawVolumetricWeight,
    roundedVolumetricWeight,
    chargeableWeight,
    originalPrice,
    cnyPrice: (originalPrice * settings.cnyPer100Yen) / 100,
    formula: `${chargeableWeight}kg × ¥${rate.toLocaleString()}（日元）`,
  }
}

export function getEligibleQuotes(
  box: BoxType,
  totalWeightGrams: number,
  settings: ShippingSettings = DEFAULT_SHIPPING_SETTINGS,
) {
  const routeIds: ShippingRouteId[] = [
    'ueno-express',
    'ueno-bulky',
    'akiba-sf',
    'akiba-zto',
  ]
  return routeIds
    .map((routeId) => quoteShipping(routeId, box, totalWeightGrams, settings))
    .filter((quote): quote is ShippingQuote => quote !== null)
}
