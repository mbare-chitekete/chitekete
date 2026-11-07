
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { useCurrency } from './CurrencyContext'
import { Plus, Search, RefreshCw, X } from 'lucide-react'

const methods = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'bank_card', label: 'Bank / Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' }
]

const CURRENCY_SYMBOLS = {
  USD: '$',
  ZAR: 'R',
  ZWG: 'ZiG'
}

const blank = () => ({
  purchase_date: new Date().toLocaleDateString('en-CA'),
  menu_item_id: '',
  ordered_quantity: '',
  collected_quantity: '',
  unit_price: '',
  payment_method: 'cash',
  notes: ''
})

const panel = {
  background: '#fff',
  border: '1px solid #e7edf2',
  borderRadius: 14,
  padding: 20
}

const field = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid #dce3eb',
  borderRadius: 9,
  fontSize: 14
}

const primary = {
  border: 0,
  borderRadius: 9,
  padding: '10px 14px',
  background: '#28785f',
  color: '#fff',
  fontWeight: 650,
  cursor: 'pointer'
}

const secondary = {
  ...primary,
  background: '#eef4f1',
  color: '#28785f'
}

function formatMoney(value, currencyCode = 'USD') {
  const amount = Number(value) || 0
  const symbol = CURRENCY_SYMBOLS[currencyCode] || `${currencyCode} `

  return `${symbol}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)}`
}

