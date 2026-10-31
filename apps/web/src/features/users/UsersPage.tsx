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
import {
  Users,
  UserPlus,
  Shield,
  Building,
  Phone,
  Mail,
  Edit2,
  UserX,
  X,
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'STAFF' | 'CUSTOMER';
  isActive: boolean;
  phone: string | null;
  company: string | null;
  address: string | null;
  createdAt: string;
}

interface UsersResponse {
  data: User[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'STAFF' as 'STAFF' | 'ADMIN',
    company: '',
    phone: '',
    address: '',
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    role: 'STAFF' as 'ADMIN' | 'STAFF' | 'CUSTOMER',
    isActive: true,
    company: '',
    phone: '',
    address: '',
  });

  // Fetch users query
  const { data, isLoading, isError, refetch } = useQuery<UsersResponse>({
    queryKey: ['users', page, pageSize, search, roleFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.append('search', search.trim());
      if (roleFilter) params.append('role', roleFilter);
      if (statusFilter !== '') params.append('isActive', statusFilter);

      const res = await apiClient.get<UsersResponse>(`/users?${params.toString()}`);
      return res.data;
    },
  });

  // Create staff mutation
  const createMutation = useMutation({
    mutationFn: async (payload: typeof createForm) => {
      const res = await apiClient.post('/users/staff', payload);
      return res.data;
    },
    onSuccess: () => {
      success('Staff account created', 'New team member has been successfully provisioned.');
      setCreateModalOpen(false);
      setCreateForm({
        name: '',
        email: '',
        password: '',
        role: 'STAFF',
        company: '',
        phone: '',
        address: '',
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      const message = err.response?.data?.error?.message || 'Failed to create staff account';
      error('Creation failed', message);
    },
  });

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: typeof editForm }) => {
      const res = await apiClient.patch(`/users/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      success('User updated', 'Account details and privileges have been saved.');
      setEditModalOpen(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      const message = err.response?.data?.error?.message || 'Failed to update user';
      error('Update failed', message);
    },
  });

  // Deactivate user mutation
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/users/${id}/deactivate`);
      return res.data;
    },
    onSuccess: () => {
      success('Account deactivated', 'User has been deactivated and access revoked.');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      const message = err.response?.data?.error?.message || 'Failed to deactivate account';
      error('Action rejected', message);
    },
  });

  const handleOpenEdit = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      company: user.company || '',
      phone: user.phone || '',
      address: user.address || '',
    });
    setEditModalOpen(true);
  };

  const usersList = data?.data || [];
  const meta = data?.meta || { page: 1, pageSize: 10, total: 0 };

  // Define columns for reusable DataTable
  const columns: Column<User>[] = [
    {
      header: 'Member',
      cell: (u) => {
        const isCurrentAdmin = u.id === currentUser?.id;
        return (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-olive-100 border border-olive-200 text-olive-900 font-bold text-xs flex items-center justify-center shrink-0">
              {u.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-olive-950 flex items-center gap-1.5 truncate">
                <span>{u.name}</span>
                {isCurrentAdmin && (
                  <span className="text-[10px] bg-olive-200 text-olive-900 px-1.5 py-0.5 rounded-full font-bold">
                    You
                  </span>
                )}
              </div>
              <div className="text-xs text-olive-700 font-medium flex items-center gap-1 mt-0.5 truncate">
                <Mail className="w-3 h-3 text-olive-500" /> {u.email}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Role',
      cell: (u) => <StatusBadge status={u.role} />,
    },
    {
      header: 'Company & Phone',
      cell: (u) => (
        <div className="text-xs text-olive-800">
          {u.company ? (
            <div className="font-semibold text-olive-950 flex items-center gap-1">
              <Building className="w-3 h-3 text-olive-500" /> {u.company}
            </div>
          ) : (
            <span className="text-olive-400 italic">No organization</span>
          )}
          {u.phone && (
            <div className="text-olive-600 flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3 text-olive-400" /> {u.phone}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (u) => (
        <StatusBadge
          status={u.isActive ? 'ACTIVE' : 'INACTIVE'}
          label={u.isActive ? 'Active' : 'Deactivated'}
        />
      ),
    },
    {
      header: 'Created Date',
      cell: (u) => (
        <span className="text-xs text-olive-700 font-medium">
          {new Date(u.createdAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (u) => {
        const isCurrentAdmin = u.id === currentUser?.id;
        return (
          <div className="inline-flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenEdit(u)}
              className="h-8 px-2.5 text-olive-800 hover:text-olive-950 hover:bg-olive-100 rounded-md font-semibold text-xs flex items-center gap-1"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </Button>

            <Button
              variant="ghost"
              size="sm"
              disabled={isCurrentAdmin || !u.isActive}
              title={
                isCurrentAdmin
                  ? 'Admin cannot deactivate their own account'
                  : !u.isActive
                  ? 'Already deactivated'
                  : 'Deactivate user access'
              }
              onClick={() => {
                if (confirm(`Deactivate access for ${u.name}?`)) {
                  deactivateMutation.mutate(u.id);
                }
              }}
              className="h-8 px-2.5 text-rose-700 hover:text-rose-800 hover:bg-rose-50 rounded-md font-semibold text-xs disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <UserX className="w-3.5 h-3.5" /> Deactivate
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Reusable PageHeader */}
      <PageHeader
        title="User & Staff Directory"
        description="Administer team members, provision staff accounts, manage organization roles, and oversee system access."
        badge="Administration & Access Control"
        badgeIcon={Shield}
        actions={
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="bg-olive-800 hover:bg-olive-900 text-white font-semibold px-5 py-2.5 rounded-lg shadow-sm flex items-center gap-2 shrink-0"
          >
            <UserPlus className="w-4 h-4" /> Add Staff / Admin
          </Button>
        }
      />

      {/* Reusable DataTable with server-side pagination, filters, search */}
      <DataTable
        columns={columns}
        data={usersList}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        search={{
          value: search,
          onChange: (val) => {
            setSearch(val);
            setPage(1);
          },
          placeholder: 'Search by name, email, company...',
        }}
        filtersSlot={
          <>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 px-3 rounded-lg border border-cream-300 bg-cream-50/50 text-xs text-olive-950 font-medium focus:outline-none focus:border-olive-500"
            >
              <option value="">All Roles</option>
              <option value="ADMIN">Admins</option>
              <option value="STAFF">Staff</option>
              <option value="CUSTOMER">Customers</option>
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

            {(search || roleFilter || statusFilter) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setRoleFilter('');
                  setStatusFilter('');
                  setPage(1);
                }}
                className="h-10 border-cream-300 text-olive-800 hover:bg-cream-100 text-xs font-semibold px-3"
              >
                Reset
              </Button>
            )}
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
          icon: Users,
          title: 'No members found',
          description: 'Try adjusting your search criteria or role filters to view results.',
        }}
      />

      {/* CREATE STAFF MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl border-2 border-olive-200 max-w-lg w-full p-6 shadow-xl relative my-8">
            <div className="flex items-center justify-between pb-4 border-b border-cream-200 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-olive-100 border border-olive-200 flex items-center justify-center text-olive-800">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-olive-950">Add Staff or Admin</h3>
                  <p className="text-xs text-olive-700">Provision internal credentials &amp; role privileges</p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate(createForm);
              }}
              className="space-y-4"
            >
              <div>
                <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                  Full Name *
                </Label>
                <Input
                  required
                  placeholder="e.g. Jane Doe"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="bg-cream-50/50 border-cream-300 text-sm"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                  Corporate Email *
                </Label>
                <Input
                  type="email"
                  required
                  placeholder="jane.doe@reveniq.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="bg-cream-50/50 border-cream-300 text-sm"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                  Initial Password *
                </Label>
                <Input
                  type="password"
                  required
                  placeholder="Min 9 chars, uppercase, lowercase & symbol"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="bg-cream-50/50 border-cream-300 text-sm"
                />
                <p className="text-[11px] text-olive-600 mt-1">
                  Must be &gt;8 chars, with at least 1 uppercase, 1 lowercase &amp; 1 special char.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                    Assigned Role *
                  </Label>
                  <select
                    value={createForm.role}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        role: e.target.value as 'STAFF' | 'ADMIN',
                      })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-cream-300 bg-cream-50/50 text-sm text-olive-950 font-semibold focus:outline-none focus:border-olive-500"
                  >
                    <option value="STAFF">STAFF (Operations)</option>
                    <option value="ADMIN">ADMIN (Full Control)</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                    Phone (Optional)
                  </Label>
                  <Input
                    placeholder="+1 555-0123"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    className="bg-cream-50/50 border-cream-300 text-sm"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                  Department / Company (Optional)
                </Label>
                <Input
                  placeholder="Finance & Operations"
                  value={createForm.company}
                  onChange={(e) => setCreateForm({ ...createForm, company: e.target.value })}
                  className="bg-cream-50/50 border-cream-300 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-cream-200 mt-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateModalOpen(false)}
                  className="border-cream-300 text-olive-800 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-olive-800 hover:bg-olive-900 text-white text-xs font-semibold px-5"
                >
                  {createMutation.isPending ? 'Provisioning...' : 'Create Account'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl border-2 border-olive-200 max-w-lg w-full p-6 shadow-xl relative my-8">
            <div className="flex items-center justify-between pb-4 border-b border-cream-200 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-olive-100 border border-olive-200 flex items-center justify-center text-olive-800">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-olive-950">Edit Account</h3>
                  <p className="text-xs text-olive-700">{selectedUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate({
                  id: selectedUser.id,
                  payload: editForm,
                });
              }}
              className="space-y-4"
            >
              <div>
                <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                  Name *
                </Label>
                <Input
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="bg-cream-50/50 border-cream-300 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                    Role
                  </Label>
                  <select
                    value={editForm.role}
                    disabled={selectedUser.id === currentUser?.id}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        role: e.target.value as 'ADMIN' | 'STAFF' | 'CUSTOMER',
                      })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-cream-300 bg-cream-50/50 text-sm text-olive-950 font-semibold focus:outline-none focus:border-olive-500 disabled:opacity-50"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="STAFF">STAFF</option>
                    <option value="CUSTOMER">CUSTOMER</option>
                  </select>
                  {selectedUser.id === currentUser?.id && (
                    <p className="text-[10px] text-amber-700 mt-1">
                      Admins cannot demote their own account.
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                    Account Status
                  </Label>
                  <select
                    value={String(editForm.isActive)}
                    disabled={selectedUser.id === currentUser?.id}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        isActive: e.target.value === 'true',
                      })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-cream-300 bg-cream-50/50 text-sm text-olive-950 font-semibold focus:outline-none focus:border-olive-500 disabled:opacity-50"
                  >
                    <option value="true">Active</option>
                    <option value="false">Deactivated</option>
                  </select>
                  {selectedUser.id === currentUser?.id && (
                    <p className="text-[10px] text-amber-700 mt-1">
                      Admins cannot deactivate their own account.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                    Company
                  </Label>
                  <Input
                    value={editForm.company}
                    onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                    className="bg-cream-50/50 border-cream-300 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                    Phone
                  </Label>
                  <Input
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="bg-cream-50/50 border-cream-300 text-sm"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-olive-900 uppercase tracking-wider mb-1 block">
                  Address
                </Label>
                <Input
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="bg-cream-50/50 border-cream-300 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-cream-200 mt-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditModalOpen(false)}
                  className="border-cream-300 text-olive-800 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="bg-olive-800 hover:bg-olive-900 text-white text-xs font-semibold px-5"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
