"use client";

import Image from "next/image";
import Link from "next/link";

export default function VerifyEmailPage() {
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
        </div>
        <div className="card text-center">
          <h2 className="mb-3 text-base font-semibold">Xác thực bằng OTP</h2>
          <p className="text-sm text-gray-600">
            AIMAP hiện xác thực email bằng mã OTP ngay tại trang đăng ký. Vui lòng quay lại trang đăng ký để nhập mã.
          </p>
          <Link href="/register" className="btn-primary mt-6 w-full justify-center">
            Đến trang đăng ký
          </Link>
        </div>
      </div>
    </div>
  );
}
