import { describe, expect, it } from 'vitest'
import type { BoxType, Product } from '../types'
import { packItems } from './packing'

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  name: '商品',
  length: 10,
  width: 10,
  height: 10,
  quantity: 1,
  weight: 100,
  unitPriceYen: 1000,
  category: 'other',
  color: '#ff6b35',
  ...overrides,
})

const box = (overrides: Partial<BoxType> = {}): BoxType => ({
  id: 'b1',
  name: '纸箱',
  length: 20,
  width: 20,
  height: 20,
  quantity: 10,
  store: 'akiba',
  ...overrides,
})

describe('packItems', () => {
  it('rotates an item when that is required', () => {
    const result = packItems(
      [product({ length: 30, width: 20, height: 10 })],
      [box({ length: 20, width: 10, height: 30 })],
    )

    expect(result.unpacked).toHaveLength(0)
    expect(result.boxes[0].placements[0].dimensions).toEqual({
      length: 20,
      width: 10,
      height: 30,
    })
  })

  it('splits a quantity across multiple boxes', () => {
    const result = packItems(
      [product({ quantity: 9 })],
      [box({ length: 20, width: 20, height: 20 })],
    )

    expect(result.boxes).toHaveLength(2)
    expect(result.boxes[0].placements).toHaveLength(8)
    expect(result.boxes[1].placements).toHaveLength(1)
  })

  it('uses smaller products to fill remaining spaces', () => {
    const result = packItems(
      [
        product({ id: 'large', name: '大件', length: 20, width: 20, height: 10 }),
        product({
          id: 'small',
          name: '小件',
          length: 10,
          width: 10,
          height: 10,
          quantity: 4,
        }),
      ],
      [box()],
    )

    expect(result.boxes).toHaveLength(1)
    expect(result.boxes[0].utilization).toBe(1)
  })

  it('selects a box type that fits more remaining items', () => {
    const result = packItems(
      [product({ quantity: 4 })],
      [
        box({ id: 'small', name: '小箱', length: 10, width: 10, height: 10 }),
        box({ id: 'large', name: '大箱', length: 20, width: 20, height: 10 }),
      ],
    )

    expect(result.boxes).toHaveLength(1)
    expect(result.boxes[0].boxType.id).toBe('large')
  })

  it('reports an item that cannot fit any box', () => {
    const result = packItems(
      [product({ length: 100 })],
      [box({ length: 30, width: 30, height: 30 })],
    )

    expect(result.boxes).toHaveLength(0)
    expect(result.unpacked[0]).toMatchObject({
      quantity: 1,
      reason: '尺寸超过所有箱型',
    })
  })

  it('keeps identical products aligned and totals their weight', () => {
    const result = packItems(
      [
        product({
          length: 10,
          width: 5,
          height: 2,
          quantity: 4,
          weight: 125,
        }),
      ],
      [box({ length: 20, width: 10, height: 4 })],
    )

    const orientations = new Set(
      result.boxes[0].placements.map((placement) =>
        JSON.stringify(placement.dimensions),
      ),
    )
    expect(orientations.size).toBe(1)
    expect(result.boxes[0].totalWeight).toBe(500)
    expect(result.totalWeight).toBe(500)
  })

  it('prefers one box even when two smaller boxes cost less', () => {
    const result = packItems(
      [
        product({
          length: 20,
          width: 20,
          height: 20,
          quantity: 2,
          weight: 100,
        }),
      ],
      [
        box({
          id: 'small',
          name: '小箱',
          length: 20,
          width: 20,
          height: 20,
          quantity: 2,
        }),
        box({
          id: 'large',
          name: '大箱',
          length: 70,
          width: 20,
          height: 20,
          quantity: 1,
        }),
      ],
    )

    expect(result.boxes).toHaveLength(1)
    expect(result.boxes[0].boxType.id).toBe('large')
    expect(result.totalCostCny).toBeCloseTo(192)
  })

  it('honors box inventory while completing the shipment', () => {
    const result = packItems(
      [product({ quantity: 3 })],
      [
        box({
          id: 'single',
          name: '单件箱',
          length: 10,
          width: 10,
          height: 10,
          quantity: 1,
        }),
        box({
          id: 'double',
          name: '双件箱',
          length: 20,
          width: 10,
          height: 10,
          quantity: 1,
        }),
      ],
    )

    expect(result.unpacked).toHaveLength(0)
    expect(result.boxes).toHaveLength(2)
    expect(result.boxes.map((packed) => packed.boxType.id).sort()).toEqual([
      'double',
      'single',
    ])
  })

  it('can mix shipping routes across boxes to lower the total', () => {
    const result = packItems(
      [
        product({
          id: 'long',
          name: '长件',
          length: 100,
          width: 10,
          height: 10,
          weight: 100,
        }),
        product({
          id: 'heavy',
          name: '重件',
          length: 10,
          width: 10,
          height: 10,
          weight: 4000,
        }),
      ],
      [
        box({
          id: 'long-box',
          name: '长箱',
          length: 100,
          width: 10,
          height: 10,
          quantity: 1,
        }),
        box({
          id: 'small-box',
          name: '小箱',
          length: 50,
          width: 40,
          height: 30,
          quantity: 1,
          store: 'ueno',
          cuttableHeight: true,
        }),
      ],
    )

    expect(new Set(result.boxes.map((packed) => packed.quote?.routeId))).toEqual(
      new Set(['akiba-zto', 'ueno-express']),
    )
  })

  it('keeps 24 matching products in one Ueno box instead of a cheaper split', () => {
    const result = packItems(
      [
        product({
          length: 12,
          width: 12.5,
          height: 15,
          quantity: 24,
          weight: 0,
        }),
      ],
      [
        box({
          id: 'half',
          name: '半量箱',
          length: 36,
          width: 25,
          height: 30,
          quantity: 2,
        }),
        box({
          id: 'ueno',
          name: '上野可裁剪箱',
          length: 50,
          width: 40,
          height: 30,
          quantity: 1,
          store: 'ueno',
          cuttableHeight: true,
        }),
      ],
    )

    expect(result.boxes).toHaveLength(1)
    expect(result.boxes.reduce((sum, packed) => sum + packed.placements.length, 0)).toBe(
      24,
    )
    expect(result.boxes[0].boxType.id).toBe('ueno')
    expect(result.singleBoxAlternative).toBeUndefined()
  })

  it('uses the fixed Ueno box and picks the cheaper route from gross weight', () => {
    const result = packItems(
      [
        product({
          length: 40,
          width: 50,
          height: 30,
          weight: 4000,
        }),
      ],
      [
        box({
          id: 'ueno',
          name: '上野可裁剪箱',
          length: 40,
          width: 50,
          height: 30,
          store: 'ueno',
          cuttableHeight: true,
        }),
      ],
      undefined,
      ['ueno-express', 'ueno-bulky'],
    )

    expect(result.boxes).toHaveLength(1)
    expect(result.boxes[0].cardboardWeight).toBeCloseTo(893.33, 2)
    expect(result.boxes[0].grossWeight).toBeCloseTo(4893.33, 2)
    expect(result.boxes[0].quote?.routeId).toBe('ueno-bulky')
    expect(result.totalCostCny).toBe(450)
  })

  it('keeps every Akihabara parcel below 40000 yen', () => {
    const result = packItems(
      [
        product({
          quantity: 5,
          unitPriceYen: 10_000,
        }),
      ],
      [
        box({
          length: 30,
          width: 20,
          height: 10,
          quantity: 2,
        }),
      ],
    )

    expect(result.unpacked).toHaveLength(0)
    expect(result.boxes).toHaveLength(2)
    expect(
      result.boxes.every((packed) => packed.totalValueYen < 40_000),
    ).toBe(true)
  })
})
