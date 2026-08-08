import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";

export function CampusBanner() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dismissing, setDismissing] = useState(false);
  const [localDismiss, setLocalDismiss] = useState(false);

  const { data: me } = useQuery<any>({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then((r) => r.json()),
    enabled: !!user,
  });

  if (!me || me.campusVerified || me.dismissedCampusPrompt || localDismiss) {
    return null;
  }

  const handleNotStudent = async () => {
    setDismissing(true);
    try {
      await apiRequest("POST", "/api/campus/dismiss-prompt");
      setLocalDismiss(true);
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err) {
      console.error("Failed to dismiss campus prompt:", err);
      setDismissing(false);
    }
  };

  return (
    <div
      className="mb-8 flex flex-col gap-5 rounded-3xl border border-black/8 bg-[#F5F6F8] p-6 md:flex-row md:items-center md:justify-between"
      data-testid="banner-campus"
    >
      <div className="max-w-lg">
        <h2 className="text-[22px] font-bold text-black">Are you a student?</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-black/60">
          Unlock exclusive campus events, verified student communities, and connect with classmates seamlessly.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <button
            className="rounded-full px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
            style={{ background: "#35A8F7" }}
            onClick={() => alert("Campus verification is coming soon!")}
            data-testid="button-join-campus"
          >
            Join a campus
          </button>
          <button
            onClick={handleNotStudent}
            disabled={dismissing}
            className="rounded-full border border-black/15 px-5 py-2.5 text-[13px] font-semibold text-black/70 transition hover:bg-black/5 disabled:opacity-50"
            data-testid="button-not-student"
          >
            I'm not a student
          </button>
        </div>
      </div>

      <button
        onClick={() => alert("Campus discovery is coming soon!")}
        className="flex shrink-0 items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 text-left shadow-sm transition hover:shadow-md md:w-64"
        data-testid="button-discover-campus"
      >
        <span className="text-[14px] font-semibold text-[#35A8F7]">Discover your campus</span>
        <GraduationCap className="h-9 w-9 shrink-0 text-black/10" strokeWidth={1.5} />
      </button>
    </div>
  );
}
