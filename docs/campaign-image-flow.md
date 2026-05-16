# Campaign Image & Link Flow - Action Log

## Mục đích
Ghi chép lại các thay đổi đã thực hiện để context không bị mất khi reset token.

## Background

Hệ thống campaign có 3 kênh: `email`, `facebook_post`, `video_script`.
Tracking links có 2 loại: `email_click` (cho CTA trong email) và `facebook_post` (cho lượt mở Facebook post).

### Tracking Link Model
- Table: `campaign_tracking_links`
- Key fields: `campaign_id`, `name`, `destination_url`, `short_code`, `click_count`, `link_type` (email_click | facebook_post)
- Short code được tạo tự động bằng `secrets.token_urlsafe(8)[:12]`

### Content Item Fields
- `facebook_post`: `{ copy, hashtags, cta_url, fb_post_url }`
- `email`: `{ subject, body, cta_text, cta_url }`
- `video_script`: `{ scenes[], voice_over, background_music_suggestion, call_to_action, total_duration_estimate }`

### Image System
- AI image generation: `POST /campaigns/{id}/image/generate` (DALL-E 3)
- Manual upload: `POST /campaigns/{id}/image/upload`
- Storage: Cloudinary (nếu có config) hoặc local filesystem
- Image URL lưu trong `campaign.campaign_plan_json["image_url"]`
- Checkbox `image_required` trên form tạo campaign chỉ thêm note vào `additional_notes`, KHÔNG trigger generation tự động

---

## Các Thay đổi Đã Thực Hiện

### [DONE] Fix Video Script "Tạo lại" không hoạt động
- **Ngày**: 2026-05-15
- **Vấn đề**: API `get_campaign` trả tất cả versions của content item (cả v1 và v2). Frontend hiển thị version cũ.
- **Fix**: `api/routers/campaigns.py` - Thêm logic lọc chỉ giữ latest version cho mỗi channel
- **File**: `api/routers/campaigns.py` dòng 284-300

### [DONE] Xóa kênh Instagram
- **Ngày**: 2026-05-15
- **Files changed**:
  - `api/schemas/campaign.py` - xóa `instagram` khỏi `VALID_CHANNELS`
  - `api/schemas/campaign_idea.py` - xóa `instagram`
  - `web/lib/utils.ts` - xóa khỏi `CHANNEL_LABELS` và `CHANNEL_COLORS`
  - `web/app/(app)/campaigns/new/page.tsx` - xóa option
  - `web/components/campaign-assistant/steps/StepPreview.tsx` - xóa option
  - `web/app/(app)/campaigns/[id]/page.tsx` - xóa Instagram case
  - `web/app/(app)/calendar/page.tsx` - xóa Instagram icon
  - `web/components/campaign/CalendarPreviewModal.tsx` - xóa Instagram

### [DONE] Đổi tên Video Script → "Kịch bản cho Video"
- **Ngày**: 2026-05-15
- **Files**: Tất cả nơi có label "video_script" hoặc "Video Script"

### [DONE] Tách riêng link click (email) và link mở (Facebook)
- **Ngày**: 2026-05-15
- **Changes**:
  - Model: thêm column `link_type` (email_click | facebook_post)
  - Migration: `ALTER TABLE campaign_tracking_links ADD COLUMN link_type VARCHAR(32) NOT NULL DEFAULT 'email_click'`
  - API: `TrackingLinkCreate` yêu cầu `link_type`
  - `TrackingLinksManager`: 2 phần riêng biệt - "Link Click (Email)" và "Link Mở (Facebook Post)"
  - Analytics: `email_link_clicks` và `fb_link_clicks` riêng biệt
  - Delivery service: chỉ dùng `email_click` links cho email CTA

### [DONE] Facebook Post Link - hiển thị fb_post_url
- **Ngày**: 2026-05-15
- **Changes**:
  - UI Facebook post thêm `fb_post_url` display (view mode + form edit)
  - AI prompt facebook_post yêu cầu trả về `fb_post_url`

