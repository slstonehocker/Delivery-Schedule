require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const { Pool }  = require("pg");
const bcrypt    = require("bcrypt");
const jwt       = require("jsonwebtoken");

const app  = express();
const port = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────────────────────
// This allows your frontend to talk to this server
app.use(cors({ origin: "*" }));
// This lets the server read JSON data sent from the frontend
app.use(express.json());

// ── Database Connection ────────────────────────────────────────────────────
// This connects to your Supabase PostgreSQL database using the URL in .env
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // required for Supabase
});

// Test the database connection on startup
db.connect()
  .then(() => console.log("Connected to database"))
  .catch(err => console.error("Database connection failed:", err.message));

// ── Health Check ───────────────────────────────────────────────────────────
// Visit http://localhost:3000/health to check the server is running
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Delivery API is running" });
});

// ── Auth Middleware ────────────────────────────────────────────────────────
// This checks that the admin is logged in before allowing certain actions
function requireAdmin(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Not authorized" });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ── Admin Login ────────────────────────────────────────────────────────────
// POST /auth/login — admin enters password, gets back a token
app.post("/auth/login", async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Password required" });

  const match = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
  if (!match) return res.status(401).json({ error: "Incorrect password" });

  const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, { expiresIn: "8h" });
  res.json({ token });
});

// ── Deliveries ─────────────────────────────────────────────────────────────

// GET /deliveries — get all deliveries (optionally filter by week)
app.get("/deliveries", async (req, res) => {
  try {
    const { weekStart } = req.query;
    let query = "SELECT * FROM deliveries";
    let params = [];

    if (weekStart) {
      query += " WHERE date_key >= $1 AND date_key <= $2";
      const start = new Date(weekStart + "T12:00:00");
      const end   = new Date(start);
      end.setDate(start.getDate() + 4);
      params = [
        start.toISOString().split("T")[0],
        end.toISOString().split("T")[0]
      ];
    }

    query += " ORDER BY date_key, slot";
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get deliveries" });
  }
});

// POST /deliveries — add a new delivery
app.post("/deliveries", async (req, res) => {
  const {
    dateKey, slot, salespersonName, salespersonEmail,
    orderNumber, phoneNumber, onsiteContact,
    preferredTime, address, deliveryNotes
  } = req.body;

  if (!dateKey || !slot) {
    return res.status(400).json({ error: "dateKey and slot are required" });
  }

  if (orderNumber && !/^S\d{7}$/.test(orderNumber)) {
    return res.status(400).json({ error: "Order number must be S followed by 7 digits" });
  }

  try {
    const result = await db.query(
      `INSERT INTO deliveries
        (date_key, slot, salesperson_name, salesperson_email, order_number,
         phone_number, onsite_contact, preferred_time, address, delivery_notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
       RETURNING *`,
      [dateKey, slot, salespersonName, salespersonEmail, orderNumber,
       phoneNumber, onsiteContact, preferredTime, address, deliveryNotes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "That slot is already taken" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to save delivery" });
  }
});

// PUT /deliveries/:id — update a delivery status (admin only)
app.put("/deliveries/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["pending", "approved", "cancelled"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const result = await db.query(
      "UPDATE deliveries SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Delivery not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update delivery" });
  }
});

// DELETE /deliveries/:id — remove a delivery (admin only)
app.delete("/deliveries/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM deliveries WHERE id=$1", [id]);
    res.json({ message: "Delivery deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete delivery" });
  }
});

// ── Blocked Days ───────────────────────────────────────────────────────────

// GET /blocked-days — get all blocked days
app.get("/blocked-days", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM blocked_days ORDER BY date_key");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get blocked days" });
  }
});

// POST /blocked-days — block a day (admin only)
app.post("/blocked-days", requireAdmin, async (req, res) => {
  const { dateKey, reason, note } = req.body;
  if (!dateKey || !reason) {
    return res.status(400).json({ error: "dateKey and reason are required" });
  }
  try {
    const result = await db.query(
      "INSERT INTO blocked_days (date_key, reason, note) VALUES ($1,$2,$3) RETURNING *",
      [dateKey, reason, note]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "That day is already blocked" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to block day" });
  }
});

// DELETE /blocked-days/:dateKey — unblock a day (admin only)
app.delete("/blocked-days/:dateKey", requireAdmin, async (req, res) => {
  const { dateKey } = req.params;
  try {
    await db.query("DELETE FROM blocked_days WHERE date_key=$1", [dateKey]);
    res.json({ message: "Day unblocked" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to unblock day" });
  }
});

// ── Cancelled Deliveries ───────────────────────────────────────────────────

// GET /cancelled-deliveries — get all cancelled deliveries
app.get("/cancelled-deliveries", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM cancelled_deliveries ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get cancelled deliveries" });
  }
});

// POST /cancelled-deliveries — save a cancelled delivery
app.post("/cancelled-deliveries", requireAdmin, async (req, res) => {
  const { originalKey, dateKey, slot, reason, orderNumber, salespersonName,
    salespersonEmail, phoneNumber, onsiteContact, preferredTime, address, deliveryNotes } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO cancelled_deliveries
        (original_key, date_key, slot, reason, order_number, salesperson_name,
         salesperson_email, phone_number, onsite_contact, preferred_time, address, delivery_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [originalKey, dateKey, slot, reason, orderNumber, salespersonName,
       salespersonEmail, phoneNumber, onsiteContact, preferredTime, address, deliveryNotes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save cancelled delivery" });
  }
});

// DELETE /cancelled-deliveries/:id — remove from cancelled list
app.delete("/cancelled-deliveries/:id", requireAdmin, async (req, res) => {
  try {
    await db.query("DELETE FROM cancelled_deliveries WHERE id=$1", [req.params.id]);
    res.json({ message: "Removed from cancelled list" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove cancelled delivery" });
  }
});

// ── Blocked Times ──────────────────────────────────────────────────────────

// GET /blocked-times — get all blocked times
app.get("/blocked-times", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM blocked_times ORDER BY date_key, preferred_time");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get blocked times" });
  }
});

// POST /blocked-times — block a time on a day (admin only)
app.post("/blocked-times", requireAdmin, async (req, res) => {
  const { dateKey, preferredTime } = req.body;
  if (!dateKey || !preferredTime) {
    return res.status(400).json({ error: "dateKey and preferredTime are required" });
  }
  try {
    const result = await db.query(
      "INSERT INTO blocked_times (date_key, preferred_time) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING *",
      [dateKey, preferredTime]
    );
    res.status(201).json(result.rows[0] || { dateKey, preferredTime });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to block time" });
  }
});

// DELETE /blocked-times/:dateKey/:preferredTime — unblock a time
app.delete("/blocked-times/:dateKey/:preferredTime", requireAdmin, async (req, res) => {
  try {
    await db.query(
      "DELETE FROM blocked_times WHERE date_key=$1 AND preferred_time=$2",
      [req.params.dateKey, req.params.preferredTime]
    );
    res.json({ message: "Time unblocked" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to unblock time" });
  }
});

// ── Start Server ───────────────────────────────────────────────────────────
app.listen(port, () => {
  console.log("Delivery API running at http://localhost:" + port);
});