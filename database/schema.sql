CREATE DATABASE IF NOT EXISTS smart_expense_tracker
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smart_expense_tracker;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  type ENUM('income', 'expense') NOT NULL,
  color CHAR(7) NOT NULL DEFAULT '#9B8AFB',
  icon VARCHAR(40) NOT NULL DEFAULT 'circle',
  is_default BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name_type (name, type)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  type ENUM('income', 'expense') NOT NULL,
  amount DECIMAL(13, 2) NOT NULL,
  date DATE NOT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  source VARCHAR(100) NOT NULL DEFAULT '',
  payment_method VARCHAR(50) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_transactions_user_date (user_id, date),
  KEY idx_transactions_user_type_date (user_id, type, date),
  KEY idx_transactions_user_category (user_id, category_id),
  CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_transactions_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT chk_transactions_amount CHECK (amount > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS budgets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(13, 2) NOT NULL,
  month DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_budgets_user_category_month (user_id, category_id, month),
  KEY idx_budgets_user_month (user_id, month),
  CONSTRAINT fk_budgets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_budgets_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT chk_budgets_amount CHECK (amount > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS financial_goals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  target_amount DECIMAL(13, 2) NOT NULL,
  saved_amount DECIMAL(13, 2) NOT NULL DEFAULT 0,
  target_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_goals_user (user_id),
  CONSTRAINT fk_goals_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_goal_target CHECK (target_amount > 0),
  CONSTRAINT chk_goal_saved CHECK (saved_amount >= 0)
) ENGINE=InnoDB;

INSERT IGNORE INTO categories (name, type, color, icon) VALUES
  ('Food', 'expense', '#F2A178', 'utensils'),
  ('Travel', 'expense', '#6C9CE6', 'plane'),
  ('Shopping', 'expense', '#C28AE8', 'shopping-bag'),
  ('Education', 'expense', '#74B7A3', 'book-open'),
  ('Bills', 'expense', '#E6B85C', 'receipt'),
  ('Healthcare', 'expense', '#E77F8A', 'heart-pulse'),
  ('Entertainment', 'expense', '#8D88E8', 'clapperboard'),
  ('Other', 'expense', '#8C9AA8', 'circle'),
  ('Salary', 'income', '#55AA88', 'briefcase'),
  ('Freelancing', 'income', '#6C9CE6', 'laptop'),
  ('Business', 'income', '#C28AE8', 'building'),
  ('Investment', 'income', '#E6B85C', 'trending-up'),
  ('Other', 'income', '#8C9AA8', 'circle');
