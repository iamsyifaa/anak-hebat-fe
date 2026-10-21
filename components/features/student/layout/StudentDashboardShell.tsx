"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { getAccessToken } from "@/lib/api/client";
import { envConfig } from "@/lib/config/envConfig";
import { restoreSession } from "@/redux/features/auth/authSlice";
import type { AppDispatch, RootState } from "@/redux/store";
import StudentDashboardHeader from "./StudentDashboardHeader";
import StudentMobileNav from "./StudentMobileNav";
import StudentSidebar from "./StudentSidebar";

interface Props {
  children: ReactNode;
  headerMode?: "greeting" | "profile-only" | "hidden";
}

function StudentDashboardShell({ children, headerMode = "greeting" }: Props) {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);
  const displayName = user?.name ?? "Siswa";
  const avatar = user?.avatarUrl ?? "/assets/student/girl-avatar.png";

  // Guard sesi (hanya saat memakai backend asli): tanpa token kembali ke
  // login; setelah refresh, data user dipulihkan dari GET /auth/me.
  useEffect(() => {
    if (envConfig.useMockApi) return;
    if (!getAccessToken()) {
      router.replace("/");
      return;
    }
    if (!user) void dispatch(restoreSession());
  }, [dispatch, router, user]);

  return (
    <div className="min-h-screen bg-[#EEF3F8] text-[#17204E] lg:h-screen lg:overflow-hidden">
      <StudentSidebar />

      <div className="flex min-h-screen flex-col lg:ml-[228px] lg:h-screen lg:min-h-0">
        <StudentDashboardHeader
          mode={headerMode}
          displayName={displayName}
          avatar={avatar}
        />

        <main className="min-h-0 flex-1 overflow-visible overscroll-contain px-3 pb-24 pt-3 touch-pan-y sm:px-6 sm:pb-10 sm:pt-5 lg:overflow-y-auto lg:px-9 lg:py-6">
          <div className="mx-auto w-full max-w-[1350px]">{children}</div>
        </main>
      </div>

      <StudentMobileNav />
    </div>
  );
}

export default StudentDashboardShell;
