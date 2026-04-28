"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WorkflowPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/campaigns");
  }, [router]);

  return <div className="p-6 text-sm text-gray-500">Đang chuyển hướng...</div>;
}
