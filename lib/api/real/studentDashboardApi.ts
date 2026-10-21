import { apiRequest, ApiError } from "@/lib/api/client";
import { avatarByGender, fetchCurrentUserApi } from "@/lib/api/authApi";
import {
  asRec,
  pick,
  toDateKey,
  toDateOnly,
  toList,
  toNum,
  toStr,
  type Rec,
} from "@/lib/api/mappers";
import type { StudentDashboardApi } from "@/lib/api/contracts/studentDashboardApi";
import { fieldsByHabit } from "@/lib/constants/habitFormFields";
import {
  HABIT_CATEGORY,
  HABIT_CODE_BY_SLUG,
  HABIT_PRESENTATION,
  HABIT_SLUG_BY_CODE,
} from "@/lib/constants/habitPresentation";
import type { AuthenticatedUser } from "@/lib/types/authType";
import type {
  HabitFormField,
  HabitId,
  HabitSummary,
  LeaderboardEntry,
  LeaderboardScope,
  RecapItem,
  StudentSummary,
  SubmitHabitRequest,
} from "@/lib/types/studentDashboard";
import { formatIndonesianDate, getLocalDateKey } from "@/lib/utils/date";

// Endpoint mengikuti API Contract v1.2 (base URL sudah berakhiran /api).
const ENDPOINTS = {
  dashboard: "/dashboard/student",
  habits: "/habits",
  entries: "/habits/entries",
  habitEntry: (habitId: string) => `/habits/${habitId}/entries`,
  // Bermasyarakat dipisah dari GET /habits/entries (yang hanya memuat 6 habit).
  communityEntry: "/bermasyarakat/entries",
  rankings: { class: "/rankings/rombel", grade: "/rankings/angkatan" },
  gamification: "/gamification/me",
} as const;

const TOTAL_HABITS = HABIT_PRESENTATION.length;

/* ----------------------------- katalog kebiasaan ---------------------------- */

interface CatalogIndicator {
  id: string;
  label: string;
  points: number;
}

interface CatalogHabit {
  id: string;
  code: string;
  slug: HabitId;
  points: number;
  isExclusive: boolean;
  allowsMultiSelect: boolean;
  indicators: CatalogIndicator[];
  guideHtml?: string;
}

const CATALOG_TTL_MS = 5 * 60 * 1000;
let catalogCache: { at: number; promise: Promise<CatalogHabit[]> } | null =
  null;

const mapCatalogHabit = (raw: Rec): CatalogHabit | null => {
  const code = toStr(pick(raw, "code", "slug", "key"));
  const slug = HABIT_SLUG_BY_CODE[code];
  if (!slug) return null;

  const indicators = toList(
    pick(raw, "indicators", "habit_indicators", "options"),
  ).map((item) => ({
    id: toStr(item.id),
    label: toStr(pick(item, "label", "name", "title", "description")),
    points: toNum(pick(item, "points", "point", "score")),
  }));

  return {
    id: toStr(raw.id),
    code,
    slug,
    points: toNum(
      pick(raw, "points", "max_points"),
      Math.max(0, ...indicators.map((item) => item.points)),
    ),
    isExclusive: pick(raw, "is_exclusive") !== false,
    allowsMultiSelect: pick(raw, "allows_multi_select") === true,
    indicators,
    // Belum dikirim backend (lihat daftar tugas backend #1). Begitu ada,
    // field ini otomatis tampil sebagai tombol "Panduan Pengisian".
    guideHtml: toStr(pick(raw, "panduan_teks", "guide_html")) || undefined,
  };
};

const getCatalog = (force = false): Promise<CatalogHabit[]> => {
  const now = Date.now();
  if (!force && catalogCache && now - catalogCache.at < CATALOG_TTL_MS)
    return catalogCache.promise;

  const promise = apiRequest<unknown>(ENDPOINTS.habits).then(({ data }) =>
    toList(data, "habits")
      .map(mapCatalogHabit)
      .filter((habit): habit is CatalogHabit => habit !== null),
  );
  catalogCache = { at: now, promise };
  promise.catch(() => {
    if (catalogCache?.promise === promise) catalogCache = null;
  });
  return promise;
};

