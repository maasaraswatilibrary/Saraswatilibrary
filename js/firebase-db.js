// ==================== FIREBASE-DB.JS - Cloud Database Layer ====================
// Uses Firebase Realtime Database for cloud storage
// FREE tier: 1GB storage, 10GB/month transfer

window.LMS = window.LMS || {};

// \u26a0\ufe0f SETUP INSTRUCTIONS:
// 1. Go to https://console.firebase.google.com
// 2. Click "Add Project" \u2192 name it \u2192 Continue
// 3. Go to "Build" \u2192 "Realtime Database" \u2192 "Create Database"
// 4. Choose region \u2192 Start in TEST MODE
// 5. Go to Project Settings (gear icon) \u2192 scroll to "Your apps" \u2192 click Web (</>)
// 6. Register app \u2192 Copy the firebaseConfig object below
// 7. Replace the placeholder config with YOUR config
// 8. IMPORTANT: Go to Realtime Database \u2192 Rules \u2192 set:
//    { "rules": { ".read": "auth != null", ".write": "auth != null" } }
//    OR for simplest setup (less secure, ok for personal use):
//    { "rules": { ".read": true, ".write": true } }
// 9. Go to "Authentication" \u2192 "Sign-in method" \u2192 Enable "Google"

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// \ud83d\udd27 PASTE YOUR FIREBASE CONFIG HERE
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBeiLpzkmwv2zHhdN4Udt6LVGxuz4PF_9U",
  authDomain: "saraswatilibrary.firebaseapp.com",
  projectId: "saraswatilibrary",
  storageBucket: "saraswatilibrary.firebasestorage.app",
  messagingSenderId: "596543784299",
  appId: "1:596543784299:web:955dd8b8b4ee43d571f82e"
};
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

