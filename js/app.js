// ==================== APP.JS - Main App, Top Navigation & Router ====================
window.LMS = window.LMS || {};

// ==================== THEME TOGGLE COMPONENT ====================
LMS.ThemeToggle = () => {
  const { Icons } = LMS;
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('lms_theme');
    return saved === 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('lms_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return html`
    <button 
      class="theme-toggle-btn" 
      onClick=${() => setIsDark(!isDark)}
      title=${isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      ${isDark ? html`<${Icons.Sun} />` : html`<${Icons.Moon} />`}
    </button>
  `;
};

// ==================== TOP NAVIGATION ====================
LMS.TopNavbar = ({ currentPage, setCurrentPage, onLogout, isMobileOpen, setIsMobileOpen }) => {
  const { settings, showToast } = useContext(LMS.AppContext);
  const { Icons } = LMS;

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Icons.Dashboard },
    { id: 'students', label: 'Students', icon: Icons.Students },
    { id: 'seats', label: 'Seats & Halls', icon: Icons.Seats },
    { id: 'accounts', label: 'Accounts', icon: Icons.Payments },
    { id: 'attendance', label: 'Attendance', icon: Icons.Log },
    { id: 'activity', label: 'Activity', icon: Icons.Log },
    { id: 'settings', label: 'Settings', icon: Icons.Settings },
  ];

  const handleNavClick = (id) => {
    setCurrentPage(id);
    if (window.innerWidth <= 768) setIsMobileOpen(false);
  };

  return html`
    <nav class="navbar glass">
      <div class="navbar-container">
        <!-- Mobile Menu Button -->
        <button class="mobile-menu-btn md:hidden" onClick=${() => setIsMobileOpen(!isMobileOpen)}>
          <${Icons.Menu} />
        </button>

        <!-- Logo -->
        <div class="nav-logo">
          <div class="logo-icon">📚</div>
          <div class="logo-text hidden md:block">
            <h1>${settings.libraryName}</h1>
            <p>Management System</p>
          </div>
        </div>

        <!-- Navigation Links -->
        <div class="nav-links ${isMobileOpen ? 'open' : ''}">
          ${menuItems.map(item => html`
            <button 
              key=${item.id} 
              onClick=${() => handleNavClick(item.id)}
              class="nav-link ${currentPage === item.id ? 'active' : ''} click-press"
            >
              <${item.icon} />
              <span>${item.label}</span>
            </button>
          `)}
        </div>

        <!-- Right Side Actions -->
        <div class="nav-actions">
           <div class="text-xs text-gray-400 mr-2 hidden md:block"><${LMS.SyncStatus} /></div>
          <${LMS.ThemeToggle} />
          <button class="btn btn-ghost btn-sm text-red-500" onClick=${onLogout} title="Logout">
            <${Icons.Logout} />
          </button>
        </div>
      </div>
    </nav>
  `;
};

// ==================== MOBILE HEADER (Unused with generic navbar but kept for safety if needed) ====================
// ... (omitted)

// ==================== MAIN APP ====================
LMS.App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  // Data states
  const [students, setStudents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [halls, setHalls] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [settings, setSettings] = useState(LMS.DEFAULT_SETTINGS);
  const [activityLog, setActivityLog] = useState([]);
  const [pendingWork, setPendingWork] = useState([]);
  const [expenses, setExpenses] = useState([]);

  // Remote update flag to prevent loops
  const isRemoteUpdate = useRef(false);

  // Initialize Firebase
  useEffect(() => {
    LMS.DB.init();
  }, []);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      const session = LMS.DB.localLoad('session');
      if (session?.loggedIn) setIsLoggedIn(true);

      if (!LMS.DB.localLoad('owner')) LMS.DB.localSave('owner', { ...LMS.DEFAULT_OWNER, libraryName: 'MAGADH LIBRARY' });

      // Load from local first (instant)
      setStudents(LMS.DB.localLoad('students') || []);
      setPayments(LMS.DB.localLoad('payments') || []);

      const loadedHalls = LMS.DB.localLoad('halls');
      setHalls(loadedHalls && loadedHalls.length > 0 ? loadedHalls : LMS.DEFAULT_HALLS);

      setShifts(LMS.DB.localLoad('shifts') || LMS.DEFAULT_SHIFTS || []);
      // Force update settings if they are default
      const savedSettings = LMS.DB.localLoad('settings');
      let finalSettings = savedSettings ? { ...LMS.DEFAULT_SETTINGS, ...savedSettings } : { ...LMS.DEFAULT_SETTINGS, libraryName: 'Maa Saraswati Library' };

      // Ensure library name is set if missing
      if (!finalSettings.libraryName || finalSettings.libraryName === 'My Study Library') {
        finalSettings.libraryName = 'Maa Saraswati Library';
      }
      setSettings(finalSettings);
      setActivityLog(LMS.DB.localLoad('activityLog') || []);
      setPendingWork(LMS.DB.localLoad('pendingWork') || []);
      setExpenses(LMS.DB.localLoad('expenses') || []);

      // Auto-cleanup old photos (90+ days inactive)
      const { cleaned, count } = LMS.cleanupStudentPhotos(students || []);
      if (count > 0) {
        setStudents(cleaned);
        // We'll save this in the debounced effect, or we can force save here if needed.
        // The debounced effect will pick up the state change.
        // console.log(`Auto - cleaned ${ count } old student photos`);
      }

      // Attempt initial Cloud Sync
      if (LMS.DB.isConfigured && session?.loggedIn) {
        try { await LMS.DB.syncCloudToLocal(); } catch (e) { }
      }

      setLoading(false);
    };
    loadData();
  }, []);

  // REAL-TIME LISTENERS
  useEffect(() => {
    if (!LMS.DB.isConfigured || !LMS.DB.userId) return;

    // Define listener callbacks
    const setupListeners = () => {
      LMS.DB.listen('students', (val) => {
        if (val) { isRemoteUpdate.current = true; setStudents(val); }
      });
      LMS.DB.listen('payments', (val) => {
        if (val) { isRemoteUpdate.current = true; setPayments(val); }
      });
      LMS.DB.listen('halls', (val) => {
        if (val) { isRemoteUpdate.current = true; setHalls(val); }
      });
      LMS.DB.listen('shifts', (val) => {
        if (val) { isRemoteUpdate.current = true; setShifts(val); }
      });
      LMS.DB.listen('settings', (val) => {
        if (val) { isRemoteUpdate.current = true; setSettings(val); }
      });
      LMS.DB.listen('activityLog', (val) => {
        if (val) { isRemoteUpdate.current = true; setActivityLog(val); }
      });
      LMS.DB.listen('pendingWork', (val) => {
        if (val) { isRemoteUpdate.current = true; setPendingWork(val); }
      });
    };

    // Delay listeners slightly to allow initial load
    setTimeout(setupListeners, 1500);

    return () => {
      LMS.DB.detachAllListeners();
    };
  }, [LMS.DB.userId]); // Re-run if user login changes

  // Save data on change (debounced)
  const saveTimeout = useRef({});
  const debouncedSave = useCallback((key, data) => {
    // If this update came from remote, do NOT send it back to cloud
    if (isRemoteUpdate.current) {
      // Just save to local storage
      LMS.DB.localSave(key, data);

      // Reset flag after a short delay to allow subsequent local edits
      setTimeout(() => { isRemoteUpdate.current = false; }, 500);
      return;
    }

    clearTimeout(saveTimeout.current[key]);
    // 500ms DEBOUNCE (Faster cloud sync)
    saveTimeout.current[key] = setTimeout(() => {
      LMS.DB.localSave(key, data);

      // Cloud Sync: Skip 'students', 'payments', 'halls', 'shifts', 'expenses' (Handled Granularly)
      if (LMS.DB.isConfigured && LMS.DB.userId && !['students', 'payments', 'halls', 'shifts', 'expenses'].includes(key)) {
        LMS.DB.save(key, data);
      }

      // Note: Local File Backup is handled by BottomStatusBar every 30s
    }, 300);
  }, []);

  useEffect(() => { debouncedSave('students', students); }, [students]);
  useEffect(() => { debouncedSave('payments', payments); }, [payments]);
  useEffect(() => { debouncedSave('halls', halls); }, [halls]);
  useEffect(() => { debouncedSave('shifts', shifts); }, [shifts]);
  useEffect(() => { debouncedSave('settings', settings); }, [settings]);
  useEffect(() => { debouncedSave('activityLog', activityLog); }, [activityLog]);
  useEffect(() => { debouncedSave('pendingWork', pendingWork); }, [pendingWork]);
  useEffect(() => { debouncedSave('expenses', expenses); }, [expenses]);

  const addLog = useCallback((action) => {
    setActivityLog(prev => [{ action, timestamp: new Date().toISOString() }, ...prev].slice(0, 100));
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
  }, []);

  const handleLogin = () => {
    setIsLoggedIn(true);
    addLog('Owner logged in');
  };

  const handleLogout = () => {
    LMS.DB.localRemove('session');
    setIsLoggedIn(false);
    addLog('Owner logged out');
  };

  const contextValue = {
    students, setStudents,
    payments, setPayments,
    halls, setHalls,
    shifts, setShifts,
    settings, setSettings,
    activityLog, addLog,
    pendingWork, setPendingWork,
    expenses, setExpenses,
    showToast
  };

  if (loading) {
    return html`<${LMS.AppContext.Provider} value=${contextValue}>
    <div class="min-h-screen bg-body text-text-dark pb-20 pt-20">
      <${LMS.TopNavbar} currentPage="dashboard" />
      <main class="container mx-auto px-4">
        <div class="mb-4 fade-in-up" style=${{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <div class="skeleton w-48 h-8"></div>
        </div>
        <${LMS.SkeletonDashboard} />
      </main>
    </div>
    </${LMS.AppContext.Provider}>`;
  }

  if (!isLoggedIn) return html`<${LMS.LoginPage} onLogin=${handleLogin} />`;

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return html`<${LMS.Dashboard} setCurrentPage=${setCurrentPage} />`;
      case 'students': return html`<${LMS.StudentManagement} />`;
      case 'seats': return html`<${LMS.SeatManagement} />`;
      case 'payments': return html`<${LMS.PaymentManagement} />`;
      case 'accounts': return html`<${LMS.Accounts} />`;
      case 'alerts': return html`<${LMS.Alerts} />`;
      case 'attendance': return html`<${LMS.Attendance} />`;
      case 'activity': return html`<${LMS.ActivityLog} />`;
      case 'settings': return html`<${LMS.Settings} onLogout=${handleLogout} />`;
      default: return html`<${LMS.Dashboard} />`;
    }
  };

  return html`<${LMS.AppContext.Provider} value=${contextValue}>
    <div class="min-h-screen bg-body text-text-dark pb-20 pt-20"> <!-- Added padding top/bottom -->
      <${LMS.TopNavbar} 
        currentPage=${currentPage} 
        setCurrentPage=${setCurrentPage} 
        onLogout=${handleLogout} 
        isMobileOpen=${isMobileMenuOpen}
        setIsMobileOpen=${setIsMobileMenuOpen}
      />

      <main class="container mx-auto px-4" onClick=${() => isMobileMenuOpen && setIsMobileMenuOpen(false)}>
        <!-- Page Title -->
        <div class="mb-4 fade-in-up" style=${{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <h2 class="text-2xl font-bold text-primary-gradient" style=${{ textTransform: 'capitalize' }}>
            ${currentPage.replace('-', ' ')}
          </h2>
        </div>
        <div class="page-enter" key=${currentPage}>
          ${renderPage()}
        </div>
      </main>

      <${LMS.Chatbot} />
      <${LMS.BottomStatusBar} />
      ${toast && html`<${LMS.Toast} message=${toast.message} type=${toast.type} onClose=${() => setToast(null)} />`}
      <${LMS.Screensaver} />
    </div>
  </${LMS.AppContext.Provider}>`;
};

// ==================== MOUNT ====================
ReactDOM.createRoot(document.getElementById('root')).render(html`<${LMS.App} />`);

// ==================== SERVICE WORKER REGISTRATION ====================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registered: ', reg.scope))
      .catch(err => console.log('Service Worker registration failed: ', err));
  });
}
