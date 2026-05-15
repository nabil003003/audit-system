"""
database.py — Gestion SQLite multi-rôles
Roles: admin | client | manager | auditor
"""
import sqlite3
import hashlib

DB_PATH = "./audit_system.db"

def _conn():
    c = sqlite3.connect(DB_PATH, check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c

def _hash(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

def init_db():
    c = _conn()
    c.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT    NOT NULL,
            email         TEXT    UNIQUE NOT NULL,
            password_hash TEXT    NOT NULL,
            role          TEXT    NOT NULL,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS audits (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            title         TEXT    NOT NULL,
            document_text TEXT    NOT NULL,
            status        TEXT    DEFAULT 'pending',
            client_id     INTEGER REFERENCES users(id),
            auditor_id    INTEGER REFERENCES users(id),
            manager_id    INTEGER REFERENCES users(id),
            report        TEXT,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    # Seed admin
    c.execute(
        "INSERT OR IGNORE INTO users (name,email,password_hash,role) VALUES (?,?,?,?)",
        ("Nabil Admin", "nabil@gmail.com", _hash("nabil"), "admin")
    )
    c.commit(); c.close()

def authenticate(email: str, password: str):
    c = _conn()
    row = c.execute(
        "SELECT * FROM users WHERE email=? AND password_hash=?",
        (email.strip().lower(), _hash(password))
    ).fetchone()
    c.close()
    return dict(row) if row else None

def create_user(name, email, password, role) -> bool:
    try:
        c = _conn()
        c.execute(
            "INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)",
            (name, email.strip().lower(), _hash(password), role)
        )
        c.commit(); c.close(); return True
    except sqlite3.IntegrityError:
        return False

def get_all_users():
    c = _conn()
    rows = c.execute("SELECT id,name,email,role,created_at FROM users ORDER BY id").fetchall()
    c.close(); return [dict(r) for r in rows]

def get_users_by_role(role: str):
    c = _conn()
    rows = c.execute("SELECT id,name,email FROM users WHERE role=?", (role,)).fetchall()
    c.close(); return [dict(r) for r in rows]

def create_audit(title, doc_text, client_id) -> int:
    c = _conn()
    cur = c.execute(
        "INSERT INTO audits (title,document_text,client_id) VALUES (?,?,?)",
        (title, doc_text, client_id)
    )
    aid = cur.lastrowid; c.commit(); c.close(); return aid

def get_audits_by_client(client_id):
    c = _conn()
    rows = c.execute("""
        SELECT a.*, u.name as auditor_name
        FROM audits a LEFT JOIN users u ON a.auditor_id=u.id
        WHERE a.client_id=? ORDER BY a.created_at DESC
    """, (client_id,)).fetchall()
    c.close(); return [dict(r) for r in rows]

def get_pending_audits():
    c = _conn()
    rows = c.execute("""
        SELECT a.*, u.name as client_name
        FROM audits a LEFT JOIN users u ON a.client_id=u.id
        WHERE a.status IN ('pending','assigned') ORDER BY a.created_at DESC
    """).fetchall()
    c.close(); return [dict(r) for r in rows]

def assign_audit(audit_id, auditor_id, manager_id):
    c = _conn()
    c.execute("""
        UPDATE audits SET auditor_id=?, manager_id=?, status='assigned',
        updated_at=CURRENT_TIMESTAMP WHERE id=?
    """, (auditor_id, manager_id, audit_id))
    c.commit(); c.close()

def get_audits_by_auditor(auditor_id):
    c = _conn()
    rows = c.execute("""
        SELECT a.*, u.name as client_name
        FROM audits a LEFT JOIN users u ON a.client_id=u.id
        WHERE a.auditor_id=? ORDER BY a.created_at DESC
    """, (auditor_id,)).fetchall()
    c.close(); return [dict(r) for r in rows]

def get_audit_by_id(audit_id):
    c = _conn()
    row = c.execute("SELECT * FROM audits WHERE id=?", (audit_id,)).fetchone()
    c.close(); return dict(row) if row else None

def save_report(audit_id, report):
    c = _conn()
    c.execute("""
        UPDATE audits SET report=?, status='completed', updated_at=CURRENT_TIMESTAMP WHERE id=?
    """, (report, audit_id))
    c.commit(); c.close()

def get_all_audits():
    c = _conn()
    rows = c.execute("""
        SELECT a.*,
               cl.name as client_name,
               au.name as auditor_name,
               mg.name as manager_name
        FROM audits a
        LEFT JOIN users cl ON a.client_id=cl.id
        LEFT JOIN users au ON a.auditor_id=au.id
        LEFT JOIN users mg ON a.manager_id=mg.id
        ORDER BY a.created_at DESC
    """).fetchall()
    c.close(); return [dict(r) for r in rows]
