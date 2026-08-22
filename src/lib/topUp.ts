import type { PackedBox, Placement, Position, Product } from '../types'
import { getRotations } from './packing'
import { quoteShipping } from './shipping'

const EPSILON = 0.000001
const MAX_DEPTH = 32
const BEAM_WIDTH = 60

export interface TopUpRecommendation {
  placements: Placement[]
  totalValueYen: number
  totalWeight: number
  totalVolume: number
  addedShippingCost: number
  finalShippingCost: number
  mode: 'free' | 'paid' | 'none'
}

interface SearchState extends TopUpRecommendation {
  counts: Map<string, number>
}

function overlaps(
  position: Position,
  dimensions: { length: number; width: number; height: number },
  other: Placement,
) {
  return (
    position.x < other.position.x + other.dimensions.length - EPSILON &&
    position.x + dimensions.length > other.position.x + EPSILON &&
    position.y < other.position.y + other.dimensions.height - EPSILON &&
    position.y + dimensions.height > other.position.y + EPSILON &&
    position.z < other.position.z + other.dimensions.width - EPSILON &&
    position.z + dimensions.width > other.position.z + EPSILON
  )
}

function isSupported(
  position: Position,
  dimensions: { length: number; width: number },
  occupied: Placement[],
) {
  if (position.y < EPSILON) return true
  return occupied.some((other) => {
    const touchesTop =
      Math.abs(
        other.position.y + other.dimensions.height - position.y,
      ) < EPSILON
    const overlapsX =
      position.x < other.position.x + other.dimensions.length - EPSILON &&
      position.x + dimensions.length > other.position.x + EPSILON
    const overlapsZ =
      position.z < other.position.z + other.dimensions.width - EPSILON &&
      position.z + dimensions.width > other.position.z + EPSILON
    return touchesTop && overlapsX && overlapsZ
  })
}

function candidatePositions(placements: Placement[]) {
  const xs = new Set([0])
  const ys = new Set([0])
  const zs = new Set([0])
  placements.forEach((placement) => {
    xs.add(placement.position.x + placement.dimensions.length)
    ys.add(placement.position.y + placement.dimensions.height)
    zs.add(placement.position.z + placement.dimensions.width)
  })

  return [...xs].flatMap((x) =>
    [...ys].flatMap((y) => [...zs].map((z) => ({ x, y, z }))),
  )
}

function findPlacements(
  product: Product,
  packedBox: PackedBox,
  additions: Placement[],
) {
  const occupied = [...packedBox.placements, ...additions]
  const candidates: Array<{ position: Position; dimensions: Placement['dimensions'] }> =
    []

  for (const position of candidatePositions(occupied)) {
    for (const dimensions of getRotations(product)) {
      const inside =
        position.x + dimensions.length <= packedBox.boxType.length + EPSILON &&
        position.y + dimensions.height <= packedBox.boxType.height + EPSILON &&
        position.z + dimensions.width <= packedBox.boxType.width + EPSILON
      if (
        inside &&
        isSupported(position, dimensions, occupied) &&
        !occupied.some((placement) => overlaps(position, dimensions, placement))
      ) {
        candidates.push({ position, dimensions })
      }
    }
  }

  return candidates
    .sort(
      (a, b) =>
        a.position.y - b.position.y ||
        a.position.z - b.position.z ||
        a.position.x - b.position.x,
    )
    .slice(0, 4)
}

function stateKey(state: SearchState) {
  const counts = [...state.counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, count]) => `${id}:${count}`)
    .join('|')
  const layout = state.placements
    .map(
      (placement) =>
        `${placement.productId}@${placement.position.x},${placement.position.y},${placement.position.z}:${placement.dimensions.length},${placement.dimensions.width},${placement.dimensions.height}`,
    )
    .sort()
    .join('|')
  return `${counts}#${layout}`
}

