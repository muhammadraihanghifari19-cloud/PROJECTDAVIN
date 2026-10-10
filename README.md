# FRAMELESS · Motion Path Animation Studio

> Alat desain multifungsi berbasis web untuk desainer kreatif — gambar jalur gerak, tempel objek, lalu biarkan mereka hidup. Seperti pisau Swiss Army untuk kebutuhan motion & visual di industri kreatif.

---

## 1. Nama & Deskripsi Proyek

**Nama:** FRAMELESS — Motion Path Animation Studio
**Tagline:** *frameless • for creative industry*

**Deskripsi:**
FRAMELESS adalah studio animasi jalur gerak (motion path) yang berjalan sepenuhnya di dalam browser, tanpa instalasi, tanpa framework, dan tanpa dependency. Nama "FRAMELESS" punya dua makna: (1) tanpa bingkai — kanvas kerja yang bebas dan luas, dan (2) "frame-less" dalam arti kamu tidak perlu menggambar animasi frame-demi-frame secara manual; kamu cukup menggambar *jalur*, lalu objek akan menyusurinya secara otomatis.

Konsep intinya sederhana tapi kuat:

1. **Gambar jalur (Path)** — klik beberapa titik di kanvas, FRAMELESS menyambungnya jadi kurva halus (Catmull-Rom spline).
2. **Tempel objek (Object)** — pilih bentuk (lingkaran, bintang, berlian, dll.), lalu klik untuk menaruhnya.
3. **Mainkan** — tekan Play, dan setiap objek bergerak menyusuri jalur dengan easing, rotasi mengikuti arah, jejak gerak, dan loop sesuai pengaturan.

Cocok untuk membuat: pratinjau animasi logo, storyboard motion, aset loading, ilustrasi kinetik, hingga eksplorasi ide gerak untuk UI/UX dan konten sosial media.

---

## 2. Fitur Utama

| Kategori | Fitur |
|---|---|
| **Menggambar** | Jalur multi-titik, kurva otomatis halus, geser titik (drag node), hapus titik |
| **Objek** | 6 bentuk: lingkaran, kotak, segitiga, bintang, cincin, berlian; ukuran & warna per-objek |
| **Animasi** | 6 kurva easing (linear, ease in/out, elastic, bounce), durasi 0.5–12s, loop |
| **Gerak lanjut** | Rotasi mengikuti arah jalur (orient), jejak gerak (motion trail), offset start per-objek |
| **Timeline** | Scrubber manual 0–100%, Play/Pause, Reset |
| **Design System** | Dua tema (Midnight Lab / Solar), palet klik-untuk-pakai, skala tipografi golden ratio |
| **Produktivitas** | Shortcut keyboard, ekspor konfigurasi ke JSON |

---

## 3. Palet Warna

FRAMELESS memakai estetika **"brutalist neon lab"** — latar gelap pekat dengan aksen neon berani, anti-mainstream dibanding palet pastel korporat.

### Tema Default — "Midnight Lab" (gelap)

| Peran | Nama | Hex | Catatan |
|---|---|---|---|
| Latar utama | Near-black Ink | `#0E0E12` | Dasar kanvas |
| Permukaan panel | Panel Surface | `#16161D` | Rail & topbar |
| Permukaan terangkat | Raised | `#1F1F29` | Tombol & panel properti |
| Garis rambut | Hairline | `#2C2C3A` | Border tipis |
| Teks utama | Ink | `#ECECF2` | |
| Teks sekunder | Ink Soft | `#9A9AAE` | |
| **Aksen tanda tangan** | **Acid Lime** | `#F5F749` | Warna identitas FRAMELESS |
| Aksen 2 | Hot Coral | `#FF4D6D` | |
| Aksen 3 | Cyber Cyan | `#4DE1FF` | Warna garis jalur |
| Aksen 4 | Ultraviolet | `#B388FF` | Jejak gerak |

### Tema Alternatif — "Solar" (terang)

| Peran | Hex |
|---|---|
| Latar | `#F4F1E8` |
| Aksen | `#FF5A1F` (orange) · `#0057FF` (blue) · `#00A878` (green) · `#9B51E0` (purple) |

> **Rasionalisasi:** acid lime + near-black menghasilkan kontras tinggi (mudah dibaca, aksesibel) sekaligus terasa "lab eksperimen" yang segar. Coral/cyan/ultraviolet dipakai hemat sebagai sinyal, bukan dekorasi.

---

## 4. Tipografi & Rasio Font

Skala tipografi dibangun di atas **Golden Ratio (φ ≈ 1.618)** untuk hierarki yang harmonis secara matematis.

| Token | Ukuran | Pemakaian |
|---|---|---|
| `--t-xl` | **2.618rem** (φ²) | Display raksasa "Aa" |
| `--t-lg` | 1.618rem (φ¹) | Judul besar |
| `--t-md` | 1.272rem (√φ) | Sub-judul |
| `--t-sm` | 1rem (base 16px) | Teks tubuh |
| `--t-xs` | 0.786rem (1/φ·√) | Caption, label, mono |

**Pasangan font (3 tingkat):**

- **Archivo Black** — display/brand. Tebal, blocky, berkarakter.
- **Space Grotesk** — antarmuka (UI). Geometris modern, netral-hangat.
- **JetBrains Mono** — angka, koordinat, label teknis. Memberi nuansa "studio engineering".

Kombinasi display tebal + grotesk + mono adalah ciri khas tooling kreatif modern, bukan font korporat generik.

---

## 5. Komposisi & Layout

