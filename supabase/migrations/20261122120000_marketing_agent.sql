-- ============================================================
-- Marketing Agent: a marketing strategist chat per brand
-- ============================================================
-- agent_settings       standing instructions + the page's one-line description
-- agent_sessions       chat sessions (Recents); source = chat | schedule
-- agent_messages       messages in a session
-- agent_context_items  files, notes and links the owner adds
-- agent_memories       facts the agent learned (owner can edit/delete)
-- agent_tasks          scheduled recurring tasks
-- agent_actions        confirmable hand-offs into the studios (audit + no double runs)
-- Server-only (service role); no client access.

CREATE TABLE IF NOT EXISTS public.agent_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_kit_id uuid,
  instructions text NOT NULL DEFAULT '',
  tagline text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS agent_settings_user_key ON public.agent_settings (user_id);

CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_kit_id uuid,
  title text NOT NULL DEFAULT 'New chat',
  source text NOT NULL DEFAULT 'chat' CHECK (source IN ('chat', 'schedule')),
  task_id uuid,
  unread boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_updated ON public.agent_sessions (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL DEFAULT '',
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  used jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_messages_session_created ON public.agent_messages (session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_messages_user_created ON public.agent_messages (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_context_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_kit_id uuid,
  kind text NOT NULL CHECK (kind IN ('file', 'note', 'link')),
  title text NOT NULL,
  storage_path text,
  mime text,
  url text,
  extracted_text text,
  summary text,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('processing', 'ready', 'failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_context_user_created ON public.agent_context_items (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_kit_id uuid,
  fact text NOT NULL,
  source_session_id uuid REFERENCES public.agent_sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_memories_user_created ON public.agent_memories (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_kit_id uuid,
  title text NOT NULL,
  prompt text NOT NULL,
  cadence jsonb NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  enabled boolean NOT NULL DEFAULT true,
  email_me boolean NOT NULL DEFAULT false,
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_session_id uuid REFERENCES public.agent_sessions(id) ON DELETE SET NULL,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_due ON public.agent_tasks (next_run_at) WHERE enabled;
CREATE INDEX IF NOT EXISTS idx_agent_tasks_user ON public.agent_tasks (user_id);

CREATE TABLE IF NOT EXISTS public.agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.agent_messages(id) ON DELETE CASCADE,
  type text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  cost_credits integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'confirmed', 'running', 'done', 'failed', 'dismissed')),
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_actions_user_created ON public.agent_actions (user_id, created_at DESC);

ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_context_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_settings FROM anon, authenticated;
REVOKE ALL ON public.agent_sessions FROM anon, authenticated;
REVOKE ALL ON public.agent_messages FROM anon, authenticated;
REVOKE ALL ON public.agent_context_items FROM anon, authenticated;
REVOKE ALL ON public.agent_memories FROM anon, authenticated;
REVOKE ALL ON public.agent_tasks FROM anon, authenticated;
REVOKE ALL ON public.agent_actions FROM anon, authenticated;

-- Private bucket for files added to the agent's Context (Phase 2).
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-context', 'agent-context', false)
ON CONFLICT (id) DO NOTHING;
