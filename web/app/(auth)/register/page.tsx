"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api-client";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.postNoAuth("/auth/register", form);
      const res = await api.postNoAuth<{ access_token: string }>("/auth/login", {
        email: form.email,
        password: form.password,
      });
      setToken(res.access_token);
      router.push("/brand-vault");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-gray-900">AIMAP</h1>
          <p className="text-sm text-gray-500 mt-1">AI-Powered Marketing Automation</p>
        </div>
        <div className="card">
          <h2 className="text-base font-semibold mb-6">Tạo tài khoản</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Họ tên</label>
              <input
                type="text"
                className="input"
                value={form.full_name}
                onChange={(e) => update("full_name", e.target.value)}
                placeholder="Nguyễn Văn A"
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="owner@shop.com"
                required
              />
            </div>
            <div>
              <label className="label">Mật khẩu</label>
              <input
                type="password"
                className="input"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
              {loading ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
            </button>
          </form>
          <p className="mt-4 text-sm text-gray-500 text-center">
            Đã có tài khoản?{" "}
            <a href="/login" className="text-blue-600 hover:underline">Đăng nhập</a>
          </p>
        </div>
      </div>
    </div>
  );
}
