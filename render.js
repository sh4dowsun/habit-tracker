// =====================================================================
// === RENDER: DOM generation based on state ===========================
// =====================================================================

import {
    state,
    weekKeys,
    computeStreak,
    formatShortDate,
    saveState,
    todayKey
} from "./state.js";

// === DOM references used throughout the app ===
const rows = document.getElementById("habit-events"); // Container for habit rows
const weekRangeEl = document.getElementById("week-range"); // "This week" date range text

// Set dates as column headers
export function updateDayHeaderLabels() {
    const today = new Date();

    document.querySelectorAll(".day-header").forEach(cell => {
        const offset = Number(cell.dataset.offset) || 0;
        const d = new Date(today);

        d.setDate(today.getDate() + offset);

        cell.textContent = formatShortDate(d);
    });
}

// Set a week header
export function updateWeekHeader() {
    if (!weekRangeEl)
        return;

    const today = new Date();
    const start = new Date(today);

    start.setDate(today.getDate() - 6);

    const fmt = d => d.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short"
    });

    const startStr = fmt(start);
    const endStr = fmt(today);
    
    weekRangeEl.textContent = startStr === endStr ? startStr : `${startStr} - ${endStr}`;
}

// =====================================================================
// === RENDER UI: Dynamic DOM Generation (State Reconciliation) ===
// This function completely rebuilds the habit tracker table in the browser
// It is called every time the data changes (add, toggle, delete, import, etc.)
// It uses the current 'state' object to generate fresh HTML: no templates!
// =====================================================================
// render(): The master function that draws the entire UI from scratch
export function render() {
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

// Runs when any day button is clicked
export function onToggleDay(e) {
    const btn = e.currentTarget;
    const habitId = btn.dataset.habitId;
    const dateKey = btn.dataset.dateKey;

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
