import { isUuid } from '../lib/values.js'

/** Records who an IT staff member is, so history can say "issued by Rina"
 *  rather than a bare id. Called on sign-in and whenever someone records a
 *  handout; a no-op write when nothing changed. Never touches role or
 *  department_id - those are admin-managed, not read from the token. */
export async function upsertProfile(db, user) {
  await db.query(
    `insert into profiles (id, email, full_name)
     values ($1, $2, $3)
     on conflict (id) do update
       set email = excluded.email, full_name = excluded.full_name
       where profiles.email is distinct from excluded.email
          or profiles.full_name is distinct from excluded.full_name`,
    [user.id, user.email ?? null, user.full_name ?? null],
  )
}

/** The full profile, joined to its department name. Used by loadProfile, /me
 *  and the users/departments services. A malformed id is just "no profile",
 *  never a 500 from Postgres rejecting the uuid cast. */
export async function findProfile(db, id) {
  if (!isUuid(id)) return undefined
  const { rows } = await db.query(
    `select p.id, p.email, p.full_name, p.role, p.department_id, d.name as department_name,
            p.disabled_at, p.created_at
       from profiles p
       left join departments d on d.id = p.department_id
      where p.id = $1`,
    [id],
  )
  return rows[0]
}
