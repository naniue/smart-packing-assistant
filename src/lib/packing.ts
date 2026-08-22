import type {
  BoxType,
  Dimensions,
  PackedBox,
  PackingResult,
  Placement,
  Product,
  ShippingRouteId,
  ShippingSettings,
} from '../types'
import {
  calculateCardboardWeight,
  DEFAULT_SHIPPING_SETTINGS,
  quoteShipping,
  roundUpHalf,
} from './shipping'

interface ItemInstance {
  instanceId: string
  product: Product
}

interface FreeSpace extends Dimensions {
  x: number
  y: number
  z: number
}

interface OpenBox {
  packed: PackedBox
  spaces: FreeSpace[]
}

interface Fit {
  spaceIndex: number
  dimensions: Dimensions
  score: number
}

const EPSILON = 0.000001

const volume = ({ length, width, height }: Dimensions) => length * width * height

export function getRotations(dimensions: Dimensions): Dimensions[] {
  const { length: l, width: w, height: h } = dimensions
  const rotations = [
    { length: l, width: w, height: h },
    { length: l, width: h, height: w },
    { length: w, width: l, height: h },
    { length: w, width: h, height: l },
    { length: h, width: l, height: w },
    { length: h, width: w, height: l },
  ]

  return rotations.filter(
    (rotation, index) =>
      rotations.findIndex(
        (candidate) =>
          candidate.length === rotation.length &&
          candidate.width === rotation.width &&
          candidate.height === rotation.height,
      ) === index,
  )
}

function fits(item: Dimensions, space: Dimensions) {
  return (
    item.length <= space.length + EPSILON &&
    item.width <= space.width + EPSILON &&
    item.height <= space.height + EPSILON
  )
}

function sameDimensions(a: Dimensions, b: Dimensions) {
  return (
    a.length === b.length && a.width === b.width && a.height === b.height
  )
}

function rangesOverlap(startA: number, sizeA: number, startB: number, sizeB: number) {
  return startA < startB + sizeB - EPSILON && startB < startA + sizeA - EPSILON
}

function touchesSameProduct(
  productId: string,
  position: FreeSpace,
  dimensions: Dimensions,
  placements: Placement[],
) {
  return placements.some((placed) => {
    if (placed.productId !== productId) return false
    const xTouch =
      Math.abs(position.x + dimensions.length - placed.position.x) < EPSILON ||
      Math.abs(placed.position.x + placed.dimensions.length - position.x) < EPSILON
    const yTouch =
      Math.abs(position.y + dimensions.height - placed.position.y) < EPSILON ||
      Math.abs(placed.position.y + placed.dimensions.height - position.y) < EPSILON
    const zTouch =
      Math.abs(position.z + dimensions.width - placed.position.z) < EPSILON ||
      Math.abs(placed.position.z + placed.dimensions.width - position.z) < EPSILON

    return (
      (xTouch &&
        rangesOverlap(position.y, dimensions.height, placed.position.y, placed.dimensions.height) &&
        rangesOverlap(position.z, dimensions.width, placed.position.z, placed.dimensions.width)) ||
      (yTouch &&
        rangesOverlap(position.x, dimensions.length, placed.position.x, placed.dimensions.length) &&
        rangesOverlap(position.z, dimensions.width, placed.position.z, placed.dimensions.width)) ||
      (zTouch &&
        rangesOverlap(position.x, dimensions.length, placed.position.x, placed.dimensions.length) &&
        rangesOverlap(position.y, dimensions.height, placed.position.y, placed.dimensions.height))
    )
  })
}

function findBestFit(
  item: Product,
  spaces: FreeSpace[],
  placements: Placement[],
): Fit | null {
  let best: Fit | null = null
  const preferred = placements.find(
    (placement) => placement.productId === item.id,
  )?.dimensions

  spaces.forEach((space, spaceIndex) => {
    for (const dimensions of getRotations(item)) {
      if (!fits(dimensions, space)) continue

      const wastedVolume = volume(space) - volume(dimensions)
      const wasteRatio = wastedVolume / volume(space)
      const orientationPenalty =
        preferred && !sameDimensions(preferred, dimensions) ? 200_000 : 0
      const groupingBonus = touchesSameProduct(
        item.id,
        space,
        dimensions,
        placements,
      )
        ? 120_000
        : 0
      // Prefer compact free spaces, a shared orientation and adjacent same items.
      // Coordinates keep rows on the bottom, back, then left.
      const score =
        wasteRatio * 1_000_000 +
        orientationPenalty -
        groupingBonus +
        space.y * 1_000 +
        space.z * 10 +
        space.x

      if (!best || score < best.score) {
        best = { spaceIndex, dimensions, score }
      }
    }
  })

  return best
}

