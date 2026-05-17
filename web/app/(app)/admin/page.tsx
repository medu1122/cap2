"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CircleOff,
  Download,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  Wand2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/lib/api-client";

interface CurrentUser {
  id: string;
  email: string;
  role: string;
}

interface AdminDashboard {
  total_users: number;
  active_users: number;
  inactive_users: number;
  admin_users: number;
  new_users_30d: number;
  active_campaigns: number;
  total_campaigns: number;
  ai_token_usage: number;
  total_ai_generations: number;
  pending_ai_content: number;
  campaign_engagement_rate: number;
  system_status: Array<{ name: string; status: string; detail: string }>;
}

interface ManagedUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  status: string;
  avatar_url: string | null;
  campaign_count: number;
  created_at: string | null;
  updated_at: string | null;
}

interface UsersResponse {
  items: ManagedUser[];
  total: number;
  page: number;
  page_size: number;
}

interface ActivityLog {
  id: string;
  type: string;
  title: string;
  actor_email: string;
  status: string;
  detail: string | null;
  created_at: string | null;
}

type StatusFilter = "all" | "active" | "inactive";

const ADMIN_ROLES = new Set(["super_admin", "admin", "staff"]);
const ROLE_OPTIONS = [
  { value: "user", label: "User" },
  { value: "staff", label: "Staff" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super Admin" },
];

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function roleLabel(role: string) {
  return ROLE_OPTIONS.find((item) => item.value === role)?.label ?? role;
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <span className="text-gray-400">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-gray-950">{value}</p>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    const me = await api.get<CurrentUser>("/auth/me");
    if (!ADMIN_ROLES.has(me.role)) {
      router.replace("/dashboard");
      return;
    }
    setCurrentUser(me);
    const [dashboardData, usersData, logData] = await Promise.all([
      api.get<AdminDashboard>("/admin/dashboard"),
      api.get<UsersResponse>("/admin/users", {
        params: {
          q: query.trim(),
          role: roleFilter,
          status: statusFilter,
          page_size: "100",
        },
      }),
      api.get<ActivityLog[]>("/admin/activity-logs?limit=8"),
    ]);
    setDashboard(dashboardData);
    setUsers(usersData.items);
    setLogs(logData);
  }, [query, roleFilter, router, statusFilter]);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        await loadData();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không tải được dữ liệu admin.");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadData]);

  const chartData = useMemo(
    () => [
      { name: "User", value: dashboard?.total_users ?? 0 },
      { name: "Active", value: dashboard?.active_users ?? 0 },
      { name: "AI", value: dashboard?.total_ai_generations ?? 0 },
    ],
    [dashboard],
  );

  function isCurrentAccount(user: ManagedUser) {
    if (!currentUser) return false;
    return (
      currentUser.id === user.id ||
      currentUser.email.trim().toLowerCase() === user.email.trim().toLowerCase()
    );
  }

  async function refresh() {
    try {
      setRefreshing(true);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không làm mới được dữ liệu.");
    } finally {
      setRefreshing(false);
    }
  }

  async function toggleUser(user: ManagedUser) {
    if (isCurrentAccount(user)) {
      setError("Không thể tự vô hiệu hóa tài khoản đang đăng nhập.");
      return;
    }
    try {
      setUpdatingUserId(user.id);
      const updated = await api.patch<ManagedUser>(`/admin/users/${user.id}/status`, {
        is_active: !user.is_active,
      });
      setUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, ...updated } : item)));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không cập nhật được trạng thái tài khoản.");
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function deleteUser(user: ManagedUser) {
    if (isCurrentAccount(user)) {
      setError("Không thể xóa tài khoản đang đăng nhập.");
      return;
    }
    if (!window.confirm(`Xóa tài khoản ${user.email}? Thao tác này không thể hoàn tác.`)) return;
    try {
      setUpdatingUserId(user.id);
      await api.delete<void>(`/admin/users/${user.id}`);
      setUsers((prev) => prev.filter((item) => item.id !== user.id));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xóa được tài khoản.");
    } finally {
      setUpdatingUserId(null);
    }
  }

  function exportCsv() {
    const header = ["id", "full_name", "email", "role", "status", "created_at"];
    const rows = users.map((user) =>
      [user.id, user.full_name ?? "", user.email, user.role, user.status, user.created_at ?? ""]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "aimap-admin-users.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Đang tải dashboard admin...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section id="overview" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-950 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-950">Admin Dashboard</h1>
              <p className="text-sm text-gray-500">
                Quản lí người dùng, quyền truy cập và tình trạng vận hành AIMAP.
              </p>
            </div>
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Làm mới
          </button>
        </section>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          <StatCard label="Tổng user" value={dashboard?.total_users ?? 0} icon={<Users className="h-5 w-5" />} />
          <StatCard label="Đang hoạt động" value={dashboard?.active_users ?? 0} icon={<CheckCircle2 className="h-5 w-5" />} />
          <StatCard label="Bị khóa" value={dashboard?.inactive_users ?? 0} icon={<CircleOff className="h-5 w-5" />} />
          <StatCard label="Chiến dịch active" value={dashboard?.active_campaigns ?? 0} icon={<BarChart3 className="h-5 w-5" />} />
          <StatCard label="AI generations" value={dashboard?.total_ai_generations ?? 0} icon={<Wand2 className="h-5 w-5" />} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-950">Tổng quan hệ thống</h2>
                <p className="text-sm text-gray-500">Theo dõi nhanh user, AI và engagement.</p>
              </div>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                Token AI: {(dashboard?.ai_token_usage ?? 0).toLocaleString("vi-VN")}
              </span>
            </div>
            <div className="mt-5 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-base font-semibold text-gray-950">Trạng thái hệ thống</h2>
            <div className="mt-4 space-y-3">
              {(dashboard?.system_status ?? []).map((item) => (
                <div key={item.name} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-gray-950">{item.name}</p>
                    <span
                      className={
                        item.status === "operational"
                          ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700"
                          : "rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700"
                      }
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{item.detail}</p>
                </div>
              ))}
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="font-medium text-gray-950">Engagement</p>
                <p className="mt-1 text-sm text-gray-500">
                  Tỷ lệ tương tác chiến dịch: {dashboard?.campaign_engagement_rate ?? 0}%
                </p>
              </div>
            </div>
          </section>
        </div>

        <section id="users" className="rounded-lg border border-gray-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-gray-200 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-950">Quản lí người dùng</h2>
              <p className="text-sm text-gray-500">Tìm kiếm, lọc, khóa tài khoản, đổi vai trò hoặc xóa user.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm email hoặc tên..."
                  className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">Tất cả vai trò</option>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <button
                onClick={exportCsv}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Download className="h-4 w-4" />
                CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Người dùng</th>
                  <th className="px-4 py-3 font-semibold">Vai trò</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold">Ngày tạo</th>
                  <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => {
                  const isSelf = isCurrentAccount(user);
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-gray-950">{user.full_name || "Chưa đặt tên"}</p>
                          {isSelf && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                              Tài khoản hiện tại
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm font-medium text-gray-600">
                          {roleLabel(user.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            user.is_active
                              ? "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                              : "inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700"
                          }
                        >
                          {user.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(user.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {isSelf ? (
                            <span className="inline-flex min-w-36 items-center justify-center rounded-lg bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">
                              Được bảo vệ
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => void toggleUser(user)}
                                disabled={updatingUserId === user.id}
                                className={
                                  user.is_active
                                    ? "inline-flex min-w-28 items-center justify-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                                    : "inline-flex min-w-28 items-center justify-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                }
                              >
                                {updatingUserId === user.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                {user.is_active ? "Vô hiệu hóa" : "Kích hoạt"}
                              </button>
                              <button
                                onClick={() => void deleteUser(user)}
                                disabled={updatingUserId === user.id}
                                className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-gray-500 hover:bg-gray-50 hover:text-red-600 disabled:opacity-50"
                                title="Xóa user"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                      Không có người dùng phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <section id="activity" className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-base font-semibold text-gray-950">Hoạt động gần đây</h2>
            <div className="mt-4 space-y-3">
              {logs.map((log) => (
                <div key={`${log.type}-${log.id}`} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-gray-950">{log.title}</p>
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-gray-600">{log.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{log.actor_email} · {formatDate(log.created_at)}</p>
                  {log.detail && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{log.detail}</p>}
                </div>
              ))}
              {logs.length === 0 && <p className="text-sm text-gray-500">Chưa có hoạt động hệ thống.</p>}
            </div>
          </section>

          <section id="settings" className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-950">Công cụ admin</h2>
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="font-medium text-gray-950">Phân quyền</p>
                <p className="mt-1 text-sm text-gray-500">Staff/Admin/Super Admin có thể vào dashboard quản trị.</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="font-medium text-gray-950">Nội dung AI chờ duyệt</p>
                <p className="mt-1 text-sm text-gray-500">{dashboard?.pending_ai_content ?? 0} nội dung cần kiểm tra.</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="font-medium text-gray-950">User mới 30 ngày</p>
                <p className="mt-1 text-sm text-gray-500">{dashboard?.new_users_30d ?? 0} tài khoản mới.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
