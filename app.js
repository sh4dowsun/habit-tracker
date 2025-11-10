// =====================================================================
// === 0. STATE, CONSTANTS & HELPERS ===================================
// =====================================================================

// === DOM references used throughout the app ===
const rows = document.getElementById("rows"); // Container for habit rows
const weekRangeEl = document.getElementById("week-range"); // "This week" date range text

// Key used to store data in localStorage
const STORAGE_KEY = "habit-tracker-state-v1";

// Make sure loaded/imported state always has a normal shape
function normalizeState(source) {
    const raw = source && typeof source === "object" ? source : {};
    const habitsInput = Array.isArray(raw.habits) ? raw.habits : [];

    return {
        habits: habitsInput.map((h, index) => ({
        // ID: always a string
        id:
            (h && h.id && String(h.id)) ||
            (typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : `habit-${Date.now()}-${index}`),

        // Name: trimmed string
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
        if (!raw) {
            // First visit: no saved data
            return { habits: [] };
        }

        const parsed = JSON.parse(raw);

        return normalizeState(parsed);
    } catch (err) {
        // If anything goes wrong (corrupt JSON, etc.), start fresh
        console.warn("Failed to load state, starting fresh.", err);

        return { habits: [] };
    }
}

// Persists to localStorage and keeps in-memory copy in sync
function saveState(nextState) {
    // Always go through normalize to avoid weird shapes sneaking in
    state = normalizeState(nextState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Format a date as "4 Nov" in the current locale
function formatShortDate(date) {
    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short"
    });
}

// Replace "D-6", "D-5", ... "Today" with actual dates
function updateDayHeaderLabels() {
    const today = new Date();

    document.querySelectorAll(".day-header").forEach(cell => {
        const offset = Number(cell.dataset.offset) || 0;

        // Copy 'today' so we don't mutate it
        const d = new Date(today);
        // Example: if today is 10, offset -6 => 10 + (-6) = 4  (so 4 Nov)
        d.setDate(today.getDate() + offset);

        cell.textContent = formatShortDate(d);
    });
}

// Converts a Date object into "YYYY-MM-DD" using LOCAL time
function toKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");

    return `${y}-${m}-${d}`;
}

// Gets today's date key
function todayKey() {
    return toKey(new Date());
}

// Returns the last 7 days as date keys, oldest -> newest
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

// Global list of date keys used when rendering the grid
let weekKeys = buildWeek();

// Shows actual week days like "4 Nov – 10 Nov"
function updateWeekHeader() {
    if (!weekRangeEl)
        return;

    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 6);

    const fmt = (d) =>
        d.toLocaleDateString(undefined, { day: "numeric", month: "short" });

    const startStr = fmt(start);
    const endStr = fmt(today);

    // If it's somehow the same day (edge cases), just show one date
    weekRangeEl.textContent =
        startStr === endStr ? startStr : `${startStr} – ${endStr}`;
}

// Counts consecutive completed days backwards from today
function computeStreak(habit) {
    if (!habit || !habit.log) return 0;

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

// Creates a new habit object
function newHabit(name) {
    return {
        id:
            typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : `habit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name,
            log: {}
    };
}

// === In-memory state initialisation ===
// From now on, everything else (rendering, events, etc.) reads from this
let state = loadState();

// Initialise the "This week" label once on startup
updateWeekHeader();

// =====================================================================
// === 1. RENDER UI: Dynamic DOM Generation (State Reconciliation) ===
// This function completely rebuilds the habit tracker table in the browser
// It is called every time the data changes (add, toggle, delete, import, etc.)
// It uses the current 'state' object to generate fresh HTML: no templates!
// =====================================================================
// render(): The master function that draws the entire UI from scratch
function render() {
    // rows: reference to the container where habit rows are inserted
    // innerHTML = "" clears all existing content to start fresh
    rows.innerHTML = ""; 

    // =================================================================
    // === EMPTY STATE: Show placeholder when no habits exist ===
    // =================================================================
    // Check if the habits array is empty using .length
    // '=== 0' means strictly equal to zero: no habits added yet
    if (state.habits.length === 0) {
        // Create a single placeholder row using the same grid layout as real rows
        // This ensures visual consistency even when empty
        const row = document.createElement("div");
        row.setAttribute("style", "display:grid;grid-template-columns:1.6fr repeat(7,.9fr) .8fr 1fr;align-items:center;border-bottom:1px solid #eef2f6;");

        // === COLUMN 1: Name - Friendly message ===
        const nameCol = document.createElement("div");
        nameCol.setAttribute("style", "padding:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;");
        nameCol.textContent = "No habits yet";
        row.appendChild(nameCol);

        // === COLUMNS 2-8: Empty day cells for alignment ===
        // weekKeys.forEach runs the arrow function once for each date key
        // We create empty columns to maintain the grid structure
        weekKeys.forEach(() => {
            const col = document.createElement("div");
            col.setAttribute("style", "padding:10px;text-align:center;");
            row.appendChild(col);
        });

        // === COLUMN 9: Streak - Show 0 ===
        const streakCol = document.createElement("div");
        streakCol.setAttribute("style", "padding:10px;font-variant-numeric:tabular-nums;");
        streakCol.textContent = "0";
        row.appendChild(streakCol);

        // === COLUMN 10: Actions - Gentle reminder ===
        const actionsCol = document.createElement("div");
        actionsCol.setAttribute("style", "padding:10px;color:#66788a;");
        actionsCol.textContent = "Add a habit";
        row.appendChild(actionsCol);

        // Append the placeholder row to the main container
        // return; exits the function early: no need to process real habits
        rows.appendChild(row);
        return;
    }

// =================================================================
// === POPULATED STATE: Build one row per habit ===
// =================================================================
// Loop through every habit in state.habits using .forEach
// 'h' is the current habit object in each iteration
    state.habits.forEach(h => {
        // Create a new grid row for this habit
        // Same grid structure as header and placeholder
        const row = document.createElement("div");
        row.setAttribute("style", "display:grid;grid-template-columns:1.6fr repeat(7,.9fr) .8fr 1fr;align-items:center;border-bottom:1px solid #eef2f6;");

        // === COLUMN 1: Habit Name ===
        // Displays the habit name, truncated with ellipsis if too long
        const nameCol = document.createElement("div");
        nameCol.setAttribute("style", "padding:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;");
        nameCol.textContent = h.name;
        row.appendChild(nameCol);

        // === COLUMNS 2-8: Last 7 Days (D-6 to Today) ===
        // Loop through each of the 7 date keys in weekKeys
        weekKeys.forEach(k => {
            // Each day gets its own grid cell
            const col = document.createElement("div");
            col.setAttribute("style", "padding:10px;text-align:center;");

            // === Interactive button acting as a checkbox ===
            const btn = document.createElement("button");
            btn.type = "button";
            // aria-label: screen readers announce "Drink water on 2025-10-22"
            btn.setAttribute("aria-label", `${h.name} on ${k}`); 
            // role="checkbox": tells assistive tech it's a toggle
            btn.setAttribute("role", "checkbox"); 

            // Check if this date is marked as completed in the habit's log
            // h.log is an object: { "2025-10-22": true }
            // !! converts truthy/falsy to boolean
            const checked = !!h.log[k];
            // aria-checked: "true" or "false" for accessibility
            btn.setAttribute("aria-checked", String(checked)); 
            // Visual tick: "Yes" if checked, empty if not
            btn.textContent = checked ? "Yes" : ""; 

            // Store data attributes so event handlers know which habit/day was clicked
            // dataset is a DOMStringMap: btn.dataset.habitId = "abc123"
            btn.dataset.habitId = h.id;
            btn.dataset.dateKey = k;

            // === Conditional styling: green background if checked ===
            // Uses ternary operator: condition ? valueIfTrue : valueIfFalse
            // String concatenation builds the full style string
            btn.setAttribute(
                "style",
                "display:flex;align-items:center;justify-content:center;width:36px;height:36px;margin:auto;border-radius:8px;border:1px solid #dbe7f0;cursor:pointer;user-select:none;background:"+(checked?"#e9f8ef":"#fff")+";color:"+(checked?"#1e9e4a":"inherit")+";font-weight:"+(checked?"700":"400")+";"
            );

            // === Click handler: toggle the day ===
            btn.addEventListener("click", onToggleDay);

            // === Keyboard support: Space or Enter acts like click ===
            // e.preventDefault() stops page scroll when pressing Space
            btn.addEventListener("keydown", e => {
                if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    btn.click();
                }
            });

            // Add button to column, column to row
            col.appendChild(btn);
            row.appendChild(col);
        });

        // === COLUMN 9: Current Streak Count ===
        // computeStreak() counts consecutive completed days up to today
        // Returns a number (e.g., 5)
        const streakCol = document.createElement("div");
        streakCol.setAttribute("style", "padding:10px;font-variant-numeric:tabular-nums;");
        // String() converts number to text
        streakCol.textContent = String(computeStreak(h));
        row.appendChild(streakCol);

        // === COLUMN 10: Action Buttons (Tick Today, Delete) ===
        const actions = document.createElement("div");
        actions.setAttribute("style", "padding:10px;display:flex;gap:8px;flex-wrap:wrap;");

        // === Tick Today: quickly mark today's date ===
        const tick = document.createElement("button");
        tick.type = "button";
        tick.textContent = "Tick today";
        tick.setAttribute("style", "background:#fff;border:1px solid #dbe7f0;color:#0b3b58;padding:6px 10px;border-radius:8px;cursor:pointer;");
        // todayKey() returns current date as string (e.g., "2025-10-28")
        tick.addEventListener("click", () => toggleLog(h.id, todayKey()));

        // === Delete: remove habit permanently after confirmation ===
        const del = document.createElement("button");
        del.type = "button";
        del.textContent = "Delete";
        del.setAttribute("style", "background:#fff;border:1px solid #f2c9cd;color:#c71f23;padding:6px 10px;border-radius:8px;cursor:pointer;");
        del.addEventListener("click", () => {
            // confirm() shows native browser dialog with OK/Cancel
            if (confirm(`Delete habit "${h.name}"?`)) {
                // .filter() creates new array without the deleted habit
                // x => x.id !== h.id keeps all habits except the one with matching ID
                state.habits = state.habits.filter(x => x.id !== h.id);
                saveState(state); // Persist updated state
                render(); // Re-render UI after deletion
            }
        });

        // Add buttons to actions container
        actions.appendChild(tick);
        actions.appendChild(del);
        // Add actions to row
        row.appendChild(actions);

        // Finally, add the completed row to the table body
        rows.appendChild(row);
    });
}

// =====================================================================
// === 2. EVENT HANDLING & STATE MUTATION ===
// These functions handle user interactions and update the app state
// =====================================================================

// onToggleDay(): runs when any day button is clicked
// 'e' is the event object: contains info about the click
function onToggleDay(e) {
    // e.currentTarget is the button that was clicked (not a child element)
    const btn = e.currentTarget;
    // Read custom data attributes we set in render()
    const habitId = btn.dataset.habitId;
    const dateKey = btn.dataset.dateKey;
    // Delegate to toggleLog to update state and re-render
    toggleLog(habitId, dateKey);
}

// toggleLog(): core function to log or un-log a day for a habit
// If date exists in log: remove it (uncheck)
// If not: add it with value true (check)
function toggleLog(habitId, dateKey) {
    // Find the habit object by ID using .find()
    // Returns first match or undefined
    const h = state.habits.find(x => x.id === habitId);
    if (!h)
        return; // Safety: exit if habit not found (should never happen)

    // Toggle logic using property existence
    // h.log is an object: { "2025-10-22": true }
    if (h.log[dateKey]) {
        // delete removes the property: uncheck
        delete h.log[dateKey];
    } else {
        // Add property with value true: check
        h.log[dateKey] = true; 
    }

    // Persist the updated state to localStorage
    saveState(state); 
    // Redraw the entire UI with updated data
    render(); 
}

// =====================================================================
// === 3. FORM HANDLING: Add new habits ===
// =====================================================================
// Event listener for the "Add habit" form submission
// Uses DOMContentLoaded or runs after HTML loads
document.getElementById("habit-form").addEventListener("submit", (e) => {
    // Prevent default form submission (page reload)
    e.preventDefault(); 
    // Get the input field
    const input = document.getElementById("habit-name");
    // Get value, trim whitespace
    const name = input.value.trim(); 
    // Don't add empty habits
    if (!name)
        return; 

    // newHabit(name): factory function that creates a habit object
    // Returns { id, name, log: {} }
    state.habits.push(newHabit(name));
    // Save updated state
    saveState(state);
    // Clear input field
    input.value = ""; 
    // Re-render to show new habit
    render(); 
});

// =====================================================================
// === 4. DATA MANAGEMENT: Export, Import, Reset ===
// =====================================================================

// === EXPORT: Save current state as downloadable JSON file ===
document.getElementById("export-json").addEventListener("click", () => {
    // JSON.stringify with formatting (null, 2) = pretty print with indentation
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });

    // Create temporary download link
    const url = URL.createObjectURL(blob); 
    const a = document.createElement("a");

    a.href = url;
    a.download = "habits-export.json"; // Suggested filename
    a.click(); // Trigger download

    URL.revokeObjectURL(url); // Clean up memory
});

// === IMPORT: Load habits from uploaded JSON file ===
document.getElementById("import-json").addEventListener("change", async (e) => {
    const file = e.target.files?.[0]; 
    if (!file) return; // No file selected

    try {
        // Read file content as text
        const text = await file.text(); 
        // Parse JSON string to object
        const data = JSON.parse(text); 

        // Validate: must have .habits array
        if (!Array.isArray(data.habits))
            throw new Error("Invalid format");

        // Replace current state with imported data
        saveState(data);
        render();
        alert("Import complete. Data loaded.");
    } catch (err) {
        alert("Import failed. Please check the JSON file format.");
    }
    // Reset file input so same file can be selected again
    e.target.value = ""; 
});

// === RESET: Wipe all data after user confirmation ===
document.getElementById("reset-all").addEventListener("click", () => {
    // Double-check with user before deleting everything
    if (!confirm("Are you sure? This will permanently remove all habits and logs from this browser."))
        return;

    // Reset to initial empty state
    state = { habits: [] }; 
    saveState(state);
    render();
    alert("All data reset.");
});

// =====================================================================
// === 5. START APP: Initial render on page load ===
// =====================================================================

// Update column headers to show real dates
updateDayHeaderLabels();

// Run render() immediately when page loads to show saved data
// This restores the app state from localStorage
render();