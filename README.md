# Device Handout Tracker

Records which employee holds which company laptop and phone, and when it was
handed over. Design: [docs/superpowers/specs/2026-09-23-device-handout-tracker-design.md](docs/superpowers/specs/2026-09-23-device-handout-tracker-design.md).

```
client/   React + Vite            the screens; talks only to /api
server/   Express + Zod           business rules; talks to Postgres and Supabase Auth
supabase/migrations/              the database schema
```

The database starts **empty**. Add devices and employees from the app, or load
your existing spreadsheets from the **Import** page.

## First-time setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com).

2. **Configure** - copy `.env.example` to `.env` and fill in `DATABASE_URL`,
   `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Use the *Session pooler* connection
   string (Supabase -> Connect).

3. **Install and create the tables**

   ```
   npm install
   npm run db:migrate
   ```

4. **Lock down sign-ups.** Supabase -> Authentication -> Sign In / Providers ->
   turn off *Allow new users to sign up*. Every account can use the whole app,
   so only IT staff should have one.

5. **Add the IT staff who will sign in.** Supabase -> Authentication -> Users ->
   *Add user* -> *Create new user*, with *Auto Confirm User* ticked. To show
   their name in the app instead of their email, run this in the SQL Editor:

   ```sql
   update auth.users
      set raw_user_meta_data = raw_user_meta_data || '{"full_name": "Rina Delgado"}'
    where email = 'rina@adspark.ph';
   ```

6. **Run it**

   ```
   npm run dev
   ```

   Open http://localhost:5173 and sign in.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | API on :3001 and the app on :5173, both reloading on change |
| `npm run db:migrate` | Applies any new files in `supabase/migrations/` |
| `npm run db:seed` | Loads example devices, employees and handouts to try the app with |
| `npm run db:seed:remove` | Deletes the example data again; real data is left alone |
| `npm test` | Server tests, then the client's screen tests against the real API |
| `npm run build` | Production build of the client into `client/dist/` |

## Tests

No database or Supabase account is needed to run them. Each test file starts
its own in-memory Postgres ([PGlite](https://pglite.dev)) with the real
migrations applied, and a stand-in for Supabase Auth. Test data lives in
`server/test/support/fixtures.js` and only ever goes into that throwaway
database.
