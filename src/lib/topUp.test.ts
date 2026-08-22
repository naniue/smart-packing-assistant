import { describe, expect, it } from 'vitest'
import type { PackedBox, Product } from '../types'
import { quoteShipping } from './shipping'
import { recommendFreeTopUp } from './topUp'

describe('recommendFreeTopUp', () => {
  it('maximizes added value without increasing bulky-route postage', () => {
    const boxType = {
      id: 'ueno',
      name: '上野可裁剪箱',
      length: 50,
      width: 40,
      height: 30,
      quantity: 10,
      store: 'ueno' as const,
      cuttableHeight: true,
    }
    const packedBox: PackedBox = {
      id: 'ueno-1',
      boxType,
      placements: [],
      usedVolume: 0,
      utilization: 0,
      totalWeight: 3000,
      cardboardWeight: 1000,
      grossWeight: 4000,
      totalValueYen: 0,
      quote: quoteShipping('ueno-bulky', boxType, 4000)!,
    }
    const lookup: Product = {
      id: 'lookup',
      name: 'lookup',
      category: 'figure',
      length: 12.5,
      width: 12,
      height: 15,
      quantity: 1,
      weight: 280,
      unitPriceYen: 5530,
      color: '#f97345',
    }

    const recommendation = recommendFreeTopUp(packedBox, [lookup])

    expect(recommendation.placements).toHaveLength(3)
    expect(recommendation.totalWeight).toBe(840)
    expect(recommendation.totalValueYen).toBe(16_590)
    expect(recommendation.mode).toBe('free')
    expect(recommendation.addedShippingCost).toBe(0)
  })

  it('falls back to maximum fill with minimum added postage', () => {
    const boxType = {
      id: 'ueno',
      name: '上野可裁剪箱',
      length: 50,
      width: 40,
      height: 30,
      quantity: 10,
      store: 'ueno' as const,
      cuttableHeight: true,
    }
    const packedBox: PackedBox = {
      id: 'ueno-1',
      boxType,
      placements: [],
      usedVolume: 0,
      utilization: 0,
      totalWeight: 4000,
      cardboardWeight: 1000,
      grossWeight: 5000,
      totalValueYen: 0,
      quote: quoteShipping('ueno-bulky', boxType, 5000)!,
    }
    const lookup: Product = {
      id: 'lookup',
      name: 'lookup',
      category: 'figure',
      length: 12.5,
      width: 12,
      height: 15,
      quantity: 1,
      weight: 280,
      unitPriceYen: 5530,
      color: '#f97345',
    }

    const recommendation = recommendFreeTopUp(packedBox, [lookup])

    expect(recommendation.mode).toBe('paid')
    expect(recommendation.placements.length).toBeGreaterThan(0)
    expect(recommendation.addedShippingCost).toBeGreaterThan(0)
    expect(recommendation.totalVolume).toBeGreaterThan(0)
  })
})
