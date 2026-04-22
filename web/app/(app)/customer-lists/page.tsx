"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

const REQUIRED_IMPORT_COLUMNS = ["HoVaTen", "SDT", "Email"] as const;
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
      if (!fullName) rowErr.push("Thiếu họ tên");
      if (!email) rowErr.push("Thiếu email");
      else if (!isValidEmail(email)) rowErr.push("Email không hợp lệ");
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
      setActiveListId(res.table.id);
      setActiveListName(res.table.name);
      setRows(normalizeRows(res.rows as Record<string, unknown>[]));
      setAnalysisResult(null);
      setShowTableEditor(true);
      setExpandedRowIndex(null);
      const priority = await api
        .get<PriorityCustomer[]>(`/workflow/customer-lists/${res.table.id}/priority-customers`)
        .catch(() => []);
      const keys = priority.map((item) => (item.email || item.phone || item.customer_name).toLowerCase());
      setPriorityCustomers(keys);
    } catch (e) {
      setRows([]);
      setMessage(e instanceof Error ? e.message : "Không mở được bảng");
    } finally {
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
  }

  function addRow() {
    setRows((prev) => [...prev, { ...emptyRow(), ID: String(prev.length + 1) }]);
  }

  function deleteRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index).map((r, idx) => ({ ...r, ID: String(idx + 1) })));
    setExpandedRowIndex((prev) => (prev === index ? null : prev));
    setEditingCell(null);
    setErrorPopover(null);
  }

  async function handleImportToCurrentTable(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage("");
    try {
      const imported = await parseFileToRows(file);
      const importedHeaders = Object.keys(imported[0] || {});
      const missingRequired = REQUIRED_IMPORT_COLUMNS.filter((col) => !importedHeaders.includes(col));
      if (missingRequired.length > 0) {
        setMessage(
          `File chưa đúng khuôn. Thiếu cột bắt buộc: ${missingRequired.join(", ")}. Vui lòng dùng template mẫu.`,
        );
        return;
      }
      const normalized = normalizeRows(imported as Record<string, unknown>[]);
      setRows(normalized);
      setMessage(`Đã nạp ${normalized.length} dòng vào bảng đang mở. Nhấn "Lưu bảng" để ghi xuống hệ thống.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không đọc được file");
    } finally {
      event.target.value = "";
    }
  }

  async function saveCurrentTable() {
    if (!activeListId) {
      setMessage("Chọn bảng trước khi lưu.");
      return;
    }
    if (hasRowErrors) {
      setMessage("Bảng còn lỗi dữ liệu theo từng dòng. Sửa lỗi trước khi lưu.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await api.put(`/workflow/customer-lists/${activeListId}/rows`, { rows });
      await loadLists();
      setMessage("Đã lưu bảng thành công.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Lưu bảng thất bại");
    } finally {
      setSaving(false);
    }
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
      setMessage("Phân tích hoàn tất. Kết quả mới đã thay thế kết quả trước.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Phân tích thất bại");
    } finally {
      setAnalyzing(false);
    }
  }

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
      setMessage("Chưa có Brand Vault. Vui lòng tạo brand trước khi tạo campaign.");
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
      setMessage(e instanceof Error ? e.message : "Không tạo được campaign từ action");
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
            summary="Mỗi danh sách là một tập khách hàng riêng. Bạn nạp file vào danh sách đang mở, chỉnh sửa và chỉ lưu khi bấm Lưu danh sách."
            steps={[
              "Tạo hoặc chọn danh sách.",
              "Nạp file CSV/XLSX vào đúng danh sách đang mở.",
              "Chỉnh sửa thêm/xóa dòng.",
              "Bấm Lưu danh sách để ghi dữ liệu.",
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
          <h2>Các danh sách hiện có</h2>
          <div className="flex gap-2">
            <input
              className="input text-sm"
              placeholder="Tên danh sách mới"
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
            />
            <button className="btn-primary text-xs" onClick={createTable}>
              Tạo
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
                Quay lại các danh sách hiện có
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
              <button className="btn-primary text-xs" onClick={analyzeCurrentTable} disabled={!activeListId || analyzing}>
                {analyzing ? "Đang phân tích..." : "Phân tích"}
              </button>
            </div>
          </div>

          {analyzing ? <div className="border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">Đang phân tích dữ liệu customer...</div> : null}

          {tableLoading ? (
            <p className="text-sm text-gray-500">Đang tải dữ liệu danh sách...</p>
          ) : !activeListId ? (
            <p className="text-sm text-gray-500">Hãy chọn hoặc tạo danh sách ở trên.</p>
          ) : (
            <div className="space-y-2">
              {hasRowErrors ? (
                <div className="border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  Có {Object.keys(rowErrors).length} dòng đang lỗi dữ liệu. Xem cột "Lỗi dòng" để chỉnh.
                </div>
              ) : (
                <div className="border border-green-200 bg-green-50 p-2 text-xs text-green-700">
                  Dữ liệu hợp lệ, có thể lưu và phân tích.
                </div>
              )}
              <div className="overflow-x-auto border border-gray-200">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {columns.map((col) => (
                      <th key={col} className="text-left px-2 py-1 border">
                        <span className="whitespace-normal leading-tight">
                          {PRIMARY_COLUMNS.find((item) => item.key === col)?.label ?? COLUMN_LABELS[col] ?? col}
                        </span>
                      </th>
                    ))}
                    <th className="text-left px-2 py-1 border">Thao tác</th>
                    <th className="text-left px-2 py-1 border w-12">!</th>
                    <th className="text-left px-2 py-1 border w-12">...</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIdx) => (
                    <Fragment key={`row-${rowIdx}`}>
                      <tr className={`border-t ${rowErrors[rowIdx] ? "bg-red-50/40" : "border-gray-100"}`}>
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
                                {row[col] || "-"}
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
                          {rowErrors[rowIdx]?.length ? (
                            <button
                              className="btn-secondary text-[11px] px-2 py-1 text-amber-700"
                              title="Xem lỗi dòng"
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setErrorPopover({ rowIdx, x: rect.left, y: rect.bottom + 6 });
                              }}
                            >
                              ⚠
                            </button>
                          ) : null}
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

          {analysisResult ? (
            <div className="space-y-3">
              {analysisResult.analysis.narrative ? (
                <div className="border border-indigo-200 bg-indigo-50 p-2 text-xs whitespace-pre-line">
                  {analysisResult.analysis.narrative}
                </div>
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="border border-gray-200 bg-white p-2">
                  <p className="text-[11px] text-gray-500">Tổng khách</p>
                  <p className="text-lg font-semibold">{analysisResult.analysis.overview.total_customers}</p>
                </div>
                <div className="border border-gray-200 bg-white p-2">
                  <p className="text-[11px] text-gray-500">Tổng doanh thu</p>
                  <p className="text-lg font-semibold">{analysisResult.analysis.overview.total_revenue}</p>
                </div>
                <div className="border border-gray-200 bg-white p-2">
                  <p className="text-[11px] text-gray-500">Retention</p>
                  <p className="text-lg font-semibold">{analysisResult.analysis.overview.retention_rate_percent}%</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="border border-gray-200 bg-white p-2">
                  <p className="font-medium text-sm">Top chi tiêu</p>
                  <p className="text-[11px] text-gray-500 mb-1">
                    Top 20% đóng góp {analysisResult.analysis.customer_value.revenue_share_of_top_group}% doanh thu
                  </p>
                  <div className="space-y-1 text-xs">
                    {(onlyPriorityView
                      ? analysisResult.analysis.customer_value.top_spenders.filter((item) =>
                          priorityCustomers.includes(toPriorityKey(item.customer_name, item.email, item.phone)),
                        )
                      : analysisResult.analysis.customer_value.top_spenders
                    )
                      .slice(0, 5)
                      .map((item, idx) => (
                      <div key={idx} className="border-b border-gray-100 pb-1">
                        <div className="flex items-center justify-between">
                          <span>{item.customer_name}</span>
                          <span className="font-medium">{item.amount}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full bg-gray-100">
                          <div
                            className="h-1.5 bg-blue-600"
                            style={{
                              width: `${Math.min(
                                100,
                                (item.amount / Math.max(analysisResult.analysis.customer_value.top_spenders[0]?.amount || 1, 1)) * 100,
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          <button
                            className="btn-secondary text-[10px] px-2 py-[2px]"
                            onClick={() =>
                              void togglePriorityCustomer(
                                { customer_name: item.customer_name, email: item.email, phone: item.phone },
                                !priorityCustomers.includes(toPriorityKey(item.customer_name, item.email, item.phone)),
                              )
                            }
                          >
                            {priorityCustomers.includes(toPriorityKey(item.customer_name, item.email, item.phone))
                              ? "Bỏ ưu tiên"
                              : "Ưu tiên"}
                          </button>
                          <button
                            className="btn-primary text-[10px] px-2 py-[2px]"
                            disabled={creatingCampaign}
                            onClick={() => void createCampaignFromCustomer(item.customer_name, "vip")}
                          >
                            Tạo campaign
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border border-gray-200 bg-white p-2">
                  <p className="font-medium text-sm">Nguy cơ rời bỏ</p>
                  <div className="text-xs space-y-1">
                    <p>&gt; 30 ngày: {analysisResult.analysis.churn_risk.inactive_over_30_days} khách</p>
                    <p>&gt; 60 ngày: {analysisResult.analysis.churn_risk.inactive_over_60_days} khách</p>
                    {(onlyPriorityView
                      ? analysisResult.analysis.churn_risk.high_risk_customers.filter((item) =>
                          priorityCustomers.includes(toPriorityKey(item.customer_name, item.email, item.phone)),
                        )
                      : analysisResult.analysis.churn_risk.high_risk_customers
                    )
                      .slice(0, 3)
                      .map((item, idx) => (
                      <div key={idx} className="border border-red-100 bg-red-50 p-1">
                        <p className="text-red-700">
                          {item.customer_name} - {item.days_since_last_payment} ngày
                        </p>
                        <div className="mt-1 flex items-center gap-1">
                          <button
                            className="btn-secondary text-[10px] px-2 py-[2px]"
                            onClick={() =>
                              void togglePriorityCustomer(
                                { customer_name: item.customer_name, email: item.email, phone: item.phone },
                                !priorityCustomers.includes(toPriorityKey(item.customer_name, item.email, item.phone)),
                              )
                            }
                          >
                            {priorityCustomers.includes(toPriorityKey(item.customer_name, item.email, item.phone))
                              ? "Bỏ ưu tiên"
                              : "Ưu tiên"}
                          </button>
                          <button
                            className="btn-primary text-[10px] px-2 py-[2px]"
                            disabled={creatingCampaign}
                            onClick={() => void createCampaignFromCustomer(item.customer_name, "churn_risk")}
                          >
                            Tạo campaign
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 bg-white p-2">
                <p className="font-medium text-sm mb-1">Phân nhóm khách hàng</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="border border-blue-200 bg-blue-50 p-2">
                    VIP: {analysisResult.analysis.segmentation.summary.vip}
                    <div className="mt-1 h-1.5 bg-blue-100">
                      <div
                        className="h-1.5 bg-blue-700"
                        style={{
                          width: `${Math.min(100, (analysisResult.analysis.segmentation.summary.vip / Math.max(analysisResult.analysis.overview.total_customers, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="border border-sky-200 bg-sky-50 p-2">
                    Tiềm năng: {analysisResult.analysis.segmentation.summary.potential}
                    <div className="mt-1 h-1.5 bg-sky-100">
                      <div
                        className="h-1.5 bg-sky-600"
                        style={{
                          width: `${Math.min(100, (analysisResult.analysis.segmentation.summary.potential / Math.max(analysisResult.analysis.overview.total_customers, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="border border-red-200 bg-red-50 p-2">
                    Nguy cơ rời bỏ: {analysisResult.analysis.segmentation.summary.churn_risk}
                    <div className="mt-1 h-1.5 bg-red-100">
                      <div
                        className="h-1.5 bg-red-600"
                        style={{
                          width: `${Math.min(
                            100,
                            (analysisResult.analysis.segmentation.summary.churn_risk / Math.max(analysisResult.analysis.overview.total_customers, 1)) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="border border-green-200 bg-green-50 p-2">
                    Mới: {analysisResult.analysis.segmentation.summary.new}
                    <div className="mt-1 h-1.5 bg-green-100">
                      <div
                        className="h-1.5 bg-green-600"
                        style={{
                          width: `${Math.min(100, (analysisResult.analysis.segmentation.summary.new / Math.max(analysisResult.analysis.overview.total_customers, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {analysisResult.analysis.suggested_actions.length ? (
                <div className="border border-green-200 bg-green-50 p-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="font-medium text-sm">Hành động đề xuất</p>
                    <label className="text-[11px] inline-flex items-center gap-1">
                      <input type="checkbox" checked={onlyPriorityView} onChange={(e) => setOnlyPriorityView(e.target.checked)} />
                      Chỉ xem khách ưu tiên
                    </label>
                  </div>
                  <div className="space-y-2">
                    {analysisResult.analysis.suggested_actions.map((a, idx) => (
                      <div key={idx} className="border border-green-200 bg-white p-2 text-xs">
                        <p className="font-medium">
                          {a.title} ({a.priority})
                        </p>
                        <p className="text-gray-600">
                          Nhóm: {a.target_segment} - Mục tiêu: {a.goal}
                        </p>
                        {a.reason ? <p className="text-gray-600">Lý do: {a.reason}</p> : null}
                        <button
                          className="btn-primary text-[11px] mt-1"
                          disabled={creatingCampaign}
                          onClick={() => void createCampaignFromAction(a)}
                        >
                          {creatingCampaign ? "Đang tạo..." : "Tạo campaign từ action"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
