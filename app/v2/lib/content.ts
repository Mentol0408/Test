/* =====================================================================
   RUST WAY — Single source of truth for all homepage content.
   Values are pulled from the live product (server IPs, socials, plugins,
   legal entity, wipe schedule). Live counters are seeded with realistic
   numbers and marked where a real API fetch would replace them.
   ===================================================================== */

export const BRAND = {
  name: "RUST WAY",
  tagline: "Не просто Rust-сервер",
  domain: "rust-way.ru",
  about:
    "RUST WAY — комплекс игровых серверов, созданный для честной, глубокой и по-настоящему затягивающей игры. Мы ценим ваше время.",
} as const;

export const SOCIALS = {
  discord: "https://discord.com/invite/rustway",
  telegram: "https://t.me/Hardwayrust",
  vk: "https://vk.com/rustway?from=groups",
  youtube: "https://www.youtube.com/@RustWayServers",
  tiktok: "https://www.tiktok.com/@rustway_official",
} as const;

export const NAV = [
  { label: "Сервера", href: "#servers" },
  { label: "Почему мы", href: "#advantages" },
  { label: "Статистика", href: "#stats" },
  { label: "Магазин", href: "/store" },
  { label: "Комьюнити", href: "#community" },
  { label: "FAQ", href: "#faq" },
] as const;

/* ---------------------------------------------------------------- Servers */

export type ServerAccent = "chill" | "hard" | "vanilla" | "media";

export interface ServerData {
  key: ServerAccent;
  name: string;
  tag: string; // gameplay framing
  rate: string;
  difficulty: string;
  description: string;
  ip: string; // connect address
  connect: string; // full steam connect command
  mapSize: number;
  teamLimit: number | string;
  wipe: string;
  online: number | null; // null => maintenance
  capacity: number;
  ping: number;
  logo: string;
  image: string; // right-side cinematic art (swap for per-server character render)
  subtitle: string; // "Война деревень · MMORPG · Rust"
  difficultyNote: string; // sub-label under difficulty
  tags: { label: string; tone: "chill" | "hard" | "vanilla" | "amber" | "media" }[];
  features: { icon: string; title: string; subtitle: string }[];
  featured?: boolean;
  maintenance?: boolean;
  statusLabel?: string;
}

