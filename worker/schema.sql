DROP TABLE IF EXISTS appointments;

CREATE TABLE appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  phone TEXT,
  email TEXT,
  concern TEXT,
  date TEXT,
  time TEXT,
  status TEXT DEFAULT 'booked'
);