LMS.DB = {
  app: null,
  db: null,
  auth: null,
  userId: null,
  isConfigured: false,
  isOnline: false,
  listeners: {},
  syncCallbacks: {},

  init() {
    try {
      if (!FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey === "YOUR_API_KEY_HERE") {
        console.warn('Firebase not configured. Using localStorage fallback.');
        this.isConfigured = false;
        return false;
      }
      this.app = firebase.initializeApp(FIREBASE_CONFIG);
      this.db = firebase.database();
      this.auth = firebase.auth();
      this.isConfigured = true;
      this.setupAuthListener();
      return true;
    } catch (e) {
      console.error('Firebase init error:', e);
      this.isConfigured = false;
      return false;
    }
  },

  setupAuthListener() {
    if (!this.auth) return;
    // Handle redirect result (if coming back from Google sign-in redirect)
    this.auth.getRedirectResult().then((result) => {
      if (result && result.user) {
        console.log('Redirect sign-in successful:', result.user.email);
      }
    }).catch((err) => {
      console.error('Redirect result error:', err);
    });
    this.auth.onAuthStateChanged((user) => {
      if (user) {
        this.userId = user.uid;
        this.isOnline = true;
        if (this.syncCallbacks.onAuth) this.syncCallbacks.onAuth(user);
      } else {
        this.userId = null;
        this.isOnline = false;
        if (this.syncCallbacks.onAuth) this.syncCallbacks.onAuth(null);
      }
    });
  },

  async signInWithGoogle() {
    if (!this.auth) return null;
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      // Try popup first, fallback to redirect
      try {
        const result = await this.auth.signInWithPopup(provider);
        return result.user;
      } catch (popupErr) {
        console.warn('Popup failed, trying redirect:', popupErr.code);
        if (popupErr.code === 'auth/popup-blocked' ||
          popupErr.code === 'auth/popup-closed-by-user' ||
          popupErr.code === 'auth/cancelled-popup-request' ||
          popupErr.code === 'auth/internal-error') {
          await this.auth.signInWithRedirect(provider);
          return null; // Will redirect, result handled by onAuthStateChanged
        }
        throw popupErr;
      }
    } catch (e) {
      console.error('Google sign-in error:', e);
      return null;
    }
  },

  async signOut() {
    if (!this.auth) return;
    try {
      this.detachAllListeners();
      await this.auth.signOut();
      this.userId = null;
      this.isOnline = false;
    } catch (e) {
      console.error('Sign out error:', e);
    }
  },

  getPath(key) {
    return `users/${this.userId}/${key}`;
  },

  // Save data to Firebase
  async save(key, data) {
    if (!this.isConfigured || !this.userId) {
      return this.localSave(key, data);
    }
    try {
      await this.db.ref(this.getPath(key)).set(data);
      this.localSave(key, data); // keep local copy
      return true;
    } catch (e) {
      console.error('Firebase save error:', e);
      this.localSave(key, data);
      return false;
    }
  },

  // Load data from Firebase
  async load(key, defaultValue) {
    if (!this.isConfigured || !this.userId) {
      return this.localLoad(key, defaultValue);
    }
    try {
      const snapshot = await this.db.ref(this.getPath(key)).once('value');
      const val = snapshot.val();
      if (val !== null && val !== undefined) {
        this.localSave(key, val);
        return val;
      }
      // If Firebase has no data, check local and push up
      const localVal = this.localLoad(key, defaultValue);
      if (localVal !== defaultValue) {
        await this.db.ref(this.getPath(key)).set(localVal);
      }
      return localVal;
    } catch (e) {
      console.error('Firebase load error:', e);
      return this.localLoad(key, defaultValue);
    }
  },

  // Real-time listener
  listen(key, callback) {
    if (!this.isConfigured || !this.userId) return;
    this.detachListener(key);
    const ref = this.db.ref(this.getPath(key));
    const handler = ref.on('value', (snapshot) => {
      let val = snapshot.val();

      // Optimization: If val is null/undefined, just callback
      if (val === null || val === undefined) {
        callback(val);
        return;
      }

      // Convert Map to Array for lists if necessary
      if ((key === 'students' || key === 'payments') && !Array.isArray(val)) {
        val = Object.values(val);
      }

      // Deduplicate if it's an array (Critical for preventing duplicates in UI)
      if (Array.isArray(val) && (key === 'students' || key === 'payments')) {
        const uniqueMap = new Map();
        val.forEach(item => {
          if (item && item.id) uniqueMap.set(item.id, item);
        });
        val = Array.from(uniqueMap.values());
      }

      callback(val);
    });
    this.listeners[key] = { ref, handler };
  },

  detachListener(key) {
    if (this.listeners[key]) {
      this.listeners[key].ref.off('value', this.listeners[key].handler);
      delete this.listeners[key];
    }
  },

  detachAllListeners() {
    Object.keys(this.listeners).forEach(key => this.detachListener(key));
  },

  // Local storage fallback
  localSave(key, data) {
    try {
      localStorage.setItem('lms_' + key, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  },

  localLoad(key, defaultValue) {
    try {
      const item = localStorage.getItem('lms_' + key);
      return item ? JSON.parse(item) : (defaultValue !== undefined ? defaultValue : null);
    } catch (e) { return defaultValue !== undefined ? defaultValue : null; }
  },

  localRemove(key) {
    localStorage.removeItem('lms_' + key);
  },

  // Sync a single item (Granular Update) - FAST & SAFE
  async saveItem(collection, item) {
    if (!this.isConfigured || !this.userId || !item.id) return false;
    try {
      await this.db.ref(this.getPath(`${collection}/${item.id}`)).set(item);
      return true;
    } catch (e) {
      console.error(`Error saving item to ${collection}:`, e);
      return false;
    }
  },

  // Remove a single item
  async removeItem(collection, itemId) {
    if (!this.isConfigured || !this.userId || !itemId) return false;
    try {
      await this.db.ref(this.getPath(`${collection}/${itemId}`)).remove();
      return true;
    } catch (e) {
      console.error(`Error removing item from ${collection}:`, e);
      return false;
    }
  },

  // Upload all local data to Firebase (Modified to exclude large lists to prevent overwrite)
  async syncLocalToCloud() {
    if (!this.isConfigured || !this.userId) return false;
    // Exclude 'students' and 'payments' from bulk sync. They are synced granularly.
    const keys = ['halls', 'shifts', 'settings', 'activityLog', 'owner'];
    try {
      for (const key of keys) {
        const localData = this.localLoad(key);
        if (localData) {
          await this.db.ref(this.getPath(key)).set(localData);
        }
      }
      return true;
    } catch (e) {
      console.error('Sync error:', e);
      return false;
    }
  },

  // Download all cloud data to local
  async syncCloudToLocal() {
    if (!this.isConfigured || !this.userId) return false;
    const keys = ['students', 'payments', 'halls', 'shifts', 'settings', 'activityLog', 'owner'];
    try {
      for (const key of keys) {
        const snapshot = await this.db.ref(this.getPath(key)).once('value');
        let val = snapshot.val();

        // Convert Map to Array for lists if necessary
        if ((key === 'students' || key === 'payments') && val && !Array.isArray(val)) {
          val = Object.values(val);
        }

        if (val !== null) {
          this.localSave(key, val);
        }
      }
      return true;
    } catch (e) {
      console.error('Sync error:', e);
      return false;
    }
  },

  // Export backup as JSON
  async exportBackup(allData) {
    const data = { ...allData, exportDate: new Date().toISOString(), version: '3.0' };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `library_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
