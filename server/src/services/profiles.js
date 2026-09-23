/** Records who an IT staff member is, so history can say "issued by Rina"
 *  rather than a bare id. Called on sign-in and whenever someone records a
 *  handout; a no-op write when nothing changed. */
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
