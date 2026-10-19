#!/usr/bin/env node
/** Cria a primeira conta Admin apenas numa base STAND nova e vazia. */
import crypto from "node:crypto";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    stdout.write(prompt);
    let value = "";
    const onData = chunk => {
      const input = chunk.toString("utf8");
      for (const character of input) {
        if (character === "\n" || character === "\r") {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdout.write("\n");
          stdin.removeListener("data", onData);
          resolve(value);
        } else if (character === "\u0003") {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          reject(new Error("Operação cancelada."));
        } else if (character === "\u007f") {
          value = value.slice(0, -1);
        } else {
          value += character;
        }
      }
    };
    if (!stdin.isTTY) return reject(new Error("Este bootstrap requer um terminal interativo; não use password em argumentos ou ficheiros."));
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.on("data", onData);
  });
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente.");
if (!stdin.isTTY) throw new Error("Execute este bootstrap apenas numa sessão TTY privada.");

const rl = readline.createInterface({ input: stdin, output: stdout });
try {
  const fullName = (await rl.question("Nome completo do primeiro administrador: ")).trim();
  const email = (await rl.question("Email corporativo do primeiro administrador: ")).trim().toLowerCase();
  if (!fullName || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Nome ou email inválido.");
  const password = await askHidden("Palavra-passe inicial (mínimo 12 caracteres): ");
  const confirmation = await askHidden("Repetir palavra-passe: ");
  if (password.length < 12) throw new Error("A palavra-passe tem de ter pelo menos 12 caracteres.");
  if (password !== confirmation) throw new Error("As palavras-passe não coincidem.");

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    await connection.beginTransaction();
    const [existingAdmins] = await connection.execute(
      "SELECT id FROM users WHERE role = 'admin' AND accountStatus = 'active' LIMIT 1"
    );
    if (existingAdmins.length) throw new Error("Já existe um administrador ativo. Este bootstrap só é permitido uma vez.");
    const [existingEmail] = await connection.execute("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (existingEmail.length) throw new Error("Já existe uma conta com este email.");

    const passwordHash = await bcrypt.hash(password, 12);
    const openId = `bootstrap_${crypto.randomBytes(24).toString("hex")}`;
    const [result] = await connection.execute(
      `INSERT INTO users
        (openId, name, email, loginMethod, role, fullName, passwordHash, mustChangePassword, totpEnabled, accountStatus, sessionVersion)
       VALUES (?, ?, ?, 'email', 'admin', ?, ?, 0, 0, 'active', 0)`,
      [openId, fullName, email, fullName, passwordHash]
    );
    await connection.execute(
      "INSERT INTO audit_log (userId, userName, action, entity, entityId, newValue) VALUES (?, ?, 'initial_admin_bootstrap', 'users', ?, ?)",
      [result.insertId, fullName, result.insertId, JSON.stringify({ source: "fresh-start" })]
    );
    await connection.commit();
    console.log("Primeiro administrador criado. Inicie sessão, ative 2FA e configure as restantes entidades pelo fluxo administrativo.");
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
} finally {
  rl.close();
}
