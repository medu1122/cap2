"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Mail,
  Send,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Palette,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api-client";

/* ── Types ───────────────────────────────────────────────────────────────── */

interface CustomerRow {
  ID: string | number;
  HoVaTen: string;
  SDT: string;
  Email: string;
  LanCuoiChiTra: string;
  TongSoTienDaChiTra: string;
  TongSoLanQuayLai: string;
  DichVuLanCuoiSuDung: string;
  DichVuSuDungNhieuNhat: string;
  [key: string]: unknown;
}

interface CustomerList {
  id: string;
  list_name: string;
  status: string;
}

interface CustomerTableRowsResponse {
  table: { id: string; name: string; status: string };
  rows: CustomerRow[];
}

interface BrandOption {
  id: string;
  brand_name: string;
}

interface SegmentCustomer {
  customer_name: string;
  segment: string;
}

interface AnalysisOverview {
  total_customers: number;
  total_revenue: number;
}

interface AnalysisSegmentation {
  summary: Record<string, number>;
  customers: SegmentCustomer[];
}

interface CustomerAnalysis {
  overview: AnalysisOverview;
  segmentation: AnalysisSegmentation;
}

type OutreachSegment = "churn" | "potential" | "new" | "vip";

const SEGMENT_MAP: Record<string, OutreachSegment> = {
  churn_risk: "churn",
  potential: "potential",
  new: "new",
  vip: "vip",
};

const SEGMENT_REVERSE_MAP: Record<OutreachSegment, string> = {
  churn: "churn_risk",
  potential: "potential",
  new: "new",
  vip: "vip",
};

const SEGMENT_LABELS: Record<OutreachSegment, string> = {
  churn: "Khách có khả năng rời bỏ",
  potential: "Khách tiềm năng",
  new: "Khách mới",
  vip: "Khách VIP",
};

const SEGMENT_TAB_LABELS: Record<string, string> = {
  churn: "Có khả năng rời bỏ",
  potential: "Tiềm năng",
  new: "Khách mới",
  vip: "VIP",
};

