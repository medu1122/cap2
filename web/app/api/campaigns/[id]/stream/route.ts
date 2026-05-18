import { NextRequest } from "next/server";

const INTERNAL_API_BASE = process.env.NEXT_PUBLIC_INTERNAL_API_URL || "http://api:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return new Response("data: {\"type\":\"error\",\"detail\":\"Missing token\"}\n\n", {
      status: 401,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  }

  const internalUrl = `${INTERNAL_API_BASE}/internal/campaigns/${params.id}/stream?token=${encodeURIComponent(token)}`;

  try {
    const response = await fetch(internalUrl, {
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-store",
      },
    });

    if (!response.ok) {
      return new Response(`data: {"type":"error","detail":"Upstream error"}\n\n`, {
        status: response.status,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    const stream = response.body;
    if (!stream) {
      return new Response(`data: {"type":"error","detail":"No stream"}\n\n`, {
        status: 500,
        headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      });
    }

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return new Response(`data: {"type":"error","detail":"Proxy error"}\n\n`, {
      status: 500,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
    });
  }
}
