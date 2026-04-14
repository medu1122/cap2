"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import HelpDialogButton from "@/components/common/HelpDialogButton";

interface CustomerList {
  id: string;
  list_name: string;
  status: string;
  total_records: number;
  valid_records: number;
  invalid_records: number;
  created_at: string;
}

export default function CustomerListsPage() {
  const [lists, setLists] = useState<CustomerList[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  function loadLists() {
    setLoading(true);
    api
      .get<CustomerList[]>("/workflow/customer-lists")
      .then(setLists)
      .catch(() => setLists([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadLists();
  }, []);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const token = localStorage.getItem("aimap_token");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("list_name", file.name.replace(".csv", ""));
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${baseUrl}/workflow/customer-lists/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "Upload thất bại" }));
        throw new Error(err.detail || "Upload thất bại");
      }
      setMessage("Đã tải lên và đang xử lý danh sách khách hàng.");
      loadLists();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload thất bại.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  return (
    <div className="p-6 max-w-5xl space-y-6 [&_.card]:!rounded-none [&_.input]:!rounded-none [&_.select]:!rounded-none [&_.btn-primary]:!rounded-none [&_.btn-secondary]:!rounded-none">
      <div className="flex items-center justify-between">
        <div>
          <h1>Danh sách khách hàng</h1>
          <p className="text-sm text-gray-500 mt-0.5">Upload CSV để tự động tạo đợt quảng bá email</p>
        </div>
        <div className="flex items-center gap-2">
          <HelpDialogButton
            title="Hướng dẫn danh sách khách hàng"
            summary="Trang này dùng để tải CSV khách hàng. Sau khi xử lý xong, hệ thống tự tạo đợt quảng bá email để AI soạn nội dung."
            steps={[
              "Tải file CSV mẫu để xem format chuẩn.",
              "Chuẩn bị file có cột tối thiểu: email (khuyên dùng thêm full_name, phone).",
              "Bấm 'Upload CSV' để tải file.",
              "Theo dõi trạng thái: processing -> ready.",
              "Vào trang chiến dịch để xem đợt quảng bá email được tạo tự động.",
            ]}
            tips={[
              "Dữ liệu được lưu trong hệ thống, F5 không mất.",
              "Hệ thống hỗ trợ cả CSV dùng dấu phẩy (,) hoặc chấm phẩy (;).",
              "Nếu file thiếu cột email, số bản ghi hợp lệ sẽ thấp.",
            ]}
          />
            <a href="/maucsv.csv" download className="btn-secondary text-sm">
            CSV mẫu
          </a>
          <label className="btn-primary text-sm cursor-pointer">
            {uploading ? "Đang upload..." : "Upload CSV"}
            <input type="file" accept=".csv" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      {message && <div className="card text-sm text-gray-700">{message}</div>}

      <div className="card">
        <h2 className="mb-3">Danh sách đã tải</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Đang tải...</p>
        ) : lists.length === 0 ? (
          <p className="text-sm text-gray-400">Chưa có danh sách nào.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2">Tên danh sách</th>
                  <th className="text-left px-3 py-2">Trạng thái</th>
                  <th className="text-left px-3 py-2">Tổng</th>
                  <th className="text-left px-3 py-2">Hợp lệ</th>
                  <th className="text-left px-3 py-2">Lỗi</th>
                </tr>
              </thead>
              <tbody>
                {lists.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">{item.list_name}</td>
                    <td className="px-3 py-2">{item.status}</td>
                    <td className="px-3 py-2">{item.total_records}</td>
                    <td className="px-3 py-2">{item.valid_records}</td>
                    <td className="px-3 py-2">{item.invalid_records}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
