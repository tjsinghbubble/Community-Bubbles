import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function reset() {
  const client = await pool.connect();
  try {
    console.log('Dropping all tables in public schema...');
    await client.query(`
      DO $$ DECLARE r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);
    console.log('All tables dropped successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

reset().catch((err) => {
  console.error('DB reset failed:', err);
  process.exit(1);
});
