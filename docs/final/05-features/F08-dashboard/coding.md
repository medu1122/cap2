# F08 — Dashboard & AI Summary: Coding Guide

---

## Backend

### `api/services/dashboard_service.py`

```python
async def get_stats(user_id: UUID, db: AsyncSession) -> DashboardStats:
    user_campaigns = select(Campaign.id).where(Campaign.user_id == user_id)

    total_campaigns = await db.scalar(
        select(func.count()).select_from(Campaign).where(Campaign.user_id == user_id)
    )
    total_content = await db.scalar(
        select(func.count()).select_from(ContentItem)
        .where(ContentItem.campaign_id.in_(user_campaigns))
    )
    pending = await db.scalar(
        select(func.count()).select_from(ContentItem)
        .where(ContentItem.campaign_id.in_(user_campaigns),
               ContentItem.status == "pending_approval")
    )
    approved = await db.scalar(
        select(func.count()).select_from(ContentItem)
        .where(ContentItem.campaign_id.in_(user_campaigns),
               ContentItem.status == "approved")
    )

    by_channel = await db.execute(
        select(ContentItem.channel, func.count().label("count"))
        .where(ContentItem.campaign_id.in_(user_campaigns))
        .group_by(ContentItem.channel)
    )

    recent_logs = await db.execute(
        select(AgentRunLog, Campaign.campaign_name)
        .join(Campaign, Campaign.id == AgentRunLog.campaign_id)
        .where(Campaign.user_id == user_id)
        .order_by(AgentRunLog.created_at.desc())
        .limit(10)
    )

    now = datetime.utcnow()
    ai_usage = await db.execute(
        select(AiUsageStat)
        .where(AiUsageStat.user_id == user_id,
               AiUsageStat.year == now.year,
               AiUsageStat.month == now.month)
    )

    return DashboardStats(
        total_campaigns=total_campaigns,
        total_content=total_content,
        pending_approvals=pending,
        approved_items=approved,
        by_channel=dict(by_channel.all()),
        recent_logs=[...],
        ai_usage=[...]
    )


async def generate_ai_summary(stats: DashboardStats) -> str:
    """Gọi Qwen để tạo weekly summary"""
    context = f"""
Thống kê marketing hiện tại:
- Tổng campaigns: {stats.total_campaigns}
- Nội dung đã tạo: {stats.total_content}
- Đang chờ duyệt: {stats.pending_approvals}
- Đã được duyệt: {stats.approved_items}
- Kênh phổ biến: {max(stats.by_channel, key=stats.by_channel.get) if stats.by_channel else 'Chưa có'}
"""
    prompt = [{"role": "user", "content":
               f"Dựa trên dữ liệu sau, hãy viết 2-3 câu tóm tắt tình hình marketing và đưa ra 1 gợi ý:\n{context}"}]

    content, _, _, _ = await qwen_client.complete(prompt)
    return content
```

---

## Frontend

```typescript
// app/(app)/dashboard/page.tsx — Server Component with streaming
import { Suspense } from 'react';

export default async function DashboardPage() {
  const stats = await apiClient.get<DashboardStats>('/dashboard/stats');

  return (
    <div className="space-y-6">
      {/* Metric Cards Row */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard title="Campaigns" value={stats.total_campaigns} />
        <MetricCard title="Nội dung" value={stats.total_content} />
        <MetricCard title="Chờ duyệt" value={stats.pending_approvals}
                    href="/approve" highlight={stats.pending_approvals > 0} />
        <MetricCard title="Đã duyệt" value={stats.approved_items} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        <ChannelDistributionChart data={stats.by_channel} />
        <RecentActivityFeed logs={stats.recent_logs} />
      </div>

      {/* AI Summary — lazy loaded */}
      <Suspense fallback={<Skeleton className="h-24" />}>
        <AiSummaryCard />
      </Suspense>
    </div>
  );
}

// AiSummaryCard fetches on client to avoid blocking page load
async function AiSummaryCard() {
  const { summary } = await apiClient.get<{summary: string}>('/dashboard/ai-summary');
  return (
    <div className="border rounded p-4 bg-gray-50">
      <h3 className="font-medium mb-2">AI Weekly Summary</h3>
      <p className="text-sm text-gray-700">{summary}</p>
    </div>
  );
}
```
