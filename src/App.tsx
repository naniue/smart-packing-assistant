import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { packItems } from './lib/packing'
import { tryNextRotation } from './lib/placement'
import { recommendFreeTopUp } from './lib/topUp'
import {
  DEFAULT_SHIPPING_SETTINGS,
  SHIPPING_ROUTES,
} from './lib/shipping'
import type {
  BoxType,
  PackedBox,
  PackingResult,
  Placement,
  Product,
  ShippingQuote,
  ShippingRouteId,
  ShippingSettings,
} from './types'
import './App.css'

const PackingScene = lazy(() =>
  import('./components/PackingScene').then((module) => ({
    default: module.PackingScene,
  })),
)

const PRODUCT_COLORS = [
  '#f97345',
  '#31a87c',
  '#4b7bec',
  '#b76ad9',
  '#e4a72d',
  '#e35d7a',
]

const PRODUCT_PRESETS: Array<Omit<Product, 'id' | 'color'>> = [
  {
    name: 'lookup',
    category: 'figure',
    length: 12.5,
    width: 12,
    height: 15,
    quantity: 7,
    weight: 280,
    unitPriceYen: 5530,
  },
  {
    name: '晚安',
    category: 'figure',
    length: 39,
    width: 17,
    height: 8,
    quantity: 3,
    weight: 808,
    unitPriceYen: 7920,
  },
  {
    name: '趴趴海贼',
    category: 'figure',
    length: 27,
    width: 15,
    height: 10,
    quantity: 6,
    weight: 700,
    unitPriceYen: 9720,
  },
  {
    name: '忍喵',
    category: 'figure',
    length: 19,
    width: 9,
    height: 9.5,
    quantity: 4,
    weight: 330,
    unitPriceYen: 5500,
  },
]

const TOP_UP_PRODUCTS: Product[] = PRODUCT_PRESETS.map((product, index) => ({
  ...product,
  id: `preset-${product.name}`,
  color: PRODUCT_COLORS[index % PRODUCT_COLORS.length],
}))

const exampleProducts: Product[] = [
  {
    id: 'product-books',
    name: '精装书',
    length: 24,
    width: 17,
    height: 4,
    quantity: 10,
    weight: 620,
    unitPriceYen: 1800,
    category: 'other',
    color: PRODUCT_COLORS[0],
  },
  {
    id: 'product-cups',
    name: '保温杯',
    length: 8,
    width: 8,
    height: 22,
    quantity: 6,
    weight: 360,
    unitPriceYen: 2800,
    category: 'other',
    color: PRODUCT_COLORS[1],
  },
  {
    id: 'product-towels',
    name: '毛巾礼盒',
    length: 18,
    width: 12,
    height: 7,
    quantity: 8,
    weight: 280,
    unitPriceYen: 1500,
    category: 'other',
    color: PRODUCT_COLORS[2],
  },
]

const commonBox = (
  id: string,
  name: string,
  length: number,
  width: number,
  height: number,
): BoxType => ({
  id,
  name,
  length,
  width,
  height,
  quantity: 99,
  store: 'akiba',
})

const exampleBoxes: BoxType[] = [
  {
    id: 'box-ueno-cuttable',
    name: '上野可裁剪箱',
    length: 40,
    width: 50,
    height: 30,
    quantity: 99,
    store: 'ueno',
    cuttableHeight: true,
  },
  commonBox('box-f2', '0.2飞机盒 F2', 20, 14, 4),
  commonBox('box-f3', '0.3飞机盒 F3', 24, 20, 5),
  commonBox('box-print-05', '0.5印刷', 20, 15, 10),
  commonBox('box-print-07', '0.7印刷', 24, 20, 9),
  commonBox('box-print-s1', 'S1印刷', 25, 20, 12),
  commonBox('box-print-15', '1.5印刷', 32, 21, 13),
  commonBox('box-print-s15', 'S1.5印刷', 25, 20, 18),
  commonBox('box-print-2', '2印刷', 35, 24, 14),
  commonBox('box-f4', '扇子专用箱 F4', 44, 34, 16),
  commonBox('box-g4', 'G4', 36, 27, 25),
  commonBox('box-g5', 'G5', 40, 30, 25),
  commonBox('box-a6', 'A6', 50, 30, 24),
  commonBox('box-c6', 'C6', 40, 30, 30),
  commonBox('box-c7', 'C7', 50, 35, 24),
  commonBox('box-d7', 'D7', 40, 35, 30),
  commonBox('box-365', '36.5', 75, 54, 54),
  commonBox('box-snowboard', '雪板专用箱', 178, 32, 10),
  commonBox('box-q3', '球拍用 Q3', 75, 34, 7),
  commonBox('box-magazine', '杂志专用箱', 35, 30, 10),
  commonBox('box-print-25', '2.5印刷', 38, 25, 15),
  commonBox('box-print-3', '正3印刷', 30, 29, 20),
  commonBox('box-print-g3', 'G3印刷', 38, 27, 17),
  commonBox('box-d3', 'D3', 38, 27, 17),
  commonBox('box-miyake', '三宅包专用', 39, 38, 4),
  commonBox('box-cigarette-05', '烟专用 B0.5', 31, 11, 8),
  commonBox('box-cigarette-1', '烟专用 B1', 35, 15, 11),
  commonBox('box-wine-25', '酒专用 B2.5', 52, 17, 17),
  commonBox('box-a8', 'A8', 52, 38, 24),
  commonBox('box-a9', 'A9', 45, 35, 34),
  commonBox('box-b10', 'B10', 50, 40, 30),
  commonBox('box-b11', 'B11', 50, 33, 40),
  commonBox('box-a12', 'A12', 60, 40, 30),
  commonBox('box-c12', 'C12', 50, 36, 40),
  commonBox('box-25-160', '25（160尺寸）', 55, 55, 49),
  commonBox('box-c365', 'C36.5', 102, 39, 55),
]

const newId = () => crypto.randomUUID()
const percent = (value: number) => `${Math.round(value * 100)}%`
const formatSize = (item: { length: number; width: number; height: number }) =>
  `${item.length} × ${item.width} × ${item.height} cm`
