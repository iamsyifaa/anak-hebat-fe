"use client";

import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { clearAccessToken } from "@/lib/api/client";
import { resetAuth } from "@/redux/features/auth/authSlice";
import OutlineButton from "@/components/ui/Button/OutlineButton";
import PrimaryButton from "@/components/ui/Button/PrimaryButton";

interface Props {
  onClose: () => void;
}

function LogoutModal({ onClose }: Props) {
  const dispatch = useDispatch<AppDispatch>();

  const handleConfirm = () => {
    clearAccessToken();
    dispatch(resetAuth());
    // Navigasi penuh (bukan router.replace) agar seluruh state Redux berisi
    // data siswa sebelumnya ikut hilang dan tidak terbaca siswa berikutnya.
    window.location.replace("/");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#232852]/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl">
        <h2 className="text-xl font-black text-[#232852]">Keluar dari akun?</h2>
        <p className="mt-1 text-base text-slate-500">
          Kamu perlu login ulang untuk mengisi kebiasaan lagi.
        </p>
        <div className="mt-5 flex gap-3">
          <OutlineButton label="Batal" onClick={onClose} />
          <PrimaryButton label="Keluar" onClick={handleConfirm} />
        </div>
      </div>
    </div>
  );
}

export default LogoutModal;
