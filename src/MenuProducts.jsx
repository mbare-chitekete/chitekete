
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useCurrency } from './CurrencyContext'
import {
    Plus, Search, Edit2, X, Save,
    Utensils, RefreshCw
} from 'lucide-react'

export default function MenuProducts() {
    const { formatCurrency } = useCurrency()

    const [items, setItems] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [search, setSearch] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('All')
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    const emptyForm = {
        name: '',
        category_id: '',
        unit: '',
        selling_price: '',
        current_quantity: '0',
        minimum_quantity: '0'
    }

    const [form, setForm] = useState(emptyForm)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        setError('')

        const [categoryResult, itemResult] = await Promise.all([
            supabase
                .from('menu_categories')
                .select('id, name')
                .eq('active', true)
                .order('name'),

            supabase
                .from('menu_items')
                .select('id, category_id, name, unit, selling_price, active, current_quantity, minimum_quantity')
                .order('name')
        ])

        if (categoryResult.error || itemResult.error) {
            setError(
                categoryResult.error?.message ||
                itemResult.error?.message
            )
        } else {
            setCategories(categoryResult.data || [])
            setItems(itemResult.data || [])
        }

        setLoading(false)
    }

    function openAddForm() {
        setEditingId(null)
        setForm({
            ...emptyForm,
            category_id: categories[0]?.id || ''
        })
        setMessage('')
        setError('')
        setShowForm(true)
    }

    function openEditForm(item) {
        setEditingId(item.id)
        setForm({
            name: item.name,
            category_id: item.category_id,
            unit: item.unit,
            selling_price: String(item.selling_price),
            current_quantity: String(item.current_quantity ?? 0),
            minimum_quantity: String(item.minimum_quantity ?? 0)
        })
        setMessage('')
        setError('')
        setShowForm(true)
    }

    async function handleSave(e) {
        e.preventDefault()
        setSaving(true)
        setError('')
        setMessage('')

        const price = Number(form.selling_price)

        if (!form.name.trim() || !form.category_id || !form.unit.trim()) {
            setError('Please complete all fields.')
            setSaving(false)
            return
        }

        if (!Number.isFinite(price) || price < 0) {
            setError('Enter a valid selling price.')
            setSaving(false)
            return
        }

        const productData = {
            name: form.name.trim(),
            category_id: form.category_id,
            unit: form.unit.trim(),
            selling_price: price,
            minimum_quantity: Math.max(0, Number(form.minimum_quantity) || 0)
        }

        const result = editingId
            ? await supabase
                .from('menu_items')
                .update(productData)
                .eq('id', editingId)
            : await supabase
                .from('menu_items')
                .insert(productData)

        if (result.error) {
            setError(result.error.message)
        } else {
            setShowForm(false)
            setForm(emptyForm)
            await loadData()
            setMessage(
                editingId
                    ? 'Product updated successfully.'
                    : 'Product added successfully.'
            )
        }

        setSaving(false)
    }

    async function toggleActive(item) {
        setError('')
        setMessage('')

        const { error } = await supabase
            .from('menu_items')
            .update({ active: !item.active })
            .eq('id', item.id)

        if (error) {
            setError(error.message)
        } else {
            setItems(current =>
                current.map(product =>
                    product.id === item.id
                        ? { ...product, active: !item.active }
                        : product
                )
            )

            setMessage(
                item.active
                    ? 'Product deactivated.'
                    : 'Product activated.'
            )
        }
    }

    const filteredItems = items.filter(item => {
        const category = categories.find(
            cat => cat.id === item.category_id
        )

        const query = search.trim().toLowerCase()

        const matchesSearch =
            item.name.toLowerCase().includes(query) ||
            item.unit.toLowerCase().includes(query) ||
            (category?.name || '').toLowerCase().includes(query)

        const matchesCategory =
            selectedCategory === 'All' ||
            category?.name === selectedCategory

        return matchesSearch && matchesCategory
    })

    const activeCount = items.filter(item => item.active).length

    const styles = {
        card: {
            background: '#fff',
            border: '1px solid #e7edf2',
            borderRadius: 14,
            padding: 20
        },
        input: {
            width: '100%',
            boxSizing: 'border-box',
            padding: '11px 13px',
            border: '1px solid #dce3eb',
            borderRadius: 9,
            fontSize: 14,
            background: '#fff'
        },
        button: {
            border: 0,
            borderRadius: 9,
            padding: '11px 16px',
            background: '#28785f',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer'
        }
    }

    return (
        <div style={{ display: 'grid', gap: 22, color: '#162b42' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 15,
                flexWrap: 'wrap'
            }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 24 }}>
                        Menu & Products
                    </h2>
                    <p style={{ color: '#718096', margin: '7px 0 0' }}>
                        Manage your canteen menu, products and selling prices.
                    </p>
                </div>

                <button onClick={openAddForm} style={styles.button}>
                    <Plus size={16} style={{ verticalAlign: 'middle' }} />
                    {' '}Add Product
                </button>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 14
            }}>
                {[
                    ['Total Products', items.length],
                    ['Active Products', activeCount],
                    ['Categories', categories.length]
                ].map(([label, value]) => (
                    <div key={label} style={styles.card}>
                        <p style={{ color: '#718096', margin: 0, fontSize: 13 }}>
                            {label}
                        </p>
                        <h2 style={{ margin: '9px 0 0', fontSize: 27 }}>
                            {value}
                        </h2>
                    </div>
                ))}
            </div>

            {message && (
                <p style={{
                    color: '#28785f',
                    background: '#eaf6f0',
                    padding: 12,
                    borderRadius: 8
                }}>
                    {message}
                </p>
            )}

            {error && (
                <p style={{
                    color: '#b42318',
                    background: '#fff1f0',
                    padding: 12,
                    borderRadius: 8
                }}>
                    {error}
                </p>
            )}

            <div style={styles.card}>
                <div style={{
                    display: 'flex',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: 20
                }}>
                    <div style={{
                        flex: 1,
                        minWidth: 200,
                        position: 'relative'
                    }}>
                        <Search size={17} style={{
                            position: 'absolute',
                            left: 12,
                            top: 12,
                            color: '#8492a6'
                        }} />

                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by product, category or unit..."
                            style={{ ...styles.input, paddingLeft: 38 }}
                        />

                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                title="Clear search"
                                style={{
                                    position: 'absolute',
                                    right: 10,
                                    top: 8,
                                    border: 0,
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    color: '#718096'
                                }}
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>

                    <select
                        value={selectedCategory}
                        onChange={e => setSelectedCategory(e.target.value)}
                        style={{
                            ...styles.input,
                            width: 'auto',
                            minWidth: 170
                        }}
                    >
                        <option value="All">All Categories</option>
                        {categories.map(category => (
                            <option key={category.id} value={category.name}>
                                {category.name}
                            </option>
                        ))}
                    </select>

                    <button
                        onClick={loadData}
                        disabled={loading}
                        style={{
                            ...styles.button,
                            background: '#edf3f1',
                            color: '#28785f'
                        }}
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>

                <p style={{
                    color: '#718096',
                    fontSize: 13,
                    marginBottom: 12
                }}>
                    Showing {filteredItems.length} of {items.length} products
                </p>

                {loading ? (
                    <p>Loading menu products...</p>
                ) : filteredItems.length === 0 ? (
                    <p style={{
                        color: '#718096',
                        textAlign: 'center',
                        padding: 30
                    }}>
                        No products found.
                    </p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: 14,
                            minWidth: 650
                        }}>
                            <thead>
                                <tr style={{
                                    background: '#f6f8fa',
                                    textAlign: 'left'
                                }}>
                                    {[
                                        'Product',
                                        'Category',
                                        'Unit',
                                        'Selling Price',
                                        'Available Stock',
                                        'Reorder Level',
                                        'Status',
                                        'Actions'
                                    ].map(label => (
                                        <th
                                            key={label}
                                            style={{
                                                padding: 13,
                                                color: '#718096'
                                            }}
                                        >
                                            {label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            <tbody>
                                {filteredItems.map(item => {
                                    const category = categories.find(
                                        cat => cat.id === item.category_id
                                    )

                                    return (
                                        <tr
                                            key={item.id}
                                            style={{
                                                borderTop: '1px solid #edf0f3'
                                            }}
                                        >
                                            <td style={{
                                                padding: 13,
                                                fontWeight: 600
                                            }}>
                                                {item.name}
                                            </td>

                                            <td style={{ padding: 13 }}>
                                                {category?.name || 'Uncategorized'}
                                            </td>

                                            <td style={{ padding: 13 }}>
                                                {item.unit}
                                            </td>

                                            <td style={{
                                                padding: 13,
                                                fontWeight: 600
                                            }}>
                                                {formatCurrency(item.selling_price)}
                                            </td>

                                            <td style={{ padding: 13 }}>{Number(item.current_quantity || 0)} {item.unit}</td>
                                            <td style={{ padding: 13 }}>{Number(item.minimum_quantity || 0)} {item.unit}</td>

                                            <td style={{ padding: 13 }}>
                                                <span style={{
                                                    color: item.active
                                                        ? '#28785f'
                                                        : '#b42318',
                                                    background: item.active
                                                        ? '#eaf6f0'
                                                        : '#fff1f0',
                                                    padding: '5px 9px',
                                                    borderRadius: 20,
                                                    fontSize: 12
                                                }}>
                                                    {item.active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>

                                            <td style={{ padding: 13 }}>
                                                <button
                                                    onClick={() => openEditForm(item)}
                                                    title="Edit product"
                                                    style={{
                                                        border: 0,
                                                        background: '#edf3f1',
                                                        color: '#28785f',
                                                        padding: 8,
                                                        borderRadius: 7,
                                                        cursor: 'pointer',
                                                        marginRight: 7
                                                    }}
                                                >
                                                    <Edit2 size={16} />
                                                </button>

                                                <button
                                                    onClick={() => toggleActive(item)}
                                                    style={{
                                                        border: 0,
                                                        background: '#f3f4f6',
                                                        padding: 8,
                                                        borderRadius: 7,
                                                        cursor: 'pointer',
                                                        fontSize: 12
                                                    }}
                                                >
                                                    {item.active
                                                        ? 'Deactivate'
                                                        : 'Activate'}
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showForm && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: '#162b4280',
                    display: 'grid',
                    placeItems: 'center',
                    padding: 16,
                    zIndex: 1000
                }}>
                    <form
                        onSubmit={handleSave}
                        style={{
                            background: '#fff',
                            borderRadius: 16,
                            padding: 25,
                            width: '100%',
                            maxWidth: 440,
                            boxSizing: 'border-box',
                            display: 'grid',
                            gap: 15
                        }}
                    >
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h3 style={{ margin: 0 }}>
                                {editingId ? 'Edit Product' : 'Add New Product'}
                            </h3>

                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                style={{
                                    border: 0,
                                    background: 'transparent',
                                    cursor: 'pointer'
                                }}
                            >
                                <X />
                            </button>
                        </div>

                        <label>
                            Product name
                            <input
                                required
                                value={form.name}
                                onChange={e => setForm({
                                    ...form,
                                    name: e.target.value
                                })}
                                placeholder="Enter product name"
                                style={{ ...styles.input, marginTop: 7 }}
                            />
                        </label>

                        <label>
                            Category
                            <select
                                required
                                value={form.category_id}
                                onChange={e => setForm({
                                    ...form,
                                    category_id: e.target.value
                                })}
                                style={{ ...styles.input, marginTop: 7 }}
                            >
                                <option value="">Select category</option>
                                {categories.map(category => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            Unit
                            <input
                                required
                                value={form.unit}
                                onChange={e => setForm({
                                    ...form,
                                    unit: e.target.value
                                })}
                                placeholder="e.g. Plate, Portion, Bottle"
                                style={{ ...styles.input, marginTop: 7 }}
                            />
                        </label>

                        <label>
                            Selling price
                            <input
                                required
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.selling_price}
                                onChange={e => setForm({
                                    ...form,
                                    selling_price: e.target.value
                                })}
                                placeholder="Enter selling price"
                                style={{ ...styles.input, marginTop: 7 }}
                            />
                        </label>

                        <label>
                            Minimum stock / reorder level
                            <input
                                type="number"
                                min="0"
                                step="0.001"
                                value={form.minimum_quantity}
                                onChange={e => setForm({ ...form, minimum_quantity: e.target.value })}
                                style={{ ...styles.input, marginTop: 7 }}
                            />
                        </label>

                        {error && (
                            <p style={{ color: '#b42318', margin: 0 }}>
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={saving}
                            style={styles.button}
                        >
                            <Save size={16} style={{ verticalAlign: 'middle' }} />
                            {' '}
                            {saving ? 'Saving...' : 'Save Product'}
                        </button>
                    </form>
                </div>
            )}
        </div>
    )
}