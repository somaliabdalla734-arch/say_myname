const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve frontend files

// Connect to// Initialize Database
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    
    // Create users table for advanced auth
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        password TEXT,
        provider TEXT DEFAULT 'local',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS merchants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT,
        location TEXT,
        weight REAL,
        rate REAL,
        paid REAL,
        dueDate TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
});

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// Simple login/register (In a real app, use bcrypt & JWT)
app.post('/api/auth/login', (req, res) => {
  const { email, password, name, provider } = req.body;
  
  if (provider === 'google') {
    // For Google, we trust the email verified by Google frontend
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) {
        // Auto-register google user
        db.run('INSERT INTO users (name, email, provider) VALUES (?, ?, ?)', [name, email, 'google'], function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ id: this.lastID, name, email, provider: 'google' });
        });
      } else {
        res.json(user);
      }
    });
  } else {
    // Email/Password login
    db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password], (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) {
        // Auto-register for this demo if not exists, so the user doesn't get stuck
        db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [email.split('@')[0], email, password], function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ id: this.lastID, name: email.split('@')[0], email, provider: 'local' });
        });
      } else {
        res.json(user);
      }
    });
  }
});

// ==========================================
// API ROUTES (Merchants)
// ==========================================
app.get('/api/merchants', (req, res) => {
  db.all('SELECT * FROM merchants ORDER BY dueDate ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/merchants', (req, res) => {
  const { name, phone, location, weight, rate, paid, dueDate } = req.body;
  const sql = `INSERT INTO merchants (name, phone, location, weight, rate, paid, dueDate) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [name, phone, location, weight, rate, paid, dueDate], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name, phone, location, weight, rate, paid, dueDate });
  });
});

app.delete('/api/merchants/:id', (req, res) => {
  db.run('DELETE FROM merchants WHERE id = ?', req.params.id, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

app.patch('/api/merchants/:id/pay', (req, res) => {
  const { amount } = req.body;
  db.run('UPDATE merchants SET paid = paid + ? WHERE id = ?', [amount, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ updated: this.changes });
  });
});

// Fallback to index.html for SPA
app.get('{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