Layout memakai **grid tiga kolom frameless**:

```
┌─────────────────────────────────────────────────────────┐
│  TOP BAR  · brand · transport (play/scrub) · export/theme │
├────────┬───────────────────────────────────┬────────────┤
│ RAIL   │                                   │  RAIL      │
│ KIRI   │          STAGE / CANVAS           │  KANAN     │
│ tools  │        (SVG motion path)          │  properti  │
│ shapes │                                   │  + design  │
│ hint   │                                   │  system    │
├────────┴───────────────────────────────────┴────────────┤
│  STATUS BAR · jumlah objek · jumlah titik · kredit        │
└─────────────────────────────────────────────────────────┘
```

- **Rail kiri (180px):** perkakas (Select, Path, Object, Erase) + pilihan bentuk + hint.
- **Stage (fleksibel):** kanvas SVG dengan grid latar, tempat semua aksi terjadi.
- **Rail kanan (300px):** properti animasi, properti objek terpilih, dan panel Design System hidup (palet + skala font).
- **Responsif:** di layar sempit, grid runtuh jadi satu kolom.

Prinsip komposisi: **ruang kerja (stage) mendominasi**, panel ramping di sisi, kontrol pemutaran terpusat di atas — mengikuti pola editor kreatif profesional (fokus ke kanvas).

---

## 6. Referensi Desain

Ide dan arah visual terinspirasi dari (dirangkum, bukan dikutip):

- **Editor timeline motion** seperti After Effects / Rive — pola transport + scrubber + properti panel.
- **Tooling vektor** seperti Figma / Framer — rail perkakas minimalis dan interaksi klik-tempel.
- **Estetika brutalist web & neon lab** — latar gelap, aksen neon tegas, tipografi blocky, label monospace.
- **Golden ratio typography** — tradisi tipografi klasik untuk hierarki ukuran.

---

## 7. Kombinasi Ide Segar (Anti-Mainstream)

Hal-hal yang membuat FRAMELESS berbeda dari tool motion biasa:

1. **"Frame-less" workflow** — kamu menggambar *jalur*, bukan keyframe. Gerak lahir dari geometri, bukan timeline rumit.
2. **Offset start per-objek** — banyak objek di satu jalur bergerak seperti arak-arakan/konvoi dengan jarak otomatis.
3. **Design system yang hidup di dalam tool** — palet dan skala font bukan sekadar dokumen; swatch bisa diklik langsung untuk mewarnai objek.
4. **Zero-dependency, zero-build** — satu `index.html` + CSS + JS. Buka di browser, langsung jalan. Tidak ada npm, tidak ada error instalasi.
5. **Motion trail sebagai elemen desain**, bukan debug — jejak ultraviolet jadi bagian estetika.
6. **Ekspor JSON** — konfigurasi animasi bisa dibawa ke pipeline lain (hand-off ke developer).

---

## 8. Cara Menjalankan

Tidak perlu instalasi apa pun.

**Opsi A — buka langsung:**
Klik dua kali `index.html` (buka di browser modern: Chrome, Edge, Firefox).

**Opsi B — server lokal (disarankan, agar font & semua fitur optimal):**

```bash
# Python 3
python -m http.server 5500

# atau Node
npx serve .
```

Lalu buka `http://localhost:5500`.

---

## 9. Cara Pakai Singkat

1. Pilih **Path** (atau tekan `P`), klik beberapa titik di kanvas untuk membuat jalur.
2. Pilih **Object** (`O`), pilih bentuk di rail kiri, klik di kanvas untuk menempel objek.
3. Atur **Durasi**, **Easing**, **Loop**, **Orient**, **Trail** di panel kanan.
4. Tekan **Play** (`Space`) untuk memutar; geser **scrubber** untuk melihat frame tertentu.
5. Gunakan **Select** (`V`) untuk menggeser objek/titik; **Erase** (`E`) untuk menghapus.
6. Klik **Export** untuk menyimpan konfigurasi sebagai JSON; **Theme** untuk ganti suasana warna.

### Pintasan Keyboard

| Tombol | Aksi |
|---|---|
| `V` | Mode Select |
| `P` | Mode Path |
| `O` | Mode Object |
| `E` | Mode Erase |
| `Space` | Play / Pause |
| `Delete` / `Backspace` | Hapus objek terpilih |

---

## 10. Struktur File

```
pojectdavin/
├── index.html                 # Versi kerja (3 file terpisah) — untuk pengembangan
├── styles.css                 # Design system: palet, tipografi φ, layout grid, tema
├── app.js                     # Engine: path drawing, motion along path, timeline, export
├── frameless-standalone.html  # Versi SATU FILE — untuk dikirim & review
└── README.md                  # Dokumentasi ini
```

### Mana yang dikirim untuk review?

Kirim **`frameless-standalone.html`**. Semua CSS & JS sudah digabung ke dalam satu file,
jadi penerima cukup menerima 1 file lalu tap/klik untuk membukanya — di HP maupun laptop,
online maupun offline. (Saat offline, font cantik diganti otomatis dengan font sistem yang
tetap rapi.) Tidak perlu ikut mengirim `styles.css` atau `app.js`.

---

## 11. Teknologi

- HTML5 semantik
- CSS3 (custom properties, grid, clip-path)
- JavaScript (ES6+, SVG API: `getPointAtLength`, `getTotalLength`, `getScreenCTM`)
- **Tanpa framework, tanpa build step, tanpa dependency.**

---

*Dibuat sebagai alat eksplorasi motion untuk desainer industri kreatif. Selamat berkarya.* ✦
