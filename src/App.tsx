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
  Database
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

export type UserRole = 'ADMIN' | 'MANAGER' | 'WAITER' | 'KITCHEN';

export interface StaffUser {
  id: string;
  name: string;
  username: string;
  pinOrPass: string;
  role: UserRole;
  restaurant_id: string; // 'all' or specific restaurant ID
  is_active: boolean;
}

interface Restaurant {
  id: string;
  name: string;
  city: string;
  tablesCount: number;
  is_synced: boolean;
}

interface MenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  category: string;
  price: number;
  is_synced: boolean;
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
  { id: 'rest_1', name: 'Swad Family Restaurant', city: 'Akola Main', tablesCount: 6, is_synced: true },
  { id: 'rest_2', name: 'Spice Garden Dhaba', city: 'Highway', tablesCount: 6, is_synced: true }
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
  // Database State connected with Firestore + local fallback
  const [restaurants, setRestaurants] = useState<Restaurant[]>(INITIAL_RESTAURANTS);
  const [menus, setMenus] = useState<MenuItem[]>(INITIAL_MENUS);
  const [kots, setKots] = useState<KOT[]>([]);
  const [completedOrders, setCompletedOrders] = useState<CompletedOrder[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>(INITIAL_STAFF);
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(false);

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
  const [selectedTable, setSelectedTable] = useState<string>('Table 1');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [cart, setCart] = useState<{ [menuId: string]: number }>({});
  const [chefNote, setChefNote] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toasts, setToasts] = useState<{ id: string; msg: string }[]>([]);

  // Manager inputs
  const [newDishName, setNewDishName] = useState('');
  const [newDishCat, setNewDishCat] = useState('');
  const [newDishPrice, setNewDishPrice] = useState('');

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

  // Test Firestore connection on mount & register real-time listeners
  useEffect(() => {
    testFirestoreConnection().then((connected) => {
      setFirebaseConnected(connected);
      if (connected) {
        showToast('🔥 Connected to Firebase Firestore!');
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
        } else {
          // Seed initial restaurants to Firestore
          INITIAL_RESTAURANTS.forEach((r) => {
            setDoc(doc(db, 'restaurants', r.id), r).catch((err) =>
              handleFirestoreError(err, OperationType.WRITE, 'restaurants')
            );
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
        } else {
          // Seed initial menus
          INITIAL_MENUS.forEach((m) => {
            setDoc(doc(db, 'menus', m.id), m).catch((err) =>
              handleFirestoreError(err, OperationType.WRITE, 'menus')
            );
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'menus');
      }
    );

    // 3. Listen to KOTs (Real-time orders between Waiter & Kitchen)
    const unsubKots = onSnapshot(
      collection(db, 'kots'),
      (snapshot) => {
        const list: KOT[] = [];
        snapshot.forEach((d) => list.push(d.data() as KOT));
        // Sort newest first
        list.sort((a, b) => (b.token_no || 0) - (a.token_no || 0));
        setKots(list);
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
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'completed_orders');
      }
    );

    // 5. Listen to Staff credentials (created by Admin)
    const unsubStaff = onSnapshot(
      collection(db, 'staff'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: StaffUser[] = [];
          snapshot.forEach((d) => list.push(d.data() as StaffUser));
          setStaff(list);
        } else {
          // Seed initial admin, manager, waiter, and kitchen credentials
          INITIAL_STAFF.forEach((s) => {
            setDoc(doc(db, 'staff', s.id), s).catch((err) =>
              handleFirestoreError(err, OperationType.WRITE, 'staff')
            );
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

  const activeKots = useMemo(() => {
    return kots.filter((k) => k.restaurant_id === activeRestaurantId && k.status !== 'BILLED');
  }, [kots, activeRestaurantId]);

  const kitchenPendingKots = useMemo(() => {
    return activeKots.filter((k) => !['SERVED', 'BILLED'].includes(k.status));
  }, [activeKots]);

  const unsyncedCount = useMemo(() => {
    return kots.filter((k) => !k.is_synced).length + completedOrders.filter((o) => !o.is_synced).length;
  }, [kots, completedOrders]);

  // Cart operations
  const updateCart = (menuId: string, delta: number) => {
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

  // Confirm KOT -> write to Firestore
  const confirmKOT = async () => {
    if (!cartKeys.length) return;
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
      table_name: selectedTable,
      status: 'CREATED',
      note: chefNote.trim(),
      items,
      created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      is_synced: true,
      waiter_name: currentUser?.name || 'Staff'
    };

    try {
      await setDoc(doc(db, 'kots', kotId), newKot);
      if (lanChannelRef.current) lanChannelRef.current.postMessage({ type: 'SYNC' });
      setCart({});
      setChefNote('');
      playAudioBeep(540);
      showToast(`🚀 KOT #${tokenNo} synced to Firestore & Kitchen!`);
      setWaiterSubTab('KOT');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'kots');
      showToast('Error syncing KOT to Firebase');
    }
  };

  // Change KOT Status -> update in Firestore
  const changeKotStatus = async (kotId: string, newStatus: KotStatus) => {
    const target = kots.find((k) => k.id === kotId);
    if (!target) return;
    const updated: KOT = { ...target, status: newStatus, is_synced: true };

    try {
      await setDoc(doc(db, 'kots', kotId), updated);
      playAudioBeep(880);
      showToast(`🔥 KOT #${target.token_no} ➔ ${newStatus.replace('_', ' ')}`);
      if (lanChannelRef.current) lanChannelRef.current.postMessage({ type: 'SYNC' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `kots/${kotId}`);
    }
  };

  // Settle Table Bill -> update KOTs & write completed_order to Firestore
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
      is_synced: true,
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    try {
      // 1. Mark kots as billed
      for (const k of tableKots) {
        await setDoc(doc(db, 'kots', k.id), { ...k, status: 'BILLED' });
      }
      // 2. Add completed order
      await setDoc(doc(db, 'completed_orders', orderId), newCompleted);
      showToast(`✅ ${tableName} Bill Paid (₹${grandTotal}) via ${mode}`);
      if (lanChannelRef.current) lanChannelRef.current.postMessage({ type: 'SYNC' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'completed_orders');
    }
  };

  // Manager: Add dish to menu in Firestore
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
      is_synced: true
    };

    try {
      await setDoc(doc(db, 'menus', dishId), newItem);
      setNewDishName('');
      setNewDishCat('');
      setNewDishPrice('');
      showToast('🍲 Dish added to Firebase menu!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'menus');
    }
  };

  // Admin: Create restaurant in Firestore
  const handleCreateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminRestName.trim()) return;
    const newRestId = generateUUID();
    const count = parseInt(adminRestTables, 10) || 6;

    const newRest: Restaurant = {
      id: newRestId,
      name: adminRestName.trim(),
      city: adminRestCity.trim() || 'Main City',
      tablesCount: count,
      is_synced: true
    };

    const dishId = generateUUID();
    const seedDish: MenuItem = {
      id: dishId,
      restaurant_id: newRestId,
      name: 'Special Veg Thali',
      category: 'Main Course',
      price: 180,
      is_synced: true
    };

    try {
      await setDoc(doc(db, 'restaurants', newRestId), newRest);
      await setDoc(doc(db, 'menus', dishId), seedDish);
      setActiveRestaurantId(newRestId);
      setAdminRestName('');
      setAdminRestCity('');
      showToast('🏢 New Restaurant Tenant saved to Firebase!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'restaurants');
    }
  };

  // Admin: Create Staff Credential in Firestore
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

    try {
      await setDoc(doc(db, 'staff', staffId), newStaff);
      setNewStaffName('');
      setNewStaffUsername('');
      setNewStaffPin('');
      showToast(`👤 Created ${newStaffRole} credentials in Firebase for ${newStaff.name}`);
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
      try {
        await deleteDoc(doc(db, 'staff', staffId));
        showToast('Staff credential deleted from Firebase');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `staff/${staffId}`);
      }
    }
  };

  const toggleStaffStatus = async (staffId: string) => {
    const s = staff.find((item) => item.id === staffId);
    if (!s) return;
    try {
      await setDoc(doc(db, 'staff', staffId), { ...s, is_active: !s.is_active });
      showToast('Staff status updated in Firebase');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `staff/${staffId}`);
    }
  };

  const resetAllData = async () => {
    if (window.confirm('Reset all demo data in Firebase to defaults?')) {
      // Re-seed staff
      for (const s of INITIAL_STAFF) {
        await setDoc(doc(db, 'staff', s.id), s);
      }
      for (const r of INITIAL_RESTAURANTS) {
        await setDoc(doc(db, 'restaurants', r.id), r);
      }
      for (const m of INITIAL_MENUS) {
        await setDoc(doc(db, 'menus', m.id), m);
      }
      // Clear kots
      for (const k of kots) {
        await deleteDoc(doc(db, 'kots', k.id));
      }
      setCart({});
      setSelectedTable('Table 1');
      setSelectedCategory('All');
      showToast('🔄 Firebase Database Reset to default seeds!');
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

  // Group manager active bills by table
  const managerTableGroups = useMemo(() => {
    const grouped: { [tName: string]: KOT[] } = {};
    activeKots.forEach((k) => {
      if (!grouped[k.table_name]) grouped[k.table_name] = [];
      grouped[k.table_name].push(k);
    });
    return grouped;
  }, [activeKots]);

  // =========================================================================
  // VIEW 1: LOGIN PAGE (Active when not authenticated)
  // =========================================================================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans">
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
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff6b35] to-[#f73819] flex items-center justify-center font-black text-3xl mx-auto shadow-lg shadow-orange-500/30 mb-4 border border-orange-400/30">
              P
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
              <span>POSHub Pro</span>
              <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <Database className="w-3 h-3" />
                <span>Firestore</span>
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">
              Multi-Restaurant KOT, Kitchen & Billing with Real-Time Firebase
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
                  Credentials managed securely by Admin in Firestore
                </p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/30 px-2 py-1 rounded-full">
                {firebaseConnected ? '🟢 Cloud Ready' : '🟡 Initializing'}
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
                <span>Quick Test (Firebase Authorized Accounts)</span>
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

          <div className="text-center mt-6 text-xs text-slate-500">
            Powered by Firebase Firestore database & cloud sync.
          </div>
        </div>

        <footer className="text-center text-[11px] text-slate-500 py-2">
          POSHub Pro • Real-Time Multi-Tenant POS with Google Firebase
        </footer>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: AUTHENTICATED POS APPLICATION
  // =========================================================================
  const isAdmin = currentUser.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-[#f4f6fb] text-[#0f172a] pb-36 font-sans">
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
                <span className="text-[8px] bg-emerald-500/20 text-emerald-300 px-1 rounded font-mono">
                  FIRESTORE
                </span>
              </div>
              {/* Only Admin or multi-outlet manager can switch restaurant freely */}
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
            {/* User Profile Badge */}
            <div className="hidden md:flex items-center gap-2 bg-[#1e293b] border border-slate-700 px-3 py-1 rounded-full text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-bold text-slate-200">{currentUser.name}</span>
              <span className="bg-[#ff5722] text-white text-[10px] font-black px-1.5 py-0.2 rounded-md uppercase">
                {currentUser.role}
              </span>
            </div>

            {/* Cloud Firestore indicator */}
            <div
              className="bg-[#1e293b] border border-slate-700 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 text-emerald-400"
              title="Real-Time Firebase Firestore Connected"
            >
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline font-mono text-[11px]">Synced</span>
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

      {/* ================= TOAST ALERTS ================= */}
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

      {/* Role Notice Banner */}
      <div className="bg-slate-100 border-b border-slate-200 px-4 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Logged in as:</span>
            <span className="font-extrabold text-slate-900">{currentUser.name}</span>
            <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold text-[10px] uppercase">
              Role: {currentUser.role}
            </span>
          </div>
          {isAdmin && (
            <span className="text-[11px] font-bold text-[#ff5722] hidden sm:inline">
              🛡️ Super Admin Control: Manage Staff, Kitchen Tickets, Billing & Outlets in Firebase
            </span>
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
                {/* Step 1: Select Table */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-orange-50 text-[#ff5722] flex items-center justify-center text-xs font-black">
                        1
                      </span>
                      <span>Select Table</span>
                    </div>
                    <div className="text-[11px] font-bold text-slate-500">
                      🟢 Free &nbsp; 🟠 Running
                    </div>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                    {Array.from({ length: activeRestaurant.tablesCount || 6 }).map((_, i) => {
                      const tName = `Table ${i + 1}`;
                      const isOccupied = activeKots.some((k) => k.table_name === tName);
                      const isSelected = selectedTable === tName;

                      return (
                        <button
                          key={tName}
                          onClick={() => setSelectedTable(tName)}
                          className={`p-2.5 rounded-xl border-2 text-left transition relative cursor-pointer ${
                            isSelected
                              ? 'bg-orange-50 border-[#ff5722] shadow-md shadow-orange-500/20 -translate-y-0.5'
                              : isOccupied
                              ? 'bg-amber-50 border-amber-300'
                              : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <span className="block font-black text-xs sm:text-sm text-slate-900">{tName}</span>
                          <span
                            className={`text-[10px] font-extrabold inline-block mt-1 ${
                              isOccupied ? 'text-amber-600' : 'text-emerald-600'
                            }`}
                          >
                            {isOccupied ? '🟠 Running' : '🟢 Vacant'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2: Select Menu Items */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-orange-50 text-[#ff5722] flex items-center justify-center text-xs font-black">
                        2
                      </span>
                      <span>Select Menu</span>
                      <span className="text-[#ff5722] font-black text-xs sm:text-sm">({selectedTable})</span>
                    </div>
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
                      placeholder="Search Paneer, Roti, Biryani..."
                      className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:border-[#ff5722] focus:bg-white transition"
                    />
                  </div>

                  {/* Menu items grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {filteredMenus.map((item) => {
                      const qty = cart[item.id] || 0;
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between p-3 rounded-xl border-1.5 transition ${
                            qty > 0
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
                            <div className="text-xs font-extrabold text-slate-500 mt-0.5">₹{item.price}</div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
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
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
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
                      Firebase Realtime
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
                              🔥 Firestore • {k.created_at}
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
              <div className="fixed bottom-20 left-3 right-3 max-w-xl mx-auto bg-[#0f172a] text-white p-3 sm:p-4 rounded-2xl shadow-2xl border border-slate-700 z-40 animate-slide-up">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-extrabold text-sm sm:text-base text-white truncate">
                      {selectedTable} • {cartSummary.totalQty} Items | ₹{cartSummary.totalPrice}
                    </div>
                    <div className="text-xs text-slate-300 truncate max-w-xs">{cartSummary.previewText}</div>
                  </div>

                  <button
                    onClick={confirmKOT}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#f73819] text-white font-black text-xs sm:text-sm whitespace-nowrap shadow-md shadow-orange-500/40 hover:opacity-95 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Confirm KOT</span>
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
                Tap status buttons to progress orders: <b>Start ➔ Cooking ➔ Ready</b> (Updates live in Firestore)
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

        {/* ================= 3. MANAGER WORKSPACE ================= */}
        {currentRole === 'MANAGER' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Left Column: Running Bills & Settled Orders */}
            <div className="md:col-span-7 space-y-4">
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-black text-sm sm:text-base flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[#ff5722]" />
                    <span>🧾 Running Table Bills (5% GST Included)</span>
                  </div>
                </div>

                {Object.keys(managerTableGroups).length === 0 ? (
                  <div className="text-xs text-slate-400 py-6 text-center">
                    No active table bills pending settlement.
                  </div>
                ) : (
                  <div className="space-y-3">
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

                      return (
                        <div key={tName} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                          <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-2">
                            <span className="font-black text-base text-slate-900">{tName}</span>
                            <div className="text-right">
                              <span className="text-xs text-slate-500">Subtotal ₹{subtotal} + GST ₹{gst} = </span>
                              <span className="font-black text-base text-[#ff5722] ml-1">₹{grand}</span>
                            </div>
                          </div>

                          <div className="space-y-1 mb-3">
                            {rows.map((r, idx) => (
                              <div key={idx} className="flex justify-between text-xs text-slate-700">
                                <span>{r.name} × {r.qty}</span>
                                <span className="font-bold">₹{r.price}</span>
                              </div>
                            ))}
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                            <button
                              onClick={() => settleTableBill(tName, 'CASH')}
                              className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>💵 Cash Settle</span>
                            </button>
                            <button
                              onClick={() => settleTableBill(tName, 'UPI')}
                              className="py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                              <span>📱 UPI Settle</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Today's Settled Bills */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <div className="font-black text-sm sm:text-base mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>✅ Today's Settled Bills (Stored in Firestore)</span>
                </div>

                {completedOrders.filter((o) => o.restaurant_id === activeRestaurantId).length === 0 ? (
                  <div className="text-xs text-slate-400 py-4 text-center">No completed bills yet today.</div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {completedOrders
                      .filter((o) => o.restaurant_id === activeRestaurantId)
                      .map((o) => (
                        <div
                          key={o.id}
                          className="flex justify-between items-center text-xs p-2 rounded-lg bg-slate-50 border border-slate-100"
                        >
                          <div>
                            <strong className="text-slate-800">{o.table_name}</strong>
                            <span className="text-slate-500 ml-1.5">({o.payment_mode})</span>
                            <div className="text-[11px] text-slate-400 truncate max-w-xs">{o.summary}</div>
                          </div>
                          <span className="font-black text-emerald-600 text-sm">₹{o.grand_total}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Add Menu Dish & Sync Log */}
            <div className="md:col-span-5 space-y-4">
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <div className="font-black text-sm sm:text-base mb-3 flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-[#ff5722]" />
                  <span>🍲 Add New Menu Dish</span>
                </div>

                <form onSubmit={handleAddDish} className="space-y-2.5">
                  <input
                    type="text"
                    placeholder="Dish Name (e.g. Cheese Butter Masala)"
                    value={newDishName}
                    onChange={(e) => setNewDishName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:border-[#ff5722]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Category (Main / Bread)"
                      value={newDishCat}
                      onChange={(e) => setNewDishCat(e.target.value)}
                      className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:border-[#ff5722]"
                    />
                    <input
                      type="number"
                      placeholder="Price (₹)"
                      value={newDishPrice}
                      onChange={(e) => setNewDishPrice(e.target.value)}
                      className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:border-[#ff5722]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#f73819] text-white font-black text-xs sm:text-sm shadow-sm hover:opacity-95 transition cursor-pointer"
                  >
                    + Save Dish to Firestore
                  </button>
                </form>
              </div>

              {/* Firestore Real-Time Activity Log */}
              <div className="bg-[#0f172a] text-white rounded-2xl p-4 border border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-black text-xs sm:text-sm text-amber-400 flex items-center gap-1.5">
                    <Cloud className="w-4 h-4" />
                    <span>🔥 Firestore Realtime Sync Stream</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono">LIVE ON-SNAPSHOT</span>
                </div>

                <div className="font-mono text-[11px] max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {kots.length === 0 ? (
                    <div className="text-slate-500 py-2">No tickets generated yet.</div>
                  ) : (
                    kots.map((k) => (
                      <div key={k.id} className="flex justify-between items-center py-1 border-b border-slate-800">
                        <span className="truncate max-w-[190px] text-slate-300">
                          [KOT #{k.token_no}] {k.table_name} ({k.status})
                        </span>
                        <span className="text-[10px] font-bold text-emerald-400">
                          ✔ FIRESTORE
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
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
                    Admin creates and authorizes credentials for Waiters, Kitchen chefs, and Managers in Firebase Firestore.
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
                      + Authorize & Save to Firestore
                    </button>
                  </form>
                </div>

                {/* List of existing staff credentials */}
                <div className="lg:col-span-7">
                  <h3 className="font-extrabold text-sm text-slate-800 mb-3">
                    Active Staff Credentials in Firestore ({staff.length})
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
                    ➕ Create Restaurant in Firestore
                  </button>
                  <button
                    type="button"
                    onClick={resetAllData}
                    className="w-full py-2 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>🔄 Reset Firestore Database & Initial Accounts</span>
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
      </main>

      {/* ================= BOTTOM NAVIGATION DOCK ================= */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 grid grid-cols-4 px-2 py-2 z-50 shadow-2xl">
        <button
          onClick={() => {
            if (isAdmin || currentUser.role === 'WAITER') {
              setCurrentRole('WAITER');
            } else {
              showToast('Only Waiter or Admin has access to order punch');
            }
          }}
          className={`flex flex-col items-center justify-center py-1 rounded-xl text-xs font-black transition relative cursor-pointer ${
            currentRole === 'WAITER'
              ? 'text-[#ff5722] bg-orange-50'
              : !isAdmin && currentUser.role !== 'WAITER'
              ? 'text-slate-300 opacity-60'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <UtensilsCrossed className="w-5 h-5 mb-0.5" />
          <span>Waiter</span>
        </button>

        <button
          onClick={() => {
            if (isAdmin || currentUser.role === 'KITCHEN') {
              setCurrentRole('KITCHEN');
            } else {
              showToast('Only Kitchen Chef or Admin has access to KDS');
            }
          }}
          className={`flex flex-col items-center justify-center py-1 rounded-xl text-xs font-black transition relative cursor-pointer ${
            currentRole === 'KITCHEN'
              ? 'text-[#ff5722] bg-orange-50'
              : !isAdmin && currentUser.role !== 'KITCHEN'
              ? 'text-slate-300 opacity-60'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Flame className="w-5 h-5 mb-0.5" />
          <span>Kitchen</span>
          {kitchenPendingKots.length > 0 && (
            <span className="absolute top-1 right-[22%] bg-red-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
              {kitchenPendingKots.length}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            if (isAdmin || currentUser.role === 'MANAGER') {
              setCurrentRole('MANAGER');
            } else {
              showToast('Only Manager or Admin has access to billing & menu');
            }
          }}
          className={`flex flex-col items-center justify-center py-1 rounded-xl text-xs font-black transition relative cursor-pointer ${
            currentRole === 'MANAGER'
              ? 'text-[#ff5722] bg-orange-50'
              : !isAdmin && currentUser.role !== 'MANAGER'
              ? 'text-slate-300 opacity-60'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className="w-5 h-5 mb-0.5" />
          <span>Manager</span>
        </button>

        <button
          onClick={() => {
            if (isAdmin) {
              setCurrentRole('ADMIN');
            } else {
              showToast('Admin panel is restricted to Super Admin only');
            }
          }}
          className={`flex flex-col items-center justify-center py-1 rounded-xl text-xs font-black transition relative cursor-pointer ${
            currentRole === 'ADMIN'
              ? 'text-[#ff5722] bg-orange-50'
              : !isAdmin
              ? 'text-slate-300 opacity-60'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldAlert className="w-5 h-5 mb-0.5" />
          <span>Admin</span>
        </button>
      </nav>
    </div>
  );
}
