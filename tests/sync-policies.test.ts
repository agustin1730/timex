import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { emptyLibrary } from "../src/lib/sync/library.ts";
test("PostgreSQL migration: RLS isolates users, anon denied, CAS revision and tombstones", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon; insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');`,
    );
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/202609250001_account_sync.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      `set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';`,
    );
    const l = emptyLibrary();
    l.timers.deleted = null;
    let r = await db.query("select public.intervalos_commit($1,$2::jsonb) as result", [
      0,
      JSON.stringify(l),
    ]);
    assert.equal(r.rows[0].result.revision, 1);
    r = await db.query("select public.intervalos_commit($1,$2::jsonb) as result", [
      0,
      JSON.stringify(l),
    ]);
    assert.equal(r.rows[0].result, null);
    await db.exec(`set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';`);
    assert.equal((await db.query("select * from public.intervalos_libraries")).rows.length, 0);
    assert.equal(
      (
        await db.query(
          "update public.intervalos_libraries set revision=99 where user_id='00000000-0000-0000-0000-000000000001' returning *",
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "insert into public.intervalos_libraries(user_id,library) values ('00000000-0000-0000-0000-000000000001',$1::jsonb)",
        [JSON.stringify(l)],
      ),
    );
    await db.exec(`set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';`);
    r = await db.query("select public.intervalos_commit($1,$2::jsonb) as result", [
      1,
      JSON.stringify(l),
    ]);
    assert.equal(r.rows[0].result.revision, 2);
    assert.equal(r.rows[0].result.library.timers.deleted, null);
    await assert.rejects(db.query("delete from public.intervalos_libraries"));
    await db.exec("reset role; set role anon;");
    await assert.rejects(db.query("select * from public.intervalos_libraries"));
    await assert.rejects(
      db.query("select public.intervalos_commit($1,$2::jsonb)", [0, JSON.stringify(l)]),
    );
  } finally {
    await db.close();
  }
});