const formatMoney = (quote: ShippingQuote) =>
  quote.currency === 'CNY'
    ? `¥${quote.originalPrice.toFixed(2)}`
    : `JP¥${quote.originalPrice.toLocaleString()}`
const formatWeight = (weight: number) =>
  `${Number(weight.toFixed(2)).toLocaleString()} kg`
const routeUnavailableReason = (routeId: ShippingRouteId) => {
  if (routeId === 'ueno-bulky') {
    return '每箱实重不足4kg、尺寸超过上野可裁剪箱或箱子数量不足'
  }
  if (routeId === 'ueno-express') {
    return '商品尺寸超过上野可裁剪箱或箱子数量不足'
  }
  if (routeId === 'akiba-sf') {
    return '受箱型、0.5～3kg重量范围、商品品类或每箱4万日元限额影响'
  }
  return '受箱型、0.5～3kg重量范围或每箱4万日元限额影响'
}

function loadSaved<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key)
    return saved ? (JSON.parse(saved) as T) : fallback
  } catch {
    return fallback
  }
}

function loadProducts() {
  return loadSaved<Partial<Product>[]>(
    'smart-pack-products',
    exampleProducts,
  ).map((product, index) => ({
    id: product.id ?? newId(),
    name: product.name ?? `商品 ${index + 1}`,
    length: product.length ?? 10,
    width: product.width ?? 10,
    height: product.height ?? 10,
    quantity: product.quantity ?? 1,
    weight: product.weight ?? 0,
    unitPriceYen: product.unitPriceYen ?? 0,
    category: product.category ?? 'other',
    color: product.color ?? PRODUCT_COLORS[index % PRODUCT_COLORS.length],
  }))
}

function loadBoxes(): BoxType[] {
  const current = localStorage.getItem('smart-pack-boxes-v3')
  if (current) return loadSaved('smart-pack-boxes-v3', exampleBoxes)

  const previous = loadSaved<Partial<BoxType>[]>(
    'smart-pack-boxes-v2',
    [],
  ).map((box, index) => ({
    id: box.id ?? newId(),
    name: box.name ?? `箱型 ${index + 1}`,
    length: box.length ?? 40,
    width: box.width ?? 30,
    height: box.height ?? 30,
    quantity: box.quantity ?? 99,
    store: 'akiba' as const,
  }))
  return previous.length
    ? [exampleBoxes[0], ...previous.filter((box) => box.id !== exampleBoxes[0].id)]
    : exampleBoxes
}

function NumberInput({
  value,
  label,
  mobileLabel,
  integer = false,
  allowZero = false,
  disabled = false,
  onChange,
}: {
  value: number
  label: string
  mobileLabel: string
  integer?: boolean
  allowZero?: boolean
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <label className="number-field">
      <span>{mobileLabel}</span>
    <input
      aria-label={label}
      type="number"
      min={allowZero ? 0 : integer ? 1 : 0.1}
      step={integer ? 1 : 0.1}
      value={allowZero && value === 0 ? 0 : value || ''}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
    />
    </label>
  )
}

interface RouteComparison {
  routeId: ShippingRouteId
  storeName: string
  routeName: string
  available: boolean
  totalCostCny: number
  originalTotal: number
  currency: 'CNY' | 'JPY'
  boxCount: number
  result: PackingResult
}

