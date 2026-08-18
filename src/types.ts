export interface Dimensions {
  length: number
  width: number
  height: number
}

export interface Product extends Dimensions {
  id: string
  name: string
  quantity: number
  weight: number
  unitPriceYen: number
  category: 'figure' | 'plush' | 'other'
  color: string
}

export interface BoxType extends Dimensions {
  id: string
  name: string
  quantity: number
  store: 'ueno' | 'akiba'
  cuttableHeight?: boolean
}

export interface Position {
  x: number
  y: number
  z: number
}

export type ShippingRouteId =
  | 'ueno-express'
  | 'ueno-bulky'
  | 'akiba-sf'
  | 'akiba-zto'
export type Currency = 'CNY' | 'JPY'

export interface ShippingSettings {
  cnyPer100Yen: number
}

export interface ShippingQuote {
  routeId: ShippingRouteId
  storeName: string
  routeName: string
  currency: Currency
  rawActualWeight: number
  roundedActualWeight: number
  rawVolumetricWeight: number
  roundedVolumetricWeight: number
  chargeableWeight: number
  originalPrice: number
  cnyPrice: number
  formula: string
}

export interface Placement {
  instanceId: string
  productId: string
  productName: string
  color: string
  weight: number
  unitPriceYen: number
  position: Position
  dimensions: Dimensions
  originalDimensions: Dimensions
}

export interface PackedBox {
  id: string
  boxType: BoxType
  placements: Placement[]
  usedVolume: number
  utilization: number
  totalWeight: number
  cardboardWeight: number
  grossWeight: number
  totalValueYen: number
  quote?: ShippingQuote
}

export interface UnpackedItem {
  productId: string
  productName: string
  quantity: number
  reason: string
}

export interface PackingResult {
  boxes: PackedBox[]
  unpacked: UnpackedItem[]
  totalItemVolume: number
  totalBoxVolume: number
  utilization: number
  totalWeight: number
  totalCardboardWeight: number
  totalShippingWeight: number
  totalCostCny: number
  cnySubtotal: number
  yenSubtotal: number
  shippingSettings: ShippingSettings
  singleBoxAlternative?: {
    boxTypeName: string
    routeName: string
    costCny: number
    differenceCny: number
  }
  uenoPreference?: {
    cheapestCostCny: number
    premiumCny: number
  }
}