const findHabit = (catalog: CatalogHabit[], slug: HabitId): CatalogHabit => {
  const habit = catalog.find((item) => item.slug === slug);
  if (!habit)
    throw new ApiError(
      404,
      "HABIT_NOT_FOUND",
      `Kebiasaan "${HABIT_CODE_BY_SLUG[slug] ?? slug}" belum tersedia di server.`,
    );
  return habit;
};

/* ------------------------------ entri kebiasaan ----------------------------- */

interface Entry {
  id: string;
  slug: HabitId | null;
  indicatorId: string;
  indicatorLabel: string;
  // Bermasyarakat bisa memuat beberapa indikator dalam satu entri.
  indicatorLabels: string[];
  initiative: "mandiri" | "disuruh" | "";
  note: string;
  dateKey: string;
  points: number;
}

const ENTRIES_PER_PAGE = 100;
const ENTRIES_MAX_PAGES = 10;
const ENTRIES_TTL_MS = 15 * 1000;
// Cache per tanggal: dashboard & form memakai hari ini, rekap bisa tanggal lain.
const entriesCache = new Map<
  string,
  { at: number; promise: Promise<Entry[]> }
>();

const invalidateEntries = () => {
  entriesCache.clear();
};

const mapEntry = (
  raw: Rec,
  catalog: CatalogHabit[],
  forceSlug?: HabitId,
): Entry => {
  const habitRec = asRec(raw.habit);
  const indicatorRec = asRec(raw.indicator);
  const habitId = toStr(pick(raw, "habit_id") ?? habitRec.id);
  const habitCode = toStr(pick(raw, "habit_code") ?? habitRec.code);
  const catalogHabit =
    (forceSlug && catalog.find((item) => item.slug === forceSlug)) ||
    catalog.find((item) => item.id === habitId) ||
    catalog.find((item) => item.code === habitCode);
  const indicatorId = toStr(pick(raw, "indicator_id") ?? indicatorRec.id);
  const catalogIndicator = catalogHabit?.indicators.find(
    (item) => item.id === indicatorId,
  );
  const initiative = toStr(raw.initiative).toLowerCase();

  // Entri Bermasyarakat: daftar indikator bisa berupa objek ({id,label}),
  // atau hanya id (indicator_ids) yang dicocokkan ke katalog.
  const multiLabels = [
    ...toList(raw.indicators).map((item) =>
      toStr(pick(item, "label", "name", "title")),
    ),
    ...(Array.isArray(raw.indicator_ids)
      ? (raw.indicator_ids as unknown[]).map(
          (id) =>
            catalogHabit?.indicators.find((item) => item.id === toStr(id))
              ?.label ?? "",
        )
      : []),
  ].filter(Boolean);
  const singleLabel =
    toStr(
      pick(raw, "indicator_label") ??
        pick(indicatorRec, "label", "name", "title"),
    ) ||
    catalogIndicator?.label ||
    "";
  const labels = multiLabels.length
    ? multiLabels
    : singleLabel
      ? [singleLabel]
      : [];

  return {
    id: toStr(raw.id),
    slug: catalogHabit?.slug ?? HABIT_SLUG_BY_CODE[habitCode] ?? null,
    indicatorId,
    indicatorLabel: labels.join(", "),
    indicatorLabels: labels,
    initiative:
      initiative === "mandiri" || initiative === "disuruh" ? initiative : "",
    note: toStr(raw.note),
    dateKey:
      toDateOnly(raw.habit_date, raw.entry_date, raw.date, raw.tanggal) ||
      toDateKey(raw.created_at, raw.submitted_at),
    points: toNum(
      pick(raw, "poin_awarded", "points_awarded", "points", "point") ??
        pick(indicatorRec, "points") ??
        catalogIndicator?.points,
    ),
  };
};

// Backend mengirim daftar per halaman (page, per_page maks 100) dan mendukung
// filter `date=YYYY-MM-DD`, jadi hanya entri tanggal yang dibutuhkan yang
// diambil (semua halamannya).
const fetchAllPages = async (
  endpoint: string,
  catalog: CatalogHabit[],
  dateKey: string,
  forceSlug?: HabitId,
): Promise<Entry[]> => {
  const all: Entry[] = [];
  for (let page = 1; page <= ENTRIES_MAX_PAGES; page += 1) {
    const { data, meta } = await apiRequest<unknown>(endpoint, {
      query: { page, per_page: ENTRIES_PER_PAGE, date: dateKey },
    });
    toList(data, "entries").forEach((raw) =>
      all.push(mapEntry(raw, catalog, forceSlug)),
    );
    if (!meta?.total_pages || page >= meta.total_pages) break;
  }
  return all;
};

