# README - Mẫu báo cáo kinh doanh CSV cho Trợ lý phân tích

## Mục tiêu
Tài liệu này hướng dẫn doanh nghiệp nhỏ tại Việt Nam chuẩn bị file CSV dạng **báo cáo kinh doanh** để nạp vào `http://localhost:3000/insights`.

## File mẫu có sẵn
- Đường dẫn: `web/public/mau-du-lieu-tro-ly-phan-tich.csv`
- Số dòng dữ liệu mẫu: **100 dòng** (không tính header)
- Định dạng tách cột: dấu `;` để mở đẹp trên Excel tiếng Việt

## Cấu trúc cột bắt buộc (bản báo cáo kinh doanh)
| Cột | Ý nghĩa | Ví dụ |
|---|---|---|
| `ngay_bao_cao` | Ngày báo cáo theo định dạng `YYYY-MM-DD` | `2026-01-20` |
| `kenh_ban_hang` | Kênh bán/chạy marketing | `facebook`, `zalo`, `tiktok`, `email`, `google` |
| `doanh_thu_thuan_vnd` | Doanh thu thuần theo ngày và kênh | `20300000` |
| `so_don_hang_thanh_cong` | Số đơn hàng thành công | `143` |
| `chi_phi_quang_cao_vnd` | Chi phí quảng cáo theo kênh | `8050000` |
| `so_khach_tiem_nang` | Số khách tiềm năng (lead/comment/inbox hợp lệ) | `1610` |
| `so_don_hang_lap_lai` | Số đơn từ khách cũ quay lại | `33` |

## Trợ lý phân tích sẽ phân tích gì cho bạn
Sau khi nạp báo cáo, hệ thống tính và phân tích:
- ROAS (doanh thu / chi phí quảng cáo)
- Conversion rate (đơn hàng / khách tiềm năng)
- Repeat rate (đơn lặp lại / tổng đơn)
- AOV (giá trị đơn hàng trung bình)
- Mức ưu tiên xử lý: `Cao (P1)`, `Vừa (P2)`, `Thấp (P3)`
- Gợi ý hành động theo từng vấn đề

## Phân tích sâu A2A
Trên giao diện có form `Phân tích sâu báo cáo (A2A)` với luồng:
1. `StrategistAgent`: tổng hợp bức tranh kinh doanh
2. `DiagnosticAgent`: chỉ ra vấn đề gốc
3. `ActionAdvisorAgent`: đề xuất hành động ưu tiên

UI cũng hiển thị rõ model đang hoạt động (ví dụ `qwen2.5:7b`).

## Quy tắc file CSV
- Giữ đúng header như bảng trên.
- Không để trống `ngay_bao_cao`.
- Cột số để dạng số thuần (không thêm chữ hay ký hiệu tiền tệ).
- Có thể dùng dấu `;` hoặc `,` (khuyến nghị `;` cho Excel tiếng Việt).

## Quy trình sử dụng
1. Mở trang `Trợ lý phân tích`.
2. Bấm `Nạp dữ liệu từ CSV`.
3. Chọn file báo cáo kinh doanh theo mẫu.
4. Hệ thống tự nạp và phân tích theo từng ngày dữ liệu.
5. (Tuỳ chọn) chạy `Phân tích sâu báo cáo (A2A)` để xem phân tích chuyên sâu.
6. Mở `Hàng đợi hành động` để triển khai.
