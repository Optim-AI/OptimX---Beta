-- ============================================================
-- Instagram watch: hashtags (Public Content Access) and competitor accounts (Business Discovery)
-- ============================================================
-- All rows cascade from meta_connections, so Disconnect / Meta data deletion removes them.
-- Server-only (service role).

CREATE TABLE IF NOT EXISTS public.ig_watch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('hashtag', 'account')),
  value text NOT NULL,
  data jsonb,
  last_fetched_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ig_watch_items_conn_kind_value_key ON public.ig_watch_items (connection_id, kind, value);

-- Meta allows 30 unique hashtags per Instagram account per rolling 7 days; a hashtag counts
-- from its first query and re-queries inside the window are free. We track first-query times.
CREATE TABLE IF NOT EXISTS public.ig_hashtag_queries (
  connection_id uuid NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  ig_user_id text NOT NULL,
  hashtag text NOT NULL,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ig_user_id, hashtag)
);

CREATE TABLE IF NOT EXISTS public.ig_style_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'succeeded' CHECK (status IN ('succeeded', 'failed')),
  output jsonb,
  dropped jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ig_style_reads_conn_created ON public.ig_style_reads (connection_id, created_at DESC);

ALTER TABLE public.ig_watch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_hashtag_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_style_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ig_watch_items FROM anon, authenticated;
REVOKE ALL ON public.ig_hashtag_queries FROM anon, authenticated;
REVOKE ALL ON public.ig_style_reads FROM anon, authenticated;
