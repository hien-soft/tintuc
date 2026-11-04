/**
 * Dữ liệu seed — toàn bộ nội dung do Claude tự viết, không lấy từ báo thật.
 * Chạy: pnpm db:seed (xóa sạch dữ liệu cũ rồi tạo lại).
 */
import { PrismaClient, type ArticleStatus, type ArticleType, type Prisma, type Role } from "@prisma/client";
import { hash, type Algorithm } from "@node-rs/argon2";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import { createCipheriv, randomBytes } from "crypto";

const db = new PrismaClient();
const DEMO_PASSWORD = "Demo@123456";
/** TOTP secret dùng chung cho các tài khoản demo cần 2FA (chỉ dùng cho dev, xem docs/DEMO.md). */
export const DEMO_TOTP_SECRET = "KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD";
export const DEMO_BACKUP_CODES = ["DEMO000001", "DEMO000002", "DEMO000003", "DEMO000004"];

// ---------- tiện ích ----------
let seed = 20261101;
function rand(): number {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 110)
    .replace(/-[^-]*$/, "");
}

function encrypt(plain: string): string {
  const key = Buffer.from(process.env.APP_ENCRYPTION_KEY ?? "", "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

const argon = (s: string) => hash(s, { algorithm: 2 as Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });

// ---------- ảnh placeholder ----------
const PALETTES = [
  ["#0f4c81", "#5fa8d3"], ["#7a1f2b", "#e07a5f"], ["#1b4332", "#74c69d"], ["#3d405b", "#f2cc8f"],
  ["#22223b", "#9a8c98"], ["#5f0f40", "#fb8b24"], ["#003049", "#fcbf49"], ["#264653", "#e9c46a"],
  ["#432818", "#bb9457"], ["#2b2d42", "#ef233c"], ["#014f86", "#a9d6e5"], ["#4a4e69", "#c9ada7"],
];
const MEDIA_ROOT = path.resolve("storage", "media");

async function makePlaceholder(id: string, idx: number, label: string, uploadedById: string, caption: string, photographer: string) {
  const [c1, c2] = PALETTES[idx % PALETTES.length];
  const w = 1600;
  const h = 900;
  const shapes = Array.from({ length: 6 }, (_, i) => {
    const cx = randInt(0, w);
    const cy = randInt(0, h);
    const r = randInt(80, 320);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" fill-opacity="${(0.04 + i * 0.015).toFixed(3)}"/>`;
  }).join("");
  const mountain = `<path d="M0 ${h} L${w * 0.25} ${h * 0.55} L${w * 0.42} ${h * 0.72} L${w * 0.62} ${h * 0.45} L${w} ${h * 0.8} L${w} ${h} Z" fill="#000" fill-opacity="0.18"/>`;
  const safe = label.replace(/[<>&"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>${shapes}${mountain}
    <text x="60" y="${h - 70}" font-family="Arial, sans-serif" font-size="54" font-weight="bold" fill="#fff" fill-opacity="0.92">${safe}</text>
    <text x="60" y="${h - 30}" font-family="Arial, sans-serif" font-size="26" fill="#fff" fill-opacity="0.7">Ảnh minh họa – Tin Tức Việt Nam</text>
  </svg>`;
  const now = new Date();
  const key = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${String(now.getUTCDate()).padStart(2, "0")}/${id}`;
  const input = Buffer.from(svg);
  let bytes = 0;
  for (const [size, width] of [["thumb", 320], ["stand", 960], ["large", 1920]] as const) {
    const out = await sharp(input).resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    const file = path.join(MEDIA_ROOT, key, `${size}.webp`);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, out);
    if (size === "large") bytes = out.length;
  }
  return db.media.create({
    data: { id, key, mime: "image/webp", width: w, height: h, sizeBytes: bytes, caption, alt: label, photographer, uploadedById },
  });
}

/** Ảnh quảng cáo mẫu có kích thước tùy ý (banner dọc 2 bên, popup). */
export async function makePromoImage(id: string, w: number, h: number, title: string, sub: string, palette: number, uploadedById: string) {
  const [c1, c2] = PALETTES[palette % PALETTES.length];
  // cỡ chữ vừa dòng dài nhất (ký tự Arial đậm rộng ~0.58 em)
  const longest = Math.max(...title.split("\n").map((t) => t.length));
  const fs1 = Math.min(Math.round(w / 9), Math.round((w * 0.9) / (longest * 0.58)));
  const lines = title.split("\n").map((t, i) => `<text x="50%" y="${h * 0.38 + i * fs1 * 1.25}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fs1}" font-weight="bold" fill="#fff">${t.replace(/[<>&"]/g, "")}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="${h * 0.12}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(fs1 * 0.42)}" fill="#fff" fill-opacity="0.75" letter-spacing="4">QUẢNG CÁO MẪU</text>
    ${lines}
    <rect x="${w * 0.15}" y="${h * 0.8}" width="${w * 0.7}" height="${fs1 * 1.3}" rx="${fs1 * 0.65}" fill="#fff"/>
    <text x="50%" y="${h * 0.8 + fs1 * 0.88}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(fs1 * 0.6)}" font-weight="bold" fill="${c1}">${sub.replace(/[<>&"]/g, "")}</text>
  </svg>`;
  const now = new Date();
  const key = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${String(now.getUTCDate()).padStart(2, "0")}/${id}`;
  let bytes = 0;
  for (const [size, width] of [["thumb", 320], ["stand", 960], ["large", 1920]] as const) {
    const out = await sharp(Buffer.from(svg)).resize({ width, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    const file = path.join(MEDIA_ROOT, key, `${size}.webp`);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, out);
    bytes = out.length;
  }
  return db.media.create({ data: { id, key, mime: "image/webp", width: w, height: h, sizeBytes: bytes, alt: title.replace("\n", " "), uploadedById } });
}

async function makePartnerLogo(i: number, name: string): Promise<string> {
  const [c1] = PALETTES[i % PALETTES.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120"><rect width="100%" height="100%" rx="10" fill="#fff" stroke="${c1}" stroke-width="4"/>
    <circle cx="60" cy="60" r="34" fill="${c1}"/><text x="110" y="72" font-family="Arial, sans-serif" font-size="30" font-weight="bold" fill="${c1}">${name}</text></svg>`;
  const file = path.join(MEDIA_ROOT, "partners", `partner-${i + 1}.webp`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, await sharp(Buffer.from(svg)).webp().toBuffer());
  return `/media/partners/partner-${i + 1}.webp`;
}

// ---------- dữ liệu tĩnh ----------
const NEWS_CATEGORIES = [
  { name: "Chính trị", slug: "chinh-tri", publicId: 11, footerCol: 1 },
  { name: "Kinh tế", slug: "kinh-te", publicId: 4, footerCol: 1 },
  { name: "An ninh - Quốc phòng", slug: "an-ninh-quoc-phong", publicId: 16, footerCol: 1 },
  { name: "Xã hội", slug: "xa-hoi", publicId: 14, footerCol: 1 },
  { name: "Văn hóa", slug: "nghe-thuat-van-hoa-va-giai-tri", publicId: 1, footerCol: 2 },
  { name: "Giáo dục", slug: "giao-duc", publicId: 5, footerCol: 2 },
  { name: "Khoa học - Công nghệ", slug: "khoa-hoc-cong-nghe", publicId: 13, footerCol: 2 },
  { name: "Thể thao", slug: "the-thao", publicId: 15, footerCol: 2 },
  { name: "Đời sống", slug: "moi-quan-tam-con-nguoi", publicId: 8, footerCol: 3 },
  { name: "Môi trường", slug: "moi-truong", publicId: 6, footerCol: 3 },
  { name: "Sức khỏe", slug: "suc-khoe", publicId: 7, footerCol: 3 },
  { name: "Thời tiết", slug: "thoi-tiet", publicId: 17, footerCol: 4 },
  { name: "Pháp luật", slug: "toi-pham", publicId: 2, footerCol: 4 },
] as const;

const FEEDS = [
  { name: "Trong nước", slug: "trong-nuoc", publicId: 1 },
  { name: "Thế giới", slug: "the-gioi", publicId: 3 },
  { name: "Kinh tế Việt Nam", slug: "kinh-te-viet-nam", publicId: 10 },
  { name: "Kinh tế Thế giới", slug: "kinh-te-the-gioi", publicId: 1000 },
] as const;

const PHOTO_CATEGORIES = [
  { name: "Ảnh thời sự trong nước", slug: "anh-thoi-su-trong-nuoc", publicId: 1014 },
  { name: "Ảnh thời sự quốc tế", slug: "anh-thoi-su-quoc-te", publicId: 1049 },
  { name: "Văn hoá & Xã hội", slug: "van-hoa-xa-hoi", publicId: 1017 },
] as const;

const SOURCES = [
  { name: "TTVN", slug: "ttvn", homepage: "https://tintucvietnam.vn" },
  { name: "VietnamPlus", slug: "vietnamplus", homepage: "https://www.vietnamplus.vn" },
  { name: "Baotintuc.vn", slug: "baotintuc", homepage: "https://baotintuc.vn" },
  { name: "Bnews", slug: "bnews", homepage: "https://bnews.vn" },
  { name: "TT&VH", slug: "ttvh", homepage: "https://thethaovanhoa.vn" },
  { name: "Vietnam News", slug: "vietnam-news", homepage: "https://vietnamnews.vn" },
];

/** Tiêu đề mẫu theo danh mục (nội dung giả định). */
const TITLES: Record<string, string[]> = {
  "chinh-tri": [
    "Quốc hội thảo luận dự án luật sửa đổi về chính quyền địa phương",
    "Lãnh đạo tỉnh tiếp xúc cử tri trước kỳ họp cuối năm",
    "Hội nghị trực tuyến tổng kết công tác cải cách hành chính năm 2026",
    "Đoàn đại biểu Việt Nam dự diễn đàn nghị viện khu vực châu Á",
    "Thủ tướng chủ trì phiên họp Chính phủ thường kỳ tháng 10",
  ],
  "kinh-te": [
    "Xuất khẩu nông sản 10 tháng tăng trưởng hai con số",
    "Ngân hàng giữ ổn định lãi suất cho vay sản xuất kinh doanh",
    "Doanh nghiệp logistics đầu tư mạnh vào kho lạnh tại miền Tây",
    "Giải ngân vốn đầu tư công đạt kết quả tích cực trong quý III",
    "Thị trường bán lẻ cuối năm sôi động nhờ thương mại điện tử",
  ],
  "an-ninh-quoc-phong": [
    "Lực lượng biên phòng tăng cường tuần tra mùa mưa bão",
    "Diễn tập phòng thủ khu vực năm 2026 thành công tốt đẹp",
    "Hải quân tổ chức chuyến thăm hữu nghị các nước trong khu vực",
    "Bộ đội giúp dân khắc phục hậu quả sạt lở đất ở vùng cao",
  ],
  "xa-hoi": [
    "Hàng nghìn tình nguyện viên tham gia chương trình mùa đông ấm",
    "Thành phố mở thêm tuyến xe buýt điện kết nối khu đô thị mới",
    "Chương trình nhà ở xã hội đón những cư dân đầu tiên",
    "Người lao động được hỗ trợ đào tạo lại kỹ năng số",
  ],
  "nghe-thuat-van-hoa-va-giai-tri": [
    "Liên hoan phim quốc tế khai mạc với nhiều tác phẩm đặc sắc",
    "Phục dựng lễ hội truyền thống của đồng bào vùng cao",
    "Triển lãm mỹ thuật đương đại thu hút đông đảo người trẻ",
    "Nghệ nhân trẻ nỗ lực gìn giữ nghề gốm cổ truyền",
  ],
  "giao-duc": [
    "Các trường đại học công bố phương án tuyển sinh năm 2027",
    "Học sinh Việt Nam giành huy chương tại kỳ thi Olympic khu vực",
    "Ngành giáo dục đẩy mạnh chuyển đổi số trong dạy và học",
    "Chương trình sữa học đường mở rộng tới các huyện miền núi",
  ],
  "khoa-hoc-cong-nghe": [
    "Ra mắt nền tảng trí tuệ nhân tạo hỗ trợ nông dân dự báo sâu bệnh",
    "Vệ tinh quan sát Trái Đất do kỹ sư trong nước thiết kế hoàn thành thử nghiệm",
    "Doanh nghiệp công nghệ Việt mở trung tâm nghiên cứu bán dẫn",
    "Mạng 5G phủ sóng toàn bộ các khu công nghiệp trọng điểm",
  ],
  "the-thao": [
    "Đội tuyển bóng đá quốc gia hội quân chuẩn bị cho giải khu vực",
    "Vận động viên điền kinh phá kỷ lục quốc gia nội dung 400m",
    "Giải chạy marathon quốc tế thu hút hơn 10.000 người tham gia",
    "Bóng chuyền nữ giành vé dự vòng chung kết châu lục",
  ],
  "moi-quan-tam-con-nguoi": [
    "Mô hình chợ không tiền mặt lan tỏa ở vùng nông thôn",
    "Câu chuyện người thầy 20 năm gieo chữ nơi biên giới",
    "Những bếp ăn từ thiện ấm lòng bệnh nhân nghèo",
    "Xu hướng du lịch xanh được giới trẻ ưa chuộng",
  ],
  "moi-truong": [
    "Trồng mới hàng triệu cây xanh ven biển chống xói lở",
    "Thành phố thí điểm phân loại rác tại nguồn trên diện rộng",
    "Phát hiện quần thể chim quý hiếm tại vườn quốc gia",
    "Năng lượng mặt trời mái nhà phát triển mạnh tại khu dân cư",
  ],
  "suc-khoe": [
    "Bệnh viện tuyến tỉnh làm chủ kỹ thuật ghép thận",
    "Khuyến cáo phòng bệnh hô hấp khi thời tiết chuyển mùa",
    "Chiến dịch tiêm chủng mở rộng đạt tỷ lệ bao phủ cao",
    "Ứng dụng khám bệnh từ xa giúp giảm tải cho tuyến trên",
  ],
  "thoi-tiet": [
    "Không khí lạnh tăng cường, Bắc Bộ trời rét về đêm",
    "Áp thấp nhiệt đới trên Biển Đông có khả năng mạnh lên",
    "Nam Bộ bước vào cao điểm triều cường cuối năm",
    "Dự báo thời tiết các vùng trên cả nước trong tuần tới",
  ],
  "toi-pham": [
    "Triệt phá đường dây lừa đảo qua mạng xã hội quy mô lớn",
    "Xét xử vụ án vi phạm quy định về đấu thầu tại dự án giao thông",
    "Cảnh báo thủ đoạn giả danh cơ quan chức năng gọi điện lừa đảo",
    "Bắt giữ nhóm đối tượng vận chuyển hàng cấm qua biên giới",
  ],
};

const WORLD_TITLES = [
  "Hội nghị thượng đỉnh khu vực thảo luận về an ninh lương thực",
  "Liên hợp quốc kêu gọi tăng cường hợp tác ứng phó biến đổi khí hậu",
  "Các nước châu Âu thống nhất gói hỗ trợ năng lượng mùa đông",
  "Bầu cử địa phương tại nhiều quốc gia châu Mỹ thu hút cử tri",
  "Diễn đàn hợp tác Á – Âu nhấn mạnh kết nối chuỗi cung ứng",
  "Động đất mạnh ở khu vực Thái Bình Dương, chưa có cảnh báo sóng thần",
];
const WORLD_ECON_TITLES = [
  "Giá dầu thế giới biến động mạnh trước quyết định của nhóm sản xuất",
  "Ngân hàng trung ương nhiều nước giữ nguyên lãi suất điều hành",
  "Thị trường chứng khoán châu Á đồng loạt tăng điểm",
];
const ASIA_BRIEFS = [
  "Tin vắn kinh tế châu Á: Xuất khẩu của các nền kinh tế Đông Á phục hồi",
  "Tin vắn kinh tế châu Á: Đồng tiền khu vực ổn định trong tuần",
  "Tin vắn kinh tế châu Á: Đầu tư vào trung tâm dữ liệu tăng nhanh",
];
const BUSINESS_WIRE = [
  "Business Wire: Tập đoàn công nghệ công bố giải pháp lưu trữ năng lượng mới",
  "Business Wire: Hãng dược phẩm mở rộng nhà máy tại Đông Nam Á",
  "Business Wire: Công ty logistics ra mắt dịch vụ giao hàng xuyên biên giới",
];

const AUTHORS = ["Minh Anh", "Thu Hà", "Quang Huy", "Lan Phương", "Đức Thịnh", "Ngọc Mai", "Hoàng Nam", "Bảo Châu"];
const PHOTOGRAPHERS = ["Văn Điệp", "Thanh Tùng", "Hải Yến", "Trọng Đức", "Minh Quyết"];
const PARAGRAPHS = [
  "Theo thông tin từ cơ quan chức năng, kết quả đạt được trong thời gian qua là tiền đề quan trọng để địa phương tiếp tục triển khai các nhiệm vụ trọng tâm trong những tháng cuối năm. Nhiều giải pháp đồng bộ đã được đưa ra nhằm tháo gỡ khó khăn, tạo điều kiện thuận lợi cho người dân và doanh nghiệp.",
  "Phát biểu tại buổi làm việc, đại diện lãnh đạo đơn vị nhấn mạnh yêu cầu bám sát thực tiễn, lắng nghe ý kiến của người dân, đồng thời tăng cường công tác kiểm tra, giám sát để bảo đảm các chương trình được thực hiện đúng tiến độ và hiệu quả.",
  "Các chuyên gia nhận định, xu hướng này sẽ tiếp tục duy trì trong thời gian tới nếu các chính sách hỗ trợ được triển khai kịp thời. Tuy nhiên, cần chú ý tới những rủi ro tiềm ẩn và chuẩn bị phương án ứng phó phù hợp với từng tình huống cụ thể.",
  "Trong năm nay, đơn vị đặt mục tiêu mở rộng quy mô, nâng cao chất lượng dịch vụ và ứng dụng mạnh mẽ công nghệ số trong quản lý, điều hành. Đây được xem là hướng đi tất yếu nhằm đáp ứng nhu cầu ngày càng cao của xã hội.",
  "Người dân địa phương bày tỏ sự phấn khởi khi những thay đổi tích cực đã hiện hữu trong đời sống hằng ngày. Nhiều hộ gia đình cho biết thu nhập được cải thiện rõ rệt, điều kiện sinh hoạt ngày càng thuận tiện hơn.",
  "Bên cạnh những kết quả đạt được, vẫn còn một số tồn tại, hạn chế cần sớm khắc phục như nguồn lực còn phân tán, sự phối hợp giữa các bên có lúc chưa chặt chẽ. Các cơ quan liên quan đã được giao rà soát và đề xuất giải pháp cụ thể.",
  "Dự kiến trong quý tới, nhiều hoạt động thiết thực sẽ tiếp tục được tổ chức, góp phần lan tỏa tinh thần đoàn kết, sáng tạo và trách nhiệm của cộng đồng đối với sự phát triển chung.",
];

function makeContent(title: string, withImage?: { url: string; caption: string; alt: string }): string {
  const paras = [...PARAGRAPHS].sort(() => rand() - 0.5).slice(0, 5);
  const blocks = paras.map((p) => `<p>${p}</p>`);
  blocks.splice(2, 0, `<h2>Những điểm đáng chú ý</h2>`);
  if (withImage) {
    blocks.splice(1, 0, `<figure class="content-figure"><img src="${withImage.url}" alt="${withImage.alt}" title="${withImage.caption}"><figcaption>${withImage.caption}</figcaption></figure>`);
  }
  blocks.push(`<blockquote><p>“Chúng tôi sẽ tiếp tục đồng hành và tạo mọi điều kiện thuận lợi nhất để các mục tiêu đề ra sớm trở thành hiện thực.”</p></blockquote>`);
  blocks.push(`<p><em>Bài viết “${title}” là nội dung minh họa cho môi trường phát triển.</em></p>`);
  return blocks.join("\n");
}

function sapoFor(title: string): string {
  return `${title.replace(/^.*?: /, "")} — nội dung được cập nhật bởi phóng viên Tin Tức Việt Nam với những thông tin mới nhất, góc nhìn đa chiều và số liệu cụ thể.`.slice(0, 290);
}

async function main() {
  console.log("Xóa dữ liệu cũ...");
  await db.$transaction([
    db.articleDailyView.deleteMany(), db.articleTopic.deleteMany(), db.articleComment.deleteMany(), db.articleStatusLog.deleteMany(),
    db.articleRevision.deleteMany(), db.articlePhoto.deleteMany(), db.articleTag.deleteMany(), db.articleCategory.deleteMany(),
    db.article.deleteMany(), db.ad.deleteMany(), db.media.deleteMany(), db.tag.deleteMany(), db.notification.deleteMany(), db.auditLog.deleteMany(),
    db.userCategoryScope.deleteMany(), db.session.deleteMany(), db.passwordResetToken.deleteMany(), db.user.deleteMany(),
    db.category.deleteMany(), db.source.deleteMany(), db.topic.deleteMany(), db.partner.deleteMany(), db.homeSlot.deleteMany(),
    db.staticPage.deleteMany(), db.kvEntry.deleteMany(),
  ]);
  await fs.rm(MEDIA_ROOT, { recursive: true, force: true });

  // ----- danh mục -----
  const cats: Record<string, number> = {};
  let order = 0;
  for (const c of NEWS_CATEGORIES) {
    const row = await db.category.create({ data: { ...c, type: "NEWS", order: order++ } });
    cats[c.slug] = row.id;
  }
  for (const c of FEEDS) {
    const row = await db.category.create({ data: { ...c, type: "FEED", order: order++, showInMenu: false } });
    cats[c.slug] = row.id;
  }
  for (const c of PHOTO_CATEGORIES) {
    const row = await db.category.create({ data: { ...c, type: "PHOTO", order: order++, showInMenu: false } });
    cats[c.slug] = row.id;
  }
  const sources: Record<string, number> = {};
  for (const s of SOURCES) sources[s.slug] = (await db.source.create({ data: s })).id;

  // ----- người dùng -----
  console.log("Tạo người dùng demo...");
  const pw = await argon(DEMO_PASSWORD);
  const backup = await Promise.all(DEMO_BACKUP_CODES.map(argon));
  const totpSecret = encrypt(DEMO_TOTP_SECRET);
  const mustChange = process.env.NODE_ENV === "production";
  const mkUser = (email: string, fullName: string, roles: Role[]) => {
    const needs2fa = roles.some((r) => r !== "REPORTER");
    return db.user.create({
      data: {
        email, fullName, roles, passwordHash: pw, mustChangePassword: mustChange, require2fa: needs2fa,
        totpEnabled: needs2fa, totpSecret: needs2fa ? totpSecret : null, backupCodes: needs2fa ? backup : [],
      },
    });
  };
  const admin = await mkUser("admin@demo.vn", "Quản trị viên", ["ADMIN"]);
  const tbt = await mkUser("tbt@demo.vn", "Trần Tổng Biên", ["EDITOR_L2"]);
  const btvCT = await mkUser("btv.chinhtri@demo.vn", "Lê Biên Tập (Chính trị)", ["EDITOR_L1"]);
  const btvKT = await mkUser("btv.kinhte@demo.vn", "Phạm Biên Tập (Kinh tế)", ["EDITOR_L1"]);
  // Tài khoản chủ hệ thống (thay pv1): toàn quyền, mật khẩu riêng lấy từ .env (không ghi vào mã nguồn).
  // Chưa bật 2FA → lần đăng nhập đầu được chuyển tới trang thiết lập 2FA để quét QR bằng ứng dụng của chính mình.
  const ownerEmail = process.env.SEED_OWNER_EMAIL || "pv1@demo.vn";
  const pv1 = await db.user.create({
    data: {
      email: ownerEmail,
      fullName: process.env.SEED_OWNER_NAME || "Nguyễn Phóng Viên 1",
      roles: ["REPORTER", "EDITOR_L1", "EDITOR_L2", "ADMIN"],
      passwordHash: process.env.SEED_OWNER_PASSWORD ? await argon(process.env.SEED_OWNER_PASSWORD) : pw,
      mustChangePassword: false,
      require2fa: true,
    },
  });
  const pv2 = await mkUser("pv2@demo.vn", "Hoàng Phóng Viên 2", ["REPORTER"]);
  await db.userCategoryScope.createMany({
    data: [
      ...["chinh-tri", "xa-hoi", "toi-pham"].map((s) => ({ userId: btvCT.id, categoryId: cats[s] })),
      ...["kinh-te", "khoa-hoc-cong-nghe", "moi-truong"].map((s) => ({ userId: btvKT.id, categoryId: cats[s] })),
      ...(await db.category.findMany({ select: { id: true } })).map((c) => ({ userId: pv1.id, categoryId: c.id })),
    ],
  });
  const reporters = [pv1, pv2];

  // ----- chuyên đề, đối tác, trang tĩnh -----
  await db.topic.createMany({
    data: [
      { id: 19, slug: "tin-van-kinh-te-chau-a", name: "Tin vắn kinh tế châu Á", isFeatured: true, order: 1 },
      { id: 20, slug: "business-wire", name: "Business Wire", isFeatured: true, order: 2 },
    ],
  });
  const partnerNames = ["Đối tác 1", "Đối tác 2", "Đối tác 3", "Đối tác 4", "Đối tác 5", "Đối tác 6", "Đối tác 7", "Đối tác 8", "Đối tác 9", "Đối tác 10"];
  for (let i = 0; i < partnerNames.length; i++) {
    await db.partner.create({ data: { name: partnerNames[i], logoUrl: await makePartnerLogo(i, partnerNames[i]), url: `https://example.com/doi-tac-${i + 1}`, order: i } });
  }
  await db.staticPage.createMany({
    data: [
      { slug: "dieu-khoan-su-dung", title: "Điều khoản sử dụng", contentHtml: "<p>Nội dung trên Tin Tức Việt Nam được cung cấp cho mục đích tham khảo. Mọi hình thức sao chép, phát hành lại cần có sự đồng ý bằng văn bản của tòa soạn.</p><h2>Quyền sở hữu trí tuệ</h2><p>Toàn bộ bài viết, ảnh, đồ họa thuộc quyền sở hữu của tòa soạn hoặc đối tác cung cấp.</p><h2>Trách nhiệm người dùng</h2><p>Người dùng cam kết không sử dụng nội dung vào mục đích trái pháp luật.</p>" },
      { slug: "lien-he", title: "Liên hệ", contentHtml: "<p><strong>Tòa soạn Tin Tức Việt Nam</strong></p><p>Địa chỉ: 123 Đường Minh Họa, Quận Ba Đình, Hà Nội</p><p>Điện thoại: (024) 0000 0000 — Email: toasoan@tintucvietnam.vn</p>" },
      { slug: "gioi-thieu", title: "Giới thiệu", contentHtml: "<p>Tin Tức Việt Nam là cổng thông tin tổng hợp tin tức, ảnh, đồ họa và các chuyên đề chuyên sâu.</p>" },
    ],
  });
  await db.tag.createMany({ data: ["Chuyển đổi số", "Kinh tế xanh", "Hội nhập", "Biến đổi khí hậu", "Giáo dục", "Y tế"].map((name) => ({ name, slug: slugify(name) })) });
  const tags = await db.tag.findMany();

  // ----- ảnh -----
  console.log("Sinh ảnh placeholder...");
  let mediaIdx = 0;
  const newMedia = async (label: string, uploader: string) => {
    const photographer = pick(PHOTOGRAPHERS);
    const i = mediaIdx++;
    return makePlaceholder(`seedmedia${String(i).padStart(4, "0")}`, i, label.slice(0, 40), uploader, `${label}. Ảnh: ${photographer} - TTVN`, photographer);
  };

  // ----- bài viết -----
  console.log("Tạo bài viết...");
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600_000);
  const usedSlugs = new Set<string>();
  const uniqueSlug = (title: string) => {
    let s = slugify(title);
    while (usedSlugs.has(s)) s = `${s}-${randInt(2, 99)}`;
    usedSlugs.add(s);
    return s;
  };

  interface Spec {
    title: string;
    type: ArticleType;
    status: ArticleStatus;
    catSlug: string;
    extraCats?: string[];
    topicId?: number;
    hours: number;
    author: { id: string };
    externalUrl?: string;
    sourceSlug?: string;
    isUrgent?: boolean;
  }

  async function createArticle(spec: Spec) {
    const cover = await newMedia(spec.title, spec.author.id);
    const inline = spec.type === "NEWS" && rand() > 0.5 ? await newMedia(`${spec.title} (ảnh 2)`, spec.author.id) : null;
    const published = ["PUBLISHED", "UNPUBLISHED"].includes(spec.status);
    const pastL1 = ["PENDING_L2", "IN_REVIEW_L2", "SCHEDULED", "PUBLISHED", "UNPUBLISHED"].includes(spec.status);
    const pastL2 = ["SCHEDULED", "PUBLISHED", "UNPUBLISHED"].includes(spec.status);
    const l1 = spec.catSlug === "kinh-te" || spec.catSlug === "khoa-hoc-cong-nghe" || spec.catSlug === "moi-truong" ? btvKT : btvCT;
    const submitted = spec.status !== "DRAFT";
    const contentHtml = spec.type === "EXTERNAL" ? null : makeContent(spec.title, inline ? { url: `/media/${inline.key}/stand.webp`, caption: inline.caption ?? "", alt: inline.alt ?? "" } : undefined);
    const holder = spec.status === "IN_REVIEW_L1" ? l1.id : spec.status === "IN_REVIEW_L2" ? tbt.id : null;
    const a = await db.article.create({
      data: {
        type: spec.type,
        status: spec.status,
        title: spec.title,
        slug: uniqueSlug(spec.title),
        sapo: sapoFor(spec.title),
        contentHtml,
        externalUrl: spec.externalUrl,
        coverMediaId: cover.id,
        primaryCatId: cats[spec.catSlug],
        sourceId: sources[spec.sourceSlug ?? (rand() > 0.3 ? "ttvn" : pick(["vietnamplus", "baotintuc", "bnews", "ttvh", "vietnam-news"]))],
        authorId: spec.author.id,
        authorName: pick(AUTHORS),
        isUrgent: spec.isUrgent ?? false,
        submittedAt: submitted ? hoursAgo(spec.hours + 2) : null,
        l1ReviewerId: pastL1 ? l1.id : null,
        l1ApprovedAt: pastL1 ? hoursAgo(spec.hours + 1) : null,
        l2ReviewerId: pastL2 ? tbt.id : null,
        l2ApprovedAt: pastL2 ? hoursAgo(spec.hours + 0.5) : null,
        holderId: holder,
        scheduledAt: spec.status === "SCHEDULED" ? new Date(now + spec.hours * 3600_000) : null,
        publishedAt: published ? hoursAgo(spec.hours) : null,
        unpublishedAt: spec.status === "UNPUBLISHED" ? hoursAgo(1) : null,
        viewCount: published ? randInt(50, 5000) : 0,
        createdAt: hoursAgo(spec.hours + 3),
        categories: { create: (spec.extraCats ?? []).map((s) => ({ categoryId: cats[s] })) },
        topics: spec.topicId ? { create: [{ topicId: spec.topicId }] } : undefined,
        tags: { create: [{ tagId: pick(tags).id }] },
      },
    });
    await db.articleRevision.create({
      data: { articleId: a.id, version: 1, editorId: spec.author.id, statusAtSave: spec.status, note: "Dữ liệu seed", snapshot: { title: a.title, sapo: a.sapo, contentHtml: a.contentHtml, primaryCatId: a.primaryCatId } as Prisma.InputJsonValue },
    });
    if (submitted) {
      await db.articleStatusLog.create({ data: { articleId: a.id, fromStatus: "DRAFT", toStatus: spec.status, action: "SEED", actorId: spec.author.id, createdAt: hoursAgo(spec.hours) } });
    }
    if (spec.status === "RETURNED" || spec.status === "REJECTED") {
      await db.articleComment.create({
        data: { articleId: a.id, authorId: l1.id, kind: spec.status === "RETURNED" ? "RETURN_REASON" : "REJECT_REASON", body: spec.status === "RETURNED" ? "Cần bổ sung số liệu nguồn và kiểm tra lại chính tả đoạn 2." : "Nội dung trùng lặp với bài đã đăng trước đó, không phù hợp để xuất bản." },
      });
    }
    if (published) {
      for (let d = 0; d < 3; d++) {
        const day = new Date(new Date(now - d * 86400_000).toISOString().slice(0, 10) + "T00:00:00.000Z");
        await db.articleDailyView.create({ data: { articleId: a.id, day, count: randInt(10, 1500) } });
      }
    }
    return a;
  }

  // 3 bài đã xuất bản cho mỗi danh mục (39 bài)
  let h = 0.3;
  const domestic = new Set(["chinh-tri", "an-ninh-quoc-phong", "xa-hoi", "nghe-thuat-van-hoa-va-giai-tri", "giao-duc", "moi-quan-tam-con-nguoi", "moi-truong", "suc-khoe", "thoi-tiet", "toi-pham", "the-thao", "khoa-hoc-cong-nghe"]);
  for (let round = 0; round < 3; round++) {
    for (const c of NEWS_CATEGORIES) {
      const title = TITLES[c.slug][round];
      const extra = c.slug === "kinh-te" ? ["kinh-te-viet-nam"] : domestic.has(c.slug) ? ["trong-nuoc"] : [];
      await createArticle({ title, type: round === 2 && c.slug === "khoa-hoc-cong-nghe" ? "EXTERNAL" : "NEWS", status: "PUBLISHED", catSlug: c.slug, extraCats: extra, hours: h, author: pick(reporters), isUrgent: round === 0 && c.slug === "thoi-tiet", ...(round === 2 && c.slug === "khoa-hoc-cong-nghe" ? { externalUrl: "https://www.vietnamplus.vn/", sourceSlug: "vietnamplus" } : {}) });
      h += rand() * 2.2 + 0.4;
    }
  }
  // tin thế giới + kinh tế thế giới (9 bài)
  for (const t of WORLD_TITLES) await createArticle({ title: t, type: "NEWS", status: "PUBLISHED", catSlug: "chinh-tri", extraCats: ["the-gioi"], hours: rand() * 60, author: pick(reporters) });
  for (const t of WORLD_ECON_TITLES) await createArticle({ title: t, type: "NEWS", status: "PUBLISHED", catSlug: "kinh-te", extraCats: ["kinh-te-the-gioi"], hours: rand() * 60, author: pick(reporters) });
  // chuyên đề (6 bài, thuộc 60)
  for (const t of ASIA_BRIEFS) await createArticle({ title: t, type: "NEWS", status: "PUBLISHED", catSlug: "kinh-te", extraCats: ["kinh-te-the-gioi"], topicId: 19, hours: rand() * 48, author: pv1 });
  for (const t of BUSINESS_WIRE) await createArticle({ title: t, type: "NEWS", status: "PUBLISHED", catSlug: "kinh-te", topicId: 20, hours: rand() * 48, author: pv2, sourceSlug: "bnews" });

  // 6 bài ở các trạng thái khác để demo quy trình (tổng 60 bài)
  const flow: Spec[] = [
    { title: TITLES["chinh-tri"][3], type: "NEWS", status: "DRAFT", catSlug: "chinh-tri", hours: 1, author: pv1 },
    { title: TITLES["xa-hoi"][3], type: "NEWS", status: "PENDING_L1", catSlug: "xa-hoi", hours: 3, author: pv1, isUrgent: true },
    { title: TITLES["kinh-te"][3], type: "NEWS", status: "PENDING_L1", catSlug: "kinh-te", hours: 0.5, author: pv2 },
    { title: TITLES["toi-pham"][3], type: "NEWS", status: "IN_REVIEW_L1", catSlug: "toi-pham", hours: 1, author: pv2 },
    { title: TITLES["moi-truong"][3], type: "NEWS", status: "PENDING_L2", catSlug: "moi-truong", hours: 2, author: pv1 },
    { title: TITLES["chinh-tri"][4], type: "NEWS", status: "RETURNED", catSlug: "chinh-tri", hours: 5, author: pv1 },
    { title: TITLES["kinh-te"][4], type: "NEWS", status: "SCHEDULED", catSlug: "kinh-te", hours: 6, author: pv2 },
    { title: TITLES["khoa-hoc-cong-nghe"][3], type: "NEWS", status: "IN_REVIEW_L2", catSlug: "khoa-hoc-cong-nghe", hours: 1.5, author: pv2 },
    { title: TITLES["giao-duc"][3], type: "NEWS", status: "REJECTED", catSlug: "giao-duc", hours: 30, author: pv2 },
    { title: TITLES["suc-khoe"][3], type: "NEWS", status: "UNPUBLISHED", catSlug: "suc-khoe", hours: 40, author: pv1 },
    { title: TITLES["the-thao"][3], type: "NEWS", status: "ARCHIVED", catSlug: "the-thao", hours: 80, author: pv2 },
  ];
  for (const s of flow) await createArticle(s);

  // ----- bộ ảnh (6) -----
  console.log("Tạo bộ ảnh, đồ họa, megastory...");
  const photoStories = [
    { title: "Sắc thu trên những thửa ruộng bậc thang vùng cao", cat: "van-hoa-xa-hoi" },
    { title: "Toàn cảnh lễ khánh thành cây cầu mới bắc qua sông Hồng", cat: "anh-thoi-su-trong-nuoc" },
    { title: "Người dân miền Trung khẩn trương chống bão", cat: "anh-thoi-su-trong-nuoc" },
    { title: "Hội nghị quốc tế về năng lượng tái tạo qua ống kính", cat: "anh-thoi-su-quoc-te" },
    { title: "Phố cổ rực rỡ đèn lồng đêm trung thu", cat: "van-hoa-xa-hoi" },
    { title: "Lễ hội hoa xuân thu hút du khách quốc tế", cat: "anh-thoi-su-quoc-te" },
  ];
  const photoIds: number[] = [];
  for (let i = 0; i < photoStories.length; i++) {
    const ps = photoStories[i];
    const a = await createArticle({ title: ps.title, type: "PHOTO_STORY", status: "PUBLISHED", catSlug: ps.cat, extraCats: ["nghe-thuat-van-hoa-va-giai-tri"], hours: 1 + i * 5, author: pick(reporters) });
    photoIds.push(a.id);
    const n = randInt(4, 6);
    for (let j = 0; j < n; j++) {
      const m = await newMedia(`${ps.title} – khoảnh khắc ${j + 1}`, a.authorId);
      await db.articlePhoto.create({ data: { articleId: a.id, mediaId: m.id, caption: m.caption ?? "", order: j, takenAt: hoursAgo(2 + i * 5 + j * 0.2) } });
    }
  }
  await db.homeSlot.create({ data: { key: "HOME_PHOTO_HERO", articleIds: photoIds, updatedById: tbt.id } });

  // ----- đồ họa (3), megastory (2) -----
  const graphics = [
    { title: "Infographic: Tăng trưởng kinh tế 9 tháng năm 2026", cat: "kinh-te" },
    { title: "Infographic: Hành trình phát triển mạng lưới đường cao tốc", cat: "xa-hoi" },
    { title: "Infographic: Những con số ấn tượng của ngành du lịch", cat: "nghe-thuat-van-hoa-va-giai-tri" },
  ];
  for (const g of graphics) await createArticle({ title: g.title, type: "GRAPHIC", status: "PUBLISHED", catSlug: g.cat, hours: rand() * 70, author: pick(reporters) });
  const megas = [
    { title: "Mega Story: Đánh thức tiềm năng kinh tế biển", cat: "kinh-te" },
    { title: "Mega Story: Những người giữ rừng nơi đại ngàn", cat: "moi-truong" },
  ];
  for (const m of megas) await createArticle({ title: m.title, type: "MEGASTORY", status: "PUBLISHED", catSlug: m.cat, hours: rand() * 70, author: pick(reporters) });

  await db.notification.createMany({
    data: [
      { userId: btvCT.id, type: "REVIEW_L1_REQUEST", title: `[KHẨN] "${TITLES["xa-hoi"][3]}" chờ duyệt cấp 1`, link: "/Admin/review/level-1" },
      { userId: tbt.id, type: "REVIEW_L2_REQUEST", title: `"${TITLES["moi-truong"][3]}" chờ duyệt cấp 2`, link: "/Admin/review/level-2" },
    ],
  });

  // ----- quảng cáo mẫu: banner 2 bên + popup -----
  const promoLeft = await makePromoImage("seedpromoleft", 320, 1200, "Du lịch\nbiển đảo\nViệt Nam", "Khám phá", 0, admin.id);
  const promoRight = await makePromoImage("seedpromoright", 320, 1200, "Hội chợ\nhàng Việt\n2026", "Xem chi tiết", 5, admin.id);
  const promoPopup = await makePromoImage("seedpromopopup", 1200, 1000, "Đọc báo mỗi ngày\ncùng Tin Tức Việt Nam", "Tìm hiểu thêm", 2, admin.id);
  await db.ad.createMany({
    data: [
      { name: "Quảng cáo mẫu – Du lịch biển đảo", position: "LEFT", mediaId: promoLeft.id, linkUrl: "/vi/tin-tuc/nghe-thuat-van-hoa-va-giai-tri-1", openNewTab: false, createdById: admin.id },
      { name: "Quảng cáo mẫu – Hội chợ hàng Việt", position: "RIGHT", mediaId: promoRight.id, linkUrl: "/vi/tin-tuc/kinh-te-4", openNewTab: false, createdById: admin.id },
      { name: "Quảng cáo mẫu – Popup chào mừng", position: "POPUP", mediaId: promoPopup.id, linkUrl: "/vi", openNewTab: false, homeOnly: true, frequency: "SESSION", createdById: admin.id },
    ],
  });
  await db.auditLog.create({ data: { actorId: admin.id, action: "SEED", entityType: "System", metadata: { note: "Khởi tạo dữ liệu demo" } } });

  const total = await db.article.count();
  console.log(`Hoàn tất: ${total} bài viết, ${mediaIdx} ảnh.`);
}

// Chỉ chạy khi gọi trực tiếp (prisma db seed); import từ script khác thì chỉ lấy các hàm tiện ích.
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
