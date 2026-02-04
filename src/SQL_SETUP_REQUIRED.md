# ⚠️ REQUIRED: PostgreSQL Advisory Lock Setup

## Error You're Seeing
```
[Lock] Error acquiring lock: {
  code: "PGRST202",
  message: "Could not find the function public.pg_try_advisory_lock(lock_id) in the schema cache"
}
```

## Fix: Create PostgreSQL Functions

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **"New Query"**

### Step 2: Run This SQL

Copy and paste this EXACT SQL and run it:

```sql
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
grant execute on function public.pg_try_advisory_lock(bigint) to anon, authenticated, service_role;
grant execute on function public.pg_advisory_unlock(bigint) to anon, authenticated, service_role;
```

### Step 3: Restart PostgREST API

**Option A (Fastest):**
1. Go to **Settings** → **API** in Supabase Dashboard
2. Click **"Restart API"** or **"Refresh Schema Cache"**

**Option B (Wait):**
- Wait 60 seconds for the schema cache to refresh automatically

### Step 4: Verify

Refresh your dashboard. You should see:
- ✅ No more `PGRST202` errors in console
- ✅ `[Dash/Exec] Lock ACQUIRED` or `[Dash/Exec] Cache HIT` messages
- ✅ Dashboard loads successfully

---

## Why This Is Needed

PostgreSQL advisory locks prevent multiple edge function instances from fetching Commerce 7 data simultaneously (thundering herd problem). The functions need to be created with `security definer` so the edge function can call them with the service role key.

---

## Troubleshooting

**If you still see the error after running SQL:**
1. Double-check you clicked "RUN" in SQL Editor
2. Verify no SQL errors appeared
3. Try the API restart (Step 3) again
4. Check that you're connected to the correct Supabase project

**If you see "permission denied":**
- Make sure you ran the `GRANT EXECUTE` statements
- Restart the API to refresh permissions
