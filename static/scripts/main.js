const columnVolumes = {};
const activeSounds = {};
const isButtonPressed = {};
const VOLUME_SLIDER_ID = 'mainVolumeSlider';
const volumeSlider = document.getElementById(VOLUME_SLIDER_ID);
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const soundSources = {};
const soundBuffers = {};
let source;

async function loadSound(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return audioContext.decodeAudioData(arrayBuffer);
}

if (audioContext) {
    console.log("AudioContext został pomyślnie utworzony.");
} else {
    console.error("Twoja przeglądarka nie obsługuje interfejsu AudioContext.");
}

document.querySelectorAll('.pad, .pad1').forEach(pad => {
    pad.addEventListener('click', function() {
        const isWithEcho = document.getElementById('echoSwitch').checked;
        const isWithReverb = document.getElementById('reverbSwitch').checked;
        const isWithDistortion = document.getElementById('distortionSwitch').checked;
        toggleColor(this, isWithEcho, isWithReverb, isWithDistortion);
    });
});

function makeDistortionCurve(amount) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < samples; ++i) {
        const x = (i * 2) / samples - 1;
        curve[i] = (3 + amount) * x * 20 * deg / (Math.PI + amount * Math.abs(x));
    }

    return curve;
}

async function toggleSound(note, isWithEcho, isWithReverb, isWithDistortion) {
    console.log("Toggle Sound:", note);
    tempo = 1.0;

    const activeBuffers = {};

    Object.keys(soundSources).forEach(key => {
        if (soundSources[key]) {
            activeBuffers[key] = soundBuffers[key];
            soundSources[key].source.stop();
            delete soundSources[key];
        }
    });

    if (!soundBuffers[note]) {
        soundBuffers[note] = await loadSound(`static/sounds/${note}.mp3`);
    }
    activeBuffers[note] = soundBuffers[note];

    Object.keys(activeBuffers).forEach(async key => {
        const buffer = activeBuffers[key];
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const gainNode = audioContext.createGain();
        source.connect(gainNode);

        const panNode = audioContext.createStereoPanner();
        panNode.pan.value = 0; // Panorama ustawiona na środek
        source.connect(panNode);
        panNode.connect(gainNode);

        if (isWithEcho && key === note) {
            const echoNode = audioContext.createDelay(3.0);
            echoNode.delayTime.value = 0.3;
            const echoGain = audioContext.createGain();
            echoGain.gain.value = 0.8;
            source.connect(echoNode);
            echoNode.connect(echoGain);
            echoGain.connect(gainNode);
        } else {
            source.connect(gainNode);
        }

        if(isWithReverb && key === note) {
            const reverbNode = audioContext.createDelay(1.5);
            reverbNode.delayTime.value = 0.06;
            const reverbGain = audioContext.createGain();
            reverbGain.gain.value= 0.8;
            source.connect(reverbNode);
            reverbNode.connect(reverbGain);
            reverbGain.connect(gainNode);
        }else {
            source.connect(gainNode);
        }

        if(isWithDistortion && key === note) {
            const distortionNode = audioContext.createWaveShaper();
            distortionNode.curve = makeDistortionCurve(900);
            source.connect(distortionNode);
            distortionNode.connect(gainNode);
        }else {
            source.connect(gainNode);
        }

        gainNode.connect(audioContext.destination);

        // Usuń stare źródła dźwięku i węzły głośności
        if (soundSources[key]) {
            soundSources[key].source.stop();
            delete soundSources[key];
        }

        // Ustawienie głośności z uwzględnieniem głównej i kolumnowej
        adjustVolumeForSource(key, gainNode);
        source.start(0);
        // Ustawienie panoramy
        soundSources[key] = { source, gainNode, panNode };
        changePan(parseFloat(panSlider.value));
        
        
    });
}

function toggleColor(button, isWithEcho, isWithReverb, isWithDistortion) {
    console.log("Toggle Color:", button.id);
    const note = button.id;
    const isPlaying = soundSources[note];

    const columnId = button.parentElement.id;
    document.querySelectorAll(`#${columnId} .active`).forEach(otherButton => {
        const otherNote = otherButton.id;
        if (otherNote !== note && soundSources[otherNote]) {
            stopSound(otherNote); // Zatrzymaj dźwięk
            isButtonPressed[otherNote] = false;
            otherButton.classList.remove("active");
        }
    });

    if (isPlaying) {
        stopSound(note); // Zatrzymaj dźwięk
        isButtonPressed[note] = false;
        button.classList.remove("active");
    } else {
        toggleSound(note, isWithEcho, isWithReverb, isWithDistortion);
        isButtonPressed[note] = true;
        button.classList.add("active");

        button.classList.add("enlarged");
        setTimeout(() => {
            button.classList.remove("enlarged");
        }, 200); //Długość animacji powiększania się padów podana w milisekundach
    }
}

document.getElementById('stopAllSoundsButton').addEventListener('click', function() {
    console.log("Stop All Sounds Button clicked");
    Object.keys(soundSources).forEach(soundKey => {
        if (soundSources[soundKey]) {
            soundSources[soundKey].source.stop(); // Zatrzymaj źródło dźwięku
            delete soundSources[soundKey]; // Usuń referencję do źródła dźwięku
            isButtonPressed[soundKey] = false; // Zaktualizuj stan przycisku
        }
    });

    // Wizualne odznaczenie wszystkich padów jako nieaktywnych
    const pads = document.querySelectorAll('.pad, .pad1');
    pads.forEach(pad => {
        pad.classList.remove('active');
    });
});