function App() {
  const [products, setProducts] = useState<Product[]>(loadProducts)
  const [boxTypes, setBoxTypes] = useState<BoxType[]>(loadBoxes)
  const [result, setResult] = useState<PackingResult | null>(() =>
    loadSaved<PackingResult | null>('smart-pack-result-v9', null),
  )
  const [shippingSettings, setShippingSettings] = useState<ShippingSettings>(
    () => loadSaved('smart-pack-shipping', DEFAULT_SHIPPING_SETTINGS),
  )
  const [selectedBox, setSelectedBox] = useState(0)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [rotationMessage, setRotationMessage] = useState('')
  const [isCalculating, setIsCalculating] = useState(false)
  const [showBoxTypes, setShowBoxTypes] = useState(false)
  const [showCostDetails, setShowCostDetails] = useState(false)
  const [routeComparisons, setRouteComparisons] = useState<RouteComparison[]>([])
  const [uenoAltBoxIndex, setUenoAltBoxIndex] = useState(0)
  const [showTopUpPlan, setShowTopUpPlan] = useState(false)
  const [error, setError] = useState('')
  const resultRef = useRef<HTMLElement>(null)

  useEffect(() => {
    localStorage.setItem('smart-pack-products', JSON.stringify(products))
    localStorage.setItem('smart-pack-boxes-v3', JSON.stringify(boxTypes))
  }, [products, boxTypes])

  useEffect(() => {
    if (result) {
      localStorage.setItem('smart-pack-result-v9', JSON.stringify(result))
    } else {
      localStorage.removeItem('smart-pack-result-v9')
    }
  }, [result])

  useEffect(() => {
    localStorage.setItem('smart-pack-shipping', JSON.stringify(shippingSettings))
  }, [shippingSettings])

  const totalPieces = useMemo(
    () => products.reduce((sum, item) => sum + (item.quantity || 0), 0),
    [products],
  )

  const updateProduct = <K extends keyof Product>(
    id: string,
    field: K,
    value: Product[K],
  ) => {
    setProducts((items) =>
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    )
    setResult(null)
  }

  const updateProductName = (id: string, name: string) => {
    const preset = PRODUCT_PRESETS.find(
      (item) => item.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
    )
    setProducts((items) =>
      items.map((item) =>
        item.id === id
          ? preset
            ? { ...item, ...preset, name }
            : { ...item, name }
          : item,
      ),
    )
    setResult(null)
  }

  const updateBox = <K extends keyof BoxType>(
    id: string,
    field: K,
    value: BoxType[K],
  ) => {
    setBoxTypes((items) =>
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    )
    setResult(null)
  }

  const addProduct = () => {
    const index = products.length
    setProducts((items) => [
      ...items,
      {
        id: newId(),
        name: `商品 ${index + 1}`,
        length: 10,
        width: 10,
        height: 10,
        quantity: 1,
        weight: 0,
        unitPriceYen: 0,
        category: 'other',
        color: PRODUCT_COLORS[index % PRODUCT_COLORS.length],
      },
    ])
    setResult(null)
  }

  const addBox = () => {
    setShowBoxTypes(true)
    setBoxTypes((items) => [
      ...items,
      {
        id: newId(),
        name: `箱型 ${items.length + 1}`,
        length: 40,
        width: 30,
        height: 30,
        quantity: 10,
        store: 'akiba',
      },
    ])
    setResult(null)
  }

  const calculate = () => {
    const invalidProduct = products.some(
      (item) =>
        !item.name.trim() ||
        item.length <= 0 ||
        item.width <= 0 ||
        item.height <= 0 ||
        item.weight < 0 ||
        !Number.isInteger(item.weight) ||
        item.unitPriceYen < 0 ||
        !Number.isInteger(item.unitPriceYen) ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0,
    )
    const invalidBox = boxTypes.some(
      (item) =>
        !item.name.trim() ||
        item.length <= 0 ||
        item.width <= 0 ||
        item.height <= 0 ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0,
    )

    if (
      !products.length ||
      !boxTypes.length ||
      invalidProduct ||
      invalidBox ||
      shippingSettings.cnyPer100Yen <= 0
    ) {
      setError(
        '请完整填写商品、箱型和汇率；尺寸与汇率应大于0，数量应为正整数，重量与单价应为非负整数。',
      )
      return
    }

    setError('')
    setIsCalculating(true)
    window.setTimeout(() => {
      const fewestBoxResult = packItems(products, boxTypes, shippingSettings)
      const uenoResult = packItems(products, boxTypes, shippingSettings, [
        'ueno-express',
        'ueno-bulky',
      ])
      const uenoAvailable =
        uenoResult.unpacked.length === 0 && uenoResult.boxes.length > 0
      const useUeno =
        uenoAvailable &&
        uenoResult.boxes.length === fewestBoxResult.boxes.length
      const bestResult = useUeno
        ? {
            ...uenoResult,
            uenoPreference: {
              cheapestCostCny: fewestBoxResult.totalCostCny,
              premiumCny: Math.max(
                0,
                uenoResult.totalCostCny - fewestBoxResult.totalCostCny,
              ),
            },
          }
        : fewestBoxResult
      const comparisons = SHIPPING_ROUTES.map((route) => {
        const routeResult = packItems(products, boxTypes, shippingSettings, [
          route.id as ShippingRouteId,
        ])
        const available =
          routeResult.unpacked.length === 0 && routeResult.boxes.length > 0
        const currency =
          route.id.startsWith('akiba-') ? ('JPY' as const) : ('CNY' as const)
        return {
          routeId: route.id as ShippingRouteId,
          storeName: route.storeName,
          routeName: route.routeName,
          available,
          totalCostCny: routeResult.totalCostCny,
          originalTotal:
            currency === 'JPY'
              ? routeResult.yenSubtotal
              : routeResult.cnySubtotal,
          currency,
          boxCount: routeResult.boxes.length,
          result: routeResult,
        }
      })
      setResult(bestResult)
      setRouteComparisons(comparisons)
      setSelectedBox(0)
      setSelectedItemId(null)
      setRotationMessage('')
      setShowCostDetails(false)
      setUenoAltBoxIndex(0)
      setShowTopUpPlan(false)
      setIsCalculating(false)
      requestAnimationFrame(() =>
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      )
    }, 20)
  }

  const clearAll = () => {
    setProducts([])
    setBoxTypes([])
    setResult(null)
    setError('')
    setSelectedItemId(null)
  }

  const loadExample = () => {
    setProducts(exampleProducts)
    setBoxTypes(exampleBoxes)
    setResult(null)
    setError('')
    setSelectedItemId(null)
  }

  const activeBox = result?.boxes[selectedBox]
  const uenoBulkyAlternative = routeComparisons.find(
    (comparison) => comparison.routeId === 'ueno-bulky',
  )
  const activeUenoAltBox =
    uenoBulkyAlternative?.result.boxes[uenoAltBoxIndex]
  const activeTopUpRecommendation = useMemo(
    () =>
      activeUenoAltBox
        ? recommendFreeTopUp(activeUenoAltBox, TOP_UP_PRODUCTS)
        : null,
    [activeUenoAltBox],
  )
  const uenoAltDisplayBox = useMemo(() => {
    if (!activeUenoAltBox || !activeTopUpRecommendation) return activeUenoAltBox
    const addedVolume = activeTopUpRecommendation.placements.reduce(
      (sum, placement) =>
        sum +
        placement.dimensions.length *
          placement.dimensions.width *
          placement.dimensions.height,
      0,
    )
    return {
      ...activeUenoAltBox,
      placements: [
        ...activeUenoAltBox.placements,
        ...activeTopUpRecommendation.placements,
      ],
      usedVolume: activeUenoAltBox.usedVolume + addedVolume,
      utilization:
        (activeUenoAltBox.usedVolume + addedVolume) /
        (activeUenoAltBox.boxType.length *
          activeUenoAltBox.boxType.width *
          activeUenoAltBox.boxType.height),
      totalWeight:
        activeUenoAltBox.totalWeight + activeTopUpRecommendation.totalWeight,
      grossWeight:
        activeUenoAltBox.grossWeight + activeTopUpRecommendation.totalWeight,
      totalValueYen:
        activeUenoAltBox.totalValueYen +
        activeTopUpRecommendation.totalValueYen,
    }
  }, [activeTopUpRecommendation, activeUenoAltBox])
  const groupedPlacements = useMemo(() => {
    if (!activeBox) return []
    const groups = new Map<
      string,
      { name: string; color: string; count: number; weight: number }
    >()
    activeBox.placements.forEach((placement) => {
      const existing = groups.get(placement.productId)
      if (existing) {
        existing.count += 1
        existing.weight += placement.weight
      }
      else
        groups.set(placement.productId, {
          name: placement.productName,
          color: placement.color,
          count: 1,
          weight: placement.weight,
        })
    })
    return [...groups.values()]
  }, [activeBox])

  const selectedPlacement = activeBox?.placements.find(
    (placement) => placement.instanceId === selectedItemId,
  )

  const summarizePlacements = (placements: Placement[]) => {
    const counts = new Map<string, number>()
    placements.forEach((placement) => {
      counts.set(
        placement.productName,
        (counts.get(placement.productName) ?? 0) + 1,
      )
    })
    return [...counts.entries()]
      .map(([name, count]) => `${name} × ${count}`)
      .join('、')
  }
  const summarizeBoxContents = (packedBox: PackedBox) =>
    summarizePlacements(packedBox.placements)

  const selectItem = (instanceId: string) => {
    setSelectedItemId(instanceId)
    setRotationMessage('')
  }

  const rotateSelectedItem = () => {
    if (!result || !activeBox || !selectedItemId) return
    const rotation = tryNextRotation(activeBox, selectedItemId)
    if (!rotation.success || !rotation.dimensions) {
      setRotationMessage(rotation.reason ?? '无法改变这件商品的朝向')
      return
    }

    setResult({
      ...result,
      boxes: result.boxes.map((packedBox, boxIndex) =>
        boxIndex === selectedBox
          ? {
              ...packedBox,
              placements: packedBox.placements.map((placement) =>
                placement.instanceId === selectedItemId
                  ? { ...placement, dimensions: rotation.dimensions! }
                  : placement,
              ),
            }
          : packedBox,
      ),
    })
    setRotationMessage('已切换到下一个可用朝向')
  }

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-mark" aria-hidden="true">
            ◇
          </span>
          <span>装得下</span>
          <small>智能装箱助手</small>
        </a>
        <span className="local-badge">
          <i />
          数据仅保存在本机
        </span>
      </header>

      <main>
        <section className="hero-section">
          <div>
            <span className="eyebrow">3D PACKING ASSISTANT</span>
            <h1>
              每一寸空间，
              <br />
              都安排得<span>明明白白。</span>
            </h1>
            <p>
              输入商品与纸箱尺寸，自动选择合适箱型、规划摆放方式。
              <br />
              少用一个箱，发货更省心。
            </p>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="wire-box">
              <span className="cube cube-one" />
              <span className="cube cube-two" />
              <span className="cube cube-three" />
              <span className="cube cube-four" />
            </div>
            <div className="metric-card">
              <b>空间利用率</b>
              <strong>92.4%</strong>
              <span>智能旋转与填缝</span>
            </div>
          </div>
        </section>

        <section className="workspace">
          <div className="section-heading">
            <div>
              <span className="step">01</span>
              <h2>录入商品</h2>
              <p>填写每种商品的外包装尺寸与发货数量</p>
            </div>
            <button className="secondary-button" type="button" onClick={addProduct}>
              ＋ 添加商品
            </button>
          </div>

          <div className="data-card">
            <div className="table-head product-grid">
              <span>商品</span>
              <span>品类</span>
              <span>长度 (cm)</span>
              <span>宽度 (cm)</span>
              <span>高度 (cm)</span>
              <span>数量</span>
              <span>单件重量 (g)</span>
              <span>单价 (日元)</span>
              <span />
            </div>
            {products.length === 0 && (
              <div className="empty-row">还没有商品，请点击“添加商品”</div>
            )}
            {products.map((item, index) => (
              <div className="table-row product-grid" key={item.id}>
                <label className="name-cell">
                  <span className="mobile-field-label">商品名称</span>
                  <i style={{ background: item.color }} />
                  <input
                    aria-label={`商品 ${index + 1} 名称`}
                    list="product-preset-names"
                    value={item.name}
                    onChange={(event) =>
                      updateProductName(item.id, event.target.value)
                    }
                  />
                </label>
                <label className="select-field">
                  <span>品类</span>
                  <select
                    aria-label={`${item.name}品类`}
                    value={item.category}
                    onChange={(event) =>
                      updateProduct(
                        item.id,
                        'category',
                        event.target.value as Product['category'],
                      )
                    }
                  >
                    <option value="figure">手办</option>
                    <option value="plush">玩偶</option>
                    <option value="other">其他</option>
                  </select>
                </label>
                <NumberInput
                  label={`${item.name}长度`}
                  mobileLabel="长度 (cm)"
                  value={item.length}
                  onChange={(value) => updateProduct(item.id, 'length', value)}
                />
                <NumberInput
                  label={`${item.name}宽度`}
                  mobileLabel="宽度 (cm)"
                  value={item.width}
                  onChange={(value) => updateProduct(item.id, 'width', value)}
                />
                <NumberInput
                  label={`${item.name}高度`}
                  mobileLabel="高度 (cm)"
                  value={item.height}
                  onChange={(value) => updateProduct(item.id, 'height', value)}
                />
                <NumberInput
                  label={`${item.name}数量`}
                  mobileLabel="数量"
                  value={item.quantity}
                  integer
                  onChange={(value) => updateProduct(item.id, 'quantity', value)}
                />
                <NumberInput
                  label={`${item.name}单件重量`}
                  mobileLabel="单件重量 (g)"
                  value={item.weight}
                  integer
                  allowZero
                  onChange={(value) => updateProduct(item.id, 'weight', value)}
                />
                <NumberInput
                  label={`${item.name}单价`}
                  mobileLabel="单价 (日元)"
                  value={item.unitPriceYen}
                  integer
                  allowZero
                  onChange={(value) =>
                    updateProduct(item.id, 'unitPriceYen', value)
                  }
                />
                <button
                  className="delete-button"
                  type="button"
                  aria-label={`删除${item.name}`}
                  onClick={() => {
                    setProducts((items) =>
                      items.filter((product) => product.id !== item.id),
                    )
                    setResult(null)
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            <datalist id="product-preset-names">
              {PRODUCT_PRESETS.map((preset) => (
                <option value={preset.name} key={preset.name} />
              ))}
            </datalist>
          </div>
          <div className="table-summary">
            输入 lookup、晚安、趴趴海贼或忍喵可自动填写 · 共{' '}
            <b>{products.length}</b> 种商品，<b>{totalPieces}</b> 件
          </div>
        </section>

        <section className="workspace">
          <div className="section-heading">
            <div>
              <span className="step">02</span>
              <h2>录入可用箱型</h2>
              <p>请填写纸箱的内部可用尺寸，而不是外部尺寸</p>
            </div>
            <div className="heading-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setShowBoxTypes((visible) => !visible)}
              >
                {showBoxTypes ? '收起箱型' : `展开 ${boxTypes.length} 种箱型`}
              </button>
              <button className="secondary-button" type="button" onClick={addBox}>
                ＋ 添加箱型
              </button>
            </div>
          </div>

          {!showBoxTypes && (
            <button
              className="box-collapsed"
              type="button"
              onClick={() => setShowBoxTypes(true)}
            >
              <span>
                已载入 <b>{boxTypes.length}</b> 种箱型
              </span>
              <small>
                秋叶原 {boxTypes.filter((box) => box.store === 'akiba').length} 种
                · 上野 {boxTypes.filter((box) => box.store === 'ueno').length} 种
              </small>
              <i>点击展开全部规格 ↓</i>
            </button>
          )}
          {showBoxTypes && (
            <>
              <div className="data-card">
            <div className="table-head box-grid">
              <span>箱型名称</span>
              <span>所属店铺</span>
              <span>内长 (cm)</span>
              <span>内宽 (cm)</span>
              <span>内高 (cm)</span>
              <span>可用数量</span>
              <span />
            </div>
            {boxTypes.length === 0 && (
              <div className="empty-row">还没有箱型，请点击“添加箱型”</div>
            )}
            {boxTypes.map((item, index) => (
              <div className="table-row box-grid" key={item.id}>
                <label className="name-cell box-name">
                  <span className="mobile-field-label">箱型名称</span>
                  <span className="box-icon">□</span>
                  <input
                    aria-label={`箱型 ${index + 1} 名称`}
                    value={item.name}
                    onChange={(event) =>
                      updateBox(item.id, 'name', event.target.value)
                    }
                  />
                </label>
                <label className="select-field">
                  <span>所属店铺</span>
                  <select
                    aria-label={`${item.name}所属店铺`}
                    value={item.store}
                    disabled={item.cuttableHeight}
                    onChange={(event) =>
                      updateBox(
                        item.id,
                        'store',
                        event.target.value as BoxType['store'],
                      )
                    }
                  >
                    <option value="akiba">秋叶原</option>
                    <option value="ueno">上野</option>
                  </select>
                </label>
                <NumberInput
                  label={`${item.name}内长`}
                  mobileLabel="内长 (cm)"
                  value={item.length}
                  disabled={item.cuttableHeight}
                  onChange={(value) => updateBox(item.id, 'length', value)}
                />
                <NumberInput
                  label={`${item.name}内宽`}
                  mobileLabel="内宽 (cm)"
                  value={item.width}
                  disabled={item.cuttableHeight}
                  onChange={(value) => updateBox(item.id, 'width', value)}
                />
                <NumberInput
                  label={`${item.name}内高`}
                  mobileLabel="内高 (cm)"
                  value={item.height}
                  disabled={item.cuttableHeight}
                  onChange={(value) => updateBox(item.id, 'height', value)}
                />
                <NumberInput
                  label={`${item.name}可用数量`}
                  mobileLabel="可用数量"
                  value={item.quantity}
                  integer
                  onChange={(value) => updateBox(item.id, 'quantity', value)}
                />
                <button
                  className="delete-button"
                  type="button"
                  aria-label={`删除${item.name}`}
                  onClick={() => {
                    setBoxTypes((items) =>
                      items.filter((boxType) => boxType.id !== item.id),
                    )
                    setResult(null)
                  }}
                >
                  ×
                </button>
              </div>
            ))}
              </div>
              <p className="box-store-note">
                上野线路仅使用 40×50×30cm 箱，高度会按装箱结果向下裁剪；系统会结合商品、纸箱和体积重量，自动选择极速或抛重路线。
              </p>
            </>
          )}
        </section>

        <section className="workspace shipping-settings">
          <div className="section-heading">
            <div>
              <span className="step">03</span>
              <h2>运费线路与汇率</h2>
              <p>每个箱子单独计费，算法可混用不同店铺和线路</p>
            </div>
            <label className="exchange-rate">
              <span>100 日元 =</span>
              <input
                aria-label="100日元兑换人民币"
                type="number"
                min="0.01"
                step="0.01"
                value={shippingSettings.cnyPer100Yen}
                onChange={(event) => {
                  setShippingSettings({
                    cnyPer100Yen: Number(event.target.value),
                  })
                  setResult(null)
                }}
              />
              <b>元人民币</b>
            </label>
          </div>
          <div className="route-grid">
            {SHIPPING_ROUTES.map((route) => (
              <article
                className={route.enabled ? 'route-card' : 'route-card disabled'}
                key={route.id}
              >
                <div>
                  <span>{route.storeName}</span>
                  <i>{route.enabled ? '参与比价' : '暂未启用'}</i>
                </div>
                <h3>{route.routeName}</h3>
                <p>{route.description}</p>
              </article>
            ))}
          </div>
          <p className="rounding-note">
            计费规则：商品加纸箱为实重；纸板每15×15cm重15g，并计入上下8个重叠箱盖。实重和体积重分别向上进位至0.5kg。
          </p>
        </section>

        <section className="action-panel">
          <div>
            <b>{isCalculating ? '正在比较装箱组合…' : '寻找推荐发货方案'}</b>
            <span>
              {isCalculating
                ? '商品较多时需要几秒，请稍候'
                : '优先使用最少箱数；同箱数时优先上野顺丰店并自动选择更合适的路线'}
            </span>
          </div>
          <div className="action-buttons">
            <button className="text-button" type="button" onClick={loadExample}>
              载入示例
            </button>
            <button className="text-button danger" type="button" onClick={clearAll}>
              清空
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={calculate}
              disabled={isCalculating}
            >
              {isCalculating ? '计算中…' : '计算推荐方案'} <span>→</span>
            </button>
          </div>
          {error && <p className="error-message">{error}</p>}
        </section>

        {result && (
          <section className="results" ref={resultRef}>
            <div className="section-heading result-title">
              <div>
                <span className="step">04</span>
                <h2>推荐装箱方案</h2>
                <p>能用一箱就不拆箱，再比较线路价格与顺丰速度偏好</p>
              </div>
              <span className="success-badge">计算完成</span>
            </div>

            <div className="stats-grid">
              <div
                className="clickable-cost"
                role="button"
                tabIndex={0}
                aria-expanded={showCostDetails}
                onClick={() => setShowCostDetails((visible) => !visible)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setShowCostDetails((visible) => !visible)
                  }
                }}
              >
                <span>当前方案全部 {result.boxes.length} 个箱子合计</span>
                <strong>¥{result.totalCostCny.toFixed(2)}</strong>
                <small>
                  人民币 ¥{result.cnySubtotal.toFixed(2)}
                  {result.yenSubtotal > 0
                    ? ` + 日元 JP¥${result.yenSubtotal.toLocaleString()}`
                    : ''}
                </small>
                <em>{showCostDetails ? '收起计算公式 ↑' : '点击查看计算公式 ↓'}</em>
              </div>
              <div>
                <span>需要箱子</span>
                <strong>{result.boxes.length}</strong>
                <small>个</small>
              </div>
              <div>
                <span>整体利用率</span>
                <strong>{percent(result.utilization)}</strong>
                <small>已装商品体积 / 箱体积</small>
              </div>
              <div>
                <span>发货总重量</span>
                <strong>{Math.round(result.totalShippingWeight).toLocaleString()}</strong>
                <small>
                  g（商品 {result.totalWeight.toLocaleString()} + 纸箱{' '}
                  {Math.round(result.totalCardboardWeight).toLocaleString()}）
                </small>
              </div>
            </div>

            {result.uenoPreference && result.uenoPreference.premiumCny > 0 && (
              <div className="preference-note">
                <b>已优先选择上野顺丰店</b>
                <span>
                  同箱数低价方案为 ¥
                  {result.uenoPreference.cheapestCostCny.toFixed(2)}
                  ，上野顺丰贵 ¥
                  {result.uenoPreference.premiumCny.toFixed(2)}
                  ，仍优先选择上野顺丰，并已在极速与抛重路线中自动比较。
                </span>
              </div>
            )}

            <div className="route-comparison">
              <div className="comparison-heading">
                <b>四种线路价格对比</b>
                <span>假设整批商品只使用该线路</span>
              </div>
              <div className="comparison-grid">
                {routeComparisons.map((comparison) => (
                  <article
                    className={comparison.available ? '' : 'unavailable'}
                    key={comparison.routeId}
                  >
                    <span>{comparison.storeName}</span>
                    <h3>{comparison.routeName}</h3>
                    {comparison.available ? (
                      <>
                        <strong>
                          {comparison.currency === 'JPY'
                            ? `JP¥${comparison.originalTotal.toLocaleString()}`
                            : `¥${comparison.originalTotal.toFixed(2)}`}
                        </strong>
                        <small>
                          {comparison.currency === 'JPY' &&
                            `约人民币 ¥${comparison.totalCostCny.toFixed(2)} · `}
                          {comparison.boxCount} 箱
                        </small>
                      </>
                    ) : (
                      <>
                        <strong>不可用</strong>
                        <small>
                          {routeUnavailableReason(comparison.routeId)}
                        </small>
                      </>
                    )}
                  </article>
                ))}
              </div>
            </div>

            {showCostDetails && (
              <div className="total-cost-details">
                <div className="cost-detail-heading">
                  <b>总运费计算</b>
                  <span>每箱单独计费后按汇率折算并相加</span>
                </div>
                {result.boxes.map(
                  (packedBox, index) =>
                    packedBox.quote && (
                      <div className="cost-detail-row" key={packedBox.id}>
                        <span>
                          箱 {index + 1} · {packedBox.boxType.name}
                        </span>
                        <small>
                          {packedBox.quote.routeName}：{packedBox.quote.formula}
                        </small>
                        <b>
                          {formatMoney(packedBox.quote)}
                          {packedBox.quote.currency === 'JPY' &&
                            ` ≈ ¥${packedBox.quote.cnyPrice.toFixed(2)}`}
                        </b>
                      </div>
                    ),
                )}
                <div className="cost-detail-total">
                  <span>
                    所有 {result.boxes.length} 个箱子：人民币 ¥
                    {result.cnySubtotal.toFixed(2)}
                    {result.yenSubtotal > 0 &&
                      ` + JP¥${result.yenSubtotal.toLocaleString()} × ${result.shippingSettings.cnyPer100Yen} ÷ 100`}
                  </span>
                  <strong>= ¥{result.totalCostCny.toFixed(2)}</strong>
                </div>
              </div>
            )}

            {result.singleBoxAlternative &&
              result.singleBoxAlternative.differenceCny > 0 && (
                <div className="choice-explanation">
                  <b>为什么不是一箱？</b>
                  <span>
                    这些商品可以装进一个
                    {result.singleBoxAlternative.boxTypeName}，走
                    {result.singleBoxAlternative.routeName}约 ¥
                    {result.singleBoxAlternative.costCny.toFixed(2)}；当前多箱方案便宜 ¥
                    {result.singleBoxAlternative.differenceCny.toFixed(2)}
                    ，因此按“最低运费”选择了多箱。
                  </span>
                </div>
              )}

            {result.unpacked.length > 0 && (
              <div className="warning-box">
                <b>有商品未能装入</b>
                {result.unpacked.map((item) => (
                  <span key={item.productId}>
                    {item.productName} × {item.quantity}：{item.reason}
                  </span>
                ))}
              </div>
            )}

            {result.boxes.length > 0 && activeBox && (
              <div className="result-layout">
                <aside className="box-tabs">
                  <h3>箱子列表</h3>
                  {result.boxes.map((packedBox, index) => (
                    <button
                      type="button"
                      className={selectedBox === index ? 'active' : ''}
                      onClick={() => {
                        setSelectedBox(index)
                        setSelectedItemId(null)
                        setRotationMessage('')
                      }}
                      key={packedBox.id}
                    >
                      <span>箱 {index + 1}</span>
                      <b>{packedBox.boxType.name}</b>
                      <small>
                        {packedBox.quote?.routeName} ·{' '}
                        {packedBox.quote ? formatMoney(packedBox.quote) : '—'}
                      </small>
                    </button>
                  ))}
                </aside>

                <div className="box-detail">
                  <div className="detail-header">
                    <div>
                      <span>当前查看</span>
                      <h3>
                        箱 {selectedBox + 1} · {activeBox.boxType.name}
                      </h3>
                      <p>
                        内部尺寸 {formatSize(activeBox.boxType)} · 发货实重{' '}
                        {Math.round(activeBox.grossWeight).toLocaleString()} g
                        {' · '}商品价值 JP¥
                        {activeBox.totalValueYen.toLocaleString()}
                        {activeBox.boxType.cuttableHeight &&
                          ` · 上野箱高度按 ${activeBox.boxType.height}cm 裁剪`}
                      </p>
                    </div>
                    <div className="price-summary">
                      <strong>
                        {activeBox.quote ? formatMoney(activeBox.quote) : '—'}
                      </strong>
                      <span>
                        {activeBox.quote?.storeName} · {activeBox.quote?.routeName}
                      </span>
                    </div>
                  </div>

                  {activeBox.quote && (
                    <details className="shipping-breakdown">
                      <summary>
                        <span>查看本箱计费明细</span>
                        <b>
                          折合人民币 ¥{activeBox.quote.cnyPrice.toFixed(2)}
                        </b>
                      </summary>
                      <div>
                        <dl>
                          <dt>箱体积</dt>
                          <dd>
                            {(
                              activeBox.boxType.length *
                              activeBox.boxType.width *
                              activeBox.boxType.height
                            ).toLocaleString()}{' '}
                            cm³
                          </dd>
                          <dt>商品价值</dt>
                          <dd>
                            JP¥{activeBox.totalValueYen.toLocaleString()}
                            {activeBox.boxType.store === 'akiba' &&
                              ' / 必须低于40,000'}
                          </dd>
                          <dt>纸箱重量</dt>
                          <dd>
                            {Math.round(activeBox.cardboardWeight).toLocaleString()} g
                          </dd>
                          <dt>商品净重</dt>
                          <dd>{activeBox.totalWeight.toLocaleString()} g</dd>
                          <dt>原始实重</dt>
                          <dd>{formatWeight(activeBox.quote.rawActualWeight)}</dd>
                          <dt>进位实重</dt>
                          <dd>
                            {formatWeight(activeBox.quote.roundedActualWeight)}
                          </dd>
                          <dt>原始体积重</dt>
                          <dd>
                            {formatWeight(
                              activeBox.quote.rawVolumetricWeight,
                            )}
                          </dd>
                          <dt>进位体积重</dt>
                          <dd>
                            {formatWeight(
                              activeBox.quote.roundedVolumetricWeight,
                            )}
                          </dd>
                          <dt>计费重量</dt>
                          <dd>
                            {formatWeight(activeBox.quote.chargeableWeight)}
                          </dd>
                        </dl>
                        <p>
                          <span>计费公式</span>
                          <code>{activeBox.quote.formula}</code>
                        </p>
                        {activeBox.quote.currency === 'JPY' && (
                          <p>
                            <span>汇率折算</span>
                            <code>
                              JP¥{activeBox.quote.originalPrice.toLocaleString()} ×{' '}
                              {result.shippingSettings.cnyPer100Yen} ÷ 100 = ¥
                              {activeBox.quote.cnyPrice.toFixed(2)}
                            </code>
                          </p>
                        )}
                      </div>
                    </details>
                  )}

                  <div className="rotation-toolbar">
                    {selectedPlacement ? (
                      <>
                        <div>
                          <i style={{ background: selectedPlacement.color }} />
                          <span>
                            已选中 <b>{selectedPlacement.productName}</b>
                          </span>
                          <small>{formatSize(selectedPlacement.dimensions)}</small>
                        </div>
                        <button type="button" onClick={rotateSelectedItem}>
                          ↻ 切换朝向
                        </button>
                      </>
                    ) : (
                      <span>点击三维商品或下方步骤，可选择并调整单件朝向</span>
                    )}
                    {rotationMessage && (
                      <em
                        className={
                          rotationMessage.startsWith('已') ? 'success' : ''
                        }
                      >
                        {rotationMessage}
                      </em>
                    )}
                  </div>

                  <Suspense
                    fallback={<div className="scene-loading">正在加载三维示意图…</div>}
                  >
                    <PackingScene
                      packedBox={activeBox}
                      selectedItemId={selectedItemId}
                      onSelectItem={selectItem}
                    />
                  </Suspense>

                  <div className="legend">
                    {groupedPlacements.map((group) => (
                      <span key={group.name}>
                        <i style={{ background: group.color }} />
                        {group.name} × {group.count} ·{' '}
                        {group.weight.toLocaleString()} g
                      </span>
                    ))}
                  </div>

                  <div className="steps">
                    <h3>摆放步骤</h3>
                    <p>建议按顺序从箱底开始摆放</p>
                    <ol>
                      {activeBox.placements.map((placement, index) => (
                        <li key={placement.instanceId}>
                          <button
                            type="button"
                            className={
                              selectedItemId === placement.instanceId
                                ? 'step-item selected'
                                : 'step-item'
                            }
                            onClick={() => selectItem(placement.instanceId)}
                          >
                            <span>{index + 1}</span>
                            <div>
                              <b>{placement.productName}</b>
                              <small>
                                旋转后 {formatSize(placement.dimensions)} ·{' '}
                                {placement.weight.toLocaleString()} g
                              </small>
                            </div>
                            <code>
                              坐标 ({placement.position.x}, {placement.position.y},{' '}
                              {placement.position.z})
                            </code>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            )}

            {routeComparisons.length > 0 && (
              <div className="ueno-alternative">
              <div className="ueno-alt-heading">
                <div>
                  <span>固定线路参考方案</span>
                  <h3>全部使用上野可裁剪箱 · 顺丰抛重路线</h3>
                </div>
                {uenoBulkyAlternative?.available && (
                  <div>
                    <strong>
                      ¥{uenoBulkyAlternative.totalCostCny.toFixed(2)}
                    </strong>
                    <small>
                      {uenoBulkyAlternative.boxCount} 个箱子合计
                    </small>
                  </div>
                )}
              </div>

              {!uenoBulkyAlternative?.available ? (
                <p className="ueno-unavailable">
                  当前商品无法全部使用抛重路线发走。通常是某箱实重不足4kg、尺寸超过
                  40×50×30cm，或上野箱数量不足。
                </p>
              ) : (
                <>
                  <div className="ueno-alt-tabs">
                    {uenoBulkyAlternative.result.boxes.map((packedBox, index) => (
                      <button
                        type="button"
                        className={uenoAltBoxIndex === index ? 'active' : ''}
                        onClick={() => {
                          setUenoAltBoxIndex(index)
                          setShowTopUpPlan(false)
                        }}
                        key={packedBox.id}
                      >
                        箱 {index + 1}
                        <small>
                          50×40×{packedBox.boxType.height}cm ·{' '}
                          {packedBox.placements.length}件
                        </small>
                      </button>
                    ))}
                  </div>

                  {activeUenoAltBox && (
                    <div className="ueno-alt-detail">
                      <div className="ueno-alt-summary">
                        <div>
                          <b>
                            箱 {uenoAltBoxIndex + 1}：40×50×
                            {activeUenoAltBox.boxType.height}cm
                          </b>
                          <span>
                            高度从30cm裁至{activeUenoAltBox.boxType.height}cm ·{' '}
                            {summarizeBoxContents(activeUenoAltBox)}
                          </span>
                        </div>
                        <div>
                          <strong>
                            ¥{activeUenoAltBox.quote?.originalPrice.toFixed(2)}
                          </strong>
                          <small>{activeUenoAltBox.quote?.formula}</small>
                        </div>
                      </div>
                      {activeTopUpRecommendation &&
                        activeTopUpRecommendation.placements.length > 0 && (
                          <div className="topup-trigger">
                            <div>
                              <span>
                                {activeTopUpRecommendation.mode === 'free'
                                  ? '发现不增加运费的补货机会'
                                  : '发现提高空间利用率的补货方案'}
                              </span>
                              <b>
                                推荐再装{' '}
                                {activeTopUpRecommendation.placements.length} 件常用商品
                              </b>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setShowTopUpPlan((visible) => !visible)
                              }
                            >
                              {showTopUpPlan ? '收起推荐方案' : '查看推荐装箱方案'}
                            </button>
                          </div>
                        )}
                      <Suspense
                        fallback={
                          <div className="scene-loading">正在加载三维示意图…</div>
                        }
                      >
                        <PackingScene
                          packedBox={
                            showTopUpPlan && uenoAltDisplayBox
                              ? uenoAltDisplayBox
                              : activeUenoAltBox
                          }
                          selectedItemId={null}
                          onSelectItem={() => undefined}
                        />
                      </Suspense>
                      {showTopUpPlan &&
                        activeTopUpRecommendation &&
                        activeTopUpRecommendation.placements.length > 0 && (
                          <div className="topup-recommendation">
                        <div>
                          <span>
                            {activeTopUpRecommendation?.mode === 'free'
                              ? '不增加运费的补货建议'
                              : activeTopUpRecommendation?.mode === 'paid'
                                ? '空间优先的低成本补货建议'
                                : '补货建议'}
                          </span>
                          {activeTopUpRecommendation &&
                          activeTopUpRecommendation.placements.length > 0 ? (
                            <>
                              <strong>
                                可再装{' '}
                                {activeTopUpRecommendation.placements.length} 件
                              </strong>
                              <p>
                                {summarizePlacements(
                                  activeTopUpRecommendation.placements,
                                ).replaceAll('建议·', '')}
                                {' · '}新增占用{' '}
                                {Math.round(
                                  (activeTopUpRecommendation.totalVolume /
                                    (activeUenoAltBox.boxType.length *
                                      activeUenoAltBox.boxType.width *
                                      activeUenoAltBox.boxType.height)) *
                                    100,
                                )}
                                % 箱体
                              </p>
                            </>
                          ) : (
                            <strong>暂无可免费加入的常用商品</strong>
                          )}
                        </div>
                        {activeTopUpRecommendation &&
                          activeTopUpRecommendation.placements.length > 0 && (
                            <div>
                              <b>
                                + JP¥
                                {activeTopUpRecommendation.totalValueYen.toLocaleString()}
                              </b>
                              <small>
                                增加{' '}
                                {activeTopUpRecommendation.totalWeight.toLocaleString()}{' '}
                                g，
                                {activeTopUpRecommendation.mode === 'free'
                                  ? `抛重运费仍为 ¥${activeUenoAltBox.quote?.originalPrice.toFixed(2)}`
                                  : `新增运费 ¥${activeTopUpRecommendation.addedShippingCost.toFixed(2)}，补货后 ¥${activeTopUpRecommendation.finalShippingCost.toFixed(2)}`}
                              </small>
                            </div>
                          )}
                          </div>
                        )}
                      <ol className="ueno-placement-list">
                        {(showTopUpPlan && uenoAltDisplayBox
                          ? uenoAltDisplayBox.placements
                          : activeUenoAltBox.placements
                        ).map((placement, index) => (
                          <li key={placement.instanceId}>
                            <span>{index + 1}</span>
                            <b>{placement.productName}</b>
                            <small>
                              {formatSize(placement.dimensions)} · 坐标 (
                              {placement.position.x}, {placement.position.y},{' '}
                              {placement.position.z})
                            </small>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </>
              )}
              </div>
            )}
          </section>
        )}
      </main>

      <footer>
        <span>装得下 · 智能装箱助手</span>
        <span>尺寸仅供规划参考，发货前请预留缓冲材料空间</span>
      </footer>
    </div>
  )
}

export default App
