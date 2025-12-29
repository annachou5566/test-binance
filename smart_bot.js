const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const axios = require("axios");
const cheerio = require("cheerio");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ============================================================
// 👇 KHU VỰC CẤU HÌNH (ĐÃ ĐIỀN SẴN CHO BẠN) 👇

const GEMINI_API_KEY = "AIzaSyCNTgB_8biriz6UcWTfZ81xeW-0m8MKruY"; 
const apiId = 35224567;      
const apiHash = "a5d0165149f98b056af275b9311116fa"; 

const SOURCE_CHANNEL = "binance_announcements"; 
const MY_CHANNEL = "me"; 

// 👇 ĐÃ ĐIỀN SESSION MỚI NHẤT CỦA BẠN VÀO ĐÂY 👇
const STRING_SESSION = "1BQANOTEuMTA4LjU2LjE4NgG7CPXi7lV75LbAFSOLi4ccT1JkHKq6BfDCvIXJynfBL3YYIDKADO+pmMO4bUg5YY9yG1iUPqyEmtqkPu1ySMmjBulgH/z13dkmxQgzBaB0o5qn+6jO0J5YUH5YJkLNg3Rj2AGnYa6Jdjv0m5I5srqhw1hd5FMYe2gTs/kNP7xZvbCP2vw3Svtw9D6VbizPOtVZNPaSezkZ49nM3NWoyWgBIm65WYdKKP08eRqIKgcja/ofDgo9nF3RC3vca/tVGINWiT5ZXRj903LX1UfxxuB6NVFjR2MPQaPUBovZJLiiqlqGw4BCw1boSrkmftTMCwZeV8oGW9MYO/JYVy2+XDEVbQ==";

// ============================================================

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

async function scrapeContent(url) {
    try {
        console.log(`🌍 Đang đọc bài viết: ${url}`);
        const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(data);
        return $('body').text().replace(/\s\s+/g, ' ').substring(0, 8000); 
    } catch (e) { return null; }
}

async function rewriteWithAI(originalText, webContent) {
    console.log("🤖 AI đang viết lại tin...");
    const prompt = `Tóm tắt tin này sang tiếng Việt ngắn gọn: "${originalText}". Nội dung web: "${webContent}". Yêu cầu: Tiêu đề in đậm, dùng icon, ghi rõ Token nào, Thưởng bao nhiêu.`;
    try {
        const result = await model.generateContent(prompt);
        return (await result.response).text();
    } catch (e) { return "Lỗi AI: " + originalText; }
}

(async () => {
    console.log("🚀 Bot đang khởi động...");
    const client = new TelegramClient(new StringSession(STRING_SESSION), apiId, apiHash, { connectionRetries: 5 });

    await client.start({
        phoneNumber: async () => await input.text("Nhập SĐT (+84...): "),
        password: async () => await input.text("Nhập Pass 2FA: "),
        phoneCode: async () => await input.text("Nhập mã Tele: "),
        onError: (err) => console.log(err),
    });

    console.log("✅ Đăng nhập thành công! (Không cần nhập lại SĐT nữa)");

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

    // --- 👇 KHU VỰC TEST GIẢ LẬP (ĐÃ THÊM VÀO) 👇 ---
    console.log("\n🧪 ĐANG CHẠY TEST GIẢ LẬP NGAY LẬP TỨC...");
    const tinGiaLap = "Link Test: https://www.binance.com/en/support/announcement/binance-will-list-starpower-star-with-seed-tag-applied-bfa64ab3c47d4d2c8b69f3ebb50d81a8";
    
    console.log("1. Đọc link...");
    const webContent = await scrapeContent("https://www.binance.com/en/support/announcement/binance-will-list-starpower-star-with-seed-tag-applied-bfa64ab3c47d4d2c8b69f3ebb50d81a8");
    
    if (webContent) {
        console.log("2. Gửi AI tóm tắt...");
        const ketQua = await rewriteWithAI(tinGiaLap, webContent);
        console.log("3. Gửi tin nhắn...");
        await client.sendMessage("me", { message: "🧪 [BẢN TIN TEST]\n" + ketQua });
        console.log("✅ THÀNH CÔNG RỰC RỠ! Kiểm tra điện thoại đi!");
    } else {
        console.log("❌ Lỗi đọc link test.");
    }
    // ------------------------------------------------

})();
