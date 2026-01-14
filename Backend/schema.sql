-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  phone_number VARCHAR(20) UNIQUE,
  password VARCHAR(255) NOT NULL,
  phone_verified BOOLEAN DEFAULT FALSE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on phone_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
