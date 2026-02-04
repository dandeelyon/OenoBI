-- Create advisory lock functions with proper permissions
create or replace function public.pg_try_advisory_lock(lock_id bigint)
returns boolean
language sql
security definer
as $$
  select pg_try_advisory_lock(lock_id);
$$;

create or replace function public.pg_advisory_unlock(lock_id bigint)
returns boolean
language sql
security definer
as $$
  select pg_advisory_unlock(lock_id);
$$;

-- Grant permissions to all roles
grant execute on function public.pg_try_advisory_lock(bigint) to public;
grant execute on function public.pg_advisory_unlock(bigint) to public;

-- Create kv table if it doesn't exist
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value JSONB
);

-- Insert fake DashExecPayload data
INSERT INTO kv (key, value)
VALUES (
  'dash_exec_cache_v1',
  '{
    "payload": {
      "overview": {
        "revenue": {
          "last30Days": 86976.86,
          "last90Days": 509871.86,
          "dailyAvg30d": 2899.23,
          "dailyAvg90d": 5665.24
        },
        "orders": {
          "last30Days": 105,
          "last90Days": 814
        },
        "inventory": {
          "totalBottles": 167716,
          "totalProducts": 165
        }
      },
      "topMovers": [
        {
          "sku": "BBVA2275",
          "productTitle": "2022 Arise",
          "quantity": 604,
          "revenue": 31992
        },
        {
          "sku": "BBVAR2275",
          "productTitle": "2022 Blackbird Vineyards Arriviste 750ml",
          "quantity": 551,
          "revenue": 7840
        },
        {
          "sku": "BBVP1675",
          "productTitle": "2016 Paramour",
          "quantity": 379,
          "revenue": 74894.42
        },
        {
          "sku": "BBVSBP2475",
          "productTitle": "2024 Pestoni Ranch Sauvignon Blanc",
          "quantity": 374,
          "revenue": 17427.5
        },
        {
          "sku": "BBVC1775",
          "productTitle": "2017 Contrarian",
          "quantity": 265,
          "revenue": 48727.39
        },
        {
          "sku": "BBVCH2175",
          "productTitle": "2021 Muir-Hanna Vineyard Chardonnay",
          "quantity": 218,
          "revenue": 15811.25
        },
        {
          "sku": "BBVC1975",
          "productTitle": "2019 Contrarian",
          "quantity": 194,
          "revenue": 34658.75
        },
        {
          "sku": "BBVI1975",
          "productTitle": "2019 Illustration",
          "quantity": 183,
          "revenue": 22947.5
        },
        {
          "sku": "BBVP1975",
          "productTitle": "2019 Paramour",
          "quantity": 181,
          "revenue": 35941
        },
        {
          "sku": "BBVSTARNV75",
          "productTitle": "Starling Sparkling Wine",
          "quantity": 163,
          "revenue": 7605
        }
      ],
      "monthlyTrend": [
        {
          "month": "Nov 2025",
          "bottles": 2319,
          "revenue": 252530.8,
          "orders": 342
        },
        {
          "month": "Dec 2025",
          "bottles": 1803,
          "revenue": 170364.2,
          "orders": 367
        },
        {
          "month": "Jan 2026",
          "bottles": 840,
          "revenue": 86976.86,
          "orders": 105
        }
      ],
      "meta": {
        "computedAt": "2026-01-31T02:17:43.554Z",
        "ordersCount": 900,
        "productsCount": 165
      }
    },
    "timestamp": 1769825863554
  }'::jsonb
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;