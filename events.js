// =====================================================================
// === EVENTS: forms, buttons, clicks ==================================
// =====================================================================

import {
    state,
    saveState,
    todayKey,
    weekKeys,
    newHabit
} from "./state.js";

import {
    render
} from "./render.js";

const addHabitForm = document.getElementById("habit-form");
const newHabitInput = document.getElementById("habit-name");
const exportBtn = document.getElementById("export-json");
const importBtn = document.getElementById("import-json");
const resetBtn = document.getElementById("reset-all");
const rows = document.getElementById("week-range");

// A single init function to call from main.
export function setupEventHandlers() {
    event_addHabit();
    event_rowClickHandlers();
    event_export();
    event_import();
    event_reset();
}

// =====================================================================
// === FORM HANDLING: Add new habits ===
// =====================================================================
function event_addHabit() {
    addHabitForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const name = newHabitInput.value.trim();
        if (!name)
            return;

        const next = {
            habits: [...state.habits, newHabit(name)],
        };

        saveState(next);

        newHabitInput.value = "";

        render();
    });
}

// === ROW CLICK: Handle habit click and habit delete ===
function event_rowClickHandlers() {
    rows.addEventListener("click", (e) => {
        const target = e.target;

        if (target.matches("[data-day-key]")) {
            const habitId = target.dataset.habitId;
            const dayKey = target.dataset.dayKey;

            const nextHabits = state.habits.map(h => {
                if (h.id !== habitId)
                    return h;
                
                const log = { ...h.log };
                log[dayKey] = !log[dayKey];

                return { ...h, log };
            });

            saveState({
                habits: nextHabits
            });

            render();

            return;
        }

        if (target.matches("[data-action='delete-habit']")) {
            const habitId = target.dataset.habitId;

            if (!confirm("Delete this habit?"))
                return;

            const nextHabits = state.habits.filter(h => h.id !== habitId);

            saveState({
                habits: nextHabits
            });

            render();
        }
    });
}

// =====================================================================
// === DATA MANAGEMENT: Export, Import, Reset ===
// =====================================================================

// === EXPORT: Save current state as downloadable JSON file ===
function event_export() {
    exportBtn.addEventListener("click", () => {
        const blob = new Blob([JSON.stringify(state, null, 2)], {
            type: "application/json",
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");

        a.href = url;
        a.download = "habits-export.json";

        document.body.appendChild(a);

        a.click();
        a.remove();

        URL.revokeObjectURL(url);
    });
}

// === IMPORT: Load habits from uploaded JSON file ===
function event_import() {
    importBtn.addEventListener("change", async (e) => {
        const file = e.target.files?.[0]; 
        if (!file)
            return;

        try {
            const text = await file.text();
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
}

// === RESET: Wipe all data after user confirmation ===
function event_reset() {
    resetBtn.addEventListener("click", () => {
        if (!confirm("Are you sure? This will erase all habits and logs."))
            return;

        saveState({
            habits: []
        });

        render();

        alert("All data reset.");
    });
}
