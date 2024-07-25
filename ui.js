import { CONFIG } from "./config.js";
import { getState } from "./app.js";

export const setupEventListeners = (map, onNeighborhoodSelect, onUIChange, togglePlayPause, resetMusic) => {
    document.getElementById("neighborhoodSelect").addEventListener("change", onNeighborhoodSelect);
    document.getElementById("tempoRange").addEventListener("input", (event) => onTempoChange(event, onUIChange));
    document.getElementById("musicStrategySelect").addEventListener("change", onUIChange);
    document.getElementById("playPauseButton").addEventListener("click", togglePlayPause);
    document.getElementById("resetButton").addEventListener("click", resetMusic);
};

const onTempoChange = (event, onUIChange) => {
    document.getElementById("tempoValue").textContent = event.target.value;
    onUIChange();
};

export const loadSettings = () => {
    const savedSettings = JSON.parse(localStorage.getItem("musicConverterSettings")) || {};

    if (savedSettings.tempo) {
        document.getElementById("tempoRange").value = savedSettings.tempo;
        document.getElementById("tempoValue").textContent = savedSettings.tempo;
    }

    if (savedSettings.musicStrategy) {
        document.getElementById("musicStrategySelect").value = savedSettings.musicStrategy;
    }

    // We'll handle neighborhood selection after neighborhoods are loaded
    return savedSettings;
};

export const selectSavedNeighborhood = (savedSettings) => {
    const state = getState();
    if (savedSettings.neighborhood && state.neighborhoods.length > 0) {
        const neighborhoodSelect = document.getElementById("neighborhoodSelect");
        neighborhoodSelect.value = savedSettings.neighborhood;
        neighborhoodSelect.dispatchEvent(new Event("change"));
    }
};

export const saveSettings = () => {
    const settings = {
        neighborhood: document.getElementById("neighborhoodSelect").value,
        tempo: document.getElementById("tempoRange").value,
        musicStrategy: document.getElementById("musicStrategySelect").value,
    };

    localStorage.setItem("musicConverterSettings", JSON.stringify(settings));
};
