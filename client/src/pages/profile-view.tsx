import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";

type SharedBubble = { id: string; title: string; coverImage: string | null; category: string };
type PublicProfile = {
  id: string;
  name: string;
  profilePhoto: string | null;
  aboutMe: string | null;
  interests: string[];
  sharedBubbles: SharedBubble[];
};

function getInitials(name: string): string {
  return (
    name
      .split(" ")
      .filter((n) => n.length > 0)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"
  );
}

export default function ProfileView() {
  const { userId } = useParams<{ userId: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isOwnProfile = !!user && String(user.id) === String(userId);

  const { data: profile, isLoading, isError } = useQuery<PublicProfile>({
    queryKey: [`/api/users/${userId}/profile`],
    queryFn: () => apiRequest("GET", `/api/users/${userId}/profile`).then((r) => r.json()),
    enabled: !!userId && !!user,
  });

  const message = () => {
    if (!profile) return;
    navigate(
      `/messages?dmUid=${encodeURIComponent(profile.id)}&dmName=${encodeURIComponent(profile.name)}&dmAvatar=${encodeURIComponent(profile.profilePhoto ?? "")}`,
    );
  };

  return (
    <AppShell active="profile">
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4 md:pb-8">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => window.history.length > 1 ? window.history.back() : navigate("/explore")}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/70 ring-1 ring-black/5 text-foreground/70 shadow-sm"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-[20px] font-bold tracking-tight">Profile</h1>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-[13px] text-muted-foreground" data-testid="loading-profile-view">
            Loading…
          </div>
        ) : isError || !profile ? (
          <div className="py-16 text-center text-[13px] text-muted-foreground" data-testid="error-profile-view">
            Could not load this profile.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center rounded-2xl bg-white/60 p-6 text-center ring-1 ring-black/5">
              {profile.profilePhoto ? (
                <img
                  src={profile.profilePhoto}
                  alt=""
                  className="h-20 w-20 rounded-full object-cover"
                  data-testid="img-profile-view-avatar"
                />
              ) : (
                <div
                  className="grid h-20 w-20 place-items-center rounded-full text-[20px] font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #35A8F7, #6C63FF)" }}
                  data-testid="avatar-profile-view-initials"
                >
                  {getInitials(profile.name)}
                </div>
              )}
              <div className="mt-3 text-[17px] font-bold" data-testid="text-profile-view-name">
                {profile.name}
              </div>
              <p
                className="mt-2 text-[13px] leading-relaxed text-muted-foreground"
                data-testid="text-profile-view-about"
              >
                {profile.aboutMe || "No bio yet"}
              </p>

              {!isOwnProfile && (
                <button
                  onClick={message}
                  className="mt-4 flex h-10 items-center gap-2 rounded-full px-5 text-[13px] font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, #35A8F7, #6C63FF)" }}
                  data-testid="button-message-member"
                >
                  <MessageCircle className="h-4 w-4" />
                  Message
                </button>
              )}
            </div>

            {profile.interests.length > 0 && (
              <div className="rounded-2xl bg-white/60 p-5 ring-1 ring-black/5">
                <div className="mb-3 text-[13px] font-semibold">Interests</div>
                <div className="flex flex-wrap gap-2" data-testid="list-profile-view-interests">
                  {profile.interests.map((i) => (
                    <span
                      key={i}
                      className="rounded-full bg-[#35A8F7]/10 px-3 py-1.5 text-[12px] font-semibold text-[#35A8F7]"
                      data-testid={`tag-interest-${i}`}
                    >
                      {i}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profile.sharedBubbles.length > 0 && (
              <div className="rounded-2xl bg-white/60 p-5 ring-1 ring-black/5">
                <div className="mb-3 text-[13px] font-semibold">Bubbles in Common</div>
                <div className="space-y-2">
                  {profile.sharedBubbles.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => navigate(`/bubble/${b.id}`)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-black/5"
                      data-testid={`row-shared-bubble-${b.id}`}
                    >
                      {b.coverImage ? (
                        <img src={b.coverImage} alt="" className="h-11 w-11 rounded-xl object-cover" />
                      ) : (
                        <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#35A8F7]/10 text-[13px] font-bold text-[#35A8F7]">
                          {b.title.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold">{b.title}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{b.category}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
