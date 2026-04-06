import {
  BellRing,
  BrainCircuit,
  Building2,
  Database,
  Globe,
  Layers3,
  LineChart,
  Radar,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react'

export const navLinks = [
  { label: 'Nang luc', href: '#capabilities' },
  { label: 'Thi truong', href: '#market' },
  { label: 'Lo trinh', href: '#roadmap' },
  { label: 'Bang gia', href: '#pricing' },
]

export const highlightStats = [
  {
    value: '50+',
    label: 'nguon du lieu',
    detail: 'Bao chi, cong dong dau tu, MXH va tin hieu giao dich duoc gom theo thoi gian thuc.',
  },
  {
    value: '15-30p',
    label: 'nhanh hon tin tuc',
    detail: 'Phat hien dao dong tam ly som de ho tro canh bao bien dong thi truong.',
  },
  {
    value: '3',
    label: 'phan khuc khach hang',
    detail: 'B2B tai chinh, brand monitoring va nha dau tu ca nhan cung mot nen tang.',
  },
  {
    value: '125-160M',
    label: 'chi phi MVP',
    detail: 'Mo hinh trien khai tinh gon theo 3 giai doan, toi uu von va toc do ra mat.',
  },
]

export const capabilities = [
  {
    title: 'Dashboard sentiment theo nganh va doanh nghiep',
    description:
      'Hien thi sentiment index, cau chuyen chinh, bien dong gia va canh bao som tren cung mot lop giao dien.',
    icon: LineChart,
  },
  {
    title: 'Localized NLP engine cho tai chinh Viet Nam',
    description:
      'Toi uu cho tieng Viet, thuat ngu chung khoan, tieng long va ngu canh kho nhu sarcasm hoac nhieu tin.',
    icon: BrainCircuit,
  },
  {
    title: 'API danh cho to chuc va he thong noi bo',
    description:
      'Mo sentiment feed, bao cao theo nganh va du lieu real-time de tich hop vao app, CRM hay risk engine.',
    icon: Layers3,
  },
  {
    title: 'Hybrid intelligence: NLP truyen thong + LLM',
    description:
      'Ket hop toc do, chi phi va kha nang tom tat insight de giu he thong vua nhanh vua de mo rong.',
    icon: Sparkles,
  },
]

export const dataPipeline = [
  {
    step: '01',
    title: 'Thu thap du lieu da tang',
    description:
      'Crawl bao chi tai chinh, cong thong tin chinh phu, Facebook, Telegram, YouTube va cong dong dau tu.',
    icon: Globe,
  },
  {
    step: '02',
    title: 'Chuan hoa va phan loai sentiment',
    description:
      'Lam sach du lieu, tach tu va fine-tune mo hinh nhu PhoBERT hoac ViBERT cho Positive, Neutral, Negative.',
    icon: Database,
  },
  {
    step: '03',
    title: 'Tom tat insight bang LLM',
    description:
      'Rut ngan hang nghin binh luan thanh vai diem chinh de nguoi dung hieu nhanh nguyen nhan dang sau bien dong.',
    icon: Workflow,
  },
  {
    step: '04',
    title: 'Kich hoat dashboard va early warning',
    description:
      'Bieu dien tuong quan sentiment va price action, dong thoi day canh bao khi tam ly thi truong tro nen cuc doan.',
    icon: BellRing,
  },
]

export const customerGroups = [
  {
    title: 'B2B tai chinh',
    description: 'Ngan hang, cong ty chung khoan va quy dau tu can them mot lop du lieu cam xuc de ra quyet dinh.',
    icon: Building2,
  },
  {
    title: 'Brand monitoring',
    description: 'Doanh nghiep muon theo doi danh tieng thuong hieu tren bao chi va mang xa hoi theo thoi gian thuc.',
    icon: Radar,
  },
  {
    title: 'Nha dau tu ca nhan',
    description: 'Mo hinh freemium giup nguoi dung ca nhan xem tin hieu nhanh, sau do nang cap sang goi tra phi.',
    icon: Users,
  },
]

export const pricingPlans = [
  {
    name: 'Starter',
    price: 'Mien phi',
    audience: 'B2C kham pha',
    features: ['Theo doi sentiment co ban', 'Insight noi bat trong ngay', 'Gioi han so nganh va doanh nghiep'],
    featured: false,
  },
  {
    name: 'Pro',
    price: '199k - 499k',
    audience: 'Nha dau tu ca nhan',
    features: ['Dashboard day du', 'Canh bao som theo watchlist', 'Phan tich chuyen sau va lich su du lieu'],
    featured: true,
  },
  {
    name: 'Business',
    price: '2M - 5M+',
    audience: 'B2B va Enterprise',
    features: ['Bao cao theo nganh', 'API sentiment real-time', 'Trien khai tuy chinh cho workflow noi bo'],
    featured: false,
  },
]

export const roadmap = [
  {
    phase: 'Giai doan 1',
    time: '0 - 3 thang',
    budget: '50 - 60 trieu VND',
    goal: 'Phat trien MVP tap trung vao crawl du lieu, sentiment engine va dashboard nen.',
  },
  {
    phase: 'Giai doan 2',
    time: '3 - 6 thang',
    budget: '30 - 40 trieu VND',
    goal: 'Toi uu he thong, hoan thien UI/UX va tang do tin cay cua canh bao.',
  },
  {
    phase: 'Giai doan 3',
    time: '6 - 12 thang',
    budget: '45 - 60 trieu VND',
    goal: 'Thuong mai hoa, marketing noi dung va day manh sales cho B2B.',
  },
]

export const projections = [
  {
    year: 'Nam 1',
    revenue: '~10 - 20 trieu',
    users: '~500 free / ~50 paid',
    note: 'Tap trung chung minh market fit voi 2-3 don vi thu nghiem dau tien.',
  },
  {
    year: 'Nam 2',
    revenue: '~200 - 300 trieu',
    users: '~1.200 free / ~150-200 paid',
    note: 'Mo rong B2B len 3-5 khach hang va bat dau tao doanh thu tu API, bao cao.',
  },
  {
    year: 'Nam 3',
    revenue: '~700 trieu - 1,2 ty',
    users: '~3.000 free / ~500-700 paid',
    note: 'B2B dat 10-15 khach hang, loi nhuan duong va he sinh thai du lieu ro net hon.',
  },
]