// GET /habits/entries hanya memuat 6 habit. Bermasyarakat diambil dari
// GET /bermasyarakat/entries lalu digabung agar hitungan "7 dari 7" benar.
const getEntriesByDate = (dateKey: string): Promise<Entry[]> => {
  const now = Date.now();
  const cached = entriesCache.get(dateKey);
  if (cached && now - cached.at < ENTRIES_TTL_MS) return cached.promise;

  const promise = (async () => {
    const catalog = await getCatalog();
    const [regular, community] = await Promise.all([
      fetchAllPages(ENDPOINTS.entries, catalog, dateKey),
      fetchAllPages(ENDPOINTS.communityEntry, catalog, dateKey, "community"),
    ]);
    return [...regular, ...community];
  })();
  entriesCache.set(dateKey, { at: now, promise });
  promise.catch(() => {
    if (entriesCache.get(dateKey)?.promise === promise)
      entriesCache.delete(dateKey);
  });
  return promise;
};

/* --------------------------------- helper UI -------------------------------- */

const initiativeValue = (field: HabitFormField | undefined, label: string) =>
  // Opsi pertama selalu inisiatif sendiri, opsi kedua selalu disuruh.
  field?.options?.[0] === label ? "mandiri" : label ? "disuruh" : "";

const initiativeLabel = (
  field: HabitFormField | undefined,
  value: Entry["initiative"],
) =>
  (value === "mandiri"
    ? field?.options?.[0]
    : value === "disuruh"
      ? field?.options?.[1]
      : undefined) ?? "";

const parseMulti = (value: string): string[] => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value ? [value] : [];
  }
};

const buildHabitSummary = (
  slug: HabitId,
  catalog: CatalogHabit[],
  completedSlugs: Set<HabitId>,
): HabitSummary => {
  const base = HABIT_PRESENTATION.find((item) => item.id === slug)!;
  const remote = catalog.find((item) => item.slug === slug);
  return {
    ...base,
    pointsAwarded: remote?.points || base.pointsAwarded,
    completed: completedSlugs.has(slug),
  };
};

// habit_summary_today bisa berupa array atau objek per kode kebiasaan.
const completedFromSummary = (
  summary: unknown,
  catalog: CatalogHabit[],
): Set<HabitId> => {
  const done = new Set<HabitId>();
  const flagKeys = [
    "submitted",
    "is_submitted",
    "completed",
    "is_completed",
    "done",
    "filled",
  ];

  const consider = (item: Rec, fallbackCode?: string) => {
    const habitRec = asRec(item.habit);
    const id = toStr(pick(item, "habit_id") ?? habitRec.id);
    const code = toStr(
      pick(item, "code", "habit_code") ?? habitRec.code ?? fallbackCode,
    );
    const slug =
      HABIT_SLUG_BY_CODE[code] ??
      catalog.find((habit) => habit.id === id)?.slug;
    if (!slug) return;
    const flag = flagKeys
      .map((key) => item[key])
      .find((v) => typeof v === "boolean");
    if (flag ?? true) done.add(slug);
  };

  if (Array.isArray(summary)) {
    summary.forEach((item) => consider(asRec(item)));
  } else {
    const rec = asRec(summary);
    const nested = toList(rec.habits ?? rec.items ?? rec.entries);
    if (nested.length) nested.forEach((item) => consider(item));
    else
      Object.entries(rec).forEach(([code, value]) => {
        if (!HABIT_SLUG_BY_CODE[code]) return;
        if (typeof value === "boolean") {
          if (value) done.add(HABIT_SLUG_BY_CODE[code]);
        } else consider(asRec(value), code);
      });
  }
  return done;
};

// gamification_level / gamification/me bisa berupa angka, atau objek dengan
// level bersarang ({ level: { level, name } }) maupun datar ({ level, name }).
const extractLevel = (raw: unknown) => {
  if (typeof raw === "number")
    return { level: raw, label: `Level ${raw}`, exp: 0 };

  const rec = asRec(raw);
  const nested = asRec(rec.level);
  const hasNested = Object.keys(nested).length > 0;
  const source = hasNested ? nested : rec;
  const level = toNum(
    hasNested
      ? pick(nested, "level", "id", "order")
      : pick(rec, "level", "current_level", "level_number", "id"),
  );
  const label =
    toStr(pick(source, "name", "label", "title")) ||
    (level ? `Level ${level}` : "");
  const exp = toNum(pick(rec, "exp", "total_exp", "xp", "total_xp"));
  return { level, label, exp };
};