function splitSpace(space: FreeSpace, item: Dimensions): FreeSpace[] {
  const result: FreeSpace[] = []

  if (space.length - item.length > EPSILON) {
    result.push({
      x: space.x + item.length,
      y: space.y,
      z: space.z,
      length: space.length - item.length,
      width: space.width,
      height: space.height,
    })
  }
  if (space.width - item.width > EPSILON) {
    result.push({
      x: space.x,
      y: space.y,
      z: space.z + item.width,
      length: item.length,
      width: space.width - item.width,
      height: space.height,
    })
  }
  if (space.height - item.height > EPSILON) {
    result.push({
      x: space.x,
      y: space.y + item.height,
      z: space.z,
      length: item.length,
      width: item.width,
      height: space.height - item.height,
    })
  }

  return result
}

function placeItem(openBox: OpenBox, item: ItemInstance, fit: Fit) {
  const space = openBox.spaces[fit.spaceIndex]
  const placement: Placement = {
    instanceId: item.instanceId,
    productId: item.product.id,
    productName: item.product.name,
    color: item.product.color,
    weight: item.product.weight,
    unitPriceYen: item.product.unitPriceYen,
    position: { x: space.x, y: space.y, z: space.z },
    dimensions: fit.dimensions,
    originalDimensions: {
      length: item.product.length,
      width: item.product.width,
      height: item.product.height,
    },
  }

  openBox.packed.placements.push(placement)
  openBox.packed.usedVolume += volume(fit.dimensions)
  openBox.packed.totalWeight += item.product.weight
  openBox.packed.grossWeight += item.product.weight
  openBox.packed.totalValueYen += item.product.unitPriceYen
  openBox.spaces.splice(fit.spaceIndex, 1, ...splitSpace(space, fit.dimensions))
}

function createOpenBox(boxType: BoxType, index: number): OpenBox {
  const cardboardWeight = calculateCardboardWeight(boxType)
  return {
    packed: {
      id: `${boxType.id}-${index}`,
      boxType,
      placements: [],
      usedVolume: 0,
      utilization: 0,
      totalWeight: 0,
      cardboardWeight,
      grossWeight: cardboardWeight,
      totalValueYen: 0,
    },
    spaces: [
      {
        x: 0,
        y: 0,
        z: 0,
        length: boxType.length,
        width: boxType.width,
        height: boxType.height,
      },
    ],
  }
}

function expandProducts(products: Product[]): ItemInstance[] {
  return products
    .flatMap((product) =>
      Array.from({ length: product.quantity }, (_, index) => ({
        instanceId: `${product.id}-${index + 1}`,
        product,
      })),
    )
    .sort((a, b) => {
      const volumeDifference = volume(b.product) - volume(a.product)
      if (volumeDifference !== 0) return volumeDifference
      const longestA = Math.max(a.product.length, a.product.width, a.product.height)
      const longestB = Math.max(b.product.length, b.product.width, b.product.height)
      return longestB - longestA
    })
}

function canPhysicallyFit(item: Dimensions, box: BoxType) {
  return getRotations(item).some((rotation) => fits(rotation, box))
}

function routeMatchesStore(routeId: ShippingRouteId, box: BoxType) {
  if (!routeId.startsWith('ueno-')) return box.store === 'akiba'
  const horizontalSides = [box.length, box.width].sort((a, b) => a - b)
  return (
    box.store === 'ueno' &&
    box.cuttableHeight === true &&
    horizontalSides[0] === 40 &&
    horizontalSides[1] === 50 &&
    box.height <= 30
  )
}

function getBoxVariants(box: BoxType) {
  if (!box.cuttableHeight) return [box]
  return Array.from({ length: Math.floor(box.height) }, (_, index) => ({
    ...box,
    height: index + 1,
  }))
}

interface SearchState {
  remaining: ItemInstance[]
  boxes: PackedBox[]
  usedByType: Map<string, number>
  cost: number
}

const SEARCH_ROUTES: ShippingRouteId[] = [
  'ueno-express',
  'ueno-bulky',
  'akiba-sf',
  'akiba-zto',
]

