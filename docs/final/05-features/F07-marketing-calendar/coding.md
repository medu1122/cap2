# F07 — Marketing Calendar: Coding Guide

---

## Backend

```python
@router.get("", response_model=list[CalendarItemOut])
async def get_calendar(
    month: int = Query(ge=1, le=12),
    year: int = Query(ge=2024, le=2030),
    channel: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from calendar import monthrange
    _, last_day = monthrange(year, month)
    start = date(year, month, 1)
    end = date(year, month, last_day)

    # Subquery: latest version per (campaign_id, channel)
    latest_version = (
        select(func.max(ContentItem.version))
        .where(ContentItem.campaign_id == ContentItem.campaign_id,
               ContentItem.channel == ContentItem.channel)
        .correlate(ContentItem)
        .scalar_subquery()
    )

    query = (
        select(ContentItem, Campaign.campaign_name)
        .join(Campaign, Campaign.id == ContentItem.campaign_id)
        .where(
            Campaign.user_id == user.id,
            ContentItem.scheduled_date >= start,
            ContentItem.scheduled_date <= end,
            ContentItem.version == latest_version
        )
    )
    if channel:
        query = query.where(ContentItem.channel == channel)

    query = query.order_by(ContentItem.scheduled_date, ContentItem.channel)
    result = await db.execute(query)
    return [CalendarItemOut.from_row(row) for row in result.all()]


@router.patch("/{content_id}/schedule-date", response_model=ContentItemOut)
async def update_schedule_date(
    content_id: UUID,
    body: ScheduleDateUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    item = await get_user_content(content_id, user.id, db)
    item.scheduled_date = body.scheduled_date
    item.updated_at = datetime.utcnow()
    await db.commit()
    return item
```

---

## Frontend: Calendar Component

```typescript
'use client';
function CalendarPage() {
  const [year, month] = [currentYear, currentMonth];
  const [selected, setSelected] = useState<Date | null>(null);
  const { data: items } = useCalendarItems(year, month);

  const itemsByDate = useMemo(() => {
    return items?.reduce((acc, item) => {
      const key = item.scheduled_date;
      acc[key] = [...(acc[key] || []), item];
      return acc;
    }, {} as Record<string, CalendarItem[]>);
  }, [items]);

  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <MonthGrid year={year} month={month}
                   renderDay={(date) => (
                     <DayCell date={date} items={itemsByDate?.[formatDate(date)] || []}
                              onClick={() => setSelected(date)} />
                   )} />
      </div>

      {selected && (
        <div className="w-80 border-l p-4">
          <h3>{format(selected, 'dd/MM/yyyy')}</h3>
          {(itemsByDate?.[formatDate(selected)] || []).map(item => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function DayCell({ date, items, onClick }: DayCellProps) {
  const CHANNEL_COLORS = {
    facebook_post: 'bg-blue-500',
    email: 'bg-yellow-500',
    video_script: 'bg-red-500',
  };

  return (
    <div onClick={onClick} className="min-h-16 p-1 cursor-pointer hover:bg-gray-50">
      <span className="text-sm">{getDate(date)}</span>
      <div className="flex flex-wrap gap-0.5 mt-1">
        {items.map(item => (
          <span key={item.id}
                className={`w-2 h-2 rounded-full ${CHANNEL_COLORS[item.channel]}
                           ${item.status !== 'approved' ? 'opacity-50' : ''}`} />
        ))}
      </div>
    </div>
  );
}
```
