import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  Layers,
  X,
  PlusCircle,
} from 'lucide-react';

interface Variant {
  id: string;
  productId: string;
  attribute: string;
  value: string;
  extraPrice: string;
}

interface Product {
  id: string;
  name: string;
  type: 'SOFTWARE' | 'SERVICE' | 'ADDON' | 'GOODS';
  salesPrice: string;
  costPrice: string;
  notes: string | null;
  isActive: boolean;
  taxId: string | null;
  tax?: {
    id: string;
    name: string;
    rate: string;
  } | null;
  variants: Variant[];
  createdAt: string;
}

interface ProductsResponse {
  data: Product[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export function ProductsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [variantsModalOpen, setVariantsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Product Form
  const [productForm, setProductForm] = useState({
    name: '',
    type: 'SOFTWARE' as 'SOFTWARE' | 'SERVICE' | 'ADDON' | 'GOODS',
    salesPrice: 100.0,
    costPrice: 40.0,
    notes: '',
    taxId: '',
    isActive: true,
  });

  // Variant Form
  const [variantForm, setVariantForm] = useState({
    attribute: '',
    value: '',
    extraPrice: 0.0,
  });

  // Fetch taxes for dropdown
  const { data: taxesData } = useQuery({
    queryKey: ['taxes-select'],
    queryFn: async () => {
      const res = await apiClient.get('/taxes?pageSize=100&isActive=true');
      return res.data?.data || [];
    },
  });

  // Fetch products
  const { data, isLoading, isError, refetch } = useQuery<ProductsResponse>({
    queryKey: ['products', page, pageSize, search, typeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.append('search', search.trim());
      if (typeFilter) params.append('type', typeFilter);
      if (statusFilter !== '') params.append('isActive', statusFilter);

      const res = await apiClient.get<ProductsResponse>(`/products?${params.toString()}`);
      return res.data;
    },
  });

  // Product mutations
  const createProductMutation = useMutation({
    mutationFn: async (payload: typeof productForm) => {
      const res = await apiClient.post('/products', {
        ...payload,
        taxId: payload.taxId || null,
      });
      return res.data;
    },
    onSuccess: () => {
      success('Product created', 'Catalog item added successfully.');
      setProductModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      error('Creation failed', err.response?.data?.error?.message || 'Could not create product');
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: typeof productForm }) => {
      const res = await apiClient.patch(`/products/${id}`, {
        ...payload,
        taxId: payload.taxId || null,
      });
      return res.data;
    },
    onSuccess: () => {
      success('Product updated', 'Catalog item details saved successfully.');
      setProductModalOpen(false);
      setSelectedProduct(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      error('Update failed', err.response?.data?.error?.message || 'Could not update product');
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/products/${id}`);
      return res.data;
    },
    onSuccess: (data: any) => {
      success('Product status updated', data.data?.message || 'Product removed successfully.');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      error('Delete failed', err.response?.data?.error?.message || 'Could not delete product');
    },
  });

  // Variant mutations
  const createVariantMutation = useMutation({
    mutationFn: async ({ productId, payload }: { productId: string; payload: typeof variantForm }) => {
      const res = await apiClient.post(`/products/${productId}/variants`, payload);
      return res.data;
    },
    onSuccess: () => {
      success('Variant added', 'New product variant attribute registered.');
      setVariantForm({ attribute: '', value: '', extraPrice: 0.0 });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      error('Failed to add variant', err.response?.data?.error?.message || 'Could not add variant');
    },
  });

  const deleteVariantMutation = useMutation({
    mutationFn: async ({ productId, variantId }: { productId: string; variantId: string }) => {
      const res = await apiClient.delete(`/products/${productId}/variants/${variantId}`);
      return res.data;
    },
    onSuccess: () => {
      success('Variant removed', 'Product variant was removed.');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      error('Failed to remove variant', err.response?.data?.error?.message || 'Could not remove variant');
    },
  });

  const handleOpenEdit = (p: Product) => {
    setSelectedProduct(p);
    setProductForm({
      name: p.name,
      type: p.type,
      salesPrice: parseFloat(p.salesPrice),
      costPrice: parseFloat(p.costPrice),
      notes: p.notes || '',
      taxId: p.taxId || '',
      isActive: p.isActive,
    });
    setProductModalOpen(true);
  };

  const handleOpenVariants = (p: Product) => {
    setSelectedProduct(p);
    setVariantForm({ attribute: '', value: '', extraPrice: 0.0 });
    setVariantsModalOpen(true);
  };

  const productsList = data?.data || [];
  const meta = data?.meta || { page: 1, pageSize: 10, total: 0 };
  const currentProduct = selectedProduct
    ? productsList.find((p) => p.id === selectedProduct.id) || selectedProduct
    : null;

  const columns: Column<Product>[] = [
    {
      header: 'Product',
      cell: (p) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-olive-100 border border-olive-200 text-olive-900 flex items-center justify-center font-bold text-xs">
            <Package className="w-4.5 h-4.5 text-olive-700" />
          </div>
          <div>
            <p className="font-bold text-olive-950 text-sm">{p.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cream-200 text-olive-900 border border-cream-300">
                {p.type}
              </span>
              {p.tax && (
                <span className="text-[10px] text-olive-700 font-semibold">
                  Tax: {p.tax.name} ({p.tax.rate}%)
                </span>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Sales Price',
      cell: (p) => (
        <div>
          <span className="font-mono font-bold text-olive-950 text-sm">
            ${p.salesPrice}
          </span>
          <p className="text-[11px] text-olive-600 font-medium">Cost: ${p.costPrice}</p>
        </div>
      ),
    },
    {
      header: 'Variants',
      cell: (p) => (
        <button
          onClick={() => handleOpenVariants(p)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-cream-300 bg-cream-50 hover:bg-cream-100 text-xs font-semibold text-olive-900 transition-colors"
        >
          <Layers className="w-3.5 h-3.5 text-olive-600" />
          <span>{p.variants?.length || 0} variants</span>
        </button>
      ),
    },
    {
      header: 'Status',
      cell: (p) => (
        <StatusBadge
          status={p.isActive ? 'ACTIVE' : 'INACTIVE'}
          label={p.isActive ? 'Active' : 'Deactivated'}
        />
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (p) => {
        if (!isAdmin) return <span className="text-xs text-olive-400 italic">Read-only</span>;
        return (
          <div className="inline-flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenVariants(p)}
              className="h-8 px-2 text-olive-800 hover:bg-olive-100 rounded-md font-semibold text-xs flex items-center gap-1"
            >
              <Layers className="w-3.5 h-3.5" /> Variants
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenEdit(p)}
              className="h-8 px-2 text-olive-800 hover:bg-olive-100 rounded-md font-semibold text-xs flex items-center gap-1"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm(`Remove or deactivate "${p.name}"?`)) {
                  deleteProductMutation.mutate(p.id);
                }
              }}
              className="h-8 px-2 text-rose-700 hover:bg-rose-50 rounded-md font-semibold text-xs flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Products & Catalog"
        description="Manage software items, recurring services, hardware goods, and configure tiered attribute variants."
        badge="Catalog Engine"
        badgeIcon={Package}
        actions={
          isAdmin && (
            <Button
              onClick={() => {
                setSelectedProduct(null);
                setProductForm({
                  name: '',
                  type: 'SOFTWARE',
                  salesPrice: 100.0,
                  costPrice: 40.0,
                  notes: '',
                  taxId: '',
                  isActive: true,
                });
                setProductModalOpen(true);
              }}
              className="bg-olive-800 hover:bg-olive-900 text-white font-semibold px-5 py-2.5 rounded-lg shadow-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Product
            </Button>
          )
        }
      />

      <DataTable
        columns={columns}
        data={productsList}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        search={{
          value: search,
          onChange: (val) => {
            setSearch(val);
            setPage(1);
          },
          placeholder: 'Search product name...',
        }}
        filtersSlot={
          <>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 px-3 rounded-lg border border-cream-300 bg-cream-50/50 text-xs text-olive-950 font-medium focus:outline-none focus:border-olive-500"
            >
              <option value="">All Types</option>
              <option value="SOFTWARE">Software</option>
              <option value="SERVICE">Service</option>
              <option value="ADDON">Add-on</option>
              <option value="GOODS">Physical Goods</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 px-3 rounded-lg border border-cream-300 bg-cream-50/50 text-xs text-olive-950 font-medium focus:outline-none focus:border-olive-500"
            >
              <option value="">All Statuses</option>
              <option value="true">Active Only</option>
              <option value="false">Deactivated Only</option>
            </select>
          </>
        }
        pagination={{
          page: meta.page,
          pageSize: meta.pageSize,
          total: meta.total,
          onPageChange: (newPage) => setPage(newPage),
          onPageSizeChange: (newPageSize) => {
            setPageSize(newPageSize);
            setPage(1);
          },
        }}
        emptyState={{
          icon: Package,
          title: 'No products in catalog',
          description: 'Register products, subscription addons, or hardware items to begin building plans.',
        }}
      />

      {/* CREATE / EDIT PRODUCT MODAL */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border-2 border-olive-200 max-w-lg w-full p-6 shadow-xl relative my-8 animate-in fade-in">
            <div className="flex items-center justify-between pb-3.5 border-b border-cream-200 mb-4">
              <h3 className="font-serif font-bold text-lg text-olive-950">
                {selectedProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={() => setProductModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (selectedProduct) {
                  updateProductMutation.mutate({ id: selectedProduct.id, payload: productForm });
                } else {
                  createProductMutation.mutate(productForm);
                }
              }}
              className="space-y-4"
            >
              <div>
                <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                  Product Name *
                </Label>
                <Input
                  required
                  placeholder="e.g. ERP Platform Suite"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="bg-cream-50/50 border-cream-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                    Product Type *
                  </Label>
                  <select
                    value={productForm.type}
                    onChange={(e) => setProductForm({ ...productForm, type: e.target.value as any })}
                    className="w-full h-10 px-3 rounded-lg border border-cream-300 bg-cream-50/50 text-sm font-semibold text-olive-950 focus:outline-none focus:border-olive-500"
                  >
                    <option value="SOFTWARE">SOFTWARE</option>
                    <option value="SERVICE">SERVICE</option>
                    <option value="ADDON">ADD-ON</option>
                    <option value="GOODS">GOODS</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                    Default Tax Rate
                  </Label>
                  <select
                    value={productForm.taxId}
                    onChange={(e) => setProductForm({ ...productForm, taxId: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-cream-300 bg-cream-50/50 text-sm font-semibold text-olive-950 focus:outline-none focus:border-olive-500"
                  >
                    <option value="">No Tax (0%)</option>
                    {(taxesData || []).map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.rate}%)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                    Sales Price ($) *
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="100.00"
                    value={productForm.salesPrice}
                    onChange={(e) => setProductForm({ ...productForm, salesPrice: parseFloat(e.target.value) || 0 })}
                    className="bg-cream-50/50 border-cream-300"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                    Cost Price ($) *
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="40.00"
                    value={productForm.costPrice}
                    onChange={(e) => setProductForm({ ...productForm, costPrice: parseFloat(e.target.value) || 0 })}
                    className="bg-cream-50/50 border-cream-300"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                  Internal Notes (Optional)
                </Label>
                <Input
                  placeholder="Licensing terms, SLA specs..."
                  value={productForm.notes}
                  onChange={(e) => setProductForm({ ...productForm, notes: e.target.value })}
                  className="bg-cream-50/50 border-cream-300"
                />
              </div>

              <div className="pt-2">
                <Switch
                  checked={productForm.isActive}
                  onCheckedChange={(checked) => setProductForm({ ...productForm, isActive: checked })}
                  label="Catalog Active Status"
                  description="Active products appear in new quotations and plan line items"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-cream-200 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setProductModalOpen(false)}
                  className="border-cream-300 text-olive-800 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createProductMutation.isPending || updateProductMutation.isPending}
                  className="bg-olive-800 hover:bg-olive-900 text-white text-xs font-semibold px-5"
                >
                  {selectedProduct ? 'Save Changes' : 'Create Product'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VARIANTS DRAWER / MODAL */}
      {variantsModalOpen && currentProduct && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border-2 border-olive-200 max-w-xl w-full p-6 shadow-xl relative my-8 animate-in fade-in">
            <div className="flex items-center justify-between pb-3.5 border-b border-cream-200 mb-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-olive-950">
                  Variants for {currentProduct.name}
                </h3>
                <p className="text-xs text-olive-700">
                  Attribute options that modify base price (e.g. Brand = Odoo adds +$560)
                </p>
              </div>
              <button onClick={() => setVariantsModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Existing Variants List */}
            <div className="space-y-2 mb-6 max-h-56 overflow-y-auto">
              {(currentProduct.variants || []).length === 0 ? (
                <p className="text-xs text-olive-600 italic py-4 text-center bg-cream-50 rounded-xl">
                  No variants defined yet. Use the form below to add one.
                </p>
              ) : (
                currentProduct.variants.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-cream-50 border border-cream-200 text-sm"
                  >
                    <div>
                      <span className="font-bold text-olive-950">{v.attribute}: </span>
                      <span className="font-semibold text-olive-800">{v.value}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-olive-900 bg-olive-100 border border-olive-200 px-2 py-0.5 rounded-md">
                        +${v.extraPrice}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() =>
                            deleteVariantMutation.mutate({
                              productId: currentProduct.id,
                              variantId: v.id,
                            })
                          }
                          className="text-stone-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add Variant Form */}
            {isAdmin && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createVariantMutation.mutate({
                    productId: currentProduct.id,
                    payload: variantForm,
                  });
                }}
                className="p-4 rounded-xl bg-cream-100/60 border border-cream-300 space-y-3"
              >
                <p className="text-xs font-bold text-olive-900 uppercase tracking-wider flex items-center gap-1.5">
                  <PlusCircle className="w-3.5 h-3.5 text-olive-700" /> Add New Variant
                </p>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Input
                      required
                      placeholder="Attribute (e.g. Brand)"
                      value={variantForm.attribute}
                      onChange={(e) => setVariantForm({ ...variantForm, attribute: e.target.value })}
                      className="bg-white text-xs h-9"
                    />
                  </div>
                  <div>
                    <Input
                      required
                      placeholder="Value (e.g. Odoo)"
                      value={variantForm.value}
                      onChange={(e) => setVariantForm({ ...variantForm, value: e.target.value })}
                      className="bg-white text-xs h-9"
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="Extra Price ($)"
                      value={variantForm.extraPrice}
                      onChange={(e) =>
                        setVariantForm({
                          ...variantForm,
                          extraPrice: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="bg-white text-xs h-9"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    type="submit"
                    disabled={createVariantMutation.isPending}
                    size="sm"
                    className="bg-olive-800 hover:bg-olive-900 text-white text-xs px-4"
                  >
                    Add Variant
                  </Button>
                </div>
              </form>
            )}

            <div className="flex justify-end pt-4 mt-4 border-t border-cream-200">
              <Button
                variant="outline"
                onClick={() => setVariantsModalOpen(false)}
                className="border-cream-300 text-xs text-olive-800"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

