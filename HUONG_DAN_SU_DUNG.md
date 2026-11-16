# Hướng dẫn Setup Tài khoản & Sử dụng Hệ thống SocialPulse FB

> Tài liệu hướng dẫn chi tiết cách thiết lập môi trường, cấu hình cụm nhiều tài khoản Facebook chạy song song an toàn (Anti-Checkpoint), nạp kho tri thức đa phương tiện (RAG) và vận hành toàn bộ 5 module của **SocialPulse FB**.

---

## Mục lục
1. [Tổng quan kiến trúc & Phân hệ màu sắc](#1-tổng-quan-kiến-trúc--phân-hệ-màu-sắc)
2. [Cài đặt hệ thống & Cấu hình Gemini API](#2-cài-đặt-hệ-thống--cấu-hình-gemini-api)
3. [Hướng dẫn chi tiết Setup nhiều Tài khoản Facebook (Cookie, Proxy, Warm-up)](#3-hướng-dẫn-chi-tiết-setup-nhiều-tài-khoản-facebook)
4. [Quy trình vận hành 5 Module từ A–Z](#4-quy-trình-vận-hành-5-module-từ-a-z)
   - [Module 1: Tìm kiếm Group, Kiểm tra Phê duyệt & Auto-Join](#module-1-tìm-kiếm-group-kiểm-tra-phê-duyệt--auto-join)
   - [Module 2: Quét Bài đăng & Comment Song song (Delay 3–10s)](#module-2-quét-bài-đăng--comment-song-song-delay-3-10s)
   - [Module 3: Kho tài liệu nguồn RAG đa phương tiện & AI Content 2 Cột](#module-3-kho-tài-liệu-nguồn-rag-đa-phương-tiện--ai-content-2-cột)
   - [Module 4: Dashboard Báo cáo Realtime](#module-4-dashboard-báo-cáo-realtime)
   - [Module 5: An toàn Anti-Ban, UTM Tracking & Chạy Playwright Script](#module-5-an-toàn-anti-ban-utm-tracking--chạy-playwright-script)
5. [Checklist chống khóa tài khoản & Xử lý sự cố](#5-checklist-chống-khóa-tài-khoản--xử-lý-sự-cố)

---

## 1. Tổng quan kiến trúc & Phân hệ màu sắc

- **Frontend:** React 19, Vite 8, Tailwind CSS v4 (giao diện sáng Light Mode dễ quản trị).
- **Backend & Realtime:** Node.js 22 + Express + Server-Sent Events (`/api/events`).
- **Cơ sở dữ liệu:** SQLite cục bộ (`node:sqlite`) lưu tại `data/social_listening.db`.
- **AI & Multimodal RAG:** Google `@google/genai` chạy hoàn toàn phía server (`gemini-4-hydrogen` cho sinh nội dung, phân tích video/ảnh/PDF và `gemini-3.5-transcribe` cho chép lời âm thanh).

| Màu nhận diện | Phân hệ trên thanh điều hướng | Chức năng chính |
| :--- | :--- | :--- |
| **Xanh dương (`Blue`)** | **Tổng quan Realtime** (Module 4) | Theo dõi KPI, biểu đồ Post/Comment, luồng Worker SSE và cụm tài khoản |
| **Chàm (`Indigo`)** | **Tài khoản Facebook** | Thêm/bật/tắt nhiều tài khoản FB, Cookie, Proxy, Warm-up & hạn mức |
| **Xanh ngọc (`Teal`)** | **Tìm kiếm Group** (Module 1) | Tìm Group theo từ khóa, nhận diện quyền phê duyệt & Auto-Join |
| **Cam (`Amber`)** | **Quét Nội dung** (Module 2) | Chia Group cho nhiều tài khoản quét song song với Random Delay 3–10s |
| **Tím (`Violet`)** | **AI Content & RAG** (Module 3) | Nạp tài liệu nguồn mọi định dạng & sinh bình luận bán hàng 2 cột |
| **Xanh lá (`Emerald`)** | **An toàn & Tối ưu** (Module 5) | Thiết lập ngưỡng Anti-Ban, UTM link & copy Playwright script |

---

## 2. Cài đặt hệ thống & Cấu hình Gemini API

### 2.1. Cấu hình `GEMINI_API_KEY`
1. Tại môi trường **AI Studio**, mở bảng **Settings > Secrets** và thiết lập biến `GEMINI_API_KEY`.
2. Nếu tự triển khai trên máy cá nhân / VPS, tạo file `.env` ở thư mục gốc (tham khảo `.env.example`):
   ```env
   GEMINI_API_KEY="AIzaSy..."
   APP_URL="http://localhost:3000"
   ```
> **Lưu ý:** Hệ thống gọi Gemini API hoàn toàn ở server-side; tuyệt đối không nhập API key trên giao diện web.

### 2.2. Chạy ứng dụng
```bash
# Cài đặt thư viện
npm install

# Chạy môi trường phát triển (cổng 3000)
npm run dev

# Kiểm tra TypeScript & Unit Tests
npm run lint
npm test

# Build & chạy bản Production
npm run build
npm start
```

---

## 3. Hướng dẫn chi tiết Setup nhiều Tài khoản Facebook

Để chạy **nhiều tài khoản song song** mà không bị Facebook Checkpoint hoặc khóa hàng loạt, hãy thiết lập đúng từng bước trong mục **Tài khoản Facebook** trên thanh menu trái.

### Bước 1: Chuẩn bị thông tin từng tài khoản
Mỗi tài khoản Facebook cần có **3 thông số bắt buộc** và **1 Proxy riêng**:

1. **Facebook UID**:
   - Mở trang cá nhân Facebook trên trình duyệt -> bấm vào ảnh đại diện hoặc xem URL dạng `https://www.facebook.com/profile.php?id=100084920112345`.
   - Chuỗi số `100084920112345` chính là **Facebook UID** (nếu dùng username chữ, mở nguồn trang `Ctrl+U` và tìm `"userID"` để lấy dãy số UID).

2. **Chuỗi Cookie phiên đăng nhập (`c_user`, `xs`, `datr`)**:
   - Đăng nhập sẵn tài khoản Facebook trên một Profile trình duyệt sạch (Chrome/Edge/AdsPower/GoLogin).
   - Nhấn `F12` mở DevTools -> tab **Application** -> mục **Cookies** -> `https://www.facebook.com`.
   - Lấy giá trị 3 cookie quan trọng: `c_user`, `xs`, `datr` (hoặc dùng extension xuất cookie dạng chuỗi `name=value;`), ghép thành 1 dòng:
     ```text
     c_user=100084920112345; xs=42%3AAbCdEfGh123456%3A2%3A1763200000; datr=xY9zK_hcm01;
     ```
   - **Quan trọng:** Sau khi lấy Cookie, **không bấm Đăng xuất (Log out)** trên trình duyệt gốc vì hành động Log out sẽ hủy token `xs` ngay lập tức. Chỉ cần đóng tab là cookie vẫn sống.

3. **Proxy riêng (`SOCKS5 / HTTP`)**:
   - Nguyên tắc vàng: **1 tài khoản Facebook = 1 IP Proxy cố định (Residential Proxy hoặc Dcom 4G xoay IP riêng theo tài khoản)** cùng quốc gia/khu vực (VD: Việt Nam - HCM/HN).
   - Định dạng nhập vào ô Proxy:
     ```text
     socks5://user:password@103.xx.xx.xx:1080
     # hoặc HTTP proxy:
     http://user:password@103.xx.xx.xx:8080
     ```
   - Tránh để nhiều tài khoản seeding chạy song song trên cùng 1 IP hoặc dùng IP Data Center (AWS/GCP/DO) dễ bị khóa checkpoint ảnh/SĐT.

4. **Độ tin cậy (Warm-up) & Giới hạn hành động mỗi ngày**:
   Chọn đúng độ tuổi tài khoản để đặt `Max Join / ngày` và `Max Comment / ngày` an toàn:

   | Giai đoạn Warm-up | Khuyến nghị Max Join / ngày | Khuyến nghị Max Comment / ngày | Lưu ý vận hành |
   | :--- | :--- | :--- | :--- |
   | **Mới (1-7 ngày)** | `2 – 4` nhóm | `3 – 6` bình luận | Chủ yếu cho quét đọc nội dung; hạn chế rải link ở tuần đầu |
   | **Đang nuôi (8-21 ngày)** | `5 – 8` nhóm | `10 – 15` bình luận | Có thể tham gia Group Public và comment tư vấn tự nhiên |
   | **Tin cậy (>21 ngày)** | `10 – 15` nhóm | `20 – 30` bình luận | Chạy song song tốc độ ổn định; dùng để gánh tải quét chính |

### Bước 2: Thêm tài khoản & Điều phối trên Dashboard
1. Điền biểu mẫu **Thêm tài khoản Facebook mới** bên trái -> bấm **Thêm tài khoản Facebook**.
2. Thẻ tài khoản xuất hiện ở danh sách bên phải với trạng thái `Sẵn sàng`, link UID, tình trạng Cookie (`Hợp lệ` / `Cần làm mới`), Proxy và 2 thanh đo quota **Join** / **Comment** trong ngày.
3. Bạn có thể bấm **Đang kích hoạt / Bật lại** để tạm ngắt 1 tài khoản khi cần nghỉ dưỡng hoặc thay Cookie mà không mất dữ liệu lịch sử.

---

## 4. Quy trình vận hành 5 Module từ A–Z

### Module 1: Tìm kiếm Group, Kiểm tra Phê duyệt & Auto-Join
1. Vào tab **Tìm kiếm Group** (khối màu **Teal**).
2. Nhập **Từ khóa tìm kiếm Group Facebook** (VD: `đồ gia dụng thông minh`, `mẹ và bé`, `setup góc làm việc`). Mỗi từ khóa sẽ tự động tạo **1 tập dữ liệu riêng biệt** ở thanh tab phía dưới.
3. Chọn **Số nhóm mục tiêu** (`4`, `6`, `8` hoặc `10` nhóm) và tick **Auto-Join nhóm Public** nếu muốn hệ thống tự động bấm tham gia các nhóm công khai.
4. Ở mục **Chọn tài khoản Facebook chạy song song**, tick từ 2 tài khoản trở lên để hệ thống chia đều danh sách Group cho từng tài khoản thực hiện đồng thời.
5. Bấm **Tìm kiếm Group**. Bảng kết quả hiển thị đầy đủ 9 cột:
   - `Keyword`, `Tên Group`, `Thành viên`, `Loại` (`Public` / `Private`)
   - **`Đăng bài`**: `Không cần duyệt` (xanh lá — đăng bài lên tường nhóm hiển thị ngay) vs `Cần duyệt bài` (cam — phải chờ Admin duyệt)
   - **`Bình luận`**: `Tự do bình luận` (xanh lá — comment hiển thị ngay dưới bài viết) vs `Kiểm duyệt bình luận` (cam)
   - `Tài khoản` phụ trách, `Link` mở trực tiếp Facebook, `Trạng thái` + nút **`+ Join`** thủ công.
6. Dùng bộ lọc nhanh **Đăng bài không cần duyệt** hoặc **Comment không cần duyệt** để lọc ra các Group chất lượng cao cho chiến dịch seeding, bấm **Xuất CSV / Sheet** hoặc bấm **Quét nội dung tập này →** để chuyển sang Module 2.

---

### Module 2: Quét Bài đăng & Comment Song song (Delay 3–10s)
1. Vào tab **Quét Nội dung** (khối màu **Amber**).
2. Chọn **Tập dữ liệu Group cần quét** đã thu thập ở Module 1.
3. Nhập **Từ khóa theo dõi** (phân cách bằng dấu phẩy, VD: `robot hút bụi, tư vấn, báo giá, xin review`).
4. Thiết lập **Delay Min / Max** (mặc định an toàn **`3` – `10` giây** để mô phỏng tốc độ đọc của người thật giữa các Group).
5. Tick chọn **nhiều tài khoản Facebook quét song song** (VD: 2–4 luồng đồng thời).
6. Bấm **Bắt đầu quét**:
   - Thanh tiến độ SSE hiển thị trực tiếp số lượng nhóm đã quét và trạng thái từng tài khoản (`Đang quét`). Có thể bấm **Dừng quét** bất cứ lúc nào.
   - Bảng dữ liệu hiển thị kết quả quét cả **Post** và **Comment**, kèm cột **Phê duyệt** (`Bài: ...`, `Cmt: ...`), `Tài khoản` đã quét và nút **AI Reply** để đẩy thẳng bài khách hàng sang Module 3.
   - Hỗ trợ lọc theo `Post / Comment`, lọc `Đăng bài không cần duyệt`, `Comment không cần duyệt`, lọc theo tập Group và **Xuất CSV / Sheet**.

---

### Module 3: Kho tài liệu nguồn RAG đa phương tiện & AI Content 2 Cột

#### A. Nạp Kho tài liệu nguồn RAG (Hỗ trợ MỌI định dạng file tới 50MB)
1. Vào tab **AI Content & RAG** (khối màu **Violet**) -> chuyển sang tab phụ **Kho tài liệu nguồn RAG**.
2. Bạn có thể **kéo thả hoặc chọn 1 hay nhiều file bất kỳ** vào vùng dropzone:
   - **Âm thanh** (`.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg`, `.flac`, `.webm`...): Tự động chép lời Speech-to-Text qua model `gemini-3.5-transcribe`. Phù hợp nạp file ghi âm cuộc gọi tư vấn, voice training nhân viên sale.
   - **Video** (`.mp4`, `.mov`, `.webm`, `.avi`, `.mkv`...): Tự động tải lên Gemini Files API và trích xuất cả lời thuyết minh lẫn chữ/bảng giá/thông số hiển thị trên video qua `gemini-4-hydrogen`.
   - **Hình ảnh** (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.heic`...): OCR đọc bảng giá, ảnh chụp thông số, poster khuyến mãi.
   - **Tài liệu** (`.pdf`, `.docx`, `.xlsx`, `.pptx`, `.txt`, `.md`, `.csv`, `.json`, `.html`, `.xml`...): Tự động giải mã hoặc đọc tài liệu bằng AI để cắt nhỏ thành từng chunk phục vụ truy xuất ngữ nghĩa.
3. Chọn **Phân loại kiến thức** (và tùy chọn nhập **Tiêu đề tài liệu** nếu chỉ tải 1 file; nếu để trống hệ thống tự lấy tên file). Ngoài ra vẫn có thể dán văn bản trực tiếp vào biểu mẫu và bấm **Lưu vào Kho RAG**.

#### B. Làm việc tại Xưởng Content AI (2 Cột)
1. Chuyển về tab **Xưởng Content AI (2 Cột)**.
2. **Cột 1 (Trái) — Nội dung khách hàng:** Hiển thị tên người đăng, tên Group, thời gian, nội dung bài/comment, từ khóa khớp, trạng thái kiểm duyệt bình luận (`Tự do bình luận` / `Kiểm duyệt bình luận`) và link **Mở trên Facebook**.
3. **Cột 2 (Phải) — Nội dung AI đề xuất (RAG):**
   - Có thể nhập nhanh **Tone giọng tùy chọn** ở thanh trên cùng (VD: `ngắn gọn, thân thiện như người dùng thật`).
   - Bấm **Sinh AI Content** (hoặc **Sinh lại AI**). AI sẽ đối chiếu câu hỏi ở Cột 1 với các chunk liên quan nhất trong **Kho tài liệu nguồn RAG** (hiển thị ở dòng `Nguồn tham chiếu`) và tạo câu trả lời không bịa đặt thông số, kèm kiểm tra tránh trùng lặp câu từ.
   - Chỉnh sửa lại câu chữ trong ô text nếu cần, rồi chọn:
     - **Copy:** Sao chép vào clipboard để tự dán tay trên Facebook.
     - **Approve:** Đưa vào hàng đợi Auto-Comment an toàn (tự kiểm tra hạn mức ngày và khung giờ hoạt động).

---

### Module 4: Dashboard Báo cáo Realtime
- Theo dõi 4 chỉ số tức thời: **Group đã quét** (kèm số nhóm đăng không cần duyệt), **Tài khoản song song**, **Bài & Comment quét**, **AI Content & Duyệt**.
- **Biểu đồ cột** phân tách lượng **Bài đăng (Post)** và **Bình luận (Comment)** theo ngày + **Phân bổ theo từ khóa mục tiêu**.
- Giám sát **Trạng thái luồng cào dữ liệu (SSE)**, **Cụm Tài khoản Facebook chạy song song** và **Nhật ký thực thi gần nhất**.

---

### Module 5: An toàn Anti-Ban, UTM Tracking & Chạy Playwright Script
1. Vào tab **An toàn & Tối ưu** (khối màu **Emerald**).
2. Cấu hình các tham số bảo vệ toàn cục:
   - **Random Delay tối thiểu / tối đa** (mặc định `3s – 10s`).
   - **Khung giờ hoạt động (0–23h)** (khuyến nghị `8h – 22h` đúng giờ sinh hoạt người dùng Việt Nam).
   - Bật **Tự động ngắt toàn bộ worker nếu phát hiện cảnh báo Checkpoint / 429 Rate Limit**.
   - Bật **Kiểm tra độ tương đồng Jaccard chống đăng bình luận trùng lặp giữa các Group**.
3. Cấu hình **Link Landing Page / Zalo OA / Messenger** và các tham số `utm_source`, `utm_medium`, `utm_campaign` để AI tự chèn link đo lường chuyển đổi Google Analytics khi phù hợp.
4. Cuối trang có sẵn **Playwright Multi-Account Worker Script** và **SQLite Schema** để bạn sao chép chạy kết nối trình duyệt Chromium thật bằng Cookie phiên Facebook nội bộ khi triển khai tự động hóa ngoài môi trường sandbox.

---

## 5. Checklist chống khóa tài khoản & Xử lý sự cố

### Checklist an toàn hàng ngày
- Không dùng 1 tài khoản để vừa Join hàng loạt vừa Comment dồn dập trong vài phút; luôn tách tải qua **2–5 tài khoản song song** với Proxy riêng.
- Ưu tiên lọc các Group **`Không cần duyệt`** hoặc **`Tự do bình luận`** ở Module 1 & 2 để tăng tỷ lệ hiển thị tự nhiên, tránh spam lại nhiều lần vào Group kiểm duyệt gắt.
- Luôn kiểm tra kỹ câu trả lời ở Cột 2 trước khi bấm **Approve**, và xoay vòng tone giọng để giữ độ tương đồng Jaccard ở mức thấp.

### Xử lý các lỗi thường gặp
- **Báo lỗi `Chưa cấu hình GEMINI_API_KEY` khi sinh AI hoặc tải file Ảnh/Audio/Video/PDF:**
  Kiểm tra lại `GEMINI_API_KEY` trong bảng **Secrets** của AI Studio (hoặc file `.env`), sau đó khởi động lại server. *(Lưu ý: các file `.txt`, `.md`, `.csv`, `.json`, `.docx`, `.xlsx`, `.pptx` được giải mã trực tiếp trên máy chủ không cần chờ API).*
- **Báo lỗi vượt hạn mức `429` khi Join Group hoặc Approve Comment:**
  Hệ thống đã chặn để bảo vệ tài khoản khỏi checkpoint. Chờ sang ngày hôm sau hoặc điều chỉnh tăng ngưỡng cẩn trọng trong **Module 5** / bật thêm tài khoản phụ ở tab **Tài khoản Facebook**.
- **Muốn xóa sạch dữ liệu cũ về trạng thái mặc định ban đầu:**
  Dừng server, xóa thư mục `data/social_listening.db*` và chạy lại `npm run dev` để hệ thống tự khởi tạo lại database mẫu.
