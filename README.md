# رفيق اليوم

مرحبا قم بعمل  Build a personal life-organizer Telegram bot with a small web dashboard. Single user (me), Arabic-first (RTL), Algeria timezone (Africa/Algiers).

STACK
- Lovable + Supabase (database + Edge Functions + pg_cron).
- Telegram Bot API via webhook (Edge Function). Bot token and my chat_id stored as Supabase secrets.

CORE FEATURES
1. Tasks: title, category (دراسة / رياضة / مهام منزلية / بيع الكتاب / شخصي), priority (high/med/low), due date, status (todo/done/snoozed).
2. Recurring reminders: each reminder has a time, days of week, and message. Support MANY reminders per day (e.g. 7:00, 10:00, 14:00, 18:00, 21:00).
3. Persistent nagging: if a task is not marked done, the bot re-sends the reminder every 30 minutes (configurable) until I press "✅ Done" or "⏰ Snooze 1h".
4. Inline buttons on every reminder: ✅ Done / ⏰ Snooze / ❌ Skip today.
5. Morning message (07:00): today's tasks sorted by priority + a short motivation line.
6. Evening message (21:30): summary of what was done vs. missed, and tomorrow's top 3.
7. Study tracker: daily study goal in hours, command to log study sessions, weekly stats.
8. Habits (sport, laundry weekly, etc.) with streak counter.
9. Special project tracker: "بيع الكتاب" with sub-steps (e.g. post ad, contact buyers, follow-up) and a daily reminder until sold.

TELEGRAM COMMANDS (Arabic replies)
/start, /today (اليوم), /add (add task via guided chat), /done, /snooze, /habits, /study (log hours), /week (weekly report), /reminders (list/add/delete reminders).
Also accept free text: "ذكرني بغسل الملابس غدا 18:00" → parse and create a task/reminder.

DATABASE TABLES
tasks, reminders, habits, habit_logs, study_logs, settings (timezone, nag_interval, wake time, sleep time).

SCHEDULING
- pg_cron runs an Edge Function every minute that checks due reminders and pending nags, and sends Telegram messages.
- Never send reminders during sleep hours (default 23:30–06:30) except the morning message.
- Prevent duplicate sends (store last_sent_at).

DASHBOARD (simple, RTL, mobile-first)
- Today view with checkboxes, add/edit tasks and reminders, weekly stats chart, habit streaks.
- Simple password login (single user).

SEED DATA
Categories above, plus starter reminders: study blocks (09:00, 15:00, 20:00), sport (17:30), laundry (Saturday 10:00), book sale follow-up (daily 19:00), plus morning and evening summaries.

Keep the UI clean and minimal. Add clear setup instructions for registering the webhook with Telegram (setWebhook) and setting the secrets.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f3e14bbd-c4c5-4d34-89c3-5d5f0af1b7a9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
