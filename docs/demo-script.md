# Demo Script — AIMAP

Tài liệu này mô tả luồng demo cho hội đồng chấm capstone. Thời gian dự kiến: **10–12 phút**.

---

## Chuẩn bị trước demo

**Môi trường**
- `docker compose up` đang chạy, tất cả services healthy.
- Browser mở sẵn tại `http://localhost:3000`.
- Account demo đã tạo sẵn: `demo@cafebohho.vn / demo1234`.
- Brand Vault đã cấu hình sẵn cho "Cafe Bờ Hồ".
- Có ít nhất 2 campaign đã approved sẵn (để calendar không trống).
- Terminal mở để show logs nếu cần.

**Seed data**
```bash
cd api && python seed_demo.py
```
Script tạo:
- 1 user demo
- Brand vault hoàn chỉnh
- 2 campaigns ở trạng thái `approved`
- 1 campaign ở trạng thái `pending_approval`

---

## Demo Flow

### 1. Opening (1 phút)

> "AIMAP là nền tảng tự động hóa marketing bằng AI dành cho các doanh nghiệp nhỏ — cụ thể là các chủ shop, quán ăn, dịch vụ địa phương chưa có đội marketing chuyên nghiệp.
>
> Thay vì phải ngồi nghĩ content, viết bài, rồi kiểm tra lại từng cái một — họ chỉ cần mô tả mục tiêu, và hệ thống sẽ tự lên kế hoạch, viết nội dung, kiểm tra chất lượng, rồi chờ người dùng duyệt."

---

### 2. Dashboard Overview (1.5 phút)

Vào trang **Dashboard**.

> "Đây là trang tổng quan. Bạn thấy ngay số campaign đã tạo, số nội dung đã được duyệt, và số nội dung đang chờ duyệt.
>
> Phía dưới là feed hoạt động gần đây — từng bước mà các AI agent đã thực hiện.
>
> Và đây là phần AI Insight — hệ thống tự phân tích dữ liệu của bạn và đưa ra nhận xét. Ví dụ nó đang nói: bạn có 3 nội dung chưa duyệt, và Facebook post đang được tạo nhiều nhất."

---

### 3. Brand Vault (1.5 phút)

Vào trang **Brand Vault**.

> "Trước khi tạo bất kỳ campaign nào, chủ shop cần thiết lập Brand Vault — kho lưu trữ thương hiệu.
>
> Ở đây bạn nhập tên thương hiệu, mô tả, giọng văn mong muốn — ví dụ 'ấm áp và gần gũi' — nhóm khách hàng mục tiêu, các sản phẩm chính, và quan trọng là các từ cấm — những từ bạn không muốn AI dùng trong nội dung của bạn.
>
> Toàn bộ Brand Vault này được truyền vào context của từng AI agent. Điều đó đảm bảo mọi nội dung được tạo ra đều đúng phong cách thương hiệu — không bao giờ lạc tông."

---

### 4. Create a New Campaign — LIVE (4 phút)

Vào **Campaigns** → nhấn **New Campaign**.

> "Bây giờ mình sẽ thử tạo một campaign hoàn toàn mới ngay bây giờ."

Điền form:
```
Campaign Name:    Ra mắt cà phê trứng
Objective:        Giới thiệu sản phẩm mới, tăng lượng khách ghé thử
Product:          Cà phê trứng truyền thống kiểu Hà Nội
Target audience:  Dân văn phòng 25-35 tuổi
Offer:            Mua 1 tặng 1 trong 3 ngày đầu
Deadline:         [chọn ngày cách hôm nay 10 ngày]
Channels:         [x] Facebook Post  [x] Email  [x] Video Script
Notes:            Nhấn mạnh nguyên liệu sạch, không dùng đường công nghiệp
```

Nhấn **Create Campaign**.

> "Hệ thống bắt đầu chạy. Bạn thấy trạng thái 'Running...' — đây là lúc 3 AI agent đang làm việc với nhau."

Chuyển sang xem **Campaign Detail** — cột phải là Agent Logs timeline.

> "Mình để ý cột bên phải — đây là nhật ký hoạt động của các agent, cập nhật theo thời gian thực.
>
> Agent đầu tiên là Strategist — nó đang phân tích brief và xây dựng kế hoạch chiến dịch. Nó chạy trên OpenAI GPT-4o-mini và mất khoảng 2-3 giây.
>
> Tiếp theo là Writer — nó nhận đầu việc từ Strategist và viết nội dung cho từng kênh. Writer chạy trên Qwen 2.5 7B — model mình self-host trên VPS riêng — để tiết kiệm chi phí.
>
> Cuối cùng là Critic — nó đọc lại toàn bộ nội dung, kiểm tra xem có đúng brief không, có đúng giọng thương hiệu không, CTA có rõ ràng không. Nếu cần sửa, nó tự sửa rồi mới đưa ra bản cuối."

