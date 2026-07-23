// ─── Shared layout helpers ──────────────────────────────────────────

function baseStyles(): string {
  return `
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px 16px; }
    .card { background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background-color: #059669; padding: 24px 32px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; }
    .body { padding: 32px; }
    .body h2 { margin: 0 0 16px; color: #111827; font-size: 20px; }
    .body p { margin: 0 0 12px; color: #374151; font-size: 15px; line-height: 1.6; }
    .footer { padding: 20px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; }
    .footer p { margin: 0 0 4px; color: #6b7280; font-size: 12px; line-height: 1.5; }
    .btn { display: inline-block; padding: 12px 28px; background-color: #059669; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; }
    .info-row { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .info-label { color: #6b7280; font-size: 13px; }
    .info-value { color: #111827; font-size: 15px; font-weight: 500; }
  `.replace(/\n/g, ' ')
}

function wrap(html: string): string {
  return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Việt Mỹ Global</title>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <h1>Việt Mỹ Global</h1>
          </div>
          <div class="body">
            ${html}
          </div>
          <div class="footer">
            <p><strong>Việt Mỹ Global</strong></p>
            <p>Địa chỉ: 123 Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh</p>
            <p>Email: info@vietmyglobal.vn | Hotline: 1900 1234</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
}

// ─── Templates ─────────────────────────────────────────────────────

export function welcomeEmailTemplate({ name }: { name: string }): string {
  return wrap(`
    <h2>Chào ${name}, chào mừng đến Việt Mỹ Global!</h2>
    <p>Cảm ơn bạn đã đăng ký tài khoản tại Việt Mỹ Global. Chúng tôi rất hào hứng được đồng hành cùng bạn trên hành trình học tập.</p>
    <p>Bạn có thể đăng nhập vào hệ thống để bắt đầu khám phá các khóa học và tính năng hữu ích.</p>
    <p>Trân trọng,<br />Đội ngũ Việt Mỹ Global</p>
  `)
}

export function leadNotificationTemplate({ name, phone, email }: { name: string; phone: string; email: string }): string {
  return wrap(`
    <h2>Thông báo khách hàng tiềm năng mới</h2>
    <p>Hệ thống vừa ghi nhận một khách hàng tiềm năng mới. Thông tin chi tiết:</p>
    <div class="info-row">
      <div class="info-label">Họ tên</div>
      <div class="info-value">${name}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Số điện thoại</div>
      <div class="info-value">${phone}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Email</div>
      <div class="info-value">${email || '—'}</div>
    </div>
    <p>Vui lòng liên hệ khách hàng trong thời gian sớm nhất.</p>
  `)
}

export function forgotPasswordTemplate({ name, resetUrl }: { name: string; resetUrl: string }): string {
  return wrap(`
    <h2>Yêu cầu đặt lại mật khẩu</h2>
    <p>Xin chào ${name},</p>
    <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Nhấn vào nút bên dưới để tạo mật khẩu mới:</p>
    <p style="text-align: center; margin: 24px 0;">
      <a href="${resetUrl}" class="btn">Đặt lại mật khẩu</a>
    </p>
    <p>Hoặc copy đường link sau vào trình duyệt:</p>
    <p style="word-break: break-all; color: #059669;">${resetUrl}</p>
    <p>Liên kết này sẽ hết hạn sau <strong>1 giờ</strong>. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>
  `)
}

export function passwordResetConfirmTemplate({ name }: { name: string }): string {
  return wrap(`
    <h2>Mật khẩu đã được đặt lại thành công</h2>
    <p>Xin chào ${name},</p>
    <p>Mật khẩu của bạn đã được thay đổi thành công. Bạn có thể đăng nhập vào hệ thống bằng mật khẩu mới.</p>
    <p>Nếu bạn không thực hiện thay đổi này, vui lòng liên hệ ngay với đội ngũ hỗ trợ để bảo vệ tài khoản.</p>
    <p>Trân trọng,<br />Đội ngũ Việt Mỹ Global</p>
  `)
}

export function paymentConfirmationTemplate({ name, amount, course }: { name: string; amount: number; course: string }): string {
  const formattedAmount = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
  return wrap(`
    <h2>Xác nhận thanh toán</h2>
    <p>Xin chào ${name},</p>
    <p>Chúng tôi đã ghi nhận khoản thanh toán của bạn. Thông tin chi tiết:</p>
    <div class="info-row">
      <div class="info-label">Khóa học</div>
      <div class="info-value">${course}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Số tiền</div>
      <div class="info-value" style="color: #059669;">${formattedAmount}</div>
    </div>
    <p>Chúc bạn học tập thật tốt!</p>
    <p>Trân trọng,<br />Đội ngũ Việt Mỹ Global</p>
  `)
}
