// ===================================================
// SIGNAL — kontrol flash & strobo multi-perangkat
// ===================================================

const TABLE = 'devices';
const USERS_TABLE = 'users';
let supabase = null;
let myId = null;
let myUsername = null;
let myRole = null;
let devicesMap = {};
let openModalId = null;
let track = null;
let wakeLock = null;
let stroboTimer = null;

const el = {
  onboarding: document.getElementById('onboarding'),
  usernameInput: document.getElementById('usernameInput'),
  passwordInput: document.getElementById('passwordInput'),
  startBtn: document.getElementById('startBtn'),
  onboardStatus: document.getElementById('onboardStatus'),
  app: document.getElementById('app'),
  adminBtn: document.getElementById('adminBtn'),
  selfStatus: document.getElementById('selfStatus'),
  deviceList: document.getElementById('deviceList'),
  screenFlash: document.getElementById('screenFlash'),
  modal: document.getElementById('controlModal'),
  modalDeviceLabel: document.getElementById('modalDeviceLabel'),
  modalDeviceName: document.getElementById('modalDeviceName'),
  modalDeviceMeta: document.getElementById('modalDeviceMeta'),
  modalLamp: document.getElementById('modalLamp'),
  modalLampLabel: document.getElementById('modalLampLabel'),
  modalFlashBtn: document.getElementById('modalFlashBtn'),
  modalStroboBtn: document.getElementById('modalStroboBtn'),
  closeModal: document.getElementById('closeModal'),
  adminModal: document.getElementById('adminModal'),
  closeAdminModal: document.getElementById('closeAdminModal'),
  adminUserList: document.getElementById('adminUserList'),
  newUsername: document.getElementById('newUsername'),
  newPassword: document.getElementById('newPassword'),
  newRole: document.getElementById('newRole'),
  createUserBtn: document.getElementById('createUserBtn'),
  adminStatus: document.getElementById('adminStatus'),
  chatBtn: document.getElementById('chatBtn'),
  chatModal: document.getElementById('chatModal'),
  closeChatModal: document.getElementById('closeChatModal'),
  chatList: document.getElementById('chatList'),
  chatInput: document.getElementById('chatInput'),
  sendChatBtn: document.getElementById('sendChatBtn'),
};

const MESSAGES_TABLE = 'messages';
let chatSubscribed = false;

