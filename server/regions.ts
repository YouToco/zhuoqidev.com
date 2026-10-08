// Where on the China map a visitor goes. Cloudflare reports China as country CN plus a first-level
// region name (in English or pinyin, with or without "Province", "Zizhiqu" and the like), and Hong
// Kong, Macao and Taiwan as countries of their own. The map (src/data/geo/china.json) keys its 34
// shapes by the national administrative code, so both kinds of report end up as one of those codes.

export type Province = { adcode: number; zh: string; en: string };

// adcode, Chinese name, English name, other spellings seen in IP location data
const TABLE: [number, string, string, ...string[]][] = [
  [110000, "北京", "Beijing"],
  [120000, "天津", "Tianjin"],
  [130000, "河北", "Hebei"],
  [140000, "山西", "Shanxi"],
  [150000, "内蒙古", "Inner Mongolia", "Nei Mongol", "Neimenggu", "Nei Menggu"],
  [210000, "辽宁", "Liaoning"],
  [220000, "吉林", "Jilin"],
  [230000, "黑龙江", "Heilongjiang"],
  [310000, "上海", "Shanghai"],
  [320000, "江苏", "Jiangsu"],
  [330000, "浙江", "Zhejiang"],
  [340000, "安徽", "Anhui"],
  [350000, "福建", "Fujian"],
  [360000, "江西", "Jiangxi"],
  [370000, "山东", "Shandong"],
  [410000, "河南", "Henan"],
  [420000, "湖北", "Hubei"],
  [430000, "湖南", "Hunan"],
  [440000, "广东", "Guangdong"],
  [450000, "广西", "Guangxi"],
  [460000, "海南", "Hainan"],
  [500000, "重庆", "Chongqing"],
  [510000, "四川", "Sichuan"],
  [520000, "贵州", "Guizhou"],
  [530000, "云南", "Yunnan"],
  [540000, "西藏", "Tibet", "Xizang"],
  [610000, "陕西", "Shaanxi"],
  [620000, "甘肃", "Gansu"],
  [630000, "青海", "Qinghai"],
  [640000, "宁夏", "Ningxia"],
  [650000, "新疆", "Xinjiang"],
  [710000, "台湾", "Taiwan"],
  [810000, "香港", "Hong Kong", "Hongkong"],
  [820000, "澳门", "Macao", "Macau"],
];

export const PROVINCES: Province[] = TABLE.map(([adcode, zh, en]) => ({ adcode, zh, en }));
const BY_CODE = new Map(PROVINCES.map((p) => [p.adcode, p]));

/** Lower case, letters only, with the administrative suffixes taken off. */
function norm(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\b(province|sheng|shi|municipality|autonomous region|zizhiqu|special administrative region|sar|uygur|uyghur|uighur|zhuangzu|zhuang|huizu|hui)\b/g, "")
    .replace(/(特别行政区|自治区|维吾尔|壮族|回族|省|市)/g, "")
    .replace(/[^\p{L}]/gu, "");
}

const BY_NAME = new Map<string, number>();
for (const [adcode, ...names] of TABLE) for (const n of names) BY_NAME.set(norm(n), adcode);

const BY_COUNTRY: Record<string, number> = { TW: 710000, HK: 810000, MO: 820000 };

/** The map shape a visitor belongs to, or null when they are outside China or the region is unknown. */
export function provinceOf(country: string, region: string): Province | null {
  const code = BY_COUNTRY[country] ?? (country === "CN" ? BY_NAME.get(norm(region)) : undefined);
  return code ? BY_CODE.get(code)! : null;
}
