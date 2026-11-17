// A stand-in for the Neon `sql` client, backed by an in-memory Postgres (PGlite), for tests and benchmarks.
// It behaves like the real one where it matters:
//   - sql`...` is lazy: nothing runs until it is awaited (or passed to sql.transaction)
//   - sql.transaction([q1, q2]) runs the queries together in one transaction and returns all results
// It also counts "round trips" (one per awaited query or transaction), which is what costs time with
// Neon over HTTP, and can add a fake network delay to each round trip.
export function fakeSql(pg, { latency = 0 } = {}) {
  const stats = { trips: 0 };
  const wait = () => (latency ? new Promise((r) => setTimeout(r, latency)) : null);
  const build = (strings, vals) => {
    let q = strings[0];
    vals.forEach((_, i) => { q += `$${i + 1}${strings[i + 1]}`; });
    return q;
  };
  const sql = (strings, ...vals) => {
    const text = build(strings, vals);
    let p;
    const run = () => (p ??= (async () => { stats.trips++; await wait(); return (await pg.query(text, vals)).rows; })());
    return { text, vals, then: (a, b) => run().then(a, b), catch: (b) => run().catch(b), finally: (f) => run().finally(f) };
  };
  sql.transaction = async (queries) => {
    stats.trips++;
    await wait();
    return pg.transaction(async (tx) => {
      const out = [];
      for (const q of queries) out.push((await tx.query(q.text, q.vals)).rows);
      return out;
    });
  };
  sql.stats = stats;
  return sql;
}
