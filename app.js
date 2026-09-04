// =========================================================
// AUTH & LOGIN SYSTEM
// =========================================================
let deferredInstallPrompt = null;

// Capture PWA install prompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

function checkAuth() {
  const user = localStorage.getItem('maaliyadda_user');
  if (user) {
    hideLoginScreen();
    updateProfileUI(JSON.parse(user));
    return true;
  }
  showLoginScreen();
  return false;
}

function showLoginScreen() {
  document.getElementById('login-screen').classList.remove('hidden');
  initGoogleAuth();
}

function hideLoginScreen() {
  const loginScreen = document.getElementById('login-screen');
  loginScreen.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  loginScreen.style.opacity = '0';
  loginScreen.style.transform = 'scale(1.05)';
  setTimeout(() => {
    loginScreen.classList.add('hidden');
    loginScreen.style.opacity = '';
    loginScreen.style.transform = '';
  }, 500);
}

// Initialize Real Google Sign-In (GSI)
function initGoogleAuth() {
  if (typeof google === 'undefined') {
    setTimeout(initGoogleAuth, 500);
    return;
  }
  
  google.accounts.id.initialize({
    // TODO: BEDEL KAN! Ku qor Google Client ID-gaaga dhabta ah:
    client_id: "YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com",
    callback: handleGoogleResponse
  });

  google.accounts.id.renderButton(
    document.getElementById("google-button-container"),
    { theme: "outline", size: "large", width: 300, shape: "rectangular" }
  );

  // Optionally trigger One-Tap popup
  // google.accounts.id.prompt(); 
}

async function handleGoogleResponse(response) {
  // Decode JWT token from Google to get user details
  const payload = JSON.parse(atob(response.credential.split('.')[1]));
  
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: payload.email, 
        name: payload.name, 
        provider: 'google' 
      })
    });
    const user = await res.json();
    
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: payload.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=2563eb&color=fff`,
      loginMethod: 'google'
    };
    localStorage.setItem('maaliyadda_user', JSON.stringify(userData));
    updateProfileUI(userData);
    hideLoginScreen();
    showToast(`Soo dhawow, ${user.name}! ✨`);
  } catch (e) {
    showToast('Cilad ayaa dhacday, isku day mar kale.');
  }
}

async function signInWithEmail(e) {
  e.preventDefault();
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  
  // Gmail Strict Validation
  // 1. Waa inuu ku dhamaadaa @gmail.com
  // 2. Magaca hore waa inuu yahay 6 ilaa 30 xaraf
  // 3. Waa inuu ka kooban yahay xarfo, tirooyin, iyo dhibic (.) kaliya
  const gmailRegex = /^[a-z0-9.]{6,30}@gmail\.com$/;
  
  if (!gmailRegex.test(email)) {
    showToast('Fadlan geli Gmail sax ah (Tusaale: magacaaga@gmail.com)');
    emailInput.classList.add('border-red-500', 'ring-red-200');
    setTimeout(() => emailInput.classList.remove('border-red-500', 'ring-red-200'), 3000);
    return;
  }
  
  if (password.length < 6) {
    showToast('Password-ku waa inuu ugu yaraan 6 xaraf yahay!');
    passwordInput.classList.add('border-red-500', 'ring-red-200');
    setTimeout(() => passwordInput.classList.remove('border-red-500', 'ring-red-200'), 3000);
    return;
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, provider: 'local' })
    });
    const user = await res.json();
    
    if (res.ok) {
      const userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=2563eb&color=fff&size=128&bold=true`,
        loginMethod: 'email'
      };
      localStorage.setItem('maaliyadda_user', JSON.stringify(userData));
      updateProfileUI(userData);
      hideLoginScreen();
      showToast(`Soo dhawow, ${user.name}! ✨`);
    } else {
      showToast(user.error || 'Email ama Password khaldan!');
    }
  } catch (err) {
    showToast('Cilad ayaa dhacday, isku day mar kale.');
  }
}

