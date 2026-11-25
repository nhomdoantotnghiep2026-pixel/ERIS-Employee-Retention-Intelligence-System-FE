import { SelectControl } from "../components/ui/select-control"
import { useAutoDismissState } from "../hooks/useAutoDismissState"

import { useRecordAudit } from "../workflows/useRecordAudit"

import { useEffect, useState } from "react"

import { AppShell } from "../components/AppShell"

import {
  Card,
  Button,
  SectionHeader,
  StatusBadge,
  Avatar,
  Input,
  Select,
  ConfirmationDialog,
  Pagination,
} from "../components/ui"

import { users as initialUsers } from "../data/mockData"

import {
  Search,
  Plus,
  Edit2,
  UserX,
  X,
  RotateCcw,
  Copy,
  MoreHorizontal,
  KeyRound,
  Mail,
} from "lucide-react"

import { useLanguage } from "../context/LanguageContext"

import { ROLE_USERS } from "../context/RoleContext"

const roles = [
  "HR",
  "Data / AI Analyst",
  "System Administrator",
  "Employee / ESS",
]

const USERS_STORAGE_KEY = "eris-admin-users-v1"

const roleColors: Record<string, string> = {
  "System Administrator": "bg-violet-50 text-violet-700 border-violet-200",

  HR: "bg-orange-50 text-orange-700 border-orange-200",

  "Data / AI Analyst": "bg-emerald-50 text-emerald-700 border-emerald-200",

  "Employee / ESS": "bg-blue-50 text-blue-700 border-blue-200",
}

