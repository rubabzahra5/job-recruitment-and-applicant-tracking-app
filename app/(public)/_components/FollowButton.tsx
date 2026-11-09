"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { UserCheck, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { toggleFollow } from "../feed/_actions";

/**
 * Follow / Following toggle for a person (/people/[id]) or a company
 * (/companies/[slug]) — migration 0016. Rendered by the server pages only
 * when the follows data layer reports ready, so it simply doesn't exist
 * before the migration runs (fail-soft). Signed-out visitors get a login
 * link styled the same way.
 */
export interface FollowButtonProps {
  profileId?: string | null;
  orgId?: string | null;
  signedIn: boolean;
  initialFollowing: boolean;
  followerCount: number;
  /** Shown for person profiles; companies pass null (orgs don't follow). */
  followingCount?: number | null;
}

export function FollowButton({
  profileId = null,
  orgId = null,
  signedIn,
  initialFollowing,
  followerCount,
  followingCount = null,
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(followerCount);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const counts = (
    <p className="text-sm text-slate-600">
      <span className="font-semibold text-slate-900">{count}</span>{" "}
      follower{count === 1 ? "" : "s"}
      {followingCount !== null && (
        <>
          {" · "}
          <span className="font-semibold text-slate-900">{followingCount}</span> following
        </>
      )}
    </p>
  );

  if (!signedIn) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/login"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-600 px-3.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Follow
        </Link>
        {counts}
      </div>
    );
  }

  const onToggle = () => {
    setError(null);
    const wasFollowing = following;
    // Optimistic update; rolled back when the action fails.
    setFollowing(!wasFollowing);
    setCount((c) => Math.max(0, c + (wasFollowing ? -1 : 1)));
    startTransition(async () => {
      const res = await toggleFollow({ profileId, orgId });
      if (!res.ok) {
        setFollowing(wasFollowing);
        setCount((c) => Math.max(0, c + (wasFollowing ? 1 : -1)));
        setError(res.error ?? "Could not update your follow.");
        return;
      }
      setFollowing(res.following ?? !wasFollowing);
      if (typeof res.followerCount === "number") setCount(res.followerCount);
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant={following ? "secondary" : "primary"}
          onClick={onToggle}
          isLoading={isPending}
          aria-pressed={following}
          className="h-9"
        >
          {following ? (
            <>
              <UserCheck className="h-4 w-4" aria-hidden="true" /> Following
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" aria-hidden="true" /> Follow
            </>
          )}
        </Button>
        {counts}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
