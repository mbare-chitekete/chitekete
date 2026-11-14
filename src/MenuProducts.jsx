
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useCurrency } from './CurrencyContext'
import {
    Plus, Search, Edit2, X, Save,
    RefreshCw, ImagePlus, Trash2, Upload
} from 'lucide-react'

const STORAGE_BUCKET = 'chitekete'
const MAX_IMAGE_SIZE = 450 * 1024

async function compressProductImage(file) {
    if (!file || !file.type.startsWith('image/')) {
        throw new Error('Please select a valid image.')
    }

    if (!window.createImageBitmap) {
        if (file.size > MAX_IMAGE_SIZE) {
            throw new Error(
                'This browser cannot compress the image. Please select an image smaller than 450 KB.'
            )
        }
        return file
    }

    const bitmap = await createImageBitmap(file)

    try {
        const canvas = document.createElement('canvas')

        let width = bitmap.width
        let height = bitmap.height

        const maxDimension = 1600

        if (width > maxDimension || height > maxDimension) {
            const scale = maxDimension / Math.max(width, height)
            width = Math.round(width * scale)
            height = Math.round(height * scale)
        }

        const context = canvas.getContext('2d')

        if (!context) {
            throw new Error('Could not process this image.')
        }

        let blob = null
        let quality = 0.85

        while (true) {
            canvas.width = width
            canvas.height = height

            context.clearRect(0, 0, width, height)
            context.drawImage(bitmap, 0, 0, width, height)

            blob = await new Promise(resolve =>
                canvas.toBlob(resolve, 'image/webp', quality)
            )

            if (!blob) {
                throw new Error('Could not compress this image.')
            }

            if (blob.size <= MAX_IMAGE_SIZE) {
                break
            }

            if (quality > 0.4) {
                quality = Math.max(0.4, quality - 0.1)
                continue
            }

            if (width <= 500) {
                break
            }

            width = Math.max(500, Math.round(width * 0.8))
            height = Math.max(1, Math.round(height * 0.8))
        }

        if (!blob || blob.size > MAX_IMAGE_SIZE) {
            throw new Error(
                'Image is too large after compression. Please choose another image.'
            )
        }

        return new File(
            [blob],
            `${Date.now()}.webp`,
            { type: 'image/webp' }
        )
    } finally {
        bitmap.close()
    }
}


