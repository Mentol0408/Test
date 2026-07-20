export type SteamPlayerProfile = {
  steamId: string;
  name: string;
  avatar?: string | null;
};

type SteamPlayerSummary = {
  steamid?: string;
  personaname?: string;
  avatar?: string;
  avatarmedium?: string;
  avatarfull?: string;
};

const STEAM_SUMMARIES_BATCH_SIZE = 100;
const STEAM_PROFILE_XML_TIMEOUT_MS = 3500;

function normalizeSteamIds(steamIds: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      steamIds
        .map((steamId) => steamId?.trim())
        .filter((steamId): steamId is string => Boolean(steamId))
    )
  );
}

function readCdataTag(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${tagName}>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</${tagName}>`, 'i'));

  return match?.[1]?.trim() || '';
}

async function getSteamPlayerProfileFromXml(steamId: string): Promise<SteamPlayerProfile | null> {
  if (!/^\d{17}$/.test(steamId)) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STEAM_PROFILE_XML_TIMEOUT_MS);

  try {
    const response = await fetch(`https://steamcommunity.com/profiles/${steamId}/?xml=1`, {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const xml = await response.text();
    const name = readCdataTag(xml, 'steamID') || steamId;
    const avatar = readCdataTag(xml, 'avatarFull') || readCdataTag(xml, 'avatarMedium') || readCdataTag(xml, 'avatarIcon') || null;

    return {
      steamId,
      name,
      avatar,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fillMissingProfilesFromSteamCommunity(profiles: Record<string, SteamPlayerProfile>, steamIds: string[]) {
  const missingSteamIds = steamIds.filter((steamId) => !profiles[steamId]?.avatar);

  if (missingSteamIds.length === 0) {
    return profiles;
  }

  const fallbackProfiles = await Promise.all(missingSteamIds.map((steamId) => getSteamPlayerProfileFromXml(steamId)));

  fallbackProfiles.forEach((profile) => {
    if (profile) {
      profiles[profile.steamId] = profile;
    }
  });

  return profiles;
}

export async function getSteamPlayerProfiles(steamIds: Array<string | null | undefined>) {
  const key = process.env.STEAM_API_KEY?.trim();
  const normalizedSteamIds = normalizeSteamIds(steamIds);
  const profiles: Record<string, SteamPlayerProfile> = {};

  if (!key || normalizedSteamIds.length === 0) {
    return fillMissingProfilesFromSteamCommunity(profiles, normalizedSteamIds);
  }

  for (let index = 0; index < normalizedSteamIds.length; index += STEAM_SUMMARIES_BATCH_SIZE) {
    const batch = normalizedSteamIds.slice(index, index + STEAM_SUMMARIES_BATCH_SIZE);
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(key)}&steamids=${encodeURIComponent(batch.join(','))}`;

    try {
      const response = await fetch(url, { cache: 'no-store' });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const players = Array.isArray(data?.response?.players) ? data.response.players as SteamPlayerSummary[] : [];

      players.forEach((player) => {
        if (!player.steamid || !player.personaname) {
          return;
        }

        profiles[player.steamid] = {
          steamId: player.steamid,
          name: player.personaname,
          avatar: player.avatarfull || player.avatarmedium || player.avatar || null,
        };
      });
    } catch (error) {
      console.error('Failed to load Steam player profiles', error);
    }
  }

  return fillMissingProfilesFromSteamCommunity(profiles, normalizedSteamIds);
}
