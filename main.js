// =====================================================================
// === APP STARTING POINT ==============================================
// =====================================================================

import {
    updateDayHeaderLabels,
    updateWeekHeader,
    render
} from "./render.js";

import {
    setupEventHandlers
} from "./events.js";

updateDayHeaderLabels();
updateWeekHeader();
setupEventHandlers();
render();
