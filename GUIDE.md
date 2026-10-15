# راهنمای کامل پلتفرم MAHAK — R01

> **زبان پیش‌فرض:** فارسی (RTL) · **تیپ‌اسکریپت سخت‌گیر** · **بدون اعتبار/راز** در R01

این راهنما هر چیزی که برای اجرا، توسعه، تست و گسترش پوستهٔ MAHAK لازم داری را پوشش می‌دهد: نصب، اجرای سرورها، ساختار پروژه، مفاهیم کلیدی، مجموعهٔ تست‌ها، و رفع مشکلات رایج روی ویندوز.

---

## فهرست

1. [پیش‌نیازها](#۱-پیش‌نیازها)
2. [نصب سریع](#۲-نصب-سریع)
3. [اجرا](#۳-اجرا)
4. [ساختار پروژه](#۴-ساختار-پروژه)
5. [مفاهیم کلیدی](#۵-مفاهیم-کلیدی)
6. [قرارداد API](#۶-قرارداد-api)
7. [تست‌ها](#۷-تست‌ها)
8. [Build و اعتبارسنجی نهایی](#۸-build-و-اعتبارسنجی-نهایی)
9. [گسترش ماژول جدید](#۹-گسترش-ماژول-جدید)
10. [رفع مشکل (ویندوز)](#۱۰-رفع-مشکل-ویندوز)
11. [مرجع دستورات](#۱۱-مرجع-دستورات)

---

## ۱. پیش‌نیازها

| ابزار | نسخه | یادداشت |
| --- | --- | --- |
| Node.js | `>= 20.19` (ساخت‌شده با `24.21.0`) | [دانلود](https://nodejs.org) |
| pnpm | `10.15.0` (دست `packageManager`) | با `corepack` یا دستی |
| Python | `>= 3.12` (ساخت‌شده با `3.13.14`) | [دانلود](https://python.org) |
| مرورگر | Chrome نصب‌شده | فقط برای E2E (اگر CDN پلی‌رایت مسدود باشد) |

**یادداشت ویندوز:** اگر Node را به‌صورت پرتاببل (پوشهٔ zip) نصب کرده‌ای، مسیر آن را به `PATH` نشست PowerShell اضافه کن:

```powershell
$env:PATH = "C:\Users\<you>\.local\nodejs\node-v24.21.0-win-x64;$env:PATH"
```

---

## ۲. نصب سریع

```bash
# از ریشهٔ پروژه — وابستگی‌های همهٔ پکیج‌ها
pnpm install

# API پایتون (بهتر است در venv)
cd apps/api
python -m venv .venv
.venv\Scripts\activate            # ویندوز
pip install -e ".[test]"
cd ../..
```

پکیج‌های ورک‌اسپیس: `apps/web`، `apps/api`، `packages/contracts` (تعریف‌شده در `pnpm-workspace.yaml`).

---

## ۳. اجرا

دو لایه مستقل اجرا می‌شوند. **برای توسعهٔ محلی هر دو را باز نگه دار.**

### وب (Vite) — پورت ۵۱۷۳

```bash
pnpm --filter @mahak/web dev
# یا
cd apps/web && pnpm dev
```

نشانی: <http://localhost:5173>

### API (FastAPI/uvicorn) — پورت ۸۰۰۰

```bash
cd apps/api
uvicorn mahak_api.main:app --reload
```

نشانی پایه: <http://localhost:8000> · قرارداد: <http://localhost:8000/api/v1/shell>

> **مهم:** پوستهٔ وب **کاملاً بدون API هم کار می‌کند** (قانون مقاومت سمت کلاینت). اگر API قطع باشد، صفحهٔ اصلی همچنان رندر می‌شود و فقط اندیکاتور آفلاین ظاهر می‌گردد. برای توسعهٔ صرفِ فرانت‌اند، نیازی به اجرای API نیست.

### متغیرهای محیطی E2E

پلی‌رایت از پورت `۵۱۷۴` با `--strictPort` استفاده می‌کند (تعریف‌شده در `apps/web/playwright.config.ts`) تا با سرور توسعهٔ دستی تداخل نکند.

---

## ۴. ساختار پروژه

```text
taskboard/
├── ROADMAP.md                        # نقشهٔ راه R01→R36 و وابستگی‌ها
├── pnpm-workspace.yaml               # apps/* + packages/*
├── tsconfig.base.json                # تنظیمات سخت‌گیر TS مشترک
│
├── specs/001-platform-app-shell/      # مشخصات R01 (منبع حقیقت)
│   ├── spec.md                        # نیازمندی‌های FR/NFR
│   ├── plan.md                        # استراتژی پیاده‌سازی
│   ├── tasks.md                       # شکست کار (T001–T094+)
│   ├── data-model.md                  # کلیدهای localStorage و حالت‌ها
│   ├── research.md                    # تصمیمات A-01…A-xx
│   ├── quickstart.md                  # سناریوهای سریع
│   └── contracts/                     # shell-mode, navigation, theme, api
│
├── packages/contracts/                # قراردادهای مشترک TS (منبع واحد)
│   └── src/
│       ├── shell-mode.ts              # public | authenticated
│       ├── navigation.ts              # ۸ مقصد رزروشده + مسیرها
│       ├── viewport.ts                # mobile/tablet/desktop + مرزها
│       ├── theme.ts                   # light/dark/system
│       ├── direction.ts               # rtl/ltr + fa/ar/en
│       └── feature-availability.ts    # reserved | available
│
├── apps/web/                          # لایهٔ تجربهٔ کاربر (React 19)
│   └── src/
│       ├── main.tsx                   # نقطهٔ ورود
│       ├── App.tsx                    # ترکیب Providerها + AppShell
│       ├── shell/                     # خود پوسته
│       │   ├── AppShell.tsx           # سه ناحیه + states
│       │   ├── RegionBoundary.tsx     # مهار خطا در سطح ناحیه
│       │   ├── regions/               # header / sidebar / main
│       │   ├── navigation/            # Sidebar, NavDrawer, Registry
│       │   ├── states/                # loading/empty/error/unavailable/offline
│       │   └── accessibility/         # SkipToMain, FocusTrap, Announcer
│       ├── providers/                 # Locale, Theme, Direction,
│       │                              # ViewportClass, ShellMode
│       ├── features/                  # درز گسترش ماژول (۸ اسلات)
│       ├── i18n/                      # fa.json / ar.json / en.json
│       ├── themes/                    # tokens.css, shell.css, palette.ts
│       ├── router/                    # مسیرها + نگهبان احراز
│       └── logger/                    # logShellEvent
│
└── apps/api/                          # مرز API (FastAPI)
    └── src/mahak_api/
        ├── main.py                    # bootstrap + /api/v1
        ├── routes/shell.py            # GET /api/v1/shell
        └── contracts/shell.py         # آینهٔ پایتونی packages/contracts
```

---

## ۵. مفاهیم کلیدی

### ۵٫۱ سه ناحیهٔ اصلی (FR-001)

پوسته **دقیقاً سه نوع ناحیهٔ اصلی** دارد و چیزی بیشتر نه:

- `header` — بنر: هویت محصول + کنترل‌های سراسری (تم، زبان، ورود/ثبت‌نام)
- `sidebar` — ناوبری اصلی (دسکتاپ/تبلت) یا کشوی موبایل
- `main` — تنها ناحیه‌ای که محتوایش با تغییر مقصد عوض می‌شود (FR-003)

نشانه‌های داده‌ای برای تست: `[data-region="header"]`, `[data-region="sidebar"]`, `[data-region="main"]`.

### ۵٫۲ کلاس‌های نمایش (FR-016)

| کلاس | عرض | ناوبری |
| --- | --- | --- |
| `mobile` | `< 768px` | کشوی overlay (هیچ سایدباری) |
| `tablet` | `۷۶۸–۱۰۲۳px` | سایدبار فشرده، قابل بازشدن |
| `desktop` | `>= 1024px` | سایدبار کامل |

مرزها در `packages/contracts/src/viewport.ts`. مقدار فعال روی `[data-testid="shell-frame"][data-viewport]`.

### ۵٫۳ دو حالت پوسته (FR-042)

فقط `public` و `authenticated` — **حالت سومی وجود ندارد**.

- `public` → سرصفحه ورود/ثبت‌نام را نشان می‌دهد، مقاصد احرازشده به `/sign-in` هدایت می‌شوند.
- `authenticated` → ناحیهٔ حساب کاربری + مقاصد قابل دسترس.

**در R01 احراز هویت پیاده‌سازی نشده** (FR-046). حالت از طریق درز `?shellMode=authenticated` در URL یا `ShellModeProvider` کنترل می‌شود.

### ۵٫۴ تم (FR-029 تا FR-033)

سه حالت: `light` / `dark` / `system`. مقدار حل‌شده روی `document.documentElement` با `data-theme`. توکن‌های طراحی در `themes/tokens.css`.

### ۵٫۵ جهت و زبان (FR-023 تا FR-027)

| زبان | جهت |
| --- | --- |
| `fa` | `rtl` |
| `ar` | `rtl` |
| `en` | `ltr` |

جهت روی `document.documentElement` با `dir`. **زبان پیش‌فرض `fa` است.** همهٔ مناطق با logical CSS properties آینه می‌شوند — نیازی به reload نیست.

### ۵٫۶ ترجیحات ذخیره‌شده (localStorage)

کلیدها **دقیقاً** مطابق `data-model.md`:

| کلید | مقادیر |
| --- | --- |
| `mahak.shell.theme` | `light` \| `dark` \| `system` |
| `mahak.shell.direction` | `rtl` \| `ltr` |
| `mahak.shell.sidebar` | `expanded` \| `collapsed` |
| `mahak.shell.locale` | `fa` \| `ar` \| `en` |

> **قانون:** ماژول‌های بعدی **نباید** این کلیدها را بنویسند (FR-057) و باید فضای نام خودشان را داشته باشند.

### ۵٫۷ حالت‌های ناحیه (FR-047 تا FR-050)

`loading` → `empty` → `error` (با retry) → `unavailable` (ماژول هنوز پیاده نشده). خطای یک ناحیه **نباید** کل پوسته را ببرد (NFR-008) — `RegionBoundary` آن را مهار می‌کند.

---

## ۶. قرارداد API

تنها مسیر R01:

```http
GET /api/v1/shell
```

**پاسخ:**

```json
{
  "apiVersion": "v1",
  "shellMode": "public",
  "features": {
    "GENERAL_CHAT": "reserved",
    "CONVERSATIONS": "reserved",
    "PROJECTS": "reserved",
    "PRIVATE_TEACHER": "reserved",
    "FILES": "reserved",
    "SEARCH": "reserved",
    "SETTINGS": "reserved",
    "ADMIN_CONTROL_CENTER": "reserved"
  },
  "locales": {
    "supported": ["fa", "ar", "en"],
    "direction": { "fa": "rtl", "ar": "rtl", "en": "ltr" }
  }
}
```

**قوانین پایداری:**
- مسیر و شکل پاسخ **پایدار** هستند.
- ویژگی‌های بعدی فقط **مقادیر** را تغییر می‌دهند (مثلاً `reserved` → `available`).
- هیچ منطق تجاری، اعتبار یا رازی در این مسیر نیست (NFR-006).
- مسیرهای تجاری آینده باید `/api/v1/...` خودشان را داشته باشند.

---

## ۷. تست‌ها

### ۷٫۱ واحد/کامپوننت (Vitest + jsdom)

```bash
pnpm --filter @mahak/web test          # یا: pnpm test:web
```

۱۸ فایل / **۱۳۶ تست** — شامل: Providerها، AppShell، Sidebar، NavDrawer، states، a11y (axe)، contrast، NavigationRegistry، ModuleExtension.

### ۷٫۲ API (pytest)

```bash
cd apps/api && pytest                  # یا از ریشه: pnpm test:api
```

**۸ تست** — اعتبارسنجی شکل پاسخ، دقیقاً دو حالت پوسته، هشت ماژول رزروشده، عدم وجود راز.

### ۷٫۳ E2E (Playwright)

```bash
cd apps/web
pnpm test:e2e                          # همهٔ پروژه‌ها
pnpm exec playwright test --project=desktop-chromium
```

**پروژه‌ها:** `desktop-chromium` (کل سوئیت)، `desktop-firefox`/`desktop-webkit`/`mobile-chromium` (فقط `browser-support.spec.ts`).

**سوئیت‌ها:**

| فایل | پوشش |
| --- | --- |
| `responsive.spec.ts` | کلاس‌های نمایش، کشو، عبور از breakpoint |
| `direction.spec.ts` | RTL/LTR، آینه‌سازی وسط نشست |
| `theme.spec.ts` | اعمال/persist کردن تم، System |
| `a11y-keyboard.spec.ts` | Tab order، focus trap، skip link |
| `zoom.spec.ts` | ۱.۵× و ۲× بدون اسکرول افقی |
| `offline.spec.ts` | اندیکاتور آفلاین، مقاومت |
| `performance.spec.ts` | بودجهٔ ۲ ثانیهٔ تعاملی |
| `browser-support.spec.ts` | دودوی کراس-مرورگر |

**نصب مرورگر پلی‌رایت:**

```bash
cd apps/web && pnpm exec playwright install chromium
```

> **اگر CDN مسدود بود** (خطای 403 روی ویندوز): `playwright.config.ts` به‌صورت خودکار از Chrome سیستم با `channel: "chrome"` استفاده می‌کند. نیازی به دانلود نیست.

### ۷٫۴ تایپ و لینت

```bash
pnpm --filter @mahak/web typecheck     # tsc -b --noEmit
pnpm --filter @mahak/web lint          # eslint --max-warnings=0
```

---

## ۸. Build و اعتبارسنجی نهایی

```bash
# Build تولید
pnpm --filter @mahak/web build         # tsc -b && vite build
pnpm --filter @mahak/web preview       # سرو خروجی build

# کامپایل پایتون (Constitution Principle V)
python -m compileall apps/api

# همهٔ گیت‌ها با هم
pnpm typecheck && pnpm test && python -m compileall apps/api
```

---

## ۹. گسترش ماژول جدید

درز گسترش **تنها** راه قانونی اتصال یک ماژول محصول به پوسته است (FR-014, FR-053). سه قدم:

1. **در دسترس کردن:** مقدار `features["<MODULE>"]` در API را از `reserved` به `available` تغییر بده.
2. **بستن مسیر:** مسیر ماژول را به `routePath` موجود در Registry ببند.
3. **رندر در main:** محتوا را در ناحیهٔ main رندر کن.

```ts
// apps/web/src/features/<module>/index.ts
import { defineModuleBinding } from "../registry.js";
import { MyModule } from "./MyModule.js";

defineModuleBinding({
  moduleId: "GENERAL_CHAT",
  availability: "available",
  component: MyModule,
});
```

**قوانین:**
- **ممنوع:** تغییر Regionهای پوسته، قرارداد ناوبری، یا لایه‌وت.
- هشت اسلات رزرو شده: `general-chat`, `conversations`, `projects`, `private-teacher`, `files`, `search`, `settings`, `admin`.
- `KNOWLEDGE`, `MEMORY`, `VOICE`, `AI_MODEL_GATEWAY` در R01 **هویتی‌Only** هستند — اسلاتی ندارند.

---

## ۱۰. رفع مشکل (ویندوز)

### `pnpm` یا `node` شناخته نمی‌شود

Node پرتاببل روی `PATH` نیست. در هر نشست PowerShell:

```powershell
$env:PATH = "C:\Users\<you>\.local\nodejs\node-v24.21.0-win-x64;$env:PATH"
```

### اسکریپت‌های PowerShell غیرفعال‌اند

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### `pnpm vitest` در ریشه کار نمی‌کند

اسکریپت‌های ریشه از `pnpm -r` استفاده می‌کنند. اجرای مستقیم باید داخل `apps/web` باشد:

```bash
cd apps/web && pnpm exec vitest run
```

### دانلود پلی‌رایت ۴۰۳ می‌دهد

CDN پلی‌رایت در برخی موقعیت‌های جغرافیایی مسدود است. `playwright.config.ts` قبلاً پیکربندی شده تا از Chrome سیستم (`C:\Program Files\Google\Chrome\Application\chrome.exe`) با `channel: "chrome"` استفاده کند. اگر مسیر Chrome متفاوت است، آن را در فایل کانفیگ اصلاح کن.

### E2E: دکمه‌های تم/زبان کلیک نمی‌شوند

در نمای موبایل (۳۶۰px) کنترل‌های تم ممکن است بیرون viewport باشند. تست‌ها باید از `click({ force: true })` یا `page.evaluate` استفاده کنند. **دقت:** انتخابگرهای مبتنی بر متن (`getByRole("group", { name: /Theme/ })`) وقتی زبان پیش‌فرض `fa` است کار نمی‌کنند — به‌جای آن از کلاس‌های `.shell-theme-controls` / `.shell-locale-controls` استفاده کن.

### `ModuleNotFoundError: No module named 'mahak_api'`

uvicorn باید از پوشهٔ `apps/api` اجرا شود (یا `pyproject.toml` با `pip install -e .` نصب شود تا `pythonpath = ["src"]` اعمال گردد).

```bash
cd apps/api && uvicorn mahak_api.main:app --reload
```

### خطای `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`

pnpm نمی‌تواند `node` را پیدا کند (مسیر پرتاببل). راه‌حل: اضافه‌کردن Node به `PATH` پیش از اجرای `pnpm`.

---

## ۱۱. مرجع دستورات

### ریشهٔ پروژه

| دستور | کار |
| --- | --- |
| `pnpm install` | نصب همهٔ وابستگی‌ها |
| `pnpm lint` | lint همهٔ پکیج‌ها |
| `pnpm typecheck` | tsc همهٔ پکیج‌ها |
| `pnpm test` | تست‌های همهٔ پکیج‌ها |
| `pnpm test:web` | فقط تست‌های وب |
| `pnpm test:api` | فقط تست‌های API |
| `pnpm test:e2e` | پلی‌رایت |
| `pnpm dev` | سرور توسعهٔ وب |
| `pnpm py:compileall` | کامپایل پایتون |
| `pnpm validate` | typecheck + test + compileall |

### apps/web

| دستور | کار |
| --- | --- |
| `pnpm dev` | Vite (پورت ۵۱۷۳) |
| `pnpm build` | `tsc -b && vite build` |
| `pnpm preview` | سرو build |
| `pnpm test` | Vitest |
| `pnpm test:watch` | Vitest حالت_watch |
| `pnpm test:coverage` | Vitest + کاورج |
| `pnpm test:e2e` | پلی‌رایت |
| `pnpm test:e2e:ui` | پلی‌رایت UI mode |
| `pnpm typecheck` | `tsc -b --noEmit` |
| `pnpm lint` | ESLint |

### apps/api

| دستور | کار |
| --- | --- |
| `uvicorn mahak_api.main:app --reload` | سرور توسعه (پورت ۸۰۰۰) |
| `pytest` | تست‌های قرارداد |
| `python -m compileall src tests` | دروازهٔ پایتون |

---

## نقشهٔ بعدی

پس از تکمیل R01، مسیر توصیه‌شده طبق `ROADMAP.md`:

```text
R01 → R02 (احراز هویت) → R03 (تنظیمات/بومی‌سازی) → R04 (کاتالوگ) → R05 ...
```

هر ویژگی جدید باید `spec.md`، `plan.md` و `tasks.md` خودش را داشته باشد و به این راهنما و `ROADMAP.md` ارجاع دهد.

---

**نسخهٔ راهنما:** ۱.۰ · **آخرین به‌روزرسانی:** ۲۰۲۶-۰۹-۲۵ · **وضعیت R01:** در حال تکمیل
