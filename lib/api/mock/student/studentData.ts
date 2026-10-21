import type { StudentDashboardResponse } from "@/lib/types/studentDashboard";
import { HABIT_PRESENTATION } from "@/lib/constants/habitPresentation";

export const student = {
  id: "student-001",
  name: "Syifa",
  nisn: "0987654321",
  className: "B1",
  schoolName: "TK Baiturrahman 3",
  avatarUrl: "/assets/student/girl-avatar.png",
  points: 1620,
  exp: 1520,
  level: 4,
  levelLabel: "Hebat",
  rank: 1,
  rankScope: "class" as const,
  weeklyPoints: [250, 280, 220, 310, 260, 300, 0],
};

export const habits: StudentDashboardResponse["habits"] = HABIT_PRESENTATION;
