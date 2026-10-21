import type {
  HabitId,
  StudentDashboardResponse,
} from "@/lib/types/studentDashboard";

// Presentasi statis 7 kebiasaan (judul, gambar, warna) + pemetaan slug frontend
// ke kode kebiasaan di backend. Backend tidak mengirim gambar/warna, jadi
// bagian visual tetap dipegang frontend; poin dan indikator diambil dari
// GET /habits.

export const HABIT_PRESENTATION: StudentDashboardResponse["habits"] = [
  {
    id: "wake-up",
    order: 1,
    title: "Bangun Pagi",
    shortTitle: "Bangun Pagi",
    description: "Kebiasaan bangun pagi, dihitung dari waktu adzan subuh.",
    imageUrl: "/assets/student/wake-up.png",
    completed: false,
    pointsAwarded: 15,
    accent: "bg-[#FFF8E8]",
  },
  {
    id: "prayer",
    order: 2,
    title: "Beribadah",
    shortTitle: "Beribadah",
    description: "Kebiasaan menjalankan ibadah sesuai target.",
    imageUrl: "/assets/student/prayer.png",
    completed: false,
    pointsAwarded: 20,
    accent: "bg-[#EDF9F2]",
  },
  {
    id: "sports",
    order: 3,
    title: "Berolahraga",
    shortTitle: "Berolahraga",
    description: "Kebiasaan melakukan aktivitas olahraga.",
    imageUrl: "/assets/student/sports.png",
    completed: false,
    pointsAwarded: 20,
    accent: "bg-[#EEF6FF]",
  },
  {
    id: "healthy-food",
    order: 4,
    title: "Makan Sehat dan Bergizi",
    shortTitle: "Makan Sehat & Bergizi",
    description: "Kebiasaan menjaga makan sehat dan bergizi.",
    imageUrl: "/assets/student/healthy-food.png",
    completed: false,
    pointsAwarded: 20,
    accent: "bg-[#FFF5E8]",
  },
  {
    id: "reading",
    order: 5,
    title: "Gemar Belajar",
    shortTitle: "Gemar Belajar",
    description: "Kebiasaan belajar secara aktif untuk bekal masa depan.",
    imageUrl: "/assets/student/reading.png",
    completed: false,
    pointsAwarded: 20,
    accent: "bg-[#F8F0FF]",
  },
  {
    id: "community",
    order: 6,
    title: "Bermasyarakat",
    shortTitle: "Bermasyarakat",
    description:
      "Kebiasaan melakukan kegiatan yang membantu lingkungan/masyarakat.",
    imageUrl: "/assets/student/community.png",
    completed: false,
    pointsAwarded: 20,
    accent: "bg-[#FFF0F3]",
  },
  {
    id: "early-sleep",
    order: 7,
    title: "Tidur Cepat",
    shortTitle: "Tidur Cepat",
    description: "Kebiasaan menjaga waktu tidur.",
    imageUrl: "/assets/student/early-sleep.png",
    completed: false,
    pointsAwarded: 15,
    accent: "bg-[#EDF8F8]",
  },
];

export const HABIT_CODE_BY_SLUG: Record<HabitId, string> = {
  "wake-up": "bangun_cepat",
  prayer: "beribadah",
  reading: "gemar_belajar",
  sports: "berolahraga",
  community: "bermasyarakat",
  "healthy-food": "makan_sehat_bergizi",
  "early-sleep": "tidur_cepat",
};

export const HABIT_SLUG_BY_CODE = Object.fromEntries(
  Object.entries(HABIT_CODE_BY_SLUG).map(([slug, code]) => [code, slug]),
) as Record<string, HabitId>;

export const HABIT_CATEGORY: Record<HabitId, string> = {
  "wake-up": "Kedisiplinan Waktu",
  prayer: "Spiritual & Karakter",
  sports: "Kesehatan",
  "healthy-food": "Gizi & Pola Makan",
  reading: "Pendidikan",
  community: "Sosial",
  "early-sleep": "Kedisiplinan Waktu",
};

export const HABIT_SLUGS = HABIT_PRESENTATION.map((habit) => habit.id);
