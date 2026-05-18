"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Crown,
  Eraser,
  Filter,
  Loader2,
  Mail,
  Megaphone,
  MessageSquare,
  Palette,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  StarOff,
  TrendingUp,
  Type,
  UserPlus,
  X,
} from "lucide-react";
import HelpDialogButton from "@/components/common/HelpDialogButton";
import { api } from "@/lib/api-client";

type Segment = "vip" | "potential" | "inactive" | "unknown";

interface CustomerList {
  id: string;
  list_name: string;
  status: string;
  total_records: number;
  valid_records: number;
  invalid_records: number;
  segment_summary?: Partial<Record<Segment, number>>;
}

interface CustomerTableRowsResponse {
  table: { id: string; name: string; status: string };
  rows: Record<string, string | number>[];
}

interface CustomerAnalysisResponse {
  list_id: string;
  list_name: string;
  analysis: {
    overview: {
      total_customers: number;
      total_revenue: number;
      /** Tỷ lệ khách có lần chi trả cuối trong vòng 30 ngày (không dùng repeat count). */
      recent_activity_30d_percent?: number;
      customers_active_in_last_30d?: number;
      /** @deprecated Phân tích cũ — ưu tiên recent_activity_30d_percent */
      retention_rate_percent?: number;
    };
    customer_value: {
      total_revenue: number;
      top_20_percent_count: number;
      revenue_share_of_top_group: number;
      top_spenders: Array<{ customer_name: string; amount: number; email?: string; phone?: string }>;
    };
    retention: {
      total_customers: number;
      returning_customers: number;
      new_customers: number;
      recent_activity_30d_percent?: number;
      customers_active_in_last_30d?: number;
      repeat_customer_rate_percent?: number;
      retention_rate_percent?: number;
      top_returning_customers: Array<{ customer_name: string; return_count: number }>;
    };
    churn_risk: {
      inactive_over_30_days: number;
      inactive_over_60_days: number;
      inactive_day_buckets?: Array<{ key: string; label: string; count: number }>;
      high_risk_customers: Array<{ customer_name: string; days_since_last_payment: number; email?: string; phone?: string }>;
      medium_risk_customers: Array<{ customer_name: string; days_since_last_payment: number; email?: string; phone?: string }>;
    };
    segmentation: {
      summary: { vip: number; potential: number; churn_risk: number; new: number };
      /** Doanh thu gom theo cột Loại khách hàng (dữ liệu gốc). */
      revenue_by_customer_type?: Array<{ label: string; count: number; revenue: number }>;
      /** Giá trị trung bình / khách theo nhóm phân tích (AI/rule). */
      arpu_by_segment?: { vip: number; potential: number; churn_risk: number; new: number };
      customers: Array<{ customer_name: string; segment: string }>;
    };
    suggested_actions: Array<{
      title: string;
      priority: string;
      target_segment: string;
      goal: string;
      reason?: string;
      expected_impact: string;
      recommended_channels: string[];
    }>;
    narrative?: string;
    ai_meta?: { model_used?: string; fallback_used?: boolean };
  };
}

interface BrandOption {
  id: string;
  brand_name: string;
}

interface PriorityCustomer {
  customer_id: string;
  customer_name: string;
  email?: string | null;
  phone?: string | null;
}

const TEMPLATE_COLUMNS = [
  "HoVaTen",
  "Tuoi",
  "SDT",
  "Email",
  "LinkFB",
  "LanCuoiChiTra",
  "TongSoTienDaChiTra",
  "TongSoLanQuayLai",
  "LoaiKhachHang",
  "DichVuLanCuoiSuDung",
  "DichVuSuDungNhieuNhat",
] as const;

const REQUIRED_IMPORT_COLUMNS = ["HoVaTen", "SDT"] as const;
const PRIMARY_COLUMNS = [
  { key: "HoVaTen", label: "Họ và tên" },
  { key: "SDT", label: "SĐT" },
  { key: "LoaiKhachHang", label: "Loại khách hàng" },
  { key: "LanCuoiChiTra", label: "Lần cuối chi trả" },
  { key: "TongSoTienDaChiTra", label: "Tổng số tiền đã chi trả" },
] as const;
const COLUMN_LABELS: Record<string, string> = {
  HoVaTen: "Họ và tên",
  Tuoi: "Tuổi",
  SDT: "SĐT",
  Email: "Email",
  LinkFB: "Link Facebook",
  LanCuoiChiTra: "Lần cuối chi trả",
  TongSoTienDaChiTra: "Tổng số tiền đã chi trả",
  TongSoLanQuayLai: "Tổng số lần quay lại",
  LoaiKhachHang: "Loại khách hàng",
  DichVuLanCuoiSuDung: "Dịch vụ lần cuối sử dụng",
  DichVuSuDungNhieuNhat: "Dịch vụ sử dụng nhiều nhất",
};

const SEGMENT_FRIENDLY: Record<string, string> = {
  churn_risk: "Khả năng rời bỏ",
  vip: "VIP",
  potential: "Tiềm năng",
  new: "Khách mới",
  unknown: "Chưa phân loại",
};

const PRIORITY_FRIENDLY: Record<string, string> = {
  high: "Ưu tiên cao",
  medium: "Ưu tiên vừa",
  low: "Ưu tiên thấp",
};

function formatMoneyVi(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number.isFinite(n) ? n : 0);
}

function formatArpuVi(n: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1, minimumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0,
  );
}

/** Một dòng = một ý — không lặp, không đoạn văn giải thích. */
function buildAnalysisInsightBullets(analysis: CustomerAnalysisResponse["analysis"]): string[] {
  const s = analysis.segmentation.summary;
  const inactive30 = analysis.churn_risk.inactive_over_30_days;
  const inactive60 = analysis.churn_risk.inactive_over_60_days;
  const lines: string[] = [];
  if (inactive30 > 0) {
    const suffix = inactive60 > 0 ? ` (${inactive60} khách >60 ngày)` : "";
    lines.push(`⚠️ ${inactive30} khách >30 ngày không quay lại${suffix}`);
  }
  if (s.churn_risk > 0) {
    lines.push(`🔥 ${s.churn_risk} khách có khả năng rời bỏ`);
  }
  if (s.vip > 0) {
    lines.push(`💰 ${s.vip} khách VIP giá trị cao`);
  }
  if (lines.length < 3 && s.potential > 0) {
    lines.push(`📈 ${s.potential} khách tiềm năng`);
  }
  if (lines.length < 3 && s.new > 0) {
    lines.push(`🌱 ${s.new} khách mới`);
  }
  return lines.slice(0, 3);
}

/** KPI hoạt động 30 ngày — không dùng “giữ chân %” từ repeat count. */
function recentActivityKpiCopy(
  recentPct: number,
  inactiveOver30: number,
  total: number,
): { main: string; sub: string } {
  if (total <= 0) return { main: "Chưa có khách để tính", sub: "" };
  if (inactiveOver30 > 0) {
    return {
      main: `⚠️ ${inactiveOver30} khách >30 ngày không quay lại`,
      sub: `${recentPct}% khách còn phát sinh trong 30 ngày (theo ngày chi trả cuối).`,
    };
  }
  if (recentPct >= 60) {
    return {
      main: `👍 ${recentPct}% khách có phát sinh trong 30 ngày gần đây`,
      sub: "Đa số vẫn còn tương tác gần.",
    };
  }
  if (recentPct >= 35) {
    return {
      main: `Hoạt động 30 ngày: ${recentPct}%`,
      sub: "Còn dư địa để kéo khách quay lại.",
    };
  }
  return {
    main: `📉 Hoạt động 30 ngày thấp (${recentPct}%)`,
    sub: "Nhiều khách lâu không phát sinh.",
  };
}

const OUTREACH_TEMPLATES = {
  nhac_nhe:
    "Chào {{HoVaTen}}, lâu rồi bạn chưa quay lại\nKhông biết bạn còn nhu cầu {{DichVuSuDungNhieuNhat}} không?",
  cham_soc:
    "Chào {{HoVaTen}}, lần gần nhất bạn sử dụng {{DichVuLanCuoiSuDung}}, không biết trải nghiệm có ổn không?",
  kich_hoat:
    "Chào {{HoVaTen}}, bên mình vừa cập nhật một số cải tiến mới — bạn có thể ghé lại trải nghiệm thử.",
  khach_moi: "Chào {{HoVaTen}}, cảm ơn bạn đã sử dụng dịch vụ.\nBên mình sẵn sàng hỗ trợ nếu bạn cần.",
} as const;

type OutreachAiPurposeKey = keyof typeof OUTREACH_TEMPLATES;

const OUTREACH_AI_INSTRUCTION: Record<OutreachAiPurposeKey, string> = {
  nhac_nhe:
    "Mục đích: nhắc khách đã lâu chưa quay lại — nhẹ nhàng, không gây áp lực; thể hiện đúng loại hình & giọng trong hồ sơ thương hiệu; không nhắc khuyến mãi trừ khi bản nháp đã có.",
  cham_soc:
    "Mục đích: hỏi thăm trải nghiệm lần gần nhất, đúng ngữ cảnh dịch vụ trong hồ sơ thương hiệu, quan tâm chân thành.",
  kich_hoat:
    "Mục đích: mời khách ghé lại có lý do (cập nhật / trải nghiệm) gắn với giá trị thương hiệu, không hứa giá hay ưu đãi.",
  khach_moi:
    "Mục đích: chào khách mới, giọng và cách nhắc phù hợp Brand Vault — ngắn, rõ.",
};

const REFINE_DRAFT_INSTRUCTION =
  "Mục đích: hoàn thiện bản nháp — súc tích, đúng giọng hồ sơ thương hiệu; dùng biến {{HoVaTen}}, {{days_since_last}}, {{DichVuLanCuoiSuDung}}, v.v. khi hợp lệ với dữ liệu khách; không thêm khuyến mãi nếu bản nháp không có.";

function parseLastPaymentDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dmy) {
    let y = Number(dmy[3]);
    if (y < 100) y += 2000;
    const d = new Date(y, Number(dmy[2]) - 1, Number(dmy[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t);
  return null;
}

function daysSinceLastFromRow(lanCuoi: string): string {
  const d = parseLastPaymentDate(lanCuoi);
  if (!d) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  return String(Math.max(0, days));
}

function buildSmartVariablesFromRow(row: Record<string, string>): Record<string, string> {
  const HoVaTen = String(row.HoVaTen || "").trim();
  const LanCuoiChiTra = String(row.LanCuoiChiTra || "").trim();
  return {
    HoVaTen: HoVaTen || "khách",
    name: HoVaTen || "bạn",
    phone: String(row.SDT || "").trim(),
    LanCuoiChiTra,
    days_since_last: daysSinceLastFromRow(LanCuoiChiTra),
    DichVuLanCuoiSuDung: String(row.DichVuLanCuoiSuDung || "").trim(),
    DichVuSuDungNhieuNhat: String(row.DichVuSuDungNhieuNhat || "").trim(),
    TongSoLanQuayLai: String(row.TongSoLanQuayLai || "").trim(),
  };
}

type QuickOutreachRecipientRow = {
  name: string;
  email: string;
  phone: string;
  variables: Record<string, string>;
};

function buildRecipientsDataContextForAi(list: QuickOutreachRecipientRow[]): string {
  const max = 20;
  const chunks: string[] = [];
  for (let i = 0; i < Math.min(list.length, max); i++) {
    const r = list[i];
    const v = r.variables;
    const lines: string[] = [`Khách ${i + 1}: ${v.HoVaTen || r.name || "—"}`];
    const phone = (v.phone || r.phone || "").trim();
    if (phone) lines.push(`  SĐT: ${phone}`);
    const em = (r.email || "").trim();
    if (em) lines.push(`  Email: ${em}`);
    if (v.days_since_last) lines.push(`  Ngày chưa quay lại: ${v.days_since_last}`);
    if (v.LanCuoiChiTra) lines.push(`  Lần cuối chi trả: ${v.LanCuoiChiTra}`);
    if (v.DichVuLanCuoiSuDung) lines.push(`  Dịch vụ lần cuối: ${v.DichVuLanCuoiSuDung}`);
    if (v.DichVuSuDungNhieuNhat) lines.push(`  Dịch vụ hay dùng: ${v.DichVuSuDungNhieuNhat}`);
    if (v.TongSoLanQuayLai) lines.push(`  Số lần quay lại: ${v.TongSoLanQuayLai}`);
    chunks.push(lines.join("\n"));
  }
  if (list.length > max) {
    chunks.push(
      `… Còn ${list.length - max} khách khác (cùng nội dung khung, hệ thống thay biến theo từng người khi gửi).`,
    );
  }
  return chunks.join("\n\n");
}

function revenueStatement(total: number): string {
  if (total <= 0) return "💰 Chưa ghi nhận doanh thu tích lũy";
  return `💰 Doanh thu tích lũy khoảng ${formatMoneyVi(total)}`;
}

function getCampaignActionForSegment(
  segmentId: "vip" | "potential" | "churn_risk" | "new",
  suggested: CustomerAnalysisResponse["analysis"]["suggested_actions"],
): {
  title: string;
  target_segment: string;
  priority: string;
  goal?: string;
  expected_impact?: string;
  recommended_channels?: string[];
} {
  const hit = suggested.find((a) => a.target_segment === segmentId);
  if (hit) {
    return {
      title: hit.title,
      target_segment: hit.target_segment,
      priority: hit.priority,
      goal: hit.goal,
      expected_impact: hit.expected_impact,
      recommended_channels: hit.recommended_channels,
    };
  }
  const fallbacks: Record<
    typeof segmentId,
    {
      title: string;
      target_segment: string;
      priority: string;
      goal: string;
      expected_impact: string;
      recommended_channels: string[];
    }
  > = {
    churn_risk: {
      title: "Kích hoạt lại nhóm có khả năng rời bỏ cao",
      target_segment: "churn_risk",
      priority: "high",
      goal: "Kéo khách quay lại trong 7 ngày tới.",
      expected_impact: "Giảm rời bỏ, tăng lượt quay lại",
      recommended_channels: ["email"],
    },
    vip: {
      title: "Chăm sóc & upsell VIP",
      target_segment: "vip",
      priority: "medium",
      goal: "Giữ chân và tăng giá trị mỗi khách VIP.",
      expected_impact: "Tăng doanh thu trên khách hiện hữu",
      recommended_channels: ["email"],
    },
    potential: {
      title: "Phát triển nhóm tiềm năng",
      target_segment: "potential",
      priority: "medium",
      goal: "Chuyển khách tiềm năng thành khách trung thành hơn.",
      expected_impact: "Tăng tần suất quay lại",
      recommended_channels: ["facebook_post", "email"],
    },
    new: {
      title: "Onboarding khách mới",
      target_segment: "new",
      priority: "medium",
      goal: "Giúp khách mới quay lại lần hai.",
      expected_impact: "Tăng tỷ lệ mua lặp",
      recommended_channels: ["email", "facebook_post"],
    },
  };
  return fallbacks[segmentId];
}

const SEGMENT_CARD_COPY: Record<string, string> = {
  vip: "Khách giá trị cao",
  potential: "Còn dư địa tăng trưởng",
  churn_risk: "Đã lâu chưa quay lại",
  new: "Mới phát sinh — cần giữ chân",
};

const SEGMENT_CARD_ACTION_HINT: Record<string, string> = {
  vip: "→ Nên chăm sóc riêng và upsell có chừng mực.",
  potential: "→ Có thể đẩy mạnh bằng ưu đãi hoặc nội dung phù hợp.",
  churn_risk: "→ Nên kích hoạt lại sớm trước khi mất hẳn.",
  new: "→ Chuỗi onboarding giúp tạo thói quen quay lại.",
};

const SEGMENT_CARD_STYLE: Record<string, string> = {
  vip: "border-violet-300 bg-violet-50/50",
  potential: "border-sky-300 bg-sky-50/50",
  churn_risk: "border-red-400 bg-red-50/70",
  new: "border-emerald-300 bg-emerald-50/50",
};

type AnalysisSegmentId = "vip" | "potential" | "churn_risk" | "new";

const SEGMENT_TILE_ICON: Record<string, typeof Crown> = {
  vip: Crown,
  potential: TrendingUp,
  churn_risk: AlertTriangle,
  new: UserPlus,
};

function pickSuggestedActionForSegment(
  segmentId: AnalysisSegmentId,
  actions: CustomerAnalysisResponse["analysis"]["suggested_actions"],
) {
  return actions.find((a) => a.target_segment === segmentId) ?? null;
}

const RAW_TYPE_CHART_COLORS = ["#7c3aed", "#0ea5e9", "#22c55e", "#f97316", "#ef4444", "#a855f7", "#64748b"];

function emptyRow(): Record<string, string> {
  return Object.fromEntries(TEMPLATE_COLUMNS.map((c) => [c, ""])) as Record<string, string>;
}

function normalizeRows(rows: Record<string, unknown>[]): Record<string, string>[] {
  return rows.map((row) => {
    const out: Record<string, string> = { ...emptyRow() };
    for (const key of Object.keys(row || {})) {
      out[key] = String(row[key] ?? "");
    }
    return out;
  });
}

function parseCsvText(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delimiter).map((x) => x.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const cols = line.split(delimiter).map((x) => x.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
}

function normalizeHeaderKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function autoSuggestMapping(headers: string[]): Record<string, string> {
  const aliases: Record<string, string[]> = {
    HoVaTen: ["hovaten", "hoten", "fullname", "name", "tenkhachhang", "customername"],
    SDT: ["sdt", "sodienthoai", "phone", "phonenumber", "mobile"],
    Email: ["email", "mail"],
    LoaiKhachHang: ["loaikhachhang", "customertype", "segment"],
    LanCuoiChiTra: ["lancuoichitra", "lastpaymentdate", "lastpaiddate"],
    TongSoTienDaChiTra: ["tongsotiendachitra", "totalspent", "totalspend"],
    TongSoLanQuayLai: ["tongsolanquaylai", "totalvisits", "repeatcount", "ordercount"],
    Tuoi: ["tuoi", "age"],
    LinkFB: ["linkfb", "facebook", "facebooklink"],
    DichVuLanCuoiSuDung: ["dichvulancuoisudung", "lastserviceused"],
    DichVuSuDungNhieuNhat: ["dichvusudungnhieunhat", "mostusedservice"],
  };
  const headerMap = headers.map((h) => ({ raw: h, normalized: normalizeHeaderKey(h) }));
  const result: Record<string, string> = {};
  Object.entries(aliases).forEach(([target, keys]) => {
    const found = headerMap.find((h) => keys.includes(h.normalized));
    if (found) result[target] = found.raw;
  });
  return result;
}

async function parseFileToRows(file: File): Promise<Record<string, string>[]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const arr = await file.arrayBuffer();
    const wb = XLSX.read(arr, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Array<string | number | null>>(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });
    if (rows.length < 2) return [];
    const headers = (rows[0] || []).map((x) => String(x ?? "").trim());
    return rows.slice(1).map((r) => {
      const out: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (!h) return;
        out[h] = String(r[i] ?? "").trim();
      });
      return out;
    });
  }
  const text = await file.text();
  return parseCsvText(text);
}

