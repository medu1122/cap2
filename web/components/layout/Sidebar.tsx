"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  CalendarDays,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { api, clearToken } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const USER_NAV = [
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/customer-lists", label: "Danh sách khách", icon: Users },
  { href: "/campaigns", label: "Chiến dịch", icon: Megaphone },
  { href: "/calendar", label: "Lịch marketing", icon: CalendarDays },
  { href: "/insights", label: "Hỗ trợ phân tích", icon: BarChart3 },
  { href: "/account", label: "Tài khoản", icon: KeyRound },
];

const ADMIN_NAV = [
  { href: "/admin#overview", label: "Tổng quan admin", icon: ShieldCheck },
  { href: "/admin#users", label: "Người dùng", icon: Users },
  { href: "/admin#activity", label: "Hoạt động hệ thống", icon: Activity },
  { href: "/admin#settings", label: "Thiết lập", icon: Settings },
  { href: "/account", label: "Tài khoản", icon: KeyRound },
];

interface CurrentUser {
  role: string;
}

const ADMIN_ROLES = new Set(["super_admin", "admin", "staff"]);

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    void api.get<CurrentUser>("/auth/me").then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const isAdmin = currentUser ? ADMIN_ROLES.has(currentUser.role) : pathname.startsWith("/admin");
  const visibleNav = useMemo(() => (isAdmin ? ADMIN_NAV : USER_NAV), [isAdmin]);

  function logout() {
    clearToken();
    router.push("/login");
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-gray-200 bg-surface">
      <div className="border-b border-gray-200 px-4 py-5">
        <Image
          src="/images/logo/aimap-logo.png"
          alt="AIMAP"
          width={108}
          height={46}
          className="w-auto max-w-full object-contain"
          style={{ height: "auto" }}
          priority
        />
        <p className="mt-0.5 text-xs text-gray-400">
          {isAdmin ? "Quản trị hệ thống" : "Tự động hoá Marketing"}
        </p>
      </div>
      <nav className="flex-1 space-y-0.5 px-2 py-4">
        {visibleNav.map(({ href, label, icon: Icon }) => {
          const baseHref = href.split("#")[0];
          const active = pathname === baseHref || pathname.startsWith(baseHref + "/");
          return (
            <Link key={href} href={href} className={cn("sidebar-link", active ? "active" : "")}>
              <Icon size={15} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-2 pb-4">
        <button onClick={logout} className="sidebar-link w-full text-left text-gray-500">
          <LogOut size={15} />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
