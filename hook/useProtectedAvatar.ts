"use client";

import { useEffect, useState } from "react";
import { fetchProtectedImage } from "@/lib/api/client";

// Foto siswa butuh header Authorization, jadi diambil lewat fetch lalu
// dijadikan blob URL. Selama memuat, atau bila photoUrl kosong/404/gagal,
// dipakai `fallback` (placeholder dari FE; backend tidak punya foto default).
export function useProtectedAvatar(photoUrl: string | undefined, fallback: string): string {
  const [loaded, setLoaded] = useState<{ source: string; blob: string } | null>(null);

  useEffect(() => {
    if (!photoUrl) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    fetchProtectedImage(photoUrl).then((blob) => {
      if (!blob) return;
      if (cancelled) {
        URL.revokeObjectURL(blob);
        return;
      }
      objectUrl = blob;
      setLoaded({ source: photoUrl, blob });
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoUrl]);

  return photoUrl && loaded?.source === photoUrl ? loaded.blob : fallback;
}
