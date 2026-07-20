const DISCORD_API_BASE_URL = 'https://discord.com/api/v10';

type DiscordConfig = {
  botToken: string;
  guildId: string;
  vipRoleId: string;
};

export type DiscordValidationResult = {
  ok: boolean;
  error?: string;
  status?: number;
};

export type DiscordRoleAssignmentResult = {
  ok: boolean;
  discordUserId: string;
  error?: string;
  status?: number;
};

function getDiscordConfig(): DiscordConfig | null {
  const botToken = process.env.DISCORD_BOT_TOKEN?.trim();
  const guildId = process.env.DISCORD_GUILD_ID?.trim();
  const vipRoleId = process.env.DISCORD_VIP_ROLE_ID?.trim();

  if (!botToken || !guildId || !vipRoleId) {
    return null;
  }

  return {
    botToken,
    guildId,
    vipRoleId,
  };
}

function buildDiscordHeaders(botToken: string) {
  return {
    Authorization: `Bot ${botToken}`,
    'Content-Type': 'application/json',
  };
}

export function isDiscordRoleConfigured() {
  return getDiscordConfig() !== null;
}

export function isValidDiscordUserId(value: string) {
  return /^\d{16,20}$/.test(value.trim());
}

export async function validateDiscordMember(discordUserId: string): Promise<DiscordValidationResult> {
  if (!isValidDiscordUserId(discordUserId)) {
    return { ok: false, error: 'INVALID_DISCORD_USER_ID' };
  }

  const config = getDiscordConfig();

  if (!config) {
    return { ok: false, error: 'DISCORD_NOT_CONFIGURED' };
  }

  try {
    const response = await fetch(
      `${DISCORD_API_BASE_URL}/guilds/${encodeURIComponent(config.guildId)}/members/${encodeURIComponent(discordUserId)}`,
      {
        method: 'GET',
        headers: buildDiscordHeaders(config.botToken),
      }
    );

    if (response.ok) {
      return { ok: true };
    }

    if (response.status === 404) {
      return { ok: false, error: 'DISCORD_MEMBER_NOT_FOUND', status: response.status };
    }

    return { ok: false, error: 'DISCORD_API_ERROR', status: response.status };
  } catch {
    return { ok: false, error: 'DISCORD_API_ERROR' };
  }
}

export async function assignVipDiscordRole(discordUserId: string): Promise<DiscordRoleAssignmentResult> {
  if (!isValidDiscordUserId(discordUserId)) {
    return { ok: false, discordUserId, error: 'INVALID_DISCORD_USER_ID' };
  }

  const config = getDiscordConfig();

  if (!config) {
    return { ok: false, discordUserId, error: 'DISCORD_NOT_CONFIGURED' };
  }

  try {
    const response = await fetch(
      `${DISCORD_API_BASE_URL}/guilds/${encodeURIComponent(config.guildId)}/members/${encodeURIComponent(discordUserId)}/roles/${encodeURIComponent(config.vipRoleId)}`,
      {
        method: 'PUT',
        headers: buildDiscordHeaders(config.botToken),
      }
    );

    if (response.ok) {
      return { ok: true, discordUserId };
    }

    if (response.status === 404) {
      return { ok: false, discordUserId, error: 'DISCORD_MEMBER_NOT_FOUND', status: response.status };
    }

    return { ok: false, discordUserId, error: 'DISCORD_ROLE_ASSIGNMENT_FAILED', status: response.status };
  } catch {
    return { ok: false, discordUserId, error: 'DISCORD_ROLE_ASSIGNMENT_FAILED' };
  }
}