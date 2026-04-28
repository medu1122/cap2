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
import { BarChart3, Filter, RefreshCw, Wrench, X } from "lucide-react";
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
      retention_rate_percent: number;
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
      retention_rate_percent: number;
      top_returning_customers: Array<{ customer_name: string; return_count: number }>;
    };
    churn_risk: {
      inactive_over_30_days: number;
      inactive_over_60_days: number;
      high_risk_customers: Array<{ customer_name: string; days_since_last_payment: number; email?: string; phone?: string }>;
      medium_risk_customers: Array<{ customer_name: string; days_since_last_payment: number; email?: string; phone?: string }>;
    };
    segmentation: {
      summary: { vip: number; potential: number; churn_risk: number; new: number };
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
  "ID",
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
  ID: "ID",
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
  churn_risk: "Nguy cơ rời bỏ",
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

function buildKeyInsights(analysis: CustomerAnalysisResponse["analysis"]): string[] {
  const out: string[] = [];
  const seg = analysis.segmentation.summary;
  const churn = seg.churn_risk;
  const inactive60 = analysis.churn_risk.inactive_over_60_days;
  if (churn > 0) {
    out.push(
      `⚠️ ${churn} khách đang ở nhóm nguy cơ rời bỏ — nên có kế hoạch tái kích hoạt sớm.`,
    );
  }
  if (inactive60 > 0) {
    out.push(
      `⏱️ ${inactive60} khách đã hơn 60 ngày chưa phát sinh chi trả — cần chú ý hơn.`,
    );
  }
  if (seg.vip > 0) {
    out.push(
      `💰 Nhóm VIP (${seg.vip} khách) thường mang giá trị cao — phù hợp chăm sóc riêng và upsell.`,
    );
  } else if (seg.potential > 0) {
    out.push(
      `📈 Nhóm tiềm năng (${seg.potential} khách) có thể chuyển hóa thêm với chiến dịch phù hợp.`,
    );
  }
  return out.slice(0, 3);
}

const SEGMENT_CARD_COPY: Record<string, string> = {
  vip: "Khách giá trị cao — phù hợp chăm sóc riêng, ưu đãi VIP.",
  potential: "Còn dư địa tăng tần suất và giá trị đơn hàng.",
  churn_risk: "Đã lâu không quay lại — ưu tiên kích hoạt lại.",
  new: "Mới phát sinh — cần onboarding để giữ chân.",
};

function emptyRow(): Record<string, string> {
  return Object.fromEntries(TEMPLATE_COLUMNS.map((c) => [c, ""])) as Record<string, string>;
}

function normalizeRows(rows: Record<string, unknown>[]): Record<string, string>[] {
  return rows.map((row, idx) => {
    const out: Record<string, string> = { ...emptyRow() };
    for (const key of Object.keys(row || {})) {
      out[key] = String(row[key] ?? "");
    }
    if (!out.ID) out.ID = String(idx + 1);
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
  const [sortPriorityFirst, setSortPriorityFirst] = useState(true);
  const [showPrioritySuggestion, setShowPrioritySuggestion] = useState(false);
  const [selectedRowIndexes, setSelectedRowIndexes] = useState<number[]>([]);
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [analysisByList, setAnalysisByList] = useState<Record<string, CustomerAnalysisResponse>>({});
  const [autoSaving, setAutoSaving] = useState(false);
  const [rowsDirty, setRowsDirty] = useState(false);
  const isHydratingRowsRef = useRef(false);
  const prevHasRowErrorsRef = useRef<boolean>(false);
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [createListModalOpen, setCreateListModalOpen] = useState(false);
  const [importedRowsPending, setImportedRowsPending] = useState<Record<string, string>[]>([]);
  const [importedHeadersPending, setImportedHeadersPending] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [quickToolsOpen, setQuickToolsOpen] = useState(false);

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
  const displayedRows = useMemo(() => {
    let mapped = rows.map((row, rowIdx) => ({ row, rowIdx }));
    if (sortPriorityFirst) {
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
    }
    if (!onlyPriorityTableView) return mapped;
    return mapped.filter(({ row }) =>
      priorityCustomers.includes(
        toPriorityKey(String(row.HoVaTen || ""), String(row.Email || ""), String(row.SDT || "")),
      ),
    );
  }, [rows, onlyPriorityTableView, priorityCustomers, sortPriorityFirst]);

  const segmentChartData = useMemo(() => {
    if (!analysisResult?.analysis?.segmentation?.summary) return [];
    const s = analysisResult.analysis.segmentation.summary;
    return [
      { name: "VIP", value: s.vip, fill: "#7c3aed" },
      { name: "Tiềm năng", value: s.potential, fill: "#0ea5e9" },
      { name: "Nguy cơ rời bỏ", value: s.churn_risk, fill: "#ef4444" },
      { name: "Khách mới", value: s.new, fill: "#22c55e" },
    ];
  }, [analysisResult]);

  const segmentPieData = useMemo(
    () => segmentChartData.filter((d) => d.value > 0),
    [segmentChartData],
  );

  const analysisInsights = useMemo(
    () => (analysisResult ? buildKeyInsights(analysisResult.analysis) : []),
    [analysisResult],
  );

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
      setAnalysisResult(analysisByList[res.table.id] || null);
      setShowTableEditor(true);
      setExpandedRowIndex(null);
      setOnlyPriorityTableView(false);
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
    setRows((prev) => [...prev, { ...emptyRow(), ID: String(prev.length + 1) }]);
    setRowsDirty(true);
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      setEditingCell({ rowIdx: nextIndex, col: "HoVaTen" });
    }, 80);
  }

  function deleteRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index).map((r, idx) => ({ ...r, ID: String(idx + 1) })));
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
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2>{activeListName ? `Danh sách khách hàng - ${activeListName}` : "Chọn danh sách để thao tác"}</h2>
            <div className="flex items-center gap-2">
              <button className="btn-secondary text-xs" onClick={() => setShowTableEditor(false)}>
                Quay lại
              </button>
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
              <div className="flex items-center justify-end">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[11px] border border-amber-300 bg-amber-50 px-2 py-[2px] text-amber-800">
                    Khách ưu tiên: {priorityCustomers.length}
                  </span>
                  <label className="text-[11px] inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={sortPriorityFirst}
                      onChange={(e) => setSortPriorityFirst(e.target.checked)}
                    />
                    Sắp xếp ưu tiên lên đầu
                  </label>
                  <label className="text-[11px] inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={onlyPriorityTableView}
                      onChange={(e) => setOnlyPriorityTableView(e.target.checked)}
                    />
                    Chỉ hiện khách ưu tiên trong bảng
                  </label>
                  <button
                    className="btn-secondary text-[11px]"
                    disabled={priorityCustomers.length === 0}
                    onClick={() => void clearAllPriorityCustomers()}
                  >
                    Bỏ tất cả ưu tiên
                  </button>
                  <button
                    className="btn-secondary text-[11px]"
                    disabled={selectedRowIndexes.length === 0}
                    onClick={() => void bulkTogglePriority(true)}
                  >
                    Đánh dấu ưu tiên ({selectedRowIndexes.length})
                  </button>
                  <button
                    className="btn-secondary text-[11px]"
                    disabled={selectedRowIndexes.length === 0}
                    onClick={() => void bulkTogglePriority(false)}
                  >
                    Bỏ ưu tiên đã chọn
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
                      const retentionPct = ov.retention_rate_percent;
                      const retentionTone =
                        retentionPct >= 60
                          ? "border-emerald-200 bg-emerald-50/90"
                          : retentionPct >= 35
                            ? "border-amber-200 bg-amber-50/90"
                            : "border-red-100 bg-red-50/80";
                      const riskTone =
                        seg.churn_risk > 0 ? "border-red-300 bg-red-50/90" : "border-gray-200 bg-gray-50/80";
                      return (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="border border-gray-200 bg-white p-3 rounded-none">
                            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Tổng khách</p>
                            <p className="text-2xl font-semibold text-gray-900 tabular-nums mt-1">{ov.total_customers}</p>
                          </div>
                          <div className="border border-gray-200 bg-white p-3 rounded-none">
                            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Tổng doanh thu</p>
                            <p className="text-2xl font-semibold text-gray-900 tabular-nums mt-1">{formatMoneyVi(ov.total_revenue)}</p>
                          </div>
                          <div className={`border p-3 rounded-none ${retentionTone}`}>
                            <p className="text-[11px] font-medium text-gray-600 uppercase tracking-wide">Tỷ lệ giữ chân</p>
                            <p className="text-2xl font-semibold tabular-nums mt-1">{retentionPct}%</p>
                          </div>
                          <div className={`border p-3 rounded-none ${riskTone}`}>
                            <p className="text-[11px] font-medium text-gray-600 uppercase tracking-wide">Nguy cơ rời bỏ (nhóm)</p>
                            <p className="text-2xl font-semibold tabular-nums mt-1">{seg.churn_risk}</p>
                            <p className="text-[10px] text-gray-500 mt-1">
                              &gt;30 ngày: {churn30} khách
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {analysisResult.analysis.narrative ? (
                      <div className="border border-indigo-100 bg-indigo-50/60 p-3 rounded-none">
                        <p className="text-[11px] font-medium text-indigo-900 mb-1">Tóm tắt nhanh</p>
                        <p className="text-sm text-gray-800 whitespace-pre-line line-clamp-4">{analysisResult.analysis.narrative}</p>
                      </div>
                    ) : null}

                    {analysisInsights.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-700">Điểm cần chú ý</p>
                        <ul className="space-y-2">
                          {analysisInsights.map((line, i) => (
                            <li
                              key={i}
                              className="text-sm text-gray-800 border-l-4 border-amber-400 bg-amber-50/50 pl-3 py-2 rounded-none"
                            >
                              {line}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="border border-gray-100 p-2 min-h-[280px]">
                        <p className="text-xs font-semibold text-gray-700 px-2 pt-1 pb-2">Phân bổ nhóm (tròn)</p>
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
                        <p className="text-xs font-semibold text-gray-700 px-2 pt-1 pb-2">Số khách theo nhóm (cột)</p>
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={segmentChartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={48} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={32} />
                            <Tooltip formatter={(v: number) => [`${v} khách`, "Số lượng"]} />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                              {segmentChartData.map((entry) => (
                                <Cell key={entry.name} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-2">Phân nhóm khách hàng</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(
                          [
                            { id: "vip", label: "VIP", count: analysisResult.analysis.segmentation.summary.vip },
                            {
                              id: "potential",
                              label: "Tiềm năng",
                              count: analysisResult.analysis.segmentation.summary.potential,
                            },
                            {
                              id: "churn_risk",
                              label: "Nguy cơ rời bỏ",
                              count: analysisResult.analysis.segmentation.summary.churn_risk,
                            },
                            { id: "new", label: "Khách mới", count: analysisResult.analysis.segmentation.summary.new },
                          ] as const
                        ).map((item) => (
                          <div key={item.id} className="border border-gray-200 bg-white p-3 rounded-none flex flex-col gap-2">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="font-medium text-sm text-gray-900">{item.label}</p>
                              <span className="text-lg font-semibold tabular-nums text-gray-800">{item.count}</span>
                            </div>
                            <p className="text-xs text-gray-600 leading-snug">{SEGMENT_CARD_COPY[item.id]}</p>
                            <button
                              type="button"
                              className="btn-secondary text-[11px] self-start"
                              onClick={() => setAnalysisModalOpen(false)}
                            >
                              Xem trong bảng
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {analysisResult.analysis.suggested_actions.length > 0 ? (
                      <div className="border border-emerald-100 bg-emerald-50/40 p-3 rounded-none space-y-3">
                        <p className="text-sm font-semibold text-gray-900">Gợi ý từ hệ thống</p>
                        <div className="space-y-3">
                          {analysisResult.analysis.suggested_actions.map((a, idx) => (
                            <div key={idx} className="border border-gray-200 bg-white p-3 rounded-none space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-sm text-gray-900">{a.title}</p>
                                <span className="text-[10px] border border-gray-200 bg-gray-50 px-2 py-0.5 text-gray-700">
                                  {PRIORITY_FRIENDLY[a.priority] ?? a.priority}
                                </span>
                                {a.target_segment ? (
                                  <span className="text-[10px] text-gray-500">
                                    Nhóm: {SEGMENT_FRIENDLY[a.target_segment] ?? a.target_segment}
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-xs text-gray-700">
                                <span className="font-medium text-gray-600">Mục tiêu: </span>
                                {a.goal}
                              </p>
                              {a.reason ? (
                                <p className="text-xs text-gray-600">
                                  <span className="font-medium text-gray-600">Vì sao: </span>
                                  {a.reason}
                                </p>
                              ) : null}
                              <button
                                type="button"
                                className="btn-primary text-[11px] mt-1"
                                disabled={creatingCampaign}
                                onClick={() => void createCampaignFromAction(a)}
                              >
                                {creatingCampaign ? "Đang tạo..." : "Tạo chiến dịch"}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

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
      )}
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

      {showTableEditor && activeListId ? (
        <>
          <button
            type="button"
            aria-label="Mở công cụ nhanh"
            aria-expanded={quickToolsOpen}
            onClick={() => setQuickToolsOpen((v) => !v)}
            className={
              quickToolsOpen
                ? "hidden"
                : "fixed bottom-5 right-5 z-[45] flex h-12 w-12 items-center justify-center rounded-full border-2 border-gray-500 bg-gradient-to-b from-[#f5f5f5] to-[#d4d0c8] text-gray-800 shadow-lg hover:brightness-105 active:brightness-95"
            }
          >
            <Wrench size={22} strokeWidth={2} />
          </button>

          {quickToolsOpen ? (
            <div
              className="fixed bottom-5 right-5 z-[45] flex w-[min(92vw,300px)] max-h-[min(72vh,420px)] flex-col overflow-hidden rounded-sm border border-gray-500 bg-[#ece9d8] shadow-[2px_2px_8px_rgba(0,0,0,0.35)]"
              role="dialog"
              aria-label="Công cụ nhanh"
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-500 bg-gradient-to-b from-[#ffffff] via-[#ece9d8] to-[#d4d0c8] px-2 py-1.5 text-[11px] font-bold text-gray-900 select-none">
                <span className="flex min-w-0 items-center gap-1.5 truncate">
                  <Wrench size={14} className="shrink-0" />
                  Công cụ nhanh
                </span>
                <button
                  type="button"
                  aria-label="Đóng"
                  onClick={() => setQuickToolsOpen(false)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center border border-gray-500 bg-[#ece9d8] text-base font-bold leading-none text-gray-800 hover:bg-red-100"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto border-x border-gray-400 bg-white p-2.5 text-xs">
                <p className="mb-2 truncate text-[10px] font-semibold uppercase tracking-wide text-gray-500">Danh sách đang mở</p>
                <p className="mb-3 truncate font-medium text-gray-900">{activeListName}</p>

                <div className="mb-3 space-y-2 border border-gray-300 bg-[#f8f8f8] p-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">Theo phân tích</p>
                  {!analysisResult ? (
                    <p className="leading-snug text-gray-700">
                      Chưa có kết quả phân tích. Chạy phân tích để nhận gợi ý riêng cho danh sách này.
                    </p>
                  ) : showPrioritySuggestion ? (
                    <div className="space-y-2">
                      <p className="border-l-4 border-amber-500 pl-2 leading-snug text-amber-950">
                        Nhóm nguy cơ rời bỏ đang cao. Gợi ý bật lọc khách ưu tiên để xử lý nhanh.
                      </p>
                      <button
                        type="button"
                        className="btn-primary w-full text-[11px]"
                        onClick={() => {
                          setOnlyPriorityTableView(true);
                          setSortPriorityFirst(true);
                          setMessage("Đã bật lọc khách ưu tiên.");
                        }}
                      >
                        Áp dụng lọc ưu tiên
                      </button>
                    </div>
                  ) : (
                    <p className="leading-snug text-gray-700">
                      Tỷ lệ nhóm nguy cơ rời bỏ trong danh sách đang ở mức chưa cần báo động.
                    </p>
                  )}
                </div>

                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-600">Thao tác</p>
                <div className="space-y-1.5">
                  <div className="group relative">
                    <button
                      type="button"
                      onClick={() => {
                        setAnalysisModalOpen(true);
                      }}
                      className="flex w-full items-center gap-2 border border-gray-300 bg-white p-2 text-left hover:bg-[#eef4ff]"
                    >
                      <BarChart3 size={18} className="shrink-0 text-blue-700" />
                      <span className="font-medium text-gray-900">Tổng quan phân tích</span>
                    </button>
                    <div className="pointer-events-none absolute right-full top-1/2 z-10 mr-1 hidden w-48 -translate-y-1/2 rounded border border-gray-800 bg-gray-900 px-2 py-1.5 text-[10px] leading-snug text-white shadow-md group-hover:block">
                      Mở cửa sổ biểu đồ, phân nhóm và gợi ý chiến dịch cho danh sách này.
                    </div>
                  </div>

                  <div className="group relative">
                    <button
                      type="button"
                      disabled={analyzing}
                      onClick={() => void analyzeCurrentTable()}
                      className="flex w-full items-center gap-2 border border-gray-300 bg-white p-2 text-left hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw size={18} className={`shrink-0 text-emerald-700 ${analyzing ? "animate-spin" : ""}`} />
                      <span className="font-medium text-gray-900">{analyzing ? "Đang phân tích…" : "Phân tích lại"}</span>
                    </button>
                    <div className="pointer-events-none absolute right-full top-1/2 z-10 mr-1 hidden w-48 -translate-y-1/2 rounded border border-gray-800 bg-gray-900 px-2 py-1.5 text-[10px] leading-snug text-white shadow-md group-hover:block">
                      Chạy lại phân tích trên dữ liệu bảng hiện tại (ghi đè kết quả cũ).
                    </div>
                  </div>

                  <div className="group relative">
                    <button
                      type="button"
                      disabled={priorityCustomers.length === 0}
                      onClick={() => {
                        setOnlyPriorityTableView(true);
                        setSortPriorityFirst(true);
                        setMessage("Đã bật lọc khách ưu tiên.");
                      }}
                      className={`flex w-full items-center gap-2 border border-gray-300 bg-white p-2 text-left hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-50 ${showPrioritySuggestion ? "ring-2 ring-amber-400" : ""}`}
                    >
                      <Filter size={18} className="shrink-0 text-amber-800" />
                      <span className="font-medium text-gray-900">Lọc khách ưu tiên</span>
                    </button>
                    <div className="pointer-events-none absolute right-full top-1/2 z-10 mr-1 hidden w-48 -translate-y-1/2 rounded border border-gray-800 bg-gray-900 px-2 py-1.5 text-[10px] leading-snug text-white shadow-md group-hover:block">
                      Chỉ hiển thị khách đã đánh dấu ưu tiên và đưa họ lên đầu bảng. Cần ít nhất một khách được đánh dấu.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
