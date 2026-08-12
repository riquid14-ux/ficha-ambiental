/**
 * Script de Seed — Plataforma Ambiental Start Campus
 * Executa após criar a BD e correr migrações (pnpm drizzle-kit push).
 * Uso: node docs-it/seed-data.mjs
 * Requer: DATABASE_URL definido no .env
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('ERRO: DATABASE_URL não definido'); process.exit(1); }

async function seed() {
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log('Conectado à base de dados.');

  const projects = [
    ['SIN01', 'NEST', 'Projeto SIN01 - Fase de Operação'],
    ['SIN02', 'SIN02', 'Projeto SIN02'],
    ['SIN03', 'SIN03', 'Projeto SIN03'],
    ['SIN04', 'SIN04', 'Projeto SIN04'],
    ['SIN05', 'SIN05', 'Projeto SIN05'],
    ['SIN06', 'SIN06', 'Projeto SIN06'],
    ['SIN07', 'SIN07', 'Projeto SIN07'],
    ['SUB400', 'Subestação 400 kV', 'Subestação 400 kV'],
  ];
  for (const [code, name, desc] of projects) {
    await conn.execute('INSERT IGNORE INTO projects (code, name, description, active) VALUES (?, ?, ?, 1)', [code, name, desc]);
  }
  console.log(`Projetos: ${projects.length} inseridos.`);

  // Password hash bcrypt para '123456'
  const hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
  const admins = [
    ['rmd@startcampus.pt', 'RMD'],
    ['rom@startcampus.pt', 'ROM'],
    ['npa@startcampus.pt', 'NPA'],
  ];
  for (const [email, name] of admins) {
    const openId = `email_${email.replace(/[^a-z0-9]/g, '_')}`;
    await conn.execute(
      `INSERT IGNORE INTO users (openId, email, name, role, passwordHash, mustChangePassword, totpEnabled, accountStatus, createdAt) VALUES (?, ?, ?, 'admin', ?, 1, 0, 'active', ?)`,
      [openId, email, name, hash, Date.now()]
    );
  }
  console.log(`Admins: ${admins.length} inseridos (password: 123456).`);
  console.log('Seed concluido. Medidas DCAPE são carregadas automaticamente pela app.');
  await conn.end();
}
seed().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