*(Đợi orchestration hoàn thành — thường 20–40 giây.)*

> "Xong. Bạn thấy status đã chuyển thành 'Pending Approval'. 3 nội dung đã được tạo ra và đang chờ mình duyệt."

---

### 5. Review & Approve Content (2 phút)

Nhấn vào tab **Facebook Post**.

> "Đây là bài viết Facebook mà AI đã soạn. Nó dùng đúng giọng văn ấm áp của Cafe Bờ Hồ, đề cập đúng ưu đãi mình đã nhập, và có hashtag gợi ý ở dưới.
>
> Nội dung trông ổn. Mình nhấn Approve."

Chuyển sang tab **Email**.

> "Email thì có subject line và body riêng. Critic đã điều chỉnh phần mở đầu để phù hợp hơn với tệp khách văn phòng.
>
> Mình sẽ Approve luôn."

Nhấn **Reject** trên **Video Script** để demo reject flow.

> "Giả sử mình không thích kịch bản video này — mình nhấn Reject và ghi ghi chú: 'Hook đầu chưa đủ thu hút, cần bắt đầu bằng câu hỏi'. Thông tin này được lưu lại để AI có thể viết lại trong lần chạy tiếp theo."

---

### 6. Marketing Calendar (1 phút)

Vào trang **Calendar**.

> "Toàn bộ nội dung đã được duyệt xuất hiện trên Calendar theo ngày deadline. Mình có thể xem theo tháng, lọc theo kênh, và click vào bất kỳ item nào để xem nội dung chi tiết ngay tại đây.
>
> Đây là bức tranh tổng thể về marketing của cả tháng — điều mà hầu hết chủ shop nhỏ không bao giờ có."

---

### 7. Closing (30 giây)

> "Tóm lại, AIMAP giải quyết bài toán thực tế: doanh nghiệp nhỏ thiếu người, thiếu thời gian, thiếu chuyên môn marketing. Thay vì phải học marketing hay thuê agency, họ chỉ cần mô tả mục tiêu — hệ thống multi-agent sẽ lo phần còn lại, và họ chỉ cần duyệt và publish."

---

## Q&A Preparation

### "Tại sao dùng 3 agent thay vì 1 agent làm hết?"

> "Một agent làm hết thường tạo ra nội dung mà thiếu cấu trúc hoặc không đúng brief vì prompt quá dài và phức tạp. Khi tách thành Strategist → Writer → Critic, mỗi agent có nhiệm vụ cụ thể và kết quả đầu ra có thể kiểm soát và giải thích được. Đây là mô hình Producer-Consumer trong multi-agent systems."

### "Tại sao cần Brand Vault thay vì nhập trực tiếp vào brief?"

> "Vì chủ shop không tạo campaign mỗi ngày chỉ 1 lần — họ tạo nhiều campaign liên tục. Brand Vault là shared context để tất cả agent luôn nhất quán về giọng văn và thương hiệu mà không phải nhập lại mỗi lần. Nó cũng giúp phát hiện nội dung 'lạc tông' — Critic biết phong cách chuẩn là gì để so sánh."

### "Model Qwen 2.5 7B có đủ chất lượng không?"

> "Qwen 2.5 7B cho kết quả tốt với tiếng Việt và đủ dùng cho bước Writer — nơi cần sáng tạo hơn là logic phức tạp. Chúng tôi dùng OpenAI GPT-4o-mini cho Strategist và Critic — nơi cần reasoning và đánh giá cẩn thận hơn. Hệ thống cũng có fallback: nếu VPS Qwen không phản hồi trong 15 giây, Writer tự chuyển sang OpenAI."

### "Nếu AI tạo ra nội dung sai thì sao?"

> "Đó là lý do tồn tại của Approval Flow. Không có gì được publish mà không qua tay người dùng. AI là trợ lý, không phải người ra quyết định. Ngoài ra, Critic agent đã là một lớp kiểm tra trước khi nội dung đến tay user — giảm thiểu đáng kể số lần user phải reject."

### "Platform này có thể mở rộng như thế nào?"

> "Architecture hiện tại tách biệt agent service khỏi API, nên có thể thêm agent mới (ví dụ Image Prompt Generator, SEO Optimizer) mà không cần sửa API backend. Channel mới (Instagram, Zalo OA) chỉ cần thêm writer template. Workflow trigger mới thêm vào workflow service độc lập."

---

## Fallback Plan (nếu có sự cố)

| Sự cố | Xử lý |
|---|---|
| VPS Qwen không phản hồi | Hệ thống tự fallback sang OpenAI, demo vẫn chạy |
| OpenAI API rate limit | Chuẩn bị 1 campaign đã run sẵn với logs đầy đủ để show |
| Docker service crash | Chuẩn bị video screen-recording 3 phút demo full flow |
| Network chậm | Dùng campaign đã run xong từ trước, show lại UI và logs |
