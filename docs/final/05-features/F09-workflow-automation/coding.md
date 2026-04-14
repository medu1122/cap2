# F09 — Workflow Automation: Coding Guide

---

## Schedule Trigger

### `api/routers/workflow.py`

```python
@router.post("/schedules", response_model=WorkflowScheduleOut, status_code=201)
async def create_schedule(
    body: WorkflowScheduleCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Calculate next_run_at from cron expression
    from croniter import croniter
    cron = croniter(body.cron_expression, datetime.utcnow())
    next_run = cron.get_next(datetime)

    schedule = WorkflowSchedule(
        user_id=user.id, **body.model_dump(),
        next_run_at=next_run
    )
    db.add(schedule)
    await db.commit()
    return schedule


@router.patch("/schedules/{schedule_id}/toggle")
async def toggle_schedule(schedule_id: UUID, user: User = Depends(get_current_user), db=...):
    schedule = await get_user_schedule(schedule_id, user.id, db)
    schedule.is_active = not schedule.is_active
    await db.commit()
    return {"is_active": schedule.is_active}
```

### `api/services/cron_runner.py` — Background scheduler

```python
async def check_and_run_schedules():
    """Chạy mỗi 5 phút — quét schedules cần trigger"""
    async with get_db_session() as db:
        result = await db.execute(
            select(WorkflowSchedule)
            .where(WorkflowSchedule.is_active == True,
                   WorkflowSchedule.next_run_at <= datetime.utcnow())
        )
        schedules = result.scalars().all()

        for schedule in schedules:
            await trigger_schedule(schedule, db)

async def trigger_schedule(schedule: WorkflowSchedule, db: AsyncSession):
    # Create campaign from template
    template = schedule.default_brief_template or {}
    campaign = Campaign(
        user_id=schedule.user_id,
        campaign_name=template.get("campaign_name", f"Campaign {date.today()}"),
        objective=template.get("objective", "Campaign hàng tuần tự động"),
        product_or_service=template.get("product_or_service", "Sản phẩm của tôi"),
        deadline=date.today() + timedelta(days=7),
        channels=template.get("channels", ["facebook_post"]),
        status="pending_agent"
    )
    db.add(campaign)
    await db.flush()

    job = WorkflowJob(user_id=schedule.user_id, trigger_type="schedule_trigger",
                      schedule_id=schedule.id, campaign_id=campaign.id, status="running")
    db.add(job)

    # Update next_run_at
    from croniter import croniter
    cron = croniter(schedule.cron_expression, datetime.utcnow())
    schedule.next_run_at = cron.get_next(datetime)
    schedule.last_run_at = datetime.utcnow()
    await db.commit()

    # Dispatch AI
    await agent_dispatcher.dispatch(str(campaign.id))
```

---

## CSV Upload + Auto Campaign

```python
@router.post("/files/upload")
async def upload_file(
    file: UploadFile,
    purpose: str = Form(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Validate
    if purpose == "customer_list" and file.content_type != "text/csv":
        raise HTTPException(400, "Customer list phải là file CSV")

    # Save file
    stored_path = f"uploads/{user.id}/{uuid4()}/{file.filename}"
    content = await file.read()
    # Write to disk/storage...

    file_record = FileUpload(user_id=user.id, original_filename=file.filename,
                             stored_path=stored_path, file_type="csv",
                             file_size_bytes=len(content), purpose=purpose)
    db.add(file_record)
    await db.flush()

    if purpose == "customer_list":
        # Create customer list
        customer_list = CustomerList(user_id=user.id,
                                     list_name=file.filename.replace(".csv", ""),
                                     status="processing", file_upload_id=file_record.id)
        db.add(customer_list)
        await db.flush()
        await db.commit()

        # Background: parse CSV + trigger workflow
        background_tasks.add_task(process_csv_and_trigger, str(customer_list.id), content)

    return {"file_id": str(file_record.id), "status": "uploaded"}


async def process_csv_and_trigger(list_id: str, csv_content: bytes):
    """Parse CSV, save customers, trigger email campaign"""
    import csv, io
    reader = csv.DictReader(io.StringIO(csv_content.decode("utf-8")))

    customers = []
    for row in reader:
        customers.append(Customer(
            customer_list_id=list_id,
            email=row.get("email"),
            full_name=row.get("full_name") or row.get("name"),
            phone=row.get("phone"),
            extra_fields={k: v for k, v in row.items()
                         if k not in ("email", "full_name", "name", "phone")}
        ))

    async with get_db_session() as db:
        db.add_all(customers)
        await db.execute(
            update(CustomerList).where(CustomerList.id == list_id)
            .values(status="ready", total_records=len(customers),
                    valid_records=sum(1 for c in customers if c.email))
        )

        # Auto-create email campaign
        campaign = Campaign(
            user_id=...,
            campaign_name=f"Email campaign — {date.today()}",
            objective="Gửi email tới danh sách khách hàng mới",
            channels=["email"],
            deadline=date.today() + timedelta(days=3),
            status="pending_agent"
        )
        db.add(campaign)
        await db.commit()

    await agent_dispatcher.dispatch(str(campaign.id))
```

Luu y:
- Endpoint `/files/upload` trong workflow dung cho upload CSV customer list.
- Luong anh campaign (AI generate + user upload) nam o `api/routers/campaigns.py`:
  - `POST /campaigns/{id}/image/generate`
  - `POST /campaigns/{id}/image/upload`
- Image storage cua campaign uu tien Cloudinary (`CLOUDINARY_*`), fallback local khi chua cau hinh.
