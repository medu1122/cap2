import Sidebar from "@/components/layout/Sidebar";
import AuthGuard from "@/components/layout/AuthGuard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-white">
        <Sidebar />
        <main className="ml-60 min-h-screen overflow-auto">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