function updateProfileUI(user) {
  // Update Settings profile
  const avatarEl = document.getElementById('settings-avatar');
  const nameEl = document.getElementById('settings-user-name');
  const emailEl = document.getElementById('settings-user-email');
  
  if (avatarEl && user.avatar) {
    avatarEl.innerHTML = `<img src="${user.avatar}" alt="${user.name}" class="w-full h-full object-cover rounded-full">`;
  }
  if (nameEl) nameEl.textContent = user.name;
  if (emailEl) emailEl.textContent = user.email;
  
  // Update sidebar user if exists
  const sidebarName = document.querySelector('aside .text-sm.font-semibold');
  const sidebarRole = document.querySelector('aside .text-xs.text-gray-500');
  if (sidebarName) sidebarName.textContent = user.name;
  if (sidebarRole) sidebarRole.textContent = user.email;
  
  // Update welcome message
  const welcomeH3 = document.querySelector('#view-dashboard h3.text-2xl');
  if (welcomeH3) welcomeH3.textContent = `Soo dhawoo, ${user.name.split(' ')[0]}! 👋`;
  
  // Auto-prompt install after 3 seconds if not done yet
  if (!localStorage.getItem('maaliyadda_install_prompted')) {
    setTimeout(() => {
      // Check if they are already running in standalone (installed) mode
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      if (!isStandalone) {
        installApp();
        localStorage.setItem('maaliyadda_install_prompted', 'true');
      }
    }, 3000);
  }
}

function logoutUser() {
  if (confirm('Ma hubtaa inaad ka baxdo?')) {
    localStorage.removeItem('maaliyadda_user');
    location.reload();
  }
}

