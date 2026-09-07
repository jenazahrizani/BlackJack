Berikut list yang paling aman untuk membuat game **Blackjack 21 benar-benar playable**, tetapi tetap memakai `localStorage`.

### File yang PERLU diubah

| File                        | Status           | Fungsi                                                                                                                |
| --------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/game/Blackjack.ts`     | **WAJIB**        | Mesin aturan blackjack: shuffle, deal, hit, stand, double, split, blackjack, bust, dealer turn, win/lose/push, payout |
| `src/game/Game.ts`          | **WAJIB**        | Menghubungkan engine blackjack dengan input, animation, dan renderer                                                  |
| `src/game/Input.ts`         | **WAJIB**        | Menerima aksi pemain: bet, deal, hit, stand, double, split                                                            |
| `src/game/Renderer.ts`      | **WAJIB**        | Menampilkan kartu/chip/dealer/player berdasarkan state permainan aktual                                               |
| `src/components/Game.astro` | **WAJIB**        | Menghubungkan canvas/game dengan kontrol permainan                                                                    |
| `src/components/HUD.astro`  | **PERLU**        | Menampilkan saldo, bet, nilai kartu, dan tombol aksi secara minimal                                                   |
| `src/game/Save.ts`          | **BARU — WAJIB** | Menyimpan/memuat saldo, statistik, dan progres ke `localStorage`                                                      |

### File yang TIDAK perlu diubah sekarang

| File                    | Status               | Alasan                                                                     |
| ----------------------- | -------------------- | -------------------------------------------------------------------------- |
| `src/game/Entities.ts`  | **TIDAK PERLU**      | Struktur data yang sekarang sudah cukup untuk engine                       |
| `src/game/Animation.ts` | **TIDAK PERLU dulu** | Sudah punya fondasi animasi; nanti hanya disesuaikan jika ada animasi baru |
| `src/pages/index.astro` | **TIDAK PERLU**      | Sudah menjadi entry point                                                  |
| `src/styles/global.css` | **TIDAK PERLU dulu** | Visual dasar bisa dipertahankan                                            |
| `astro.config.mjs`      | **TIDAK PERLU**      | Tidak berhubungan dengan gameplay                                          |
| `tsconfig.json`         | **TIDAK PERLU**      | Tidak ada perubahan arsitektur yang memerlukannya                          |
| `package.json`          | **TIDAK PERLU**      | Gameplay ini bisa dibuat tanpa dependency tambahan                         |

### Urutan pengerjaan yang saya sarankan

```text
1. Blackjack.ts   ← buat mesin blackjack sungguhan
2. Save.ts        ← localStorage
3. Game.ts        ← sambungkan engine
4. Input.ts       ← kontrol pemain
5. Renderer.ts    ← visual state aktual
6. Game.astro     ← integrasi
7. HUD.astro      ← kontrol/info minimal
```

Sedangkan:

```text
Entities.ts       ← TIDAK DIUBAH
Animation.ts      ← TIDAK DIUBAH dulu
index.astro       ← TIDAK DIUBAH
global.css        ← TIDAK DIUBAH dulu
astro.config.mjs  ← TIDAK DIUBAH
tsconfig.json     ← TIDAK DIUBAH
package.json      ← TIDAK DIUBAH
```

Jadi totalnya **6 file yang diubah + 1 file baru**:

```text
MODIFY
├── Blackjack.ts
├── Game.ts
├── Input.ts
├── Renderer.ts
├── Game.astro
└── HUD.astro

CREATE
└── Save.ts
```

**`Entities.ts` yang barusan kamu kirim tidak perlu dipatch lagi untuk tahap gameplay.**
