"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Megaphone, CalendarDays, Shield, CheckSquare, LogOut } from "lucide-react";
import { clearToken } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/brand-vault", label: "Brand Vault", icon: Shield },
  { href: "/approve", label: "Approve", icon: CheckSquare },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    clearToken();
    router.push("/login");
  }

  return (
    <aside className="w-60 shrink-0 flex flex-col border-r border-gray-200 bg-surface min-h-screen">
      <div className="px-4 py-5 border-b border-gray-200">
        <span className="text-base font-semibold text-gray-900 tracking-tight">AIMAP</span>
        <p className="text-xs text-gray-400 mt-0.5">Marketing Automation</p>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "sidebar-link",
              pathname === href || pathname.startsWith(href + "/") ? "active" : ""
            )}
          >
            <Icon size={15} />
            {label}
          </Link>
        ))}
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
