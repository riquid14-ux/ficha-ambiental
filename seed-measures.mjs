import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read measures data from the generated JSON
const measuresRaw = readFileSync(join(__dirname, '../measures_data.json'), 'utf-8');
const { measures, sections } = JSON.parse(measuresRaw);

const sectionIdMap = {};
sections.forEach((s, i) => { sectionIdMap[s] = i + 1; });

async function seed() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const connection = await createConnection(dbUrl);
  
  console.log('Seeding measures...');
  
  // Insert in batches of 20
  const batchSize = 20;
  for (let i = 0; i < measures.length; i += batchSize) {
    const batch = measures.slice(i, i + batchSize);
    const values = batch.map((m, idx) => {
      const desc = m.description.replace(/\n/g, ' ').replace(/\r/g, '');
      const resp = m.responsible.replace(/\n/g, ' | ').replace(/\r/g, '').trim();
      const sectionId = sectionIdMap[m.section] || 1;
      return [m.number, desc, resp, sectionId, i + idx + 1];
    });
    
    await connection.query(
      'INSERT INTO measures (number, description, responsible, sectionId, orderIndex) VALUES ?',
      [values]
    );
    console.log(`  Inserted measures ${i + 1} to ${i + batch.length}`);
  }
  
  console.log(`Done! Seeded ${measures.length} measures.`);
  await connection.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