function isValidEmail(value: string): boolean {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function CustomerListsPage() {
  const router = useRouter();
  const [lists, setLists] = useState<CustomerList[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [activeListName, setActiveListName] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<CustomerAnalysisResponse | null>(null);
  const [message, setMessage] = useState("");
  const [newTableName, setNewTableName] = useState("");
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [showTableEditor, setShowTableEditor] = useState(false);
  const [expandedRowIndex, setExpandedRowIndex] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; col: string } | null>(null);
  const [errorPopover, setErrorPopover] = useState<{ rowIdx: number; x: number; y: number } | null>(null);
  const [priorityCustomers, setPriorityCustomers] = useState<string[]>([]);
  const [onlyPriorityView, setOnlyPriorityView] = useState(false);
  const [onlyPriorityTableView, setOnlyPriorityTableView] = useState(false);
  const [showPrioritySuggestion, setShowPrioritySuggestion] = useState(false);
  const [selectedRowIndexes, setSelectedRowIndexes] = useState<number[]>([]);
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [analysisByList, setAnalysisByList] = useState<Record<string, CustomerAnalysisResponse>>({});
  /** Ref để openTable luôn đọc được giá trị analysisByList mới nhất (tránh capture closure cũ sau khi localStorage load). */
  const analysisByListRef = useRef(analysisByList);
  analysisByListRef.current = analysisByList;
  const [autoSaving, setAutoSaving] = useState(false);
  const [rowsDirty, setRowsDirty] = useState(false);
  const isHydratingRowsRef = useRef(false);
  const prevHasRowErrorsRef = useRef<boolean>(false);
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [createListModalOpen, setCreateListModalOpen] = useState(false);
  const [importedRowsPending, setImportedRowsPending] = useState<Record<string, string>[]>([]);
  const [importedHeadersPending, setImportedHeadersPending] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [applyingChurnPriority, setApplyingChurnPriority] = useState(false);
  /** Ô đang mở trong modal phân tích (panel chi tiết). */
  const [segmentHubPanel, setSegmentHubPanel] = useState<AnalysisSegmentId | null>(null);
  /** Lọc bảng theo nhóm phân tích (sau khi đóng modal). */
  const [analysisTableSegmentFilter, setAnalysisTableSegmentFilter] = useState<AnalysisSegmentId | null>(null);
  const [quickOutreachOpen, setQuickOutreachOpen] = useState(false);
  const [quickOutreachSubject, setQuickOutreachSubject] = useState("Thông báo từ cửa hàng");
  const [quickOutreachBody, setQuickOutreachBody] = useState<string>("");
  const [quickOutreachRecipients, setQuickOutreachRecipients] = useState<QuickOutreachRecipientRow[] | null>(null);
  const [quickOutreachResults, setQuickOutreachResults] = useState<
    Array<{ to: string; status: string; detail: string | null }> | null
  >(null);
  const [quickOutreachSending, setQuickOutreachSending] = useState(false);
  const [smartComposeLoading, setSmartComposeLoading] = useState(false);
  const [aiPurposeMenuOpen, setAiPurposeMenuOpen] = useState(false);
  const quickOutreachTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const aiMenuWrapRef = useRef<HTMLDivElement | null>(null);

  /** Chiến dịch có kênh email — dùng điền nhanh tiêu đề/nội dung trong Smart Contact */
  const [quickOutreachCampaignList, setQuickOutreachCampaignList] = useState<
    Array<{ id: string; campaign_name: string; channels: string[] }>
  >([]);
  const [quickOutreachCampaignsLoading, setQuickOutreachCampaignsLoading] = useState(false);
  /** "" = không gắn chiến dịch */
  const [smartContactCampaignId, setSmartContactCampaignId] = useState("");
  /** Hồ sơ thương hiệu gửi kèm API AI — "" = server dùng bản mới nhất */
  const [smartContactBrandList, setSmartContactBrandList] = useState<Array<{ id: string; brand_name: string }>>([]);
  const [smartContactBrandPick, setSmartContactBrandPick] = useState("");
  useEffect(() => {
    if (!aiPurposeMenuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const el = aiMenuWrapRef.current;
      if (el && !el.contains(e.target as Node)) setAiPurposeMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [aiPurposeMenuOpen]);

  /** Khi mở form gửi mail: load chiến dịch (email), hồ sơ thương hiệu; reset dropdown */
  useEffect(() => {
    if (!quickOutreachOpen) return;
    setSmartContactCampaignId("");
    setSmartContactBrandPick("");
    setQuickOutreachCampaignsLoading(true);
    Promise.all([
      api
        .get<Array<{ id: string; campaign_name: string; channels: string[] }>>("/campaigns")
        .then((rows) => setQuickOutreachCampaignList(rows.filter((c) => (c.channels || []).includes("email"))))
        .catch(() => setQuickOutreachCampaignList([])),
      api
        .get<Array<{ id: string; brand_name: string }>>("/brands")
        .then(setSmartContactBrandList)
        .catch(() => setSmartContactBrandList([])),
    ]).finally(() => setQuickOutreachCampaignsLoading(false));
  }, [quickOutreachOpen]);

  const allColumns = useMemo(() => {
    const extra = new Set<string>();
    rows.forEach((r) => {
      Object.keys(r).forEach((k) => {
        if (!TEMPLATE_COLUMNS.includes(k as (typeof TEMPLATE_COLUMNS)[number])) {
          extra.add(k);
        }
      });
    });
    return [...TEMPLATE_COLUMNS, ...Array.from(extra)];
  }, [rows]);

  const columns = useMemo(() => {
    return PRIMARY_COLUMNS.map((item) => item.key as string);
  }, []);

  const extraColumns = useMemo(() => {
    return allColumns.filter((col) => !columns.includes(col));
  }, [allColumns, columns]);

  const rowErrors = useMemo(() => {
    const errors: Record<number, string[]> = {};
    const emailMap: Record<string, number[]> = {};
    rows.forEach((row, idx) => {
      const rowErr: string[] = [];
      const email = String(row.Email || "").trim();
      const fullName = String(row.HoVaTen || "").trim();
      const phone = String(row.SDT || "").trim();
      const customerType = String(row.LoaiKhachHang || "").trim();
      const lastPaid = String(row.LanCuoiChiTra || "").trim();
      const totalSpend = String(row.TongSoTienDaChiTra || "").trim();
      const hasAnyData = Boolean(fullName || email || phone || customerType || lastPaid || totalSpend);
      if (!hasAnyData) return;
      if (!fullName) rowErr.push("Thiếu họ tên");
      if (!phone) rowErr.push("Thiếu SĐT");
      if (email && !isValidEmail(email)) rowErr.push("Email không hợp lệ");
      if (email) {
        const key = email.toLowerCase();
        emailMap[key] = [...(emailMap[key] || []), idx];
      }
      if (rowErr.length) errors[idx] = rowErr;
    });
    Object.entries(emailMap).forEach(([, indexes]) => {
      if (indexes.length > 1) {
        indexes.forEach((idx) => {
          errors[idx] = [...(errors[idx] || []), "Email bị trùng"];
        });
      }
    });
    return errors;
  }, [rows]);

  const hasRowErrors = Object.keys(rowErrors).length > 0;
  const analysisSegmentNameSet = useMemo(() => {
    if (!analysisResult || !analysisTableSegmentFilter) return null;
    const s = new Set<string>();
    for (const c of analysisResult.analysis.segmentation.customers) {
      if (c.segment === analysisTableSegmentFilter) {
        const n = String(c.customer_name || "").trim().toLowerCase();
        if (n) s.add(n);
      }
    }
    return s;
  }, [analysisResult, analysisTableSegmentFilter]);

  const displayedRows = useMemo(() => {
    let mapped = rows.map((row, rowIdx) => ({ row, rowIdx }));
    mapped = [...mapped].sort((a, b) => {
      const aPriority = priorityCustomers.includes(
        toPriorityKey(String(a.row.HoVaTen || ""), String(a.row.Email || ""), String(a.row.SDT || "")),
      );
      const bPriority = priorityCustomers.includes(
        toPriorityKey(String(b.row.HoVaTen || ""), String(b.row.Email || ""), String(b.row.SDT || "")),
      );
      if (aPriority === bPriority) return a.rowIdx - b.rowIdx;
      return aPriority ? -1 : 1;
    });
    if (onlyPriorityTableView) {
      mapped = mapped.filter(({ row }) =>
        priorityCustomers.includes(
          toPriorityKey(String(row.HoVaTen || ""), String(row.Email || ""), String(row.SDT || "")),
        ),
      );
    }
    if (analysisTableSegmentFilter !== null && analysisSegmentNameSet !== null) {
      mapped = mapped.filter(({ row }) =>
        analysisSegmentNameSet.has(String(row.HoVaTen || "").trim().toLowerCase()),
      );
    }
    return mapped;
  }, [rows, onlyPriorityTableView, priorityCustomers, analysisSegmentNameSet]);

  const segmentChartData = useMemo(() => {
    if (!analysisResult?.analysis?.segmentation?.summary) return [];
    const s = analysisResult.analysis.segmentation.summary;
    return [
      { name: "VIP", value: s.vip, fill: "#7c3aed" },
      { name: "Tiềm năng", value: s.potential, fill: "#0ea5e9" },
      { name: "Khả năng rời bỏ", value: s.churn_risk, fill: "#ef4444" },
      { name: "Khách mới", value: s.new, fill: "#22c55e" },
    ];
  }, [analysisResult]);

  const segmentPieData = useMemo(
    () => segmentChartData.filter((d) => d.value > 0),
    [segmentChartData],
  );

  const INACTIVE_BUCKET_FILL: Record<string, string> = {
    "0_7": "#22c55e",
    "7_30": "#eab308",
    "30_60": "#f97316",
    over_60: "#ef4444",
    unknown: "#94a3b8",
  };

  const inactiveSinceLastChartData = useMemo(() => {
    const raw = analysisResult?.analysis?.churn_risk?.inactive_day_buckets;
    if (!raw?.length) return [];
    return raw.map((b) => ({
      name: b.label,
      key: b.key,
      value: b.count,
      fill: INACTIVE_BUCKET_FILL[b.key] ?? "#94a3b8",
    }));
  }, [analysisResult]);

  const revenueByCustomerTypeChartData = useMemo(() => {
    const raw = analysisResult?.analysis?.segmentation?.revenue_by_customer_type;
    if (!raw?.length) return [];
    return raw.map((row, i) => ({
      name: row.label,
      value: row.revenue,
      fill: RAW_TYPE_CHART_COLORS[i % RAW_TYPE_CHART_COLORS.length],
    }));
  }, [analysisResult]);

  const arpuBySegmentChartData = useMemo(() => {
    const r = analysisResult?.analysis?.segmentation?.arpu_by_segment;
    if (!r) {
      return [
        { name: "VIP", key: "vip", value: 0, fill: "#7c3aed" },
        { name: "Tiềm năng", key: "potential", value: 0, fill: "#0ea5e9" },
        { name: "Khả năng rời bỏ", key: "churn_risk", value: 0, fill: "#ef4444" },
        { name: "Khách mới", key: "new", value: 0, fill: "#22c55e" },
      ];
    }
    return [
      { name: "VIP", key: "vip", value: r.vip, fill: "#7c3aed" },
      { name: "Tiềm năng", key: "potential", value: r.potential, fill: "#0ea5e9" },
      { name: "Khả năng rời bỏ", key: "churn_risk", value: r.churn_risk, fill: "#ef4444" },
      { name: "Khách mới", key: "new", value: r.new, fill: "#22c55e" },
    ];
  }, [analysisResult]);

  const analysisInsightBullets = useMemo(
    () => (analysisResult ? buildAnalysisInsightBullets(analysisResult.analysis) : []),
    [analysisResult],
  );

  const quickOutreachPreviewSamples = useMemo(() => {
    const list = quickOutreachRecipients ?? [];
    return list.slice(0, 3).map((r) => {
      const name = (r.name || "").trim() || "bạn";
      const phone = (r.phone || "").trim();
      const merged: Record<string, string> = { name, phone, ...r.variables };
      let out = quickOutreachBody;
      for (const key of Object.keys(merged).sort((a, b) => b.length - a.length)) {
        out = out.split(`{{${key}}}`).join(merged[key] ?? "");
      }
      return { name: r.name || r.variables.HoVaTen || "—", text: out };
    });
  }, [quickOutreachBody, quickOutreachRecipients]);

  useEffect(() => {
    if (!analysisModalOpen) setSegmentHubPanel(null);
  }, [analysisModalOpen]);

  useEffect(() => {
    if (!analysisResult) return;
    const total = analysisResult.analysis.overview.total_customers || 0;
    const churnRisk = analysisResult.analysis.segmentation.summary.churn_risk || 0;
    if (total <= 0) {
      setShowPrioritySuggestion(false);
      return;
    }
    const churnRate = churnRisk / total;
    setShowPrioritySuggestion(churnRate >= 0.2);
  }, [analysisResult]);

  useEffect(() => {
    if (rows.length === 0) {
      prevHasRowErrorsRef.current = false;
      return;
    }
    if (prevHasRowErrorsRef.current && !hasRowErrors) {
      setMessage("Dữ liệu hợp lệ.");
    }
    prevHasRowErrorsRef.current = hasRowErrors;
  }, [hasRowErrors, rows.length]);

  useEffect(() => {
    // Xóa cache cũ để buộc chạy phân tích mới sau khi fix logic backend
    try {
      localStorage.removeItem("customer-analysis-cache-v1");
    } catch {
      // ignore
    }
    try {
      const raw = localStorage.getItem("customer-analysis-cache-v1");
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, CustomerAnalysisResponse>;
      setAnalysisByList(parsed);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("customer-analysis-cache-v1", JSON.stringify(analysisByList));
    } catch {
      // ignore
    }
  }, [analysisByList]);

  async function loadLists() {
    setLoading(true);
    try {
      const data = await api.get<CustomerList[]>("/workflow/customer-lists");
      setLists(data);
      if (!activeListId && data.length > 0) {
        await openTable(data[0].id);
      }
    } catch {
      setLists([]);
    } finally {
      setLoading(false);
    }
  }

  async function openTable(listId: string) {
    setTableLoading(true);
    setMessage("");
    try {
      const res = await api.get<CustomerTableRowsResponse>(`/workflow/customer-lists/${listId}/rows`);
      isHydratingRowsRef.current = true;
      setActiveListId(res.table.id);
      setActiveListName(res.table.name);
      setRows(normalizeRows(res.rows as Record<string, unknown>[]));
      setAnalysisResult(analysisByListRef.current[res.table.id] || null);
      setShowTableEditor(true);
      setExpandedRowIndex(null);
      setOnlyPriorityTableView(false);
      setAnalysisTableSegmentFilter(null);
      const priority = await api
        .get<PriorityCustomer[]>(`/workflow/customer-lists/${res.table.id}/priority-customers`)
        .catch(() => []);
      const keys = priority.map((item) => (item.email || item.phone || item.customer_name).toLowerCase());
      setPriorityCustomers(keys);
      setRowsDirty(false);
    } catch (e) {
      setRows([]);
      setMessage(e instanceof Error ? e.message : "Không mở được bảng");
    } finally {
      setTimeout(() => {
        isHydratingRowsRef.current = false;
      }, 0);
      setTableLoading(false);
    }
  }

  useEffect(() => {
    void loadLists();
    api.get<BrandOption[]>("/brands").then(setBrands).catch(() => setBrands([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(""), 2800);
    return () => window.clearTimeout(t);
  }, [message]);

  async function createTable() {
    const name = newTableName.trim();
    if (!name) {
      setMessage("Nhập tên bảng trước khi tạo.");
      return;
    }
    try {
      const created = await api.post<{ id: string; list_name: string }>("/workflow/customer-lists", {
        list_name: name,
      });
      setNewTableName("");
      setCreateListModalOpen(false);
      await loadLists();
      await openTable(created.id);
      setMessage("Đã tạo bảng mới.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không tạo được bảng");
    }
  }

  async function deleteTable(listId: string) {
    if (!confirm("Xóa bảng này?")) return;
    try {
      await api.delete(`/workflow/customer-lists/${listId}`);
      if (activeListId === listId) {
        setActiveListId(null);
        setActiveListName("");
        setRows([]);
      }
      await loadLists();
      setMessage("Đã xóa bảng.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không xóa được bảng");
    }
  }

  async function renameTable(item: CustomerList) {
    const nextName = prompt("Nhập tên bảng mới:", item.list_name);
    if (!nextName || !nextName.trim()) return;
    try {
      await api.patch(`/workflow/customer-lists/${item.id}`, { list_name: nextName.trim() });
      if (activeListId === item.id) setActiveListName(nextName.trim());
      await loadLists();
      setMessage("Đã đổi tên bảng.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không đổi tên được bảng");
    }
  }

  function updateCell(rowIdx: number, col: string, value: string) {
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [col]: value };
      return next;
    });
    setRowsDirty(true);
  }

  function addRow() {
    const nextIndex = rows.length;
    setRows((prev) => [...prev, emptyRow()]);
    setRowsDirty(true);
    setTimeout(() => {
      setEditingCell({ rowIdx: nextIndex, col: "HoVaTen" });
    }, 80);
  }

  function deleteRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setExpandedRowIndex((prev) => (prev === index ? null : prev));
    setEditingCell(null);
    setErrorPopover(null);
    setSelectedRowIndexes((prev) => prev.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i)));
    setRowsDirty(true);
  }

  async function handleImportToCurrentTable(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage("");
    try {
      const imported = await parseFileToRows(file);
      const importedHeaders = Object.keys(imported[0] || {});
      const suggested = autoSuggestMapping(importedHeaders);
      setImportedRowsPending(imported);
      setImportedHeadersPending(importedHeaders);
      setColumnMapping(suggested);
      const missingRequired = REQUIRED_IMPORT_COLUMNS.filter((col) => !suggested[col]);
      if (missingRequired.length > 0) {
        setMappingModalOpen(true);
      } else {
        const mappedRows = imported.map((row) => {
          const out: Record<string, string> = {};
          Object.entries(suggested).forEach(([target, source]) => {
            if (!source) return;
            out[target] = String(row[source] ?? "");
          });
          return out;
        });
        const normalized = normalizeRows(mappedRows as Record<string, unknown>[]);
        setRows(normalized);
        setRowsDirty(true);
        setOnlyPriorityTableView(false);
        setMessage(`Đã nạp ${normalized.length} dòng vào danh sách đang mở.`);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không đọc được file");
    } finally {
      event.target.value = "";
    }
  }

  function applyMappedImport() {
    const missingRequired = REQUIRED_IMPORT_COLUMNS.filter((col) => !columnMapping[col]);
    if (missingRequired.length > 0) {
      setMessage(`Thiếu cột bắt buộc sau mapping: ${missingRequired.join(", ")}`);
      return;
    }
    const mappedRows = importedRowsPending.map((row) => {
      const out: Record<string, string> = {};
      Object.entries(columnMapping).forEach(([target, source]) => {
        if (!source) return;
        out[target] = String(row[source] ?? "");
      });
      return out;
    });
    const normalized = normalizeRows(mappedRows as Record<string, unknown>[]);
    setRows(normalized);
    setRowsDirty(true);
    setOnlyPriorityTableView(false);
    setMappingModalOpen(false);
    setMessage(`Đã nạp ${normalized.length} dòng vào danh sách đang mở.`);
  }

  async function persistRowsNow(showToast: boolean) {
    if (!activeListId) return;
    setSaving(showToast);
    setAutoSaving(true);
    try {
      await api.put(`/workflow/customer-lists/${activeListId}/rows`, { rows });
      setRowsDirty(false);
      if (showToast) setMessage("Đã lưu danh sách.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Lưu tự động thất bại";
      if (showToast) setMessage(msg);
    } finally {
      setSaving(false);
      setAutoSaving(false);
    }
  }

  async function saveCurrentTable() {
    if (!activeListId) {
      setMessage("Chọn danh sách trước khi lưu.");
      return;
    }
    await persistRowsNow(true);
  }

  async function analyzeCurrentTable() {
    if (!rows.length) {
      setMessage("Bảng đang trống. Hãy nhập dữ liệu trước khi phân tích.");
      return;
    }
    if (hasRowErrors) {
      setMessage("Bảng đang có lỗi dữ liệu. Sửa lỗi trước khi phân tích để kết quả chính xác.");
      return;
    }
    if (!activeListId) {
      setMessage("Chọn list trước khi phân tích.");
      return;
    }
    setAnalyzing(true);
    setMessage("");
    try {
      const result = await api.post<CustomerAnalysisResponse>(`/workflow/customer-lists/${activeListId}/analyze`, { rows });
      setAnalysisResult(result);
      setAnalysisByList((prev) => ({ ...prev, [activeListId]: result }));
      setAnalysisTableSegmentFilter(null);
      setAnalysisModalOpen(true);
      setMessage("Phân tích hoàn tất. Kết quả mới đã thay thế kết quả trước.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Phân tích thất bại");
    } finally {
      setAnalyzing(false);
    }
  }

  useEffect(() => {
    if (!activeListId) return;
    if (!rowsDirty) return;
    if (tableLoading) return;
    if (isHydratingRowsRef.current) return;
    const timeout = window.setTimeout(() => {
      void persistRowsNow(false);
    }, 700);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, rowsDirty, activeListId, tableLoading]);

  async function createCampaignFromAction(action: {
    title: string;
    target_segment: string;
    priority: string;
    goal?: string;
    expected_impact?: string;
    recommended_channels?: string[];
  }) {
    if (!analysisResult) return;
    if (brands.length === 0) {
      setMessage("Chưa có Brand Vault. Vui lòng tạo thương hiệu trước khi tạo chiến dịch.");
      setAnalysisModalOpen(false);
      return;
    }
    setCreatingCampaign(true);
    setMessage("");
    try {
      const payload = {
        brand_id: brands[0].id,
        campaign_name: `Action: ${action.title}`.slice(0, 120),
        objective: action.goal || action.title,
        product_or_service: "Danh sách khách hàng",
        target_audience: `Khách hàng nhóm ${action.target_segment}`,
        offer_or_hook: action.expected_impact || `Ưu tiên ${action.priority}`,
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        channels:
          action.recommended_channels && action.recommended_channels.length > 0
            ? action.recommended_channels
            : action.target_segment === "churn_risk" || action.target_segment === "vip"
              ? ["email"]
              : ["facebook_post"],
        additional_notes: `[INSIGHT_ACTION] Tạo từ customer table ${activeListName}`,
        source_insight_run_id: undefined,
        source_customer_segment: action.target_segment,
      };
      const created = await api.post<{ id: string }>("/campaigns", payload);
      await api.post(`/campaigns/${created.id}/run`);
      router.push(`/campaigns/${created.id}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không tạo được chiến dịch từ hành động");
    } finally {
      setCreatingCampaign(false);
    }
  }

  function toPriorityKey(customerName: string, email?: string, phone?: string): string {
    return (email || phone || customerName).toLowerCase();
  }

  async function togglePriorityCustomer(input: { customer_name: string; email?: string; phone?: string }, isPriority: boolean) {
    if (!activeListId) return;
    const key = toPriorityKey(input.customer_name, input.email, input.phone);
    try {
      await api.post(`/workflow/customer-lists/${activeListId}/priority-customers`, {
        customer_name: input.customer_name,
        email: input.email || null,
        phone: input.phone || null,
        is_priority: isPriority,
      });
      setPriorityCustomers((prev) =>
        isPriority ? (prev.includes(key) ? prev : [...prev, key]) : prev.filter((item) => item !== key),
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không cập nhật được trạng thái ưu tiên");
    }
  }

  async function clearAllPriorityCustomers() {
    if (!activeListId) return;
    if (!confirm("Bạn có chắc muốn bỏ tất cả khách ưu tiên trong danh sách này?")) return;
    try {
      const result = await api.delete<{ cleared_count: number }>(`/workflow/customer-lists/${activeListId}/priority-customers`);
      setPriorityCustomers([]);
      setOnlyPriorityTableView(false);
      setOnlyPriorityView(false);
      setMessage(`Đã bỏ ưu tiên ${result.cleared_count} khách.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không thể bỏ tất cả ưu tiên");
    }
  }

  /** Đánh dấu ưu tiên theo nhóm churn_risk trong kết quả phân tích (rule engine), rồi bật lọc bảng. */
  function recipientsFromSelectedRows(): QuickOutreachRecipientRow[] {
    return selectedRowIndexes
      .map((i) => rows[i])
      .filter(Boolean)
      .map((row) => ({
        name: String(row.HoVaTen || "").trim(),
        email: String(row.Email || "").trim(),
        phone: String(row.SDT || "").trim(),
        variables: buildSmartVariablesFromRow(row),
      }));
  }

  function recipientsFromAnalysisSegment(segment: AnalysisSegmentId): QuickOutreachRecipientRow[] {
    if (!analysisResult) return [];
    const nameSet = new Set(
      analysisResult.analysis.segmentation.customers
        .filter((c) => c.segment === segment)
        .map((c) => String(c.customer_name || "").trim().toLowerCase())
        .filter(Boolean),
    );
    return rows
      .filter((row) => nameSet.has(String(row.HoVaTen || "").trim().toLowerCase()))
      .map((row) => ({
        name: String(row.HoVaTen || "").trim(),
        email: String(row.Email || "").trim(),
        phone: String(row.SDT || "").trim(),
        variables: buildSmartVariablesFromRow(row),
      }));
  }

  function openQuickOutreach(list: QuickOutreachRecipientRow[]) {
    if (!activeListId) {
      setMessage("Chọn danh sách trước.");
      return;
    }
    if (list.length === 0) {
      setMessage("Không có khách trong nhóm này.");
      return;
    }
    setQuickOutreachRecipients(list);
    setQuickOutreachSubject("Thông báo từ cửa hàng");
    setQuickOutreachBody("");
    setQuickOutreachResults(null);
    setAiPurposeMenuOpen(false);
    setQuickOutreachOpen(true);
  }

  async function runSmartContactAiCompose(purpose: OutreachAiPurposeKey | "refine") {
    if (!activeListId || !quickOutreachRecipients?.length) return;
    setAiPurposeMenuOpen(false);
    setSmartComposeLoading(true);
    try {
      const dataCtx = buildRecipientsDataContextForAi(quickOutreachRecipients);
      let user_prompt: string;
      if (purpose === "refine") {
        user_prompt = [
          REFINE_DRAFT_INSTRUCTION,
          "",
          "=== Bản nháp hiện tại ===",
          quickOutreachBody.trim() || "(trống — hãy soạn một email ngắn chăm sóc dựa trên dữ liệu khách)",
        ].join("\n");
      } else {
        user_prompt = [
          OUTREACH_AI_INSTRUCTION[purpose],
          "",
          "Tham khảo cấu trúc (có thể viết lại cho tự nhiên hơn):",
          OUTREACH_TEMPLATES[purpose],
          "",
          "=== Bản nháp hiện tại (gộp hoặc thay nếu hợp lý) ===",
          quickOutreachBody.trim() || "(trống)",
        ].join("\n");
      }
      const res = await api.post<{ text: string }>(
        `/workflow/customer-lists/${activeListId}/smart-contact-compose`,
        {
          user_prompt,
          mode: "email",
          recipients_data_context: dataCtx || undefined,
          ...(smartContactBrandPick.trim() ? { brand_id: smartContactBrandPick.trim() } : {}),
        },
      );
      setQuickOutreachBody(res.text);
      setMessage("Đã cập nhật nội dung nhờ AI. Kiểm tra trước khi gửi.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "AI không soạn được.");
    } finally {
      setSmartComposeLoading(false);
    }
  }

  /** Lấy nội dung email đã tạo trong chiến dịch — ưu tiên bản nháp kênh Email, thiếu thì gom mục tiêu/dịch vụ */
  async function applyCampaignContentToSmartContact(campaignId: string) {
    if (!campaignId) return;
    try {
      const detail = await api.get<{
        campaign_name: string;
        objective: string;
        product_or_service?: string | null;
        brand_id?: string | null;
        content_items: Array<{ channel: string; content_json: Record<string, unknown> }>;
      }>(`/campaigns/${campaignId}`);
      const emailItem = detail.content_items.find((ci) => ci.channel === "email");
      const cj = emailItem?.content_json;
      let subject = "";
      let body = "";
      if (cj && typeof cj.subject === "string") subject = cj.subject.trim();
      if (cj && typeof cj.body === "string") body = cj.body.trim();
      if (!subject) subject = detail.campaign_name;
      if (!body) {
        const chunks = [detail.objective, detail.product_or_service || ""].map((s) => String(s || "").trim()).filter(Boolean);
        body = chunks.join("\n\n");
      }
      setQuickOutreachSubject(subject || detail.campaign_name);
      setQuickOutreachBody(body);
      if (detail.brand_id) {
        setSmartContactBrandPick(detail.brand_id);
      }
      setMessage("Đã điền tiêu đề và nội dung từ chiến dịch. Kiểm tra trước khi gửi.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không tải được chiến dịch.");
      setSmartContactCampaignId("");
    }
  }

  async function submitQuickOutreach() {
    if (!activeListId || !quickOutreachRecipients?.length) return;
    setQuickOutreachSending(true);
    setQuickOutreachResults(null);
    try {
      const res = await api.post<{ results: Array<{ to: string; status: string; detail: string | null }> }>(
        `/workflow/customer-lists/${activeListId}/quick-outreach`,
        {
          mode: "email",
          subject: quickOutreachSubject,
          message: quickOutreachBody,
          recipients: quickOutreachRecipients.map((r) => ({
            name: r.name,
            email: r.email || null,
            phone: r.phone || null,
            variables: r.variables,
          })),
          campaign_id: smartContactCampaignId || null,
        },
      );
      setQuickOutreachResults(res.results);
      const ok = res.results.filter((x) => x.status === "sent").length;
      const fail = res.results.filter((x) => x.status === "failed").length;
      const skip = res.results.filter((x) => x.status === "skipped").length;
      const campaignNote = smartContactCampaignId ? " (gắn với chiến dịch)" : "";
      setMessage(`Liên hệ nhanh${campaignNote}: ${ok} gửi được, ${fail} lỗi, ${skip} bỏ qua.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Gửi thất bại");
    } finally {
      setQuickOutreachSending(false);
    }
  }

  async function applyChurnRiskFromAnalysisAndFilter() {
    if (!activeListId || !analysisResult) return;
    const churnNamesLower = new Set(
      analysisResult.analysis.segmentation.customers
        .filter((c) => c.segment === "churn_risk")
        .map((c) => String(c.customer_name || "").trim().toLowerCase())
        .filter(Boolean),
    );
    if (churnNamesLower.size === 0) {
      setMessage("Phân tích không có khách thuộc nhóm có khả năng rời bỏ.");
      return;
    }
    const targets = rows
      .filter((row) => churnNamesLower.has(String(row.HoVaTen || "").trim().toLowerCase()))
      .map((row) => ({
        customer_name: String(row.HoVaTen || "").trim(),
        email: String(row.Email || "").trim(),
        phone: String(row.SDT || "").trim(),
      }))
      .filter((t) => t.customer_name);
    if (targets.length === 0) {
      setMessage("Không khớp dòng bảng với tên khách có khả năng rời bỏ trong phân tích. Kiểm tra cột họ tên.");
      return;
    }
    setApplyingChurnPriority(true);
    try {
      await Promise.all(
        targets.map((item) =>
          api.post(`/workflow/customer-lists/${activeListId}/priority-customers`, {
            customer_name: item.customer_name,
            email: item.email || null,
            phone: item.phone || null,
            is_priority: true,
          }),
        ),
      );
      const targetKeys = targets.map((item) => toPriorityKey(item.customer_name, item.email, item.phone));
      setPriorityCustomers((prev) => {
        const next = [...prev];
        targetKeys.forEach((key) => {
          if (!next.includes(key)) next.push(key);
        });
        return next;
      });
      setOnlyPriorityTableView(true);
      setAnalysisTableSegmentFilter("churn_risk");
      setMessage(`Đã đánh dấu ưu tiên ${targets.length} khách (theo nhóm có khả năng rời bỏ trong phân tích) và bật lọc bảng.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không áp dụng được ưu tiên từ phân tích.");
    } finally {
      setApplyingChurnPriority(false);
    }
  }

  async function bulkTogglePriority(isPriority: boolean) {
    if (!activeListId) return;
    const targets = selectedRowIndexes
      .map((rowIdx) => rows[rowIdx])
      .filter(Boolean)
      .map((row) => ({
        customer_name: String(row.HoVaTen || "").trim(),
        email: String(row.Email || "").trim(),
        phone: String(row.SDT || "").trim(),
      }))
      .filter((item) => item.customer_name);
    if (targets.length === 0) {
      setMessage("Bạn chưa chọn dòng nào để thao tác.");
      return;
    }
    try {
      await Promise.all(
        targets.map((item) =>
          api.post(`/workflow/customer-lists/${activeListId}/priority-customers`, {
            customer_name: item.customer_name,
            email: item.email || null,
            phone: item.phone || null,
            is_priority: isPriority,
          }),
        ),
      );
      const targetKeys = targets.map((item) => toPriorityKey(item.customer_name, item.email, item.phone));
      setPriorityCustomers((prev) => {
        if (isPriority) {
          const next = [...prev];
          targetKeys.forEach((key) => {
            if (!next.includes(key)) next.push(key);
          });
          return next;
        }
        return prev.filter((key) => !targetKeys.includes(key));
      });
      setMessage(
        isPriority
          ? `Đã đánh dấu ưu tiên ${targets.length} khách đã chọn.`
          : `Đã bỏ ưu tiên ${targets.length} khách đã chọn.`,
      );
      setSelectedRowIndexes([]);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không cập nhật được ưu tiên hàng loạt");
    }
  }

  async function createCampaignFromCustomer(customerName: string, segment: string) {
    await createCampaignFromAction({
      title: `Chăm sóc khách ${customerName}`,
      target_segment: segment,
      priority: segment === "churn_risk" ? "high" : "medium",
      goal: `Triển khai chăm sóc cho khách ${customerName}`,
      expected_impact: "Tăng tỉ lệ quay lại",
      recommended_channels: segment === "churn_risk" || segment === "vip" ? ["email"] : ["facebook_post"],
    });
  }

  return (
    <div className="p-6 space-y-6 [&_.card]:!rounded-none [&_.input]:!rounded-none [&_.select]:!rounded-none [&_.btn-primary]:!rounded-none [&_.btn-secondary]:!rounded-none">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1>Danh sách customer</h1>
        </div>
        <div className="flex items-center gap-2">
          <HelpDialogButton
            title="Hướng dẫn danh sách người dùng"
            summary="Mỗi danh sách là một tập khách hàng riêng. Bạn nạp file vào danh sách đang mở, chỉnh sửa và hệ thống tự lưu."
            steps={[
              "Tạo hoặc chọn danh sách.",
              "Nạp file CSV/XLSX vào đúng danh sách đang mở.",
              "Xác nhận mapping cột nếu file không theo đúng khuôn chuẩn.",
              "Chỉnh sửa thêm/xóa dòng.",
              "Hệ thống tự lưu dữ liệu sau khi bạn thao tác.",
              "Bấm Phân tích để chạy pipeline bot và lấy kết quả.",
            ]}
          />
          <a href="/templechoDSkhachhang.xlsx" download className="btn-secondary text-sm">
            Tải template
          </a>
        </div>
      </div>

      {message ? (
        <div className="fixed top-4 left-1/2 z-40 -translate-x-1/2 border border-gray-300 bg-white px-4 py-2 text-sm shadow-lg">
          {message}
        </div>
      ) : null}

      {!showTableEditor ? (
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2>Các danh sách hiện có</h2>
            <button type="button" className="btn-primary text-xs" onClick={() => setCreateListModalOpen(true)}>
              Tạo danh sách
            </button>
          </div>
          {loading ? (
            <p className="text-sm text-gray-500">Đang tải...</p>
          ) : lists.length === 0 ? (
            <p className="text-sm text-gray-500">Chưa có bảng nào.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {lists.map((item) => (
                <div
                  key={item.id}
                  className={`grid grid-cols-1 gap-2 border p-3 cursor-pointer ${
                    activeListId === item.id ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white"
                  }`}
                  onClick={() => void openTable(item.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{item.list_name}</p>
                      <p className="text-xs text-gray-500">
                        {item.total_records} dòng | {item.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        className="btn-secondary text-[11px] px-2 py-1"
                        title="Sửa tên list"
                        onClick={(e) => {
                          e.stopPropagation();
                          void renameTable(item);
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-secondary text-[11px] px-2 py-1"
                        title="Xóa list"
                        onClick={(e) => {
                          e.stopPropagation();
                          void deleteTable(item.id);
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-[11px]">
                    <span className="border border-gray-200 bg-gray-50 px-2 py-[2px]">VIP {item.segment_summary?.vip ?? 0}</span>
                    <span className="border border-gray-200 bg-gray-50 px-2 py-[2px]">
                      Potential {item.segment_summary?.potential ?? 0}
                    </span>
                    <span className="border border-gray-200 bg-gray-50 px-2 py-[2px]">
                      Inactive {item.segment_summary?.inactive ?? 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {showTableEditor && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowTableEditor(false)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-teal-200 bg-teal-50 text-teal-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-100 hover:text-teal-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
            title="Quay lại danh sách"
            aria-label="Quay lại danh sách"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
          </button>
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2>{activeListName ? `Danh sách khách hàng - ${activeListName}` : "Chọn danh sách để thao tác"}</h2>
            <div className="flex items-center gap-2">
              <label className="btn-secondary text-xs cursor-pointer">
                Tải dữ liệu
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  disabled={!activeListId}
                  onChange={handleImportToCurrentTable}
                />
              </label>
              <button className="btn-secondary text-xs" onClick={addRow} disabled={!activeListId}>
                Thêm dòng
              </button>
              <button className="btn-primary text-xs" onClick={saveCurrentTable} disabled={!activeListId || saving}>
                {saving ? "Đang lưu..." : "Lưu list"}
              </button>
              <button
                className="btn-primary text-xs"
                onClick={() => {
                  if (analysisResult) {
                    void analyzeCurrentTable();
                  } else {
                    setAnalysisModalOpen(true);
                  }
                }}
                disabled={!activeListId || analyzing}
              >
                {analyzing ? "Đang phân tích..." : analysisResult ? "Phân tích lại" : "Xem phân tích"}
              </button>
              {analysisResult ? (
                <button className="btn-secondary text-xs" onClick={() => setAnalysisModalOpen(true)}>
                  Xem kết quả
                </button>
              ) : null}
              {autoSaving ? <span className="text-[11px] text-gray-500">Saving...</span> : null}
            </div>
          </div>

          {tableLoading ? (
            <p className="text-sm text-gray-500">Đang tải dữ liệu danh sách...</p>
          ) : !activeListId ? (
            <p className="text-sm text-gray-500">Hãy chọn hoặc tạo danh sách ở trên.</p>
          ) : (
            <div className="space-y-2">
              {hasRowErrors ? (
                <div className="border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  Có {Object.keys(rowErrors).length} dòng đang lỗi dữ liệu. Bấm biểu tượng cảnh báo trước tên khách để xem lỗi.
                </div>
              ) : null}
              {analysisTableSegmentFilter ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border border-blue-200 bg-blue-50/90 px-2 py-1.5 text-xs text-blue-950">
                  <span>
                    Lọc theo nhóm phân tích:{" "}
                    <strong>{SEGMENT_FRIENDLY[analysisTableSegmentFilter] ?? analysisTableSegmentFilter}</strong> —{" "}
                    <span className="tabular-nums">{displayedRows.length}</span> dòng.
                  </span>
                  <button
                    type="button"
                    className="btn-secondary text-[10px]"
                    onClick={() => {
                      setAnalysisTableSegmentFilter(null);
                      setMessage("Đã tắt lọc theo nhóm phân tích.");
                    }}
                  >
                    Bỏ lọc nhóm
                  </button>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-[11px] border border-amber-300 bg-amber-50 px-2 py-[3px] text-amber-800 rounded">
                  Khách ưu tiên: {priorityCustomers.length}
                </span>
                <label className="text-[11px] inline-flex items-center gap-1.5 text-gray-700">
                  <input
                    type="checkbox"
                    checked={onlyPriorityTableView}
                    onChange={(e) => setOnlyPriorityTableView(e.target.checked)}
                  />
                  Chỉ hiện khách ưu tiên
                </label>
                <div
                  className="inline-flex items-center gap-0.5 rounded-lg border border-amber-200/90 bg-amber-50/60 p-0.5"
                  role="toolbar"
                  aria-label="Thao tác ưu tiên"
                >
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-amber-900 transition enabled:hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={priorityCustomers.length === 0}
                    onClick={() => void clearAllPriorityCustomers()}
                    title="Bỏ tất cả đánh dấu ưu tiên trong danh sách này"
                    aria-label="Bỏ tất cả đánh dấu ưu tiên trong danh sách này"
                  >
                    <Eraser className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-amber-900 transition enabled:hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={selectedRowIndexes.length === 0}
                    onClick={() => void bulkTogglePriority(true)}
                    title={
                      selectedRowIndexes.length === 0
                        ? "Chọn ít nhất một dòng để đặt ưu tiên"
                        : `Chọn thành ưu tiên cho ${selectedRowIndexes.length} khách đã chọn`
                    }
                    aria-label={`Chọn thành ưu tiên cho ${selectedRowIndexes.length} khách đã chọn`}
                  >
                    <Star className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-amber-900 transition enabled:hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={selectedRowIndexes.length === 0}
                    onClick={() => void bulkTogglePriority(false)}
                    title={
                      selectedRowIndexes.length === 0
                        ? "Chọn ít nhất một dòng để bỏ ưu tiên"
                        : `Bỏ đánh dấu ưu tiên cho ${selectedRowIndexes.length} khách đã chọn`
                    }
                    aria-label={`Bỏ đánh dấu ưu tiên cho ${selectedRowIndexes.length} khách đã chọn`}
                  >
                    <StarOff className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto border border-gray-200">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-2 py-1 border w-10">
                      <input
                        type="checkbox"
                        checked={displayedRows.length > 0 && displayedRows.every(({ rowIdx }) => selectedRowIndexes.includes(rowIdx))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRowIndexes((prev) => {
                              const next = [...prev];
                              displayedRows.forEach(({ rowIdx }) => {
                                if (!next.includes(rowIdx)) next.push(rowIdx);
                              });
                              return next;
                            });
                          } else {
                            setSelectedRowIndexes((prev) =>
                              prev.filter((idx) => !displayedRows.map(({ rowIdx }) => rowIdx).includes(idx)),
                            );
                          }
                        }}
                      />
                    </th>
                    {columns.map((col) => (
                      <th key={col} className="text-left px-2 py-1 border">
                        <span className="whitespace-normal leading-tight">
                          {PRIMARY_COLUMNS.find((item) => item.key === col)?.label ?? COLUMN_LABELS[col] ?? col}
                        </span>
                      </th>
                    ))}
                    <th className="text-left px-2 py-1 border">Thao tác</th>
                    <th className="text-left px-2 py-1 border w-12">...</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.map(({ row, rowIdx }) => (
                    <Fragment key={`row-${rowIdx}`}>
                      <tr className={`border-t ${rowErrors[rowIdx] ? "bg-red-50/40" : "border-gray-100"}`}>
                        <td className="border px-1 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={selectedRowIndexes.includes(rowIdx)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRowIndexes((prev) => (prev.includes(rowIdx) ? prev : [...prev, rowIdx]));
                              }
                              else setSelectedRowIndexes((prev) => prev.filter((idx) => idx !== rowIdx));
                            }}
                          />
                        </td>
                        {columns.map((col) => (
                          <td key={`${rowIdx}-${col}`} className="border px-1 py-1">
                            {editingCell?.rowIdx === rowIdx && editingCell.col === col ? (
                              <input
                                autoFocus
                                className={`input text-xs py-1 px-1 h-7 ${rowErrors[rowIdx] ? "border-red-300" : ""}`}
                                value={row[col] ?? ""}
                                onChange={(e) => updateCell(rowIdx, col, e.target.value)}
                                onBlur={() => setEditingCell(null)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === "Escape") setEditingCell(null);
                                }}
                              />
                            ) : (
                              <button
                                className="w-full text-left px-1 py-1 min-h-7 border border-transparent hover:border-gray-200"
                                onClick={() => setEditingCell({ rowIdx, col })}
                              >
                                {col === "HoVaTen" ? (
                                  <span className="inline-flex items-center gap-1">
                                    {rowErrors[rowIdx]?.length ? (
                                      <button
                                        className="text-amber-700"
                                        title="Xem lỗi dòng"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          setErrorPopover({ rowIdx, x: rect.left, y: rect.bottom + 6 });
                                        }}
                                      >
                                        ⚠
                                      </button>
                                    ) : null}
                                    <span>{row[col] || "-"}</span>
                                    {priorityCustomers.includes(
                                      toPriorityKey(String(row.HoVaTen || ""), String(row.Email || ""), String(row.SDT || "")),
                                    ) ? (
                                      <span className="border border-amber-300 bg-amber-50 px-1 text-[10px] text-amber-700">
                                        Ưu tiên
                                      </span>
                                    ) : null}
                                  </span>
                                ) : (
                                  (row[col] || "-")
                                )}
                              </button>
                            )}
                          </td>
                        ))}
                        <td className="border px-1 py-1">
                          <button className="btn-secondary text-[11px] px-2 py-1" title="Xóa dòng" onClick={() => deleteRow(rowIdx)}>
                            🗑
                          </button>
                        </td>
                        <td className="border px-1 py-1 text-center">
                          <button
                            className="btn-secondary text-[11px] px-2"
                            onClick={() => setExpandedRowIndex((prev) => (prev === rowIdx ? null : rowIdx))}
                          >
                            ...
                          </button>
                        </td>
                      </tr>
                      {expandedRowIndex === rowIdx ? (
                        <tr>
                          <td className="border px-2 py-2 bg-gray-50" colSpan={columns.length + 3}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                              {extraColumns.length > 0 ? (
                                extraColumns.map((col) => (
                                  <div key={`${rowIdx}-extra-${col}`} className="border border-gray-200 bg-white px-2 py-1">
                                    <p className="text-[11px] text-gray-500">{COLUMN_LABELS[col] ?? col}</p>
                                    {editingCell?.rowIdx === rowIdx && editingCell.col === col ? (
                                      <input
                                        autoFocus
                                        className="input text-xs py-1 px-1 h-7 mt-1"
                                        value={row[col] ?? ""}
                                        onChange={(e) => updateCell(rowIdx, col, e.target.value)}
                                        onBlur={() => setEditingCell(null)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" || e.key === "Escape") setEditingCell(null);
                                        }}
                                      />
                                    ) : (
                                      <button
                                        className="w-full text-left px-1 py-1 h-7 mt-1 border border-transparent hover:border-gray-200"
                                        onClick={() => setEditingCell({ rowIdx, col })}
                                      >
                                        {row[col] || "-"}
                                      </button>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <p className="text-[11px] text-gray-500">Không có cột phụ trong list này.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              </div>
              <div className="flex justify-end">
                <button className="btn-secondary text-sm px-2 py-1" title="Thêm dòng" onClick={addRow}>
                  +
                </button>
              </div>
              {errorPopover ? (
                <div
                  className="fixed z-40 w-72 border border-amber-300 bg-white p-2 shadow-lg"
                  style={{ left: errorPopover.x, top: errorPopover.y }}
                >
                  <p className="text-xs font-medium text-amber-700 mb-1">Lý do lỗi dòng</p>
                  <ul className="list-disc pl-4 text-xs text-gray-700">
                    {(rowErrors[errorPopover.rowIdx] || []).map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                  <div className="mt-2 flex justify-end">
                    <button className="btn-secondary text-[11px]" onClick={() => setErrorPopover(null)}>
                      Đóng
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {analysisModalOpen ? (
            <div
              className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
              role="presentation"
              onClick={() => setAnalysisModalOpen(false)}
            >
              <div
                className="w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-white border border-gray-200 shadow-xl p-5 space-y-5"
                role="dialog"
                aria-modal="true"
                aria-labelledby="analysis-modal-title"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 id="analysis-modal-title" className="text-lg font-semibold text-gray-900">
                      Tổng quan phân tích
                    </h3>
                    {analysisResult ? (
                      <p className="text-xs text-gray-500 mt-0.5">{analysisResult.list_name}</p>
                    ) : null}
                  </div>
                  <button type="button" className="btn-secondary text-xs shrink-0" onClick={() => setAnalysisModalOpen(false)}>
                    Đóng
                  </button>
                </div>
                {!analysisResult ? (
                  <div className="border border-gray-200 bg-gray-50 p-4 text-sm space-y-3 rounded-none">
                    <p className="text-gray-700">Danh sách này chưa có kết quả phân tích.</p>
                    <button type="button" className="btn-primary text-xs" onClick={() => void analyzeCurrentTable()} disabled={analyzing}>
                      {analyzing ? "Đang phân tích..." : "Phân tích ngay"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {(() => {
                      const ov = analysisResult.analysis.overview;
                      const seg = analysisResult.analysis.segmentation.summary;
                      const churn30 = analysisResult.analysis.churn_risk.inactive_over_30_days;
                      const recentPct =
                        ov.recent_activity_30d_percent ??
                        analysisResult.analysis.retention?.recent_activity_30d_percent ??
                        ov.retention_rate_percent ??
                        0;
                      const activityCopy = recentActivityKpiCopy(recentPct, churn30, ov.total_customers);
                      const activityStrong =
                        churn30 > 0
                          ? "border-amber-400 bg-amber-50 ring-1 ring-amber-200/80"
                          : recentPct >= 60
                            ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200/80"
                            : recentPct >= 35
                              ? "border-amber-300 bg-amber-50/90"
                              : "border-red-200 bg-red-50/80";
                      const riskStrong =
                        seg.churn_risk > 0
                          ? "border-red-500 bg-red-50 ring-2 ring-red-200/90 shadow-sm"
                          : "border-gray-200 bg-gray-50/90";
                      return (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="border border-slate-200 bg-slate-50/80 p-3 rounded-none">
                              <p className="text-sm font-semibold text-gray-900 leading-snug">
                                👥 Khoảng <span className="tabular-nums text-lg">{ov.total_customers}</span> khách trong danh sách
                              </p>
                              <p className="text-[10px] text-gray-500 mt-1.5">Quy mô để lên kế hoạch chạm tới.</p>
                            </div>
                            <div className="border border-slate-200 bg-white p-3 rounded-none">
                              <p className="text-sm font-semibold text-gray-900 leading-snug">{revenueStatement(ov.total_revenue)}</p>
                              <p className="text-[10px] text-gray-500 mt-1.5">Từ cột tổng chi trả trên dữ liệu của bạn.</p>
                            </div>
                            <div className={`border-2 p-3 rounded-none ${activityStrong}`}>
                              <p className="text-sm font-semibold text-gray-900 leading-snug">{activityCopy.main}</p>
                              <p className="text-[10px] text-gray-600 mt-1.5 leading-snug">{activityCopy.sub}</p>
                            </div>
                            <div className={`border-2 p-3 rounded-none ${riskStrong}`}>
                              <p className="text-sm font-semibold text-gray-900 leading-snug">
                                {seg.churn_risk > 0 ? (
                                  <>
                                    <span className="text-red-600">⚠️</span> Khả năng (rule):{" "}
                                    <span className="tabular-nums">{seg.churn_risk}</span> khách
                                  </>
                                ) : (
                                  "✅ Không có khả năng rời bỏ đáng kể (rule)"
                                )}
                              </p>
                              <p className="text-[10px] text-gray-600 mt-1.5 tabular-nums">
                                &gt;30 ngày không chi trả: {churn30} khách
                              </p>
                            </div>
                          </div>
                          {analysisInsightBullets.length > 0 ? (
                            <div className="border border-gray-200 bg-gray-50 px-3 py-2.5 rounded-none space-y-2">
                              {seg.churn_risk > 0 ? (
                                <p className="text-xs font-semibold text-amber-900">
                                  👉 <span className="tabular-nums">{seg.churn_risk}</span> khách cần ưu tiên xử lý ngay
                                </p>
                              ) : null}
                              <ul className="space-y-1">
                                {analysisInsightBullets.map((line, i) => (
                                  <li key={i} className="text-xs font-semibold text-gray-900">
                                    {line}
                                  </li>
                                ))}
                              </ul>
                              {seg.churn_risk > 0 ? (
                                <div className="flex flex-wrap gap-2 pt-1">
                                  <button
                                    type="button"
                                    className="btn-secondary text-[10px]"
                                    onClick={() => {
                                      setAnalysisTableSegmentFilter("churn_risk");
                                      setAnalysisModalOpen(false);
                                      setMessage("Đã bật lọc nhóm có khả năng rời bỏ trên bảng.");
                                    }}
                                  >
                                    Lọc nhóm có khả năng
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-primary text-[10px]"
                                    onClick={() => {
                                      setAnalysisModalOpen(false);
                                      setSegmentHubPanel(null);
                                      void router.push("/outreach/churn");
                                    }}
                                  >
                                    Gửi email nhóm có khả năng
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </>
                      );
                    })()}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="border border-gray-100 p-2 min-h-[280px]">
                        <p className="text-xs font-semibold text-gray-700 px-2 pt-1 pb-2">Phân bổ nhóm</p>
                        {segmentPieData.length === 0 ? (
                          <p className="text-xs text-gray-500 p-4">Chưa có dữ liệu để vẽ biểu đồ.</p>
                        ) : (
                          <ResponsiveContainer width="100%" height={240}>
                            <PieChart>
                              <Pie
                                data={segmentPieData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={88}
                                label={({ name, percent }) =>
                                  `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                                }
                              >
                                {segmentPieData.map((entry) => (
                                  <Cell key={entry.name} fill={entry.fill} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v: number) => [`${v} khách`, ""]} />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                      <div className="border border-gray-100 p-2 min-h-[280px]">
                        <p className="text-xs font-semibold text-gray-700 px-2 pt-1 pb-2">
                          Thời gian không quay lại (từ lần chi trả cuối)
                        </p>
                        {inactiveSinceLastChartData.length === 0 ? (
                          <p className="text-xs text-gray-500 p-4">
                            Chạy phân tích lại để có histogram theo ngày (hoặc chưa đủ cột ngày).
                          </p>
                        ) : (
                          <ResponsiveContainer width="100%" height={240}>
                            <BarChart
                              data={inactiveSinceLastChartData}
                              margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                              <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-18} textAnchor="end" height={56} />
                              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={32} />
                              <Tooltip formatter={(v: number) => [`${v} khách`, ""]} />
                              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {inactiveSinceLastChartData.map((entry) => (
                                  <Cell key={entry.key} fill={entry.fill} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                      <div className="border border-gray-100 p-2 min-h-[260px]">
                        <p className="text-xs font-semibold text-gray-700 px-2 pt-1 pb-2">
                          Doanh thu theo loại khách (cột gốc)
                        </p>
                        {revenueByCustomerTypeChartData.length === 0 ? (
                          <p className="text-xs text-gray-500 p-4">
                            Chạy phân tích lại để gom theo cột Loại khách hàng (hoặc chưa có dữ liệu).
                          </p>
                        ) : revenueByCustomerTypeChartData.every((d) => d.value <= 0) ? (
                          <p className="text-xs text-gray-500 p-4">Chưa ghi nhận doanh thu theo loại khách.</p>
                        ) : (
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart
                              data={revenueByCustomerTypeChartData}
                              margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                              <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-14} textAnchor="end" height={52} />
                              <YAxis tick={{ fontSize: 10 }} width={40} tickFormatter={(v) => formatMoneyVi(Number(v))} />
                              <Tooltip
                                formatter={(v: number) => [`${formatMoneyVi(v)}`, ""]}
                                labelFormatter={(label) => String(label)}
                              />
                              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {revenueByCustomerTypeChartData.map((entry) => (
                                  <Cell key={entry.name} fill={entry.fill} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                      <div className="border border-gray-100 p-2 min-h-[260px]">
                        <p className="text-xs font-semibold text-gray-700 px-2 pt-1 pb-2">
                          Giá trị trung bình / khách (nhóm phân tích)
                        </p>
                        {arpuBySegmentChartData.every((d) => d.value <= 0) ? (
                          <p className="text-xs text-gray-500 p-4">Chưa có ARPU theo nhóm.</p>
                        ) : (
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={arpuBySegmentChartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={48} />
                              <YAxis tick={{ fontSize: 10 }} width={36} tickFormatter={(v) => formatArpuVi(Number(v))} />
                              <Tooltip formatter={(v: number) => [`${formatArpuVi(v)}`, "Trung bình / khách"]} />
                              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {arpuBySegmentChartData.map((entry) => (
                                  <Cell key={entry.key} fill={entry.fill} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-bold text-gray-800 uppercase tracking-wide">Phân nhóm &amp; hành động</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          Bấm ô vuông để xem mô tả, gợi ý hệ thống và lọc bảng.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {(
                          [
                            { id: "vip" as const, label: "VIP", count: analysisResult.analysis.segmentation.summary.vip },
                            {
                              id: "potential" as const,
                              label: "Tiềm năng",
                              count: analysisResult.analysis.segmentation.summary.potential,
                            },
                            {
                              id: "churn_risk" as const,
                              label: "Khả năng",
                              count: analysisResult.analysis.segmentation.summary.churn_risk,
                            },
                            { id: "new" as const, label: "Khách mới", count: analysisResult.analysis.segmentation.summary.new },
                          ] as const
                        ).map((item) => {
                          const TileIcon = SEGMENT_TILE_ICON[item.id] ?? UserPlus;
                          const style = SEGMENT_CARD_STYLE[item.id] ?? "border-gray-200 bg-white";
                          const active = segmentHubPanel === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setSegmentHubPanel((p) => (p === item.id ? null : item.id))}
                              className={`flex aspect-square max-h-[7.25rem] w-full flex-col items-center justify-center gap-1 border-2 p-2 text-center transition outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${style} ${
                                active ? "ring-2 ring-blue-600 ring-offset-1" : "hover:brightness-[0.97]"
                              }`}
                            >
                              <TileIcon className="h-7 w-7 shrink-0 text-gray-800" aria-hidden />
                              <span className="text-[11px] font-bold leading-tight text-gray-900">{item.label}</span>
                              <span className="tabular-nums text-sm font-bold text-gray-900">{item.count}</span>
                            </button>
                          );
                        })}
                      </div>

                      {segmentHubPanel ? (
                        <div
                          className="relative border-2 border-slate-300 bg-white p-3 shadow-sm"
                          role="region"
                          aria-label="Chi tiết nhóm đã chọn"
                        >
                          <button
                            type="button"
                            className="absolute right-2 top-2 rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                            aria-label="Đóng"
                            onClick={() => setSegmentHubPanel(null)}
                          >
                            <X className="h-4 w-4" />
                          </button>
                          {(() => {
                            const item = (
                              [
                                { id: "vip" as const, label: "VIP", count: analysisResult.analysis.segmentation.summary.vip },
                                {
                                  id: "potential" as const,
                                  label: "Tiềm năng",
                                  count: analysisResult.analysis.segmentation.summary.potential,
                                },
                                {
                                  id: "churn_risk" as const,
                                  label: "Khả năng rời bỏ",
                                  count: analysisResult.analysis.segmentation.summary.churn_risk,
                                },
                                { id: "new" as const, label: "Khách mới", count: analysisResult.analysis.segmentation.summary.new },
                              ] as const
                            ).find((x) => x.id === segmentHubPanel)!;
                            const suggested = pickSuggestedActionForSegment(
                              segmentHubPanel,
                              analysisResult.analysis.suggested_actions,
                            );
                            const campaignPayload =
                              suggested ??
                              getCampaignActionForSegment(segmentHubPanel, analysisResult.analysis.suggested_actions);
                            return (
                              <div className="space-y-3 pr-6">
                                <div>
                                  <p className="text-sm font-bold text-gray-900">
                                    {item.label}{" "}
                                    <span className="tabular-nums font-semibold text-gray-600">({item.count} khách)</span>
                                  </p>
                                  <p className="text-xs font-medium text-gray-800 mt-1">{SEGMENT_CARD_COPY[item.id]}</p>
                                  <p className="text-xs text-gray-700 leading-snug mt-0.5">
                                    {SEGMENT_CARD_ACTION_HINT[item.id]}
                                  </p>
                                </div>
                                {suggested ? (
                                  <div className="border border-emerald-200 bg-emerald-50/60 px-2.5 py-2 space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-900">
                                      Gợi ý từ hệ thống
                                    </p>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="text-xs font-semibold text-gray-900">{suggested.title}</span>
                                      <span className="text-[9px] border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-amber-900">
                                        {PRIORITY_FRIENDLY[suggested.priority] ?? suggested.priority}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-800">{suggested.goal}</p>
                                    {suggested.reason ? (
                                      <p className="text-[11px] text-gray-700 border-l-2 border-emerald-400 pl-2">
                                        → {suggested.reason}
                                      </p>
                                    ) : null}
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-gray-500">Chưa có gợi ý riêng cho nhóm này.</p>
                                )}
                                <div className="flex flex-wrap gap-2 pt-0.5">
                                  {item.id === "churn_risk" && item.count > 0 ? (
                                    <button
                                      type="button"
                                      className="btn-primary text-[11px]"
                                      disabled={applyingChurnPriority || analyzing}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void applyChurnRiskFromAnalysisAndFilter();
                                        setAnalysisModalOpen(false);
                                        setSegmentHubPanel(null);
                                      }}
                                    >
                                      Lọc &amp; ưu tiên
                                    </button>
                                  ) : null}
                                  {item.count > 0 ? (
                                    <button
                                      type="button"
                                      className="btn-primary text-[11px]"
                                      disabled={creatingCampaign}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void createCampaignFromAction(campaignPayload);
                                      }}
                                    >
                                      {creatingCampaign ? "Đang tạo..." : "Tạo chiến dịch"}
                                    </button>
                                  ) : null}
                                  {item.count > 0 ? (
                                    <button
                                      type="button"
                                      className="btn-secondary text-[11px]"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAnalysisModalOpen(false);
                                        setSegmentHubPanel(null);
                                        void router.push(`/outreach/${item.id === "churn_risk" ? "churn" : item.id}`);
                                      }}
                                    >
                                      Liên hệ nhanh
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="btn-secondary text-[11px]"
                                    disabled={item.count <= 0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAnalysisTableSegmentFilter(item.id);
                                      setAnalysisModalOpen(false);
                                      setSegmentHubPanel(null);
                                      setMessage(`Đang lọc bảng theo nhóm: ${SEGMENT_FRIENDLY[item.id] ?? item.label}.`);
                                    }}
                                  >
                                    Xem trên bảng
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex justify-end pt-1">
                      <button type="button" className="btn-primary text-xs" onClick={() => void analyzeCurrentTable()} disabled={analyzing}>
                        {analyzing ? "Đang phân tích..." : "Phân tích lại"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
        </div>
      )}
      {quickOutreachOpen ? (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/45 p-3 backdrop-blur-[2px] sm:p-4"
          role="presentation"
          onClick={() => {
            if (!quickOutreachSending) {
              setQuickOutreachOpen(false);
              setQuickOutreachResults(null);
              setAiPurposeMenuOpen(false);
            }
          }}
        >
          <div
            className="flex max-h-[min(92vh,720px)] w-full max-w-[26rem] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_25px_50px_-12px_rgba(15,23,42,0.28)] sm:max-w-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-outreach-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="shrink-0 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white px-4 pb-3 pt-4 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                    <Mail className="h-[18px] w-[18px]" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <h3 id="quick-outreach-title" className="text-[15px] font-semibold leading-tight text-slate-900">
                      Gửi email
                    </h3>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                      <span className="tabular-nums font-medium text-slate-700">{quickOutreachRecipients?.length ?? 0}</span>{" "}
                      người nhận
                      {smartContactCampaignId && (
                        <span className="ml-1.5 inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                          Track KPIs
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50"
                  disabled={quickOutreachSending}
                  title="Đóng"
                  aria-label="Đóng"
                  onClick={() => {
                    setQuickOutreachOpen(false);
                    setQuickOutreachResults(null);
                    setAiPurposeMenuOpen(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
              <div className="rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm">
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600" htmlFor="smart-contact-campaign-pick">
                  <Megaphone className="h-3.5 w-3.5 text-sky-500" />
                  Gắn chiến dịch (để track KPIs)
                </label>
                <select
                  id="smart-contact-campaign-pick"
                  className="input mt-1 w-full text-sm"
                  value={smartContactCampaignId}
                  disabled={quickOutreachSending || quickOutreachCampaignsLoading}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSmartContactCampaignId(id);
                    if (id) void applyCampaignContentToSmartContact(id);
                  }}
                >
                  <option value="">{quickOutreachCampaignsLoading ? "Đang tải…" : "— Chọn chiến dịch (tuỳ chọn) —"}</option>
                  {quickOutreachCampaignList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.campaign_name}
                    </option>
                  ))}
                </select>
                {!quickOutreachCampaignsLoading && quickOutreachCampaignList.length === 0 ? (
                  <p className="mt-1 text-[10px] text-amber-700">Chưa có chiến dịch nào có kênh Email. Tạo chiến dịch ở mục Chiến dịch hoặc nhập tay bên dưới.</p>
                ) : null}
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5">
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-950" htmlFor="smart-contact-brand-pick">
                  <Palette className="h-3.5 w-3.5 text-emerald-600" />
                  Hồ sơ thương hiệu (khi dùng AI)
                </label>
                <select
                  id="smart-contact-brand-pick"
                  className="input mt-1 w-full text-sm"
                  value={smartContactBrandPick}
                  disabled={quickOutreachSending || quickOutreachCampaignsLoading}
                  onChange={(e) => setSmartContactBrandPick(e.target.value)}
                >
                  <option value="">
                    {quickOutreachCampaignsLoading ? "Đang tải…" : "— Mặc định: hồ sơ cập nhật gần nhất —"}
                  </option>
                  {smartContactBrandList.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.brand_name}
                    </option>
                  ))}
                </select>
                {!quickOutreachCampaignsLoading && smartContactBrandList.length === 0 ? (
                  <p className="mt-1 text-[10px] text-amber-800">
                    Chưa có hồ sơ thương hiệu — tạo trong mục Brand Vault để AI soạn đúng ngành hình và giọng điệu.
                  </p>
                ) : null}
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                  <Type className="h-3.5 w-3.5 text-slate-400" />
                  Tiêu đề email
                </label>
                <input
                  type="text"
                  className="input mt-1 w-full text-sm"
                  value={quickOutreachSubject}
                  onChange={(e) => setQuickOutreachSubject(e.target.value)}
                  disabled={quickOutreachSending}
                  placeholder="Ví dụ: Lời nhắn từ cửa hàng"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  Nội dung
                </label>
                <div ref={aiMenuWrapRef} className="relative mt-1">
                  <textarea
                    ref={quickOutreachTextareaRef}
                    className="input min-h-[168px] w-full resize-y pb-11 pr-12 text-[13px] leading-relaxed"
                    value={quickOutreachBody}
                    onChange={(e) => setQuickOutreachBody(e.target.value)}
                    disabled={quickOutreachSending}
                    placeholder="Soạn nội dung email… Bấm icon AI ở góc để chọn mục đích hoặc hoàn thiện đoạn đang gõ."
                  />
                  <button
                    type="button"
                    className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white shadow-md transition hover:bg-violet-700 disabled:opacity-45"
                    disabled={quickOutreachSending || smartComposeLoading}
                    title="Gợi ý AI — chọn mục đích hoặc hoàn thiện bản nháp"
                    aria-label="Mở gợi ý AI"
                    aria-expanded={aiPurposeMenuOpen}
                    onClick={(e) => {
                      e.stopPropagation();
                      setAiPurposeMenuOpen((v) => !v);
                    }}
                  >
                    {smartComposeLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" strokeWidth={2} />
                    )}
                  </button>
                  {aiPurposeMenuOpen ? (
                    <div
                      className="absolute bottom-11 right-0 z-10 w-[min(calc(100vw-2rem),15.5rem)] rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                      role="menu"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="border-b border-slate-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Mẫu theo mục đích
                      </p>
                      <div className="max-h-52 overflow-y-auto py-1">
                        {(
                          [
                            { key: "nhac_nhe" as const, label: "Nhắc quay lại" },
                            { key: "cham_soc" as const, label: "Chăm sóc" },
                            { key: "kich_hoat" as const, label: "Kích hoạt" },
                            { key: "khach_moi" as const, label: "Khách mới" },
                          ] as const
                        ).map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            role="menuitem"
                            className="flex w-full px-3 py-2 text-left text-[11px] text-slate-800 hover:bg-violet-50 disabled:opacity-50"
                            disabled={quickOutreachSending || smartComposeLoading}
                            onClick={() => void runSmartContactAiCompose(item.key)}
                          >
                            {item.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full border-t border-slate-100 px-3 py-2 text-left text-[11px] font-medium text-violet-800 hover:bg-violet-50 disabled:opacity-50"
                          disabled={quickOutreachSending || smartComposeLoading}
                          onClick={() => void runSmartContactAiCompose("refine")}
                        >
                          Chỉ hoàn thiện bản nháp
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-slate-50/90 px-3 py-2.5">
                <p className="mb-2 text-[11px] font-medium text-slate-600">Xem trước (tối đa 3 khách)</p>
                <ul className="max-h-36 space-y-2.5 overflow-y-auto text-[11px] text-slate-800">
                  {quickOutreachPreviewSamples.length === 0 ? (
                    <li className="text-slate-400">—</li>
                  ) : (
                    quickOutreachPreviewSamples.map((s, i) => (
                      <li key={i} className="border-b border-slate-200/60 pb-2 last:border-0 last:pb-0">
                        <span className="font-semibold text-slate-900">{s.name}</span>
                        <span className="mt-1 block whitespace-pre-wrap leading-snug text-slate-700">{s.text}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              {quickOutreachResults ? (
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px]">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Kết quả gửi</p>
                  {quickOutreachResults.map((r, i) => (
                    <div key={i} className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 border-t border-slate-100 pt-1 first:border-0 first:pt-0">
                      <span className="font-mono text-slate-800">{r.to}</span>
                      <span
                        className={
                          r.status === "sent"
                            ? "font-medium text-emerald-700"
                            : r.status === "failed"
                              ? "font-medium text-red-700"
                              : "font-medium text-amber-700"
                        }
                      >
                        {r.status === "sent" ? "Đã gửi" : r.status === "failed" ? "Lỗi" : "Bỏ qua"}
                      </span>
                      {r.detail ? <span className="text-slate-500">— {r.detail}</span> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/90 px-4 py-3 sm:px-5">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50"
                disabled={quickOutreachSending || !quickOutreachRecipients?.length}
                onClick={() => void submitQuickOutreach()}
              >
                {quickOutreachSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang gửi…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Gửi ngay
                  </>
                )}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
      {analyzing ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-gray-200 p-4 space-y-2">
            <p className="font-medium">Đang phân tích dữ liệu...</p>
            <p className="text-sm text-gray-600">Đang phân tích</p>
            <div className="h-2 bg-gray-100">
              <div className="h-2 bg-blue-600 animate-pulse w-3/4" />
            </div>
          </div>
        </div>
      ) : null}

      {mappingModalOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white border border-gray-200 p-4 space-y-3">
            <h3 className="text-lg font-semibold">Xác nhận mapping cột import</h3>
            <p className="text-sm text-gray-600">Vui lòng map cột bắt buộc: Họ và tên, SĐT.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {[
                "HoVaTen",
                "SDT",
                "Email",
                "LoaiKhachHang",
                "LanCuoiChiTra",
                "TongSoTienDaChiTra",
                "TongSoLanQuayLai",
              ].map((target) => (
                <div key={target} className="border border-gray-200 p-2">
                  <p className="text-xs text-gray-500 mb-1">{COLUMN_LABELS[target] ?? target}</p>
                  <select
                    className="input text-sm"
                    value={columnMapping[target] || ""}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({
                        ...prev,
                        [target]: e.target.value,
                      }))
                    }
                  >
                    <option value="">-- Không chọn --</option>
                    {importedHeadersPending.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="btn-secondary text-xs"
                onClick={() => {
                  setMappingModalOpen(false);
                  setImportedRowsPending([]);
                  setImportedHeadersPending([]);
                }}
              >
                Hủy
              </button>
              <button className="btn-primary text-xs" onClick={applyMappedImport}>
                Áp dụng import
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {createListModalOpen ? (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
          role="presentation"
          onClick={() => {
            setCreateListModalOpen(false);
            setNewTableName("");
          }}
        >
          <div
            className="w-full max-w-md bg-white border border-gray-200 shadow-xl p-5 space-y-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-list-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="create-list-title" className="text-base font-semibold text-gray-900">
              Tạo danh sách mới
            </h3>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void createTable();
              }}
            >
              <div>
                <label htmlFor="new-list-name" className="block text-xs font-medium text-gray-600 mb-1">
                  Tên danh sách
                </label>
                <input
                  id="new-list-name"
                  className="input text-sm w-full"
                  placeholder="Ví dụ: Khách tháng 4"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => {
                    setCreateListModalOpen(false);
                    setNewTableName("");
                  }}
                >
                  Hủy
                </button>
                <button type="submit" className="btn-primary text-xs">
                  Tạo
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

    </div>
  );
}
