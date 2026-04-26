import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import morgan from "morgan";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Database } from "@sqlitecloud/drivers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite Cloud connection
let db: Database;

async function initDb() {
  const connectionString = process.env.SQLITE_CLOUD_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("SQLITE_CLOUD_CONNECTION_STRING is required for SQLite Cloud hosting.");
  }
  
  db = new Database(connectionString);
  
  // Initialize Database with DS Company Operational Schema
  await db.sql`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'vendas',
      gemini_api_key TEXT,
      external_lp_endpoint TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await db.sql`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome_cliente TEXT NOT NULL,
      niche TEXT,
      telefone TEXT,
      cidade TEXT,
      dados_json TEXT,
      status TEXT DEFAULT 'novo',
      link_landing_page TEXT,
      gerente_id INTEGER,
      criado_por INTEGER,
      data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(gerente_id) REFERENCES users(id),
      FOREIGN KEY(criado_por) REFERENCES users(id)
    );
  `;

  // Migrations
  try {
    const tableInfo = await db.sql`PRAGMA table_info(users)`;
    const existingColumns = tableInfo.map((col: any) => col.name);
    if (!existingColumns.includes('role')) {
      await db.sql`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'vendas'`;
    }
  } catch (e) {}

  try {
    const tableInfoLeads = await db.sql`PRAGMA table_info(leads)`;
    const existingColumnsLeads = tableInfoLeads.map((col: any) => col.name);
    if (!existingColumnsLeads.includes('nome_cliente')) {
      await db.sql`ALTER TABLE leads ADD COLUMN nome_cliente TEXT DEFAULT 'Sem Nome'`;
    }
  } catch (e) {}

  // Seed Initial Team
  const seedUser = async (name: string, email: string, role: string, pass: string = "password123") => {
    const existing = await db.sql`SELECT * FROM users WHERE email = ${email}`;
    if (existing.length === 0) {
      const hashedPassword = bcrypt.hashSync(pass, 10);
      await db.sql`INSERT INTO users (name, email, password, role) VALUES (${name}, ${email}, ${hashedPassword}, ${role})`;
      console.log(`Seeded user: ${email} (${role})`);
    } else if (role === 'superadmin') {
      const hashedPassword = bcrypt.hashSync(pass, 10);
      await db.sql`UPDATE users SET name = ${name}, password = ${hashedPassword}, role = ${role} WHERE email = ${email}`;
      console.log(`Updated superadmin: ${email}`);
    }
  };

  await seedUser("Dujao", "superadmin@dscompany.com.br", "superadmin", "30031936");
  await seedUser("Gerente Ana", "gerente@dscompany.com.br", "gerente");
  await seedUser("Vendas Pedro", "vendas@dscompany.com.br", "vendas");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(morgan("dev"));
  app.use(express.json());

  const JWT_SECRET = process.env.JWT_SECRET || "nexus_premium_secret_key_2026";

  // Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token provided" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;
      next();
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // Ensure DB initialized before adding routes that use it
  try {
    await initDb();
    console.log("Connected to SQLite Cloud");
  } catch (err: any) {
    console.error("Database initialization failed:", err.message);
  }

  // Auth Routes
  app.post("/api/auth/register", authenticate, async (req: any, res) => {
    if (req.user.role !== 'superadmin') return res.status(403).json({ error: "Somente superadmin pode criar usuários" });
    const { name, email, password, role } = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      await db.sql`INSERT INTO users (name, email, password, role) VALUES (${name}, ${email}, ${hashedPassword}, ${role || 'vendas'})`;
      res.json({ success: true, name, email, role: role || 'vendas' });
    } catch (error) {
      res.status(400).json({ error: "Usuário já existe ou dados inválidos" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const users = await db.sql`SELECT * FROM users WHERE email = ${email} OR name = ${email}`;
      const user = users[0];
      if (user && bcrypt.compareSync(password, user.password)) {
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: "1d" });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, gemini_api_key: user.gemini_api_key, external_lp_endpoint: user.external_lp_endpoint } });
      } else {
        res.status(401).json({ error: "Credenciais inválidas" });
      }
    } catch (error) {
      res.status(500).json({ error: "Erro interno no servidor" });
    }
  });

  app.patch("/api/auth/settings", authenticate, async (req: any, res) => {
    const { gemini_api_key, external_lp_endpoint } = req.body;
    try {
      await db.sql`UPDATE users SET gemini_api_key = ${gemini_api_key || null}, external_lp_endpoint = ${external_lp_endpoint || null} WHERE id = ${req.user.id}`;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao salvar configurações" });
    }
  });

  app.get("/api/auth/verify", authenticate, (req: any, res) => {
    res.json({ valid: true, user: req.user });
  });

  // User Management
  app.get("/api/users", authenticate, async (req: any, res) => {
    if (req.user.role !== 'superadmin') return res.status(403).json({ error: "Unauthorized" });
    try {
      const users = await db.sql`
        SELECT id, name, email, role, created_at,
        (SELECT COUNT(*) FROM leads WHERE gerente_id = users.id) as lead_count
        FROM users 
        ORDER BY role DESC
      `;
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Error fetching users" });
    }
  });

  app.delete("/api/users/:id", authenticate, async (req: any, res) => {
    if (req.user.role !== 'superadmin') return res.status(403).json({ error: "Unauthorized" });
    const { id } = req.params;
    if (Number(id) === req.user.id) return res.status(400).json({ error: "Cannot delete yourself" });
    try {
      await db.sql`DELETE FROM users WHERE id = ${id}`;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error deleting user" });
    }
  });

  app.patch("/api/users/:id", authenticate, async (req: any, res) => {
    if (req.user.role !== 'superadmin') return res.status(403).json({ error: "Unauthorized" });
    const { id } = req.params;
    const { name, email, role } = req.body;
    try {
      await db.sql`UPDATE users SET name = ${name}, email = ${email}, role = ${role} WHERE id = ${id}`;
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Error updating user" });
    }
  });

  app.get("/api/users/gerentes", authenticate, async (req: any, res) => {
    try {
      const gerentes = await db.sql`SELECT id, name, email FROM users WHERE role = 'gerente'`;
      res.json(gerentes);
    } catch (error) {
      res.status(500).json({ error: "Error fetching managers" });
    }
  });

  // Leads CRUD & Workflow
  app.get("/api/leads", authenticate, async (req: any, res) => {
    try {
      let leads;
      if (req.user.role === 'superadmin') {
        leads = await db.sql`SELECT l.*, u.name as gerente_nome FROM leads l LEFT JOIN users u ON l.gerente_id = u.id ORDER BY data_criacao DESC`;
      } else if (req.user.role === 'gerente') {
        leads = await db.sql`SELECT * FROM leads WHERE gerente_id = ${req.user.id} AND status IN ('atribuido', 'em_producao', 'produzido') ORDER BY data_criacao DESC`;
      } else {
        leads = await db.sql`SELECT * FROM leads WHERE status IN ('produzido', 'enviado_vendas', 'contatado', 'negociacao', 'fechado', 'recusado') ORDER BY data_criacao DESC`;
      }
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: "Could not fetch leads" });
    }
  });

  app.post("/api/leads", authenticate, async (req: any, res) => {
    const { nome_cliente, niche, telefone, cidade, dados_json, gerente_id } = req.body;
    try {
      const status = gerente_id ? 'atribuido' : 'novo';
      const payload = dados_json || {};
      await db.sql`INSERT INTO leads (nome_cliente, niche, telefone, cidade, dados_json, criado_por, status, gerente_id) 
                   VALUES (${nome_cliente}, ${niche}, ${telefone}, ${cidade}, ${JSON.stringify(payload)}, ${req.user.id}, ${status}, ${gerente_id || null})`;
      res.json({ success: true, nome_cliente, status });
    } catch (error) {
      res.status(500).json({ error: "Could not create lead" });
    }
  });

  app.post("/api/leads/assign", authenticate, async (req: any, res) => {
    if (req.user.role !== 'superadmin') return res.status(403).json({ error: "Unauthorized" });
    const { leadIds, gerenteId } = req.body;
    try {
      for (const id of leadIds) {
        await db.sql`UPDATE leads SET gerente_id = ${gerenteId}, status = 'atribuido' WHERE id = ${id}`;
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Could not assign leads" });
    }
  });

  app.post("/api/leads/:id/produce", authenticate, async (req: any, res) => {
    if (req.user.role !== 'gerente') return res.status(403).json({ error: "Unauthorized" });
    const { link_landing_page } = req.body;
    try {
      await db.sql`UPDATE leads SET status = 'produzido', link_landing_page = ${link_landing_page} WHERE id = ${req.params.id} AND gerente_id = ${req.user.id}`;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Could not update production status" });
    }
  });

  app.patch("/api/leads/:id/status", authenticate, async (req: any, res) => {
    const { status } = req.body;
    try {
      await db.sql`UPDATE leads SET status = ${status} WHERE id = ${req.params.id}`;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Could not update status" });
    }
  });

  app.delete("/api/leads/:id", authenticate, async (req: any, res) => {
    if (req.user.role !== 'superadmin') return res.status(403).json({ error: "Unauthorized" });
    try {
      await db.sql`DELETE FROM leads WHERE id = ${req.params.id}`;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Could not delete lead" });
    }
  });

  app.get("/api/stats", authenticate, async (req: any, res) => {
    try {
      let totalLeads;
      let leadsByStatus;
      let recentLeads;
      if (req.user.role === 'superadmin') {
        totalLeads = await db.sql`SELECT COUNT(*) as count FROM leads`;
        leadsByStatus = await db.sql`SELECT status, COUNT(*) as count FROM leads GROUP BY status`;
        recentLeads = await db.sql`SELECT * FROM leads ORDER BY data_criacao DESC LIMIT 10`;
      } else if (req.user.role === 'gerente') {
        totalLeads = await db.sql`SELECT COUNT(*) as count FROM leads WHERE gerente_id = ${req.user.id}`;
        leadsByStatus = await db.sql`SELECT status, COUNT(*) as count FROM leads WHERE gerente_id = ${req.user.id} GROUP BY status`;
        recentLeads = await db.sql`SELECT * FROM leads WHERE gerente_id = ${req.user.id} ORDER BY data_criacao DESC LIMIT 10`;
      } else {
        const q = "status IN ('produzido', 'enviado_vendas', 'contatado', 'negociacao', 'fechado', 'recusado')";
        totalLeads = await db.sql`SELECT COUNT(*) as count FROM leads WHERE ${q}`;
        leadsByStatus = await db.sql`SELECT status, COUNT(*) as count FROM leads WHERE ${q} GROUP BY status`;
        recentLeads = await db.sql`SELECT * FROM leads WHERE ${q} ORDER BY data_criacao DESC LIMIT 10`;
      }
      res.json({ totalLeads: totalLeads[0]?.count || 0, leadsByStatus, recentLeads });
    } catch (error) {
      res.status(500).json({ error: "Could not fetch stats" });
    }
  });

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: any, res: any) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 DS Company OS running on http://localhost:${PORT}`);
  });
}

startServer();