export default function Purchases() {
  const { currencyCode = 'USD', formatCurrency } = useCurrency()

  const [purchases, setPurchases] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blank())

  const [search, setSearch] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // Load purchases, menu items and the shared-stock mappings.
  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [
        purchaseResult,
        productResult,
        mappingResult
      ] = await Promise.all([
        supabase
          .from('purchases')
          .select(`
            id,
            purchase_date,
            menu_item_id,
            supplier_id,
            item_name,
            unit,
            quantity,
            ordered_quantity,
            excess_quantity,
            unit_price,
            total_purchase,
            currency_code,
            payment_method,
            notes,
            receipt_status,
            created_at
          `)
          .order('purchase_date', { ascending: false })
          .order('created_at', { ascending: false }),

        supabase
          .from('menu_items')
          .select('id,name,unit,active')
          .order('name'),

        supabase
          .from('menu_item_stock_mappings')
          .select('sellable_menu_item_id')
      ])

      const loadError =
        purchaseResult.error ||
        productResult.error ||
        mappingResult.error

      if (loadError) {
        throw loadError
      }

      // These are POS variants, not independently purchasable stock items.
      const mappedVariantIds = new Set(
        (mappingResult.data || []).map(
          mapping => mapping.sellable_menu_item_id
        )
      )

      const purchaseProducts = (productResult.data || []).filter(
        item => !mappedVariantIds.has(item.id)
      )

      setPurchases(purchaseResult.data || [])
      setProducts(purchaseProducts)
    } catch (err) {
      setError(err.message || 'Unable to load purchase records.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()

    const refresh = () => load()

    window.addEventListener('refresh-canteen-dashboard', refresh)

    return () => {
      window.removeEventListener('refresh-canteen-dashboard', refresh)
    }
  }, [load])

  // Only products that are not mapped POS variants can be purchased here.
  const activeProducts = useMemo(
    () => products.filter(item => item.active),
    [products]
  )

  const product = activeProducts.find(
    item => item.id === form.menu_item_id
  )

  const orderedQty = Number(form.ordered_quantity) || 0
  const collectedQty = Number(form.collected_quantity) || 0
  const unitPrice = Number(form.unit_price) || 0

  const excessQty = Math.max(collectedQty - orderedQty, 0)
  const purchaseTotal = collectedQty * unitPrice

  function openAdd() {
    setForm({
      ...blank(),
      menu_item_id: activeProducts[0]?.id || ''
    })

    setError('')
    setMessage('')
    setShowForm(true)
  }

  function closeForm() {
    if (saving) return

    setShowForm(false)
    setForm(blank())
  }

  async function save(e) {
    e.preventDefault()

    setError('')
    setMessage('')

    if (!product || !product.active) {
      setError('Select an active stock product from the product catalogue.')
      return
    }

    if (!form.purchase_date) {
      setError('Select the purchase date.')
      return
    }

    if (
      !Number.isFinite(orderedQty) ||
      orderedQty <= 0 ||
      !Number.isFinite(collectedQty) ||
      collectedQty <= 0
    ) {
      setError('Ordered and collected quantities must both be greater than zero.')
      return
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setError('Enter a valid unit purchase cost.')
      return
    }

    if (!methods.some(method => method.value === form.payment_method)) {
      setError('Select a valid payment method.')
      return
    }

    const confirmed = window.confirm(
      `Record this purchase?\n\n` +
      `Product: ${product.name}\n` +
      `Ordered: ${orderedQty} ${product.unit}\n` +
      `Collected: ${collectedQty} ${product.unit}\n` +
      `Purchase total: ${formatMoney(purchaseTotal, currencyCode)}\n\n` +
      `No supplier will be recorded.\n\n` +
      `The collected quantity will immediately be added to this stock item.`
    )

    if (!confirmed) return

    setSaving(true)

    try {
      const { error: rpcError } = await supabase.rpc(
        'create_received_purchase',
        {
          p_purchase_date: form.purchase_date,
          p_menu_item_id: product.id,
          p_supplier_id: null,
          p_ordered_quantity: orderedQty,
          p_collected_quantity: collectedQty,
          p_unit_price: unitPrice,
          p_payment_method: form.payment_method,
          p_notes: form.notes.trim() || null
        }
      )

      if (rpcError) {
        throw rpcError
      }

      setShowForm(false)
      setForm(blank())

      setMessage(
        excessQty > 0
          ? `Purchase recorded. ${collectedQty} ${product.unit} added to stock. Excess of ${excessQty} ${product.unit} flagged for review.`
          : `Purchase recorded successfully. ${collectedQty} ${product.unit} added to stock.`
      )

      await load()

      window.dispatchEvent(
        new Event('refresh-canteen-dashboard')
      )
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setSaving(false)
    }
  }

  const filtered = useMemo(() => {
    return purchases.filter(item => {
      const query = search.trim().toLowerCase()

      const searchableText = [
        item.item_name,
        item.unit,
        item.notes || ''
      ].join(' ').toLowerCase()

      return (
        (!query || searchableText.includes(query)) &&
        (paymentFilter === 'all' ||
          item.payment_method === paymentFilter) &&
        (!startDate || item.purchase_date >= startDate) &&
        (!endDate || item.purchase_date <= endDate)
      )
    })
  }, [purchases, search, paymentFilter, startDate, endDate])

  // Group totals by currency.
  const totalsByCurrency = useMemo(() => {
    return filtered.reduce((totals, item) => {
      const code = item.currency_code || 'USD'

      totals[code] =
        (totals[code] || 0) +
        Number(
          item.total_purchase ??
          Number(item.quantity) * Number(item.unit_price)
        )

      return totals
    }, {})
  }, [filtered])

  const purchaseValue = Object.entries(totalsByCurrency)
    .map(([code, amount]) => formatMoney(amount, code))
    .join(' + ') || formatMoney(0, currencyCode)

  function paymentName(value) {
    return methods.find(item => item.value === value)?.label || value
  }

  return (
    <div className="purchases-mobile" style={{
      display: 'grid',
      gap: 12,
      color: '#162b42',
      minWidth: 0,
      width: '100%'
    }}>

      <div className="welcome-row">
        <div>
          <div className="eyebrow">PRODUCT BUYING</div>
          <h1>Purchases</h1>
          <p>
            Record products collected from wholesalers or shops.
            Supplier details are not required.
            Saved purchases immediately increase product stock.
          </p>
        </div>

        <button
          type="button"
          style={primary}
          onClick={openAdd}
          disabled={loading || activeProducts.length === 0}
          title={
            activeProducts.length === 0
              ? 'Add an active stock product first'
              : 'Record a purchase'
          }
        >
          <Plus
            size={16}
            style={{ verticalAlign: 'middle', marginRight: 6 }}
          />
          Record purchase
        </button>
      </div>

      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      {message && (
        <div className="alert alert-success">{message}</div>
      )}

      {showForm && (
        <section
          style={{
            ...panel,
            width: '100%',
            maxWidth: 680,
            boxSizing: 'border-box',
            padding: 14,
            borderRadius: 12,
            marginBottom: 4
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12
            }}
          >
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 17 }}>
                Record product purchase
              </h2>
              <p style={{ margin: 0, color: '#718096', fontSize: 12 }}>
                Enter the quantities physically collected.
              </p>
            </div>

            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              aria-label="Close form"
              style={{
                ...secondary,
                padding: 7,
                minWidth: 36,
                minHeight: 36
              }}
            >
              <X size={18} />
            </button>
          </div>

          <form
            onSubmit={save}
            style={{ display: 'grid', gap: 10 }}
          >
            <label>
              Purchase date
              <input
                style={field}
                type="date"
                required
                value={form.purchase_date}
                onChange={e => setForm({
                  ...form,
                  purchase_date: e.target.value
                })}
              />
            </label>

            <label>
              Product
              <select
                style={field}
                required
                value={form.menu_item_id}
                onChange={e => setForm({
                  ...form,
                  menu_item_id: e.target.value
                })}
              >
                <option value="">Select product</option>
                {activeProducts.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.unit})
                  </option>
                ))}
              </select>
            </label>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 9
              }}
            >
              <label>
                Quantity ordered
                <input
                  style={field}
                  type="number"
                  min="0.001"
                  step="0.001"
                  required
                  value={form.ordered_quantity}
                  onChange={e => setForm({
                    ...form,
                    ordered_quantity: e.target.value
                  })}
                  placeholder="e.g. 100"
                />
              </label>

              <label>
                Quantity collected
                <input
                  style={field}
                  type="number"
                  min="0.001"
                  step="0.001"
                  required
                  value={form.collected_quantity}
                  onChange={e => setForm({
                    ...form,
                    collected_quantity: e.target.value
                  })}
                  placeholder="e.g. 105"
                />
              </label>
            </div>

            {orderedQty > 0 && collectedQty > 0 && (
              <div
                style={{
                  padding: 10,
                  borderRadius: 9,
                  background: excessQty > 0 ? '#fff7e8' : '#f0f7f3',
                  border: `1px solid ${excessQty > 0 ? '#f1d49d' : '#d4e9dc'
                    }`,
                  fontSize: 12
                }}
              >
                {excessQty > 0 ? (
                  <>
                    <strong style={{ color: '#9a5b00' }}>
                      Extra quantity: {excessQty} {product?.unit || ''}
                    </strong>
                    <p style={{ margin: '4px 0 0' }}>
                      All {collectedQty} collected units will enter stock.
                      The excess will be flagged for review.
                    </p>
                  </>
                ) : collectedQty < orderedQty ? (
                  <>
                    <strong>Short collection</strong>
                    <p style={{ margin: '4px 0 0' }}>
                      {orderedQty - collectedQty} {product?.unit || ''} fewer
                      units were collected. Only the actual quantity enters stock.
                    </p>
                  </>
                ) : (
                  <strong>Ordered and collected quantities match.</strong>
                )}
              </div>
            )}

            <label>
              Unit purchase cost ({currencyCode})
              <input
                style={field}
                type="number"
                min="0"
                step="0.01"
                required
                value={form.unit_price}
                onChange={e => setForm({
                  ...form,
                  unit_price: e.target.value
                })}
                placeholder="Enter cost per unit"
              />
            </label>

            <label>
              Payment method
              <select
                style={field}
                value={form.payment_method}
                onChange={e => setForm({
                  ...form,
                  payment_method: e.target.value
                })}
              >
                {methods.map(method => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Notes
              <textarea
                style={{ ...field, resize: 'vertical' }}
                rows="2"
                value={form.notes}
                onChange={e => setForm({
                  ...form,
                  notes: e.target.value
                })}
                placeholder="Optional purchase notes..."
              />
            </label>

            <div
              style={{
                padding: 11,
                background: '#f4f8f6',
                borderRadius: 9,
                fontSize: 12
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8
              }}>
                <span>Collected quantity</span>
                <strong>{collectedQty} {product?.unit || ''}</strong>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                marginTop: 6
              }}>
                <span>Unit cost</span>
                <strong>{formatCurrency(unitPrice)}</strong>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                marginTop: 9,
                paddingTop: 8,
                borderTop: '1px solid #dce8e0'
              }}>
                <strong>Purchase total</strong>
                <strong style={{ fontSize: 17 }}>
                  {formatCurrency(purchaseTotal)}
                </strong>
              </div>

              <small style={{
                display: 'block',
                marginTop: 5,
                color: '#718096'
              }}>
                Actual collected quantity × unit purchase cost.
              </small>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8
            }}>
              <button
                type="submit"
                style={{ ...primary, minHeight: 42 }}
                disabled={saving || !product}
              >
                {saving ? 'Recording...' : 'Save purchase'}
              </button>

              <button
                type="button"
                style={{ ...secondary, minHeight: 42 }}
                onClick={closeForm}
                disabled={saving}
              >
                Cancel
              </button>
            </div>

            <small style={{ color: '#718096', fontSize: 11 }}>
              Once recorded, the collected quantity is added to stock.
              Purchase records cannot be edited from this screen.
            </small>
          </form>
        </section>
      )}


      <div className="stats-grid">
        <div className="stat-card">
          <span>Purchase records</span>
          <strong>{filtered.length}</strong>
          <small>Current filter</small>
        </div>

        <div className="stat-card">
          <span>Purchase value</span>
          <strong style={{ fontSize: 20 }}>{purchaseValue}</strong>
          <small>Grouped by purchase currency</small>
        </div>
      </div>

      <section style={panel}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 9,
            marginBottom: 16
          }}
        >
          <div style={{ flex: '1 1 200px', position: 'relative' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: 11,
                top: 12,
                color: '#718096'
              }}
            />

            <input
              style={{ ...field, paddingLeft: 35 }}
              placeholder="Search product or notes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select
            style={{ ...field, width: 160 }}
            value={paymentFilter}
            onChange={e => setPaymentFilter(e.target.value)}
          >
            <option value="all">All payments</option>
            {methods.map(method => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>

          <input
            aria-label="From date"
            style={{ ...field, width: 150 }}
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />

          <input
            aria-label="To date"
            style={{ ...field, width: 150 }}
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />

          <button
            type="button"
            style={secondary}
            onClick={load}
            disabled={loading}
            title="Refresh purchases"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {loading ? (
          <p>Loading purchases...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              className="data-table"
              style={{
                width: '100%',
                borderCollapse: 'collapse'
              }}
            >
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Supplier</th>
                  <th>Ordered</th>
                  <th>Collected</th>
                  <th>Excess</th>
                  <th>Unit cost</th>
                  <th>Total</th>
                  <th>Payment</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map(row => {
                  const code = row.currency_code || 'USD'

                  const excess = Number(
                    row.excess_quantity ??
                    Math.max(
                      Number(row.quantity) -
                      Number(row.ordered_quantity || row.quantity),
                      0
                    )
                  )

                  return (
                    <tr key={row.id}>
                      <td>{row.purchase_date}</td>

                      <td>
                        <strong>{row.item_name}</strong>
                        <div style={{
                          fontSize: 12,
                          color: '#718096'
                        }}>
                          {row.notes || ''}
                        </div>
                      </td>

                      <td>Not recorded</td>

                      <td>
                        {row.ordered_quantity ?? row.quantity} {row.unit}
                      </td>

                      <td>
                        {row.quantity} {row.unit}
                      </td>

                      <td>
                        {excess > 0 ? (
                          <span style={{
                            color: '#a45b00',
                            fontWeight: 700
                          }}>
                            +{excess} {row.unit}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td>{formatMoney(row.unit_price, code)}</td>

                      <td>
                        <strong>
                          {formatMoney(row.total_purchase, code)}
                        </strong>
                      </td>

                      <td>{paymentName(row.payment_method)}</td>
                    </tr>
                  )
                })}

                {!filtered.length && (
                  <tr>
                    <td
                      colSpan="9"
                      style={{
                        textAlign: 'center',
                        padding: 24
                      }}
                    >
                      No purchase records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  )
}
