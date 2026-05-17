"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, setToken } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.postNoAuth<{ access_token: string; user: { role: string } }>("/auth/login", {
        email: email.trim(),
        password,
      });
      setToken(res.access_token);
      const next = new URLSearchParams(window.location.search).get("next");
      const fallback = ["admin", "staff", "super_admin"].includes(res.user.role) ? "/admin" : "/dashboard";
      router.replace(next?.startsWith("/") ? next : fallback);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Image
            src="/images/logo/aimap-logo.png"
            alt="AIMAP"
            width={152}
            height={64}
            className="mx-auto h-auto w-auto max-w-full object-contain"
            priority
          />
          <p className="mt-2 text-sm text-gray-500">AI-Powered Marketing Automation</p>
        </div>
        <div className="card">
          <h2 className="mb-6 text-base font-semibold">Đăng nhập</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
              />
            </div>
            <div>
              <label className="label">Mật khẩu</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500">
            Chưa có tài khoản?{" "}
            <a href="/register" className="text-blue-600 hover:underline">
              Đăng ký
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
