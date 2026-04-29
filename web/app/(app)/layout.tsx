import Sidebar from "@/components/layout/Sidebar";
import AuthGuard from "@/components/layout/AuthGuard";
import CampaignAssistantButton from "@/components/campaign-assistant/CampaignAssistantButton";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-white">
        <Sidebar />
        <main className="ml-60 min-h-screen overflow-auto">
          {children}
        </main>
        <CampaignAssistantButton />
      </div>
    </AuthGuard>
  );
}