export default function MenuProducts() {
    const { formatCurrency } = useCurrency()

    const [items, setItems] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [search, setSearch] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('All')
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [imageFile, setImageFile] = useState(null)
    const [imagePreview, setImagePreview] = useState('')
    const [removeImage, setRemoveImage] = useState(false)

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

    // Release temporary browser preview URLs.
    useEffect(() => {
        return () => {
            if (imagePreview?.startsWith('blob:')) {
                URL.revokeObjectURL(imagePreview)
            }
        }
    }, [imagePreview])

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
                .select(`
                    id,
                    category_id,
                    name,
                    unit,
                    selling_price,
                    active,
                    current_quantity,
                    minimum_quantity,
                    image_url
                `)
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

    function clearImageSelection() {
        if (imagePreview?.startsWith('blob:')) {
            URL.revokeObjectURL(imagePreview)
        }

        setImageFile(null)
        setImagePreview('')
        setRemoveImage(true)
    }

    function openAddForm() {
        setEditingId(null)
        setForm({
            ...emptyForm,
            category_id: categories[0]?.id || ''
        })
        setImageFile(null)
        setImagePreview('')
        setRemoveImage(false)
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
        setImageFile(null)
        setImagePreview(item.image_url || '')
        setRemoveImage(false)
        setMessage('')
        setError('')
        setShowForm(true)
    }

    function handleImageSelection(e) {
        const file = e.target.files?.[0]
        e.target.value = ''

        if (!file) return

        if (!file.type.startsWith('image/')) {
            setError('Please select a valid image file.')
            return
        }

        if (imagePreview?.startsWith('blob:')) {
            URL.revokeObjectURL(imagePreview)
        }

        setImageFile(file)
        setImagePreview(URL.createObjectURL(file))
        setRemoveImage(false)
        setError('')
    }

    async function uploadProductImage(productId) {
        setUploading(true)

        try {
            const compressedFile = await compressProductImage(imageFile)

            const imagePath =
                `products/${productId}/${crypto.randomUUID()}.webp`

            const { error: uploadError } = await supabase.storage
                .from(STORAGE_BUCKET)
                .upload(imagePath, compressedFile, {
                    contentType: compressedFile.type,
                    cacheControl: '3600',
                    upsert: false
                })

            if (uploadError) throw uploadError

            const { data } = supabase.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl(imagePath)

            if (!data?.publicUrl) {
                throw new Error('Could not generate the public image URL.')
            }

            return data.publicUrl
        } finally {
            setUploading(false)
        }
    }

    async function handleSave(e) {
        e.preventDefault()
        setSaving(true)
        setError('')
        setMessage('')

        try {
            const price = Number(form.selling_price)
            const minimumQuantity = Number(form.minimum_quantity)

            if (
                !form.name.trim() ||
                !form.category_id ||
                !form.unit.trim()
            ) {
                throw new Error('Please complete all required fields.')
            }

            if (!Number.isFinite(price) || price < 0) {
                throw new Error('Enter a valid selling price.')
            }

            if (!Number.isFinite(minimumQuantity) || minimumQuantity < 0) {
                throw new Error('Enter a valid minimum stock quantity.')
            }

            const productData = {
                name: form.name.trim(),
                category_id: form.category_id,
                unit: form.unit.trim(),
                selling_price: price,
                minimum_quantity: minimumQuantity
            }

            let productId = editingId

            // Save the product details first.
            if (editingId) {
                const { error: updateError } = await supabase
                    .from('menu_items')
                    .update(productData)
                    .eq('id', editingId)

                if (updateError) throw updateError
            } else {
                const { data, error: insertError } = await supabase
                    .from('menu_items')
                    .insert(productData)
                    .select('id')
                    .single()

                if (insertError) throw insertError
                productId = data.id
            }

            // Upload a new image if one was selected.
            if (imageFile) {
                const imageUrl = await uploadProductImage(productId)

                const { error: imageUpdateError } = await supabase
                    .from('menu_items')
                    .update({ image_url: imageUrl })
                    .eq('id', productId)

                if (imageUpdateError) {
                    throw new Error(
                        `Product details were saved, but the image could not be linked: ${imageUpdateError.message}`
                    )
                }
            } else if (removeImage) {
                const { error: imageUpdateError } = await supabase
                    .from('menu_items')
                    .update({ image_url: null })
                    .eq('id', productId)

                if (imageUpdateError) throw imageUpdateError
            }

            setShowForm(false)
            setForm(emptyForm)
            setImageFile(null)
            setImagePreview('')
            setRemoveImage(false)

            await loadData()

            setMessage(
                editingId
                    ? 'Product updated successfully.'
                    : 'Product added successfully.'
            )
        } catch (err) {
            setError(err.message || 'Could not save product.')
            await loadData()
        } finally {
            setSaving(false)
        }
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
        },
        imagePreview: {
            width: '100%',
            maxHeight: 190,
            objectFit: 'contain',
            borderRadius: 10,
            background: '#f6f8fa'
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
                        Manage your canteen menu, products, images and selling prices.
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
                        title="Refresh products"
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
                            minWidth: 760
                        }}>
                            <thead>
                                <tr style={{
                                    background: '#f6f8fa',
                                    textAlign: 'left'
                                }}>
                                    {[
                                        'Image',
                                        'Product',
                                        'Category',
                                        'Unit',
                                        'Selling Price',
                                        'Available Stock',
                                        'Reorder Level',
                                        'Status',
                                        'Actions'
                                    ].map(label => (
                                        <th key={label} style={{
                                            padding: 13,
                                            color: '#718096'
                                        }}>
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
                                            <td style={{ padding: 9 }}>
                                                {item.image_url ? (
                                                    <img
                                                        src={item.image_url}
                                                        alt={item.name}
                                                        loading="lazy"
                                                        style={{
                                                            width: 48,
                                                            height: 48,
                                                            objectFit: 'cover',
                                                            borderRadius: 8
                                                        }}
                                                    />
                                                ) : (
                                                    <div style={{
                                                        width: 48,
                                                        height: 48,
                                                        borderRadius: 8,
                                                        background: '#f1f5f4',
                                                        display: 'grid',
                                                        placeItems: 'center',
                                                        color: '#8492a6'
                                                    }}>
                                                        <ImagePlus size={20} />
                                                    </div>
                                                )}
                                            </td>

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

                                            <td style={{ padding: 13 }}>
                                                {Number(item.current_quantity || 0)} {item.unit}
                                            </td>

                                            <td style={{ padding: 13 }}>
                                                {Number(item.minimum_quantity || 0)} {item.unit}
                                            </td>

                                            <td style={{ padding: 13 }}>
                                                <span style={{
                                                    color: item.active ? '#28785f' : '#b42318',
                                                    background: item.active ? '#eaf6f0' : '#fff1f0',
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
                                                    title="Edit product and image"
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
                                                    {item.active ? 'Deactivate' : 'Activate'}
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
                    zIndex: 1000,
                    overflowY: 'auto'
                }}>
                    <form
                        onSubmit={handleSave}
                        style={{
                            background: '#fff',
                            borderRadius: 16,
                            padding: 25,
                            width: '100%',
                            maxWidth: 480,
                            maxHeight: '92vh',
                            overflowY: 'auto',
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
                                onChange={e => setForm({
                                    ...form,
                                    minimum_quantity: e.target.value
                                })}
                                style={{ ...styles.input, marginTop: 7 }}
                            />
                        </label>

                        {/* PRODUCT IMAGE UPLOAD */}
                        <div style={{
                            border: '1px solid #dce3eb',
                            borderRadius: 12,
                            padding: 14,
                            display: 'grid',
                            gap: 10
                        }}>
                            <strong>Product image</strong>

                            {imagePreview ? (
                                <img
                                    src={imagePreview}
                                    alt="Product preview"
                                    style={styles.imagePreview}
                                />
                            ) : (
                                <div style={{
                                    minHeight: 115,
                                    borderRadius: 10,
                                    background: '#f6f8fa',
                                    display: 'grid',
                                    placeItems: 'center',
                                    color: '#8492a6'
                                }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <ImagePlus size={30} />
                                        <p style={{ margin: '7px 0 0', fontSize: 13 }}>
                                            No product image selected
                                        </p>
                                    </div>
                                </div>
                            )}

                            <label
                                style={{
                                    ...styles.button,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    cursor: 'pointer'
                                }}
                            >
                                <Upload size={16} />
                                {imagePreview ? 'Choose Another Image' : 'Upload Product Image'}
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={handleImageSelection}
                                    style={{ display: 'none' }}
                                />
                            </label>

                            {imageFile && (
                                <p style={{
                                    color: '#28785f',
                                    fontSize: 12,
                                    margin: 0
                                }}>
                                    Selected: {imageFile.name}
                                </p>
                            )}

                            {editingId && imagePreview && (
                                <button
                                    type="button"
                                    onClick={clearImageSelection}
                                    style={{
                                        border: '1px solid #f0c8c5',
                                        color: '#b42318',
                                        background: '#fff',
                                        borderRadius: 8,
                                        padding: 9,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        gap: 7
                                    }}
                                >
                                    <Trash2 size={15} />
                                    Remove Product Image
                                </button>
                            )}

                            <small style={{ color: '#718096' }}>
                                JPG, PNG or WebP. Images are automatically compressed before upload.
                            </small>
                        </div>

                        {error && (
                            <p style={{
                                color: '#b42318',
                                background: '#fff1f0',
                                padding: 10,
                                borderRadius: 8,
                                margin: 0
                            }}>
                                {error}
                            </p>
                        )}

                        <button
                            type="button"
                            disabled={saving || uploading}
                            onClick={() => setShowForm(false)}
                            style={{
                                border: 0,
                                background: 'transparent',
                                cursor: 'pointer'
                            }}
                        >
                            <X />
                        </button>
                    </form>
                </div>
            )}
        </div>
    )
}
