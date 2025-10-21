import { getPool } from '../src/db.js';
import dotenv from 'dotenv';

dotenv.config();

const sql = `
-- Drop existing tables that need schema changes (only needed once - now commented out)
-- DROP TABLE IF EXISTS tasks CASCADE;
-- DROP TABLE IF EXISTS documents CASCADE;

-- Core Tables
CREATE TABLE IF NOT EXISTS users (
  id uuid primary key,
  email text unique not null,
  name text,
  first_name text,
  last_name text,
  role text default 'client',
  password_hash text not null
);

CREATE TABLE IF NOT EXISTS projects (
  id uuid primary key,
  title text not null,
  status text default 'Active',
  owner_id uuid references users(id),
  created_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid primary key,
  sender_id uuid references users(id),
  sender_name text,
  subject text,
  body text,
  read boolean default false,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS events (
  id uuid primary key,
  title text not null,
  date date,
  attendees jsonb default '[]'::jsonb,
  owner_id uuid references users(id),
  created_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS contracts (
  id uuid primary key,
  title text,
  status text,
  created_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS contact_submissions (
  id uuid primary key,
  name text,
  email text,
  firm text,
  phone text,
  comments text,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS ai_interactions (
  id uuid primary key,
  user_id uuid references users(id),
  query text not null,
  response text not null,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid primary key,
  title text not null,
  description text,
  status varchar(50) default 'pending',
  priority varchar(20) default 'medium',
  due_date timestamptz,
  assignee_id uuid references users(id),
  project_id uuid references projects(id),
  created_by uuid references users(id),
  completed_at timestamptz,
  tags jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS documents (
  id uuid primary key,
  filename text not null,
  original_filename text not null,
  file_size bigint,
  mime_type text,
  category varchar(100),
  description text,
  storage_path text not null,
  uploaded_by uuid references users(id),
  access_level varchar(50) default 'private',
  tags jsonb default '[]'::jsonb,
  confidential boolean default false,
  project_id uuid references projects(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CRM Tables
CREATE TABLE IF NOT EXISTS crm_contacts (
  id uuid primary key,
  first_name varchar(100),
  last_name varchar(100),
  email varchar(255) unique,
  phone varchar(50),
  company varchar(255),
  title varchar(255),
  industry varchar(100),
  source varchar(100),
  status varchar(50) default 'active',
  tags jsonb default '[]',
  notes text,
  linkedin_url varchar(500),
  website varchar(500),
  address text,
  created_by uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS crm_interactions (
  id uuid primary key,
  contact_id uuid references crm_contacts(id),
  user_id uuid references users(id),
  type varchar(50) not null,
  subject varchar(500),
  content text,
  direction varchar(20),
  email_message_id varchar(255),
  calendar_event_id varchar(255),
  project_id uuid,
  metadata jsonb default '{}',
  occurred_at timestamptz default now(),
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS crm_opportunities (
  id uuid primary key,
  contact_id uuid references crm_contacts(id),
  title varchar(255) not null,
  description text,
  value numeric(15,2),
  probability integer default 50,
  stage varchar(100) default 'prospecting',
  expected_close_date date,
  actual_close_date date,
  assigned_to uuid references users(id),
  source varchar(100),
  tags jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS crm_email_accounts (
  id uuid primary key,
  user_id uuid references users(id),
  provider varchar(50) not null,
  email_address varchar(255) not null,
  access_token text,
  refresh_token text,
  account_info jsonb default '{}',
  sync_enabled boolean default true,
  last_sync timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS crm_activities (
  id uuid primary key,
  contact_id uuid references crm_contacts(id),
  opportunity_id uuid references crm_opportunities(id),
  user_id uuid references users(id),
  activity_type varchar(100) not null,
  title varchar(255),
  description text,
  status varchar(50) default 'pending',
  due_date timestamptz,
  completed_at timestamptz,
  priority varchar(20) default 'medium',
  created_at timestamptz default now()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crm_contacts(email);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_company ON crm_contacts(company);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_contact_id ON crm_interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_type ON crm_interactions(type);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_contact_id ON crm_opportunities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_stage ON crm_opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_crm_activities_contact_id ON crm_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_due_date ON crm_activities(due_date);
`;

async function run() {
  const pool = getPool();
  if (!pool) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  
  await pool.query(sql);
  console.log('Migrations applied successfully');
  process.exit(0);
}

run().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});