"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function AdminRedirect() {
  const router = useRouter();
  const { user, loading } = useAuth();
  useEffect(() => {
    if (!loading) {
      if (!user) router.push("/login");
      else if (user.role !== "ADMIN") router.push("/dashboard");
      else router.push("/admin/users");
    }
  }, [user, loading, router]);
  return <div className="min-h-screen grid place-items-center text-sm text-muted">Mengalihkan...</div>;
}
