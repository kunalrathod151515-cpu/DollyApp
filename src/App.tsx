import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  UtensilsCrossed,
  ChefHat,
  Receipt,
  ShieldAlert,
  Cloud,
  CheckCircle2,
  Flame,
  Plus,
  Minus,
  Search,
  RotateCcw,
  Store,
  DollarSign,
  Smartphone,
  Send,
  BellRing,
  Lock,
  User,
  KeyRound,
  LogOut,
  UserCheck,
  UserPlus,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  Database,
  Wifi,
  WifiOff,
  Download,
  AlertTriangle,
  LayoutGrid,
  ArrowLeft,
  Printer,
  Edit2,
  Check,
  X,
  FileText,
  SlidersHorizontal,
  Copy
} from 'lucide-react';

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import {
  db,
  OperationType,
  handleFirestoreError,
  testFirestoreConnection
} from './firebase.ts';
import { usePWAInstall } from './usePWAInstall.ts';

export type UserRole = 'ADMIN' | 'MANAGER' | 'WAITER' | 'KITCHEN';

export interface StaffUser {
  id: string;
  name: string;
  username: string;
  pinOrPass: string;
  role: UserRole;
  restaurant_id: string;
  is_active: boolean;
}

export interface RestaurantTable {
  id: string;
  name: string;
  capacity?: number;
}

interface Restaurant {
  id: string;
  name: string;
  city: string;
  tablesCount: number;
  tables?: RestaurantTable[];
  is_synced: boolean;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  category: string;
  price: number;
  is_synced: boolean;
  is_available?: boolean;
}

export interface PrintableBillData {
  title: string;
  restaurantName: string;
  restaurantCity: string;
  billNo: string;
  tableName: string;
  waiterName?: string;
  dateTime: string;
  items: { name: string; qty: number; price: number; amount: number }[];
  subtotal: number;
  gstAmount: number;
  grandTotal: number;
  paymentMode?: string;
  isSettled: boolean;
}

interface KotItem {
  name: string;
  price: number;
  qty: number;
}

type KotStatus = 'CREATED' | 'COOKING_STARTED' | 'COOKING' | 'READY' | 'SERVED' | 'BILLED';

interface KOT {
  id: string;
  token_no: number;
  restaurant_id: string;
  table_name: string;
  status: KotStatus;
  note: string;
  items: KotItem[];
  created_at: string;
  is_synced: boolean;
  waiter_name?: string;
}

interface CompletedOrder {
  id: string;
  restaurant_id: string;
  table_name: string;
  summary: string;
  grand_total: number;
  payment_mode: 'CASH' | 'UPI';
  is_synced: boolean;
  date?: string;
}

const STORAGE_KEY = 'POSHUB_PRO_OFFLINE_DB_V4';

const INITIAL_STAFF: StaffUser[] = [
  {
    id: 'staff_admin_1',
    name: 'Vikram Joshi (Admin)',
    username: 'admin',
    pinOrPass: 'admin123',
    role: 'ADMIN',
    restaurant_id: 'all',
    is_active: true
  },
  {
    id: 'staff_mgr_1',
    name: 'Amit Sharma (Manager)',
    username: 'manager',
    pinOrPass: '1234',
    role: 'MANAGER',
    restaurant_id: 'rest_1',
    is_active: true
  },
  {
    id: 'staff_waiter_1',
    name: 'Rohan Patil (Waiter)',
    username: 'waiter',
    pinOrPass: '1234',
    role: 'WAITER',
    restaurant_id: 'rest_1',
    is_active: true
  },
  {
    id: 'staff_kitchen_1',
    name: 'Chef Suresh (Kitchen)',
    username: 'kitchen',
    pinOrPass: '1234',
    role: 'KITCHEN',
    restaurant_id: 'rest_1',
    is_active: true
  }
];

const INITIAL_RESTAURANTS: Restaurant[] = [
  {
    id: 'rest_1',
    name: 'Swad Family Restaurant',
    city: 'Akola Main',
    tablesCount: 6,
    tables: [
      { id: 't1_1', name: 'Table 1', capacity: 4 },
      { id: 't1_2', name: 'Table 2', capacity: 2 },
      { id: 't1_3', name: 'Table 3', capacity: 4 },
      { id: 't1_4', name: 'Table 4', capacity: 6 },
      { id: 't1_5', name: 'Table 5', capacity: 4 },
      { id: 't1_6', name: 'Table 6', capacity: 8 }
    ],
    is_synced: true
  },
  {
    id: 'rest_2',
    name: 'Spice Garden Dhaba',
    city: 'Highway',
    tablesCount: 6,
    tables: [
      { id: 't2_1', name: 'Dhaba 1', capacity: 4 },
      { id: 't2_2', name: 'Dhaba 2', capacity: 4 },
      { id: 't2_3', name: 'Dhaba 3', capacity: 6 },
      { id: 't2_4', name: 'Dhaba 4', capacity: 6 },
      { id: 't2_5', name: 'Dhaba 5', capacity: 8 },
      { id: 't2_6', name: 'Dhaba 6', capacity: 10 }
    ],
    is_synced: true
  }
];

const INITIAL_MENUS: MenuItem[] = [
  { id: 'm1', restaurant_id: 'rest_1', name: 'Paneer Butter Masala', category: 'Main Course', price: 220, is_synced: true },
  { id: 'm2', restaurant_id: 'rest_1', name: 'Butter Garlic Naan', category: 'Breads', price: 45, is_synced: true },
  { id: 'm3', restaurant_id: 'rest_1', name: 'Hyderabadi Veg Biryani', category: 'Rice', price: 190, is_synced: true },
  { id: 'm4', restaurant_id: 'rest_1', name: 'Crispy Masala Papad', category: 'Starters', price: 40, is_synced: true },
  { id: 'm5', restaurant_id: 'rest_1', name: 'Paneer Chilli Dry', category: 'Starters', price: 180, is_synced: true },
  { id: 'm6', restaurant_id: 'rest_1', name: 'Dal Tadka Special', category: 'Main Course', price: 160, is_synced: true },
  { id: 'm7', restaurant_id: 'rest_1', name: 'Tandoori Wheat Roti', category: 'Breads', price: 20, is_synced: true },
  { id: 'm8', restaurant_id: 'rest_2', name: 'Saoji Shev Bhaji', category: 'Main Course', price: 150, is_synced: true },
  { id: 'm9', restaurant_id: 'rest_2', name: 'Garama Garam Jowar Bhakri', category: 'Breads', price: 25, is_synced: true }
];

function generateUUID(): string {
  return 'id-' + Math.random().toString(36).substring(2, 8) + '-' + Date.now().toString(36);
}

function playAudioBeep(freq = 680) {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  } catch {
    // Ignore audio errors if blocked by browser
  }
}

