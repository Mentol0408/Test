export type LeaderboardPeriod = 'all' | 'season';

export type LeaderboardPlayerEntry = {
  rank: number;
  steamId: string;
  name: string;
  avatarUrl?: string | null;
  villageTag?: string | null;
  totalPoints: number;
  wipesPlayed: number;
  wins: number;
  topThree: number;
  bestPoints: number;
  averagePoints: number;
  totalKills?: number;
  totalRaids?: number;
  totalFarm?: number;
  totalLoot?: number;
  totalBuild?: number;
  totalPlaytimeMinutes?: number;
  lastWipeAt?: string | null;
};

export type LeaderboardVillageEntry = {
  rank: number;
  villageId: string;
  name: string;
  leaderSteamId?: string | null;
  leaderName?: string | null;
  deputySteamId?: string | null;
  deputyName?: string | null;
  imageUrl?: string | null;
  totalPoints: number;
  wipesPlayed: number;
  wins: number;
  topThree: number;
  bestPoints: number;
  averagePoints: number;
  membersCount: number;
  totalKills?: number;
  totalRaids?: number;
  totalFarm?: number;
  totalBuild?: number;
  totalPlaytimeMinutes?: number;
  lastWipeAt?: string | null;
};

export type HallOfFamePayload = {
  period: LeaderboardPeriod;
  season?: string | null;
  players: LeaderboardPlayerEntry[];
  villages: LeaderboardVillageEntry[];
  me?: LeaderboardPlayerEntry | null;
};
