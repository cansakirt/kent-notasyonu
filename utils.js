export const handleError = (error, userMessage) => {
    console.error(error);
    alert(userMessage || "An error occurred. Please try again.");
};

export const calculateNetworkDensity = (roads, area) => {
    const totalRoadLength = roads.reduce((sum, road) => sum + calculateRoadLength(road), 0) / 1000; // Convert to km
    return totalRoadLength / area;
};

export const findIntersections = (roads) => {
    const intersections = {};
    roads.forEach((road) => {
        road.geometry.forEach((point) => {
            const key = `${point.lat},${point.lng}`;
            intersections[key] = intersections[key] ? intersections[key] + 1 : 1;
        });
    });
    return Object.entries(intersections)
        .filter(([, count]) => count > 1)
        .map(([key]) => {
            const [lat, lng] = key.split(",").map(Number);
            return L.latLng(lat, lng);
        });
};

export const calculateBetaIndex = (roads, intersections) => {
    return roads.length / intersections.length;
};

export const calculateEtaIndex = (roads) => {
    const totalLength = roads.reduce((sum, road) => sum + calculateRoadLength(road), 0);
    return totalLength / roads.length;
};

export const calculateSinuosity = (road) => {
    if (!road || !road.geometry || road.geometry.length < 2) {
        console.warn("Invalid road object or insufficient geometry points");
        return 1;
    }
    const straightLineDistance = road.geometry[0].distanceTo(road.geometry[road.geometry.length - 1]);
    const actualDistance = calculateRoadLength(road);
    return straightLineDistance === 0 ? 1 : actualDistance / straightLineDistance;
};

const calculateRoadLength = (road) => {
    if (!road || !road.geometry) {
        console.warn("Invalid road object or missing geometry");
        return 0;
    }
    return road.geometry.reduce((length, point, index, arr) => {
        if (index === 0) return length;
        return length + point.distanceTo(arr[index - 1]);
    }, 0);
};