function stopSound(note) {
    console.log("Stop Sound:", note);
    if (soundSources[note]) {
        soundSources[note].source.stop(); // Zatrzymaj źródło dźwięku
        delete soundSources[note]; // Usuń referencję do źródła dźwięku
    }
}

volumeSlider.addEventListener('input', updateMainVolume);

document.querySelectorAll('.volume-slider input').forEach(slider => {
    const column = slider.id.replace('VolumeSlider', '');
    slider.addEventListener('input', function() {
        columnVolumes[column] = parseFloat(this.value);
        updateColumnVolume(column, this.value);
    });
});

function adjustVolumeForSource(note, gainNode) {
    const column = note.substring(0, note.length - 1);
    const columnVolume = columnVolumes[column] !== undefined ? columnVolumes[column] : 1;
    const mainVolume = parseFloat(volumeSlider.value);
    gainNode.gain.value = columnVolume * mainVolume;
}

function updateMainVolume() {
    Object.keys(soundSources).forEach(key => {
        const { gainNode } = soundSources[key];
        adjustVolumeForSource(key, gainNode);
    });
}

function updateColumnVolume(column, volumeValue) {
    Object.keys(soundSources).forEach(key => {
        if (key.startsWith(column)) {
            const { gainNode } = soundSources[key];
            adjustVolumeForSource(key, gainNode);
        }
    });
}

const panSlider = document.getElementById('panSlider');

panSlider.addEventListener('input', function() {
    const panValue = parseFloat(this.value);
    changePan(panValue);
});

function changePan(panValue) {
    console.log('Change Panorama:', panValue);

    Object.keys(soundSources).forEach(key => {
        if (soundSources[key] && soundSources[key].panNode) {
            soundSources[key].panNode.pan.value = panValue;
        }
    });
}

document.addEventListener('DOMContentLoaded', (event) => {
    initializeKnob('.knob1.front');
    initializeKnob('.knob2.front');
    initializeKnob('.knob3.front');
});

function initializeKnob(selector) {
    console.log("Initialize Knob:", selector);
    const knob = document.querySelector(selector);
    let isDragging = false;
    let originX, originY, currentAngle = 0;

    knob.addEventListener('pointerdown', (e) => {
        isDragging = true;
        originX = e.clientX || e.touches[0].clientX;
        originY = e.clientY || e.touches[0].clientY;
        knob.classList.add('dragging');
    });

    document.addEventListener('pointermove', (e) => {
        if (isDragging) {
            let clientX = e.clientX || e.touches[0].clientX;
            let clientY = e.clientY || e.touches[0].clientY;
            let radians = Math.atan2(clientX - originX, clientY - originY);
            let degrees = (radians * (180 / Math.PI) * -1) + 180;
            currentAngle = degrees;
            knob.style.transform = `rotate(${currentAngle}deg)`;

            const knobValue = currentAngle / 360;
        }
    });

    document.addEventListener('pointerup', (e) => {
        if (isDragging) {
            isDragging = false;
            knob.classList.remove('dragging');
        }
    });
}

let tempo = 1.0;

function changeTempo(newTempo) {
    console.log("Change Tempo:", newTempo);
    tempo = newTempo;
    Object.keys(soundSources).forEach(key => {
        if (soundSources[key] && soundSources[key].source) {
            soundSources[key].source.playbackRate.value = tempo;
        }
    });
}

document.getElementById('increaseTempoButton').addEventListener('click', function() {
    console.log("Increase Tempo Button clicked");
    changeTempo(tempo + 0.05);
});

document.getElementById('decreaseTempoButton').addEventListener('click', function() {
    console.log("Decrease Tempo Button clicked");
    changeTempo(tempo - 0.05);
});

const container = document.querySelector('.container');
const getRandomHeight = (min, max) => ~~(Math.random() * (max - min + 1)) + min;

let lineLength = ~~(window.innerWidth * 0.03);
let intervalId = null;

const animateEqualizer = () => {
    intervalId = setInterval(() => {
        const minHeight = 2;
        const maxHeight = 90;

        const randomHeight = Array.from(Array(lineLength < 15 ? 15 : lineLength), () =>
            getRandomHeight(minHeight, maxHeight)
        );

        const topLines = document.querySelectorAll('.equalizer.top .line');
        const bottomLines = document.querySelectorAll('.equalizer.bottom .line');

        randomHeight.forEach((height, idx) => {
            topLines[idx].style.height = `${height}px`;
            bottomLines[idx].style.height = `${height}px`;
        });
    }, 100);
}

const createEqualizer = (className) => {
    const equalizerDiv = document.createElement('div');
    equalizerDiv.classList.add('equalizer', className);
    container.appendChild(equalizerDiv);
}

const createLines = (n, equalizer) => {
    createEqualizer(equalizer);
    const parent = document.querySelector(`.equalizer.${equalizer}`);

    for (let i = 0; i < n; i++) {
        const lineDiv = document.createElement('div');
        lineDiv.classList.add('line');
        parent.appendChild(lineDiv);
    }
}

const createContents = () => {
    const equalizers = ['top', 'bottom'];

    equalizers.forEach(equalizer => createLines(lineLength, equalizer));
    animateEqualizer();
}

const handleResize = () => {
    clearInterval(intervalId);
    lineLength = ~~(window.innerWidth * 0.03);
    const equalizers = document.querySelectorAll('.equalizer');
    equalizers.forEach(equalizer => equalizer.remove());
    createContents();
}

window.addEventListener('resize', handleResize);

createContents();