const extractPoints = (raw: unknown): number =>
  typeof raw === "number" || typeof raw === "string"
    ? toNum(raw)
    : toNum(pick(raw, "total", "total_points", "points", "poin"));

const buildStudentSummary = (
  user: AuthenticatedUser,
  points: number,
  levelSource: unknown,
  rank = 0,
): StudentSummary => {
  const level = extractLevel(levelSource);
  return {
    id: user.id,
    name: user.name,
    nisn: user.nisn ?? "-",
    // Backend belum mengirim rombel & foto siswa (tugas backend #7);
    // bila sudah ada di /auth/me, otomatis terisi.
    className: user.rombelName ?? "-",
    schoolName: user.schoolName ?? "-",
    avatarUrl: avatarByGender(user.gender, user.avatarUrl),
    points,
    exp: level.exp || points,
    level: level.level,
    levelLabel: level.label,
    rank,
    rankScope: "class",
    // Poin mingguan tidak dikirim backend.
    weeklyPoints: [],
  };
};

// GET /rankings/* mengirim per baris: { student_id, name, rombel (teks), poin, level }.
// Tidak ada field rank: urutan baris = peringkat (sudah diurutkan poin turun).
const mapRankingEntries = (
  rows: Rec[],
  fallbackClass: string,
): LeaderboardEntry[] =>
  rows.map((raw, index): LeaderboardEntry => {
    const student = asRec(raw.student);
    const rombelRaw = raw.rombel;
    const rombelName =
      typeof rombelRaw === "string"
        ? rombelRaw
        : toStr(pick(asRec(rombelRaw), "name") ?? pick(raw, "rombel_name"));
    return {
      rank: toNum(pick(raw, "rank", "position", "peringkat"), index + 1),
      studentId: toStr(pick(raw, "student_id") ?? student.id ?? raw.id),
      name: toStr(pick(raw, "name", "student_name") ?? student.name),
      className: rombelName || fallbackClass,
      avatarUrl: avatarByGender(
        toStr(pick(raw, "gender") ?? student.gender),
        undefined, // foto terproteksi: lihat catatan di authApi.mapMeUser
      ),
      points: toNum(pick(raw, "poin", "points", "total_points", "score")),
      level: extractLevel(pick(raw, "level", "gamification_level")).level,
    };
  });

// Ranking dipaginasi (default 20 baris). Ambil semua halaman supaya posisi
// siswa yang login tetap ketemu walau di luar 20 besar.
const RANKING_PER_PAGE = 100;
const RANKING_MAX_PAGES = 10;
const fetchAllRankingRows = async (endpoint: string): Promise<Rec[]> => {
  const rows: Rec[] = [];
  for (let page = 1; page <= RANKING_MAX_PAGES; page += 1) {
    const { data, meta } = await apiRequest<unknown>(endpoint, {
      query: { page, per_page: RANKING_PER_PAGE },
    });
    rows.push(...toList(data, "rankings", "entries"));
    if (!meta?.total_pages || page >= meta.total_pages) break;
  }
  return rows;
};

/* ---------------------------------- API ---------------------------------- */

