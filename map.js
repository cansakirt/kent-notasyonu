import { CONFIG } from "./config.js";
import { handleError } from "./utils.js";

export const initMap = () => {
    const map = L.map("map").setView(CONFIG.MAP.INITIAL_VIEW, CONFIG.MAP.INITIAL_ZOOM);
    // L.tileLayer("http://localhost:8081/offline%20OSM%20map%20data/downloaded_images/{z}/{x}/{y}.png", {}).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    map.on("mousemove", (e) => {
        const lat = e.latlng.lat.toFixed(5);
        const lng = e.latlng.lng.toFixed(5);
        document.getElementById("coordinates").innerHTML = `Coordinates: ${lat}, ${lng}`;
    });

    return map;
};

export const loadNeighborhoods = async (map) => {
    try {
        const response = await fetch("mahalle.json");
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const neighborhoods = data.features;
        displayNeighborhoods(neighborhoods);
        return neighborhoods;
    } catch (error) {
        handleError(error, "Failed to load neighborhood data. Please try again.");
        return [];
    }
};

const displayNeighborhoods = (neighborhoods) => {
    const neighborhoodSelect = document.getElementById("neighborhoodSelect");
    neighborhoodSelect.innerHTML = '<option value="">Select a neighborhood</option>';

    neighborhoods.sort((a, b) => {
        if (a.properties.ILCE !== b.properties.ILCE) {
            return a.properties.ILCE.localeCompare(b.properties.ILCE);
        }
        return a.properties.AD.localeCompare(b.properties.AD);
    });

    neighborhoods.forEach((neighborhood, index) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent = `${neighborhood.properties.AD} (${neighborhood.properties.ILCE})`;
        neighborhoodSelect.appendChild(option);
    });
    document.getElementById("neighborhoodSelector").classList.remove("hidden");
};

export const visualizeNeighborhood = (map, neighborhood) => {
    if (!neighborhood || !neighborhood.geometry) {
        console.error("Invalid neighborhood object:", neighborhood);
        return;
    }

    map.eachLayer((layer) => {
        if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
            map.removeLayer(layer);
        }
    });

    const coordinates = neighborhood.geometry.coordinates[0];
    const latLngs = coordinates.map((coord) => {
        const [lon, lat] = proj4("EPSG:5254", "EPSG:4326", coord);
        return [lat, lon];
    });

    if (latLngs.length > 0) {
        const polygon = L.polygon(latLngs, { color: "blue", weight: 2 }).addTo(map);
        map.fitBounds(polygon.getBounds());
    } else {
        alert("Unable to visualize this neighborhood due to missing coordinate data.");
        map.setView(CONFIG.MAP.INITIAL_VIEW, CONFIG.MAP.INITIAL_ZOOM);
    }
};

let roadLayers = [];

export const visualizeRoads = (map, roads) => {
    roadLayers = roads.map((road, index) => {
        const polyline = L.polyline(road.geometry, { color: "orange", weight: 2, opacity: 0.7 })
            .addTo(map)
            .on("mouseover", (e) => highlightRoad(e.target, road, index, map))
            .on("mouseout", (e) => unhighlightRoad(e.target, roads, map));
        return polyline;
    });
};

const highlightRoad = (polyline, road, index, map) => {
    polyline.setStyle({
        color: "red",
        weight: 4,
        opacity: 1,
    });
    polyline.bringToFront();

    map.eachLayer((layer) => {
        if (layer instanceof L.Polyline && layer !== polyline) {
            layer.setStyle({ opacity: 0.3 });
        }
    });

    const roadName = road.tags.name || "Unnamed road";
    const roadType = road.tags.highway || "Unknown type";
    polyline.bindTooltip(`${roadName} (${roadType})`, { permanent: true }).openTooltip();

    document.querySelectorAll(".note-span").forEach((span) => {
        if (parseInt(span.dataset.roadIndex) === index) {
            span.classList.add("active");
        }
    });
};

const unhighlightRoad = (polyline, roads, map) => {
    polyline.setStyle({
        color: "orange",
        weight: 2,
        opacity: 0.7,
    });

    map.eachLayer((layer) => {
        if (layer instanceof L.Polyline) {
            layer.setStyle({ opacity: 0.7 });
        }
    });

    polyline.closeTooltip();
    polyline.unbindTooltip();

    document.querySelectorAll(".note-span").forEach((span) => {
        span.classList.remove("active");
    });
};

window.highlightRoad = (roadIndex) => {
    if (roadLayers[roadIndex]) {
        roadLayers[roadIndex].setStyle({
            color: "purple",
            weight: 4,
            opacity: 1,
        });
        roadLayers[roadIndex].bringToFront();

        roadLayers.forEach((layer, index) => {
            if (index !== roadIndex) {
                layer.setStyle({ opacity: 0.3 });
            }
        });

        setTimeout(() => {
            roadLayers[roadIndex].setStyle({
                color: "orange",
                weight: 2,
                opacity: 0.4,
            });
            roadLayers.forEach((layer) => {
                layer.setStyle({ opacity: 0.4 });
            });
        }, 1000);
    }
};
