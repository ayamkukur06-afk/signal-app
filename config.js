// ============================================
// KONFIGURASI SUPABASE — ganti dengan milikmu
// ============================================
// 1. Buat project di https://supabase.com
// 2. Ambil Project URL & anon public key di Settings → API
// 3. Isi di bawah ini

window.SIGNAL_CONFIG = {
  url: "https://befejcdphyvzixkdegyp.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZmVqY2RwaHl2eml4a2RlZ3lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MTgyMDAsImV4cCI6MjEwMTk5NDIwMH0.wcmjqZEXwR1bwT5-L7Yjs7a8C-85AKt0nvPEBx8ezKY",
};

// ============================================
// SQL setup (jalankan di SQL Editor Supabase):
// ============================================
//
// create table devices (
//   id uuid primary key,
//   username text not null,
//   device_name text,
//   battery int,
//   last_seen timestamptz default now(),
//   is_on boolean default false,
//   is_strobo boolean default false
// );
//
// alter table devices enable row level security;
//
// create policy "public read" on devices for select using (true);
// create policy "public insert" on devices for insert with check (true);
// create policy "public update" on devices for update using (true);
//
// alter publication supabase_realtime add table devices;
//
// Catatan: policy di atas terbuka untuk semua orang (cocok untuk
// pemakaian pribadi/demo). Untuk produksi, sebaiknya batasi update
// hanya boleh oleh pemilik device (misalnya pakai Supabase Auth).
