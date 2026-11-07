
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { useCurrency } from './CurrencyContext'
import {
  RefreshCw,
  Search,
  AlertTriangle,
  CheckCircle2,
  Plus,
  X,
  History
} from 'lucide-react'

const panel = {
  background: '#fff',
  border: '1px solid #e7edf2',
  borderRadius: 12,
  padding: 14,
  minWidth: 0,
  boxSizing: 'border-box'
}

const input = {
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  padding: '10px 11px',
  border: '1px solid #dce3eb',
  borderRadius: 8,
  fontSize: 16,
  background: '#fff'
}

const button = {
  border: 0,
  borderRadius: 8,
  padding: '10px 12px',
  minHeight: 40,
  background: '#28785f',
  color: '#fff',
  fontWeight: 650,
  fontSize: 13,
  cursor: 'pointer'
}

const secondaryButton = {
  ...button,
  background: '#eef4f1',
  color: '#28785f'
}

const today = () => {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 10)
}

const emptyForm = () => ({
  menu_item_id: '',
  adjustment_type: 'increase',
  quantity: '',
  reason: '',
  notes: '',
  adjustment_date: today()
})

export default function Inventory() {
  const { formatCurrency } = useCurrency()

  const [items, setItems] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const { data: mappings, error: mappingError } = await supabase
        .from('menu_item_stock_mappings')
        .select('sellable_menu_item_id')

      if (mappingError) throw mappingError

      const sellableVariantIds = new Set(
        (mappings || []).map(row => row.sellable_menu_item_id)
      )

      const { data, error: itemsError } = await supabase
        .from('menu_items')
        .select(`
          id,
          name,
          unit,
          selling_price,
          current_quantity,
          minimum_quantity,
          active,
          category_id,
          menu_categories(name)
        `)
        .order('name')

      if (itemsError) throw itemsError

      const inventoryItems = (data || []).filter(
        item => !sellableVariantIds.has(item.id)
      )

      setItems(inventoryItems)
    } catch (err) {
      setError(`Could not load inventory: ${err.message}`)
      setItems([])
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

  async function loadHistory() {
    setError('')

    const { data, error: historyError } = await supabase
      .from('product_stock_adjustments')
      .select(`
        id,
        adjustment_date,
        adjustment_type,
        quantity,
        reason,
        notes,
        item_name,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (historyError) {
      setError(historyError.message)
    } else {
      setHistory(data || [])
    }
  }

  function openAdjustment(item = null) {
    setForm({
      ...emptyForm(),
      menu_item_id: item?.id || ''
    })

    setError('')
    setMessage('')
    setShowForm(true)

    // Bring the form into view when opened on a phone.
    setTimeout(() => {
      document.getElementById('inventory-adjustment-form')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  function closeAdjustment() {
    if (saving) return

    setShowForm(false)
    setForm(emptyForm())
    setError('')
  }

  async function saveAdjustment(e) {
    e.preventDefault()
    setError('')
    setMessage('')

    const quantity = Number(form.quantity)

    if (
      !form.menu_item_id ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !form.reason.trim() ||
      !form.adjustment_date
    ) {
      setError(
        'Choose a product, enter a quantity greater than zero, select a date and provide a reason.'
      )
      return
    }

    setSaving(true)

    try {
      const { error: adjustmentError } = await supabase.rpc(
        'adjust_menu_item_stock',
        {
          p_menu_item_id: form.menu_item_id,
          p_adjustment_type: form.adjustment_type,
          p_quantity: quantity,
          p_reason: form.reason.trim(),
          p_notes: form.notes.trim() || null,
          p_adjustment_date: form.adjustment_date
        }
      )

      if (adjustmentError) throw adjustmentError

      setShowForm(false)
      setForm(emptyForm())
      setMessage('Stock adjustment saved successfully.')

      await load()

      window.dispatchEvent(
        new Event('refresh-canteen-dashboard')
      )
    } catch (err) {
      setError(err.message || 'Could not save stock adjustment.')
    } finally {
      setSaving(false)
    }
  }

  const filtered = useMemo(() => {
    return items.filter(item => {
      const q = search.trim().toLowerCase()

      const low =
        Number(item.current_quantity || 0) <=
        Number(item.minimum_quantity || 0)

      const matchesSearch =
        !q ||
        `${item.name} ${item.unit} ${item.menu_categories?.name || ''}`
          .toLowerCase()
          .includes(q)

      const matchesFilter =
        filter === 'all' ||
        (filter === 'low' && low) ||
        (filter === 'healthy' && !low)

      return matchesSearch && matchesFilter
    })
  }, [items, search, filter])

  const lowCount = items.filter(item =>
    item.active &&
    Number(item.current_quantity || 0) <=
    Number(item.minimum_quantity || 0)
  ).length

  const activeCount = items.filter(item => item.active).length

  return (
    <div className="inventory-mobile-page">

      <style>{`
        .inventory-mobile-page {
          display: grid;
          gap: 12px;
          width: 100%;
          min-width: 0;
          color: #162b42;
          box-sizing: border-box;
        }

        .inventory-mobile-page * {
          box-sizing: border-box;
        }

        .inventory-mobile-page button {
          touch-action: manipulation;
        }

        .inventory-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .inventory-heading h1 {
          font-size: 23px;
          margin: 3px 0;
        }

        .inventory-heading p {
          margin: 4px 0 0;
          color: #718096;
          font-size: 13px;
          line-height: 1.4;
        }

        .inventory-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 9px;
        }

        .inventory-stat {
          background: #fff;
          border: 1px solid #e7edf2;
          border-radius: 10px;
          padding: 11px;
          min-width: 0;
        }

        .inventory-stat span {
          display: block;
          color: #718096;
          font-size: 11px;
        }

        .inventory-stat strong {
          display: block;
          font-size: 21px;
          margin-top: 5px;
          overflow-wrap: anywhere;
        }

        .inventory-stat small {
          display: block;
          color: #718096;
          font-size: 10px;
          margin-top: 3px;
        }

        .inventory-form {
          scroll-margin-top: 12px;
          width: 100%;
          max-width: 620px;
          justify-self: start;
        }

        .inventory-form-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .inventory-form-heading h2 {
          margin: 0;
          font-size: 17px;
        }

        .inventory-form form {
          display: grid;
          gap: 10px;
        }

        .inventory-form label {
          display: grid;
          gap: 5px;
          font-size: 12px;
          font-weight: 600;
          color: #34465a;
          min-width: 0;
        }

        .inventory-form textarea {
          resize: vertical;
        }

        .inventory-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 9px;
        }

        .inventory-toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto auto auto;
          gap: 8px;
          align-items: center;
          margin-bottom: 12px;
        }

        .inventory-search {
          position: relative;
          min-width: 0;
        }

        .inventory-search svg {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #718096;
          pointer-events: none;
        }

        .inventory-search input {
          padding-left: 34px !important;
        }

        .inventory-table-wrap {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .inventory-table {
          width: 100%;
          min-width: 720px;
          border-collapse: collapse;
        }

        .inventory-mobile-list {
          display: none;
        }

        .inventory-product-card {
          border: 1px solid #e7edf2;
          border-radius: 10px;
          padding: 11px;
          margin-bottom: 9px;
          background: #fff;
          min-width: 0;
        }

        .inventory-product-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
        }

        .inventory-product-name {
          font-size: 14px;
          font-weight: 700;
          overflow-wrap: anywhere;
        }

        .inventory-product-category {
          color: #718096;
          font-size: 11px;
          margin-top: 3px;
        }

        .inventory-product-data {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 10px;
          padding: 9px 0;
          border-top: 1px solid #edf0f2;
          border-bottom: 1px solid #edf0f2;
        }

        .inventory-product-data span {
          display: block;
          font-size: 10px;
          color: #718096;
        }

        .inventory-product-data strong {
          display: block;
          font-size: 13px;
          margin-top: 3px;
          overflow-wrap: anywhere;
        }

        .inventory-product-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-top: 9px;
        }

        .inventory-history-row {
          padding: 10px 0;
          border-bottom: 1px solid #edf0f2;
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        @media (max-width: 640px) {
          .inventory-heading {
            align-items: stretch;
          }

          .inventory-heading > div {
            width: 100%;
          }

          .inventory-heading h1 {
            font-size: 20px;
          }

          .inventory-heading > button {
            width: 100%;
          }

          .inventory-stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
          }

          .inventory-stat {
            padding: 9px 7px;
          }

          .inventory-stat span {
            font-size: 10px;
            line-height: 1.3;
          }

          .inventory-stat strong {
            font-size: 17px;
          }

          .inventory-stat small {
            display: none;
          }

          .inventory-form-grid {
            grid-template-columns: 1fr 1fr;
          }

          .inventory-toolbar {
            grid-template-columns: minmax(0, 1fr) auto auto;
          }

          .inventory-toolbar .inventory-filter {
            grid-column: 1 / -1;
            grid-row: 2;
            width: 100%;
          }

          .inventory-table-wrap {
            display: none;
          }

          .inventory-mobile-list {
            display: block;
          }

          .inventory-form {
            max-width: none;
          }
        }

        @media (max-width: 360px) {
          .inventory-stats {
            gap: 4px;
          }

          .inventory-stat {
            padding: 8px 5px;
          }

          .inventory-stat strong {
            font-size: 15px;
          }

          .inventory-form-grid {
            grid-template-columns: 1fr;
          }

          .inventory-toolbar {
            gap: 6px;
          }
        }
      `}</style>

      {/* PAGE HEADING */}
      <div className="inventory-heading">
        <div>
          <div className="eyebrow">STOCK CONTROL</div>
          <h1>Product Inventory</h1>
          <p>
            Track canonical stock items and standalone products.
            POS variants sharing stock are not listed separately.
          </p>
        </div>

        <button
          type="button"
          style={button}
          onClick={() => openAdjustment()}
        >
          <Plus size={15} style={{ verticalAlign: 'middle', marginRight: 5 }} />
          Stock adjustment
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {/* SUMMARY */}
      <div className="inventory-stats">
        <div className="inventory-stat">
          <span>Stock items</span>
          <strong>{items.length}</strong>
          <small>All tracked products</small>
        </div>

        <div className="inventory-stat">
          <span>Low stock</span>
          <strong style={{ color: lowCount ? '#b45309' : '#28785f' }}>
            {lowCount}
          </strong>
          <small>At or below reorder level</small>
        </div>

        <div className="inventory-stat">
          <span>Active items</span>
          <strong>{activeCount}</strong>
          <small>Active inventory records</small>
        </div>
      </div>

      {/* ADJUSTMENT FORM - NOW ABOVE ALL PRODUCTS */}
      {showForm && (
        <section
          id="inventory-adjustment-form"
          className="inventory-form"
          style={panel}
        >
          <div className="inventory-form-heading">
            <div>
              <h2>Adjust product stock</h2>
              <small style={{ color: '#718096', fontSize: 11 }}>
                Record a stock increase or decrease.
              </small>
            </div>

            <button
              type="button"
              onClick={closeAdjustment}
              disabled={saving}
              aria-label="Close adjustment form"
              style={{
                ...secondaryButton,
                padding: 7,
                minWidth: 36,
                minHeight: 36
              }}
            >
              <X size={17} />
            </button>
          </div>

          <form onSubmit={saveAdjustment}>
            <label>
              Product
              <select
                style={input}
                value={form.menu_item_id}
                onChange={e => setForm({
                  ...form,
                  menu_item_id: e.target.value
                })}
                required
              >
                <option value="">Select product</option>
                {items.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.unit})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Adjustment type
              <select
                style={input}
                value={form.adjustment_type}
                onChange={e => setForm({
                  ...form,
                  adjustment_type: e.target.value
                })}
              >
                <option value="increase">Increase stock</option>
                <option value="decrease">Decrease stock</option>
              </select>
            </label>

            <div className="inventory-form-grid">
              <label>
                Quantity
                <input
                  style={input}
                  type="number"
                  min="0.001"
                  step="0.001"
                  placeholder="Enter quantity"
                  value={form.quantity}
                  onChange={e => setForm({
                    ...form,
                    quantity: e.target.value
                  })}
                  required
                />
              </label>

              <label>
                Date
                <input
                  style={input}
                  type="date"
                  value={form.adjustment_date}
                  onChange={e => setForm({
                    ...form,
                    adjustment_date: e.target.value
                  })}
                  required
                />
              </label>
            </div>

            <label>
              Reason
              <input
                style={input}
                value={form.reason}
                onChange={e => setForm({
                  ...form,
                  reason: e.target.value
                })}
                placeholder="e.g. damaged, expired, stock correction"
                required
              />
            </label>

            <label>
              Notes
              <textarea
                style={input}
                rows="2"
                value={form.notes}
                onChange={e => setForm({
                  ...form,
                  notes: e.target.value
                })}
                placeholder="Optional notes..."
              />
            </label>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8
            }}>
              <button
                type="submit"
                style={{ ...button, minHeight: 43 }}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save adjustment'}
              </button>

              <button
                type="button"
                style={{ ...secondaryButton, minHeight: 43 }}
                onClick={closeAdjustment}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* INVENTORY PRODUCTS */}
      <section style={panel}>
        <div className="inventory-toolbar">
          <div className="inventory-search">
            <Search size={16} />
            <input
              style={input}
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select
            className="inventory-filter"
            style={{ ...input, width: 'auto', minWidth: 0 }}
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="all">All stock</option>
            <option value="low">Low stock</option>
            <option value="healthy">Healthy stock</option>
          </select>

          <button
            type="button"
            style={secondaryButton}
            onClick={load}
            disabled={loading}
            title="Refresh inventory"
          >
            <RefreshCw size={15} />
          </button>

          <button
            type="button"
            style={secondaryButton}
            onClick={async () => {
              await loadHistory()
              setHistoryOpen(true)
            }}
          >
            <History size={15} />
            <span style={{ marginLeft: 4 }}>History</span>
          </button>
        </div>
        {loading ? (
          <p>Loading product stock...</p>
        ) : (
          <>
            {/* Desktop and tablet table */}
            <div className="inventory-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Available stock</th>
                    <th>Reorder level</th>
                    <th>Stock status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map(item => {
                    const qty = Number(item.current_quantity || 0)
                    const low = qty <= Number(item.minimum_quantity || 0)

                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.name}</strong>
                          <div style={{ fontSize: 11, color: '#718096' }}>
                            {item.unit} · {formatCurrency(Number(item.selling_price || 0))}
                          </div>
                        </td>
                        <td>{item.menu_categories?.name || 'Uncategorised'}</td>
                        <td>{qty.toLocaleString()} {item.unit}</td>
                        <td>
                          {Number(item.minimum_quantity || 0).toLocaleString()} {item.unit}
                        </td>
                        <td>{low ? '⚠ Low stock' : '✓ In stock'}</td>
                        <td>
                          <button
                            style={{ ...button, padding: '6px 9px' }}
                            onClick={() => openAdjustment(item)}
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Compact Android product cards */}
            <div className="inventory-mobile-grid">
              {filtered.map(item => {
                const qty = Number(item.current_quantity || 0)
                const low = qty <= Number(item.minimum_quantity || 0)

                return (
                  <article className="inventory-product-card" key={item.id}>
                    <div className="inventory-card-heading">
                      <strong>{item.name}</strong>
                      <span className={low ? 'inventory-low' : 'inventory-healthy'}>
                        {low ? '⚠ Low' : '✓ OK'}
                      </span>
                    </div>

                    <div className="inventory-card-category">
                      {item.menu_categories?.name || 'Uncategorised'} · {item.unit}
                    </div>

                    <div className="inventory-card-stock">
                      <div>
                        <span>Available</span>
                        <strong>{qty.toLocaleString()}</strong>
                      </div>

                      <div>
                        <span>Reorder level</span>
                        <strong>
                          {Number(item.minimum_quantity || 0).toLocaleString()}
                        </strong>
                      </div>
                    </div>

                    <div className="inventory-card-footer">
                      <span>
                        Price: {formatCurrency(Number(item.selling_price || 0))}
                      </span>

                      <button
                        type="button"
                        onClick={() => openAdjustment(item)}
                      >
                        Adjust
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>

            {!filtered.length && (
              <p className="inventory-empty">
                No products match this filter.
              </p>
            )}
          </>
        )}
      </section>

      {/* STOCK ADJUSTMENT HISTORY */}
      {historyOpen && (
        <section style={panel}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10
          }}>
            <h2 style={{ margin: 0, fontSize: 17 }}>
              Stock adjustment history
            </h2>

            <button
              type="button"
              style={secondaryButton}
              onClick={() => setHistoryOpen(false)}
              aria-label="Close history"
            >
              <X size={16} />
            </button>
          </div>

          {history.map(row => (
            <div className="inventory-history-row" key={row.id}>
              <strong>{row.item_name || 'Product'}</strong>
              <div>
                {row.adjustment_type} {row.quantity}
              </div>
              <div style={{ color: '#718096', marginTop: 3 }}>
                {row.adjustment_date} · {row.reason}
              </div>
              {row.notes && (
                <div style={{ color: '#718096', marginTop: 3 }}>
                  {row.notes}
                </div>
              )}
            </div>
          ))}

          {!history.length && (
            <p style={{ color: '#718096', fontSize: 13 }}>
              No adjustments recorded.
            </p>
          )}
        </section>
      )}
    </div>
  )
}
