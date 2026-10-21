// Role resmi mengikuti Dokumen Requirement ANAKTUMBUH v2 bagian 2
// (Super Admin, Headmaster, Teacher, Student).
export type UserRole = "super_admin" | "headmaster" | "teacher" | "student";

// Login hanya mengembalikan id, role, name. Sisanya (sekolah, nisn, rombel,
// foto) diisi dari GET /auth/me dan bisa kosong.
export interface AuthenticatedUser {
  id: string;
  name: string;
  role: UserRole;
  username?: string;
  nisn?: string;
  nip?: string;
  gender?: string;
  schoolId?: string;
  schoolName?: string;
  rombelId?: string;
  rombelName?: string;
  avatarUrl?: string;
}

export interface StudentPasswordLoginPayload {
  nisn: string;
  password: string;
}

export interface AuthResult {
  accessToken: string;
  user: AuthenticatedUser;
}
