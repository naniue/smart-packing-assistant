import { describe, expect, it } from 'vitest'
import type { BoxType } from '../types'
import {
  calculateCardboardWeight,
  quoteShipping,
  roundUpHalf,
} from './shipping'

const box = (length: number, width: number, height: number): BoxType => ({
  id: 'box',
  name: '测试箱',
  length,
  width,
  height,
  quantity: 10,
  store: 'akiba',
})

describe('shipping quotes', () => {
  it('includes eight overlapping top and bottom flaps in box weight', () => {
    // Area: side walls 2LH+2WH, eight flaps 4LW; every 225cm² weighs 15g.
    expect(calculateCardboardWeight(box(15, 15, 15))).toBe(120)
  })

  it('rounds every weight upward to 0.5kg', () => {
    expect(roundUpHalf(0.1)).toBe(0.5)
    expect(roundUpHalf(2.3)).toBe(2.5)
    expect(roundUpHalf(2.5)).toBe(2.5)
  })

  it('uses actual weight pricing on the express route', () => {
    const quote = quoteShipping('ueno-express', box(20, 20, 20), 2300)

    expect(quote?.roundedActualWeight).toBe(2.5)
    expect(quote?.roundedVolumetricWeight).toBe(1.5)
    expect(quote?.originalPrice).toBe(187.5)
  })

  it('uses split pricing when volumetric weight is higher', () => {
    const quote = quoteShipping('ueno-express', box(30, 30, 20), 1000)

    expect(quote?.roundedActualWeight).toBe(1)
    expect(quote?.roundedVolumetricWeight).toBe(3)
    expect(quote?.originalPrice).toBe(175)
  })

  it('requires 4kg raw actual weight for the bulky route', () => {
    expect(quoteShipping('ueno-bulky', box(30, 30, 30), 3999)).toBeNull()
    expect(
      quoteShipping('ueno-bulky', box(30, 30, 30), 4000)?.originalPrice,
    ).toBe(360)
  })

  it('enforces the ZTO 3kg limit and converts yen', () => {
    const eligible = quoteShipping(
      'akiba-zto',
      box(20, 20, 20),
      2700,
      { cnyPer100Yen: 5 },
    )
    const tooHeavy = quoteShipping('akiba-zto', box(20, 20, 20), 3001)

    expect(eligible?.chargeableWeight).toBe(3)
    expect(eligible?.originalPrice).toBe(4800)
    expect(eligible?.cnyPrice).toBe(240)
    expect(tooHeavy).toBeNull()
  })

  it('quotes Akihabara SF small parcel at 1700 yen per kg', () => {
    const quote = quoteShipping(
      'akiba-sf',
      box(20, 20, 20),
      900,
      { cnyPer100Yen: 5 },
    )

    expect(quote?.chargeableWeight).toBe(1)
    expect(quote?.originalPrice).toBe(1700)
    expect(quote?.cnyPrice).toBe(85)
  })
})