const PURPOSE_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "nhac_nhe", label: "Nhắc khách quay lại" },
  { key: "cham_soc", label: "Chăm sóc, hỏi thăm" },
  { key: "kích_hoạt", label: "Khách quay trở lại" },
  { key: "khach_moi", label: "Chào khách mới" },
];

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function parseLastPaymentDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dmy) {
    let y = Number(dmy[3]);
    if (y < 100) y += 2000;
    const d = new Date(y, Number(dmy[2]) - 1, Number(dmy[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function buildSmartVariablesFromRow(row: CustomerRow): Record<string, string> {
  const HoVaTen = String(row.HoVaTen || "").trim();
  const LanCuoiChiTra = String(row.LanCuoiChiTra || "").trim();
  return {
    HoVaTen: HoVaTen || "khách",
    name: HoVaTen || "bạn",
    phone: String(row.SDT || "").trim(),
    LanCuoiChiTra,
    days_since_last: (() => {
      const d = parseLastPaymentDate(LanCuoiChiTra);
      if (!d) return "";
      const days = Math.floor((Date.now() - d.getTime()) / 86400000);
      return String(Math.max(0, days));
    })(),
    DichVuLanCuoiSuDung: String(row.DichVuLanCuoiSuDung || "").trim(),
    DichVuSuDungNhieuNhat: String(row.DichVuSuDungNhieuNhat || "").trim(),
    TongSoLanQuayLai: String(row.TongSoLanQuayLai || "").trim(),
  };
}

/* ── Email Card ─────────────────────────────────────────────────────────── */

interface EmailItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  body: string;
  status: "pending" | "composing" | "done" | "error" | "sending" | "sent" | "failed";
  errorMsg?: string;
}

interface EmailCardProps {
  item: EmailItem;
  onSubjectChange: (id: string, val: string) => void;
  onBodyChange: (id: string, val: string) => void;
  onResend: (id: string) => void;
  onSend: (id: string) => void;
}

function EmailCard({ item, onSubjectChange, onBodyChange, onResend, onSend }: EmailCardProps) {
  const isLoading = item.status === "composing";
  const isSent = item.status === "sent";
  const isFailed = item.status === "failed";
  const isSending = item.status === "sending";
  const isError = item.status === "error";
  const canEdit = !isLoading && !isSending;

  const statusBadge = () => {
    switch (item.status) {
      case "composing":
        return (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            Đang soạn…
          </span>
        );
      case "done":
        return (
          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Đã xong
          </span>
        );
      case "sent":
        return (
          <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800">
            <Send className="h-2.5 w-2.5" />
            Đã gửi
          </span>
        );
      case "sending":
        return (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            Đang gửi…
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-800">
            <XCircle className="h-2.5 w-2.5" />
            Lỗi gửi
          </span>
        );
      case "error":
        return (
          <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-800">
            <AlertCircle className="h-2.5 w-2.5" />
            Lỗi
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            Chưa soạn
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col rounded-xl border border-amber-200 bg-white shadow-sm">
      {/* Card header */}
      <div className="flex items-center justify-between border-b border-amber-100 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate text-[13px] font-semibold text-slate-900">{item.name}</span>
          {item.email && (
            <span className="truncate text-[11px] text-slate-400">{item.email}</span>
          )}
        </div>
        {statusBadge()}
      </div>

      {/* Card body */}
      <div className="flex-1 space-y-2.5 px-4 py-3">
        {/* Subject */}
        <div>
          <label className="text-[10px] font-medium text-slate-500">Tiêu đề</label>
          <input
            type="text"
            className="mt-0.5 w-full border border-amber-200 rounded-lg bg-amber-50/30 px-3 py-1.5 text-[12px] text-slate-800 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-300 disabled:opacity-60"
            value={item.subject}
            onChange={(e) => onSubjectChange(item.id, e.target.value)}
            disabled={!canEdit}
            placeholder="Tiêu đề email…"
          />
        </div>

        {/* Body */}
        <div>
          <label className="text-[10px] font-medium text-slate-500">Nội dung</label>
          {isLoading ? (
            <div className="mt-0.5 space-y-1.5 rounded-lg border border-amber-100 bg-amber-50/40 p-3">
              <div className="h-3 w-3/4 animate-pulse rounded bg-amber-200" />
              <div className="h-3 w-full animate-pulse rounded bg-amber-200" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-amber-200" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-amber-200" />
            </div>
          ) : (
            <textarea
              className="mt-0.5 w-full min-h-[120px] resize-y rounded-lg border border-amber-200 bg-amber-50/30 px-3 py-2 text-[12px] leading-relaxed text-slate-800 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-300 disabled:opacity-60"
              value={item.body}
              onChange={(e) => onBodyChange(item.id, e.target.value)}
              disabled={!canEdit}
              placeholder="Nội dung email…"
            />
          )}
        </div>

        {/* Error */}
        {(isError || isFailed) && item.errorMsg && (
          <p className="text-[10px] text-red-600">{item.errorMsg}</p>
        )}
      </div>

      {/* Card footer */}
      <div className="flex items-center justify-end gap-2 border-t border-amber-100 px-4 py-2.5">
        <button
          type="button"
          className="flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-1.5 text-[11px] font-medium text-amber-800 transition hover:bg-amber-50 disabled:opacity-40"
          onClick={() => onResend(item.id)}
          disabled={isLoading || isSending}
        >
          <RefreshCw className="h-3 w-3" />
          Soạn lại
        </button>
        <button
          type="button"
          className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-amber-600 disabled:opacity-40"
          onClick={() => onSend(item.id)}
          disabled={isLoading || isSending || !item.body}
        >
          {isSending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Send className="h-3 w-3" />
          )}
          Gửi
        </button>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────── */

export default function OutreachSegmentPage() {
  const params = useParams();
  const router = useRouter();

  // Get segment from URL params
  const rawSegment = params?.segment as string || "churn";

  // Normalize segment
  const segment: OutreachSegment =
    SEGMENT_MAP[rawSegment] ?? SEGMENT_REVERSE_MAP[rawSegment as OutreachSegment] ? "churn" : (rawSegment as OutreachSegment);

  // Redirect invalid segment
  const validSegments = ["churn", "potential", "new", "vip"] as const;
  const isValidSegment = validSegments.includes(segment as (typeof validSegments)[number]);

  // Active list
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [activeListName, setActiveListName] = useState("");
  const [allLists, setAllLists] = useState<CustomerList[]>([]);
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [analysis, setAnalysis] = useState<CustomerAnalysis | null>(null);
  const [noAnalysis, setNoAnalysis] = useState(false);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [brandPick, setBrandPick] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("outreach_brand_pick") || "";
    }
    return "";
  });
  const [purpose, setPurpose] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("outreach_purpose") || "nhac_nhe";
    }
    return "nhac_nhe";
  });
  const [composing, setComposing] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [message, setMessage] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [listSelectorOpen, setListSelectorOpen] = useState(false);
  const sendingRef = useRef<Set<string>>(new Set());

  // Helper to clear draft for a sent email
  function clearDraftForEmail(emailId: string) {
    if (!activeListId || !segment) return;
    const key = `outreach_drafts_${activeListId}_${segment}`;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as EmailItem[];
          const filtered = parsed.filter((e) => e.id !== emailId);
          if (filtered.length > 0) {
            localStorage.setItem(key, JSON.stringify(filtered));
          } else {
            localStorage.removeItem(key);
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  // Helper to clear all drafts for current list/segment
  function clearAllDrafts() {
    if (!activeListId || !segment) return;
    const key = `outreach_drafts_${activeListId}_${segment}`;
    if (typeof window !== "undefined") {
      localStorage.removeItem(key);
    }
  }

  // Save emails to localStorage when they change
  useEffect(() => {
    if (!activeListId || !segment) return;
    const key = `outreach_drafts_${activeListId}_${segment}`;
    if (typeof window !== "undefined" && emails.length > 0) {
      localStorage.setItem(key, JSON.stringify(emails));
    }
  }, [emails, activeListId, segment]);

  // Save purpose and brand to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("outreach_purpose", purpose);
      if (brandPick) {
        localStorage.setItem("outreach_brand_pick", brandPick);
      }
    }
  }, [purpose, brandPick]);

  // Restore emails from localStorage when list/segment changes
  useEffect(() => {
    if (!activeListId || !segment) return;
    const key = `outreach_drafts_${activeListId}_${segment}`;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as EmailItem[];
          // Only restore if we have analysis data
          if (analysis && parsed.length > 0) {
            setEmails(parsed);
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }, [activeListId, segment, analysis]);

  // Clear saved emails when segment changes
  useEffect(() => {
    if (!activeListId || !segment) return;
    const key = `outreach_drafts_${activeListId}_${segment}`;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(key);
      if (!saved && emails.length > 0) {
        // Don't clear, keep drafts per segment
      }
    }
  }, [segment]);

  // Redirect invalid segment after mount
  useEffect(() => {
    if (!isValidSegment) {
      router.replace("/outreach/churn");
    }
  }, [isValidSegment, router]);

  // Load data on mount
  useEffect(() => {
    setInitialLoading(true);
    setMessage("");
    setNoAnalysis(false);
    setEmails([]);
    setAnalysis(null);

    // Get saved list ID from localStorage
    const savedListId = typeof window !== "undefined" ? localStorage.getItem("outreach_active_list_id") : null;

    Promise.all([
      api.get<CustomerList[]>("/workflow/customer-lists").catch(() => []),
      api.get<BrandOption[]>("/brands").catch(() => []),
    ]).then(([lists, brandList]) => {
      setAllLists(lists);
      setBrands(brandList);
      if (brandList.length > 0 && !brandPick) {
        setBrandPick(brandList[0].id);
      }
      if (lists.length === 0) {
        setMessage("Chưa có danh sách khách hàng nào.");
        setInitialLoading(false);
        return;
      }

      // Use saved list ID or first list
      let listToUse = lists[0];
      if (savedListId) {
        const found = lists.find((l) => l.id === savedListId);
        if (found) listToUse = found;
      }

      setActiveListId(listToUse.id);
      setActiveListName(listToUse.list_name);

      return Promise.all([
        api.get<CustomerTableRowsResponse>(`/workflow/customer-lists/${listToUse.id}/rows`),
        api
          .get<{ list_id: string; list_name: string; analysis: CustomerAnalysis }>(
            `/workflow/customer-lists/${listToUse.id}/analysis`,
          )
          .catch(() => null),
      ]);
    }).then((results) => {
      if (!results) {
        setInitialLoading(false);
        return;
      }
      const [rowsData, analysisData] = results as [
        CustomerTableRowsResponse,
        { list_id: string; list_name: string; analysis: CustomerAnalysis } | null,
      ];
      setRows(rowsData.rows);
      if (!analysisData) {
        setNoAnalysis(true);
        setInitialLoading(false);
        return;
      }
      setAnalysis(analysisData.analysis);
      setActiveListName(analysisData.list_name);
    }).catch(() => {
      setMessage("Không tải được dữ liệu.");
    }).finally(() => {
      setInitialLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Change active list
  function changeActiveList(listId: string) {
    const list = allLists.find((l) => l.id === listId);
    if (!list) return;

    // Save to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("outreach_active_list_id", listId);
    }

    setActiveListId(listId);
    setActiveListName(list.list_name);
    setInitialLoading(true);
    setEmails([]);
    setAnalysis(null);
    setNoAnalysis(false);

    Promise.all([
      api.get<CustomerTableRowsResponse>(`/workflow/customer-lists/${listId}/rows`),
      api
        .get<{ list_id: string; list_name: string; analysis: CustomerAnalysis }>(
          `/workflow/customer-lists/${listId}/analysis`,
        )
        .catch(() => null),
    ]).then((results) => {
      if (!results) return;
      const [rowsData, analysisData] = results as [
        CustomerTableRowsResponse,
        { list_id: string; list_name: string; analysis: CustomerAnalysis } | null,
      ];
      setRows(rowsData.rows);
      if (!analysisData) {
        setNoAnalysis(true);
        return;
      }
      setAnalysis(analysisData.analysis);
      setActiveListName(analysisData.list_name);
    }).catch(() => {
      setMessage("Không tải được dữ liệu.");
    }).finally(() => {
      setInitialLoading(false);
    });
  }

  // Build emails when segment/analysis/rows change
  useEffect(() => {
    // Only build when we have BOTH analysis data AND rows loaded
    if (!analysis || rows.length === 0) return;

    const segKey = SEGMENT_REVERSE_MAP[segment as OutreachSegment] ?? segment;
    const nameSet = new Set(
      (analysis.segmentation.customers || [])
        .filter((c) => c.segment === segKey)
        .map((c) => String(c.customer_name || "").trim().toLowerCase())
        .filter(Boolean),
    );

    const matched = rows.filter(
      (r) =>
        nameSet.has(String(r.HoVaTen || "").trim().toLowerCase()) &&
        (r.Email || r.SDT),
    );

    setEmails(
      matched.map((r) => ({
        id: String(r.ID ?? Math.random()),
        name: String(r.HoVaTen || "").trim() || "?",
        email: String(r.Email || "").trim(),
        phone: String(r.SDT || "").trim(),
        subject: "",
        body: "",
        status: "pending",
      })),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, analysis, rows]);

  // Compose all
  async function handleComposeAll() {
    if (!activeListId || emails.length === 0) return;
    setComposing(true);
    setMessage("");

    const segKey = SEGMENT_REVERSE_MAP[segment as OutreachSegment] ?? segment;
    const segmentCustomers = (analysis?.segmentation.customers || []).filter(
      (c) => c.segment === segKey,
    );
    const segNameSet = new Set(
      segmentCustomers.map((c) => String(c.customer_name || "").trim().toLowerCase()),
    );

    const apiCustomers = rows
      .filter(
        (r) =>
          segNameSet.has(String(r.HoVaTen || "").trim().toLowerCase()) &&
          (r.Email || r.SDT),
      )
      .map((r) => ({
        name: String(r.HoVaTen || "").trim(),
        email: String(r.Email || "").trim(),
        phone: String(r.SDT || "").trim(),
        segment: segKey,
        variables: buildSmartVariablesFromRow(r),
      }));

    if (apiCustomers.length === 0) {
      setMessage("Không có khách nào trong nhóm này có email hoặc SĐT.");
      setComposing(false);
      return;
    }

    // Mark all as composing
    setEmails((prev) => prev.map((e) => ({ ...e, status: "composing" as const })));

    try {
      const body: Record<string, unknown> = {
        segment: segKey,
        purpose,
        customers: apiCustomers,
      };
      if (brandPick) body.brand_id = brandPick;

      const res = await api.post<{ results: Array<{ name: string; email: string; subject: string; body: string }> }>(
        `/workflow/customer-lists/${activeListId}/smart-contact-batch`,
        body,
      );

      const resultsMap = new Map(
        res.results.map((r) => [r.email || r.name, r]),
      );

      setEmails((prev) =>
        prev.map((e) => {
          const matched = resultsMap.get(e.email || e.name);
          if (matched) {
            return {
              ...e,
              subject: matched.subject,
              body: matched.body,
              status: "done" as const,
            };
          }
          return { ...e, status: "error" as const, errorMsg: "Không nhận được kết quả từ server." };
        }),
      );
      setMessage("Đã soạn xong tất cả email.");
    } catch (exc) {
      setMessage(exc instanceof Error ? exc.message : "Lỗi khi soạn email.");
      setEmails((prev) => prev.map((e) => ({ ...e, status: "error" as const, errorMsg: String(exc) })));
    } finally {
      setComposing(false);
    }
  }

  // Resend / compose single
  async function handleResend(id: string) {
    if (!activeListId) return;
    const email = emails.find((e) => e.id === id);
    if (!email) return;

    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, status: "composing" as const, errorMsg: undefined } : e)));

    const segKey = SEGMENT_REVERSE_MAP[segment as OutreachSegment] ?? segment;
    const row = rows.find((r) => String(r.ID ?? r.HoVaTen) === email.name || r.HoVaTen === email.name);
    const apiCustomers = row
      ? [
          {
            name: String(row.HoVaTen || "").trim(),
            email: String(row.Email || "").trim(),
            phone: String(row.SDT || "").trim(),
            segment: segKey,
            variables: buildSmartVariablesFromRow(row),
          },
        ]
      : [];

    try {
      const body: Record<string, unknown> = {
        segment: segKey,
        purpose,
        customers: apiCustomers.length ? apiCustomers : [{ name: email.name, email: email.email, phone: email.phone, segment: segKey, variables: {} }],
      };
      if (brandPick) body.brand_id = brandPick;

      const res = await api.post<{ results: Array<{ name: string; email: string; subject: string; body: string }> }>(
        `/workflow/customer-lists/${activeListId}/smart-contact-batch`,
        body,
      );
      const matched = res.results.find(
        (r) => (r.email || "").toLowerCase() === email.email.toLowerCase() || r.name === email.name,
      ) ?? res.results[0];

      setEmails((prev) =>
        prev.map((e) =>
          e.id === id && matched
            ? { ...e, subject: matched.subject, body: matched.body, status: "done" as const }
            : e,
        ),
      );
    } catch (exc) {
      setEmails((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, status: "error" as const, errorMsg: String(exc) } : e,
        ),
      );
    }
  }

  // Send single
  async function handleSend(id: string) {
    if (!activeListId) {
      setMessage("Vui lòng chọn danh sách khách hàng.");
      return;
    }
    if (noAnalysis) {
      setMessage("Chưa có kết quả phân tích. Vui lòng chạy phân tích trong mục Danh sách khách hàng.");
      return;
    }
    const email = emails.find((e) => e.id === id);
    if (!email || !email.body) {
      setMessage("Email chưa được soạn. Vui lòng bấm 'Soạn tất cả' trước.");
      return;
    }

    sendingRef.current.add(id);
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, status: "sending" as const } : e)));

    try {
      await api.post(`/workflow/customer-lists/${activeListId}/smart-contact-batch-send`, {
        items: [{ name: email.name, email: email.email, phone: email.phone, subject: email.subject, body: email.body }],
      });
      setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, status: "sent" as const } : e)));
      setMessage(`Đã gửi email cho ${email.name}.`);
      clearDraftForEmail(id);
    } catch (exc: unknown) {
      let errorMsg = "Lỗi gửi";
      if (exc && typeof exc === "object" && "message" in exc) {
        errorMsg = String((exc as { message: unknown }).message);
      } else if (exc instanceof Error) {
        errorMsg = exc.message;
      }
      // Make error message more user-friendly
      if (errorMsg.includes("SMTP") || errorMsg.includes("503")) {
        errorMsg = "Chưa cấu hình SMTP. Vui lòng kiểm tra cài đặt email.";
      }
      setEmails((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, status: "failed" as const, errorMsg } : e,
        ),
      );
      setMessage(`Lỗi: ${errorMsg}`);
    } finally {
      sendingRef.current.delete(id);
    }
  }

  // Send all
  async function handleSendAll() {
    if (!activeListId) return;
    const toSend = emails.filter((e) => e.body && e.status !== "sent" && e.status !== "sending");
    if (toSend.length === 0) return;

    setSendingAll(true);
    const results: Array<{ name: string; email: string; status: string; error?: string; id?: string }> = [];
    const sentIds: string[] = [];

    for (const email of toSend) {
      sendingRef.current.add(email.id);
      setEmails((prev) => prev.map((e) => (e.id === email.id ? { ...e, status: "sending" as const } : e)));
      try {
        await api.post(`/workflow/customer-lists/${activeListId}/smart-contact-batch-send`, {
          items: [{ name: email.name, email: email.email, phone: email.phone, subject: email.subject, body: email.body }],
        });
        setEmails((prev) => prev.map((e) => (e.id === email.id ? { ...e, status: "sent" as const } : e)));
        results.push({ name: email.name, email: email.email, status: "sent", id: email.id });
        sentIds.push(email.id);
      } catch (exc: unknown) {
        let errorMsg = "Lỗi gửi";
        if (exc && typeof exc === "object" && "message" in exc) {
          errorMsg = String((exc as { message: unknown }).message);
        } else if (exc instanceof Error) {
          errorMsg = exc.message;
        }
        if (errorMsg.includes("SMTP") || errorMsg.includes("503")) {
          errorMsg = "Chưa cấu hình SMTP";
        }
        setEmails((prev) =>
          prev.map((e) =>
            e.id === email.id ? { ...e, status: "failed" as const, errorMsg } : e,
          ),
        );
        results.push({ name: email.name, email: email.email, status: "failed", error: errorMsg, id: email.id });
      } finally {
        sendingRef.current.delete(email.id);
      }
    }

    // Clear drafts for successfully sent emails
    for (const id of sentIds) {
      clearDraftForEmail(id);
    }

    setSendingAll(false);
    const sent = results.filter((r) => r.status === "sent").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const smtpError = results.find((r) => r.error?.includes("SMTP"));
    if (smtpError) {
      setMessage(`Lỗi SMTP: ${smtpError.error}. Vui lòng kiểm tra cài đặt email trong .env`);
    } else {
      setMessage(`Đã gửi: ${sent} thành công, ${failed} thất bại.`);
    }
  }

  // Update email field
  function updateEmail(id: string, field: "subject" | "body", val: string) {
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: val } : e)));
  }

  const doneCount = emails.filter((e) => e.body && e.status !== "pending" && e.status !== "composing").length;
  const sentCount = emails.filter((e) => e.status === "sent").length;
  const segKey = SEGMENT_REVERSE_MAP[segment as OutreachSegment] ?? segment;
  const segCount = (analysis?.segmentation.summary ?? {})[segKey] ?? 0;

  if (!isValidSegment) return null;

  return (
    <div className="flex min-h-screen flex-col bg-amber-50">
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 border-b border-amber-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Send className="h-[18px] w-[18px]" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-slate-900">Chiến dịch Outreach</h1>
              <p className="text-[11px] text-slate-500">{SEGMENT_LABELS[segment as OutreachSegment] ?? segment}</p>
            </div>
          </div>
          {message && (
            <p className="max-w-xs truncate rounded-lg bg-amber-100 px-3 py-1.5 text-[11px] font-medium text-amber-900">
              {message}
            </p>
          )}
        </div>

        {/* Segment tabs */}
        <div className="flex gap-1 px-6 pb-3">
          {validSegments.map((seg) => (
            <button
              key={seg}
              type="button"
              onClick={() => router.push(`/outreach/${seg}`)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
                seg === segment
                  ? "bg-amber-400 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-amber-50 border border-amber-200"
              }`}
            >
              {SEGMENT_TAB_LABELS[seg]}
              {(analysis?.segmentation.summary ?? {})[SEGMENT_REVERSE_MAP[seg] ?? seg] != null && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                  seg === segment ? "bg-white/30 text-white" : "bg-amber-100 text-amber-800"
                }`}>
                  {(analysis?.segmentation.summary ?? {})[SEGMENT_REVERSE_MAP[seg] ?? seg] ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* ── Toolbar ── */}
      <div className="border-b border-amber-200 bg-white px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Customer List */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-slate-500">Danh sách:</span>
            <select
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[12px] text-slate-700 outline-none focus:border-amber-400"
              value={activeListId || ""}
              onChange={(e) => changeActiveList(e.target.value)}
            >
              {allLists.length === 0 && <option value="">Chưa có danh sách</option>}
              {allLists.map((l) => (
                <option key={l.id} value={l.id}>{l.list_name}</option>
              ))}
            </select>
          </div>

          {/* Brand */}
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-emerald-600" />
            <select
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[12px] text-slate-700 outline-none focus:border-amber-400"
              value={brandPick}
              onChange={(e) => setBrandPick(e.target.value)}
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.brand_name}</option>
              ))}
            </select>
          </div>

          {/* Purpose */}
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-600" />
            <select
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[12px] text-slate-700 outline-none focus:border-amber-400"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            >
              {PURPOSE_OPTIONS.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="flex-1" />

          {/* Stats */}
          {emails.length > 0 && (
            <span className="text-[12px] text-slate-500">
              {doneCount}/{emails.length} email đã soạn
              {sentCount > 0 && ` · ${sentCount} đã gửi`}
            </span>
          )}

          {/* Compose all */}
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-50"
            disabled={composing || sendingAll || emails.length === 0 || noAnalysis}
            onClick={() => void handleComposeAll()}
          >
            {composing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Soạn tất cả
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-auto px-6 py-5">
        {initialLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-amber-400" />
            <p className="text-[13px]">Đang tải dữ liệu…</p>
          </div>
        ) : noAnalysis ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-amber-200 bg-white py-20 text-center">
            <AlertCircle className="mb-3 h-10 w-10 text-amber-400" />
            <h2 className="mb-1 text-[15px] font-semibold text-slate-800">Chưa có dữ liệu phân tích</h2>
            <p className="mb-4 max-w-sm text-[13px] text-slate-500">
              Vui lòng chạy phân tích trong mục{" "}
              <span className="font-medium text-slate-700">Danh sách khách hàng</span> trước để hiển thị danh sách khách theo nhóm.
            </p>
            <button
              type="button"
              className="rounded-lg bg-amber-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-amber-600"
              onClick={() => router.push("/customer-lists")}
            >
              Đi đến Danh sách khách hàng
            </button>
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-amber-200 bg-white py-20 text-center">
            <Mail className="mb-3 h-10 w-10 text-slate-300" />
            {segCount > 0 ? (
              <>
                <p className="text-[14px] text-slate-500">
                  Có <strong>{segCount}</strong> khách trong nhóm{" "}
                  <span className="font-medium text-slate-700">{SEGMENT_LABELS[segment as OutreachSegment] ?? segment}</span>{" "}
                  nhưng chưa có email hoặc SĐT trong danh sách.
                </p>
                <p className="mt-2 text-[12px] text-slate-400">
                  Kiểm tra dữ liệu trong mục "Danh sách khách hàng" để thêm thông tin liên hệ.
                </p>
              </>
            ) : (
              <>
                <p className="text-[14px] text-slate-500">
                  Chưa có khách nào trong nhóm{" "}
                  <span className="font-medium text-slate-700">{SEGMENT_LABELS[segment as OutreachSegment] ?? segment}</span>.
                </p>
                <p className="mt-2 text-[12px] text-slate-400">
                  Vui lòng chạy phân tích trong mục "Danh sách khách hàng" trước.
                </p>
              </>
            )}
            <button
              type="button"
              className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-amber-600"
              onClick={() => router.push("/customer-lists")}
            >
              Đi đến Danh sách khách hàng
            </button>
          </div>
        ) : (
          <div className="grid auto-rows-max gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {emails.map((email) => (
              <EmailCard
                key={email.id}
                item={email}
                onSubjectChange={(id, val) => updateEmail(id, "subject", val)}
                onBodyChange={(id, val) => updateEmail(id, "body", val)}
                onResend={handleResend}
                onSend={handleSend}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── SMS Placeholder ── */}
      {!initialLoading && !noAnalysis && emails.length > 0 && (
        <div className="border-t border-amber-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
            <MessageSquare className="h-5 w-5 shrink-0 text-slate-400" />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-500">Kênh SMS</p>
              <p className="text-[11px] text-slate-400">Tính năng gửi SMS đang được phát triển.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      {emails.length > 0 && !noAnalysis && (
        <footer className="border-t border-amber-200 bg-white px-6 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-slate-500">
              {sentCount}/{emails.length} email đã gửi
            </span>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-50"
              disabled={
                sendingAll ||
                emails.filter((e) => e.body && e.status !== "sent" && e.status !== "sending").length === 0
              }
              onClick={() => void handleSendAll()}
            >
              {sendingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Gửi tất cả email
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