export default function App() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  const handleInstallClick = async () => {
    if (isInstallable) {
      try {
        const success = await install();
        if (!success) setShowInstallGuide(true);
      } catch {
        setShowInstallGuide(true);
      }
    } else {
      setShowInstallGuide(true);
    }
  };

  // Network State
  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(false);

  // Database State connected with Firestore + local fallback
  const [restaurants, setRestaurants] = useState<Restaurant[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_restaurants`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_RESTAURANTS;
  });

  const [menus, setMenus] = useState<MenuItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_menus`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_MENUS;
  });

  const [kots, setKots] = useState<KOT[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_kots`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [completedOrders, setCompletedOrders] = useState<CompletedOrder[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_completed`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [staff, setStaff] = useState<StaffUser[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_staff`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_STAFF;
  });

  // Authentication State
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // POS Navigation & Workspace State
  const [currentRole, setCurrentRole] = useState<UserRole>('WAITER');
  const [waiterSubTab, setWaiterSubTab] = useState<'ORDER' | 'KOT'>('ORDER');
  const [activeRestaurantId, setActiveRestaurantId] = useState<string>('rest_1');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cart, setCart] = useState<{ [menuId: string]: number }>({});
  const [chefNote, setChefNote] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toasts, setToasts] = useState<{ id: string; msg: string }[]>([]);

  // Manager navigation & features (Version 3.0)
  const [managerSubTab, setManagerSubTab] = useState<'BILLS' | 'MENU_WATCH' | 'TABLES'>('BILLS');
  const [activeBillPrint, setActiveBillPrint] = useState<PrintableBillData | null>(null);
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const [menuFilterCategory, setMenuFilterCategory] = useState('All');
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [editDishName, setEditDishName] = useState('');
  const [editDishCat, setEditDishCat] = useState('');
  const [editDishPrice, setEditDishPrice] = useState('');

  // Manager inputs for Menu & Tables
  const [newDishName, setNewDishName] = useState('');
  const [newDishCat, setNewDishCat] = useState('');
  const [newDishPrice, setNewDishPrice] = useState('');
  const [newTableName, setNewTableName] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState('4');

  // Admin restaurant inputs
  const [adminRestName, setAdminRestName] = useState('');
  const [adminRestCity, setAdminRestCity] = useState('');
  const [adminRestTables, setAdminRestTables] = useState('6');

  // Admin staff management inputs
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffUsername, setNewStaffUsername] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<UserRole>('WAITER');
  const [newStaffRestId, setNewStaffRestId] = useState('rest_1');

  const lanChannelRef = useRef<BroadcastChannel | null>(null);

  const showToast = (msg: string) => {
    const id = generateUUID();
    setToasts((prev) => [...prev, { id, msg }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  };

  // Sync to localStorage
  const saveLocalState = (type: 'restaurants' | 'menus' | 'kots' | 'completed' | 'staff', data: any) => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_${type}`, JSON.stringify(data));
    } catch {}
  };

  // Online / Offline Network Listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('🌐 Network Connected! Cloud Sync Active');
      testFirestoreConnection().then(setFirebaseConnected);
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast('📡 You are Offline. Operating in Local POS Mode');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Test Firestore connection on mount & register real-time listeners with local caching
  useEffect(() => {
    testFirestoreConnection().then((connected) => {
      setFirebaseConnected(connected);
      if (connected) {
        showToast('🔥 Firestore Realtime Sync Active');
      }
    });

    // 1. Listen to Restaurants
    const unsubRestaurants = onSnapshot(
      collection(db, 'restaurants'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: Restaurant[] = [];
          snapshot.forEach((d) => list.push(d.data() as Restaurant));
          setRestaurants(list);
          saveLocalState('restaurants', list);
        } else if (navigator.onLine) {
          // Seed initial restaurants
          INITIAL_RESTAURANTS.forEach((r) => {
            setDoc(doc(db, 'restaurants', r.id), r).catch(() => {});
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'restaurants');
      }
    );

    // 2. Listen to Menus
    const unsubMenus = onSnapshot(
      collection(db, 'menus'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: MenuItem[] = [];
          snapshot.forEach((d) => list.push(d.data() as MenuItem));
          setMenus(list);
          saveLocalState('menus', list);
        } else if (navigator.onLine) {
          // Seed initial menus
          INITIAL_MENUS.forEach((m) => {
            setDoc(doc(db, 'menus', m.id), m).catch(() => {});
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'menus');
      }
    );

    // 3. Listen to KOTs
    const unsubKots = onSnapshot(
      collection(db, 'kots'),
      (snapshot) => {
        const list: KOT[] = [];
        snapshot.forEach((d) => list.push(d.data() as KOT));
        list.sort((a, b) => (b.token_no || 0) - (a.token_no || 0));
        setKots(list);
        saveLocalState('kots', list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'kots');
      }
    );

    // 4. Listen to Completed Orders
    const unsubCompleted = onSnapshot(
      collection(db, 'completed_orders'),
      (snapshot) => {
        const list: CompletedOrder[] = [];
        snapshot.forEach((d) => list.push(d.data() as CompletedOrder));
        setCompletedOrders(list);
        saveLocalState('completed', list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'completed_orders');
      }
    );

    // 5. Listen to Staff credentials
    const unsubStaff = onSnapshot(
      collection(db, 'staff'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: StaffUser[] = [];
          snapshot.forEach((d) => list.push(d.data() as StaffUser));
          setStaff(list);
          saveLocalState('staff', list);
        } else if (navigator.onLine) {
          INITIAL_STAFF.forEach((s) => {
            setDoc(doc(db, 'staff', s.id), s).catch(() => {});
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'staff');
      }
    );

    return () => {
      unsubRestaurants();
      unsubMenus();
      unsubKots();
      unsubCompleted();
      unsubStaff();
    };
  }, []);

  // Broadcast channel setup for local Wi-Fi cross-tab sync
  useEffect(() => {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('poshub_wifi_sync');
      lanChannelRef.current = channel;
      channel.onmessage = () => {
        playAudioBeep(760);
      };
      return () => {
        channel.close();
      };
    }
  }, []);

  // Login handler
  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginError('');

    const trimmedUser = loginUsername.trim().toLowerCase();
    const trimmedPass = loginPassword.trim();

    if (!trimmedUser || !trimmedPass) {
      setLoginError('Please enter username and password/PIN.');
      return;
    }

    const found = staff.find(
      (s) => s.username.toLowerCase() === trimmedUser && s.pinOrPass === trimmedPass && s.is_active
    );

    if (!found) {
      setLoginError('Invalid credentials or account is inactive.');
      return;
    }

    setCurrentUser(found);
    setCurrentRole(found.role);
    if (found.restaurant_id !== 'all') {
      setActiveRestaurantId(found.restaurant_id);
    }
    setLoginUsername('');
    setLoginPassword('');
    showToast(`👋 Welcome, ${found.name}!`);
    playAudioBeep(640);
  };

  const quickDemoLogin = (staffUser: StaffUser) => {
    setCurrentUser(staffUser);
    setCurrentRole(staffUser.role);
    if (staffUser.restaurant_id !== 'all') {
      setActiveRestaurantId(staffUser.restaurant_id);
    }
    showToast(`👋 Logged in as ${staffUser.name} (${staffUser.role})`);
    playAudioBeep(640);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedTable('');
    setCart({});
    setChefNote('');
    showToast('🔒 Logged out successfully');
  };

  const activeRestaurant = useMemo(() => {
    return (
      restaurants.find((r) => r.id === activeRestaurantId) ||
      restaurants[0] || { id: 'rest_1', name: 'Restaurant', city: 'City', tablesCount: 6, is_synced: true }
    );
  }, [restaurants, activeRestaurantId]);

  const currentRestaurantTables = useMemo<RestaurantTable[]>(() => {
    if (activeRestaurant.tables && activeRestaurant.tables.length > 0) {
      return activeRestaurant.tables;
    }
    const count = activeRestaurant.tablesCount || 6;
    return Array.from({ length: count }).map((_, i) => ({
      id: `auto_t_${i + 1}`,
      name: `Table ${i + 1}`,
      capacity: 4
    }));
  }, [activeRestaurant]);

  // Reset table and cart when restaurant changes
  useEffect(() => {
    setSelectedTable('');
    setCart({});
    setChefNote('');
  }, [activeRestaurantId]);

  const currentRestaurantMenus = useMemo(() => {
    return menus.filter((m) => m.restaurant_id === activeRestaurantId);
  }, [menus, activeRestaurantId]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(currentRestaurantMenus.map((m) => m.category || 'General')));
    return ['All', ...cats];
  }, [currentRestaurantMenus]);

  const filteredMenus = useMemo(() => {
    return currentRestaurantMenus.filter((m) => {
      const matchCat = selectedCategory === 'All' || m.category === selectedCategory;
      const matchQ = m.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQ;
    });
  }, [currentRestaurantMenus, selectedCategory, searchQuery]);

  // Manager live menu watch filters and statistics
  const managerFilteredMenus = useMemo(() => {
    return currentRestaurantMenus.filter((m) => {
      const matchCat = menuFilterCategory === 'All' || m.category === menuFilterCategory;
      const matchQ = m.name.toLowerCase().includes(menuSearchQuery.toLowerCase());
      return matchCat && matchQ;
    });
  }, [currentRestaurantMenus, menuFilterCategory, menuSearchQuery]);

  const managerMenuCategories = useMemo(() => {
    const cats = Array.from(new Set(currentRestaurantMenus.map((m) => m.category || 'General')));
    return ['All', ...cats];
  }, [currentRestaurantMenus]);

  const menuStats = useMemo(() => {
    const total = currentRestaurantMenus.length;
    const inStock = currentRestaurantMenus.filter((m) => m.is_available !== false).length;
    const outOfStock = total - inStock;
    const avgPrice = total > 0 ? Math.round(currentRestaurantMenus.reduce((sum, m) => sum + m.price, 0) / total) : 0;
    return { total, inStock, outOfStock, avgPrice };
  }, [currentRestaurantMenus]);

  const activeKots = useMemo(() => {
    return kots.filter((k) => k.restaurant_id === activeRestaurantId && k.status !== 'BILLED');
  }, [kots, activeRestaurantId]);

  const kitchenPendingKots = useMemo(() => {
    return activeKots.filter((k) => !['SERVED', 'BILLED'].includes(k.status));
  }, [activeKots]);

  // Cart operations (enforcing table selection first)
  const updateCart = (menuId: string, delta: number) => {
    if (!selectedTable && delta > 0) {
      showToast('⚠️ Please select a dining table first before choosing menu items!');
      playAudioBeep(420);
      return;
    }
    setCart((prev) => {
      const nextVal = (prev[menuId] || 0) + delta;
      const copy = { ...prev };
      if (nextVal <= 0) {
        delete copy[menuId];
      } else {
        copy[menuId] = nextVal;
      }
      return copy;
    });
  };

  const cartKeys = Object.keys(cart);
  const cartSummary = useMemo(() => {
    let totalQty = 0;
    let totalPrice = 0;
    const itemsPreview: string[] = [];

    cartKeys.forEach((id) => {
      const dish = currentRestaurantMenus.find((m) => m.id === id);
      if (dish) {
        const qty = cart[id];
        totalQty += qty;
        totalPrice += dish.price * qty;
        itemsPreview.push(`${dish.name} ×${qty}`);
      }
    });

    return { totalQty, totalPrice, previewText: itemsPreview.join(', ') };
  }, [cart, cartKeys, currentRestaurantMenus]);

  // Confirm KOT (Works Offline and Online via Firestore local persistence)
  const confirmKOT = async () => {
    if (!selectedTable) {
      showToast('⚠️ Please select a dining table first before sending KOT!');
      return;
    }
    if (!cartKeys.length) {
      showToast('⚠️ Please select menu items to include in this order!');
      return;
    }
    const sentTableName = selectedTable;
    const items: KotItem[] = cartKeys.map((id) => {
      const d = currentRestaurantMenus.find((m) => m.id === id)!;
      return { name: d.name, price: d.price, qty: cart[id] };
    });

    const tokenNo = 101 + kots.filter((k) => k.restaurant_id === activeRestaurantId).length;
    const kotId = generateUUID();
    const newKot: KOT = {
      id: kotId,
      token_no: tokenNo,
      restaurant_id: activeRestaurantId,
      table_name: sentTableName,
      status: 'CREATED',
      note: chefNote.trim(),
      items,
      created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      is_synced: isOnline,
      waiter_name: currentUser?.name || 'Staff'
    };

    // Update local state immediately for instant feedback
    const nextKots = [newKot, ...kots];
    setKots(nextKots);
    saveLocalState('kots', nextKots);
    setCart({});
    setChefNote('');
    setSelectedTable(''); // Directs waiter right back to select table for next customer!
    playAudioBeep(540);
    showToast(isOnline ? `🚀 KOT #${tokenNo} for ${sentTableName} sent to Kitchen!` : `💾 KOT #${tokenNo} for ${sentTableName} saved locally (Offline)`);
    setWaiterSubTab('KOT');

    if (lanChannelRef.current) lanChannelRef.current.postMessage({ type: 'SYNC' });

    // Write to Firestore (cached in IndexedDB offline and synced on reconnect)
    try {
      await setDoc(doc(db, 'kots', kotId), newKot);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'kots');
    }
  };

  // Change KOT Status (Offline + Online)
  const changeKotStatus = async (kotId: string, newStatus: KotStatus) => {
    const target = kots.find((k) => k.id === kotId);
    if (!target) return;
    const updated: KOT = { ...target, status: newStatus, is_synced: isOnline };

    const nextKots = kots.map((k) => (k.id === kotId ? updated : k));
    setKots(nextKots);
    saveLocalState('kots', nextKots);
    playAudioBeep(880);
    showToast(`🔥 KOT #${target.token_no} ➔ ${newStatus.replace('_', ' ')}`);

    if (lanChannelRef.current) lanChannelRef.current.postMessage({ type: 'SYNC' });

    try {
      await setDoc(doc(db, 'kots', kotId), updated);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `kots/${kotId}`);
    }
  };

  // Settle Table Bill (Offline + Online)
  const settleTableBill = async (tableName: string, mode: 'CASH' | 'UPI') => {
    const tableKots = kots.filter(
      (k) => k.restaurant_id === activeRestaurantId && k.table_name === tableName && k.status !== 'BILLED'
    );
    if (!tableKots.length) return;

    let subtotal = 0;
    const summaryList: string[] = [];
    tableKots.forEach((k) => {
      k.items.forEach((i) => {
        subtotal += i.price * i.qty;
        summaryList.push(`${i.name} ×${i.qty}`);
      });
    });

    const grandTotal = Math.round(subtotal * 1.05);
    const orderId = generateUUID();

    const newCompleted: CompletedOrder = {
      id: orderId,
      restaurant_id: activeRestaurantId,
      table_name: tableName,
      summary: summaryList.join(', '),
      grand_total: grandTotal,
      payment_mode: mode,
      is_synced: isOnline,
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Update local state immediately
    const nextKots = kots.map((k) =>
      k.restaurant_id === activeRestaurantId && k.table_name === tableName && k.status !== 'BILLED'
        ? { ...k, status: 'BILLED' as KotStatus }
        : k
    );
    const nextCompleted = [newCompleted, ...completedOrders];
    setKots(nextKots);
    setCompletedOrders(nextCompleted);
    saveLocalState('kots', nextKots);
    saveLocalState('completed', nextCompleted);

    showToast(`✅ ${tableName} Bill Paid (₹${grandTotal}) via ${mode}`);
    if (lanChannelRef.current) lanChannelRef.current.postMessage({ type: 'SYNC' });

    try {
      for (const k of tableKots) {
        await setDoc(doc(db, 'kots', k.id), { ...k, status: 'BILLED' });
      }
      await setDoc(doc(db, 'completed_orders', orderId), newCompleted);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'completed_orders');
    }
  };

  // Manager: Add dish to menu
  const handleAddDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDishName.trim() || !newDishPrice) return;
    const priceNum = parseFloat(newDishPrice);
    if (isNaN(priceNum) || priceNum <= 0) return;

    const dishId = generateUUID();
    const newItem: MenuItem = {
      id: dishId,
      restaurant_id: activeRestaurantId,
      name: newDishName.trim(),
      category: newDishCat.trim() || 'Specials',
      price: priceNum,
      is_synced: isOnline
    };

    const nextMenus = [...menus, newItem];
    setMenus(nextMenus);
    saveLocalState('menus', nextMenus);
    setNewDishName('');
    setNewDishCat('');
    setNewDishPrice('');
    showToast('🍲 Dish added to menu!');

    try {
      await setDoc(doc(db, 'menus', dishId), newItem);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'menus');
    }
  };

  // Manager: Bill Printing Handlers (Version 3.0)
  const handlePrintRunningBill = (tableName: string) => {
    const tableKots = kots.filter(
      (k) => k.restaurant_id === activeRestaurantId && k.table_name === tableName && k.status !== 'BILLED'
    );
    if (!tableKots.length) {
      showToast('⚠️ No active orders on this table to print bill!');
      return;
    }

    const itemMap: { [name: string]: { qty: number; price: number } } = {};
    tableKots.forEach((k) => {
      k.items.forEach((i) => {
        if (!itemMap[i.name]) {
          itemMap[i.name] = { qty: 0, price: i.price };
        }
        itemMap[i.name].qty += i.qty;
      });
    });

    const items = Object.entries(itemMap).map(([name, data]) => ({
      name,
      qty: data.qty,
      price: data.price,
      amount: data.qty * data.price
    }));

    const subtotal = items.reduce((acc, i) => acc + i.amount, 0);
    const gstAmount = Math.round(subtotal * 0.05);
    const grandTotal = subtotal + gstAmount;
    const waiterName = tableKots[0]?.waiter_name || currentUser?.name || 'Staff';
    const now = new Date();
    const dateStr =
      now.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' +
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const billData: PrintableBillData = {
      title: 'TAX INVOICE / TABLE BILL',
      restaurantName: activeRestaurant.name,
      restaurantCity: activeRestaurant.city,
      billNo: `INV-${tableKots[0]?.token_no || Math.floor(1000 + Math.random() * 9000)}`,
      tableName,
      waiterName,
      dateTime: dateStr,
      items,
      subtotal,
      gstAmount,
      grandTotal,
      paymentMode: 'PENDING / RUNNING',
      isSettled: false
    };

    setActiveBillPrint(billData);
    playAudioBeep(680);
    showToast(`🖨️ Generated Thermal Bill Preview for ${tableName}`);
  };

  const handlePrintSettledBill = (order: CompletedOrder) => {
    const parsedItems: { name: string; qty: number; price: number; amount: number }[] = [];
    if (order.summary) {
      const parts = order.summary.split(', ');
      parts.forEach((part) => {
        const match = part.match(/(.+) ×(\d+)/);
        if (match) {
          const name = match[1].trim();
          const qty = parseInt(match[2], 10) || 1;
          const dish = menus.find((m) => m.name.toLowerCase() === name.toLowerCase());
          const price = dish ? dish.price : Math.round(order.grand_total / (parts.length * qty * 1.05));
          parsedItems.push({
            name,
            qty,
            price,
            amount: price * qty
          });
        }
      });
    }

    const calculatedSubtotal = parsedItems.reduce((acc, i) => acc + i.amount, 0);
    const subtotal = calculatedSubtotal > 0 ? calculatedSubtotal : Math.round(order.grand_total / 1.05);
    const gstAmount = order.grand_total - subtotal;
    const now = new Date();
    const dateStr = order.date ? `${order.date}` : now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const billData: PrintableBillData = {
      title: 'SETTLED TAX INVOICE / RECEIPT',
      restaurantName: activeRestaurant.name,
      restaurantCity: activeRestaurant.city,
      billNo: `RCPT-${order.id.slice(-6).toUpperCase()}`,
      tableName: order.table_name,
      dateTime: dateStr,
      items: parsedItems.length > 0 ? parsedItems : [{ name: order.summary || 'Restaurant Dine-In', qty: 1, price: subtotal, amount: subtotal }],
      subtotal,
      gstAmount,
      grandTotal: order.grand_total,
      paymentMode: order.payment_mode,
      isSettled: true
    };

    setActiveBillPrint(billData);
    playAudioBeep(680);
    showToast(`🖨️ Generated Receipt Preview for ${order.table_name}`);
  };

  const handleCopyBillReceipt = async (bill: PrintableBillData) => {
    const text = [
      `================================`,
      `       ${bill.restaurantName.toUpperCase()}`,
      `       ${bill.restaurantCity}`,
      `       ${bill.title}`,
      `================================`,
      `Bill No: ${bill.billNo}`,
      `Table: ${bill.tableName} | Server: ${bill.waiterName || 'Staff'}`,
      `Date/Time: ${bill.dateTime}`,
      `--------------------------------`,
      `ITEM                  QTY  RATE  AMOUNT`,
      ...bill.items.map(
        (i) => `${i.name.padEnd(20).slice(0, 20)} ${i.qty.toString().padStart(3)}  ₹${i.price.toString().padStart(4)}  ₹${i.amount.toString().padStart(5)}`
      ),
      `--------------------------------`,
      `Sub Total:                     ₹${bill.subtotal}`,
      `CGST (2.5%):                   ₹${Math.round(bill.gstAmount / 2)}`,
      `SGST (2.5%):                   ₹${Math.round(bill.gstAmount / 2)}`,
      `Total GST (5%):                ₹${bill.gstAmount}`,
      `--------------------------------`,
      `GRAND TOTAL:                   ₹${bill.grandTotal}`,
      `Payment Status: ${bill.isSettled ? `PAID via ${bill.paymentMode}` : 'UNBILLED / RUNNING'}`,
      `================================`,
      `  Thank you for dining with us!`,
      `        Please Visit Again`,
      `================================`
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      showToast('📋 Bill text copied to clipboard!');
    } catch {
      showToast('📋 Bill text copied');
    }
  };

  // Manager: Menu Watch & Live Item Management (Version 3.0)
  const handleToggleDishStock = async (dishId: string) => {
    const target = menus.find((m) => m.id === dishId);
    if (!target) return;
    const newStock = !(target.is_available ?? true);
    const updated: MenuItem = { ...target, is_available: newStock, is_synced: isOnline };
    const nextMenus = menus.map((m) => (m.id === dishId ? updated : m));
    setMenus(nextMenus);
    saveLocalState('menus', nextMenus);
    showToast(newStock ? `🟢 ${target.name} is now In Stock & Available` : `🔴 ${target.name} marked Out of Stock (86)`);
    playAudioBeep(600);

    try {
      await setDoc(doc(db, 'menus', dishId), updated);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `menus/${dishId}`);
    }
  };

  const handleStartEditDish = (dish: MenuItem) => {
    setEditingDishId(dish.id);
    setEditDishName(dish.name);
    setEditDishCat(dish.category);
    setEditDishPrice(dish.price.toString());
  };

  const handleCancelEditDish = () => {
    setEditingDishId(null);
    setEditDishName('');
    setEditDishCat('');
    setEditDishPrice('');
  };

  const handleSaveEditDish = async (dishId: string) => {
    const target = menus.find((m) => m.id === dishId);
    if (!target) return;
    const priceNum = parseFloat(editDishPrice);
    if (!editDishName.trim() || isNaN(priceNum) || priceNum <= 0) {
      showToast('⚠️ Please enter valid dish name and price');
      return;
    }

    const updated: MenuItem = {
      ...target,
      name: editDishName.trim(),
      category: editDishCat.trim() || target.category,
      price: priceNum,
      is_synced: isOnline
    };

    const nextMenus = menus.map((m) => (m.id === dishId ? updated : m));
    setMenus(nextMenus);
    saveLocalState('menus', nextMenus);
    handleCancelEditDish();
    showToast(`✅ Updated ${updated.name} (₹${priceNum})`);
    playAudioBeep(680);

    try {
      await setDoc(doc(db, 'menus', dishId), updated);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `menus/${dishId}`);
    }
  };

  const handleDeleteDish = async (dishId: string, dishName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${dishName}" from the restaurant menu?`)) {
      return;
    }
    const nextMenus = menus.filter((m) => m.id !== dishId);
    setMenus(nextMenus);
    saveLocalState('menus', nextMenus);
    showToast(`🗑️ Deleted ${dishName} from menu`);

    try {
      await deleteDoc(doc(db, 'menus', dishId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `menus/${dishId}`);
    }
  };

  // Manager: Add dining table
  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTableName.trim();
    if (!trimmed) {
      showToast('⚠️ Please enter a table name or number (e.g. Table 7 or VIP-1)');
      return;
    }

    if (currentRestaurantTables.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
      showToast(`⚠️ Table "${trimmed}" already exists in this restaurant!`);
      return;
    }

    const cap = parseInt(newTableCapacity, 10) || 4;
    const newTbl: RestaurantTable = {
      id: generateUUID(),
      name: trimmed,
      capacity: cap
    };

    const updatedTables = [...currentRestaurantTables, newTbl];
    const updatedRest: Restaurant = {
      ...activeRestaurant,
      tablesCount: updatedTables.length,
      tables: updatedTables,
      is_synced: isOnline
    };

    const nextRestaurants = restaurants.map((r) => (r.id === activeRestaurant.id ? updatedRest : r));
    setRestaurants(nextRestaurants);
    saveLocalState('restaurants', nextRestaurants);
    setNewTableName('');
    setNewTableCapacity('4');
    playAudioBeep(680);
    showToast(`🪑 Added ${newTbl.name} (${cap} Seater) to restaurant!`);

    if (lanChannelRef.current) lanChannelRef.current.postMessage({ type: 'SYNC' });

    try {
      await setDoc(doc(db, 'restaurants', activeRestaurant.id), updatedRest);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `restaurants/${activeRestaurant.id}`);
    }
  };

  // Manager: Delete dining table
  const handleDeleteTable = async (tbl: RestaurantTable) => {
    const isRunning = activeKots.some((k) => k.table_name === tbl.name);
    if (isRunning) {
      showToast(`⚠️ Cannot delete "${tbl.name}"! It currently has active running orders. Settle bill first.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${tbl.name}"?`)) return;

    const updatedTables = currentRestaurantTables.filter((t) => t.id !== tbl.id && t.name !== tbl.name);
    const updatedRest: Restaurant = {
      ...activeRestaurant,
      tablesCount: updatedTables.length,
      tables: updatedTables,
      is_synced: isOnline
    };

    const nextRestaurants = restaurants.map((r) => (r.id === activeRestaurant.id ? updatedRest : r));
    setRestaurants(nextRestaurants);
    saveLocalState('restaurants', nextRestaurants);
    if (selectedTable === tbl.name) {
      setSelectedTable('');
    }
    showToast(`🗑️ Removed ${tbl.name}`);

    if (lanChannelRef.current) lanChannelRef.current.postMessage({ type: 'SYNC' });

    try {
      await setDoc(doc(db, 'restaurants', activeRestaurant.id), updatedRest);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `restaurants/${activeRestaurant.id}`);
    }
  };

  // Admin: Create restaurant
  const handleCreateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminRestName.trim()) return;
    const newRestId = generateUUID();
    const count = parseInt(adminRestTables, 10) || 6;
    const initialTables: RestaurantTable[] = Array.from({ length: count }).map((_, i) => ({
      id: generateUUID(),
      name: `Table ${i + 1}`,
      capacity: 4
    }));

    const newRest: Restaurant = {
      id: newRestId,
      name: adminRestName.trim(),
      city: adminRestCity.trim() || 'Main City',
      tablesCount: count,
      tables: initialTables,
      is_synced: isOnline
    };

    const dishId = generateUUID();
    const seedDish: MenuItem = {
      id: dishId,
      restaurant_id: newRestId,
      name: 'Special Veg Thali',
      category: 'Main Course',
      price: 180,
      is_synced: isOnline
    };

    const nextRestaurants = [...restaurants, newRest];
    const nextMenus = [...menus, seedDish];
    setRestaurants(nextRestaurants);
    setMenus(nextMenus);
    saveLocalState('restaurants', nextRestaurants);
    saveLocalState('menus', nextMenus);

    setActiveRestaurantId(newRestId);
    setAdminRestName('');
    setAdminRestCity('');
    showToast('🏢 New Restaurant Tenant saved!');

    try {
      await setDoc(doc(db, 'restaurants', newRestId), newRest);
      await setDoc(doc(db, 'menus', dishId), seedDish);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'restaurants');
    }
  };

  // Admin: Create Staff Credential
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffUsername.trim() || !newStaffPin.trim()) {
      showToast('Please fill all staff fields');
      return;
    }

    const checkExists = staff.some(
      (s) => s.username.toLowerCase() === newStaffUsername.trim().toLowerCase()
    );
    if (checkExists) {
      showToast('Username already taken! Choose a unique username.');
      return;
    }

    const staffId = generateUUID();
    const newStaff: StaffUser = {
      id: staffId,
      name: newStaffName.trim(),
      username: newStaffUsername.trim().toLowerCase(),
      pinOrPass: newStaffPin.trim(),
      role: newStaffRole,
      restaurant_id: newStaffRole === 'ADMIN' ? 'all' : newStaffRestId,
      is_active: true
    };

    const nextStaff = [...staff, newStaff];
    setStaff(nextStaff);
    saveLocalState('staff', nextStaff);
    setNewStaffName('');
    setNewStaffUsername('');
    setNewStaffPin('');
    showToast(`👤 Created ${newStaffRole} credentials for ${newStaff.name}`);

    try {
      await setDoc(doc(db, 'staff', staffId), newStaff);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'staff');
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (staffId === currentUser?.id) {
      showToast('Cannot delete the currently logged-in account!');
      return;
    }
    if (window.confirm('Are you sure you want to delete this staff credential?')) {
      const nextStaff = staff.filter((s) => s.id !== staffId);
      setStaff(nextStaff);
      saveLocalState('staff', nextStaff);
      showToast('Staff credential deleted');

      try {
        await deleteDoc(doc(db, 'staff', staffId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `staff/${staffId}`);
      }
    }
  };

  const toggleStaffStatus = async (staffId: string) => {
    const s = staff.find((item) => item.id === staffId);
    if (!s) return;
    const updated = { ...s, is_active: !s.is_active };
    const nextStaff = staff.map((item) => (item.id === staffId ? updated : item));
    setStaff(nextStaff);
    saveLocalState('staff', nextStaff);
    showToast('Staff status updated');

    try {
      await setDoc(doc(db, 'staff', staffId), updated);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `staff/${staffId}`);
    }
  };

  const resetAllData = async () => {
    if (window.confirm('Reset all demo data to defaults?')) {
      setStaff(INITIAL_STAFF);
      setRestaurants(INITIAL_RESTAURANTS);
      setMenus(INITIAL_MENUS);
      setKots([]);
      setCompletedOrders([]);
      saveLocalState('staff', INITIAL_STAFF);
      saveLocalState('restaurants', INITIAL_RESTAURANTS);
      saveLocalState('menus', INITIAL_MENUS);
      saveLocalState('kots', []);
      saveLocalState('completed', []);

      if (navigator.onLine) {
        for (const s of INITIAL_STAFF) await setDoc(doc(db, 'staff', s.id), s);
        for (const r of INITIAL_RESTAURANTS) await setDoc(doc(db, 'restaurants', r.id), r);
        for (const m of INITIAL_MENUS) await setDoc(doc(db, 'menus', m.id), m);
        for (const k of kots) await deleteDoc(doc(db, 'kots', k.id));
      }

      setCart({});
      setSelectedTable('');
      setSelectedCategory('All');
      showToast('🔄 POS Database Reset to defaults!');
    }
  };

  const getStepProgress = (status: KotStatus) => {
    const steps: KotStatus[] = ['CREATED', 'COOKING_STARTED', 'COOKING', 'READY'];
    const idx = status === 'SERVED' ? 4 : steps.indexOf(status);
    return (
      <div className="grid grid-cols-4 gap-1.5 my-2.5">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i < idx ? 'bg-emerald-500' : i === idx ? 'bg-[#ff5722]' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
    );
  };

  const managerTableGroups = useMemo(() => {
    const grouped: { [tName: string]: KOT[] } = {};
    activeKots.forEach((k) => {
      if (!grouped[k.table_name]) grouped[k.table_name] = [];
      grouped[k.table_name].push(k);
    });
    return grouped;
  }, [activeKots]);

  // =========================================================================
  // VIEW 1: LOGIN PAGE
  // =========================================================================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans">
        {/* Offline notification banner if offline */}
        {!isOnline && (
          <div className="bg-amber-600/90 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 max-w-md mx-auto mb-2 shadow-lg">
            <WifiOff className="w-4 h-4" />
            <span>Offline Mode Active — You can log in and run POS locally</span>
          </div>
        )}

        {/* Toast notifications */}
        <div className="fixed top-6 left-4 right-4 max-w-sm mx-auto z-50 flex flex-col gap-2 pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="bg-[#0f172a] text-white px-4 py-3 rounded-xl text-xs sm:text-sm font-bold shadow-2xl border-l-4 border-[#ff5722]"
            >
              {t.msg}
            </div>
          ))}
        </div>

        <div className="max-w-md w-full mx-auto my-auto py-8">
          {/* Logo & Heading */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff6b35] to-[#f73819] flex items-center justify-center font-black text-3xl mx-auto shadow-lg shadow-orange-500/30 mb-4 border border-orange-400/30">
              P
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
              <span>POSHub Pro</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <span>Offline + PWA</span>
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">
              Complete Restaurant POS • Runs 100% Offline with Cloud Auto-Sync
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-[#1e293b]/90 backdrop-blur-md border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-700/70">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#ff5722]" />
                  <span>Staff Login</span>
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">
                  Offline storage ready • Admin authorized credentials
                </p>
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${
                isOnline ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}>
                {isOnline ? '🟢 Online' : '🟠 Offline Mode'}
              </span>
            </div>

            {loginError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Username / Staff ID
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="e.g. admin, waiter, kitchen, manager"
                    className="w-full bg-[#0f172a]/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold text-white placeholder-slate-500 outline-none focus:border-[#ff5722] focus:ring-1 focus:ring-[#ff5722] transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Password / PIN
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter password or 4-digit PIN"
                    className="w-full bg-[#0f172a]/80 border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-sm font-semibold text-white placeholder-slate-500 outline-none focus:border-[#ff5722] focus:ring-1 focus:ring-[#ff5722] transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-200 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-[#ff6b35] to-[#f73819] text-white font-black text-sm tracking-wide shadow-lg shadow-orange-500/30 hover:opacity-95 active:scale-[0.99] transition cursor-pointer"
              >
                Sign In to POS
              </button>
            </form>

            {/* Quick Demo One-Click Logins */}
            <div className="mt-6 pt-5 border-t border-slate-700/60">
              <div className="text-center text-[11px] font-bold text-slate-400 mb-3 flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Quick Test (Pre-Seeded Roles)</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {staff.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => quickDemoLogin(s)}
                    className="flex flex-col items-start p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/90 border border-slate-700 transition text-left cursor-pointer group"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-extrabold text-xs text-white group-hover:text-orange-400 transition">
                        {s.role}
                      </span>
                      <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">
                        {s.username}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 truncate w-full mt-0.5">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* In-app Install Prompt button on Login screen */}
          {!isInstalled && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={handleInstallClick}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
              >
                <Download className="w-4 h-4 text-orange-400" />
                <span>📲 Install POS App on this Device (Works Offline)</span>
              </button>
            </div>
          )}

          {/* Universal Install Guide Modal on Login screen */}
          {showInstallGuide && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
              <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-slate-900 border border-slate-200">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#f73819] text-white flex items-center justify-center font-black shadow-md shadow-orange-500/30">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">Install Dolly POS</h3>
                    <p className="text-[11px] text-slate-500 font-medium">Add to your Home Screen</p>
                  </div>
                </div>

                {isIOS ? (
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-2 mt-3">
                    <p className="font-extrabold text-slate-900">On iPhone / iPad Safari:</p>
                    <p>1. Tap the <b>Share</b> button (square with arrow) at the bottom.</p>
                    <p>2. Scroll down and tap <b>"Add to Home Screen"</b>.</p>
                    <p>3. Tap <b>"Add"</b> in the top right corner.</p>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-2 mt-3">
                    <p className="font-extrabold text-slate-900">On Android Chrome:</p>
                    <p>1. Tap the <b>three dots menu (⋮)</b> in the top-right corner of Chrome.</p>
                    <p>2. Tap <b>"Install app"</b> or <b>"Add to Home screen"</b>.</p>
                    <p>3. Tap <b>"Install"</b> to confirm.</p>
                  </div>
                )}

                <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
                  ⭐ Once installed, Dolly POS launches fullscreen without browser address bars and works 100% offline!
                </p>

                <button
                  type="button"
                  onClick={() => setShowInstallGuide(false)}
                  className="mt-4 w-full rounded-xl bg-[#0f172a] text-white py-2.5 text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
                >
                  Understood
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="text-center text-[11px] text-slate-500 py-2">
          POSHub Pro • Native Offline IndexedDB Persistence & Service Worker Cache
        </footer>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: AUTHENTICATED POS APPLICATION
  // =========================================================================
  const isAdmin = currentUser.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-[#f4f6fb] text-[#0f172a] pb-10 font-sans">
      {/* ================= TOP APP BAR ================= */}
      <header className="sticky top-0 z-50 bg-[#0f172a] text-white px-3 sm:px-4 py-2.5 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#f73819] flex items-center justify-center font-black text-base sm:text-lg shadow-md shadow-orange-500/30 flex-shrink-0">
              P
            </div>
            <div className="min-w-0">
              <div className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span>Multi-Restaurant POS</span>
                <span className={`text-[8px] px-1.5 py-0.2 rounded font-mono font-bold ${
                  isOnline ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {isOnline ? 'CLOUD SYNC' : 'OFFLINE MODE'}
                </span>
              </div>
              {isAdmin || currentUser.restaurant_id === 'all' ? (
                <select
                  value={activeRestaurantId}
                  onChange={(e) => {
                    setActiveRestaurantId(e.target.value);
                    setSelectedTable('Table 1');
                    setSelectedCategory('All');
                    setCart({});
                    showToast('🏢 Restaurant Switched!');
                  }}
                  className="bg-[#1e293b] text-white border border-slate-700 rounded-lg px-2 py-0.5 sm:py-1 text-xs sm:text-sm font-bold max-w-[170px] sm:max-w-[210px] truncate focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="font-extrabold text-xs sm:text-sm text-slate-200 truncate max-w-[180px]">
                  {activeRestaurant.name}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Install PWA Button (Visible unless already running in standalone mode) */}
            {!isInstalled && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="inline-flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs px-3 py-1.5 rounded-full shadow-md shadow-orange-500/20 hover:opacity-95 transition cursor-pointer"
                title="Install App on this Device"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install POS</span>
              </button>
            )}

            {/* Online / Offline status badge */}
            <div
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 ${
                isOnline
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-600'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-600'
              }`}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition flex items-center gap-1 cursor-pointer"
              title="Log out from POS"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Offline Alert Bar when connection is lost */}
      {!isOnline && (
        <div className="bg-amber-500 text-slate-900 px-4 py-2 font-bold text-xs flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2 mx-auto">
            <AlertTriangle className="w-4 h-4 text-slate-900" />
            <span>
              <b>Working Offline:</b> New KOTs and bills will be saved to this device and automatically sync to the cloud when internet returns.
            </span>
          </div>
        </div>
      )}

      {/* Universal Install Guide Modal (Android Chrome & iOS Safari) */}
      {showInstallGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-slate-900 border border-slate-200">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#f73819] text-white flex items-center justify-center font-black shadow-md shadow-orange-500/30">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Install Dolly POS App</h3>
                <p className="text-[11px] text-slate-500 font-medium">Add to your Phone Home Screen</p>
              </div>
            </div>

            {isIOS ? (
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-2 mt-3">
                <p className="font-extrabold text-slate-900">On iPhone / iPad Safari:</p>
                <p>1. Tap the <b>Share</b> button (square with arrow) at the bottom.</p>
                <p>2. Scroll down and tap <b>"Add to Home Screen"</b>.</p>
                <p>3. Tap <b>"Add"</b> in the top right corner.</p>
              </div>
            ) : (
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-2 mt-3">
                <p className="font-extrabold text-slate-900">On Android Chrome:</p>
                <p>1. Tap the <b>three dots menu (⋮)</b> in the top-right corner of Chrome.</p>
                <p>2. Tap <b>"Install app"</b> or <b>"Add to Home screen"</b>.</p>
                <p>3. Tap <b>"Install"</b> to confirm.</p>
              </div>
            )}

            <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
              ⭐ Once installed, Dolly POS launches fullscreen without browser address bars and works 100% offline!
            </p>

            <button
              onClick={() => setShowInstallGuide(false)}
              className="mt-4 w-full rounded-xl bg-[#0f172a] text-white py-2.5 text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* Toast alerts */}
      <div className="fixed top-16 left-4 right-4 max-w-sm mx-auto z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="bg-[#0f172a] text-white px-4 py-3 rounded-xl text-xs sm:text-sm font-bold shadow-xl border-l-4 border-[#ff5722] animate-bounce-in"
          >
            {t.msg}
          </div>
        ))}
      </div>

      {/* Role Notice & Admin Workspace Switcher */}
      <div className="bg-slate-100 border-b border-slate-200 px-3 sm:px-4 py-2">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-500">Staff:</span>
            <span className="font-extrabold text-slate-900">{currentUser.name}</span>
            <span className="bg-[#ff5722]/10 text-[#ff5722] border border-[#ff5722]/20 px-2 py-0.5 rounded font-black text-[10px] uppercase">
              {currentUser.role}
            </span>
          </div>

          {/* If Super Admin, show quick role switcher tabs right at the top */}
          {isAdmin && (
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-300 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 px-2">View:</span>
              <button
                onClick={() => setCurrentRole('ADMIN')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                  currentRole === 'ADMIN' ? 'bg-[#ff5722] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Admin Panel
              </button>
              <button
                onClick={() => setCurrentRole('WAITER')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                  currentRole === 'WAITER' ? 'bg-[#ff5722] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Waiter
              </button>
              <button
                onClick={() => setCurrentRole('KITCHEN')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                  currentRole === 'KITCHEN' ? 'bg-[#ff5722] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Kitchen
              </button>
              <button
                onClick={() => setCurrentRole('MANAGER')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                  currentRole === 'MANAGER' ? 'bg-[#ff5722] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Manager
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ================= MAIN CONTAINER ================= */}
      <main className="max-w-6xl mx-auto p-3.5 sm:p-5">
        {/* ================= 1. WAITER WORKSPACE ================= */}
        {currentRole === 'WAITER' && (
          <div>
            {/* Mobile Sub-Tabs (Punch Order vs Live KOT Status) */}
            <div className="grid grid-cols-2 bg-slate-200 p-1 rounded-xl mb-4 md:hidden">
              <button
                onClick={() => setWaiterSubTab('ORDER')}
                className={`py-2 rounded-lg text-xs font-bold transition ${
                  waiterSubTab === 'ORDER' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                🍽️ Punch Order
              </button>
              <button
                onClick={() => setWaiterSubTab('KOT')}
                className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  waiterSubTab === 'KOT' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                <span>📡 Live KOT Status</span>
                <span className="bg-[#ff5722] text-white text-[10px] px-1.5 py-0.5 rounded-full font-black">
                  {activeKots.length}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Left Column: Tables & Menu */}
              <div className={`md:col-span-7 lg:col-span-8 ${waiterSubTab !== 'ORDER' ? 'hidden md:block' : ''}`}>
                {!selectedTable ? (
                  /* ================= STEP 1: MANDATORY TABLE SELECTION ================= */
                  <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-md">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#f73819] text-white flex items-center justify-center text-xs font-black shadow-sm">
                            1
                          </span>
                          <h2 className="font-black text-base sm:text-lg text-slate-900">
                            Select Dining Table First
                          </h2>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          ⚡ Tap a table below to start punch order. Enforcing table selection first prevents mispunched KOTs during rush hours.
                        </p>
                      </div>

                      <div className="flex items-center gap-3 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 self-start sm:self-auto">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          <span>Vacant</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                          <span>Running</span>
                        </span>
                        <span className="text-slate-400">|</span>
                        <span>{currentRestaurantTables.length} Tables</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {currentRestaurantTables.map((tbl) => {
                        const tableKots = activeKots.filter((k) => k.table_name === tbl.name);
                        const isOccupied = tableKots.length > 0;
                        const runningItemsCount = tableKots.reduce((acc, k) => acc + k.items.reduce((sum, i) => sum + i.qty, 0), 0);
                        const runningTotal = tableKots.reduce((acc, k) => acc + k.items.reduce((sum, i) => sum + (i.price * i.qty), 0), 0);

                        return (
                          <button
                            key={tbl.id}
                            onClick={() => {
                              setSelectedTable(tbl.name);
                              playAudioBeep(640);
                              showToast(`🪑 Selected ${tbl.name} — now select customer dishes!`);
                            }}
                            className={`p-4 rounded-2xl border-2 text-left transition-all relative cursor-pointer group hover:shadow-md hover:-translate-y-0.5 ${
                              isOccupied
                                ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400'
                                : 'bg-slate-50/80 border-slate-200 hover:border-[#ff5722] hover:bg-orange-50/30'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <span className="block font-black text-base text-slate-900 group-hover:text-[#ff5722] transition">
                                  {tbl.name}
                                </span>
                                <span className="text-[11px] text-slate-500 font-bold block mt-0.5">
                                  👥 {tbl.capacity || 4} Seater
                                </span>
                              </div>
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                  isOccupied
                                    ? 'bg-amber-200 text-amber-900 border border-amber-300'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {isOccupied ? 'Running' : 'Free'}
                              </span>
                            </div>

                            {isOccupied ? (
                              <div className="text-[11px] font-extrabold text-amber-800 bg-amber-100/70 px-2 py-1 rounded-lg mt-2 flex justify-between">
                                <span>{runningItemsCount} items</span>
                                <span>₹{runningTotal}</span>
                              </div>
                            ) : (
                              <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg mt-2 flex items-center justify-between">
                                <span>Tap to Order</span>
                                <span>➔</span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* ================= STEP 2: MENU DISH SELECTION (Table Selected) ================= */
                  <div className="space-y-4">
                    {/* Active Selected Table Banner */}
                    <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-white border-2 border-[#ff5722] rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#f73819] text-white flex items-center justify-center font-black shadow-sm flex-shrink-0">
                          <LayoutGrid className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                              Punching Order For:
                            </span>
                            <span className="text-base sm:text-lg font-black text-[#ff5722] bg-white px-3 py-0.5 rounded-lg border border-orange-200 shadow-xs">
                              {selectedTable}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500">
                              ({currentRestaurantTables.find((t) => t.name === selectedTable)?.capacity || 4} Seater)
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-slate-600 mt-1 flex items-center gap-2">
                            {activeKots.some((k) => k.table_name === selectedTable) ? (
                              <span className="text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-md text-[11px]">
                                🟠 Table has running orders (adding to existing bill)
                              </span>
                            ) : (
                              <span className="text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded-md text-[11px]">
                                🟢 Vacant Table (New customer order)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (cartKeys.length > 0) {
                            if (!window.confirm(`Switch table? Current ${cartSummary.totalQty} items in cart will be assigned to the newly selected table.`)) {
                              return;
                            }
                          }
                          setSelectedTable('');
                        }}
                        className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-extrabold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                      >
                        <ArrowLeft className="w-4 h-4 text-[#ff5722]" />
                        <span>Switch Table</span>
                      </button>
                    </div>

                    {/* Menu items card */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-orange-50 text-[#ff5722] flex items-center justify-center text-xs font-black">
                            2
                          </span>
                          <span>Select Customer Dishes</span>
                        </div>
                        <span className="text-xs font-bold text-slate-500">
                          {filteredMenus.length} dishes
                        </span>
                      </div>

                      {/* Category horizontal scroll */}
                      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
                        {categories.map((c) => (
                          <button
                            key={c}
                            onClick={() => setSelectedCategory(c)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                              selectedCategory === c
                                ? 'bg-[#0f172a] text-white border border-[#0f172a]'
                                : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>

                      {/* Search Input */}
                      <div className="relative mb-3">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search Paneer, Roti, Biryani, Thali..."
                          className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:border-[#ff5722] focus:bg-white transition"
                        />
                      </div>

                      {/* Menu items grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {filteredMenus.map((item) => {
                          const qty = cart[item.id] || 0;
                          const isOutOfStock = item.is_available === false;
                          return (
                            <div
                              key={item.id}
                              className={`flex items-center justify-between p-3 rounded-xl border-1.5 transition ${
                                isOutOfStock
                                  ? 'border-slate-200 bg-slate-100/70 opacity-60'
                                  : qty > 0
                                  ? 'border-[#ff5722] bg-orange-50/50'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-slate-800">
                                  <span className="w-3 h-3 border border-emerald-600 rounded flex items-center justify-center flex-shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                  </span>
                                  <span className="truncate">{item.name}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs font-extrabold text-slate-500">₹{item.price}</span>
                                  {isOutOfStock && (
                                    <span className="text-[10px] font-black bg-red-100 text-red-700 px-1.5 py-0.2 rounded border border-red-200">
                                      Out of Stock
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {isOutOfStock ? (
                                  <span className="text-[11px] font-bold text-slate-400 px-2 py-1 bg-slate-200 rounded-lg">
                                    86'd
                                  </span>
                                ) : (
                                  <>
                                    {qty > 0 ? (
                                      <>
                                        <button
                                          onClick={() => updateCart(item.id, -1)}
                                          className="w-8 h-8 rounded-lg bg-slate-200 text-slate-800 flex items-center justify-center font-black text-sm hover:bg-slate-300 transition cursor-pointer"
                                        >
                                          <Minus className="w-3.5 h-3.5" />
                                        </button>
                                        <span className="font-black text-sm min-w-5 text-center">{qty}</span>
                                      </>
                                    ) : null}
                                    <button
                                      onClick={() => updateCart(item.id, 1)}
                                      className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff6b35] to-[#f73819] text-white flex items-center justify-center font-black text-sm shadow-sm shadow-orange-500/30 hover:opacity-90 transition cursor-pointer"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Live Kitchen KOT Feed */}
              <div className={`md:col-span-5 lg:col-span-4 ${waiterSubTab !== 'KOT' ? 'hidden md:block' : ''}`}>
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm sticky top-20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-extrabold text-sm sm:text-base flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-orange-500" />
                      <span>Live Kitchen KOT Status</span>
                    </div>
                    <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      {isOnline ? 'Cloud Synced' : 'Offline Cached'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mb-3">
                    Syncs dynamically across all waiter & kitchen screens:
                  </p>

                  {activeKots.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-xs font-medium">
                      No active KOTs currently running for this restaurant.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                      {activeKots.map((k) => (
                        <div
                          key={k.id}
                          className={`p-3 rounded-2xl border-2 transition ${
                            k.status === 'READY'
                              ? 'bg-emerald-50/60 border-emerald-400'
                              : k.status === 'COOKING'
                              ? 'bg-blue-50/40 border-blue-300'
                              : k.status === 'COOKING_STARTED'
                              ? 'bg-amber-50/50 border-amber-300'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-extrabold text-sm text-slate-900">{k.table_name}</span>
                              <span className="text-xs font-bold text-slate-400 ml-1.5">#KOT-{k.token_no}</span>
                            </div>
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                k.status === 'READY'
                                  ? 'bg-emerald-500 text-white'
                                  : k.status === 'COOKING'
                                  ? 'bg-blue-100 text-blue-700'
                                  : k.status === 'COOKING_STARTED'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {k.status.replace('_', ' ')}
                            </span>
                          </div>

                          {getStepProgress(k.status)}

                          <div className="text-xs font-bold text-slate-700 space-y-0.5 my-2">
                            {k.items.map((i, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span>• {i.name}</span>
                                <span className="text-[#ff5722]">×{i.qty}</span>
                              </div>
                            ))}
                            {k.note && (
                              <div className="text-red-500 text-[11px] font-semibold mt-1 bg-red-50 p-1 rounded">
                                📝 Note: {k.note}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                            <span>
                              {isOnline ? '✔ Cloud Synced' : '💾 Offline Storage'} • {k.created_at}
                            </span>
                            {k.status === 'READY' && (
                              <button
                                onClick={() => changeKotStatus(k.id, 'SERVED')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition flex items-center gap-1 shadow-sm cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Mark Served</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Floating Bottom Cart Bar for Waiter */}
            {cartKeys.length > 0 && (
              <div className="fixed bottom-4 left-3 right-3 max-w-xl mx-auto bg-[#0f172a] text-white p-3 sm:p-4 rounded-2xl shadow-2xl border border-slate-700 z-40 animate-slide-up">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-extrabold text-sm sm:text-base text-white truncate flex items-center gap-1.5 flex-wrap">
                      <span className="text-[#ff6b35] font-black bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                        🪑 {selectedTable || 'No Table'}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span>{cartSummary.totalQty} Items</span>
                      <span className="text-slate-400">|</span>
                      <span className="text-emerald-400 font-black">₹{cartSummary.totalPrice}</span>
                    </div>
                    <div className="text-xs text-slate-300 truncate max-w-xs">{cartSummary.previewText}</div>
                  </div>

                  <button
                    onClick={confirmKOT}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#f73819] text-white font-black text-xs sm:text-sm whitespace-nowrap shadow-md shadow-orange-500/40 hover:opacity-95 transition flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send KOT</span>
                  </button>
                </div>

                <input
                  type="text"
                  value={chefNote}
                  onChange={(e) => setChefNote(e.target.value)}
                  placeholder="📝 Chef Note (e.g. Less Spicy, Jain, No Onion)..."
                  className="w-full mt-2.5 bg-[#1e293b] border border-slate-700 text-white placeholder-slate-400 text-xs px-3 py-1.5 rounded-lg outline-none focus:border-orange-500"
                />
              </div>
            )}
          </div>
        )}

        {/* ================= 2. KITCHEN (KDS) WORKSPACE ================= */}
        {currentRole === 'KITCHEN' && (
          <div>
            <div className="bg-[#0f172a] text-white p-4 rounded-2xl mb-4 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <h2 className="text-base sm:text-lg font-black">Kitchen Display System (KDS)</h2>
                </div>
                <span className="text-xs font-bold bg-slate-800 px-3 py-1 rounded-full text-slate-300 border border-slate-700">
                  Live Tickets: {kitchenPendingKots.length}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Tap status buttons to progress orders: <b>Start ➔ Cooking ➔ Ready</b> (Works Offline & Online)
              </p>
            </div>

            {kitchenPendingKots.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <ChefHat className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <h3 className="font-black text-slate-700 text-base">🎉 All Caught Up!</h3>
                <p className="text-xs text-slate-400 mt-1">No pending tickets in the kitchen for this restaurant.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {kitchenPendingKots.map((k) => (
                  <div
                    key={k.id}
                    className={`p-4 rounded-2xl border-2 bg-white shadow-sm flex flex-col justify-between ${
                      k.status === 'READY'
                        ? 'border-emerald-500 bg-emerald-50/30'
                        : k.status === 'COOKING'
                        ? 'border-blue-400'
                        : k.status === 'COOKING_STARTED'
                        ? 'border-amber-400'
                        : 'border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-slate-900">{k.table_name}</span>
                          <span className="text-xs font-extrabold bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                            #{k.token_no}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                            k.status === 'READY'
                              ? 'bg-emerald-500 text-white'
                              : k.status === 'COOKING'
                              ? 'bg-blue-100 text-blue-700'
                              : k.status === 'COOKING_STARTED'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {k.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="space-y-1.5 my-3 border-y border-slate-100 py-2.5">
                        {k.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm font-bold text-slate-800">
                            <span>{item.name}</span>
                            <span className="bg-[#0f172a] text-white px-2 py-0.5 rounded text-xs font-black">
                              ×{item.qty}
                            </span>
                          </div>
                        ))}
                      </div>

                      {k.note && (
                        <div className="bg-red-50 text-red-600 p-2 rounded-xl text-xs font-bold border border-red-100 mb-3">
                          ⚠️ Chef Note: {k.note}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-dashed border-slate-200">
                      <button
                        onClick={() => changeKotStatus(k.id, 'COOKING_STARTED')}
                        className="py-2 px-1 rounded-xl text-xs font-black bg-amber-100 text-amber-800 hover:bg-amber-200 transition cursor-pointer"
                      >
                        1. Start
                      </button>
                      <button
                        onClick={() => changeKotStatus(k.id, 'COOKING')}
                        className="py-2 px-1 rounded-xl text-xs font-black bg-blue-100 text-blue-800 hover:bg-blue-200 transition cursor-pointer"
                      >
                        2. Cooking
                      </button>
                      <button
                        onClick={() => changeKotStatus(k.id, 'READY')}
                        className="py-2 px-1 rounded-xl text-xs font-black bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <BellRing className="w-3 h-3" />
                        <span>3. Ready</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= 3. MANAGER WORKSPACE (Version 3.0) ================= */}
        {currentRole === 'MANAGER' && (
          <div className="space-y-4">
            {/* Manager Header & Section Tabs */}
            <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#f73819] text-white flex items-center justify-center font-black shadow-sm flex-shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                    <span>Manager Console</span>
                    <span className="text-[10px] font-black bg-orange-100 text-[#ff5722] px-2 py-0.5 rounded-full uppercase">
                      v3.0 Pro
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    {activeRestaurant.name} • {activeRestaurant.city} ({currentRestaurantTables.length} Tables)
                  </p>
                </div>
              </div>

              {/* Manager Sub-Navigation Tabs */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 overflow-x-auto scrollbar-none">
                <button
                  type="button"
                  onClick={() => setManagerSubTab('BILLS')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    managerSubTab === 'BILLS'
                      ? 'bg-gradient-to-r from-[#ff6b35] to-[#f73819] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Bill Printing Desk</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      managerSubTab === 'BILLS' ? 'bg-black/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {Object.keys(managerTableGroups).length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setManagerSubTab('MENU_WATCH')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    managerSubTab === 'MENU_WATCH'
                      ? 'bg-gradient-to-r from-[#ff6b35] to-[#f73819] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Menu Watch & Catalog</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      managerSubTab === 'MENU_WATCH' ? 'bg-black/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {currentRestaurantMenus.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setManagerSubTab('TABLES')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    managerSubTab === 'TABLES'
                      ? 'bg-gradient-to-r from-[#ff6b35] to-[#f73819] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Dining Tables</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      managerSubTab === 'TABLES' ? 'bg-black/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {currentRestaurantTables.length}
                  </span>
                </button>
              </div>
            </div>

            {/* ================= SUBTAB 1: BILL PRINTING & SETTLEMENT DESK ================= */}
            {managerSubTab === 'BILLS' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Left Column: Running Table Bills & Printable Actions */}
                <div className="md:col-span-7 space-y-4">
                  {/* Running Table Bills Card */}
                  <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                      <div>
                        <div className="font-black text-sm sm:text-base flex items-center gap-2 text-slate-900">
                          <Receipt className="w-4 h-4 text-[#ff5722]" />
                          <span>Active Table Bills (5% GST Breakdown)</span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          Print thermal receipts for customers before or during payment settlement.
                        </p>
                      </div>
                      <span className="self-start sm:self-auto text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-xl">
                        {Object.keys(managerTableGroups).length} Tables Running
                      </span>
                    </div>

                    {Object.keys(managerTableGroups).length === 0 ? (
                      <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm font-extrabold text-slate-700">No Active Running Bills</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          When waiters punch orders, active bills and thermal print options appear here automatically.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {Object.entries(managerTableGroups).map(([tName, kotsList]) => {
                          let subtotal = 0;
                          const rows: { name: string; qty: number; price: number }[] = [];
                          kotsList.forEach((k) => {
                            k.items.forEach((i) => {
                              subtotal += i.price * i.qty;
                              rows.push({ name: i.name, qty: i.qty, price: i.price * i.qty });
                            });
                          });
                          const gst = Math.round(subtotal * 0.05);
                          const grand = subtotal + gst;
                          const totalItemsCount = rows.reduce((acc, r) => acc + r.qty, 0);

                          return (
                            <div
                              key={tName}
                              className="p-4 rounded-2xl border border-slate-200 bg-slate-50/80 hover:bg-slate-50 transition shadow-xs"
                            >
                              <div className="flex justify-between items-start border-b border-slate-200 pb-2.5 mb-2.5">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-base text-slate-900">{tName}</span>
                                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                                      {kotsList.length} KOT Ticket{kotsList.length > 1 ? 's' : ''}
                                    </span>
                                  </div>
                                  <span className="text-xs text-slate-500 font-semibold block mt-0.5">
                                    {totalItemsCount} Total Items • Waiter: {kotsList[0]?.waiter_name || 'Staff'}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <div className="text-[11px] text-slate-500 font-medium">
                                    Subtotal ₹{subtotal} + 5% GST ₹{gst}
                                  </div>
                                  <div className="font-black text-lg text-[#ff5722]">₹{grand}</div>
                                </div>
                              </div>

                              {/* Items list preview */}
                              <div className="space-y-1 mb-3.5 bg-white p-2.5 rounded-xl border border-slate-200 max-h-36 overflow-y-auto">
                                {rows.map((r, idx) => (
                                  <div key={idx} className="flex justify-between text-xs text-slate-700">
                                    <span className="font-medium">
                                      • {r.name} <b className="text-slate-900">× {r.qty}</b>
                                    </span>
                                    <span className="font-bold text-slate-800">₹{r.price}</span>
                                  </div>
                                ))}
                              </div>

                              {/* Action buttons: PRINT BILL + SETTLE */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => handlePrintRunningBill(tName)}
                                  className="py-2.5 px-3 rounded-xl bg-[#0f172a] hover:bg-slate-800 text-white font-black text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer sm:col-span-1"
                                  title="Open thermal bill print preview"
                                >
                                  <Printer className="w-3.5 h-3.5 text-orange-400" />
                                  <span>Print Bill</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => settleTableBill(tName, 'CASH')}
                                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                                >
                                  <DollarSign className="w-3.5 h-3.5" />
                                  <span>Cash Settle</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => settleTableBill(tName, 'UPI')}
                                  className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                                >
                                  <Smartphone className="w-3.5 h-3.5" />
                                  <span>UPI Settle</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Settled Bills History Card */}
                  <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                      <div className="font-black text-sm sm:text-base flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Today's Settled Bills Archive</span>
                      </div>
                      <span className="text-xs font-bold text-slate-500">
                        {completedOrders.filter((o) => o.restaurant_id === activeRestaurantId).length} Bills Paid
                      </span>
                    </div>

                    {completedOrders.filter((o) => o.restaurant_id === activeRestaurantId).length === 0 ? (
                      <div className="text-xs text-slate-400 py-6 text-center">
                        No settled orders yet today for this restaurant.
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                        {completedOrders
                          .filter((o) => o.restaurant_id === activeRestaurantId)
                          .map((o) => (
                            <div
                              key={o.id}
                              className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-slate-300 transition"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <strong className="text-slate-900 text-sm font-black">{o.table_name}</strong>
                                  <span
                                    className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                                      o.payment_mode === 'UPI'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-emerald-100 text-emerald-700'
                                    }`}
                                  >
                                    {o.payment_mode}
                                  </span>
                                  <span className="text-xs text-slate-400">{o.date}</span>
                                </div>
                                <div className="text-xs text-slate-500 truncate max-w-sm mt-0.5">
                                  {o.summary}
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5 justify-between sm:justify-end flex-shrink-0 pt-1 sm:pt-0 border-t sm:border-0 border-slate-200">
                                <span className="font-black text-base text-emerald-600">₹{o.grand_total}</span>
                                <button
                                  type="button"
                                  onClick={() => handlePrintSettledBill(o)}
                                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                  title="Re-print settled bill receipt"
                                >
                                  <Printer className="w-3.5 h-3.5 text-[#ff5722]" />
                                  <span>Print Slip</span>
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Quick Bill Desk Tools & Revenue Overview */}
                <div className="md:col-span-5 space-y-4">
                  {/* Today's Sales Metrics */}
                  <div className="bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white rounded-2xl p-5 border border-slate-800 shadow-md">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                        <span>Today's Revenue Desk</span>
                      </span>
                      <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        LIVE
                      </span>
                    </div>

                    <div className="text-3xl font-black text-white mb-1">
                      ₹
                      {completedOrders
                        .filter((o) => o.restaurant_id === activeRestaurantId)
                        .reduce((sum, o) => sum + o.grand_total, 0)}
                    </div>
                    <div className="text-xs text-slate-400 mb-4 font-medium">
                      Calculated from {completedOrders.filter((o) => o.restaurant_id === activeRestaurantId).length}{' '}
                      settled invoices today
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800 text-xs">
                      <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700">
                        <span className="text-slate-400 block text-[11px]">Running Tables</span>
                        <span className="text-lg font-black text-amber-400">
                          {Object.keys(managerTableGroups).length}
                        </span>
                      </div>
                      <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700">
                        <span className="text-slate-400 block text-[11px]">Menu Dishes</span>
                        <span className="text-lg font-black text-emerald-400">
                          {currentRestaurantMenus.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Direct Quick Bill Print by Table */}
                  <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
                    <div className="font-black text-sm text-slate-900 mb-2 flex items-center gap-2">
                      <Printer className="w-4 h-4 text-[#ff5722]" />
                      <span>Direct Table Thermal Print</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">
                      Select any dining table to instantly generate and print a thermal invoice:
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      {currentRestaurantTables.map((tbl) => {
                        const hasOrders = activeKots.some((k) => k.table_name === tbl.name);
                        return (
                          <button
                            key={tbl.id}
                            type="button"
                            onClick={() => {
                              if (hasOrders) {
                                handlePrintRunningBill(tbl.name);
                              } else {
                                showToast(`ℹ️ ${tbl.name} has no active orders right now.`);
                              }
                            }}
                            className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                              hasOrders
                                ? 'bg-orange-50/70 border-orange-300 hover:border-orange-400'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100 opacity-70'
                            }`}
                          >
                            <div>
                              <span className="font-extrabold text-xs text-slate-900 block">{tbl.name}</span>
                              <span className="text-[10px] text-slate-500">
                                {hasOrders ? '🟠 Active Orders' : 'Free'}
                              </span>
                            </div>
                            <Printer
                              className={`w-4 h-4 ${hasOrders ? 'text-[#ff5722]' : 'text-slate-400'}`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= SUBTAB 2: MENU ITEMS WATCH & CATALOG ================= */}
            {managerSubTab === 'MENU_WATCH' && (
              <div className="space-y-4">
                {/* Top Statistics Bar for Manager Watching Menu */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="text-xs font-bold text-slate-500 uppercase">Total Menu Items</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">{menuStats.total}</div>
                    <div className="text-[11px] text-slate-400 font-medium">In {activeRestaurant.name}</div>
                  </div>

                  <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="text-xs font-bold text-emerald-600 uppercase">In Stock / Available</div>
                    <div className="text-2xl font-black text-emerald-600 mt-1">{menuStats.inStock}</div>
                    <div className="text-[11px] text-slate-400 font-medium">Ready for orders</div>
                  </div>

                  <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="text-xs font-bold text-red-600 uppercase">Out of Stock (86'd)</div>
                    <div className="text-2xl font-black text-red-600 mt-1">{menuStats.outOfStock}</div>
                    <div className="text-[11px] text-slate-400 font-medium">Hidden from waitstaff</div>
                  </div>

                  <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="text-xs font-bold text-orange-600 uppercase">Average Dish Price</div>
                    <div className="text-2xl font-black text-orange-600 mt-1">₹{menuStats.avgPrice}</div>
                    <div className="text-[11px] text-slate-400 font-medium">{managerMenuCategories.length - 1} Categories</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Left Column: Live Menu Watch List (Audit, Price Edit, Availability Toggle) */}
                  <div className="lg:col-span-8 space-y-4">
                    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div>
                          <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                            <UtensilsCrossed className="w-4 h-4 text-[#ff5722]" />
                            <span>Restaurant Menu Watch & Audit</span>
                          </h3>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Watch all active dishes, adjust prices, or mark dishes out-of-stock when kitchen runs out.
                          </p>
                        </div>
                        <span className="text-xs font-extrabold bg-slate-100 text-slate-700 px-3 py-1 rounded-full self-start sm:self-auto border border-slate-200">
                          {managerFilteredMenus.length} Dishes Listed
                        </span>
                      </div>

                      {/* Search Bar & Category Filter Chips */}
                      <div className="space-y-2.5 mb-4 pb-4 border-b border-slate-100">
                        <div className="relative">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                          <input
                            type="text"
                            value={menuSearchQuery}
                            onChange={(e) => setMenuSearchQuery(e.target.value)}
                            placeholder="Search dishes to watch (e.g. Paneer, Naan, Biryani, Dal)..."
                            className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:border-[#ff5722] focus:bg-white transition"
                          />
                        </div>

                        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                          {managerMenuCategories.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setMenuFilterCategory(c)}
                              className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                                menuFilterCategory === c
                                  ? 'bg-[#0f172a] text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Live Menu Watch Cards / Rows */}
                      {managerFilteredMenus.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-xs font-medium">
                          No dishes found matching your search. Add dishes using the form on the right!
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {managerFilteredMenus.map((dish) => {
                            const isEditing = editingDishId === dish.id;
                            const isAvailable = dish.is_available !== false;

                            if (isEditing) {
                              return (
                                <div
                                  key={dish.id}
                                  className="p-3.5 rounded-2xl border-2 border-orange-400 bg-orange-50/40 space-y-2.5"
                                >
                                  <div className="font-extrabold text-xs text-orange-800">
                                    Editing Dish: {dish.name}
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <input
                                      type="text"
                                      value={editDishName}
                                      onChange={(e) => setEditDishName(e.target.value)}
                                      placeholder="Dish Name"
                                      className="bg-white border border-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold outline-none focus:border-orange-500"
                                    />
                                    <input
                                      type="text"
                                      value={editDishCat}
                                      onChange={(e) => setEditDishCat(e.target.value)}
                                      placeholder="Category"
                                      className="bg-white border border-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold outline-none focus:border-orange-500"
                                    />
                                    <input
                                      type="number"
                                      value={editDishPrice}
                                      onChange={(e) => setEditDishPrice(e.target.value)}
                                      placeholder="Price (₹)"
                                      className="bg-white border border-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold outline-none focus:border-orange-500"
                                    />
                                  </div>
                                  <div className="flex items-center justify-end gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={handleCancelEditDish}
                                      className="px-3 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveEditDish(dish.id)}
                                      className="px-3 py-1 rounded-lg bg-[#ff5722] hover:bg-orange-600 text-white text-xs font-black transition flex items-center gap-1 shadow-xs cursor-pointer"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Save Changes</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={dish.id}
                                className={`p-3 sm:p-3.5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                                  !isAvailable
                                    ? 'bg-red-50/40 border-red-200'
                                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 text-[#ff5722] flex items-center justify-center font-black text-xs flex-shrink-0">
                                    🍲
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-extrabold text-sm text-slate-900 truncate">
                                        {dish.name}
                                      </span>
                                      <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                                        {dish.category}
                                      </span>
                                      {!isAvailable && (
                                        <span className="text-[10px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded-md border border-red-200">
                                          Out of Stock (86'd)
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-500 font-semibold mt-0.5">
                                      Served at: <b className="text-slate-800">{activeRestaurant.name}</b>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                                  {/* Price Tag */}
                                  <span className="font-black text-base text-slate-900 min-w-16 text-right">
                                    ₹{dish.price}
                                  </span>

                                  {/* In Stock / Out of Stock Switch */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleDishStock(dish.id)}
                                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                                      isAvailable
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                        : 'bg-red-100 text-red-800 border border-red-300 hover:bg-red-200'
                                    }`}
                                    title="Click to toggle stock availability for waitstaff"
                                  >
                                    <span
                                      className={`w-2 h-2 rounded-full ${
                                        isAvailable ? 'bg-emerald-500' : 'bg-red-500'
                                      }`}
                                    />
                                    <span>{isAvailable ? 'In Stock' : '86’d'}</span>
                                  </button>

                                  {/* Edit button */}
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditDish(dish)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                                    title="Edit price or name"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Delete button */}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteDish(dish.id, dish.name)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition cursor-pointer"
                                    title="Delete dish"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Add New Dish Form */}
                  <div className="lg:col-span-4 space-y-4">
                    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm sticky top-20">
                      <div className="font-black text-sm sm:text-base mb-2 flex items-center gap-2">
                        <UtensilsCrossed className="w-4 h-4 text-[#ff5722]" />
                        <span>Add New Menu Dish</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-3.5">
                        Add a new recipe or special dish to {activeRestaurant.name}'s menu catalog:
                      </p>

                      <form onSubmit={handleAddDish} className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Dish Name
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Cheese Butter Masala"
                            value={newDishName}
                            onChange={(e) => setNewDishName(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:border-[#ff5722]"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Category
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Main Course"
                              value={newDishCat}
                              onChange={(e) => setNewDishCat(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:border-[#ff5722]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Price (₹)
                            </label>
                            <input
                              type="number"
                              required
                              placeholder="₹ Rate"
                              value={newDishPrice}
                              onChange={(e) => setNewDishPrice(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:border-[#ff5722]"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full py-2.5 rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#f73819] text-white font-black text-xs sm:text-sm shadow-sm hover:opacity-95 transition cursor-pointer"
                        >
                          + Save Dish to Menu Catalog
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= SUBTAB 3: TABLES MANAGEMENT ================= */}
            {managerSubTab === 'TABLES' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Left Column: Configured Tables list */}
                <div className="md:col-span-7 space-y-4">
                  <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                      <div>
                        <h3 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2">
                          <LayoutGrid className="w-4 h-4 text-[#ff5722]" />
                          <span>Restaurant Dining Tables Setup</span>
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          Tables configured for {activeRestaurant.name}.
                        </p>
                      </div>
                      <span className="text-xs font-black bg-orange-50 text-[#ff5722] px-3 py-1 rounded-full border border-orange-200">
                        {currentRestaurantTables.length} Active Tables
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto pr-1">
                      {currentRestaurantTables.map((tbl) => {
                        const isRunning = activeKots.some((k) => k.table_name === tbl.name);
                        return (
                          <div
                            key={tbl.id}
                            className={`p-3 rounded-2xl border flex flex-col justify-between transition ${
                              isRunning
                                ? 'bg-amber-50/80 border-amber-300'
                                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1 mb-2">
                              <div>
                                <span className="font-extrabold text-sm text-slate-900 block truncate">
                                  {tbl.name}
                                </span>
                                <span className="text-[11px] text-slate-500 font-semibold block mt-0.5">
                                  👥 {tbl.capacity || 4} Seater
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteTable(tbl)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition cursor-pointer"
                                title="Delete table"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-md inline-block uppercase self-start ${
                                isRunning
                                  ? 'bg-amber-200 text-amber-900'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isRunning ? '🟠 Running Order' : '🟢 Free Table'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column: Add Table Form & Queue Status */}
                <div className="md:col-span-5 space-y-4">
                  {/* Add New Table Form Card */}
                  <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
                    <div className="font-black text-sm sm:text-base mb-2 flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-[#ff5722]" />
                      <span>🪑 Add New Dining Table</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-3.5">
                      Configure additional tables or VIP dining booths for this restaurant:
                    </p>

                    <form onSubmit={handleAddTable} className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Table Name / Number
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Table 7, VIP-1, Rooftop 2"
                          value={newTableName}
                          onChange={(e) => setNewTableName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:border-[#ff5722]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Guest Capacity (Pax)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="40"
                          placeholder="Capacity (e.g. 4 Pax)"
                          value={newTableCapacity}
                          onChange={(e) => setNewTableCapacity(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:border-[#ff5722]"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#f73819] text-white font-black text-xs sm:text-sm shadow-sm hover:opacity-95 transition cursor-pointer"
                      >
                        + Add Table to Restaurant
                      </button>
                    </form>
                  </div>

                  {/* Cloud / Local Storage Queue */}
                  <div className="bg-[#0f172a] text-white rounded-2xl p-4 border border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-black text-xs sm:text-sm text-amber-400 flex items-center gap-1.5">
                        <Cloud className="w-4 h-4" />
                        <span>POS Local & Cloud Queue</span>
                      </div>
                      <span
                        className={`text-[10px] font-mono ${
                          isOnline ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {isOnline ? 'ONLINE SYNC' : 'LOCAL CACHE'}
                      </span>
                    </div>

                    <div className="font-mono text-[11px] max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {kots.length === 0 ? (
                        <div className="text-slate-500 py-2">No tickets generated yet.</div>
                      ) : (
                        kots.map((k) => (
                          <div
                            key={k.id}
                            className="flex justify-between items-center py-1 border-b border-slate-800"
                          >
                            <span className="truncate max-w-[190px] text-slate-300">
                              [KOT #{k.token_no}] {k.table_name} ({k.status})
                            </span>
                            <span
                              className={`text-[10px] font-bold ${
                                isOnline ? 'text-emerald-400' : 'text-amber-400'
                              }`}
                            >
                              {isOnline ? '✔ CLOUD' : '💾 OFFLINE'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= 4. SUPER ADMIN WORKSPACE ================= */}
        {currentRole === 'ADMIN' && (
          <div className="space-y-6">
            {/* ADMIN SECTION 1: STAFF & CREDENTIALS MANAGEMENT */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-4 mb-5">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-[#ff5722]" />
                    <span>Staff Credentials Management</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Admin creates and authorizes credentials for Waiters, Kitchen chefs, and Managers. Works completely offline.
                  </p>
                </div>
                <span className="self-start sm:self-auto bg-orange-100 text-[#ff5722] text-xs font-black px-3 py-1 rounded-full">
                  Total Staff: {staff.length}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Form to create staff credentials */}
                <div className="lg:col-span-5 bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200">
                  <h3 className="font-extrabold text-sm text-slate-800 mb-3 flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-[#ff5722]" />
                    <span>Create New Staff Credential</span>
                  </h3>

                  <form onSubmit={handleCreateStaff} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Staff Full Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rahul Sharma"
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:border-[#ff5722]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Role
                        </label>
                        <select
                          value={newStaffRole}
                          onChange={(e) => setNewStaffRole(e.target.value as UserRole)}
                          className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold outline-none focus:border-[#ff5722]"
                        >
                          <option value="WAITER">👨‍🍳 Waiter</option>
                          <option value="KITCHEN">🔥 Kitchen</option>
                          <option value="MANAGER">🧾 Manager</option>
                          <option value="ADMIN">🛡️ Admin</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Restaurant
                        </label>
                        <select
                          value={newStaffRestId}
                          onChange={(e) => setNewStaffRestId(e.target.value)}
                          className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold outline-none focus:border-[#ff5722]"
                        >
                          {restaurants.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Username / ID
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. rahul101"
                          value={newStaffUsername}
                          onChange={(e) => setNewStaffUsername(e.target.value)}
                          className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:border-[#ff5722]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Password / PIN
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 1234"
                          value={newStaffPin}
                          onChange={(e) => setNewStaffPin(e.target.value)}
                          className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:border-[#ff5722]"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#ff6b35] to-[#f73819] text-white font-black text-xs sm:text-sm shadow-md shadow-orange-500/20 hover:opacity-95 transition cursor-pointer"
                    >
                      + Authorize Staff Credentials
                    </button>
                  </form>
                </div>

                {/* List of existing staff credentials */}
                <div className="lg:col-span-7">
                  <h3 className="font-extrabold text-sm text-slate-800 mb-3">
                    Active Staff Credentials ({staff.length})
                  </h3>

                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                    {staff.map((s) => {
                      const restObj = restaurants.find((r) => r.id === s.restaurant_id);
                      const restName = s.restaurant_id === 'all' ? 'All Restaurants (Super)' : restObj?.name || s.restaurant_id;

                      return (
                        <div
                          key={s.id}
                          className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition flex items-center justify-between gap-3 shadow-sm"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-sm text-slate-900 truncate">{s.name}</span>
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase ${
                                  s.role === 'ADMIN'
                                    ? 'bg-purple-100 text-purple-700'
                                    : s.role === 'MANAGER'
                                    ? 'bg-blue-100 text-blue-700'
                                    : s.role === 'KITCHEN'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {s.role}
                              </span>
                              {!s.is_active && (
                                <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">
                                  Disabled
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 font-medium mt-1 flex flex-wrap gap-x-3">
                              <span>Username: <b className="text-slate-800">{s.username}</b></span>
                              <span>PIN/Pass: <b className="text-slate-800">{s.pinOrPass}</b></span>
                              <span className="text-slate-400">({restName})</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => toggleStaffStatus(s.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                s.is_active
                                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              }`}
                            >
                              {s.is_active ? 'Disable' : 'Enable'}
                            </button>
                            {s.id !== currentUser.id && (
                              <button
                                onClick={() => handleDeleteStaff(s.id)}
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition cursor-pointer"
                                title="Delete staff"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* ADMIN SECTION 2: RESTAURANT ONBOARDING & TENANTS */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-6 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
                <div className="font-black text-sm sm:text-base mb-3 flex items-center gap-2">
                  <Store className="w-4 h-4 text-[#ff5722]" />
                  <span>🛡️ Onboard New Restaurant Tenant</span>
                </div>

                <form onSubmit={handleCreateRestaurant} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Restaurant Name (e.g. Royal Rajputana)"
                    value={adminRestName}
                    onChange={(e) => setAdminRestName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:border-[#ff5722]"
                  />
                  <input
                    type="text"
                    placeholder="City / Location (e.g. Akola Central)"
                    value={adminRestCity}
                    onChange={(e) => setAdminRestCity(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:border-[#ff5722]"
                  />
                  <input
                    type="number"
                    placeholder="Total Tables"
                    value={adminRestTables}
                    onChange={(e) => setAdminRestTables(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:border-[#ff5722]"
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#f73819] text-white font-black text-xs sm:text-sm shadow-sm hover:opacity-95 transition cursor-pointer"
                  >
                    ➕ Create Restaurant Tenant
                  </button>
                  <button
                    type="button"
                    onClick={resetAllData}
                    className="w-full py-2 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>🔄 Reset Demo Database & Seed Accounts</span>
                  </button>
                </form>
              </div>

              <div className="md:col-span-6 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
                <div className="font-black text-sm sm:text-base mb-3 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-slate-700" />
                  <span>🏢 Registered Restaurant Tenants</span>
                </div>

                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {restaurants.map((r) => (
                    <div
                      key={r.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between"
                    >
                      <div>
                        <strong className="text-sm font-black text-slate-800">{r.name}</strong>
                        <div className="text-xs text-slate-500 font-medium mt-0.5">
                          {r.city} • {r.tablesCount} Tables
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setActiveRestaurantId(r.id);
                          setCurrentRole('WAITER');
                          showToast(`Switched to ${r.name}`);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#0f172a] hover:bg-slate-800 text-white font-extrabold text-xs transition cursor-pointer"
                      >
                        Open POS
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {/* ================= 5. THERMAL BILL & RECEIPT PRINT MODAL (Version 3.0) ================= */}
        {activeBillPrint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 overflow-y-auto">
            <div className="w-full max-w-sm rounded-3xl bg-white p-4 sm:p-6 shadow-2xl text-slate-900 border border-slate-200 relative my-auto animate-scale-in">
              {/* Modal Top Bar (Hidden on print) */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 no-print">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#ff5722] flex items-center justify-center font-black">
                    <Printer className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900">Thermal Receipt Preview</h3>
                    <p className="text-[11px] text-slate-500 font-semibold">Standard 80mm / 3-inch slip</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveBillPrint(null)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Thermal Receipt Paper (Prints cleanly via @media print) */}
              <div
                id="printable-thermal-receipt"
                className="bg-white border-2 border-dashed border-slate-300 p-4 rounded-2xl font-mono text-slate-900 shadow-inner text-xs"
              >
                {/* Header */}
                <div className="text-center pb-2.5 border-b border-dashed border-slate-400">
                  <h2 className="font-black text-base sm:text-lg tracking-wide uppercase leading-tight">
                    {activeBillPrint.restaurantName}
                  </h2>
                  <p className="text-xs text-slate-600 font-medium">{activeBillPrint.restaurantCity}</p>
                  <p className="text-[9px] text-slate-500 font-bold mt-0.5">
                    FSSAI: 11524029000184 • GSTIN: 27AABCP1330K1Z9
                  </p>
                  <div className="inline-block mt-1 px-2.5 py-0.5 bg-slate-100 rounded text-[10px] font-black uppercase tracking-wider">
                    {activeBillPrint.title}
                  </div>
                </div>

                {/* Metadata */}
                <div className="py-2 border-b border-dashed border-slate-400 text-[11px] space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Bill No:</span>
                    <span className="font-bold">{activeBillPrint.billNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Table:</span>
                    <span className="font-black text-slate-900">{activeBillPrint.tableName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Server:</span>
                    <span>{activeBillPrint.waiterName || 'Counter Staff'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Date/Time:</span>
                    <span>{activeBillPrint.dateTime}</span>
                  </div>
                </div>

                {/* Itemized Table */}
                <div className="py-2 border-b border-dashed border-slate-400">
                  <div className="flex justify-between font-black text-[10px] uppercase text-slate-600 pb-1 mb-1 border-b border-slate-200">
                    <span className="w-6/12">Item</span>
                    <span className="w-2/12 text-center">Qty</span>
                    <span className="w-2/12 text-right">Rate</span>
                    <span className="w-2/12 text-right">Total</span>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    {activeBillPrint.items.map((i, idx) => (
                      <div key={idx} className="flex justify-between items-start">
                        <span className="w-6/12 font-bold truncate pr-1">{i.name}</span>
                        <span className="w-2/12 text-center">{i.qty}</span>
                        <span className="w-2/12 text-right">₹{i.price}</span>
                        <span className="w-2/12 text-right font-bold">₹{i.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Calculations & GST */}
                <div className="py-2 border-b border-dashed border-slate-400 text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Sub Total:</span>
                    <span className="font-bold">₹{activeBillPrint.subtotal}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>CGST (2.5%):</span>
                    <span>₹{(activeBillPrint.gstAmount / 2).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>SGST (2.5%):</span>
                    <span>₹{(activeBillPrint.gstAmount / 2).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700 font-semibold">
                    <span>Total GST (5%):</span>
                    <span>₹{activeBillPrint.gstAmount}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-black text-slate-900 pt-1.5 border-t border-slate-300">
                    <span>GRAND TOTAL:</span>
                    <span className="text-base sm:text-lg text-[#ff5722]">₹{activeBillPrint.grandTotal}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-600 pt-0.5">
                    <span>Payment Mode:</span>
                    <span className={activeBillPrint.isSettled ? 'text-emerald-700 font-black' : 'text-amber-700 font-black'}>
                      {activeBillPrint.isSettled ? `PAID (${activeBillPrint.paymentMode})` : 'UNBILLED / RUNNING'}
                    </span>
                  </div>
                </div>

                {/* Footer Message */}
                <div className="text-center pt-2.5 text-[10px] text-slate-600 leading-tight">
                  <p className="font-bold">Thank you for dining with us! 🙏</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">Please visit again • Have a great day</p>
                  <div className="mt-2 text-[8px] font-mono text-slate-400 tracking-widest uppercase">
                    *** Powered by POSHub Pro v3.0 ***
                  </div>
                </div>
              </div>

              {/* Action Buttons (Hidden on print) */}
              <div className="mt-4 space-y-2 no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#ff6b35] to-[#f73819] text-white font-black text-xs sm:text-sm shadow-md shadow-orange-500/30 hover:opacity-95 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Thermal Bill (Thermal / A4)</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyBillReceipt(activeBillPrint)}
                    className="py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-600" />
                    <span>Copy Text</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveBillPrint(null)}
                    className="py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition cursor-pointer"
                  >
                    Close Preview
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