export default function Users() {
  const [userRows, setUserRows] = useState<typeof initialUsers>(() => {
    try {
      const stored = localStorage.getItem(USERS_STORAGE_KEY)

      const parsed = stored ? JSON.parse(stored) : null

      return Array.isArray(parsed) ? parsed : initialUsers
    } catch {
      return initialUsers
    }
  })

  const [search, setSearch] = useState("")

  const [roleFilter, setRoleFilter] = useState("")

  const [statusFilter, setStatusFilter] = useState("")

  const [showModal, setShowModal] = useState(false)

  const [viewingId, setViewingId] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState({ name: "", email: "", role: roles[0] })

  const [formError, setFormError] = useAutoDismissState()

  const [confirm, setConfirm] = useState<{
    title: string
    description: string
    action: () => void
    tone?: "default" | "danger"
    confirmLabel?: string
  } | null>(null)

  const [page, setPage] = useState(1)

  const [menuId, setMenuId] = useState<string | null>(null)

  const perPage = 8

  const { t } = useLanguage()

  useRecordAudit(userRows, "USERS")

  useEffect(() => {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(userRows))
  }, [userRows])

  const filtered = userRows.filter((u) => {
    const matchSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())

    const matchRole = !roleFilter || u.role === roleFilter

    const matchStatus = !statusFilter || u.status === statusFilter

    return matchSearch && matchRole && matchStatus
  })

  const paged = filtered.slice((page - 1) * perPage, page * perPage)

  const openCreate = () => {
    setEditingId(null)

    setForm({ name: "", email: "", role: roles[0] })

    setFormError("")

    setShowModal(true)
  }

  const openEdit = (user: typeof initialUsers[number]) => {
    setEditingId(user.id)

    setForm({ name: user.name, email: user.email, role: user.role })

    setFormError("")

    setShowModal(true)
  }

  const saveUser = () => {
    if (!form.name.trim() || !form.email.trim()) return

    const email = form.email.trim().toLowerCase()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError("Enter a valid email address.")

      return
    }

    if (
      userRows.some(
        (row) => row.id !== editingId && row.email.toLowerCase() === email,
      )
    ) {
      setFormError("A user with this email address already exists.")

      return
    }

    setFormError("")

    const applySave = () => {
      if (editingId) {
        setUserRows((rows) =>
          rows.map((row) =>
            row.id === editingId
              ? { ...row, name: form.name.trim(), email, role: form.role }
              : row,
          ),
        )
      } else {
        setUserRows((rows) => [
          {
            id: `u-${Date.now()}`,

            name: form.name.trim(),

            email,

            role: form.role,

            status: "Active",

            lastLogin: "Just now",

            created: new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
          },

          ...rows,
        ])
      }

      setShowModal(false)
    }

    if (editingId) {
      setConfirm({
        title: "Confirm role update",

        description:
          "Role or account information changes affect what this user can access. Do you want to save these changes?",

        confirmLabel: "Save Changes",

        action: applySave,
      })

      return
    }

    applySave()
  }

  const toggleStatus = (id: string) => {
    const target = userRows.find((row) => row.id === id)

    if (!target) return

    const deactivating = target.status === "Active"

    setConfirm({
      title: deactivating
        ? "Confirm account deactivation"
        : "Confirm account activation",

      description:
        "Update the demo account record. The four fixed login actors remain unchanged; real access enforcement requires the authentication backend.",

      confirmLabel: deactivating ? "Deactivate" : "Activate",

      tone: deactivating ? "danger" : "default",

      action: () =>
        setUserRows((rows) =>
          rows.map((row) =>
            row.id === id
              ? {
                  ...row,
                  status: row.status === "Active" ? "Inactive" : "Active",
                }
              : row,
          ),
        ),
    })
  }

  const deleteUser = (id: string) => {
    const target = userRows.find((row) => row.id === id)

    if (!target || ROLE_USERS.some((user) => user.email === target.email))
      return

    setConfirm({
      title: "Delete demo account record?",
      description:
        "The record will be marked Deleted. Filter Deleted accounts and activate it again to restore it.",
      confirmLabel: "Mark Deleted",
      tone: "danger",
      action: () =>
        setUserRows((rows) =>
          rows.map((row) =>
            row.id === id ? { ...row, status: "Deleted" } : row,
          ),
        ),
    })
  }

  return (
    <AppShell breadcrumb={["Users"]}>
      <SectionHeader
        title="Users"
        description="Manage demo account records and assigned roles. The four fixed login actors are preserved; account enforcement needs the authentication backend."
      >
        <Button variant="primary" size="sm" onClick={openCreate}>
          <Plus size={13} /> Add User
        </Button>
      </SectionHeader>

      {viewingId && (
        <Card className="mb-5 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Thông tin tài khoản</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewingId(null)}
            >
              Đóng
            </Button>
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {Object.entries(
              userRows.find((row) => row.id === viewingId) || {},
            ).map(([field, value]) => (
              <div key={field}>
                <dt className="text-xs text-slate-500">{field}</dt>
                <dd className="mt-1 text-sm text-slate-800">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <Input
              placeholder={t("Search users...")}
              value={search}
              onChange={(v) => {
                setSearch(v)
                setPage(1)
              }}
              icon={<Search size={15} />}
              className="w-full sm:w-72"
            />
            <Select
              ariaLabel={t("Filter by role")}
              value={roleFilter}
              onChange={(v) => {
                setRoleFilter(v)
                setPage(1)
              }}
              options={roles}
              placeholder={t("All Roles")}
            />
            <Select
              ariaLabel={t("Filter by status")}
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v)
                setPage(1)
              }}
              options={["Active", "Inactive", "Deleted"]}
              placeholder={t("All Status")}
            />
            {(search || roleFilter || statusFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("")
                  setRoleFilter("")
                  setStatusFilter("")
                  setPage(1)
                }}
              >
                <RotateCcw size={14} />
                {t("Reset")}
              </Button>
            )}
          </div>
          <div className="text-xs font-medium text-slate-500">
            <b className="text-slate-800">{filtered.length}</b>{" "}
            {t("users found")}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[860px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {["User", "Email", "Role", "Status", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left text-[12px] font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-gray-50/60 transition-colors"
                >
                  <td className="h-14 px-3">
                    <div className="flex items-center gap-2">
                      <Avatar
                        initials={u.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                        size="md"
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {u.name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {t("Enterprise account")}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 h-[44px]">
                    <span className="font-mono text-xs text-slate-600">
                      {u.email}
                    </span>
                    <button
                      title={t("Copy email")}
                      onClick={() =>
                        void navigator.clipboard?.writeText(u.email)
                      }
                      className="ml-2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-orange-600"
                    >
                      <Copy size={13} />
                    </button>
                  </td>
                  <td className="px-3 h-[44px]">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${roleColors[u.role] || "bg-gray-100 text-gray-600 border-gray-200"}`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-3 h-[44px]">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-3 h-[44px]">
                    <div className="relative flex items-center justify-end gap-1">
                      <button
                        className="rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-600 transition-all hover:bg-orange-500 hover:text-white"
                        onClick={() => setViewingId(u.id)}
                      >
                        {t("View details")}
                      </button>
                      <button
                        aria-label={`${t("More actions")} ${u.name}`}
                        aria-expanded={menuId === u.id}
                        onClick={() => setMenuId(menuId === u.id ? null : u.id)}
                        className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {menuId === u.id && (
                        <div
                          className="absolute right-0 top-9 z-30 w-56 rounded-lg border border-slate-200 bg-white p-1.5 text-xs shadow-xl"
                          onMouseLeave={() => setMenuId(null)}
                        >
                          <button
                            onClick={() => {
                              openEdit(u)
                              setMenuId(null)
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-slate-50"
                          >
                            <Edit2 size={14} />
                            {t("Edit information")}
                          </button>
                          <button
                            onClick={() => {
                              openEdit(u)
                              setMenuId(null)
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-slate-50"
                          >
                            <KeyRound size={14} />
                            {t("Change role")}
                          </button>
                          <button
                            disabled={u.status !== "Inactive"}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-40"
                          >
                            <Mail size={14} />
                            {t("Resend activation email")}
                          </button>
                          <button
                            onClick={() => {
                              toggleStatus(u.id)
                              setMenuId(null)
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-rose-700 hover:bg-rose-50"
                          >
                            <UserX size={14} />
                            {u.status === "Active"
                              ? t("Deactivate")
                              : t("Activate")}
                          </button>
                          {!ROLE_USERS.some((user) => user.email === u.email) &&
                            u.status !== "Deleted" && (
                              <button
                                onClick={() => {
                                  deleteUser(u.id)
                                  setMenuId(null)
                                }}
                                className="w-full rounded-md px-3 py-2 text-left text-rose-700 hover:bg-rose-50"
                              >
                                {t("Delete")}
                              </button>
                            )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!paged.length && (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-500">
                      <Search size={20} />
                    </div>
                    <p className="mt-3 font-semibold text-slate-700">
                      {t("No users found")}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {t("Try changing or resetting the current filters.")}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-4 pb-4">
          <Pagination
            page={page}
            total={filtered.length}
            perPage={perPage}
            onChange={setPage}
          />
        </div>
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/25 flex items-center justify-center z-50">
          <div
            className="bg-white shadow-xl w-full max-w-sm"
            style={{ borderRadius: "7px" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="text-[15px] font-semibold text-gray-900">
                {editingId ? "Edit User" : "Add New User"}
              </span>
              <button
                onClick={() => setShowModal(false)}
                className="w-7 h-7 flex items-center justify-center text-gray-400 hover:bg-gray-100"
                style={{ borderRadius: "4px" }}
              >
                <X size={14} />
              </button>
            </div>
            <div className="px-4 py-3 space-y-3">
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  type="text"
                  placeholder="Enter full name"
                  className="w-full h-[32px] px-2.5 border border-gray-300 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB]"
                  style={{ borderRadius: "5px" }}
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  value={form.email}
                  onChange={(e) => {
                    setForm({ ...form, email: e.target.value })
                    setFormError("")
                  }}
                  type="email"
                  placeholder="user@company.com"
                  className="w-full h-[32px] px-2.5 border border-gray-300 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB]"
                  style={{ borderRadius: "5px" }}
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1">
                  Role
                </label>
                <SelectControl
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full h-[32px] px-2.5 border border-gray-300 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB]"
                  style={{ borderRadius: "5px" }}
                >
                  {roles.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </SelectControl>
              </div>
              {formError && (
                <p role="alert" className="text-xs font-semibold text-red-600">
                  {t(formError)}
                </p>
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!form.name.trim() || !form.email.trim()}
                onClick={saveUser}
              >
                {editingId ? "Save Changes" : "Create User"}
              </Button>
            </div>
          </div>
        </div>
      )}
      <ConfirmationDialog
        open={Boolean(confirm)}
        title={confirm?.title || ""}
        description={confirm?.description || ""}
        confirmLabel={confirm?.confirmLabel || "Confirm"}
        tone={confirm?.tone || "default"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          confirm?.action()

          setConfirm(null)
        }}
      />
    </AppShell>
  )
}
