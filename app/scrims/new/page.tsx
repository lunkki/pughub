"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ScrimNewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function createScrim() {
    setLoading(true);

    const res = await fetch("/api/scrims/create", {
      method: "POST",
    });

    const data = await res.json();

    if (data.code) {
      router.push(`/scrims/${data.code}`);
    } else {
      alert("Failed to create scrim");
    }

    setLoading(false);
  }

  return (
    <div className="p-10 text-slate-50">
      <h1 className="text-2xl font-bold mb-4">Start a New Scrim</h1>
      <p className="mb-6 text-slate-300">
        Create a new lobby and invite your friends.
      </p>

      <button
        onClick={createScrim}
        disabled={loading}
        className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900"
      >
        {loading ? "Creating..." : "Create Scrim"}
      </button>
    </div>
  );
}
