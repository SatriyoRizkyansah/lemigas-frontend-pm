# LEMIGAS Super Apps — Template Login & Dashboard

Next.js 14 (App Router) + TypeScript, tanpa library UI tambahan (CSS biasa, token di `app/globals.css`).

## Menjalankan
```bash
npm install
npm run dev      # http://localhost:3000
```
Mode demo: email/username dan kata sandi apa pun diterima.

## Struktur
- `app/login/page.tsx` — form login (validasi, tampil/sembunyi sandi, ingat saya, loading, error)
- `app/dashboard/*` — Beranda, Aplikasi, Profil, Bantuan (satu layout bersama)
- `components/` — `Topbar`, `Sidebar` (bisa diperkecil / drawer di mobile), `AppCard`, `Logo`, `Skyline`
- `lib/apps.ts` — daftar aplikasi; tambah entri baru untuk kartu baru
- `lib/auth.ts` + `middleware.ts` — autentikasi tiruan berbasis cookie

## Yang perlu Anda ganti
1. **Logo resmi**: timpa `public/logo.svg` (saat ini placeholder).
2. **Foto**: simpan `public/images/login-bg.jpg` (latar login) dan `public/images/hero.jpg` (banner beranda). Tanpa file ini, tampil gradien kuning/navy.
3. **Autentikasi**: ganti simulasi di `app/login/page.tsx` (`TODO`) dan `lib/auth.ts` dengan SSO/API backend Anda.
4. **Warna & ukuran**: ubah variabel di bagian `:root` pada `app/globals.css`.
5. **Link aplikasi**: ubah `href` di `lib/apps.ts`.
# lemigas-frontend-pm
