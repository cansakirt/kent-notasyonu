import { CONFIG } from "./config.js";
import { handleError } from "./utils.js";

let noteSequence = null;
let currentNoteIndex = 0;
let currentSynth = null;

export const convertToMusic = (roads, metrics) => {
    const tempo = parseInt(document.getElementById("tempoRange").value);
    Tone.Transport.bpm.value = tempo;

    const musicStrategy = document.getElementById("musicStrategySelect").value;

    return roads.map((road, index) => {
        const note = assignNote(road, index, roads.length);
        const duration = calculateDuration(road, metrics.etaIndex);
        const chord = assignChord(index, metrics.betaIndex);

        return {
            note,
            chord,
            duration,
            roadIndex: index,
            roadType: road.tags.highway || "unknown",
            isHorizontal: isHorizontalRoad(road),
        };
    });
};

const assignNote = (road, index, totalRoads) => {
    const notes = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"];
    const roadLength = calculateRoadLength(road);
    const pitchIndex = Math.floor((index / totalRoads) * notes.length);
    return notes[pitchIndex];
};

const calculateDuration = (road, etaIndex) => {
    const roadLength = calculateRoadLength(road);
    const baseDuration = roadLength / 1000; // Convert to seconds
    const durationVariability = Math.min(0.5, etaIndex / 1000);
    return Math.max(0.1, Math.min(1, baseDuration * (1 + durationVariability)));
};

const assignChord = (index, betaIndex) => {
    const chords = [
        ["C4", "E4", "G4"],
        ["D4", "F4", "A4"],
        ["E4", "G4", "B4"],
        ["F4", "A4", "C5"],
    ];
    const chordProgressionLength = Math.max(1, Math.min(4, Math.floor(betaIndex)));
    return chords[index % chordProgressionLength];
};

const calculateRoadLength = (road) => {
    return road.geometry.reduce((length, point, index, arr) => {
        if (index === 0) return length;
        return length + point.distanceTo(arr[index - 1]);
    }, 0);
};

const isHorizontalRoad = (road) => {
    const start = road.geometry[0];
    const end = road.geometry[road.geometry.length - 1];
    const dx = end.lng - start.lng;
    const dy = end.lat - start.lat;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    return Math.abs(angle) < 45 || Math.abs(angle) > 135;
};

export const playMusic = async (musicalEvents) => {
    try {
        await Tone.start();
        console.log("AudioContext started");

        if (!currentSynth) {
            currentSynth = await createSynth();
        }

        if (noteSequence) {
            noteSequence.dispose();
        }

        noteSequence = new Tone.Sequence((time, event) => {
            playNote(currentSynth, event, time);
            highlightCurrentNote(currentNoteIndex);
            highlightCurrentRoad(event.roadIndex);
            currentNoteIndex = (currentNoteIndex + 1) % musicalEvents.length;
        }, musicalEvents).start(0);

        Tone.Transport.start();
    } catch (error) {
        handleError(error, "Failed to start music playback. Please try again.");
    }
};

export const pauseMusic = () => {
    Tone.Transport.pause();
    if (noteSequence) {
        noteSequence.stop();
    }
};

let sample_url;
sample_url = "https://tonejs.github.io/audio/salamander";
sample_url = "./dist/salamander";

const createSynth = () => {
    const musicStrategy = document.getElementById("musicStrategySelect").value;

    return new Promise((resolve) => {
        let synth;
        switch (musicStrategy) {
            case "polysynthOrientation":
            case "simplePolysynth":
                synth = new Tone.PolySynth(Tone.Synth, {
                    maxPolyphony: 32,
                }).toDestination();
                resolve(synth);
                break;
            case "varyingInstruments":
                synth = new Tone.Sampler({
                    urls: {
                        C4: `${sample_url}/C4.mp3`,
                        "D#4": `${sample_url}/Ds4.mp3`,
                        "F#4": `${sample_url}/Fs4.mp3`,
                        A4: `${sample_url}/A4.mp3`,
                    },
                    onload: () => {
                        console.log("Sampler loaded");
                        resolve(synth);
                    },
                }).toDestination();
                break;
            default:
                synth = new Tone.PolySynth(Tone.Synth, {
                    oscillator: { type: "sine" },
                    maxPolyphony: 32,
                }).toDestination();
                resolve(synth);
        }
    });
};

const playNote = (synth, event, time) => {
    const musicStrategy = document.getElementById("musicStrategySelect").value;
    // console.log(`Playing note: ${event.note} for road type: ${event.roadType}`);

    switch (musicStrategy) {
        case "polysynthOrientation":
            synth.set({ oscillator: { type: event.isHorizontal ? "sine" : "triangle" } });
            synth.triggerAttackRelease(event.note, event.duration, time);
            break;
        case "simplePolysynth":
            synth.triggerAttackRelease(event.chord, event.duration, time);
            break;
        case "varyingInstruments":
            const instrumentMap = {
                motorway: "C4",
                primary: "D#4",
                secondary: "F#4",
                residential: "A4",
            };
            const note = instrumentMap[event.roadType] || "C4";
            synth.triggerAttackRelease(note, event.duration, time);
            break;
        default:
            synth.triggerAttackRelease(event.note, event.duration, time);
    }
};

export const highlightCurrentNote = (index) => {
    document.querySelectorAll(".note-span").forEach((span) => span.classList.remove("active"));
    const currentNoteSpan = document.getElementById(`note-${index}`);
    if (currentNoteSpan) {
        currentNoteSpan.classList.add("active");
    }
};

const highlightCurrentRoad = (roadIndex) => {
    if (typeof window.highlightRoad === "function") {
        window.highlightRoad(roadIndex);
    }
};

export const updatePlayPauseButton = (isPlaying) => {
    const playPauseButton = document.getElementById("playPauseButton");
    const resetButton = document.getElementById("resetButton");
    playPauseButton.textContent = isPlaying ? "Pause" : "Play";
    playPauseButton.classList.toggle("bg-green-600", !isPlaying);
    playPauseButton.classList.toggle("bg-red-600", isPlaying);
};

export const resetCurrentNoteIndex = () => {
    currentNoteIndex = 0;
    if (noteSequence) {
        noteSequence.stop();
        noteSequence.dispose();
        noteSequence = null;
    }
    // Reset the currentSynth when resetting
    currentSynth = null;
};
