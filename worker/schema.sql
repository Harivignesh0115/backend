DROP TABLE IF EXISTS appointments;

CREATE TABLE appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  phone TEXT,
  email TEXT,
  concern TEXT,
  date TEXT,
  time TEXT,
  status TEXT DEFAULT 'booked',
  appointmentDateTime TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);