function buildCandidate(
  boxType: BoxType,
  routeId: ShippingRouteId,
  remaining: ItemInstance[],
  boxIndex: number,
  settings: ShippingSettings,
) {
  const openBox = createOpenBox(boxType, boxIndex)
  const packedIds = new Set<string>()

  for (const item of remaining) {
    if (routeId === 'akiba-sf' && item.product.category === 'other') {
      continue
    }
    if (
      routeId.startsWith('akiba-') &&
      openBox.packed.totalValueYen + item.product.unitPriceYen >= 40_000
    ) {
      continue
    }
    if (
      (routeId === 'akiba-zto' || routeId === 'akiba-sf') &&
      roundUpHalf((openBox.packed.grossWeight + item.product.weight) / 1000) > 3
    ) {
      continue
    }
    const fit = findBestFit(
      item.product,
      openBox.spaces,
      openBox.packed.placements,
    )
    if (fit) {
      placeItem(openBox, item, fit)
      packedIds.add(item.instanceId)
    }
  }

  if (!packedIds.has(remaining[0].instanceId)) return null
  const quote = quoteShipping(
    routeId,
    boxType,
    openBox.packed.grossWeight,
    settings,
  )
  if (!quote) return null

  return {
    packed: {
      ...openBox.packed,
      utilization: openBox.packed.usedVolume / volume(boxType),
      quote,
    },
    packedIds,
  }
}

function remainingSignature(items: ItemInstance[], usedByType: Map<string, number>) {
  const counts = new Map<string, number>()
  items.forEach((item) =>
    counts.set(item.product.id, (counts.get(item.product.id) ?? 0) + 1),
  )
  const itemPart = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, count]) => `${id}:${count}`)
    .join('|')
  const boxPart = [...usedByType.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, count]) => `${id}:${count}`)
    .join('|')
  return `${itemPart}#${boxPart}`
}

function stateUtilization(state: SearchState) {
  const itemVolume = state.boxes.reduce((sum, box) => sum + box.usedVolume, 0)
  const boxesVolume = state.boxes.reduce(
    (sum, box) => sum + volume(box.boxType),
    0,
  )
  return boxesVolume ? itemVolume / boxesVolume : 0
}

function isBetterComplete(candidate: SearchState, current: SearchState | null) {
  if (!current) return true
  return (
    candidate.boxes.length < current.boxes.length ||
    (candidate.boxes.length === current.boxes.length &&
      (candidate.cost < current.cost - EPSILON ||
        (Math.abs(candidate.cost - current.cost) < EPSILON &&
          stateUtilization(candidate) > stateUtilization(current))))
  )
}

function estimateRemainingCost(items: ItemInstance[]) {
  const weightKg = items.reduce(
    (sum, item) => sum + item.product.weight / 1000,
    0,
  )
  return weightKg * 45
}

