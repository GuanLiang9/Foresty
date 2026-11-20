// One gate for "may `me` look at `other`'s grove?": yourself, an accepted friend, or someone in a shared race.
export async function canView(sql, me, other) {
  if (me === other) return true;
  const [row] = await sql`select (
    exists (select 1 from friendships where user_id = ${me} and friend_id = ${other} and status = 'accepted')
    or exists (select 1 from competition_members a join competition_members b on b.competition_id = a.competition_id
               where a.user_id = ${me} and b.user_id = ${other})
  ) as ok`;
  return Boolean(row?.ok);
}
