## Overview

Polycle Member is a Next.js 16 application that unifies daily report (DR) operations and task management with Google Sheets and Slack integrations.

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in with the configured providers.

## Environment Setup

Copy `.env.example` to `.env.local` and fill in every value. `SKIP_ENV_VALIDATION=1` is **only** for local prototyping; never set it in shared environments.

Required variables (excerpt):

```
NEXTAUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_SERVICE_ACCOUNT_KEY=...
SHEETS_DR_SPREADSHEET_ID=...
SHEETS_TASKS_SPREADSHEET_ID=...
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
SLACK_SIGNING_SECRET=...
SLACK_DAILY_REPORT_CHANNEL_ID=...
SLACK_APP_LEVEL_TOKEN=...
```

Service accounts need edit access to the DR / Tasks spreadsheets. Slack OAuth scopes are defined in `src/server/auth/options.ts`.

- `SLACK_DAILY_REPORT_CHANNEL_ID` は Slack のチャンネルID（例: `C0123456789`）を指定してください。チャンネル名では動作しません。

## Useful Scripts

- `npm run dev` — start local dev server
- `npm run build` — production build
- `npm run start` — run production build locally
- `npm run lint` — lint the project

## Folder Highlights

- `src/app/(app)` — authenticated application routes
- `src/lib` — integrations and shared utilities
- `src/server` — server-bound repositories and actions
- `src/validation` — Zod schemas shared by API routes and client forms
- `src/config/departments.ts` — userSlug ↔ 部署 / Slack ID マッピング

## `daily_reports` Sheet Schema (A〜U)

| Column | Key | Description |
| ------ | --- | ----------- |
| A | `date` | Report date (`YYYY-MM-DD`). |
| B | `satisfaction_today` | 満足度（数値/コメント）。 |
| C | `done_today` | 今日やったこと（Done）。 |
| D | `good_more_background` | 今日のGood / More と背景。 |
| E | `more_next` | 今日のMore Next。 |
| F | `todo_tomorrow` | 明日やるべきこと（タスク）。 |
| G | `wish_tomorrow` | 明日やりたいこと（非タスク）。 |
| H | `personal_news` | 個人的ニュース。 |
| I | `tags` | スペース区切りのタグ（例: `#sales #cs`）。 |
| J | `source` | `manual` または `slack_ingest`。 |
| K | `slack_ts` | Slack投稿の`ts`。既に埋まっていれば再投稿しません。 |
| L | `created_at` | 作成日時（ISO）。 |
| M | `updated_at` | 更新日時（ISO）。 |
| N | `user_slug` | 部署マップ用の一意キー（必須）。 |
| O〜U | 予備 | 将来の集計用に予約（hash/dept/weekStart等）。 |

> 運用メモ: `user_slug` を基準に部署判定を行い、必要に応じて `USER_SLUG_OF_SLACK` にSlack IDを追記してください。

## 部署マッピングの更新

- `src/config/departments.ts` の `DEPARTMENT_OF_USER` に実メンバーのスラッグと部署 (`A`〜`E`) を登録してください。
- SlackのユーザーIDを併記する場合は `USER_SLUG_OF_SLACK` に追記すると、表示名変更に影響されずに突合できます。
- 推奨スラッグ: 小文字英数＋ハイフン（例: `sei-mei`）。迷う場合はメールアドレスの`@`前を小文字化すればOKです。
// trigger vercel build
// trigger vercel build
// trigger vercel build
// trigger vercel build
