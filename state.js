// =====================================================================
// === STATE, CONSTANTS AND HELPER FUNCTIONS ===========================
// =====================================================================

// Key used to store data in localStorage
const STORAGE_KEY = "habit-tracker-state-v1";

// Global list of date keys used when rendering the grid
export let weekKeys = buildWeek();

// === In-memory state initialisation ===
export let state = loadState();

// Creates a new habit object
export function newHabit(name) {
    return {
        id:
            typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : `habit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        log: {}
    };
}

// Convenience for streak computation, used in render
export function computeStreak(habit) {
    if (!habit || !habit.log)
        return 0;

    let streak = 0;
    const today = new Date();

    // Hard cap at 365 to avoid infinite loops
    for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = toKey(d);

        if (habit.log[key]) {
            streak++;
        } else {
            // First gap breaks the streak
            break;
        }
    }

    return streak;
}

// Make sure loaded/imported state always has a normalized shape
function normalizeState(source) {
    const raw = source && typeof source === "object" ? source : {};
    const habitsInput = Array.isArray(raw.habits) ? raw.habits : [];

    return {
        habits: habitsInput.map((h, index) => ({
            id:
                (h && h.id && String(h.id)) ||
                (typeof crypto !== "undefined" && crypto.randomUUID
                    ? crypto.randomUUID()
                    : `habit-${Date.now()}-${index}`),
            name: (h && typeof h.name === "string" && h.name.trim()) || "Untitled habit",
            log:
                (h && h.log && typeof h.log === "object" && !Array.isArray(h.log)
                ? { ...h.log }
                : {})
        }))
    };
}

// Reads state from localStorage or returns empty default
function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return {
                habits: []
            };

        const parsed = JSON.parse(raw);

        return normalizeState(parsed);
    } catch (err) {
        console.warn("Failed to load state, starting fresh.", err);

        return {
            habits: []
        };
    }
}

// Persists to localStorage and keeps in-memory copy in sync
export function saveState(nextState) {
    state = normalizeState(nextState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Converts a Date object into YYYY-MM-DD using local time
export function toKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");

    return `${y}-${m}-${d}`;
}

// Get today's date key
export function todayKey() {
    return toKey(new Date());
}

// Refresh week keys
export function refreshWeekKeys() {
    weekKeys = buildWeek();
}

// Format a date as "4 Nov" in the current locale
export function formatShortDate(date) {
    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short"
    });
}

// Returns the last 7 days as date keys, from oldest to newest
function buildWeek() {
    const today = new Date();
    const keys = [];

    for (let offset = 6; offset >= 0; offset--) {
        const d = new Date(today);
        d.setDate(today.getDate() - offset);

        keys.push(toKey(d));
    }

    return keys;
}
