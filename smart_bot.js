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

const STRING_SESSION = "1BQANOTEuMTA4LjU2LjE4NgG7sWhHB0KEUsb7Zn7YXZGDd8hwwELza+5O+F6WwC6lFdlgtcTwVivdeeg4mB5mVDQ2SvWXAdBX//e2/+/cVMdXw1T05msnoBXEs/3ClmA3lZkZQTCad5vJTCe42Nw+nUoRULi88CfWpcqcDf5zsI8OzBTBW1O1xjbaaQ5EevnMFJtmK/XjwfKKgzQQaj9e7VfoWaw6WQbF/rLEezSubwkGG0z3GeNxsVudJYH/RRM7TFV1PypxaSJBnMbjUfNgDuSP9Asi1B5HZHd2768oKXkLdqUqhh23CMM18TIlbMztuuebl7/5t5Vj4olKhwLamnMDRKl+eL7M8LT7xhdlFs3o9Q=="; 
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

// --- 🧪 KHU VỰC TEST THỬ NGAY LẬP TỨC ---
    console.log("\n🧪 ĐANG CHẠY TEST GIẢ LẬP...");
    
    // 1. Giả bộ có một tin nhắn mới từ Binance (kèm Link thật)
    const tinGiaLap = "Binance Will List Starpower (STAR) with Seed Tag Applied https://www.binance.com/en/support/announcement/binance-will-list-starpower-star-with-seed-tag-applied-bfa64ab3c47d4d2c8b69f3ebb50d81a8";
    
    console.log("1. Đang thử đọc link từ tin giả lập...");
    const urlTest = tinGiaLap.match(/(https?:\/\/[^\s]+)/)[0];
    const webContent = await scrapeContent(urlTest);
    
    if (webContent) {
        console.log(`   -> Đã đọc được nội dung web (${webContent.length} ký tự).`);
        
        console.log("2. Đang gửi cho AI tóm tắt...");
        const ketQua = await rewriteWithAI(tinGiaLap, webContent);
        
        console.log("3. Đang gửi kết quả về Saved Messages...");
        await client.sendMessage("me", { message: "🧪 [TEST MODE]\n" + ketQua });
        console.log("✅ TEST THÀNH CÔNG! Kiểm tra tin nhắn lưu trữ của bạn đi.");
    } else {
        console.log("❌ Lỗi: Không đọc được link test.");
    }
    // ------------------------------------------

    
})();