function installApp() {
  // Check if modal already exists
  if (document.getElementById('install-guide-modal')) return;

  const modalHtml = `
    <div id="install-guide-modal" class="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 opacity-0 transition-opacity">
      <div class="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden transform scale-95 transition-transform duration-300">
        <div class="bg-indigo-600 p-6 text-center relative">
          <button onclick="document.getElementById('install-guide-modal').remove()" class="absolute top-4 right-4 text-white/70 hover:text-white">
            <i class="ph-bold ph-x text-xl"></i>
          </button>
          <div class="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <i class="ph-bold ph-device-mobile text-3xl text-white"></i>
          </div>
          <h3 class="text-xl font-bold text-white">Soo Dagso App-ka</h3>
        </div>
        <div class="p-6 space-y-4">
          <p class="text-sm text-gray-600 text-center mb-2">App-kan waa Web App (PWA). Si aad telefoonkaaga ugu rakibto, raac talaabooyinkan:</p>
          
          <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <h4 class="font-bold text-gray-800 text-sm mb-2 flex items-center gap-2"><i class="ph-fill ph-android-logo text-green-500 text-lg"></i> Android (Chrome)</h4>
            <ol class="text-xs text-gray-600 list-decimal list-inside space-y-1 ml-1">
              <li>Ka fur app-kan browser-ka <b>Chrome</b></li>
              <li>Riix saddexda dhibcood <b>(⋮)</b> ee kore</li>
              <li>Riix <b>"Add to Home screen"</b> ama <b>"Install app"</b></li>
            </ol>
          </div>
          
          <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <h4 class="font-bold text-gray-800 text-sm mb-2 flex items-center gap-2"><i class="ph-fill ph-apple-logo text-gray-800 text-lg"></i> iPhone (Safari)</h4>
            <ol class="text-xs text-gray-600 list-decimal list-inside space-y-1 ml-1">
              <li>Ka fur app-kan browser-ka <b>Safari</b></li>
              <li>Riix calaamada Share-ka <b>(⬆️)</b> ee hoose</li>
              <li>Riix <b>"Add to Home Screen"</b></li>
            </ol>
          </div>
          
          <button onclick="triggerNativeInstall()" class="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition-colors mt-4 flex items-center justify-center gap-2">
            <i class="ph-bold ph-download-simple text-lg"></i>
            Install App
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = document.getElementById('install-guide-modal');
  // Trigger reflow for animation
  void modal.offsetWidth;
  modal.classList.remove('opacity-0');
  modal.querySelector('.transform').classList.remove('scale-95');
}

function triggerNativeInstall() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        showToast('App-ka waa la soo dagay! 🎉');
      }
      deferredInstallPrompt = null;
      const modal = document.getElementById('install-guide-modal');
      if (modal) modal.remove();
    });
  } else {
    showToast('Browser-kan si toos ah uma ogola. Fadlan raac tilmaamaha kore! (Use Browser Menu)');
  }
}

// =========================================================
// STATE & DATA
// =========================================================
const state = {
  currentView: 'dashboard',
  settings: {
    unit: 'KG',
    commodity: 'Moos (Bananas)',
    thresholdDays: 2
  },
  systemDate: new Date('2026-09-04T09:00:00'),
  searchQuery: '',
  page: 1,
  pageSize: 12,
  merchants: []
};

state.merchants = []; 

// Fetch data from backend
async function fetchMerchants() {
  try {
    const res = await fetch('/api/merchants');
    state.merchants = await res.json();
    renderDashboard();
    renderCustomers();
  } catch (err) {
    console.error('Failed to fetch data:', err);
    showToast('Khalad ayaa dhacay markii xogta lasoo jiidayay!');
  }
}

// =========================================================
// HELPERS
// =========================================================
const fmtUSD = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const getUnit = () => state.settings.unit;
const fmtWeight = (n) => {
  if (state.settings.unit === 'Tons') return (n / 1000).toFixed(2) + ' t';
  if (state.settings.unit === 'Boxes') return Math.round(n / 18) + ' box';
  return n.toLocaleString('en-US') + ' kg';
};
const calcTotal = (m) => m.weight * m.rate;
const calcDebt = (m) => Math.max(0, calcTotal(m) - m.paid);
const getDaysLeft = (dateStr) => {
  const due = new Date(dateStr + 'T00:00:00');
  const sys = new Date(state.systemDate.toISOString().slice(0,10) + 'T00:00:00');
  return Math.round((due - sys) / 86400000);
};

function getStatus(m) {
  const debt = calcDebt(m);
  if (debt <= 0) return { type: 'clear', label: 'Waa la bixiyay', days: 0 };
  const days = getDaysLeft(m.dueDate);
  if (days <= 0) return { type: 'critical', label: 'Waqtigu wuu dhacay', days };
  if (days <= state.settings.thresholdDays) return { type: 'warning', label: 'Waqtigu wuu dhowyahay', days };
  return { type: 'normal', label: 'Waqti baa dhiman', days };
}

// =========================================================
// NAVIGATION & UI
// =========================================================
function navigate(viewName) {
  state.currentView = viewName;
  
  // Hide all views
  document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
  document.getElementById(`view-${viewName}`).classList.remove('hidden');
  
  // Update Title
  const titles = { dashboard: 'Dashboard', customers: 'Macaamiisha (Customers)', settings: 'Habaynta (Settings)' };
  document.getElementById('page-title').textContent = titles[viewName];
  
  // Update Nav highlighting
  document.querySelectorAll('.nav-btn-desktop, .nav-btn-mobile').forEach(el => {
    el.classList.remove('text-primary-600', 'bg-primary-50', 'active');
    el.classList.add('text-gray-500', 'hover:bg-gray-100');
    if(el.classList.contains('nav-btn-mobile')) {
      el.classList.add('hover:text-gray-600');
      el.classList.remove('hover:bg-gray-100');
    }
  });
  
  const dNav = document.getElementById(`nav-desktop-${viewName}`);
  if(dNav) {
    dNav.classList.add('text-primary-600', 'bg-primary-50', 'active');
    dNav.classList.remove('text-gray-500', 'hover:bg-gray-100');
  }
  const mNav = document.getElementById(`nav-mobile-${viewName}`);
  if(mNav) {
    mNav.classList.add('text-primary-600');
    mNav.classList.remove('text-gray-400', 'hover:text-gray-600');
  }

  // Reset pagination if going to customers
  if(viewName === 'customers') {
    state.page = 1;
    renderCustomers();
  }
}

// =========================================================
// RENDERERS
// =========================================================
function renderDashboard() {
  const totalW = state.merchants.reduce((s, m) => s + m.weight, 0);
  const totalR = state.merchants.reduce((s, m) => s + m.paid, 0);
  const totalD = state.merchants.reduce((s, m) => s + calcDebt(m), 0);
  const totalC = state.merchants.length;

  const kpis = [
    { label: 'Wadarta Miisaanka', val: fmtWeight(totalW), icon: 'ph-scales', color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Dakhliga La Helay', val: fmtUSD(totalR), icon: 'ph-money', color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Deynta Maqan', val: fmtUSD(totalD), icon: 'ph-warning-circle', color: 'text-red-600', bg: 'bg-red-100' },
    { label: 'Tirada Macaamiisha', val: totalC, icon: 'ph-users', color: 'text-purple-600', bg: 'bg-purple-100' },
  ];

  document.getElementById('kpi-container').innerHTML = kpis.map(k => `
    <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
      <div class="w-10 h-10 ${k.bg} rounded-xl flex items-center justify-center mb-3">
        <i class="ph-fill ${k.icon} ${k.color} text-xl"></i>
      </div>
      <p class="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">${k.label}</p>
      <p class="text-xl md:text-2xl font-bold text-gray-900 font-mono">${k.val}</p>
    </div>
  `).join('');

  // Add Financial Health Progress Bar
  const totalExpected = totalR + totalD;
  const collectionRate = totalExpected > 0 ? Math.round((totalR / totalExpected) * 100) : 0;
  
  const progressHtml = `
    <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mb-8">
      <div class="flex justify-between items-end mb-2">
        <div>
          <h3 class="font-bold text-gray-800">Xaaladda Maaliyadda (Financial Health)</h3>
          <p class="text-xs text-gray-500 mt-0.5">Heerka ururinta deynta ee guud ahaan ganacsiga</p>
        </div>
        <span class="text-2xl font-bold text-primary-600 font-mono">${collectionRate}%</span>
      </div>
      <div class="w-full bg-gray-100 rounded-full h-3 mb-1 overflow-hidden flex">
        <div class="bg-primary-500 h-3 transition-all duration-1000 ease-out" style="width: ${collectionRate}%"></div>
      </div>
      <div class="flex justify-between text-xs font-semibold text-gray-400 mt-2">
        <span>La Aruuriyay: ${fmtUSD(totalR)}</span>
        <span>Wadarta Guud: ${fmtUSD(totalExpected)}</span>
      </div>
    </div>
  `;

  // Insert progress bar before recent table
  document.getElementById('recent-table-body').parentElement.parentElement.parentElement.insertAdjacentHTML('beforebegin', progressHtml);

  // We need to clear previous progress bars to avoid duplicates when re-rendering
  const existingProgress = document.querySelectorAll('.bg-white.p-5.rounded-2xl.mb-8');
  if(existingProgress.length > 1) {
    existingProgress[0].remove();
  }

  // Recent 5
  const recent = [...state.merchants].reverse().slice(0, 5);
  document.getElementById('recent-table-body').innerHTML = recent.map(m => {
    const st = getStatus(m);
    let badgeClass = 'bg-gray-100 text-gray-700';
    if(st.type === 'clear') badgeClass = 'bg-green-100 text-green-700';
    if(st.type === 'warning') badgeClass = 'bg-yellow-100 text-yellow-700';
    if(st.type === 'critical') badgeClass = 'bg-red-100 text-red-700';

    return `
      <tr class="hover:bg-gray-50 transition-colors">
        <td class="px-5 py-3">
          <p class="font-bold text-gray-800">${m.name}</p>
          <p class="text-xs text-gray-500">${m.location}</p>
        </td>
        <td class="px-5 py-3 font-mono text-gray-700 font-medium">${fmtUSD(m.paid)}</td>
        <td class="px-5 py-3 font-mono font-bold ${calcDebt(m)>0 ? 'text-red-600' : 'text-gray-400'}">${fmtUSD(calcDebt(m))}</td>
        <td class="px-5 py-3">
          <span class="px-2.5 py-1 text-[10px] uppercase font-bold rounded-full ${badgeClass}">${st.label}</span>
        </td>
      </tr>
    `;
  }).join('');
}

function renderCustomers() {
  let filtered = state.merchants;
  const q = state.searchQuery.toLowerCase();
  if (q) {
    filtered = filtered.filter(m => m.name.toLowerCase().includes(q) || m.location.toLowerCase().includes(q) || m.phone.includes(q));
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  if (state.page > totalPages) state.page = totalPages;
  const start = (state.page - 1) * state.pageSize;
  const pageItems = filtered.slice(start, start + state.pageSize);

  document.getElementById('pagination-info').textContent = `Bogga ${state.page} ee ${totalPages} (Wadarta: ${filtered.length})`;
  document.getElementById('btn-prev').disabled = state.page === 1;
  document.getElementById('btn-next').disabled = state.page === totalPages;

  document.getElementById('customers-list').innerHTML = pageItems.map(m => {
    const st = getStatus(m);
    let borderC = 'border-gray-200', bgC = 'bg-white', iconC = 'text-gray-400';
    let alertMsg = '';
    
    if (st.type === 'critical') { borderC = 'border-red-200'; bgC = 'bg-red-50/30'; iconC = 'text-red-500'; alertMsg = `<span class="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-md">Waqtigu wuxuu dhacay ${Math.abs(st.days)} maalmood kahor</span>`; }
    else if (st.type === 'warning') { borderC = 'border-yellow-300'; bgC = 'bg-yellow-50/30'; iconC = 'text-yellow-600'; alertMsg = `<span class="text-xs font-bold text-yellow-700 bg-yellow-100 px-2 py-1 rounded-md">${st.days} maalmood baa hadhay</span>`; }
    else if (st.type === 'clear') { alertMsg = `<span class="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-md">Xisaab xiran ✅</span>`; }
    else { alertMsg = `<span class="text-xs font-medium text-gray-500">${st.days} maalmood baa dhiman</span>`; }

    const initials = m.name.split(' ').slice(0,2).map(n=>n[0]).join('');

    return `
      <div class="${bgC} border ${borderC} rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
        <div class="flex justify-between items-start mb-4">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-700 font-bold text-lg shrink-0">
              ${initials}
            </div>
            <div>
              <h4 class="font-bold text-gray-900 text-lg leading-tight">${m.name}</h4>
              <p class="text-xs text-gray-500 font-mono mt-0.5">${m.phone} • ${m.location}</p>
            </div>
          </div>
          <button onclick="showToast('Sms sent to ${m.phone}')" class="w-10 h-10 rounded-full bg-gray-50 hover:bg-primary-50 text-gray-400 hover:text-primary-600 flex items-center justify-center transition-colors">
            <i class="ph-fill ph-chat-circle-text text-xl ${iconC}"></i>
          </button>
        </div>

        <div class="grid grid-cols-2 gap-2 mb-4 bg-white/50 rounded-xl p-3 border border-gray-100">
          <div>
            <p class="text-[10px] uppercase font-bold text-gray-400">Miisaan & Qiime</p>
            <p class="font-mono text-sm font-semibold text-gray-800">${fmtWeight(m.weight)} @ ${fmtUSD(m.rate)}</p>
          </div>
          <div class="text-right">
            <p class="text-[10px] uppercase font-bold text-gray-400">Wadarta</p>
            <p class="font-mono text-sm font-bold text-gray-800">${fmtUSD(calcTotal(m))}</p>
          </div>
        </div>

        <div class="flex items-end justify-between border-t border-gray-100 pt-3">
          <div class="flex flex-col gap-1">
            <span class="text-[10px] uppercase font-bold text-gray-400">Deynta Hada Maqan</span>
            <span class="font-mono text-xl font-black ${calcDebt(m)>0 ? 'text-red-600' : 'text-green-600'}">${fmtUSD(calcDebt(m))}</span>
          </div>
          <div class="text-right flex flex-col items-end">
            ${alertMsg}
            <div class="flex gap-2 mt-2">
              <button onclick="deleteCustomer(${m.id})" class="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors text-xs font-bold flex items-center gap-1">
                <i class="ph-bold ph-trash"></i>
              </button>
              ${calcDebt(m) > 0 ? `
              <button onclick="payDebt(${m.id})" class="px-3 py-1.5 rounded-lg bg-primary-50 hover:bg-primary-100 text-primary-700 transition-colors text-xs font-bold flex items-center gap-1">
                <i class="ph-bold ph-hand-coins"></i> Bixi Lacag
              </button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  if(filtered.length === 0) {
    document.getElementById('customers-list').innerHTML = `
      <div class="col-span-full py-12 text-center text-gray-400">
        <i class="ph-fill ph-empty text-5xl mb-2 opacity-50"></i>
        <p>Lama helin macmiil.</p>
      </div>
    `;
  }
}

function changePage(delta) {
  state.page += delta;
  renderCustomers();
}

// =========================================================
// FORMS & MODALS
// =========================================================
function openAddModal() {
  document.getElementById('lbl-unit').textContent = state.settings.unit;
  document.getElementById('in-due').value = new Date(state.systemDate.getTime() + 7*86400000).toISOString().slice(0, 10);
  
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');
  // Trigger reflow
  void overlay.offsetWidth;
  overlay.classList.remove('opacity-0');
  overlay.classList.add('opacity-100');
}

function closeAddModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('opacity-100');
  overlay.classList.add('opacity-0');
  setTimeout(() => overlay.classList.add('hidden'), 300);
}

function deleteCustomer(id) {
  if(confirm('Ma hubtaa inaad tirtirto macmiilkan?')) {
    state.merchants = state.merchants.filter(m => m.id !== id);
    showToast('Macmiilka waa la tirtiray!');
    renderDashboard();
    renderCustomers();
  }
}

function payDebt(id) {
  const customer = state.merchants.find(m => m.id === id);
  if(customer) {
    const debt = calcDebt(customer);
    const amount = prompt(`Geli qaddarka lacagta uu bixinayo ${customer.name}\nDeynta lagu leeyahay: ${fmtUSD(debt)}`);
    if(amount !== null && !isNaN(parseFloat(amount))) {
      customer.paid += parseFloat(amount);
      showToast('Lacag bixinta waa la diiwaangeliyay!');
      renderDashboard();
      renderCustomers();
    }
  }
}

function updateFormTotal() {
  const w = parseFloat(document.getElementById('in-weight').value) || 0;
  const r = parseFloat(document.getElementById('in-rate').value) || 0;
  document.getElementById('form-total').textContent = fmtUSD(w * r);
}
document.getElementById('in-weight').addEventListener('input', updateFormTotal);
document.getElementById('in-rate').addEventListener('input', updateFormTotal);

async function submitForm(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('in-name').value,
    phone: document.getElementById('in-phone').value,
    location: document.getElementById('in-location').value,
    weight: parseFloat(document.getElementById('in-weight').value),
    rate: parseFloat(document.getElementById('in-rate').value),
    paid: parseFloat(document.getElementById('in-paid').value) || 0,
    dueDate: document.getElementById('in-due').value
  };

  try {
    const res = await fetch('/api/merchants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const newMerchant = await res.json();
    state.merchants.unshift(newMerchant);
    
    document.getElementById('add-form').reset();
    updateFormTotal();
    closeAddModal();
    showToast('Macmiil cusub si guul ah ayaa loo diiwaangeliyay!');
    
    if (state.currentView === 'customers') {
      state.searchQuery = '';
      document.getElementById('search-input').value = '';
      state.page = 1;
      renderCustomers();
    }
    renderDashboard();
  } catch (err) {
    showToast('Waa lagu guuldaraystay in la xafido!');
  }
}

// =========================================================
// SETTINGS
// =========================================================
function loadSettings() {
  document.getElementById('setting-unit').value = state.settings.unit || 'KG';
  document.getElementById('setting-commodity').value = state.settings.commodity || 'Moos (Bananas)';
  document.getElementById('setting-threshold').value = state.settings.thresholdDays || 2;
  
  if (document.getElementById('setting-currency')) {
    document.getElementById('setting-currency').value = state.settings.currency || 'USD';
  }
  if (document.getElementById('setting-sms')) {
    document.getElementById('setting-sms').checked = state.settings.smsEnabled !== false;
  }
}

function saveSettings() {
  state.settings.unit = document.getElementById('setting-unit').value;
  state.settings.commodity = document.getElementById('setting-commodity').value;
  state.settings.thresholdDays = parseInt(document.getElementById('setting-threshold').value);
  
  if (document.getElementById('setting-currency')) {
    state.settings.currency = document.getElementById('setting-currency').value;
  }
  if (document.getElementById('setting-sms')) {
    state.settings.smsEnabled = document.getElementById('setting-sms').checked;
  }
  
  showToast('Xogtaadii waa la xafiday si guul ah! (Settings Saved)');
  renderDashboard();
  if (state.currentView === 'customers') renderCustomers();
}

function deleteCustomer(id) {
  if(confirm('Ma hubtaa inaad tirtirto macmiilkan?')) {
    fetch(`/api/merchants/${id}`, { method: 'DELETE' })
      .then(() => {
        state.merchants = state.merchants.filter(m => m.id !== id);
        showToast('Macmiilka waa la tirtiray!');
        renderDashboard();
        renderCustomers();
      })
      .catch(() => showToast('Khalad ayaa dhacay!'));
  }
}

function payDebt(id) {
  const customer = state.merchants.find(m => m.id === id);
  if(customer) {
    const debt = calcDebt(customer);
    const amount = prompt(`Geli qaddarka lacagta uu bixinayo ${customer.name}\nDeynta lagu leeyahay: ${fmtUSD(debt)}`);
    if(amount !== null && !isNaN(parseFloat(amount))) {
      const payAmount = parseFloat(amount);
      fetch(`/api/merchants/${id}/pay`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: payAmount })
      })
      .then(() => {
        customer.paid += payAmount;
        showToast('Lacag bixinta waa la diiwaangeliyay!');
        renderDashboard();
        renderCustomers();
      })
      .catch(() => showToast('Khalad ayaa dhacay!'));
    }
  }
}

// =========================================================
// TOAST NOTIFICATIONS
// =========================================================
function showToast(message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'bg-gray-900/95 backdrop-blur text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 toast-anim pointer-events-auto';
  toast.innerHTML = `
    <i class="ph-fill ph-check-circle text-green-400 text-xl"></i>
    <p class="text-sm font-medium flex-1">${message}</p>
  `;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// =========================================================
// INIT
// =========================================================
document.getElementById('search-input').addEventListener('input', (e) => {
  state.searchQuery = e.target.value;
  state.page = 1;
  renderCustomers();
});

document.getElementById('header-date').textContent = state.systemDate.toLocaleDateString('so-SO', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });

// Initialize
checkAuth();
loadSettings();
fetchMerchants();
