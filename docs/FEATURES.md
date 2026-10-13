# 📱 TECHSHARE - DANH MỤC TOÀN DIỆN CÁC TÍNH NĂNG HỆ THỐNG
> **Nền tảng Chia sẻ/Cho thuê Thiết bị Công nghệ & Trợ lý Trí tuệ Nhân tạo Google Gemini**  
> **Dự án Môn học**: MMA301 - Cross-Platform Mobile Applications Development (FPT University)  
> **Quy mô nhóm**: 5 Thành viên | **Công nghệ cốt lõi**: React Native (Expo SDK 57), Node.js (Express), MongoDB Atlas (GeoJSON 2dsphere), Google Gemini AI

---

## 📑 MỤC LỤC PHÂN HỆ TÍNH NĂNG

| STT | Phân hệ (Module) | Nhóm người dùng | Điểm nhấn công nghệ chính |
| :---: | :--- | :--- | :--- |
| **01** | [Khách vãng lai & Onboarding](#1-phân-hệ-1-khách-vãng-lai--trải-nghiệm-ban-đầu-guest--onboarding) | Guest / Người dùng mới | Onboarding Slider, Live Search Debounce, Bản đồ GPS `react-native-maps`, Biometrics |
| **02** | [Người thuê thiết bị (Renter)](#2-phân-hệ-2-người-thuê-thiết-bị-renter---booking--experience) | Renter (Creator, Reviewer) | Smart Date Picker, Countdown Timer, Mã QR bàn giao, Handover Photos, Hủy & Gia hạn |
| **03** | [Chủ sở hữu thiết bị (Owner)](#3-phân-hệ-3-chủ-sở-hữu-thiết-bị-owner---monetization--fleet-management) | Owner (Chủ máy, Studio) | `expo-image-picker`, Auto GPS Tagging, Availability Calendar, Thống kê doanh thu, Trừ cọc hư hại |
| **04** | [Trí tuệ nhân tạo Gemini AI](#4-phân-hệ-4-trợ-lý-trí-tuệ-nhân-tạo-google-gemini-ai-ai-tech-hub) | Toàn bộ người dùng | Google Gemini AI (`gemini-1.5-flash`), Review Summarizer (Pros/Cons), Device Comparator, AI Consultant |
| **05** | [Giao tiếp thời gian thực](#5-phân-hệ-5-giao-tiếp-thời-gian-thực--chăm-sóc-khách-hàng-communication) | Renter ⇋ Owner | In-App Real-time Chat, Gửi ảnh & Vị trí, Quick message templates, Push Notifications |
| **06** | [Bảo mật, Định danh & eKYC](#6-phân-hệ-6-bảo-mật-định-danh--tín-nhiệm-trust-security--ekyc) | Toàn hệ thống | eKYC quét CCCD 2 mặt, Tích xanh `isVerified`, Điểm tín nhiệm Trust Score, Hợp đồng điện tử |
| **07** | [Ví nội bộ, Voucher & Loyalty](#7-phân-hệ-7-ví-nội-bộ-khuyến-mãi--gamification-finance--loyalty) | Renter & Owner | Ví ký quỹ Escrow Mock, Quản lý Voucher khuyến mãi, Mã giới thiệu Referral, Huy hiệu thành viên |
| **08** | [Kỹ thuật & Ngoại tuyến (Offline)](#8-phân-hệ-8-nền-tảng-kỹ-thuật--trải-nghiệm-ngoại-tuyến-offline-first) | Hệ thống Mobile Client | Offline-First với AsyncStorage, NetInfo listener, Nén ảnh client-side, 60-120 FPS FlatList, Dark Mode |
| **09** | [Quản trị hệ thống (Admin Hub)](#9-phân-hệ-9-quản-trị-viên-hệ-thống-admin--platform-governance) | Quản trị viên (Admin) | Dashboard phân tích số liệu, Kiểm duyệt thiết bị vi phạm, Đối soát ảnh tranh chấp cọc, Duyệt eKYC |

---

## 1. PHÂN HỆ 1: KHÁCH VÃNG LAI & TRẢI NGHIỆM BAN ĐẦU (GUEST & ONBOARDING)
*Dành cho người mới cài ứng dụng Expo hoặc chưa xác thực tài khoản:*

### 1.1. Khám phá Danh mục Thiết bị (Catalog Explorer)
- **Lướt 6 danh mục chuẩn**: Smartphone, Laptop, Camera & Lens, Drone & Gimbal, Audio (Loa/Tai nghe), Gaming & Phụ kiện.
- **Danh sách nổi bật (Featured / Hot Devices)**: Các dòng máy cao cấp được thuê nhiều nhất trên nền tảng.
- **Danh sách máy mới đăng (Newly Listed)**: Cập nhật liên tục từ các chủ máy xung quanh.
- **Carousel Banner Khuyến mãi**: Hiển thị các gói giảm giá cuối tuần và chương trình trải nghiệm máy mới.

### 1.2. Tìm kiếm & Bộ lọc Nâng cao (Live Search & Multi-criteria Filter)
- **Tìm kiếm thời gian thực (Live Search Debounce 400ms)**: Tìm nhanh theo tên máy, thương hiệu, từ khóa thông số.
- **Lịch sử tìm kiếm & Từ khóa xu hướng**: Lưu lại các lần tìm gần nhất và gợi ý từ khóa hot ("Sony FX3", "MacBook M3", "DJI Mini 4").
- **Bộ lọc theo khoảng giá thuê/ngày**: Thanh kéo Slider chọn chính xác mức giá từ 50.000đ đến 5.000.000đ/ngày.
- **Bộ lọc theo thương hiệu**: Apple, Sony, Canon, DJI, Dell, Asus, Fujifilm, Samsung, Rode...
- **Bộ lọc theo bán kính GPS**: Tìm máy trong phạm vi 2km, 5km, 10km, 20km quanh vị trí thực tế.
- **Sắp xếp đa chiều**: Giá tăng/giảm, đánh giá sao cao nhất, khoảng cách gần nhất, lượt thuê nhiều nhất.

### 1.3. Chi tiết Thiết bị Minh bạch (Device Transparency Detail)
- **Carousel album ảnh thực tế**: Hỗ trợ vuốt chạm mượt mà, bộ đếm ảnh (`1/4`) và chạm để mở ảnh toàn màn hình (Zoom modal).
- **Bảng thông số kỹ thuật động (Dynamic Specs Sheet)**: Hiển thị CPU, RAM, Cảm biến, Độ phân giải, Pin, Phụ kiện đi kèm.
- **Chính sách cọc & Giấy tờ**: Công khai giá trị cọc bảo đảm, yêu cầu CCCD hoặc giữ lại giấy tờ tùy thân.
- **Hồ sơ Chủ sở hữu (Owner Profile Card)**: Avatar, Tên, Huy hiệu uy tín (`isVerified`), Điểm rating trung bình, Tỷ lệ phản hồi đơn.
- **Đánh giá cộng đồng**: Danh sách nhận xét, chấm điểm 1 - 5 sao và hình ảnh chụp thật từ khách thuê trước.

### 1.4. Bản đồ Không gian GPS Lân cận (Interactive Geospatial Map)
- Tích hợp thư viện `react-native-maps` tương tác toàn màn hình.
- Các **Ghim tùy biến (Custom Markers)** theo từng danh mục biểu thị vị trí đặt thiết bị.
- Chạm Marker bung thẻ tóm tắt (**Callout card**): Tên máy, ảnh thumbnail, giá thuê/ngày, khoảng cách (km) và nút chuyển nhanh tới trang chi tiết.
- Phân cụm ghim bản đồ (**Marker Clustering**) chống rối mắt tại các khu vực có mật độ thiết bị cao.

### 1.5. Trải nghiệm Trợ lý AI (Gemini AI Preview)
- Cho phép khách vãng lai dùng thử tính năng **AI Tóm tắt Review** (Ưu điểm, Nhược điểm, Lời khuyên mục đích thuê).
- Dùng thử tính năng **So sánh 2 thiết bị công nghệ** đối đầu mà không bắt buộc đăng nhập.

### 1.6. Xác thực & Đăng nhập Sinh trắc học (Authentication & Biometrics)
- **Onboarding Slider**: 3 slide giới thiệu ngắn gọn lợi ích nền tảng khi mở app lần đầu tiên.
- **Đăng ký tài khoản**: Tên, Email, Mật khẩu, Số điện thoại, Địa chỉ, tự động gán vai trò kép `both`.
- **Đăng nhập an toàn**: Mã hóa mật khẩu với `bcryptjs`, cấp phát JWT Token.
- **Xác thực Sinh trắc học**: Hỗ trợ đăng nhập nhanh bằng Vân tay (Fingerprint) hoặc Khuôn mặt (FaceID) cho các phiên sau.

---

## 2. PHÂN HỆ 2: NGƯỜI THUÊ THIẾT BỊ (RENTER - BOOKING & EXPERIENCE)
*Dành cho Reviewer, Creator, Nhiếp ảnh gia, Sinh viên cần máy phục vụ công việc và dự án ngắn hạn:*

### 2.1. Yêu thích & Bộ sưu tập Cá nhân (Wishlist & Collections)
- Nút thả tim lưu nhanh thiết bị yêu thích.
- Tạo bộ sưu tập theo ngữ cảnh: *"Quay Vlog Du lịch"*, *"Chụp ảnh Kỷ yếu"*, *"Làm phim Ngắn"*.
- Tự động lưu cache offline qua `AsyncStorage` để xem lại khi mất kết nối mạng.

### 2.2. Quy trình Đặt thuê Thông minh (Smart Booking Flow)
- **Bộ chọn lịch tương tác (Interactive Date Range Picker)**: Chọn ngày nhận và ngày trả máy.
- **Trực quan hóa lịch bận**: Tự động đánh dấu xám và vô hiệu hóa các ngày máy đã có người đặt thuê (chống trùng lịch).
- **Tự động tính toán chi phí minh bạch**:
  - `Số ngày thuê thực tế = Ngày trả - Ngày nhận`.
  - `Tiền thuê = Giá thuê/ngày * Số ngày`.
  - **Chiết khấu thuê dài ngày**: Giảm 10% khi thuê từ 3 ngày, giảm 20% khi thuê từ 7 ngày trở lên.
  - **Tiền cọc bảo đảm (Deposit Fee)**: Tùy theo giá trị của từng dòng thiết bị.
  - **Áp dụng Voucher**: Nhập mã giảm giá khuyến mãi (ví dụ: `WELCOME50`, `WEEKEND10`).
  - `Tổng thanh toán cuối cùng = Tiền thuê - Khuyến mãi + Tiền cọc`.
- **Hình thức giao nhận**: Nhận trực tiếp tại địa chỉ chủ máy hoặc Giao máy tận nơi (nhập địa chỉ nhận hàng có Formik + Yup validate).

### 2.3. Theo dõi Vòng đời Đơn thuê (My Bookings Lifecycle)
- **Phân tab tiến trình**:
  - `Chờ duyệt (pending)`: Đang chờ chủ máy xem xét yêu cầu.
  - `Đã duyệt (approved)`: Chủ máy đã đồng ý, chuẩn bị gặp giao nhận.
  - `Đang thuê (active)`: Khách đang cầm máy sử dụng.
  - `Đã hoàn tất (completed)`: Đã trả máy, chủ máy kiểm tra và hoàn cọc xong.
  - `Đã hủy (cancelled)`: Đơn bị từ chối hoặc người thuê chủ động hủy.
- **Sơ đồ Timeline đơn hàng**: Hiển thị trực quan từng mốc thời gian (Thời điểm đặt, Thời điểm duyệt, Thời điểm nhận máy, Hạn trả).
- **Đồng hồ đếm ngược thời gian thuê (Countdown Timer)**: Hiển thị số giờ/phút còn lại của gói thuê.
- **Hủy đơn thuê**: Cho phép hủy đơn khi đơn còn ở trạng thái `pending`.
- **Yêu cầu gia hạn (Request Rental Extension)**: Gửi thông báo đề xuất thêm ngày thuê trực tiếp tới chủ máy.

### 2.4. Biên bản Bàn giao Điện tử (Digital Handover Protocol)
- **Mã QR bàn giao**: Người thuê xuất trình mã QR đơn hàng để chủ máy quét xác nhận thời điểm gặp mặt.
- **Chụp ảnh nhận máy (`handoverPhotos.beforeRental`)**: Chụp ảnh 4 góc máy và phụ kiện kèm theo lúc nhận bàn giao.
- **Ghi chú hiện trạng ban đầu**: Ghi nhận mức pin ban đầu, vết trầy xước có sẵn để phòng tránh tranh chấp khi trả.

### 2.5. Trả máy, Chấm sao & Hoàn cọc (Return, Review & Refund)
- Thông báo nhắc hạn trả máy trước 6 tiếng và 2 tiếng.
- Chụp ảnh bàn giao trả máy (`handoverPhotos.afterRental`).
- Nhận lại 100% tiền cọc bảo đảm vào Ví cá nhân sau khi đơn hoàn tất.
- **Đánh giá 1 - 5 sao kèm ảnh chụp thật**: Nhận xét chất lượng thiết bị và độ nhiệt tình của chủ máy.

---

## 3. PHÂN HỆ 3: CHỦ SỞ HỮU THIẾT BỊ (OWNER - MONETIZATION & FLEET MANAGEMENT)
*Dành cho cá nhân, Studio hoặc cửa hàng có thiết bị nhàn rỗi muốn gia tăng thu nhập:*

### 3.1. Đăng tin Cho thuê Chuyên nghiệp (Device Listing Suite)
- Tải lên tối đa 8 ảnh thực tế chụp từ Camera hoặc Thư viện (`expo-image-picker`), hỗ trợ đổi thứ tự ảnh.
- **Tự động gắn tọa độ GPS vị trí cất máy**: Tích hợp `expo-location` lưu toạ độ GeoJSON `Point [kinh độ, vĩ độ]` vào MongoDB.
- Nhập thông tin chi tiết: Tên máy, Thương hiệu, Năm sản xuất, Tình trạng (Mới 99%, 95%, Có vết xước nhẹ).
- Thiết lập giá thuê theo ngày, tiền cọc bảo đảm và khai báo danh sách phụ kiện đi kèm.
- Nhập bảng thông số kỹ thuật tùy biến dạng Key-Value (Specs Map).
- **AI Gợi ý giá thuê thông minh**: Gemini AI phân tích model máy và đề xuất mức giá thuê hợp lý nhất theo thị trường.

### 3.2. Quản lý Kho máy của tôi (Fleet Management)
- Xem danh sách toàn bộ thiết bị đang sở hữu kèm số liệu: Số lượt đã cho thuê, Doanh thu tích lũy, Điểm đánh giá sao.
- **Công tắc trạng thái nhanh (Quick Status Switch)**:
  - `available`: Sẵn sàng cho thuê (hiển thị trên Trang chủ và Bản đồ).
  - `maintenance`: Đang bảo trì, vệ sinh hoặc bảo dưỡng máy (tạm ẩn).
  - `hidden`: Tạm ẩn khi chủ máy bận hoặc có nhu cầu tự sử dụng máy.
- **Lịch bận cá nhân (Availability Calendar)**: Chủ động chặn những ngày cá nhân cần dùng máy để khách không đặt được.
- Chỉnh sửa nhanh giá thuê và nội dung mô tả tin đăng.

### 3.3. Xử lý Đơn thuê & Vận hành Giao nhận (Order Processing Hub)
- Nhận thông báo đẩy tức thì khi có khách đặt thuê máy mới.
- **Xem hồ sơ tín nhiệm khách thuê**: Xem Điểm uy tín, số đơn đã hoàn tất, nhận xét từ các chủ máy khác trước khi duyệt.
- Nút bấm phê duyệt: **Duyệt đơn (`approved`)** hoặc **Từ chối (`rejected`)** kèm lý do.
- Quét mã QR của người thuê để kích hoạt đơn sang trạng thái `active`.
- **Đối soát nhận lại máy**: Chụp ảnh hiện trạng máy sau khi khách hoàn trả (`handoverPhotos.afterRental`).
- **Xác nhận hoàn tất đơn (`completed`)**: Kích hoạt hoàn tiền cọc tự động cho khách.
- **Yêu cầu trừ cọc khi có hư hỏng (Damage Dispute)**: Nếu máy bị nứt vỡ, trầy xước nặng, chủ máy gửi yêu cầu giữ cọc kèm ảnh đối chiếu để Admin phân xử.

### 3.4. Báo cáo Doanh thu & Dòng tiền (Financial Dashboard)
- Biểu đồ doanh thu theo Tuần, Tháng, Quý.
- Thống kê tỷ lệ lấp đầy thiết bị (Utilization Rate %).
- Quản lý số dư tiền thuê nhận được và tiền cọc đang giữ trong ví ký quỹ.
- Tạo lệnh rút tiền về tài khoản ngân hàng cá nhân.

---

## 4. PHÂN HỆ 4: TRỢ LÝ TRÍ TUỆ NHÂN TẠO GOOGLE GEMINI AI (AI TECH HUB)
*Ứng dụng mô hình ngôn ngữ lớn (LLM) hỗ trợ người dùng ra quyết định thuê máy chính xác:*

### 4.1. Tóm tắt Đánh giá Chuyên sâu (AI Review Summarizer)
- Tự động phân tích các đánh giá và thông số kỹ thuật của thiết bị.
- Trích xuất định dạng JSON thành 3 khối giao diện thẻ trực quan:
  - **Thẻ Xanh (Ưu điểm - Pros)**: 3 - 5 điểm mạnh vượt trội nhất của dòng máy.
  - **Thẻ Đỏ (Nhược điểm - Cons)**: 2 - 3 điểm hạn chế cần lưu ý khi sử dụng.
  - **Lời khuyên (Best For)**: Gợi ý máy này phù hợp nhất cho đối tượng/nhu cầu nào (Quay đêm, Chụp thể thao, Đồ họa 3D...).

### 4.2. So sánh Đối đầu Thiết bị (AI Device Comparator)
- Chọn 2 thiết bị bất kỳ từ danh mục (ví dụ: *Sony A7 IV vs Canon R6 Mark II*, hoặc *MacBook M3 Max vs Dell XPS 16*).
- AI lập bảng phân tích so sánh đối đầu chi tiết:
  - So sánh cảm biến / vi xử lý đồ họa.
  - So sánh thời lượng pin và trọng lượng thực tế.
  - So sánh hiệu năng trên giá tiền thuê (Price-to-Performance).
  - Kết luận và đề xuất sản phẩm tối ưu hơn cho từng mục đích cụ thể.

### 4.3. Tư vấn Chọn máy Thông minh theo Yêu cầu (AI Smart Rental Consultant)
- Người dùng nhập mô tả bằng ngôn ngữ tự nhiên: *"Mình cần quay MV ca nhạc ngoài trời lúc hoàng hôn với ngân sách dưới 600k/ngày thì nên thuê máy nào?"*.
- Gemini AI phân tích câu hỏi, quét kho thiết bị trong cơ sở dữ liệu và đưa ra gợi ý 2 thiết bị phù hợp nhất kèm nút *"Xem và Thuê ngay"*.

### 4.4. Trợ lý Soạn tin Đăng máy (AI Listing Assistant)
- Chủ máy chỉ cần nhập tên model máy, AI tự động sinh bài viết mô tả sản phẩm hấp dẫn, chuyên nghiệp và tự điền bảng thông số kỹ thuật chuẩn.

---

## 5. PHÂN HỆ 5: GIAO TIẾP THỜI GIAN THỰC & CHĂM SÓC KHÁCH HÀNG (COMMUNICATION)
*Cầu nối tương tác trực tiếp, nhanh chóng và an toàn giữa hai bên:*

### 5.1. Nhắn tin Trao đổi Nội bộ (In-App Direct Chat)
- Khung chat 1-1 gắn liền theo từng mã đơn thuê.
- Hỗ trợ gửi tin nhắn văn bản, chia sẻ vị trí hiện tại và gửi ảnh chụp tình trạng máy.
- **Mẫu tin nhắn nhanh (Quick Templates)**:
  - *"Chào bạn, máy đã được sạc đầy pin chưa ạ?"*
  - *"Mình đã tới điểm hẹn giao máy rồi nhé!"*
  - *"Bạn hướng dẫn mình cách lắp thẻ nhớ với."*
- Hiển thị trạng thái tin nhắn: *Đã gửi*, *Đã nhận*, *Đã xem*.

### 5.2. Trung tâm Thông báo Hệ thống (Notification Hub)
- Thông báo đẩy tức thì (In-app + Local Push Notification):
  - Khi đơn thuê được duyệt hoặc bị từ chối.
  - Khi chủ máy xác nhận bàn giao máy.
  - Nhắc nhở hạn trả máy (trước 6 tiếng và 2 tiếng).
  - Khi nhận được tin nhắn hoặc đánh giá mới.
- Phân loại thông báo: Đơn hàng, Tin nhắn, Khuyến mãi.
- Nút "Đánh dấu tất cả là đã đọc".

---

## 6. PHÂN HỆ 6: BẢO MẬT, ĐỊNH DANH & TÍN NHIỆM (TRUST, SECURITY & E-KYC)
*Thiết lập môi trường giao dịch tin cậy, phòng chống gian lận và hư hỏng tài sản:*

### 6.1. Xác thực Sinh trắc học (Biometrics Authentication)
- Khóa và mở khóa ứng dụng bằng Cảm biến vân tay hoặc Nhận diện khuôn mặt (FaceID).
- Xác thực sinh trắc học khi xác nhận giao dịch thanh toán hoặc chuyển tiền cọc.

### 6.2. Xác minh Danh tính Điện tử (eKYC Verification)
- Tải lên ảnh 2 mặt Căn cước công dân (CCCD) và 1 ảnh chụp chân dung (Selfie).
- Admin đối soát phê duyệt và cấp **Huy hiệu Tích xanh Uy tín (`isVerified: true`)**.
- Khách thuê có tích xanh được hưởng quyền lợi giảm 20% - 50% tiền cọc bảo đảm.

### 6.3. Hệ thống Điểm Tín nhiệm (Trust Score System)
- Mỗi tài khoản khởi điểm với 100 điểm tín nhiệm.
- **Cộng điểm**: Hoàn tất đơn đúng hạn (+5 điểm), nhận đánh giá 5 sao (+3 điểm), giữ gìn máy sạch đẹp (+2 điểm).
- **Trừ điểm**: Trả máy trễ hẹn (-10 điểm), hủy đơn sau khi đã duyệt (-15 điểm), làm trầy xước/hỏng máy (-30 điểm).
- Tài khoản có điểm tín nhiệm cao được ưu tiên hiển thị bài đăng và mở khóa quyền thuê các thiết bị đắt tiền.

### 6.4. Biên bản Hợp đồng Thuê Điện tử (Electronic Agreement)
- Tự động sinh biên bản thỏa thuận quyền và nghĩa vụ dạng PDF/Viewable cho từng đơn thuê.
- Hỗ trợ ký xác nhận điện tử trực tiếp trên màn hình cảm ứng khi bàn giao máy.

---

## 7. PHÂN HỆ 7: VÍ NỘI BỘ, KHUYẾN MÃI & GAMIFICATION (FINANCE & LOYALTY)
*Tối ưu dòng tiền, tăng tính thanh khoản và thúc đẩy sự trung thành của người dùng:*

### 7.1. Ví Điện tử Nội bộ TechShare (Mock Escrow Wallet)
- Hiển thị hai tài khoản số dư: **Số dư khả dụng** và **Số dư cọc đang đóng băng (Escrow)**.
- Dòng tiền cọc được giữ an toàn trong ví ký quỹ trong suốt thời gian thuê máy; tự động mở khóa hoàn cọc ngay khi đơn hoàn tất.
- Lịch sử biến động số dư chi tiết: Nạp tiền, Thanh toán thuê máy, Tạm giữ cọc, Nhận hoàn cọc, Nhận tiền cho thuê máy.
- Rút tiền về tài khoản ngân hàng hoặc ví điện tử.

### 7.2. Trung tâm Khuyến mãi & Voucher (Promo & Voucher Center)
- Kho Voucher phong phú:
  - `WELCOME50`: Giảm 50.000đ cho đơn thuê đầu tiên.
  - `WEEKEND10`: Giảm 10% khi thuê vào thứ Bảy và Chủ Nhật.
  - `CREATOR20`: Giảm 20% cho đơn thuê từ 5 ngày trở lên.
- Sao chép mã và tự động áp dụng mã có lợi nhất tại bước đặt thuê.

### 7.3. Giới thiệu Bạn bè & Huy hiệu Thành viên (Referral & Badges)
- Mỗi người dùng sở hữu 1 mã giới thiệu (Referral Code) riêng; cả hai cùng nhận voucher khi bạn bè đăng ký qua mã.
- Hệ thống danh hiệu thành viên: *Tân binh*, *Reviewer kỳ cựu*, *Siêu chủ máy (Super Owner)*.

---

## 8. PHÂN HỆ 8: NỀN TẢNG KỸ THUẬT & TRẢI NGHIỆM NGOẠI TUYẾN (OFFLINE-FIRST)
*Đảm bảo ứng dụng vận hành bền bỉ, ổn định và mượt mà trong mọi tình huống mạng:*

### 8.1. Kiến trúc Ngoại tuyến Không gián đoạn (Offline-First Architecture)
- Tự động lưu trữ đệm (Local Cache qua `AsyncStorage`): Danh mục 10 thiết bị xem gần nhất, danh sách Wishlist, toàn bộ đơn thuê đang diễn ra.
- Bộ lắng nghe trạng thái mạng (NetInfo listener): Khi mất kết nối Wi-Fi/4G, ứng dụng tự chuyển sang đọc dữ liệu từ cache cục bộ kèm banner nhẹ *"Đang xem dữ liệu ngoại tuyến"* thay vì báo lỗi màn hình trắng.
- Cho phép tạo **Đơn đặt thuê nháp (Draft Booking)** khi offline; tự động gửi lên server ngay khi kết nối mạng phục hồi.

### 8.2. Tối ưu hóa Dữ liệu & Đa phương tiện
- Tự động nén ảnh (Client-side Image Compression) trước khi tải lên máy chủ, tiết kiệm tối đa băng thông 4G.
- Danh sách cuộn ảo hóa (`FlatList` với `windowSize`, `removeClippedSubviews`) duy trì tốc độ khung hình 60 - 120 FPS.
- Hỗ trợ chế độ Giao diện Sáng / Tối (Light Mode / Dark Mode) thích ứng theo cài đặt hệ thống.

---

## 9. PHÂN HỆ 9: QUẢN TRỊ VIÊN HỆ THỐNG (ADMIN & PLATFORM GOVERNANCE)
*Dành cho ban quản trị nền tảng kiểm soát chất lượng dịch vụ và bảo vệ người dùng:*

### 9.1. Bảng điều khiển Tổng quan (Analytical Dashboard)
- Biểu đồ thống kê: Tổng số người dùng, tổng số thiết bị, số đơn đang chạy, tổng doanh thu toàn sàn.
- Biểu đồ phân bổ danh mục được thuê nhiều nhất và bản đồ nhiệt khu vực có mật độ thuê cao.

### 9.2. Kiểm duyệt & Quản trị Nội dung
- Phê duyệt bài đăng mới hoặc gỡ bỏ các bài đăng sai danh mục, ảnh mờ, thông tin giả mạo.
- Khóa tạm thời hoặc vĩnh viễn các tài khoản gian lận hoặc vi phạm quy tắc cộng đồng.
- Xóa các bài đánh giá spam, từ ngữ tiêu cực hoặc độc hại.

### 9.3. Phân xử Tranh chấp & Quản lý Ký quỹ (Dispute & Escrow Resolution)
- Màn hình đối chiếu song song: Xem ảnh lúc nhận (`beforeRental`) cạnh ảnh lúc trả (`afterRental`).
- Xem toàn bộ nhật ký tin nhắn trao đổi và timeline đơn hàng của 2 bên.
- Đưa ra phán quyết xử lý tiền cọc: Hoàn trả 100% cho người thuê, hoặc trích một phần/toàn bộ cọc đền bù cho chủ máy khi có hư hỏng xác thực.

### 9.4. Duyệt Hồ sơ eKYC & Cấu hình Hệ thống
- Duyệt ảnh CCCD và ảnh chân dung do người dùng gửi lên để cấp tích xanh uy tín.
- Tạo mới, gia hạn hoặc tạm dừng các chương trình mã giảm giá trên toàn hệ thống.
- Theo dõi nhật ký kiểm toán hệ thống (Audit Logs) và tình trạng hoạt động của cơ sở dữ liệu MongoDB Atlas.