export const SERVERS: ServerData[] = [
  {
    key: "chill",
    name: "CHILL",
    tag: "Война деревень · MMORPG",
    rate: "x2",
    difficulty: "Комфортно",
    description:
      "Ускоренный фарм, повышенные рейты и быстрое развитие. Максимум драйва: фракции, деревни, рейды и еженедельные ивенты с призовым фондом.",
    ip: "185.207.214.202:35400",
    connect: "steam://rungameid/252490//+connect 185.207.214.202:35400",
    mapSize: 4000,
    teamLimit: 8,
    wipe: "Пятница · 16:00 МСК",
    online: 176,
    capacity: 200,
    ping: 18,
    logo: "/chillway-logo.png",
    image: "/chill-fon.webp",
    subtitle: "Война деревень · MMORPG · Rust",
    difficultyNote: "Идеально для игры",
    tags: [
      { label: "PVP", tone: "chill" },
      { label: "RUST+", tone: "vanilla" },
      { label: "EVENTS", tone: "amber" },
    ],
    features: [
      { icon: "Sparkles", title: "Ускоренный фарм", subtitle: "x2 ресурсы и добыча" },
      { icon: "Swords", title: "Рейды и PvP", subtitle: "Активные сражения" },
      { icon: "Castle", title: "Деревни и фракции", subtitle: "Развивай и защищай" },
      { icon: "Trophy", title: "Еженедельные ивенты", subtitle: "Призовой фонд" },
      { icon: "Gift", title: "Кейсы со скинами", subtitle: "Уникальные награды" },
    ],
    featured: true,
  },
  {
    key: "hard",
    name: "HARD",
    tag: "Соло / Дуо / Трио · Хардкор",
    rate: "Low-rate",
    difficulty: "Сложно",
    description:
      "Заниженные рейты и жёсткая экономика в духе DayZ. Медленный прогресс, усиленные мобы, туман войны и патрули. Выживают только сильнейшие.",
    ip: "195.18.27.40:35000",
    connect: "steam://rungameid/252490//+connect 195.18.27.40:35000",
    mapSize: 4500,
    teamLimit: 4,
    wipe: "Пятница · 17:00 МСК",
    online: 118,
    capacity: 200,
    ping: 24,
    logo: "/hardway-logo.png",
    image: "/mode-solo.jpg",
    subtitle: "Соло / Дуо / Трио · Хардкор · Rust",
    difficultyNote: "Только для сильных",
    tags: [
      { label: "HARDCORE", tone: "hard" },
      { label: "LOW-RATE", tone: "amber" },
      { label: "SOLO/DUO/TRIO", tone: "vanilla" },
    ],
    features: [
      { icon: "Skull", title: "Заниженные рейты", subtitle: "Хардкор-экономика" },
      { icon: "Dices", title: "Рандомные чертежи", subtitle: "Изучение за скрап" },
      { icon: "Eye", title: "Туман войны", subtitle: "Скрытые локации" },
      { icon: "Bomb", title: "Усиленные мобы", subtitle: "Брэдли и патрули" },
      { icon: "Gift", title: "Кейсы со скинами", subtitle: "Реальные предметы" },
    ],
  },
  {
    key: "media",
    name: "MEDIA",
    tag: "Медиа · x2",
    rate: "x2",
    difficulty: "Комфортно",
    description:
      "Главный медийный сервер проекта. Стримеры, ролики, трансляции и яркие игровые моменты. Попади в кадр, встреться с любимыми авторами или заяви о себе.",
    // TODO: подставить реальный IP медиа-сервера (на скрине скрыт: 185.20…)
    ip: "185.207.214.212:35000",
    connect: "steam://rungameid/252490//+connect 185.207.214.212:35000",
    mapSize: 3800,
    teamLimit: 100,
    wipe: "Пятница · 16:00 МСК",
    online: 12,
    capacity: 200,
    ping: 20,
    logo: "/media-logo.png",
    image: "/media.jfif",
    subtitle: "Медиа · Стримы · Rust",
    difficultyNote: "Комфортная игра",
    tags: [
      { label: "МЕДИА", tone: "media" },
      { label: "x2", tone: "amber" },
      { label: "СТРИМЫ", tone: "chill" },
    ],
    features: [
      { icon: "Play", title: "Стримы и ролики", subtitle: "Контент 24/7" },
      { icon: "Users", title: "Любимые авторы", subtitle: "Играй вместе" },
      { icon: "Sparkles", title: "Комфортные рейты", subtitle: "x2 без гринда" },
      { icon: "Eye", title: "Попади в кадр", subtitle: "Яркие моменты" },
      { icon: "Gift", title: "Кейсы со скинами", subtitle: "Уникальные награды" },
    ],
  },
];

/* Primary connect target shown in hero "Copy IP". */
export const PRIMARY_IP = "185.207.214.202:35400";

/* ---------------------------------------------------------------- Hero stats */

export const HERO_STATS = [
  { value: 294, label: "Игроков онлайн", suffix: "" },
  { value: 48217, label: "Зарегистрировано", suffix: "" },
  { value: 12480, label: "В Discord", suffix: "" },
  { value: 10000, label: "Призовой фонд", prefix: "", suffix: " ₽" },
] as const;

/* ---------------------------------------------------------------- Why (advantages) */

export interface Reason {
  id: string;
  eyebrow: string; // small uppercase label
  title: string;
  text: string;
  image: string;
  href: string;
}

export const REASONS: Reason[] = [
  {
    id: "economy",
    eyebrow: "Донат и экономика",
    title: "Монеты за каждое действие",
    text: "Получайте монеты за активность, фарм, лут и сражения. Монеты — основная валюта магазина: их можно тратить на предметы, ресурсы и развитие.",
    image: "/3.png",
    href: "/store",
  },
  {
    id: "cases",
    eyebrow: "Кейсы со скинами",
    title: "Реальные Steam-скины",
    text: "Открывайте кейсы с реальными скинами. Выигранные предметы приходят прямо в инвентарь Steam.",
    image: "/2.png",
    href: "/cases",
  },
  {
    id: "plugins",
    eyebrow: "Уникальные плагины",
    title: "Кастомные механики",
    text: "Мы заменили стандартные решения на кастомные, которые делают каждый аспект игры — от фарма до рейдов — более глубоким, честным и увлекательным.",
    image: "/1.png",
    href: "#features",
  },
];

