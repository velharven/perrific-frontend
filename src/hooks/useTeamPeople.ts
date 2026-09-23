import { useState, useEffect } from 'react';
import { useAuth } from '@/store/auth';
import { teamApi } from '@/api/teams';
import { TEAMS_CHANGED_EVENT } from '@/hooks/useNavLabels';
import type { Team } from '@/types';

export interface TeamPerson {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isMe?: boolean;
}

let cachedTeams: Team[] | null = null;
let fetchPromise: Promise<Team[]> | null = null;

export function useTeamPeople() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>(cachedTeams ?? []);
  const [loading, setLoading] = useState(!cachedTeams);

  useEffect(() => {
    let cancelled = false;

    const loadTeams = () => {
      if (cachedTeams) {
        if (!cancelled) {
          setTeams(cachedTeams);
          setLoading(false);
        }
        return;
      }

      if (!fetchPromise) {
        fetchPromise = teamApi
          .listMyTeams()
          .then((res) => {
            cachedTeams = res;
            fetchPromise = null;
            return res;
          })
          .catch((err) => {
            fetchPromise = null;
            throw err;
          });
      }

      fetchPromise
        .then((res) => {
          if (!cancelled) {
            setTeams(res);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setTeams([]);
            setLoading(false);
          }
        });
    };

    loadTeams();

    const handleTeamsChanged = () => {
      cachedTeams = null;
      fetchPromise = null;
      loadTeams();
    };

    window.addEventListener(TEAMS_CHANGED_EVENT, handleTeamsChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(TEAMS_CHANGED_EVENT, handleTeamsChanged);
    };
  }, []);

  // Deduplikasi anggota tim:
  // 1. Diri sendiri selalu paling atas
  // 2. Anggota dari semua tim (unik/deduplikasi jika 1 orang join beberapa tim dengan saya)
  const people: TeamPerson[] = [];
  const seenUserIds = new Set<string>();

  if (user) {
    seenUserIds.add(user.id);
    people.push({
      id: user.id,
      name: user.name || 'Saya',
      avatarUrl: user.avatarUrl,
      isMe: true,
    });
  }

  for (const team of teams) {
    for (const member of team.members ?? []) {
      if (!member.userId || seenUserIds.has(member.userId)) continue;
      seenUserIds.add(member.userId);
      people.push({
        id: member.userId,
        name: member.user?.name || 'Anggota',
        avatarUrl: member.user?.avatarUrl,
        isMe: false,
      });
    }
  }

  return { people, loading, currentUser: user };
}
