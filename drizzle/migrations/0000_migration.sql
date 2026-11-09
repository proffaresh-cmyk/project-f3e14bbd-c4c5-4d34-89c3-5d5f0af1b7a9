
-- Life organizer schema (single user; accessed only by server code with service role)

CREATE TABLE public.settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  timezone text NOT NULL DEFAULT 'Africa/Algiers',
  nag_interval_min int NOT NULL DEFAULT 30,
  wake_time time NOT NULL DEFAULT '06:30',
  sleep_time time NOT NULL DEFAULT '23:30',
  study_goal_hours numeric(4,2) NOT NULL DEFAULT 4,
  owner_chat_id bigint,
  bot_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.categories (
  name text PRIMARY KEY,
  emoji text NOT NULL DEFAULT '📌',
  sort int NOT NULL DEFAULT 0
);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','done')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.project_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  sort int NOT NULL DEFAULT 0,
  done_at timestamptz
);

CREATE TABLE public.habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '✅',
  frequency text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','weekly')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habit_id, log_date)
);

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'شخصي',
  priority text NOT NULL DEFAULT 'med' CHECK (priority IN ('high','med','low')),
  due_date date,
  due_time time,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','done','snoozed','skipped')),
  snoozed_until timestamptz,
  nag boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_due ON public.tasks (due_date, status);

CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  remind_time time NOT NULL,
  days int[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  kind text NOT NULL DEFAULT 'custom' CHECK (kind IN ('custom','study','habit','project','morning','evening')),
  nag boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  habit_id uuid REFERENCES public.habits(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  last_sent_date date,
  last_sent_at timestamptz,
  ack_date date,
  snoozed_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.study_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date date NOT NULL,
  hours numeric(4,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_study_logs_date ON public.study_logs (log_date);

-- Grants: only server-side code (service role) touches these tables
GRANT ALL ON public.settings, public.categories, public.projects, public.project_steps,
  public.habits, public.habit_logs, public.tasks, public.reminders, public.study_logs TO service_role;

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_logs ENABLE ROW LEVEL SECURITY;

-- Seed data
INSERT INTO public.settings (id) VALUES (1);

INSERT INTO public.categories (name, emoji, sort) VALUES
  ('دراسة', '📚', 1),
  ('رياضة', '🏃', 2),
  ('مهام منزلية', '🏠', 3),
  ('بيع الكتاب', '📖', 4),
  ('شخصي', '🙂', 5);

INSERT INTO public.projects (id, name) VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'بيع الكتاب');

INSERT INTO public.project_steps (project_id, title, sort) VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'تصوير الكتاب وكتابة الوصف', 1),
  ('00000000-0000-0000-0000-0000000000b1', 'نشر الإعلان', 2),
  ('00000000-0000-0000-0000-0000000000b1', 'التواصل مع المشترين', 3),
  ('00000000-0000-0000-0000-0000000000b1', 'المتابعة مع المهتمين', 4),
  ('00000000-0000-0000-0000-0000000000b1', 'تسليم الكتاب واستلام المبلغ', 5);

INSERT INTO public.habits (id, name, emoji, frequency) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'رياضة', '🏃', 'daily'),
  ('00000000-0000-0000-0000-0000000000a2', 'غسل الملابس', '🧺', 'weekly'),
  ('00000000-0000-0000-0000-0000000000a3', 'دراسة', '📚', 'daily');

INSERT INTO public.reminders (title, message, remind_time, days, kind, nag, habit_id, project_id) VALUES
  ('رسالة الصباح', 'مهام اليوم', '07:00', '{0,1,2,3,4,5,6}', 'morning', false, NULL, NULL),
  ('ملخص المساء', 'ملخص اليوم', '21:30', '{0,1,2,3,4,5,6}', 'evening', false, NULL, NULL),
  ('حصة دراسة صباحية', 'وقت الدراسة! ركّز 90 دقيقة 📚', '09:00', '{0,1,2,3,4,5,6}', 'study', true, NULL, NULL),
  ('حصة دراسة بعد الظهر', 'حصة الدراسة الثانية 📚', '15:00', '{0,1,2,3,4,5,6}', 'study', true, NULL, NULL),
  ('حصة دراسة مسائية', 'آخر حصة دراسة لليوم 📚', '20:00', '{0,1,2,3,4,5,6}', 'study', true, NULL, NULL),
  ('رياضة', 'حان وقت الرياضة 🏃', '17:30', '{0,1,2,3,4,5,6}', 'habit', true, '00000000-0000-0000-0000-0000000000a1', NULL),
  ('غسل الملابس', 'يوم الغسيل الأسبوعي 🧺', '10:00', '{6}', 'habit', true, '00000000-0000-0000-0000-0000000000a2', NULL),
  ('متابعة بيع الكتاب', 'تابع بيع الكتاب 📖', '19:00', '{0,1,2,3,4,5,6}', 'project', true, NULL, '00000000-0000-0000-0000-0000000000b1');
