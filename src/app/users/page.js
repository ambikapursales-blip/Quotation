"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Pencil, Trash2, Shield, User, Mail, Loader2, X } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/useToast";

const ROLE_BADGE_COLORS = {
  Admin: "bg-purple-100 text-purple-800",
  User: "bg-blue-100 text-blue-800",
};

const STATUS_BADGE_COLORS = {
  true: "bg-green-100 text-green-800",
  false: "bg-red-100 text-red-800",
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    fullName: "",
    email: "",
    role: "User",
    active: true,
  });
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  const router = useRouter();
  const toast = useToast();

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: searchQuery,
        role: roleFilter !== "All" ? roleFilter : "",
        status: statusFilter !== "All" ? statusFilter : "",
      });
      const res = await fetch(`/api/users?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setUsers(json.data);
        setTotal(json.total);
        setTotalPages(json.totalPages);
      } else {
        setError(json.message || "Failed to load users.");
      }
    } catch (err) {
      setError(err.message || "Network error.");
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, roleFilter, statusFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const handleRoleFilterChange = (value) => {
    setRoleFilter(value);
    setPage(1);
  };

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const openCreateModal = () => {
    setFormData({ username: "", password: "", fullName: "", email: "", role: "User", active: true });
    setFormErrors({});
    setEditingUser(null);
    setShowCreateModal(true);
  };

  const openEditModal = (user) => {
    setFormData({
      username: user.username,
      password: "", // Don't pre-fill password
      fullName: user.fullName || "",
      email: user.email || "",
      role: user.role || "User",
      active: user.active,
    });
    setFormErrors({});
    setEditingUser(user);
    setShowEditModal(true);
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setEditingUser(null);
    setFormData({ username: "", password: "", fullName: "", email: "", role: "User", active: true });
    setFormErrors({});
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.username.trim()) errors.username = "Username is required";
    if (!editingUser && !formData.password.trim()) errors.password = "Password is required";
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Invalid email format";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setFormSubmitting(true);
    try {
      const isEdit = !!editingUser;
      const url = isEdit ? `/api/users/${editingUser._id}` : "/api/users";
      const method = isEdit ? "PUT" : "POST";

      // For edit, don't send password if empty
      const payload = { ...formData };
      if (isEdit && !formData.password) {
        delete payload.password;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(json.message || (isEdit ? "User updated successfully." : "User created successfully."));
        closeModal();
        loadUsers();
      } else {
        if (json.errors) {
          setFormErrors(json.errors);
        }
        toast.error(json.message || "Operation failed.");
      }
    } catch (err) {
      toast.error(err.message || "Network error.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;

    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast.success("User deleted successfully.");
        loadUsers();
      } else {
        toast.error(json.message || "Failed to delete user.");
      }
    } catch (err) {
      toast.error(err.message || "Network error.");
    }
  };

  const filteredUsers = users;

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-ink-900">Users</h1>
            <p className="text-ink-500 mt-1">Manage user accounts and roles</p>
          </div>
          <Button onClick={openCreateModal} className="whitespace-nowrap">
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>

        {/* Search & Filters */}
        <Card className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
              <Input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={handleSearch}
                className="pl-10"
              />
            </div>
            <Select
              value={roleFilter}
              onChange={handleRoleFilterChange}
              options={[
                { value: "All", label: "All Roles" },
                { value: "Admin", label: "Admin" },
                { value: "User", label: "User" },
              ]}
            />
            <Select
              value={statusFilter}
              onChange={handleStatusFilterChange}
              options={[
                { value: "All", label: "All Status" },
                { value: "Active", label: "Active" },
                { value: "Inactive", label: "Inactive" },
              ]}
            />
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-500">{total} users</span>
            </div>
          </div>
        </Card>

        {/* Users Table */}
        <Card className="overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-accent-500" />
            </div>
          )}

          {!loading && error && (
            <div className="p-4 text-center text-red-600">{error}</div>
          )}

          {!loading && !error && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-ink-50 border-b border-ink-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-ink-600">User ID</th>
                      <th className="px-4 py-3 text-left font-medium text-ink-600">Username</th>
                      <th className="px-4 py-3 text-left font-medium text-ink-600">Full Name</th>
                      <th className="px-4 py-3 text-left font-medium text-ink-600">Email</th>
                      <th className="px-4 py-3 text-left font-medium text-ink-600">Role</th>
                      <th className="px-4 py-3 text-left font-medium text-ink-600">Status</th>
                      <th className="px-4 py-3 text-right font-medium text-ink-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-ink-500">
                          No users found.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user._id} className="hover:bg-ink-50 transition-colors">
                          <td className="px-4 py-3 text-ink-900 font-mono text-xs">{user._id}</td>
                          <td className="px-4 py-3 text-ink-900 font-medium">{user.username}</td>
                          <td className="px-4 py-3 text-ink-600">{user.fullName || "-"}</td>
                          <td className="px-4 py-3 text-ink-600">{user.email || "-"}</td>
                          <td className="px-4 py-3">
                            <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", ROLE_BADGE_COLORS[user.role] || "bg-gray-100 text-gray-800")}>
                              <Shield className="h-3 w-3 mr-1" />
                              {user.role || "User"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", STATUS_BADGE_COLORS[user.active] || "bg-gray-100 text-gray-800")}>
                              {user.active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditModal(user)}
                                className="text-ink-600 hover:text-ink-900"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(user._id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-ink-200 flex items-center justify-between">
                  <div className="text-sm text-ink-600">
                    Page {page} of {totalPages} ({total} total)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Create/Edit Modal */}
        {(showCreateModal || showEditModal) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-ink-200">
                <h2 className="text-lg font-semibold text-ink-900">
                  {editingUser ? "Edit User" : "Create User"}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-1 text-ink-400 hover:text-ink-600 rounded-lg hover:bg-ink-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-ink-700 mb-1">
                    Username *
                  </label>
                  <Input
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleFormChange}
                    disabled={editingUser}
                    placeholder="Enter username"
                    error={formErrors.username}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-ink-700 mb-1">
                    {editingUser ? "Password (leave blank to keep current)" : "Password *"}
                  </label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleFormChange}
                    placeholder={editingUser ? "••••••••" : "Enter password"}
                    error={formErrors.password}
                  />
                </div>

                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-ink-700 mb-1">
                    Full Name
                  </label>
                  <Input
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleFormChange}
                    placeholder="Enter full name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-ink-700 mb-1">
                    Email
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleFormChange}
                    placeholder="Enter email"
                    error={formErrors.email}
                  />
                </div>

                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-ink-700 mb-1">
                    Role
                  </label>
                  <Select
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleFormChange}
                    options={[
                      { value: "Admin", label: "Admin" },
                      { value: "User", label: "User" },
                    ]}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="active"
                    name="active"
                    type="checkbox"
                    checked={formData.active}
                    onChange={handleFormChange}
                    className="h-4 w-4 rounded border-ink-300 text-accent-500 focus:ring-accent-500"
                  />
                  <label htmlFor="active" className="text-sm text-ink-700 cursor-pointer">
                    Active
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeModal}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={formSubmitting} className="flex-1">
                    {formSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {editingUser ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}