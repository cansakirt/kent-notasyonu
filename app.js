import { CONFIG } from "./config.js";
import { initMap, loadNeighborhoods, visualizeNeighborhood, visualizeRoads } from "./map.js";
import { setupEventListeners, loadSettings, saveSettings, selectSavedNeighborhood } from "./ui.js";

import { convertToMusic, playMusic, pauseMusic, updatePlayPauseButton, highlightCurrentNote, resetCurrentNoteIndex } from "./music.js";
import {
    calculateNetworkDensity,
    findIntersections,
    calculateBetaIndex,
    calculateEtaIndex,
    calculateSinuosity,
    handleError,
} from "./utils.js";

const state = {
    map: null,
    neighborhoods: [],
    selectedNeighborhood: null,
    roads: [],
    roadsHighway: [],
    musicalEvents: [],
    isPlaying: false,
};

export const getState = () => state;
export const setState = (newState) => Object.assign(state, newState);

async function init() {
    state.map = initMap();
    setupEventListeners(state.map, onNeighborhoodSelect, onUIChange, togglePlayPause, resetMusic);
    const savedSettings = loadSettings();
    try {
        const [loadedNeighborhoods, roadNetworkData] = await Promise.all([loadNeighborhoods(state.map), loadRoadNetworkData()]);
        setState({ neighborhoods: loadedNeighborhoods, roadsHighway: roadNetworkData });
        console.log("Neighborhoods loaded:", state.neighborhoods.length);
        document.getElementById("neighborhoodSelect").disabled = false;

        // Select the saved neighborhood after neighborhoods are loaded
        selectSavedNeighborhood(savedSettings);
    } catch (error) {
        handleError(error, "Failed to load initial data. Please refresh the page.");
    }
}

// Define the projection
proj4.defs("EPSG:5254", "+proj=tmerc +lat_0=0 +lon_0=27 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");

const loadRoadNetworkData = async () => {
    try {
        const response = await fetch("data.json");
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.elements.filter((el) => el.type === "way" && el.tags && el.tags.highway);
    } catch (error) {
        handleError(error, "Failed to load road network data. Please try again.");
    }
};

const onNeighborhoodSelect = (event) => {
    const index = event.target.value;
    if (index !== "" && state.neighborhoods[index]) {
        setState({ selectedNeighborhood: state.neighborhoods[index] });
        visualizeNeighborhood(state.map, state.selectedNeighborhood);
        loadRoads(state.selectedNeighborhood);
        document.getElementById("musicControls").classList.remove("hidden");
        onUIChange();
    } else {
        setState({ selectedNeighborhood: null });
        document.getElementById("musicControls").classList.add("hidden");
    }
    saveSettings();
};

const loadRoads = (neighborhood) => {
    const neighborhoodPolygon = turf.polygon([
        neighborhood.geometry.coordinates[0].map((coord) => {
            const [lon, lat] = proj4("EPSG:5254", "EPSG:4326", coord);
            return [lon, lat];
        }),
    ]);

    const roads = state.roadsHighway
        .filter((way) => {
            const roadLine = turf.lineString(way.geometry.map((node) => [node.lon, node.lat]));
            return turf.booleanIntersects(neighborhoodPolygon, roadLine);
        })
        .map((way) => ({
            geometry: way.geometry.map((node) => L.latLng(node.lat, node.lon)),
            tags: way.tags,
        }));

    setState({ roads });
    visualizeRoads(state.map, state.roads);
    return calculateMetrics(state.roads, neighborhood);
};

const calculateMetrics = (roads, neighborhood) => {
    const area = turf.area(turf.polygon([neighborhood.geometry.coordinates[0]])) / 1000000; // Convert to km²
    const networkDensity = calculateNetworkDensity(roads, area);
    const intersections = findIntersections(roads);
    const betaIndex = calculateBetaIndex(roads, intersections);
    const etaIndex = calculateEtaIndex(roads);
    const averageSinuosity = roads.reduce((sum, road) => sum + calculateSinuosity(road), 0) / roads.length;

    return { networkDensity, betaIndex, etaIndex, averageSinuosity };
};

const onUIChange = () => {
    if (state.selectedNeighborhood && state.roads.length > 0) {
        const metrics = calculateMetrics(state.roads, state.selectedNeighborhood);
        setState({ musicalEvents: convertToMusic(state.roads, metrics) });
        displayResult(state.musicalEvents);
        document.getElementById("playPauseButton").disabled = false;

        // Log notes and Tone.js arguments
        console.log("Musical Events:", state.musicalEvents);
        console.log("Music Strategy:", document.getElementById("musicStrategySelect").value);
        console.log("Tempo:", document.getElementById("tempoRange").value);
    }
    saveSettings();
};

const togglePlayPause = async () => {
    if (state.isPlaying) {
        pauseMusic();
        setState({ isPlaying: false });
    } else {
        try {
            await playMusic(state.musicalEvents);
            setState({ isPlaying: true });
        } catch (error) {
            console.error("Error playing music:", error);
        }
    }
    updatePlayPauseButton(state.isPlaying);
};

const resetMusic = () => {
    state.musicalEvents = [];
    onUIChange();
    pauseMusic();
    resetCurrentNoteIndex();
    highlightCurrentNote(0);
    setState({ isPlaying: false });
    updatePlayPauseButton(state.isPlaying);

    // Reset Tone.js transport to the beginning
    Tone.Transport.stop();
    Tone.Transport.position = 0;
};

const displayResult = (musicalEvents) => {
    const resultDiv = document.getElementById("result");
    const notationHtml = musicalEvents
        .map(
            (event, index) =>
                `<span id="note-${index}" class="note-span" data-road-index="${event.roadIndex}">${event.note}(${event.duration.toFixed(
                    2
                )}) - ${event.roadType}</span>`
        )
        .join(" ");

    const musicStrategy = document.getElementById("musicStrategySelect").value;
    const tempo = document.getElementById("tempoRange").value;

    resultDiv.innerHTML = `
        <h2 class="text-xl font-bold mt-4 mb-2">Generated Music Notation:</h2>
        <p>${notationHtml}</p>
        <p>Tempo: ${tempo} BPM</p>
        <p>Music Strategy: ${musicStrategy}</p>
    `;
};

window.onerror = function (message, source, lineno, colno, error) {
    console.error("An unexpected error occurred. Please refresh the page and try again. Global error:", error);
    return true;
};

document.addEventListener("DOMContentLoaded", init);