// ---------- Utilities ----------
function uuid(){
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>{
    const r = Math.random()*16|0;
    const v = c==='x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

async function sha256Hex(str){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

function guessDeviceName(){
  const ua = navigator.userAgent;
  let os = 'Perangkat';
  if(/iPhone/.test(ua)) os = 'iPhone';
  else if(/iPad/.test(ua)) os = 'iPad';
  else if(/Android/.test(ua)) os = 'Android';
  else if(/Macintosh/.test(ua)) os = 'Mac';
  else if(/Windows/.test(ua)) os = 'Windows';
  else if(/Linux/.test(ua)) os = 'Linux';

  let browser = '';
  if(/Edg\//.test(ua)) browser = 'Edge';
  else if(/Chrome\//.test(ua)) browser = 'Chrome';
  else if(/Firefox\//.test(ua)) browser = 'Firefox';
  else if(/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';

  return browser ? `${os} · ${browser}` : os;
}

async function getBatteryLevel(){
  try{
    if(navigator.getBattery){
      const b = await navigator.getBattery();
      b.addEventListener('levelchange', ()=>{
        updateSelfField({ battery: Math.round(b.level*100) });
      });
      return Math.round(b.level*100);
    }
  }catch(e){}
  return null;
}

function timeAgoIsOnline(lastSeenIso){
  const diff = Date.now() - new Date(lastSeenIso).getTime();
  return diff < 30000;
}

function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- Login ----------
el.startBtn.addEventListener('click', handleLogin);
[el.usernameInput, el.passwordInput].forEach(inp=>{
  inp.addEventListener('keydown', e=>{ if(e.key === 'Enter') handleLogin(); });
});

async function handleLogin(){
  try{
    if(!el.usernameInput || !el.passwordInput){
      el.onboardStatus.textContent = 'File index.html tidak cocok dengan script.js — pastikan semua file versi terbaru.';
      return;
    }
    const username = el.usernameInput.value.trim();
    const password = el.passwordInput.value;
    if(!username || !password){
      el.onboardStatus.textContent = 'Isi username dan password.';
      return;
    }
    if(!window.SIGNAL_CONFIG || !window.SIGNAL_CONFIG.url || window.SIGNAL_CONFIG.url.includes('xxxx')){
      el.onboardStatus.textContent = 'Isi dulu config.js dengan kredensial Supabase kamu.';
      return;
    }
    if(!window.supabase || typeof window.supabase.createClient !== 'function'){
      el.onboardStatus.textContent = 'Gagal memuat library Supabase — cek koneksi internet.';
      return;
    }
    if(!window.crypto || !window.crypto.subtle){
      el.onboardStatus.textContent = 'Browser ini tidak mendukung enkripsi (crypto.subtle). Coba buka lewat https:// atau browser lain.';
      return;
    }

    if(!supabase) supabase = window.supabase.createClient(window.SIGNAL_CONFIG.url, window.SIGNAL_CONFIG.anonKey);

    el.onboardStatus.textContent = 'Memeriksa...';
    const hash = await sha256Hex(password);
    const { data, error } = await supabase.from(USERS_TABLE).select('*').eq('username', username).maybeSingle();

    if(error){
      el.onboardStatus.textContent = 'Gagal terhubung ke Supabase: ' + error.message;
      return;
    }
    if(!data){
      el.onboardStatus.textContent = 'Username tidak ditemukan.';
      return;
    }
    if(data.password_hash !== hash){
      el.onboardStatus.textContent = 'Password salah.';
      return;
    }

    myUsername = username;
    myRole = data.role;
    localStorage.setItem('signal_username', username);
    localStorage.setItem('signal_role', myRole);
    await initApp();
  }catch(err){
    if(el.onboardStatus) el.onboardStatus.textContent = 'Error: ' + (err && err.message ? err.message : String(err));
  }
}

// ---------- Init after login ----------
async function initApp(){
  if(!supabase) supabase = window.supabase.createClient(window.SIGNAL_CONFIG.url, window.SIGNAL_CONFIG.anonKey);

  myId = localStorage.getItem('signal_device_id');
  if(!myId){
    myId = uuid();
    localStorage.setItem('signal_device_id', myId);
  }

  const deviceName = guessDeviceName();
  const battery = await getBatteryLevel();

  const { data: existing } = await supabase.from(TABLE).select('*').eq('id', myId).maybeSingle();
  if(existing){
    await supabase.from(TABLE).update({
      username: myUsername, device_name: deviceName, battery, role: myRole, last_seen: new Date().toISOString()
    }).eq('id', myId);
  } else {
    await supabase.from(TABLE).insert({
      id: myId, username: myUsername, device_name: deviceName, battery, role: myRole,
      last_seen: new Date().toISOString(), is_on: false, is_strobo: false
    });
  }

  const { data: rows } = await supabase.from(TABLE).select('*');
  (rows || []).forEach(r => devicesMap[r.id] = r);

  el.onboarding.classList.add('hidden');
  el.app.classList.remove('hidden');
  if(myRole === 'owner') el.adminBtn.classList.remove('hidden');

  renderSelfStatus();
  renderDeviceList();

  subscribeRealtime();
  subscribeChat();
  startHeartbeat();
  requestCameraBackground();
  requestWakeLock();

  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState === 'visible') requestWakeLock();
  });
}

// ---------- Realtime ----------
function subscribeRealtime(){
  supabase.channel('devices_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, payload => {
      if(payload.eventType === 'DELETE'){
        delete devicesMap[payload.old.id];
      } else {
        devicesMap[payload.new.id] = payload.new;
        if(payload.new.id === myId){
          applyPhysicalLight(payload.new.is_on, payload.new.is_strobo);
        }
      }
      renderDeviceList();
      renderSelfStatus();
      if(openModalId && devicesMap[openModalId]) renderModal(devicesMap[openModalId]);
    })
    .subscribe();
}

// ---------- Heartbeat ----------
function startHeartbeat(){
  setInterval(async ()=>{
    const battery = await getBatteryLevel();
    await updateSelfField({ last_seen: new Date().toISOString(), ...(battery!=null?{battery}:{}) });
  }, 15000);
  setInterval(renderDeviceList, 5000);
}

async function updateSelfField(fields){
  if(!supabase || !myId) return;
  await supabase.from(TABLE).update(fields).eq('id', myId);
}

// ---------- Rendering: self status ----------
function renderSelfStatus(){
  const me = devicesMap[myId];
  if(!me) return;
  el.selfStatus.innerHTML = `
    <span class="dot"></span>
    <span class="name">${escapeHtml(me.username)}</span>
    <span class="role-badge role-${me.role||'member'}">${escapeHtml(me.role||'member')}</span>
    <span class="meta">· ${escapeHtml(me.device_name || '')}</span>
    <span class="battery">${me.battery != null ? me.battery + '%' : ''}</span>
  `;
}

// ---------- Rendering: device list ----------
function renderDeviceList(){
  const rows = Object.values(devicesMap).sort((a,b)=> (a.id===myId?-1: b.id===myId?1: a.username.localeCompare(b.username)));
  if(rows.length === 0){
    el.deviceList.innerHTML = `<div class="empty-note">Belum ada perangkat lain. Buka halaman ini di HP lain untuk menambahkannya ke daftar.</div>`;
    return;
  }
  el.deviceList.innerHTML = rows.map(r=>{
    const online = timeAgoIsOnline(r.last_seen);
    const isMe = r.id === myId;
    const statusText = r.is_strobo ? 'STROBO' : (r.is_on ? 'ON' : (online ? 'siap' : 'offline'));
    const statusClass = r.is_strobo ? 'strobo' : (r.is_on ? 'on' : '');
    return `
      <div class="device-item ${r.is_on||r.is_strobo ? 'active-light':''}" data-id="${r.id}">
        <span class="dot" style="background:${online?'var(--green)':'var(--line)'};box-shadow:${online?'0 0 6px var(--green)':'none'}"></span>
        <div class="info">
          <div class="name">${escapeHtml(r.username)} ${isMe?'<span class="badge">Kamu</span>':''} <span class="role-badge role-${r.role||'member'}">${escapeHtml(r.role||'member')}</span></div>
          <div class="sub">${escapeHtml(r.device_name||'')} ${r.battery!=null ? '· '+r.battery+'%':''}</div>
        </div>
        <div class="status-icon ${statusClass}">${statusText}</div>
      </div>
    `;
  }).join('');

  el.deviceList.querySelectorAll('.device-item').forEach(item=>{
    item.addEventListener('click', ()=> openModal(item.dataset.id));
  });
}

// ---------- Modal control (flash/strobo) ----------
function openModal(id){
  openModalId = id;
  const row = devicesMap[id];
  if(!row) return;
  el.modal.classList.remove('hidden');
  renderModal(row);
}
el.closeModal.addEventListener('click', ()=>{
  openModalId = null;
  el.modal.classList.add('hidden');
});

function renderModal(row){
  el.modalDeviceLabel.textContent = row.id === myId ? 'Perangkat kamu' : 'Kontrol jarak jauh';
  el.modalDeviceName.textContent = row.username;
  el.modalDeviceMeta.textContent = `${row.device_name || ''} ${row.battery!=null ? '· '+row.battery+'%':''} ${timeAgoIsOnline(row.last_seen)?'· online':'· offline'}`;

  el.modalLamp.classList.toggle('on', row.is_on || row.is_strobo);
  el.modalLamp.classList.toggle('strobo', row.is_strobo);
  el.modalLampLabel.textContent = row.is_strobo ? 'STROBO' : (row.is_on ? 'ON' : 'OFF');

  el.modalFlashBtn.classList.toggle('active', row.is_on && !row.is_strobo);
  el.modalStroboBtn.classList.toggle('active', row.is_strobo);
}

el.modalFlashBtn.addEventListener('click', async ()=>{
  const row = devicesMap[openModalId];
  if(!row) return;
  await supabase.from(TABLE).update({ is_on: !row.is_on, is_strobo: false }).eq('id', openModalId);
});
el.modalStroboBtn.addEventListener('click', async ()=>{
  const row = devicesMap[openModalId];
  if(!row) return;
  await supabase.from(TABLE).update({ is_strobo: !row.is_strobo, is_on: false }).eq('id', openModalId);
});

// ---------- Admin panel (khusus owner) ----------
el.adminBtn.addEventListener('click', openAdminPanel);
el.closeAdminModal.addEventListener('click', ()=> el.adminModal.classList.add('hidden'));
el.createUserBtn.addEventListener('click', createUser);

async function openAdminPanel(){
  el.adminModal.classList.remove('hidden');
  el.adminStatus.textContent = '';
  await loadUsers();
}

async function loadUsers(){
  const { data, error } = await supabase.from(USERS_TABLE).select('id, username, role, created_at').order('created_at', { ascending: true });
  if(error){
    el.adminUserList.innerHTML = `<div class="empty-note">Gagal memuat daftar pengguna.</div>`;
    return;
  }
  el.adminUserList.innerHTML = data.map(u=>`
    <div class="admin-user-row" data-id="${u.id}">
      <span class="uname">${escapeHtml(u.username)}</span>
      <span class="role-badge role-${u.role}">${escapeHtml(u.role)}</span>
      ${u.username !== myUsername ? `<span class="del" data-del="${u.id}">×</span>` : ''}
    </div>
  `).join('');

  el.adminUserList.querySelectorAll('[data-del]').forEach(btn=>{
    btn.addEventListener('click', ()=> deleteUser(btn.dataset.del));
  });
}

async function createUser(){
  const username = el.newUsername.value.trim();
  const password = el.newPassword.value;
  const role = el.newRole.value;
  el.adminStatus.textContent = '';

  if(!username || !password){
    el.adminStatus.textContent = 'Isi username dan password.';
    return;
  }
  const hash = await sha256Hex(password);
  const { error } = await supabase.from(USERS_TABLE).insert({ username, password_hash: hash, role });
  if(error){
    el.adminStatus.textContent = error.code === '23505' ? 'Username sudah dipakai.' : 'Gagal menambahkan pengguna.';
    return;
  }
  el.newUsername.value = '';
  el.newPassword.value = '';
  await loadUsers();
}

async function deleteUser(id){
  if(!confirm('Hapus pengguna ini?')) return;
  await supabase.from(USERS_TABLE).delete().eq('id', id);
  await loadUsers();
}

// ---------- Chat global ----------
el.chatBtn.addEventListener('click', openChatPanel);
el.closeChatModal.addEventListener('click', ()=> el.chatModal.classList.add('hidden'));
el.sendChatBtn.addEventListener('click', sendChatMessage);
el.chatInput.addEventListener('keydown', e=>{ if(e.key === 'Enter') sendChatMessage(); });

async function openChatPanel(){
  el.chatModal.classList.remove('hidden');
  await loadMessages();
  scrollChatToBottom();
}

async function loadMessages(){
  const { data, error } = await supabase.from(MESSAGES_TABLE)
    .select('*').order('created_at', { ascending: true }).limit(100);
  if(error) return;
  renderMessages(data);
}

function renderMessages(rows){
  el.chatList.innerHTML = rows.map(m=>{
    const own = m.username === myUsername;
    const time = new Date(m.created_at).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
    return `
      <div class="chat-msg ${own?'own':''}" data-id="${m.id}">
        <div class="meta-row">
          <span class="uname">${escapeHtml(m.username)}</span>
          <span class="role-badge role-${m.role||'member'}">${escapeHtml(m.role||'member')}</span>
          <span class="time">${time}</span>
          ${myRole==='owner' ? `<span class="del" data-del-msg="${m.id}">×</span>` : ''}
        </div>
        <div class="content">${escapeHtml(m.content)}</div>
      </div>
    `;
  }).join('');

  el.chatList.querySelectorAll('[data-del-msg]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      await supabase.from(MESSAGES_TABLE).delete().eq('id', btn.dataset.delMsg);
    });
  });
}

