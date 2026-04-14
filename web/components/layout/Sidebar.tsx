"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Megaphone, CalendarDays, Workflow, Users, LogOut, BrainCircuit } from "lucide-react";
import { clearToken } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard",   label: "Tổng quan",          icon: LayoutDashboard },
  { href: "/campaigns",   label: "Chiến dịch",          icon: Megaphone },
  { href: "/calendar",    label: "Lịch marketing",      icon: CalendarDays },
  { href: "/workflow",    label: "Tự động hoá",         icon: Workflow },
  { href: "/customer-lists", label: "Danh sách khách",  icon: Users },
  { href: "/insights", label: "Trợ lý phân tích", icon: BrainCircuit },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    clearToken();
    router.push("/login");
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-20 w-60 flex flex-col border-r border-gray-200 bg-surface">
      <div className="px-4 py-5 border-b border-gray-200">
        <Image
          src="/images/logo/aimap-logo.png"
          alt="AIMAP"
          width={108}
          height={46}
          className="h-auto w-[108px]"
          priority
        />
        <p className="text-xs text-gray-400 mt-0.5">Tự động hoá Marketing</p>
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