export const realStudentDashboardApi: StudentDashboardApi = {
  async getDashboard() {
    const [dashboardRes, user, catalog, entries] = await Promise.all([
      apiRequest<unknown>(ENDPOINTS.dashboard),
      fetchCurrentUserApi(),
      getCatalog(),
      // Sumber status "sudah diisi": habit_summary_today dari backend hanya
      // berisi jumlah ({submitted, total}), bukan daftar per kebiasaan.
      getEntriesByDate(getLocalDateKey()).catch((error) => {
        if (error instanceof ApiError && error.status === 401) throw error;
        return [] as Entry[];
      }),
    ]);

    const dashboard = asRec(dashboardRes.data);
    const todayKey = getLocalDateKey();

    const completed = completedFromSummary(
      dashboard.habit_summary_today,
      catalog,
    );
    entries
      .filter((entry) => entry.dateKey === todayKey && entry.slug)
      .forEach((entry) => completed.add(entry.slug as HabitId));

    const completedCount = HABIT_PRESENTATION.filter((habit) =>
      completed.has(habit.id),
    ).length;

    const student = buildStudentSummary(
      user,
      extractPoints(dashboard.poin),
      dashboard.gamification_level,
    );

    return {
      student,
      dateLabel: formatIndonesianDate(todayKey),
      greeting: `Halo, ${student.name}!`,
      encouragement: "Silahkan isi 7 Kebiasaan Anak Indonesia Hebat hari ini.",
      positiveMessage: `${completedCount} dari ${TOTAL_HABITS} kebiasaan tercatat hari ini. Setiap langkah kecil sangat berharga.`,
      habits: HABIT_PRESENTATION.map((habit) =>
        buildHabitSummary(habit.id, catalog, completed),
      ),
    };
  },

  async getHabitForm(habitId) {
    const [catalog, entries] = await Promise.all([
      getCatalog(),
      getEntriesByDate(getLocalDateKey()).catch((error) => {
        if (error instanceof ApiError && error.status === 401) throw error;
        return [] as Entry[];
      }),
    ]);
    const habit = findHabit(catalog, habitId);
    const staticFields = fieldsByHabit[habitId];
    const [indicatorField, initiativeField, noteField] = staticFields;

    // Opsi indikator diambil dari backend; teks statis hanya cadangan.
    const indicatorOptions = habit.indicators.map((item) => item.label);
    const fields: HabitFormField[] = [
      {
        ...indicatorField,
        kind: habit.allowsMultiSelect ? "multichoice" : "choice",
        options: indicatorOptions.length
          ? indicatorOptions
          : indicatorField.options,
      },
      initiativeField,
      noteField,
    ];

    const today = entries.find(
      (entry) => entry.slug === habitId && entry.dateKey === getLocalDateKey(),
    );
    const todaysEntries = entries.filter(
      (entry) => entry.slug === habitId && entry.dateKey === getLocalDateKey(),
    );
    const submittedValue = today
      ? {
          [indicatorField.id]: habit.allowsMultiSelect
            ? JSON.stringify([
                ...new Set(
                  todaysEntries.flatMap((entry) => entry.indicatorLabels),
                ),
              ])
            : today.indicatorLabel,
          initiative: initiativeLabel(initiativeField, today.initiative),
          note: today.note,
        }
      : undefined;

    return {
      habit: buildHabitSummary(
        habitId,
        catalog,
        today ? new Set([habitId]) : new Set(),
      ),
      fields,
      locked: Boolean(today),
      submittedValue,
      guideHtml: habit.guideHtml,
    };
  },

  async submitHabit(payload: SubmitHabitRequest) {
    const catalog = await getCatalog();
    const habit = findHabit(catalog, payload.habitId);
    const [indicatorField, initiativeField] = fieldsByHabit[payload.habitId];

    // Bermasyarakat memakai indicator_ids (array, min. 1, tanpa duplikat);
    // 6 kebiasaan lain memakai indicator_id tunggal.
    const isCommunity = payload.habitId === "community";
    const sendsArray = isCommunity || habit.allowsMultiSelect;
    const selectedLabels = [
      ...new Set(
        habit.allowsMultiSelect
          ? parseMulti(payload.values[indicatorField.id] ?? "")
          : [payload.values[indicatorField.id] ?? ""],
      ),
    ].filter(Boolean);
    if (selectedLabels.length === 0)
      throw new Error("Pilih minimal satu indikator.");
    const indicatorIds = selectedLabels.map((label) => {
      const indicator = habit.indicators.find((item) => item.label === label);
      if (!indicator)
        throw new Error(
          "Pilihan indikator tidak dikenali. Muat ulang halaman lalu coba lagi.",
        );
      return Number(indicator.id);
    });

    const initiative = initiativeValue(
      initiativeField,
      payload.values.initiative ?? "",
    );
    const note = (payload.values.note ?? "").trim();
    // Backend mewajibkan initiative (mandiri | disuruh).
    if (!initiative) throw new Error("Pilih inisiatif terlebih dahulu.");

    // Hanya field yang diterima backend; `description` ditolak 422.
    const body: Record<string, unknown> = sendsArray
      ? { indicator_ids: indicatorIds }
      : { indicator_id: indicatorIds[0] };
    body.initiative = initiative;
    if (note) body.note = note;

    const path = isCommunity
      ? ENDPOINTS.communityEntry
      : ENDPOINTS.habitEntry(habit.id);

    try {
      const { data } = await apiRequest<unknown>(path, {
        method: "POST",
        body,
      });
      invalidateEntries();

      const awarded = toNum(
        pick(data, "poin_awarded", "points_awarded", "points") ??
          pick(asRec(asRec(data).indicator), "points"),
        selectedLabels.reduce(
          (sum, label) =>
            sum +
            (habit.indicators.find((item) => item.label === label)?.points ??
              0),
          0,
        ),
      );
      const title = HABIT_PRESENTATION.find(
        (item) => item.id === payload.habitId,
      )?.title;
      return {
        success: true,
        message: `${title} berhasil disimpan hari ini.`,
        completedAt: new Date().toISOString(),
        pointsAwarded: awarded,
        expAwarded: toNum(pick(data, "exp_awarded", "exp")),
        locked: true,
      };
    } catch (error) {
      // Kebiasaan yang sama sudah dicatat hari ini -> kunci formnya.
      if (error instanceof ApiError && error.status === 409) {
        invalidateEntries();
        return {
          success: false,
          message: error.message,
          completedAt: new Date().toISOString(),
          pointsAwarded: 0,
          expAwarded: 0,
          locked: true,
        };
      }
      throw error;
    }
  },

  async getRecap(dateKey = getLocalDateKey()) {
    const entries = await getEntriesByDate(dateKey);
    const items: RecapItem[] = entries
      .filter((entry) => entry.dateKey === dateKey && entry.slug)
      .map((entry) => {
        const slug = entry.slug as HabitId;
        const presentation = HABIT_PRESENTATION.find(
          (item) => item.id === slug,
        )!;
        const initiativeField = fieldsByHabit[slug][1];
        return {
          id: entry.id,
          habitId: slug,
          title: presentation.title,
          category: HABIT_CATEGORY[slug],
          dateKey: entry.dateKey,
          dateLabel: formatIndonesianDate(entry.dateKey),
          choice: entry.indicatorLabel || "-",
          initiative:
            initiativeLabel(initiativeField, entry.initiative).toLowerCase() ||
            "-",
          note: entry.note || "Tidak ada",
          pointsAwarded: entry.points,
          completed: true,
        };
      });

    return {
      dateKey,
      dateLabel: formatIndonesianDate(dateKey),
      totalActivities: items.length,
      items,
    };
  },

  async getLeaderboard(scope: LeaderboardScope = "class") {
    const [rows, user, gamification] = await Promise.all([
      fetchAllRankingRows(ENDPOINTS.rankings[scope]),
      fetchCurrentUserApi(),
      // id login = users.id, sedangkan ranking memakai students.id;
      // student_id yang benar ada di GET /gamification/me.
      apiRequest<unknown>(ENDPOINTS.gamification).catch(() => null),
    ]);
    const fallbackClass = user.rombelName ?? "";
    const entries = mapRankingEntries(rows, fallbackClass);

    const myStudentId = toStr(pick(gamification?.data, "student_id"));
    const mine =
      (myStudentId
        ? entries.find((entry) => entry.studentId === myStudentId)
        : undefined) ??
      (user.name
        ? entries.find((entry) => entry.name === user.name)
        : undefined);

    // Nama rombel diambil dari ranking sendiri (satu rombel untuk scope class).
    const ownClass = mine?.className || fallbackClass;

    return {
      scope,
      classLabel:
        scope === "class"
          ? ownClass
            ? `Kelas ${ownClass}`
            : "Rombel Saya"
          : "Satu Angkatan",
      // Backend belum mengirim label tahun ajaran di ranking.
      academicYear: "",
      currentStudentRank: mine?.rank ?? 0,
      entries,
    };
  },

  async getProfile() {
    const [user, gamification] = await Promise.all([
      fetchCurrentUserApi(),
      apiRequest<unknown>(ENDPOINTS.gamification),
    ]);
    const gData = gamification.data;
    const level = pick(gData, "gamification_level", "level_info") ?? gData;
    return {
      student: buildStudentSummary(
        user,
        extractPoints(pick(gData, "points", "total_points", "poin") ?? gData),
        level,
      ),
    };
  },
};
