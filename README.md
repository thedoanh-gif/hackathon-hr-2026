# HR Day Hackathon 2026

Trang theo dõi HR Day Hackathon 2026 · Khối HR Tập đoàn TH.

Trang tĩnh, chạy trực tiếp trên GitHub Pages (không cần build).

## Cập nhật từ trang quản trị (không cần sửa file)
1. Mở `https://thedoanh-gif.github.io/hackathon-hr-2026/#quan-tri` và nhập mật khẩu BTC.
2. Cập nhật tiến độ Team, sửa chữ trên trang (nút **Chỉnh sửa nội dung**), công bố kết quả.
3. Vào mục **Đăng lên GitHub**, dán token rồi bấm **Đăng lên GitHub**. Trang sẽ ghi `data/live.json` vào kho.
4. Khoảng 1–2 phút sau, mọi người tải lại trang là thấy bản mới.

Token: dùng *Fine-grained token*, chỉ cấp cho kho này, quyền **Contents: Read and write**, có hạn dùng. Không ghi token vào file nào trong kho.
`data/live.json` do trang quản trị tạo, không sửa tay.

## Cập nhật bằng cách sửa file
| Muốn đổi | Sửa file |
|---|---|
| Thông điệp, lộ trình, tiêu chí, thể lệ, nguyên tắc vàng | `data/program.json` |
| Thành viên, đội trưởng, tiến độ từng Team (`tien_do`) | `data/teams.json` |
| Nhật ký hoạt động và ảnh (ảnh để trong `data/img/`) | `data/updates.json` |
| Điểm và bảng xếp hạng (chỉ đưa lên khi công bố) | `data/scores.json` |

Không ghi chủ đề của các Team vào kho này trước khi Team trình bày.
