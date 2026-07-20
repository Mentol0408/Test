import type { Pool, PoolClient } from 'pg';

import { importRwShopCatalog } from '@/lib/store/rwShopCatalogImport';

type Migration = {
    id: string;
    description: string;
    statements?: string[];
    run?: (client: PoolClient) => Promise<void>;
};

const MIGRATIONS: Migration[] = [
    {
        id: '001_core_tables',
        description: 'Create core purchases, balances, auth, and support tables',
        statements: [
            `CREATE TABLE IF NOT EXISTS purchases (
                id SERIAL PRIMARY KEY,
                user_id TEXT,
                server_key TEXT,
                item_type TEXT,
                amount INTEGER,
                status TEXT,
                meta JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            )`,
            `CREATE TABLE IF NOT EXISTS purchase_logs (
                id SERIAL PRIMARY KEY,
                purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
                server_key TEXT,
                event TEXT,
                meta JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            )`,
            `CREATE TABLE IF NOT EXISTS server_stats (
                id SERIAL PRIMARY KEY,
                server_key TEXT UNIQUE,
                server_id INTEGER,
                map_size INTEGER,
                last_wipe BIGINT,
                next_wipe BIGINT,
                opened_cases INTEGER,
                online INTEGER,
                meta JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            )`,
            `ALTER TABLE server_stats ADD COLUMN IF NOT EXISTS team_limit INTEGER`,
            `CREATE TABLE IF NOT EXISTS refresh_tokens (
                id SERIAL PRIMARY KEY,
                user_steamid TEXT NOT NULL,
                token_hash TEXT NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                revoked BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            )`,
            `CREATE TABLE IF NOT EXISTS user_balances (
                user_steamid TEXT PRIMARY KEY,
                balance INTEGER NOT NULL DEFAULT 0,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            )`,
            `CREATE TABLE IF NOT EXISTS balance_transactions (
                id SERIAL PRIMARY KEY,
                user_steamid TEXT NOT NULL,
                purchase_id INTEGER UNIQUE REFERENCES purchases(id) ON DELETE SET NULL,
                kind TEXT NOT NULL,
                amount INTEGER NOT NULL,
                meta JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            )`,
            `CREATE TABLE IF NOT EXISTS user_playtime_daily (
                user_steamid TEXT NOT NULL,
                server_key TEXT NOT NULL,
                activity_date DATE NOT NULL,
                tracked_minutes INTEGER NOT NULL DEFAULT 0,
                meta JSONB,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                PRIMARY KEY (user_steamid, server_key, activity_date)
            )`,
            `CREATE TABLE IF NOT EXISTS reward_claims (
                id SERIAL PRIMARY KEY,
                user_steamid TEXT NOT NULL,
                reward_kind TEXT NOT NULL,
                claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
                purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
                meta JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                UNIQUE (user_steamid, reward_kind, claim_date)
            )`,
            `CREATE TABLE IF NOT EXISTS discord_connections (
                user_steamid TEXT PRIMARY KEY,
                discord_user_id TEXT NOT NULL UNIQUE,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            )`,
            `CREATE TABLE IF NOT EXISTS support_tickets (
                id SERIAL PRIMARY KEY,
                user_steamid TEXT NOT NULL,
                subject TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'open',
                meta JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                closed_at TIMESTAMP WITH TIME ZONE
            )`,
            `CREATE TABLE IF NOT EXISTS support_ticket_messages (
                id SERIAL PRIMARY KEY,
                ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
                author_steamid TEXT NOT NULL,
                author_role TEXT NOT NULL,
                message TEXT NOT NULL,
                meta JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            )`,
            `CREATE INDEX IF NOT EXISTS support_tickets_user_steamid_idx ON support_tickets (user_steamid)`,
            `CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets (status)`,
            `CREATE INDEX IF NOT EXISTS support_tickets_last_message_at_idx ON support_tickets (last_message_at DESC)`,
            `CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_id_idx ON support_ticket_messages (ticket_id)`,
        ],
    },
    {
        id: '002_leaderboards_schema',
        description: 'Create leaderboard tables and backfill compatible columns',
        statements: [
            `CREATE TABLE IF NOT EXISTS leaderboard_wipes (
                id SERIAL PRIMARY KEY,
                server_key TEXT NOT NULL,
                wipe_key TEXT NOT NULL,
                season TEXT,
                wipe_started_at TIMESTAMP WITH TIME ZONE,
                wipe_ended_at TIMESTAMP WITH TIME ZONE,
                meta JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                UNIQUE (server_key, wipe_key)
            )`,
            `CREATE TABLE IF NOT EXISTS leaderboard_players (
                id SERIAL PRIMARY KEY,
                wipe_id INTEGER NOT NULL REFERENCES leaderboard_wipes(id) ON DELETE CASCADE,
                steam_id TEXT NOT NULL,
                name TEXT NOT NULL,
                avatar_url TEXT,
                points INTEGER NOT NULL DEFAULT 0,
                rank INTEGER,
                kills INTEGER,
                raids INTEGER,
                farm INTEGER,
                playtime_minutes INTEGER,
                meta JSONB,
                UNIQUE (wipe_id, steam_id)
            )`,
            `CREATE TABLE IF NOT EXISTS leaderboard_villages (
                id SERIAL PRIMARY KEY,
                wipe_id INTEGER NOT NULL REFERENCES leaderboard_wipes(id) ON DELETE CASCADE,
                village_id TEXT NOT NULL,
                name TEXT NOT NULL,
                leader_steam_id TEXT,
                leader_name TEXT,
                points INTEGER NOT NULL DEFAULT 0,
                rank INTEGER,
                members_count INTEGER,
                meta JSONB,
                UNIQUE (wipe_id, village_id)
            )`,
            `CREATE TABLE IF NOT EXISTS leaderboard_village_members (
                id SERIAL PRIMARY KEY,
                wipe_id INTEGER NOT NULL REFERENCES leaderboard_wipes(id) ON DELETE CASCADE,
                village_id TEXT NOT NULL,
                steam_id TEXT NOT NULL,
                player_name TEXT,
                role TEXT,
                meta JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                UNIQUE (wipe_id, village_id, steam_id)
            )`,
            `ALTER TABLE leaderboard_wipes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()`,
            `ALTER TABLE leaderboard_wipes ADD COLUMN IF NOT EXISTS meta JSONB`,
            `ALTER TABLE leaderboard_wipes ADD COLUMN IF NOT EXISTS wipe_started_at TIMESTAMP WITH TIME ZONE`,
            `ALTER TABLE leaderboard_wipes ADD COLUMN IF NOT EXISTS wipe_ended_at TIMESTAMP WITH TIME ZONE`,
            `ALTER TABLE leaderboard_players ADD COLUMN IF NOT EXISTS avatar_url TEXT`,
            `ALTER TABLE leaderboard_players ADD COLUMN IF NOT EXISTS raids INTEGER`,
            `ALTER TABLE leaderboard_players ADD COLUMN IF NOT EXISTS farm INTEGER`,
            `ALTER TABLE leaderboard_players ADD COLUMN IF NOT EXISTS playtime_minutes INTEGER`,
            `ALTER TABLE leaderboard_players ADD COLUMN IF NOT EXISTS loot INTEGER`,
            `ALTER TABLE leaderboard_players ADD COLUMN IF NOT EXISTS build INTEGER`,
            `ALTER TABLE leaderboard_players ADD COLUMN IF NOT EXISTS meta JSONB`,
            `ALTER TABLE leaderboard_villages ADD COLUMN IF NOT EXISTS leader_steam_id TEXT`,
            `ALTER TABLE leaderboard_villages ADD COLUMN IF NOT EXISTS leader_name TEXT`,
            `ALTER TABLE leaderboard_villages ADD COLUMN IF NOT EXISTS members_count INTEGER`,
            `ALTER TABLE leaderboard_villages ADD COLUMN IF NOT EXISTS meta JSONB`,
            `ALTER TABLE leaderboard_villages ADD COLUMN IF NOT EXISTS image_url TEXT`,
            `ALTER TABLE leaderboard_villages ADD COLUMN IF NOT EXISTS deputy_steam_id TEXT`,
            `ALTER TABLE leaderboard_villages ADD COLUMN IF NOT EXISTS deputy_name TEXT`,
            `ALTER TABLE leaderboard_villages ADD COLUMN IF NOT EXISTS kills INTEGER`,
            `ALTER TABLE leaderboard_villages ADD COLUMN IF NOT EXISTS raids INTEGER`,
            `ALTER TABLE leaderboard_villages ADD COLUMN IF NOT EXISTS farm INTEGER`,
            `ALTER TABLE leaderboard_villages ADD COLUMN IF NOT EXISTS playtime_minutes INTEGER`,
            `ALTER TABLE leaderboard_village_members ADD COLUMN IF NOT EXISTS wipe_id INTEGER REFERENCES leaderboard_wipes(id) ON DELETE CASCADE`,
            `ALTER TABLE leaderboard_village_members ADD COLUMN IF NOT EXISTS village_id TEXT`,
            `ALTER TABLE leaderboard_village_members ADD COLUMN IF NOT EXISTS player_name TEXT`,
            `ALTER TABLE leaderboard_village_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now()`,
            `ALTER TABLE leaderboard_village_members ADD COLUMN IF NOT EXISTS kills INTEGER`,
            `ALTER TABLE leaderboard_village_members ADD COLUMN IF NOT EXISTS raids INTEGER`,
            `ALTER TABLE leaderboard_village_members ADD COLUMN IF NOT EXISTS farm INTEGER`,
            `ALTER TABLE leaderboard_village_members ADD COLUMN IF NOT EXISTS build INTEGER`,
            `ALTER TABLE leaderboard_village_members ALTER COLUMN wipe_id DROP NOT NULL`,
            `ALTER TABLE leaderboard_village_members ALTER COLUMN village_id DROP NOT NULL`,
            `DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'leaderboard_village_members'
                      AND column_name = 'village_row_id'
                ) THEN
                    ALTER TABLE leaderboard_village_members ALTER COLUMN village_row_id DROP NOT NULL;

                    UPDATE leaderboard_village_members lvm
                    SET
                        wipe_id = COALESCE(lvm.wipe_id, lv.wipe_id),
                        village_id = COALESCE(lvm.village_id, lv.village_id)
                    FROM leaderboard_villages lv
                    WHERE lv.id = lvm.village_row_id
                      AND (lvm.wipe_id IS NULL OR lvm.village_id IS NULL);
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'leaderboard_village_members'
                      AND column_name = 'name'
                ) THEN
                    UPDATE leaderboard_village_members
                    SET player_name = COALESCE(player_name, name)
                    WHERE player_name IS NULL;
                END IF;
            END $$`,
            `CREATE INDEX IF NOT EXISTS leaderboard_wipes_period_idx ON leaderboard_wipes (season, wipe_ended_at DESC, created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS leaderboard_players_wipe_id_idx ON leaderboard_players (wipe_id)`,
            `CREATE INDEX IF NOT EXISTS leaderboard_villages_wipe_id_idx ON leaderboard_villages (wipe_id)`,
            `CREATE INDEX IF NOT EXISTS leaderboard_village_members_wipe_id_idx ON leaderboard_village_members (wipe_id)`,
            `CREATE INDEX IF NOT EXISTS leaderboard_village_members_steam_id_idx ON leaderboard_village_members (steam_id)`,
        ],
    },
    {
        id: '003_leaderboards_bigint_upgrade',
        description: 'Upgrade leaderboard stat columns to bigint safely',
        statements: [
            `DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'leaderboard_players'
                      AND column_name = 'farm'
                      AND data_type = 'integer'
                ) THEN
                    ALTER TABLE leaderboard_players ALTER COLUMN points TYPE BIGINT USING points::bigint;
                    ALTER TABLE leaderboard_players ALTER COLUMN kills TYPE BIGINT USING kills::bigint;
                    ALTER TABLE leaderboard_players ALTER COLUMN raids TYPE BIGINT USING raids::bigint;
                    ALTER TABLE leaderboard_players ALTER COLUMN farm TYPE BIGINT USING farm::bigint;
                    ALTER TABLE leaderboard_players ALTER COLUMN loot TYPE BIGINT USING loot::bigint;
                    ALTER TABLE leaderboard_players ALTER COLUMN build TYPE BIGINT USING build::bigint;
                    ALTER TABLE leaderboard_players ALTER COLUMN playtime_minutes TYPE BIGINT USING playtime_minutes::bigint;
                END IF;
            END $$`,
            `DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'leaderboard_villages'
                      AND column_name = 'points'
                      AND data_type = 'integer'
                ) THEN
                    ALTER TABLE leaderboard_villages ALTER COLUMN points TYPE BIGINT USING points::bigint;
                    ALTER TABLE leaderboard_villages ALTER COLUMN kills TYPE BIGINT USING kills::bigint;
                    ALTER TABLE leaderboard_villages ALTER COLUMN raids TYPE BIGINT USING raids::bigint;
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'leaderboard_villages'
                      AND column_name = 'farm'
                      AND data_type = 'integer'
                ) THEN
                    ALTER TABLE leaderboard_villages ALTER COLUMN farm TYPE BIGINT USING farm::bigint;
                    ALTER TABLE leaderboard_villages ALTER COLUMN playtime_minutes TYPE BIGINT USING playtime_minutes::bigint;
                END IF;
            END $$`,
            `DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'leaderboard_village_members'
                      AND column_name = 'farm'
                      AND data_type = 'integer'
                ) THEN
                    ALTER TABLE leaderboard_village_members ALTER COLUMN kills TYPE BIGINT USING kills::bigint;
                    ALTER TABLE leaderboard_village_members ALTER COLUMN raids TYPE BIGINT USING raids::bigint;
                    ALTER TABLE leaderboard_village_members ALTER COLUMN farm TYPE BIGINT USING farm::bigint;
                    ALTER TABLE leaderboard_village_members ALTER COLUMN build TYPE BIGINT USING build::bigint;
                END IF;
            END $$`,
        ],
    },
    {
        id: '004_store_catalog_schema',
        description: 'Create store catalog tables used by the website shop',
        statements: [
            `CREATE TABLE IF NOT EXISTS store_categories (
                id SERIAL PRIMARY KEY,
                slug TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0,
                is_active BOOLEAN NOT NULL DEFAULT true,
                is_default BOOLEAN NOT NULL DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            )`,
            `CREATE TABLE IF NOT EXISTS store_products (
                id SERIAL PRIMARY KEY,
                category_id INTEGER REFERENCES store_categories(id) ON DELETE SET NULL,
                slug TEXT,
                title TEXT NOT NULL,
                description TEXT,
                image_url TEXT,
                price INTEGER NOT NULL DEFAULT 0,
                old_price INTEGER,
                rarity TEXT,
                badge TEXT,
                amount INTEGER,
                delivery_type TEXT NOT NULL DEFAULT 'item',
                delivery_command TEXT NOT NULL DEFAULT '',
                servers JSONB NOT NULL DEFAULT '[]'::jsonb,
                features JSONB NOT NULL DEFAULT '[]'::jsonb,
                is_active BOOLEAN NOT NULL DEFAULT true,
                sort_order INTEGER NOT NULL DEFAULT 0,
                meta JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            )`,
            `CREATE INDEX IF NOT EXISTS store_products_category_id_idx ON store_products (category_id)`,
            `CREATE INDEX IF NOT EXISTS store_products_active_idx ON store_products (is_active)`,
            `ALTER TABLE store_categories ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false`,
            `ALTER TABLE store_products ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '[]'::jsonb`,
        ],
    },
    {
        id: '005_store_catalog_rwshop_import',
        description: 'Import RWShop catalog into store tables without deleting old rows',
        run: importRwShopCatalog,
    },
    {
        id: '006_store_item_delivery_rwmenu',
        description: 'Switch single-item store delivery commands from inventory.giveto to rwmenu.giveitem',
        run: async (client) => {
            const result = await client.query<{ id: number; delivery_command: string }>(
                `SELECT id, delivery_command
                 FROM store_products
                 WHERE delivery_type = 'item'
                   AND delivery_command LIKE 'inventory.giveto \${steamId} % \${amount}'`
            );

            for (const row of result.rows) {
                const currentCommand = String(row.delivery_command || '').trim();
                const match = currentCommand.match(/^inventory\.giveto \$\{steamId\} ([^\s]+) \$\{amount\}$/);
                if (!match) {
                    continue;
                }

                const nextCommand = `rwmenu.giveitem \${steamId} ${match[1]} \${amount}`;
                if (nextCommand === currentCommand) {
                    continue;
                }

                await client.query(
                    `UPDATE store_products
                     SET delivery_command = $2,
                         updated_at = now()
                     WHERE id = $1`,
                    [row.id, nextCommand]
                );
            }
        },
    },
    {
        id: '007_store_category_default_flag',
        description: 'Normalize default store category flag and keep only one default category',
        statements: [
            `ALTER TABLE store_categories ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false`,
            `WITH ranked AS (
                SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order, id) AS rn
                FROM store_categories
                WHERE is_default = true
            )
            UPDATE store_categories
            SET is_default = CASE WHEN ranked.rn = 1 THEN true ELSE false END
            FROM ranked
            WHERE store_categories.id = ranked.id`,
        ],
    },
    {
        id: '008_cases_catalog_and_openings',
        description: 'Create website cases tables, settings, items, and opening history',
        statements: [
            `CREATE TABLE IF NOT EXISTS case_settings (
                singleton BOOLEAN PRIMARY KEY DEFAULT true,
                cases_enabled BOOLEAN NOT NULL DEFAULT true,
                admin_only_open BOOLEAN NOT NULL DEFAULT false,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            )`,
            `CREATE TABLE IF NOT EXISTS case_definitions (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                price INTEGER NOT NULL DEFAULT 0,
                image_url TEXT NOT NULL,
                accent TEXT NOT NULL DEFAULT '#ffffff',
                is_active BOOLEAN NOT NULL DEFAULT true,
                rarity_common INTEGER NOT NULL DEFAULT 70,
                rarity_rare INTEGER NOT NULL DEFAULT 20,
                rarity_epic INTEGER NOT NULL DEFAULT 9,
                rarity_legendary INTEGER NOT NULL DEFAULT 1,
                meta JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            )`,
            `CREATE TABLE IF NOT EXISTS case_items (
                id SERIAL PRIMARY KEY,
                case_id TEXT NOT NULL REFERENCES case_definitions(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                rarity TEXT NOT NULL,
                sell_price INTEGER NOT NULL DEFAULT 0,
                image_url TEXT,
                is_active BOOLEAN NOT NULL DEFAULT true,
                is_fake BOOLEAN NOT NULL DEFAULT false,
                sort_order INTEGER NOT NULL DEFAULT 0,
                meta JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            )`,
            `CREATE TABLE IF NOT EXISTS case_openings (
                id SERIAL PRIMARY KEY,
                case_id TEXT NOT NULL REFERENCES case_definitions(id) ON DELETE CASCADE,
                case_item_id INTEGER REFERENCES case_items(id) ON DELETE SET NULL,
                user_steamid TEXT NOT NULL,
                purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
                status TEXT NOT NULL DEFAULT 'opened',
                trade_url TEXT,
                won_snapshot JSONB NOT NULL,
                error_message TEXT,
                sold_for INTEGER,
                resolved_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            )`,
            `CREATE INDEX IF NOT EXISTS case_items_case_id_idx ON case_items (case_id)`,
            `CREATE INDEX IF NOT EXISTS case_items_active_idx ON case_items (is_active)`,
            `CREATE INDEX IF NOT EXISTS case_openings_user_steamid_idx ON case_openings (user_steamid, created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS case_openings_status_idx ON case_openings (status)`,
            `INSERT INTO case_settings (singleton, cases_enabled)
             VALUES (true, true)
             ON CONFLICT (singleton) DO NOTHING`,
        ],
    },
    {
        id: '009_cases_rwmenu_alignment',
        description: 'Align cases schema with RWMenu logic using per-item chances and case descriptions',
        statements: [
            `ALTER TABLE case_definitions ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''`,
            `ALTER TABLE case_items ADD COLUMN IF NOT EXISTS drop_chance DOUBLE PRECISION NOT NULL DEFAULT 0`,
            `UPDATE case_items
             SET drop_chance = CASE
                WHEN COALESCE(is_fake, false) = true OR rarity = 'fake' THEN 1
                WHEN rarity IN ('legendary', 'epic', 'mythical') THEN 3
                WHEN rarity = 'rare' THEN 12
                ELSE 45
             END
             WHERE COALESCE(drop_chance, 0) <= 0`,
        ],
    },
];

export async function applyDatabaseMigrations(pool: Pool) {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id TEXT PRIMARY KEY,
            description TEXT NOT NULL,
            applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
    `);

    const appliedResult = await pool.query<{ id: string }>('SELECT id FROM schema_migrations');
    const applied = new Set(appliedResult.rows.map((row) => row.id));

    for (const migration of MIGRATIONS) {
        if (applied.has(migration.id)) {
            continue;
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            for (const statement of migration.statements || []) {
                await client.query(statement);
            }

            if (migration.run) {
                await migration.run(client);
            }

            await client.query(
                'INSERT INTO schema_migrations (id, description) VALUES ($1, $2)',
                [migration.id, migration.description]
            );

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}
