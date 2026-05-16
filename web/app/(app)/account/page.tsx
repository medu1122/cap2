"use client";

import { useEffect, useState } from "react";
import { KeyRound, Mail, UserRound } from "lucide-react";
import { api } from "@/lib/api-client";

interface CurrentUser {
  email: string;
  full_name: string | null;
  role: string;
}

export default function AccountPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [form, setForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<CurrentUser>("/auth/me").then(setUser).catch(() => setUser(null));
  }, []);

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (form.new_password !== form.confirm_password) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ message: string }>("/auth/change-password", {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      setMessage(res.message);
      setForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đổi được mật khẩu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tài khoản</h1>
          <p className="mt-1 text-sm text-gray-500">Quản lý thông tin đăng nhập và bảo mật tài khoản.</p>
        </div>

        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900">
            <UserRound className="h-4 w-4 text-blue-600" />
            Thông tin tài khoản
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs font-medium uppercase text-gray-400">Họ tên</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{user?.full_name || "Chưa cập nhật"}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs font-medium uppercase text-gray-400">Email</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-medium text-gray-900">
                <Mail className="h-4 w-4 text-gray-400" />
                {user?.email || "..."}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900">
            <KeyRound className="h-4 w-4 text-blue-600" />
            Đổi mật khẩu
          </h2>
          <form onSubmit={changePassword} className="space-y-4">
            <div>
              <label className="label">Mật khẩu hiện tại</label>
              <input
                type="password"
                className="input"
                value={form.current_password}
                onChange={(e) => update("current_password", e.target.value)}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Mật khẩu mới</label>
                <input
                  type="password"
                  className="input"
                  value={form.new_password}
                  onChange={(e) => update("new_password", e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <div>
                <label className="label">Nhập lại mật khẩu mới</label>
                <input
                  type="password"
                  className="input"
                  value={form.confirm_password}
                  onChange={(e) => update("confirm_password", e.target.value)}
                  minLength={6}
                  required
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {message && <p className="text-sm text-green-700">{message}</p>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Đang đổi..." : "Đổi mật khẩu"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
