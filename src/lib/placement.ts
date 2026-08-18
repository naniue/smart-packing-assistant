import type { Dimensions, PackedBox, Placement } from '../types'
import { getRotations } from './packing'

const EPSILON = 0.000001

export interface RotationResult {
  success: boolean
  dimensions?: Dimensions
  reason?: string
}

function isInsideBox(placement: Placement, dimensions: Dimensions, box: Dimensions) {
  return (
    placement.position.x + dimensions.length <= box.length + EPSILON &&
    placement.position.y + dimensions.height <= box.height + EPSILON &&
    placement.position.z + dimensions.width <= box.width + EPSILON
  )
}

function overlaps(
  placement: Placement,
  dimensions: Dimensions,
  other: Placement,
) {
  return (
    placement.position.x <
      other.position.x + other.dimensions.length - EPSILON &&
    placement.position.x + dimensions.length >
      other.position.x + EPSILON &&
    placement.position.y <
      other.position.y + other.dimensions.height - EPSILON &&
    placement.position.y + dimensions.height >
      other.position.y + EPSILON &&
    placement.position.z <
      other.position.z + other.dimensions.width - EPSILON &&
    placement.position.z + dimensions.width >
      other.position.z + EPSILON
  )
}

function dimensionsEqual(a: Dimensions, b: Dimensions) {
  return (
    a.length === b.length && a.width === b.width && a.height === b.height
  )
}

export function tryNextRotation(
  packedBox: PackedBox,
  instanceId: string,
): RotationResult {
  const placement = packedBox.placements.find(
    (item) => item.instanceId === instanceId,
  )
  if (!placement) return { success: false, reason: '没有找到这件商品' }

  const rotations = getRotations(placement.originalDimensions)
  if (rotations.length <= 1) {
    return { success: false, reason: '这件商品的各边相同，没有其他朝向' }
  }

  const currentIndex = rotations.findIndex((rotation) =>
    dimensionsEqual(rotation, placement.dimensions),
  )
  const others = packedBox.placements.filter(
    (item) => item.instanceId !== instanceId,
  )

  for (let offset = 1; offset < rotations.length; offset += 1) {
    const candidate =
      rotations[(Math.max(currentIndex, 0) + offset) % rotations.length]
    if (
      isInsideBox(placement, candidate, packedBox.boxType) &&
      !others.some((other) => overlaps(placement, candidate, other))
    ) {
      return { success: true, dimensions: candidate }
    }
  }

  return {
    success: false,
    reason: '其他朝向会超出箱子或与旁边的商品重叠',
  }
}