/* ---------------------------------------------------------------- Plugins (bento) */

export interface PluginFeature {
  id: string;
  title: string;
  subtitle: string;
  servers: string[];
  image: string;
  size: "lg" | "md" | "sm";
  icon: string;
}

export const PLUGINS: PluginFeature[] = [
  {
    id: "battle-villages",
    title: "Битва деревень 3.0",
    subtitle:
      "Еженедельный командный ивент: альянсы, рейды и умный ИИ-подсчёт очков. Топовая деревня забирает 10 000 монет.",
    servers: ["Chill"],
    image: "/mode-villages.jpg",
    size: "lg",
    icon: "Castle",
  },
  {
    id: "random-research",
    title: "Рандомные чертежи",
    subtitle: "Изучение рецептов за 60 скрапа у верстака. Честный рандом вместо предсказуемой ветки.",
    servers: ["Hard"],
    image: "/mode-solo.jpg",
    size: "md",
    icon: "Dices",
  },
  {
    id: "drone-market",
    title: "Дроны магазина",
    subtitle: "Доступ к дрон-маркету прямо из торгового автомата на базе. Покупай и продавай не выходя из дома.",
    servers: ["Hard", "Chill"],
    image: "/drone.png",
    size: "md",
    icon: "Truck",
  },
  {
    id: "leaderboard",
    title: "Лидерборд игроков",
    subtitle: "Личный рейтинг за онлайн, убийства и фарм. Лучшие получают монеты и статус в топе.",
    servers: ["Hard", "Chill"],
    image: "/stats-preview.jpg",
    size: "sm",
    icon: "Trophy",
  },
  {
    id: "cases",
    title: "Кейсы со скинами",
    subtitle: "Открывай кейсы за монеты и получай настоящие Steam-скины прямо в свой инвентарь.",
    servers: ["Hard", "Chill"],
    image: "/cases-interface.png",
    size: "sm",
    icon: "Gift",
  },
];

/* ---------------------------------------------------------------- Live stats */

export interface LiveStat {
  value: number;
  label: string;
  suffix?: string;
  icon: string;
}

export const LIVE_STATS: LiveStat[] = [
  { value: 294, label: "Игроков онлайн", icon: "Users" },
  { value: 48217, label: "Зарегистрировано игроков", icon: "UserPlus" },
  { value: 12480, label: "Участников Discord", icon: "MessageCircle" },
  { value: 47860, label: "Открыто кейсов", icon: "Gift" },
  { value: 129540, label: "Проведено рейдов", icon: "Bomb" },
  { value: 2415300, label: "Убийств игроков", icon: "Crosshair" },
  { value: 4, label: "Вайпов в месяц", icon: "RefreshCw" },
  { value: 10000, label: "Призовой фонд, ₽", icon: "Trophy" },
];

/* ---------------------------------------------------------------- Gallery */

export const GALLERY = [
  { src: "/mode-villages.jpg", title: "Война деревень", tag: "Chill x2" },
  { src: "/mode-solo.jpg", title: "Суровое выживание", tag: "Hard" },
  { src: "/village_image.jpg", title: "Осада базы", tag: "Рейды" },
  { src: "/servers-background.png", title: "Ночной замес", tag: "PvP" },
  { src: "/media.jpg", title: "Патруль на дороге", tag: "PvE" },
  { src: "/banner.jpg", title: "Рассвет над картой", tag: "Мир" },
] as const;

/* ---------------------------------------------------------------- Store */

export interface StoreItem {
  id: string;
  name: string;
  tag: string;
  price: number;
  oldPrice?: number;
  badge?: string;
  accent: "amber" | "chill" | "vanilla" | "hard";
  image?: string;
  icon: string;
}

