"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import HelpDialogButton from "@/components/common/HelpDialogButton";
import { api, postNdjsonStream, type DeepAnalysisStreamEvent } from "@/lib/api-client";

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

interface DeepAnalysisResultLite {
  run_id: string;
  data_quality_score?: number;
  issues?: string[];
  insights?: Array<{ title: string; recommendation: string }>;
  suggested_actions?: Array<{ title: string; priority: string; target_segment: string }>;
}

interface BrandOption {
  id: string;
  brand_name: string;
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

const STREAM_STEP_LABEL_VI: Record<string, string> = {
  classify_report: "Bot Classifier đang phân loại dữ liệu",
  map_schema: "Bot Mapper đang ánh xạ cột",
  compute_metrics: "Bot Metrics đang tính KPI",
  narrative: "Bot Narrator đang diễn giải",
  polish_result: "Bot Polisher đang chuẩn hóa kết quả",
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
  const [streamHint, setStreamHint] = useState("");
  const [analysisResult, setAnalysisResult] = useState<DeepAnalysisResultLite | null>(null);
  const [message, setMessage] = useState("");
  const [newTableName, setNewTableName] = useState("");
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [showTableEditor, setShowTableEditor] = useState(false);
  const [expandedRowIndex, setExpandedRowIndex] = useState<number | null>(null);

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

  function onStreamEvent(evt: DeepAnalysisStreamEvent) {
    if (evt.type !== "progress") return;
    const label = STREAM_STEP_LABEL_VI[evt.step_key] ?? evt.step_key;
    setStreamHint(`${label} (${evt.status})`);
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
    setAnalyzing(true);
    setStreamHint("Khởi động pipeline phân tích...");
    setMessage("");
    try {
      const raw = await postNdjsonStream(
        "/insights/a2a/deep-analysis-stream",
        {
          business_name: activeListName || "Bang du lieu khach hang",
          industry: "tong_hop",
          source_filename: `${activeListName || "table"}.xlsx`,
          report_rows: rows,
        },
        { signal: new AbortController().signal, onEvent: onStreamEvent },
      );
      setAnalysisResult(raw as DeepAnalysisResultLite);
      setMessage("Phân tích hoàn tất. Kết quả mới đã thay thế kết quả trước.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Phân tích thất bại");
    } finally {
      setAnalyzing(false);
      setStreamHint("");
    }
  }

  async function createCampaignFromAction(action: { title: string; target_segment: string; priority: string }) {
    if (!analysisResult?.run_id) return;
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
        objective: action.title,
        product_or_service: "Danh sách khách hàng",
        target_audience: `Khách hàng nhóm ${action.target_segment}`,
        offer_or_hook: `Ưu tiên ${action.priority}`,
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        channels: action.target_segment === "inactive" || action.target_segment === "vip" ? ["email"] : ["facebook_post"],
        additional_notes: `[INSIGHT_ACTION] Tạo từ customer table ${activeListName}`,
        source_insight_run_id: analysisResult.run_id,
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

  return (
    <div className="p-6 space-y-6 [&_.card]:!rounded-none [&_.input]:!rounded-none [&_.select]:!rounded-none [&_.btn-primary]:!rounded-none [&_.btn-secondary]:!rounded-none">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1>Danh sách customer</h1>
        </div>
        <div className="flex items-center gap-2">
          <HelpDialogButton
            title="Hướng dẫn list user"
            summary="Mỗi list user là một danh sách khách hàng riêng. Bạn nạp file vào list đang mở, chỉnh sửa và chỉ lưu khi bấm Lưu list."
            steps={[
              "Tạo hoặc chọn list user.",
              "Nạp file CSV/XLSX vào đúng list đang mở.",
              "Chỉnh sửa thêm/xóa dòng.",
              "Bấm Lưu list để ghi dữ liệu.",
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
              placeholder="Tên list user mới"
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
            <h2>{activeListName ? `Danh sách khách hàng - ${activeListName}` : "Chọn list user để thao tác"}</h2>
            <div className="flex items-center gap-2">
              <button className="btn-secondary text-xs" onClick={() => setShowTableEditor(false)}>
                Quay lại các danh sách hiện có
              </button>
              <label className="btn-secondary text-xs cursor-pointer">
                Nhập file vào list user này
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

          {analyzing ? (
            <div className="border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
              Quy trình bot: {streamHint || "Đang chạy..."}
            </div>
          ) : null}

          {tableLoading ? (
            <p className="text-sm text-gray-500">Đang tải dữ liệu list user...</p>
          ) : !activeListId ? (
            <p className="text-sm text-gray-500">Hãy chọn hoặc tạo list user ở trên.</p>
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
                          {PRIMARY_COLUMNS.find((item) => item.key === col)?.label ?? col}
                        </span>
                      </th>
                    ))}
                    <th className="text-left px-2 py-1 border">Thao tác</th>
                    <th className="text-left px-2 py-1 border">Lỗi dòng</th>
                    <th className="text-left px-2 py-1 border w-12">...</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIdx) => (
                    <Fragment key={`row-${rowIdx}`}>
                      <tr className={`border-t ${rowErrors[rowIdx] ? "bg-red-50/40" : "border-gray-100"}`}>
                        {columns.map((col) => (
                          <td key={`${rowIdx}-${col}`} className="border px-1 py-1">
                            <input
                              className={`input text-xs py-1 px-1 h-7 ${rowErrors[rowIdx] ? "border-red-300" : ""}`}
                              value={row[col] ?? ""}
                              onChange={(e) => updateCell(rowIdx, col, e.target.value)}
                            />
                          </td>
                        ))}
                        <td className="border px-1 py-1">
                          <button className="btn-secondary text-[11px]" onClick={() => deleteRow(rowIdx)}>
                            Xóa
                          </button>
                        </td>
                        <td className="border px-1 py-1 text-[11px] text-red-700">
                          {(rowErrors[rowIdx] || []).join(", ")}
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
                                    <p className="text-[11px] text-gray-500">{col}</p>
                                    <input
                                      className="input text-xs py-1 px-1 h-7 mt-1"
                                      value={row[col] ?? ""}
                                      onChange={(e) => updateCell(rowIdx, col, e.target.value)}
                                    />
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
            </div>
          )}

          {analysisResult ? (
            <div className="border border-green-200 bg-green-50 p-3 text-sm space-y-2">
              <p className="font-medium">Kết quả phân tích mới nhất (run: {analysisResult.run_id})</p>
              <p>Điểm chất lượng dữ liệu: {Math.round((analysisResult.data_quality_score ?? 0) * 100)}%</p>
              {analysisResult.issues?.length ? (
                <ul className="list-disc list-inside text-xs">
                  {analysisResult.issues.slice(0, 3).map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              ) : null}
              {analysisResult.suggested_actions?.length ? (
                <div className="text-xs">
                  <p className="font-medium">Action đề xuất:</p>
                  <div className="space-y-2 mt-1">
                    {analysisResult.suggested_actions.slice(0, 3).map((a, idx) => (
                      <div key={idx} className="border border-green-200 bg-white p-2">
                        <p>
                          {a.title} ({a.priority}, {a.target_segment})
                        </p>
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
