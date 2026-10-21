import { envConfig } from "@/lib/config/envConfig";
import { ApiError, apiRequest } from "@/lib/api/client";
import { asRec, normalizeRole, pick, renameLegacyFields, toStr } from "@/lib/api/mappers";
import { isStudent } from "@/lib/utils/roleGuard";
import type {
  AuthenticatedUser,
  AuthResult,
  StudentPasswordLoginPayload,
} from "@/lib/types/authType";

const NOT_STUDENT_MESSAGE =
  "Akun ini bukan akun siswa. Gunakan aplikasi sesuai perannya.";

const mockUsers: Record<string, AuthenticatedUser> = {
  "student-qr-jaehyun": {
    id: "student-001",
    name: "Jaehyun",
    username: "jaehyun",
    role: "student",
    rombelId: "B1",
    schoolId: "school-001",
    avatarUrl: "/assets/student/boy-avatar.png",
  },
  "student-qr-syifa": {
    id: "student-002",
    name: "Syifa",
    username: "0095647260",
    role: "student",
    rombelId: "V-B",
    schoolId: "school-001",
    avatarUrl: "/assets/student/girl-avatar.png",
  },
  "student-qr-ahmad": {
    id: "student-003",
    name: "Ahmad R.",
    username: "ahmad",
    role: "student",
    rombelId: "V-B",
    schoolId: "school-001",
    avatarUrl: "/assets/student/boy-avatar.png",
  },
};

const DEFAULT_AVATAR = "/assets/student/girl-avatar.png";
const BOY_AVATAR = "/assets/student/boy-avatar.png";

export const avatarByGender = (gender?: string, explicit?: string): string => {
  if (explicit) return explicit;
  const g = (gender ?? "").toLowerCase();
  if (g.startsWith("l") || g === "male") return BOY_AVATAR;
  return DEFAULT_AVATAR;
};

// Bentuk user dari POST /auth/login/* : hanya id, role, name.
const mapLoginUser = (raw: unknown): AuthenticatedUser => {
  const rec = asRec(raw);
  return {
    id: toStr(rec.id),
    name: toStr(rec.name),
    role: normalizeRole(rec.role),
  };
};

// Bentuk user dari GET /auth/me: data tambahan (sekolah, nisn, rombel, foto).
// Semua field opsional karena backend belum mengirim rombel & foto siswa.
export const mapMeUser = (raw: unknown): AuthenticatedUser => {
  const root = asRec(raw);
  const me = renameLegacyFields(root.user ?? root);
  const school = asRec(me.school);
  const rombel = asRec(me.rombel ?? me.active_rombel);
  const student = asRec(me.student);
  const gender = toStr(pick(me, "gender") ?? pick(student, "gender"));

  return {
    id: toStr(me.id),
    name: toStr(me.name),
    role: normalizeRole(me.role),
    username: toStr(me.username) || undefined,
    nisn: toStr(pick(me, "nisn") ?? pick(student, "nisn")) || undefined,
    nip: toStr(pick(me, "nip")) || undefined,
    gender: gender || undefined,
    schoolId: toStr(pick(me, "school_id") ?? pick(school, "id")) || undefined,
    schoolName: toStr(pick(me, "school_name") ?? pick(school, "name")) || undefined,
    rombelId: toStr(pick(me, "rombel_id") ?? pick(rombel, "id")) || undefined,
    rombelName:
      toStr(pick(me, "rombel_name") ?? pick(rombel, "name")) || undefined,
    // `photo` dari backend adalah URL terproteksi (butuh header Authorization)
    // sehingga TIDAK boleh dipasang langsung di <img>. Sampai INTEG-ME-001
    // selesai dan pemuatan via fetch -> blob URL dibuat, avatar tetap bawaan.
    avatarUrl: undefined,
  };
};

// GET /auth/me. `token` opsional: dipakai tepat setelah login.
export const fetchCurrentUserApi = async (
  token?: string,
): Promise<AuthenticatedUser> => {
  const { data } = await apiRequest<unknown>("/auth/me", { token });
  return mapMeUser(data);
};

const finishLogin = async (
  data: unknown,
): Promise<AuthResult> => {
  const rec = asRec(data);
  const accessToken = toStr(rec.access_token);
  if (!accessToken)
    throw new ApiError(500, "INVALID_RESPONSE", "Respons login tidak berisi token.");

  const loginUser = mapLoginUser(rec.user);
  if (!isStudent(loginUser.role))
    throw new ApiError(403, "FORBIDDEN", NOT_STUDENT_MESSAGE);

  // Data tambahan dari /auth/me. Kalau gagal, login tetap lanjut dengan
  // data dasar supaya siswa tidak tertahan hanya karena profil gagal dimuat.
  try {
    const me = await fetchCurrentUserApi(accessToken);
    return { accessToken, user: { ...me, ...loginUser, name: loginUser.name || me.name } };
  } catch {
    return { accessToken, user: loginUser };
  }
};

export const loginWithPasswordApi = async ({
  nisn,
  password,
}: StudentPasswordLoginPayload): Promise<AuthResult> => {
  if (envConfig.useMockApi) {
    // Field & label tetap "Username"/"Password" di tampilan, tapi nilai
    // yang siswa masukkan di keduanya sama-sama NISN mereka.
    const username = nisn.trim().toLowerCase();
    const user = Object.values(mockUsers).find((item) => item.username === username);
    if (!user || password !== "0095647260")
      throw new ApiError(
        401,
        "UNAUTHENTICATED",
        "Username atau password demo salah. Gunakan NISN 0095647260 untuk keduanya.",
      );
    return { accessToken: `mock-access-${user.id}`, user };
  }

  const { data } = await apiRequest<unknown>("/auth/login/student/password", {
    method: "POST",
    body: { nisn, password },
    redirectOn401: false,
  });
  return finishLogin(data);
};

export const loginWithQrApi = async (qrPayload: string): Promise<AuthResult> => {
  if (envConfig.useMockApi) {
    const user = mockUsers[qrPayload.trim()];
    if (!user)
      throw new ApiError(
        400,
        "INVALID_QR",
        "Kode QR tidak valid atau sudah tidak aktif.",
      );
    return { accessToken: `mock-access-${user.id}`, user };
  }

  const { data } = await apiRequest<unknown>("/auth/login/student/qr", {
    method: "POST",
    body: { qr_payload: qrPayload },
    redirectOn401: false,
  });
  return finishLogin(data);
};