export function packItems(
  products: Product[],
  boxTypes: BoxType[],
  shippingSettings: ShippingSettings = DEFAULT_SHIPPING_SETTINGS,
  allowedRoutes: ShippingRouteId[] = SEARCH_ROUTES,
): PackingResult {
  const allItems = expandProducts(products)
  let frontier: SearchState[] = [
    {
      remaining: allItems,
      boxes: [],
      usedByType: new Map(),
      cost: 0,
    },
  ]
  let bestComplete: SearchState | null = null
  let bestPartial = frontier[0]
  let bestSingleBox: PackedBox | null = null
  const maxIterations = Math.min(allItems.length, 200)
  const beamWidth = allItems.length > 100 ? 12 : 24

  for (
    let iteration = 0;
    iteration < maxIterations && frontier.length > 0;
    iteration += 1
  ) {
    const deduplicated = new Map<string, SearchState>()

    for (const state of frontier) {
      const firstItem = state.remaining[0]
      for (const boxType of boxTypes) {
        const usedCount = state.usedByType.get(boxType.id) ?? 0
        if (usedCount >= boxType.quantity) continue

        for (const boxVariant of getBoxVariants(boxType)) {
          if (!canPhysicallyFit(firstItem.product, boxVariant)) continue
          for (const routeId of allowedRoutes) {
            if (!routeMatchesStore(routeId, boxVariant)) continue
            const candidate = buildCandidate(
              boxVariant,
              routeId,
              state.remaining,
              usedCount + 1,
              shippingSettings,
            )
            if (!candidate) continue
          if (
            state.boxes.length === 0 &&
            candidate.packedIds.size === state.remaining.length &&
            (!bestSingleBox ||
              candidate.packed.quote!.cnyPrice <
                bestSingleBox.quote!.cnyPrice)
          ) {
            bestSingleBox = candidate.packed
          }

          const nextUsed = new Map(state.usedByType)
          nextUsed.set(boxType.id, usedCount + 1)
          const nextState: SearchState = {
            remaining: state.remaining.filter(
              (item) => !candidate.packedIds.has(item.instanceId),
            ),
            boxes: [...state.boxes, candidate.packed],
            usedByType: nextUsed,
            cost: state.cost + candidate.packed.quote!.cnyPrice,
          }

          if (
            nextState.remaining.length < bestPartial.remaining.length ||
            (nextState.remaining.length === bestPartial.remaining.length &&
              nextState.cost < bestPartial.cost)
          ) {
            bestPartial = nextState
          }

          if (nextState.remaining.length === 0) {
            if (isBetterComplete(nextState, bestComplete)) {
              bestComplete = nextState
            }
            continue
          }
          if (
            bestComplete &&
            nextState.boxes.length + 1 >= bestComplete.boxes.length &&
            nextState.cost >= bestComplete.cost
          ) {
            continue
          }

          const signature = remainingSignature(
            nextState.remaining,
            nextState.usedByType,
          )
          const existing = deduplicated.get(signature)
          if (!existing || nextState.cost < existing.cost) {
            deduplicated.set(signature, nextState)
          }
          }
        }
      }
    }

    frontier = [...deduplicated.values()]
      .sort(
        (a, b) =>
          a.remaining.length - b.remaining.length ||
          a.boxes.length - b.boxes.length ||
          a.cost +
            estimateRemainingCost(a.remaining) -
            (b.cost + estimateRemainingCost(b.remaining)),
      )
      .slice(0, beamWidth)
  }

  const selectedState = bestComplete ?? bestPartial
  const boxes = selectedState.boxes
  const unpackedInstances = selectedState.remaining
  const totalItemVolume = boxes.reduce((sum, box) => sum + box.usedVolume, 0)
  const totalBoxVolume = boxes.reduce((sum, box) => sum + volume(box.boxType), 0)
  const unpackedMap = new Map<string, (typeof unpackedInstances)[number][]>()

  unpackedInstances.forEach((item) => {
    const group = unpackedMap.get(item.product.id) ?? []
    group.push(item)
    unpackedMap.set(item.product.id, group)
  })

  const totalCostCny = boxes.reduce(
    (sum, box) => sum + (box.quote?.cnyPrice ?? 0),
    0,
  )
  const singleBoxQuote = bestSingleBox?.quote

  return {
    boxes,
    unpacked: [...unpackedMap.values()].map((items) => {
      const product = items[0].product
      const fitsKnownBox = boxTypes.some((box) => canPhysicallyFit(product, box))
      return {
        productId: product.id,
        productName: product.name,
        quantity: items.length,
        reason: fitsKnownBox ? '可用箱子数量不足' : '尺寸超过所有箱型',
      }
    }),
    totalItemVolume,
    totalBoxVolume,
    utilization: totalBoxVolume > 0 ? totalItemVolume / totalBoxVolume : 0,
    totalWeight: boxes.reduce((sum, box) => sum + box.totalWeight, 0),
    totalCardboardWeight: boxes.reduce(
      (sum, box) => sum + box.cardboardWeight,
      0,
    ),
    totalShippingWeight: boxes.reduce((sum, box) => sum + box.grossWeight, 0),
    totalCostCny,
    cnySubtotal: boxes.reduce(
      (sum, box) =>
        sum + (box.quote?.currency === 'CNY' ? box.quote.originalPrice : 0),
      0,
    ),
    yenSubtotal: boxes.reduce(
      (sum, box) =>
        sum + (box.quote?.currency === 'JPY' ? box.quote.originalPrice : 0),
      0,
    ),
    shippingSettings,
    singleBoxAlternative:
      boxes.length > 1 && bestSingleBox && singleBoxQuote
        ? {
            boxTypeName: bestSingleBox.boxType.name,
            routeName: singleBoxQuote.routeName,
            costCny: singleBoxQuote.cnyPrice,
            differenceCny: singleBoxQuote.cnyPrice - totalCostCny,
          }
        : undefined,
  }
}