async function sendChatMessage(){
  const content = el.chatInput.value.trim();
  if(!content) return;
  el.chatInput.value = '';
  await supabase.from(MESSAGES_TABLE).insert({ username: myUsername, role: myRole, content });
}

function subscribeChat(){
  if(chatSubscribed) return;
  chatSubscribed = true;
  supabase.channel('messages_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: MESSAGES_TABLE }, async ()=>{
      if(!el.chatModal.classList.contains('hidden')){
        await loadMessages();
        scrollChatToBottom();
      }
    })
    .subscribe();
}

function scrollChatToBottom(){
  el.chatList.scrollTop = el.chatList.scrollHeight;
}

// ---------- Physical light (this device only) ----------
function applyPhysicalLight(isOn, isStrobo){
  clearInterval(stroboTimer);
  stroboTimer = null;

  if(isStrobo){
    let blinkOn = true;
    stroboTimer = setInterval(()=>{
      blinkOn = !blinkOn;
      setLight(blinkOn);
    }, 130);
  } else {
    setLight(isOn);
  }
}

function setLight(on){
  if(track){
    track.applyConstraints({ advanced: [{ torch: on }] }).catch(()=>{});
  }
  el.screenFlash.style.display = on ? 'block' : 'none';
}

// ---------- Camera (best effort background) ----------
async function requestCameraBackground(){
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    track = stream.getVideoTracks()[0];
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    if(!caps.torch) track = null;
  }catch(e){
    track = null;
  }
}

// Catatan jujur: browser membatasi eksekusi JS & kamera saat tab
// di-minimize atau layar dikunci — tidak ada API web yang bisa
// menjamin torch tetap menyala 100% di background. Wake Lock di
// bawah ini membantu mencegah layar terkunci selama halaman dibuka,
// tapi begitu tab benar-benar ditutup/di-suspend, torch akan mati.
async function requestWakeLock(){
  try{
    if('wakeLock' in navigator){
      wakeLock = await navigator.wakeLock.request('screen');
    }
  }catch(e){}
}

// ---------- Resume session (kalau sudah pernah login) ----------
window.addEventListener('load', ()=>{
  const savedName = localStorage.getItem('signal_username');
  const savedRole = localStorage.getItem('signal_role');
  if(savedName && savedRole){
    myUsername = savedName;
    myRole = savedRole;
    supabase = window.supabase.createClient(window.SIGNAL_CONFIG.url, window.SIGNAL_CONFIG.anonKey);
    initApp();
  }
});