export const STORE_ITEMS: StoreItem[] = [
  {
    id: "vip",
    name: "VIP статус",
    tag: "Награды x2 · приоритетный вход",
    price: 199,
    oldPrice: 299,
    badge: "Хит",
    accent: "amber",
    image: "/vip.jpg",
    icon: "Crown",
  },
  {
    id: "coins-1000",
    name: "1000 монет",
    tag: "Основная валюта сервера",
    price: 100,
    accent: "amber",
    image: "/babki.jpg",
    icon: "Coins",
  },
  {
    id: "case-premium",
    name: "Premium кейс",
    tag: "Реальные Steam-скины",
    price: 149,
    badge: "Популярное",
    accent: "chill",
    image: "/case.jpg",
    icon: "Gift",
  },
  {
    id: "starter",
    name: "Набор новичка",
    tag: "Старт без боли на любом сервере",
    price: 249,
    oldPrice: 349,
    badge: "Новинка",
    accent: "vanilla",
    image: "/cases-interface.png",
    icon: "Package",
  },
];

/* ---------------------------------------------------------------- Community */

export interface CommunityLink {
  id: string;
  name: string;
  handle: string;
  href: string;
  glow: string; // rgb triplet
  icon: string;
}

export const COMMUNITY: CommunityLink[] = [
  { id: "discord", name: "Discord", handle: "discord.gg/rustway", href: SOCIALS.discord, glow: "108, 123, 255", icon: "discord" },
  { id: "telegram", name: "Telegram", handle: "@Hardwayrust", href: SOCIALS.telegram, glow: "39, 159, 210", icon: "telegram" },
  { id: "vk", name: "ВКонтакте", handle: "vk.com/rustway", href: SOCIALS.vk, glow: "0, 119, 255", icon: "vk" },
  { id: "youtube", name: "YouTube", handle: "@RustWayServers", href: SOCIALS.youtube, glow: "255, 0, 51", icon: "youtube" },
  { id: "tiktok", name: "TikTok", handle: "@rustway_official", href: SOCIALS.tiktok, glow: "255, 255, 255", icon: "tiktok" },
];

/* ---------------------------------------------------------------- FAQ */

export const FAQ = [
  {
    q: "Как подключиться к серверу?",
    a: "Авторизуйтесь в Steam, скопируйте IP нужного сервера в блоке «Сервера» и вставьте в консоль Rust (F1): connect <ip>. Или просто нажмите «Играть» — клиент подключит вас автоматически.",
  },
  {
    q: "Когда происходит вайп?",
    a: "Вайпы еженедельные, по пятницам: Chill и Vanilla — в 16:00 МСК, Hard — в 17:00 МСК. Вайпается карта и чертежи, чтобы старт всегда был честным для всех.",
  },
  {
    q: "Что дают монеты и как их получить?",
    a: "Монеты — основная валюта проекта. Их начисляют за онлайн, фарм, лут и PvP. Тратить можно в магазине на предметы, ресурсы и кейсы. У обладателей VIP награды удваиваются (x2).",
  },
  {
    q: "Кейсы — это реальные скины?",
    a: "Да. В кейсах лежат настоящие Steam-скины, а не внутриигровые картинки. Выигранный предмет отправляется прямо в ваш Steam-инвентарь и остаётся вашим.",
  },
  {
    q: "Как вы боретесь с читерами?",
    a: "Серверный анти-чит работает круглосуточно, плюс модераторы проводят ручные проверки через Discord. Отказ от проверки — блокировка на всех серверах проекта.",
  },
  {
    q: "Как пополнить баланс и оплатить покупку?",
    a: "Войдите через Steam и пополните баланс на сайте удобным способом (банковская карта, ЮMoney и др.). С баланса покупки проходят мгновенно, товар выдаётся автоматически.",
  },
];

/* ---------------------------------------------------------------- Legal */

export const LEGAL = {
  entity: "ИП Есенеев Антон Сергеевич",
  ogrnip: "ОГРНИП 323169000142170",
  inn: "ИНН 165049846570",
  email: "eseneevAnton@Yandex.ru",
  links: ["Правила сервера", "Пользовательское соглашение", "Политика конфиденциальности", "Политика возврата"],
} as const;