### [DONE] Kịch bản cho Video format đạo diễn
- **Ngày**: 2026-05-15
- **Changes**:
  - Backend prompt: cấu trúc `scenes[]` với sequence, setting, duration, camera_angle, subject_action, dialog_or_narration, visual_note
  - Component `VideoScriptContent` (`web/components/campaign/VideoScriptContent.tsx`) render format mới
  - Fallback cho format cũ (hook/body/cta)

---

## Các Thay đổi Đã Thực Hiện (2026-05-16)

### TODO 1: Auto-generate short links cho email và facebook
**Mô tả**: Trên `/campaigns/new`, sau khi tạo campaign → modal hỏi user nhập destination URL → hệ thống tạo 2 short links cho MỖI URL (email_click + facebook_post).

**Files changed**:
- `api/routers/tracking_links.py`: Thêm endpoint `POST /{campaign_id}/tracking-links/bulk` tạo nhiều links cùng lúc
- `web/components/campaign/TrackingLinksModal.tsx`: Viết lại hoàn toàn — user nhập danh sách URL, hệ thống tạo links
- `web/app/(app)/campaigns/new/page.tsx`: Gọi bulk endpoint sau khi campaign được tạo

### TODO 2: Đổi label checkbox image_required
**Files changed**: `web/app/(app)/campaigns/new/page.tsx`
- Label: "Cần hệ thống gợi ý prompt tạo ảnh" → "Hệ thống hỗ trợ AI tạo ảnh giúp đăng kèm luôn"
- Thêm mô tả ngắn: "Bật tùy chọn này, ảnh sẽ được tạo và gắn kèm tự động vào email và bài đăng"
- Màu accent đổi thành `#377D73` (brand color)

### TODO 3: Upload nhiều ảnh & hiển thị trong email & Facebook post
**Mô tả**:
- Cho phép upload nhiều ảnh (không giới hạn số lượng)
- Ảnh lưu trong `content_item.content_json.images` (list of URLs)
- Cloudinary (nếu configured) hoặc local filesystem
- Hiển thị grid 3 cột với lightbox preview
- Upload button "+ Thêm ảnh" khi chưa có ảnh

**Files changed**:
- `api/routers/content.py`:
  - Thêm imports: `asyncio`, `io`, `UploadFile`, `File`, `datetime`
  - Thêm helpers: `_upload_to_cloudinary()`, `_save_local_image()`
  - Thêm endpoint: `POST /{content_id}/images` — upload và append vào `images` list
  - Thêm endpoint: `DELETE /{content_id}/images` — xóa toàn bộ ảnh
- `web/components/campaign/ContentImages.tsx`: Component upload & display ảnh (dùng fetch trực tiếp cho FormData)
- `web/app/(app)/campaigns/[id]/page.tsx`: Thêm grid ảnh vào Facebook post và email section

### TODO 4: AI campaign suggestion flow ăn khớp
**Files changed**:
- `web/components/campaign-assistant/CampaignAssistantModal.tsx`: Thêm `image_required: boolean` vào `BriefForm`
- `web/components/campaign-assistant/steps/StepPreview.tsx`:
  - Thêm toggle `image_required` vào preview form
  - Gửi `additional_notes` với nội dung `[IMAGE_REQUIRED]` khi checkbox được bật
  - Update `updateBrief()` để handle boolean values

---

## Notes

### Image Upload Architecture
- Endpoint: `POST /content/{content_id}/images` (content router)
- Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` in .env
- Local fallback: `api/static/uploads`
- Decision: if all 3 Cloudinary vars set → Cloudinary, else → local
- Images stored in: `content_item.content_json.images` (list of strings)
- Display: grid 3 columns, lightbox on click
- Upload: fetch API trực tiếp (not via api-client vì không hỗ trợ FormData)

### Tracking Link URL Pattern
- Short URL: `{TRACKING_PUBLIC_BASE_URL}/r/{short_code}`
- Redirect: `GET /r/{short_code}` → tăng click_count → redirect đến destination_url
- Bulk endpoint: `POST /campaigns/{id}/tracking-links/bulk` với `{ destination_urls: [...] }`
- Mỗi URL tạo 2 links: `email_click` và `facebook_post`
