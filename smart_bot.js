const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const axios = require("axios");
const cheerio = require("cheerio");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ============================================================
// 👇👇👇 KHU VỰC CẤU HÌNH 👇👇👇

// 1. API KEY GOOGLE (Đã điền xong)
const GEMINI_API_KEY = "AIzaSyCNTgB_8biriz6UcWTfZ81xeW-0m8MKruY"; 

// 2. THÔNG TIN TELEGRAM (Sẽ hướng dẫn lấy bên dưới)
const apiId = 35224567;      // ⚠️ THAY SỐ NÀY (Xem hướng dẫn Bước 2)
const apiHash = "a5d0165149f98b056af275b9311116fa"; // ⚠️ THAY CHUỖI NÀY (Xem hướng dẫn Bước 2)

// 3. CẤU HÌNH KÊNH
// Kênh nguồn: Lấy tin từ kênh chính thức của Binance
const SOURCE_CHANNEL = "binance_announcements"; 
// Kênh đích: Để là "me" để bot gửi tin về mục "Tin nhắn lưu trữ" (Saved Messages) của bạn
// Sau này chạy ổn thì đổi thành ID kênh hoặc Username kênh của bạn
const MY_CHANNEL = "me"; 

// ============================================================

const STRING_SESSION = ""; 
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

async function scrapeContent(url) {
    try {
        console.log(`🌍 Đang đọc bài viết: ${url}`);
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(data);
        let text = $('body').text().replace(/\s\s+/g, ' ').substring(0, 8000); 
        return text;
    } catch (e) { return null; }
}

async function rewriteWithAI(originalText, webContent) {
    console.log("🤖 AI đang viết lại tin...");
    const prompt = `
    Bạn là admin Crypto. Tóm tắt tin này sang tiếng Việt ngắn gọn:
    - Tin gốc: "${originalText}"
    - Nội dung web: "${webContent}"
    
    Yêu cầu:
    - Tiêu đề in đậm, dùng icon.
    - Ý chính: Token nào? Thưởng bao nhiêu? Làm gì để nhận?
    - Cuối cùng ghi: "👉 Nguồn: Bot của [Tên Bạn]"
    `;
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (e) { return "Lỗi AI: " + originalText; }
}

(async () => {
    console.log("🚀 Bot đang khởi động...");
    const client = new TelegramClient(new StringSession(STRING_SESSION), apiId, apiHash, { connectionRetries: 5 });

    await client.start({
        phoneNumber: async () => await input.text("Nhập SĐT (+84...): "),
        password: async () => await input.text("Nhập Pass 2FA (nếu có): "),
        phoneCode: async () => await input.text("Nhập mã gửi về Tele: "),
        onError: (err) => console.log(err),
    });

    console.log("✅ Đăng nhập thành công! Đang chờ tin Binance...");
    console.log("Session String (Lưu lại để dùng sau):", client.session.save());

    client.addEventHandler(async (event) => {
        if (event.message && event.message.chat) {
            const chat = await event.message.getChat();
            if (chat.username === SOURCE_CHANNEL) { 
                const msg = event.message.text;
                console.log("📩 Phát hiện tin mới!");

                const urlMatch = msg.match(/(https?:\/\/[^\s]+)/);
                let content = msg;
                if (urlMatch) {
                    const webContent = await scrapeContent(urlMatch[0]);
                    if (webContent) content = await rewriteWithAI(msg, webContent);
                }

                await client.sendMessage(MY_CHANNEL, { message: content });
                console.log("✅ Đã gửi tin!");
            }
        }
    });
})();
