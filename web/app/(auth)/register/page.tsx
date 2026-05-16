"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

type RegisterStep = "form" | "otp" | "done";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<RegisterStep>("form");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const email = form.email.trim().toLowerCase();

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await api.postNoAuth<{
        email: string;
        message: string;
        email_sent: boolean;
        expires_in_minutes: number;
      }>("/auth/register", { ...form, email });
      setMessage(`${res.message} Mã có hiệu lực ${res.expires_in_minutes} phút.`);
      setStep("otp");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await api.postNoAuth<{ message: string }>("/auth/verify-email", { email, otp });
      setMessage(res.message);
      setStep("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Xác thực OTP thất bại");
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await api.postNoAuth<{ message: string; expires_in_minutes?: number }>(
        "/auth/resend-verification",
        { email }
      );
      setMessage(
        res.expires_in_minutes ? `${res.message} Mã có hiệu lực ${res.expires_in_minutes} phút.` : res.message
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi lại được OTP");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
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
          <h2 className="mb-6 text-base font-semibold">
            {step === "form" ? "Tạo tài khoản" : step === "otp" ? "Xác thực email" : "Đăng ký hoàn tất"}
          </h2>

          {step === "form" && (
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
                  placeholder="user@example.com"
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
                {loading ? "Đang gửi OTP..." : "Gửi mã OTP"}
              </button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm font-medium text-blue-900">Kiểm tra email của bạn</p>
                <p className="mt-1 text-sm text-blue-700">{message || `Mã OTP đã được gửi đến ${email}.`}</p>
              </div>
              <div>
                <label className="label">Mã OTP 6 số</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  className="input text-center text-lg font-semibold tracking-[0.4em]"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" className="btn-primary w-full justify-center" disabled={loading || otp.length !== 6}>
                {loading ? "Đang xác thực..." : "Xác thực OTP"}
              </button>
              <button type="button" className="btn-secondary w-full justify-center" onClick={resendOtp} disabled={loading}>
                Gửi lại OTP
              </button>
            </form>
          )}

          {step === "done" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-sm font-medium text-green-800">Tài khoản đã sẵn sàng</p>
                <p className="mt-1 text-sm text-green-700">{message}</p>
              </div>
              <button type="button" className="btn-primary w-full justify-center" onClick={() => router.push("/login")}>
                Đến trang đăng nhập
              </button>
            </div>
          )}

          <p className="mt-4 text-center text-sm text-gray-500">
            Đã có tài khoản?{" "}
            <a href="/login" className="text-blue-600 hover:underline">
              Đăng nhập
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
