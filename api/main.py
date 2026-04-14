from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, brands, campaigns, content, calendar, dashboard, workflow, internal

app = FastAPI(title="AIMAP API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(brands.router, prefix="/brands", tags=["brands"])
app.include_router(campaigns.router, prefix="/campaigns", tags=["campaigns"])
app.include_router(content.router, prefix="/content", tags=["content"])
app.include_router(calendar.router, prefix="/calendar", tags=["calendar"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
app.include_router(workflow.router, prefix="/workflow", tags=["workflow"])
app.include_router(internal.router, prefix="/internal", tags=["internal"])


@app.get("/health")
async def health():
    return {"status": "ok"}
