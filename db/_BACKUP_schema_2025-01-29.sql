-- BACKUP OF schema.sql from 2025-01-29
-- This file is a backup before updating from Supabase database

-- Core schema for Exam App
-- Safe to run repeatedly due to IF NOT EXISTS

-- Extensions
create extension if not exists pgcrypto;

-- Tables
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text null,
  start_time timestamptz null,
  end_time timestamptz null,
  duration_minutes integer null,
  status text not null default 'draft' check (status in ('draft','published','archived','done')),
  access_type text not null default 'open' check (access_type in ('open','code_based','ip_restricted')),
  exam_type text not null default 'exam' check (exam_type in ('exam','homework','quiz')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- (rest of schema truncated for brevity in backup)
