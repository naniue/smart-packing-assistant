import { describe, expect, it } from 'vitest'
import type { PackedBox, Placement } from '../types'
import { tryNextRotation } from './placement'

const placement = (
  overrides: Partial<Placement> = {},
): Placement => ({
  instanceId: 'item-1',
  productId: 'product-1',
  productName: '商品',
  color: '#f97345',
  weight: 100,
  unitPriceYen: 1000,
  position: { x: 0, y: 0, z: 0 },
  dimensions: { length: 2, width: 1, height: 1 },
  originalDimensions: { length: 2, width: 1, height: 1 },
  ...overrides,
})

const packedBox = (
  placements: Placement[],
  dimensions = { length: 4, width: 4, height: 4 },
): PackedBox => ({
  id: 'box-1',
  boxType: {
    id: 'type-1',
    name: '测试箱',
    quantity: 1,
    store: 'akiba',
    ...dimensions,
  },
  placements,
  usedVolume: placements.reduce(
    (sum, item) =>
      sum +
      item.dimensions.length * item.dimensions.width * item.dimensions.height,
    0,
  ),
  utilization: 0,
  totalWeight: placements.reduce((sum, item) => sum + item.weight, 0),
  cardboardWeight: 100,
  grossWeight:
    100 + placements.reduce((sum, item) => sum + item.weight, 0),
  totalValueYen: placements.reduce(
    (sum, item) => sum + item.unitPriceYen,
    0,
  ),
})

describe('tryNextRotation', () => {
  it('returns the next orientation when it is safe', () => {
    const result = tryNextRotation(packedBox([placement()]), 'item-1')

    expect(result).toEqual({
      success: true,
      dimensions: { length: 1, width: 2, height: 1 },
    })
  })

  it('rejects rotations outside the box', () => {
    const result = tryNextRotation(
      packedBox([placement()], { length: 2, width: 1, height: 1 }),
      'item-1',
    )

    expect(result.success).toBe(false)
    expect(result.reason).toContain('超出箱子')
  })

  it('rejects rotations that collide with neighboring items', () => {
    const neighbors = [
      placement({
        instanceId: 'neighbor-z',
        position: { x: 0, y: 0, z: 1 },
        dimensions: { length: 1, width: 1, height: 1 },
        originalDimensions: { length: 1, width: 1, height: 1 },
      }),
      placement({
        instanceId: 'neighbor-y',
        position: { x: 0, y: 1, z: 0 },
        dimensions: { length: 1, width: 1, height: 1 },
        originalDimensions: { length: 1, width: 1, height: 1 },
      }),
    ]
    const result = tryNextRotation(
      packedBox([placement(), ...neighbors]),
      'item-1',
    )

    expect(result.success).toBe(false)
    expect(result.reason).toContain('重叠')
  })
})
