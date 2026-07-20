export interface ServerStat {
  imageUrl: string;
  description: string;
  span?: string;
}

export interface ServerApiData {
  server_key: string;
  server_id: number;
  map_size?: number | null;
  team_limit?: number | null;
  last_wipe?: number | string | null;
  next_wipe?: number | string | null;
  opened_cases: number;
  online: number;
}

export interface Server {
  title: string;
  mode: string;
  rate: string;
  description: string;
  image: string;

  accentColor: string;
  textColor?: string;
  background: string;

  online: number | string;
  linkServer: string;
  connectCommand?: string;
  maintenance?: boolean;
  statusLabel?: string;

  stats: {
    icon: string;
    text: string;
    span?: string;
  }[];

  wipe: {
    icon: string;
    text: string;
    span?: string;
  }[];
}