function searchTopUp(
  packedBox: PackedBox,
  products: Product[],
  freeOnly: boolean,
): TopUpRecommendation {
  if (packedBox.quote?.routeId !== 'ueno-bulky') {
    return {
      placements: [],
      totalValueYen: 0,
      totalWeight: 0,
      totalVolume: 0,
      addedShippingCost: 0,
      finalShippingCost: 0,
      mode: 'none',
    }
  }

  const originalPrice = packedBox.quote.originalPrice
  let frontier: SearchState[] = [
    {
      placements: [],
      totalValueYen: 0,
      totalWeight: 0,
      totalVolume: 0,
      addedShippingCost: 0,
      finalShippingCost: originalPrice,
      mode: freeOnly ? 'free' : 'paid',
      counts: new Map(),
    },
  ]
  let best = frontier[0]

  for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0; depth += 1) {
    const nextStates = new Map<string, SearchState>()
    for (const state of frontier) {
      for (const product of products) {
        const quote = quoteShipping(
          'ueno-bulky',
          packedBox.boxType,
          packedBox.grossWeight + state.totalWeight + product.weight,
        )
        if (
          !quote ||
          (freeOnly && quote.originalPrice > originalPrice + EPSILON)
        ) {
          continue
        }

        for (const fit of findPlacements(product, packedBox, state.placements)) {
          const count = (state.counts.get(product.id) ?? 0) + 1
          const placement: Placement = {
            instanceId: `topup-${product.id}-${count}`,
            productId: `topup-${product.id}`,
            productName: `建议·${product.name}`,
            color: product.color,
            weight: product.weight,
            unitPriceYen: product.unitPriceYen,
            position: fit.position,
            dimensions: fit.dimensions,
            originalDimensions: {
              length: product.length,
              width: product.width,
              height: product.height,
            },
          }
          const counts = new Map(state.counts)
          counts.set(product.id, count)
          const next: SearchState = {
            placements: [...state.placements, placement],
            totalValueYen: state.totalValueYen + product.unitPriceYen,
            totalWeight: state.totalWeight + product.weight,
            totalVolume:
              state.totalVolume +
              product.length * product.width * product.height,
            addedShippingCost: quote.originalPrice - originalPrice,
            finalShippingCost: quote.originalPrice,
            mode: freeOnly ? 'free' : 'paid',
            counts,
          }
          const key = stateKey(next)
          const existing = nextStates.get(key)
          if (!existing || next.totalValueYen > existing.totalValueYen) {
            nextStates.set(key, next)
          }
          const betterFree =
            next.totalValueYen > best.totalValueYen ||
            (next.totalValueYen === best.totalValueYen &&
              next.placements.length > best.placements.length)
          const betterPaid =
            next.totalVolume > best.totalVolume + EPSILON ||
            (Math.abs(next.totalVolume - best.totalVolume) < EPSILON &&
              (next.addedShippingCost < best.addedShippingCost - EPSILON ||
                (Math.abs(
                  next.addedShippingCost - best.addedShippingCost,
                ) < EPSILON &&
                  next.totalValueYen > best.totalValueYen)))
          if ((freeOnly && betterFree) || (!freeOnly && betterPaid)) {
            best = next
          }
        }
      }
    }
    frontier = [...nextStates.values()]
      .sort(
        freeOnly
          ? (a, b) =>
              b.totalValueYen - a.totalValueYen ||
              b.placements.length - a.placements.length
          : (a, b) =>
              b.totalVolume - a.totalVolume ||
              a.addedShippingCost - b.addedShippingCost ||
              b.totalValueYen - a.totalValueYen,
      )
      .slice(0, BEAM_WIDTH)
  }

  return {
    placements: best.placements,
    totalValueYen: best.totalValueYen,
    totalWeight: best.totalWeight,
    totalVolume: best.totalVolume,
    addedShippingCost: best.addedShippingCost,
    finalShippingCost: best.finalShippingCost,
    mode: best.placements.length > 0 ? best.mode : 'none',
  }
}

export function recommendFreeTopUp(
  packedBox: PackedBox,
  products: Product[],
): TopUpRecommendation {
  const free = searchTopUp(packedBox, products, true)
  return free.placements.length > 0
    ? free
    : searchTopUp(packedBox, products, false)
}
