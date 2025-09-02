
let shaderScaleFactor = 0.1;

const gameCanvas = document.getElementById("gameCanvas");
const ctx = gameCanvas.getContext("2d"); // Kontekst 2D dla gry, tak jak było

const drunkenBlurCanvas = document.createElement('canvas');
const drunkenBlurCtx = drunkenBlurCanvas.getContext('2d');

const shaderCanvas = document.getElementById("shaderCanvas");
const gl = shaderCanvas.getContext("webgl", { preserveDrawingBuffer: false }); // Kontekst WebGL dla efektu

// --- NOWY KOD: Globalna flaga pauzy i stanu widoku ---
let isGamePaused = false;
let currentView = 'cockpit'; // Możliwe wartości: 'cockpit', 'engine'

// Upewnij się, że globalna zmienna 'canvas' nadal wskazuje na główny canvas gry,
// jeśli inne części kodu z niej korzystają.
const canvas = gameCanvas;

const blinkState = {
    isActive: false,         // Czy animacja mrugania jest aktywna
    timer: 0,                // Timer odliczający do następnego mrugnięcia
    interval: 15,            // Czas w sekundach między mrugnięciami
    duration: 0.37,           // Czas trwania animacji mrugnięcia w sekundach
    progress: 0.0,           // Postęp animacji (od 0.0 do 1.0)
    blurAmount: 25            // Intensywność rozmycia (w pikselach)
};

const stanUpojenia = {
    liczbaWypitychPiw: 0,       // Prosty licznik wypitych piw.

    // Właściwości dla efektów wizualnych
    czasBujania: 0.0,         // Wewnętrzny timer do generowania płynnego bujania
    aktualnyKatBujania: 0.0,  // Ostateczny kąt obrotu stosowany w każdej klatce
    aktualnyZoom: 1.0,        // Ostateczny współczynnik powiększenia

    // Wartości docelowe, do których dążymy płynnie
    docelowyZoom: 1.0,

    // Parametry konfiguracyjne, które będą się zmieniać wraz z liczbą piw
    amplitudaBujania: 0.0,    // Jak bardzo (w radianach) obraz ma się bujać
    czestotliwoscBujania: 0.0, // Jak szybko obraz ma się bujać

    // Współczynnik płynności animacji efektów
    wspolczynnikWygładzania: 0.02,

    // Właściwości dla orbitalnego motion blur
    blurRotationAngle: 0.0,
    blurRotationSpeed: 0.0,
    blurOffsetRadius: 0.0,
    // --- NOWA WŁAŚCIWOŚĆ ---
    blurAlpha: 0.0            // Przezroczystość dla orbitalnego motion blur
};

const rotaryMenuState = {
    isActive: false,            // Czy menu jest aktywne (czy trzymamy 'F')
    isRotating: false,          // Czy trwa animacja obrotu
    rotationProgress: 0,        // Postęp animacji obrotu (0.0 do 1.0)
    rotationDirection: 0,       // Kierunek obrotu (-1 dla lewo, 1 dla prawo)
    rotationSpeed: 2.5,         // Szybkość animacji obrotu

    // Tablica z naszymi opcjami
    items: [
        { name: "cockpit", image: null }, // Indeks 0
        { name: "engine",  image: null }, // Indeks 1 (domyślnie na środku)
        { name: "trunk",   image: null }  // Indeks 2
    ],
    selectedIndex: 1, // Indeks aktualnie wybranej (środkowej) opcji

    // Konfiguracja pozycji i wyglądu dla każdego slotu
    positions: {
        center: { x: 1920 / 2, y: 1080 / 2, scale: 2, alpha: 1.0 },
        left:   { x: 1920 / 2 - 100, y: 1080 / 2, scale: 0.7, alpha: 0.5 },
        right:  { x: 1920 / 2 + 100, y: 1080 / 2, scale: 0.7, alpha: 0.5 }
    }
};

const menedzerZasobow = {
    liczbaZasobowDoZaladowania: 0,
    liczbaZaladowanychZasobow: 0,
    wszystkoZaladowane: false,

    sledz: function(obraz) {
        // Funkcja, która zostanie wywołana po załadowaniu (lub błędzie)
        const onAssetLoad = () => {
            // Upewnij się, że zliczamy zasób tylko raz
            if (!obraz.dataset.counted) {
                obraz.dataset.counted = 'true'; // Oznaczamy obraz jako policzony
                this.liczbaZaladowanychZasobow++;
                
                // --- NOWY KOD: Przygotowanie tekstu i aktualizacja UI ---
                const nazwaZasobu = obraz.src.split('/').pop();
                const tekstPostepu = `Loaded: ${this.liczbaZaladowanychZasobow} / ${this.liczbaZasobowDoZaladowania} (${nazwaZasobu})`;

                // Wypisz postęp w konsoli
                console.log(tekstPostepu);

                // Znajdź element na ekranie i zaktualizuj jego treść
                const infoElement = document.getElementById('ladowanie-info');
                if (infoElement) {
                    infoElement.textContent = tekstPostepu;
                }
                // --- KONIEC NOWEGO KODU ---

                if (this.liczbaZaladowanychZasobow >= this.liczbaZasobowDoZaladowania) {
                    this.wszystkoZaladowane = true;
                    console.log("All graphic assets have been loaded!");
                    
                    // --- NOWY KOD: Aktualizacja tekstu po zakończeniu ---
                    if (infoElement) {
                        infoElement.textContent = 'Everything is ready!';
                    }
                    // --- KONIEC NOWEGO KODU ---
                }
            }
        };

        // Sprawdzamy, czy obrazek nie jest już przypadkiem załadowany (np. z cache)
        if (obraz.complete && obraz.naturalWidth !== 0) {
            // Używamy setTimeout(..., 0), aby dać przeglądarce chwilę na narysowanie
            // ekranu ładowania, zanim zaczniemy go aktualizować zasobami z cache.
            setTimeout(() => onAssetLoad(), 0);
        } else {
            this.liczbaZasobowDoZaladowania++;
            obraz.addEventListener('load', onAssetLoad);
            obraz.addEventListener('error', () => {
                console.warn(`Nie udało się załadować zasobu: ${obraz.src}`);
                onAssetLoad();
            });
        }
    },
};


/**
 * Tworzy i wstawia do dokumentu ekran ładowania (czarne tło + obracające się kółko).
 */

/**
 * Główna funkcja inicjująca grę po zakończeniu ładowania.
 * Ukrywa ekran ładowania i rozpoczyna pętlę renderowania.
 */
function rozpocznijGre() {
    const ekranLadowania = document.getElementById('ekran-ladowania');
    if (ekranLadowania) {
        console.log("Loading screen found. Adding class 'hidden' ...");
        ekranLadowania.classList.add('ukryty');
        
        // Usunięcie elementu z drzewa DOM po zakończeniu animacji
        setTimeout(() => {
            ekranLadowania.remove();
        }, 700); // Czas musi być zgodny z 'transition' w CSS
    } else {
        console.error("KRYTYCZNY BŁĄD: Nie znaleziono elementu #ekran-ladowania w HTML!");
    }
    
    // Pokaż canvas shadera, który był ukryty przez CSS
    if (shaderCanvas) {
        shaderCanvas.style.display = 'block';
    }

    console.log("Starting the game rendering loop...");
    requestAnimationFrame(render);
}

// --- ZMIANA: Dodano nową właściwość isVcrEffectOn i nową opcję na początku listy ---
const vhsMenuState = {
    isOpening: false,
    isOpen: false,
    transitionProgress: 0.0,
    transitionSpeed: 6.5,
    selectedOptionIndex: 0,
    isVcrEffectOn: true,
    // --- NOWE WŁAŚCIWOŚCI ---
    areScanlinesOn: true,       // Stan dla pasków CRT
    isDitheringOn: true,        // Stan dla ditheringu
    // --- KONIEC NOWYCH WŁAŚCIWOŚCI ---
    isSoundOn: true,
    currentResolutionIndex: 2,
    saturationLevel: 4,
    gammaLevel: 2,
    currentColorStepIndex: 0, // <--- POPRAWIONA WARTOŚĆ

    options: [
        {
            name: "VCR EFFECT",
            type: "toggle",
            values: ["ON", "OFF"],
            getValue: (state) => state.isVcrEffectOn ? 0 : 1,
            action: (state, direction) => {
                state.isVcrEffectOn = !state.isVcrEffectOn;
            }
        },
        // --- NOWA OPCJA: CRT SCANLINES ---
        {
            name: "CRT SCANLINES",
            type: "toggle",
            values: ["ON", "OFF"],
            getValue: (state) => state.areScanlinesOn ? 0 : 1,
            action: (state, direction) => {
                state.areScanlinesOn = !state.areScanlinesOn;
            }
        },
        // --- NOWA OPCJA: DITHERING ---
        {
            name: "DITHERING",
            type: "toggle",
            values: ["ON", "OFF"],
            getValue: (state) => state.isDitheringOn ? 0 : 1,
            action: (state, direction) => {
                state.isDitheringOn = !state.isDitheringOn;
            }
        },
        // --- KONIEC NOWYCH OPCJI ---
        {
            name: "SET UP SOUND",
            type: "toggle",
            values: ["ON", "OFF"],
            getValue: (state) => state.isSoundOn ? 0 : 1,
            action: (state, direction) => {
                state.isSoundOn = !state.isSoundOn;
            }
        },
        {
            name: "SET UP VCR RESOLUTION",
            type: "toggle",
            values: ["x1", "x0.75", "x0.5", "x0.3"],
            factors: [1.0, 0.75, 0.51, 0.28],
            getValue: (state) => state.currentResolutionIndex,
            action: (state, direction) => {
                // WAŻNA ZMIANA INDEKSU! Było state.options[2], teraz jest [4]
                const option = state.options[4];
                state.currentResolutionIndex += direction;
                if (state.currentResolutionIndex >= option.values.length) {
                    state.currentResolutionIndex = 0;
                }
                if (state.currentResolutionIndex < 0) {
                    state.currentResolutionIndex = option.values.length - 1;
                }
            }
        },
        {
            name: "SATURATION",
            type: "bars",
            maxBars: 6,
            getValue: (state) => state.saturationLevel,
            action: (state, direction) => {
                state.saturationLevel += direction;
                state.saturationLevel = Math.max(1, Math.min(6, state.saturationLevel));
            }
        },
        {
            name: "GAMMA",
            type: "bars",
            maxBars: 6,
            getValue: (state) => state.gammaLevel,
            action: (state, direction) => {
                state.gammaLevel += direction;
                state.gammaLevel = Math.max(1, Math.min(6, state.gammaLevel));
            }
        },
        {
            name: "VCR COLOR",
            type: "toggle",
            values: ["Y16", "Y28", "Y36", "Y48", "F56", "F94", "F128", "MAX"],
            steps: [9, 28, 36, 48, 56, 94, 128, 146],
            getValue: (state) => state.currentColorStepIndex,
            action: (state, direction) => {
                // WAŻNA ZMIANA INDEKSU! Było state.options[5], teraz jest [7]
                const option = state.options[7]; 
                
                state.currentColorStepIndex += direction;
                
                if (state.currentColorStepIndex >= option.values.length) {
                    state.currentColorStepIndex = 0;
                }
                if (state.currentColorStepIndex < 0) {
                    state.currentColorStepIndex = option.values.length - 1;
                }
                
                const newStepValue = option.steps[state.currentColorStepIndex];
                RetroShaderWebGL.colorStep = newStepValue;
            }
        }
    ]
};
const oilCapState = {
    // Bazowe właściwości (ZMIENIONO NAZWY)
    x: 985,
    y: 280,
    width: 130,
    height: 86,

    // Stan animacji (serce logiki)
    unscrewProgress: 0.0,    // 0.0 = wkręcony, 1.0 = odkręcony, >1.0 znika
    maxUnscrewProgress: 1.1, // Wartość, przy której korek jest już całkowicie niewidoczny

    // Dynamiczne właściwości, obliczane w każdej klatce
    currentY: 280,
    currentAngle: 0,
    isVisible: true,
    
    // Parametry konfiguracyjne animacji
    wobbleFrequency: 45,      // Częstotliwość chybotania (szybkość)
    wobbleAmplitude: 0.15,    // Jak bardzo się chybocze (w radianach)
    maxOffsetY: -40,         // Jak wysoko unosi się korek (wartość ujemna = w górę)
    scrollSensitivity: 0.00007  // Czułość scrolla (mniejsza wartość = wolniejsze odkręcanie)
};

const viewTransitionState = {
    isActive: false,       // Musi być `false`
    phase: 'in',
    progress: 1.0,         // Musi być `1.0` (pełna czerń)
    speed: 0.5,            // Ta wartość kontroluje, JAK SZYBKO się rozjaśni po 2 sekundach
    targetView: 'cockpit'
};

function updateIntroAnimation(deltaTime) {
    if (!introAnimationState.isActive) {
        return;
    }

    introAnimationState.timer += deltaTime;
    
    // --- Logika opóźnienia ---
    // Ten warunek sprawi, że przez pierwsze 2 sekundy (zgodnie z fadeInDelay)
    // nic się nie stanie z rozjaśnianiem.
    if (introAnimationState.timer >= introAnimationState.fadeInDelay && !viewTransitionState.isActive) {
        // Dopiero po 2 sekundach aktywujemy mechanizm rozjaśniania.
        viewTransitionState.isActive = true; 
    }
    
    // Reszta funkcji działa normalnie w tle (nawet gdy ekran jest czarny)
    const progress = Math.min(1.0, introAnimationState.timer / introAnimationState.duration);
    
    const simulatedDeltaTime = deltaTime * introAnimationState.speedMultiplier;
    const currentSimulatedSpeed = introAnimationState.targetSpeedKmH * progress * 3;
    
    updateWorldObjects(simulatedDeltaTime, currentSimulatedSpeed);
    
    gameState.speedKmH = introAnimationState.targetSpeedKmH * progress;
    gameState.rpm = calculateRpmForSpeed(gameState.speedKmH, '2');

    if (progress >= 1.0) {
        introAnimationState.isActive = false;
        gameState.speedKmH = introAnimationState.targetSpeedKmH;
        gameState.gear = '2';
    }
}

const engineViewState = {
    // Dla stanu "pracujący" (drganie)
    shakeTime: 0,
    shakeOffsetX: 0,

    // Dla stanu "przegrzany" (dym i znikanie)
    smokeParticles: [],
    lastSmokeSpawn: 0,
    smokeSpawnInterval: 0.05, // Co ile sekund tworzyć nową cząstkę dymu

    fadeTimer: 0,
    fadeDuration: 2.5, // Czas trwania animacji znikania w sekundach
    engineScale: 1.0,
    engineAlpha: 1.0,
};

const trunkWheelState = {
    // Pozycja i wymiary na ekranie (dostosuj do własnych potrzeb)
    x: 526,
    y: 750,
    width: 931,
    height: 352,

    // Stan interakcji
    isHovered: false,
    
    // Właściwości animacji (takie same jak dla oleju)
    currentScale: 1.0,
    currentAngle: 0.0,
    isVisible: true,
    
    targetScale: 1.0,
    targetAngle: 0.0,
    
    swayTime: 0,
    swayFrequency: 8.0,
    swayAmplitude: 0.04,
    easeFactor: 0.1
};

const trunkBeerState = {
    // Pozycja i wymiary w bagażniku (dostosuj według potrzeb)
    x: 300,
    y: 150,
    width: 653,  // Szerokość obrazka beerbase.png
    height: 528, // Wysokość obrazka beerbase.png

    // Stan interakcji (identyczny jak dla oleju)
    isHovered: false,
    
    // Właściwości animacji
    currentScale: 1.0,
    currentAngle: 0, // Lekko przechylone dla naturalnego wyglądu
    isVisible: true,    // Zawsze widoczne, zgodnie z poleceniem
    
    targetScale: 1.0,
    targetAngle: 0,
    
    swayTime: 0,
    swayFrequency: 8.0,
    swayAmplitude: 0.04,
    easeFactor: 0.1
};

const heldBeerState = {
    isHeld: false,      // Czy gracz aktualnie trzyma butelkę piwa
    x: 0,
    y: 0,
    width: 159,         // Szerokość obrazka beer.png (dostosuj)
    height: 530,        // Wysokość obrazka beer.png (dostosuj)
    
    scale: 1.0,           // Aktualna skala, będzie dynamicznie obliczana
    baseScale: 0.8,       // Skala, gdy myszka jest na górze ekranu (w kokpicie)
    maxScale: 2.1,        // Skala, gdy myszka jest na dole ekranu (w kokpicie)

    // Fizyka bujania (bez zmian)
    angle: 0,
    angleVelocity: 0,
    stiffness: 0.004,
    damping: 0.78,
    flickFactor: 0.0008,
    scrollTiltAmount: -0.015,
    lastMouseX: 0,

    // Właściwości do animacji picia
    isDrinking: false,      // Czy trwa animacja picia
    fadeProgress: 0.0,      // Postęp zanikania (0.0 do 1.0)
    fadeDuration: 1.5,      // Czas trwania animacji w sekundach

    // --- NOWY KOD: Licznik kliknięć na piwo ---
    drinkCount: 0,          // Liczy, ile razy kliknięto na trzymane piwo
    // --- KONIEC NOWEGO KODU ---
};

// NOWY KOD: Stan dla koła trzymanego przy myszce
const heldWheelState = {
    isHeld: false,
    x: 0,
    y: 0,
    width: 876,         // Szerokość obrazka wheel.png (dostosuj)
    height: 852,        // Wysokość obrazka wheel.png (dostosuj)

    // Fizyka bujania (skopiowana z heldOilState)
    angle: 0,
    angleVelocity: 0,
    stiffness: 0.01,
    damping: 0.78,
    flickFactor: 0.0011,
    scrollTiltAmount: -0.015,
    lastMouseX: 0,
};

const heldOilState = {
    isHeld: false,      // Czy gracz aktualnie trzyma butelkę
    x: 0,               // Pozycja X (śledzi myszkę)
    y: 0,               // Pozycja Y (śledzi myszkę)
    width: 380,         // Szerokość obrazka oilbottle.png (dostosuj, jeśli trzeba)
    height: 540,        // Wysokość obrazka oilbottle.png (dostosuj, jeśli trzeba)
    
    // --- FIZYKA BUJANIA ---
    angle: 0,                   // Aktualny kąt obrotu
    angleVelocity: 0,           // Aktualna prędkość kątowa (jak szybko się obraca)
    stiffness: 0.004,            // Sztywność "sprężyny" - jak mocno wraca do pionu
    damping: 0.78,              // Tłumienie - jak szybko wytraca prędkość (0.9-0.99)
    flickFactor: 0.0011,        // Mnożnik siły "pchnięcia". Znacznie zmniejszyłem tę wartość!
    
    // --- NOWA WŁAŚCIWOŚĆ ---
    scrollTiltAmount: -0.015,      // Siła "pchnięcia" przy scrollowaniu (w radianach)
    // --- KONIEC NOWEJ WŁAŚCIWOŚCI ---

    lastMouseX: 0,      // Ostatnia pozycja myszki do obliczenia "pchnięcia"
};

const trunkOilState = {
    // Pozycja i wymiary na ekranie
    x: 10,
    y: 350,
    width: 364,
    height: 509,

    // Stan interakcji
    isHovered: false,
    
    // Właściwości animacji (dążą do wartości docelowych)
    currentScale: 1.0,
    currentAngle: 0.4,
    isVisible: true, // <-- DODAJ TĘ LINIĘ
    
    // Wartości docelowe (zmieniają się w zależności od najechania myszą)
    targetScale: 1.0,
    targetAngle: 0.0,
    
    // Parametry animacji
    swayTime: 0,              // Timer do animacji kołysania
    swayFrequency: 8.0,       // Szybkość kołysania
    swayAmplitude: 0.04,      // Zakres kołysania (w radianach)
    easeFactor: 0.1           // Płynność animacji (większa wartość = szybsza)
};

const RetroShaderWebGL = {

    // --- KONFIGURACJA EFEKTU ---
    pixelationFactor: 1 + Math.random() * 0.2,
    colorStep: 9, // <--- POPRAWIONA WARTOŚĆ (zgodna z Y16)


    // --- NOWOŚĆ: Właściwości dla efektu VHS ---
    vhsEffectStrength: 0.0,
    // ---> DODAJ TĘ LINIĘ <---
    fisheyeStrength: 0.0,         // Siła efektu "rybiego oka" (kineskopu)
    // ---> KONIEC NOWEGO KODU <---
    time: 0.0,
    vhsBlurFlicker: 1.0,
    vhsHighlightWobble: 0.0,
    vhsMixOscillation: 0.0,

    _bayerMatrix: [
        [  0,  8,  2, 10 ],
        [ 12,  4, 14,  6 ],
        [  3, 11,  1,  9 ],
        [ 15,  7, 13,  5 ]
    ],

    _gl: null, _program: null, _texture: null, _vertexBuffer: null, _locations: {},

    _createShader(type, source) {
        const shader = this._gl.createShader(type);
        this._gl.shaderSource(shader, source);
        this._gl.compileShader(shader);
        if (!this._gl.getShaderParameter(shader, this._gl.COMPILE_STATUS)) {
            console.error('Błąd kompilacji shadera:', this._gl.getShaderInfoLog(shader));
            this._gl.deleteShader(shader);
            return null;
        }
        return shader;
    },

    _init(glContext) {
        this._gl = glContext;
        const gl = this._gl;

        const vsSource = `
            attribute vec2 a_position;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_position * 0.5 + 0.5;
            }
        `;

        // --- ZMIANA: Zaktualizowany fragment shader (fsSource) ---
        const fsSource = `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_texture;
    uniform vec2 u_resolution;
    uniform float u_pixelationFactor;
    uniform float u_colorSteps;
    uniform mat4 u_bayerMatrix;
    uniform float u_shaderScaleFactor;
    
    // Zmienne do kontroli efektu VHS
    uniform float u_time;
    uniform float u_vhsEffectStrength;
    uniform float u_vhsBlurFlicker;
    uniform float u_vhsHighlightWobble;
    uniform float u_vhsMixOscillation;

    // ---> NOWY KOD: Uniform dla efektu rybiego oka <---
    uniform float u_fisheyeStrength;

    // Uniformy dla saturacji i gammy
    uniform float u_saturation;
    uniform float u_gamma;

    uniform bool u_scanlinesOn;
    uniform bool u_ditheringOn;

    float getBayerValue(int x, int y) {
        if (x == 0) {
            if (y == 0) return u_bayerMatrix[0][0]; if (y == 1) return u_bayerMatrix[0][1]; if (y == 2) return u_bayerMatrix[0][2]; if (y == 3) return u_bayerMatrix[0][3];
        }
        if (x == 1) {
            if (y == 0) return u_bayerMatrix[1][0]; if (y == 1) return u_bayerMatrix[1][1]; if (y == 2) return u_bayerMatrix[1][2]; if (y == 3) return u_bayerMatrix[1][3];
        }
        if (x == 2) {
            if (y == 0) return u_bayerMatrix[2][0]; if (y == 1) return u_bayerMatrix[2][1]; if (y == 2) return u_bayerMatrix[2][2]; if (y == 3) return u_bayerMatrix[2][3];
        }
        if (x == 3) {
            if (y == 0) return u_bayerMatrix[3][0]; if (y == 1) return u_bayerMatrix[3][1]; if (y == 2) return u_bayerMatrix[3][2]; if (y == 3) return u_bayerMatrix[3][3];
        }
        return 0.0;
    }

    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.54535);
    }

    void main() {
        vec2 sampleCoord = v_texCoord;

        // ---> NOWY KOD: Aplikowanie efektu rybiego oka (kineskopu) <---
        // Robimy to na samym początku, aby wszystkie kolejne efekty
        // operowały już na zniekształconym obrazie.
        if (u_fisheyeStrength > 0.0) {
            vec2 center = vec2(0.5, 0.5);
            vec2 toCenter = center - sampleCoord;
            float dist = length(toCenter);
            float distortionFactor = 1.0 - pow(dist, 2.0) * u_fisheyeStrength;

            // Przesuwamy koordynaty w stronę środka
            sampleCoord = center - toCenter * distortionFactor;
            
            // Zapobiegamy błędom przy krawędziach
            sampleCoord = clamp(sampleCoord, 0.0, 1.0);
        }

        // Efekt Glitch (działa teraz na zniekształconych koordynatach)
        if (u_vhsEffectStrength > 0.0) {
            float glitchAmount = 0.0;
            if (random(vec2(floor(u_time * 10.0), 1.0)) > 0.99) {
                glitchAmount = (random(vec2(v_texCoord.y, u_time)) - 0.5) * 0.1;
            }
            glitchAmount += (sin(sampleCoord.y * 300.0 + u_time * 25.0) * 0.02);
            sampleCoord.x += glitchAmount * u_vhsEffectStrength;
        }

        vec2 smallRes = u_resolution * u_pixelationFactor;
        vec2 pixelCoord = floor(v_texCoord * smallRes);
        vec2 finalSampleCoord = (pixelCoord + 0.8) / smallRes; // Używamy oryginalnych koordynat do pixelizacji
        
        vec4 originalColor = texture2D(u_texture, sampleCoord); // Ale próbkę koloru pobieramy ze zniekształconych
        
        float ditherFactor = 0.0;
        if (u_ditheringOn) {
            int x = int(mod(pixelCoord.x, 4.0));
            int y = int(mod(pixelCoord.y, 4.0));
            float bayerValue = getBayerValue(x, y);
            if (u_shaderScaleFactor < 0.55) {
                ditherFactor = (bayerValue / 16.0 - 0.5) * (1.0 / 255.0); 
            } else {
                ditherFactor = (bayerValue / 16.0 - 0.5) * (20.0 / 255.0);
            }
        }
        
        vec3 ditheredColor = originalColor.rgb + ditherFactor;
        vec3 quantizedColor = floor(ditheredColor * u_colorSteps + 0.5) / u_colorSteps;
        vec3 finalColor = quantizedColor;

 if (u_scanlinesOn) { 
            // Warunek zależy już tylko od opcji scanlines.
            
            // Obliczamy widoczność scanline (ciemniejsza co drugą linię).
            // mod(floor(gl_FragCoord.y), 2.0) da 0.0 dla parzystych i 1.0 dla nieparzystych pikseli.
            float scanlineVisibility = mod(floor(gl_FragCoord.y), 2.0);

            // Definiujemy stałą intensywność, zamiast polegać na u_vhsEffectStrength.
            // Możesz dostosować tę wartość (np. od 0.1 do 0.5), aby zmienić moc efektu.
            float scanlineIntensity = 0.041; 

            // Przyciemniamy kolor co drugą linię, mnożąc go przez wartość mniejszą od 1.
            finalColor.rgb *= (1.0 - scanlineVisibility * scanlineIntensity);
        }
        
        if (u_vhsEffectStrength > 0.1) {
            vec4 sum = vec4(0.0);
            float blurSize = u_vhsEffectStrength * 0.0015 * u_vhsBlurFlicker;
            sum += texture2D(u_texture, sampleCoord + vec2(-1.0, -1.0) * blurSize) * 0.25;
            sum += texture2D(u_texture, sampleCoord + vec2(1.0, -1.0) * blurSize) * 0.25;
            sum += texture2D(u_texture, sampleCoord + vec2(-1.0, 1.0) * blurSize) * 0.25;
            sum += texture2D(u_texture, sampleCoord + vec2(1.0, 1.0) * blurSize) * 0.25;
            float mixFactorOffset = (u_vhsMixOscillation * 0.1) - 0.05;
            float finalMixFactor = u_vhsEffectStrength * 0.5 + mixFactorOffset;
            finalColor = mix(finalColor, sum.rgb, clamp(finalMixFactor, 0.0, 1.0));
        }

        // ---> NOWY KOD: Aplikowanie winiety (przyciemnienia krawędzi) <---
        if (u_fisheyeStrength > 0.0) {
             // Używamy oryginalnych koordynat v_texCoord do obliczenia odległości od środka
             float vignette = 1.0 - pow(length(v_texCoord - 0.5) * 1.1, 2.5);
             finalColor.rgb *= vignette;
        }

        float luma = dot(finalColor.rgb, vec3(0.299, 0.587, 0.114));
        finalColor.rgb = mix(vec3(luma), finalColor.rgb, u_saturation);
        finalColor.rgb = pow(finalColor.rgb, vec3(1.0 / u_gamma));

        gl_FragColor = vec4(finalColor, originalColor.a);
    }
`;

        const vertexShader = this._createShader(gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this._createShader(gl.FRAGMENT_SHADER, fsSource);

        this._program = gl.createProgram();
        gl.attachShader(this._program, vertexShader);
        gl.attachShader(this._program, fragmentShader);
        gl.linkProgram(this._program);

        if (!gl.getProgramParameter(this._program, gl.LINK_STATUS)) {
            console.error('Błąd linkowania programu:', gl.getProgramInfoLog(this._program));
            return;
        }

        this._locations = {
            position: gl.getAttribLocation(this._program, 'a_position'),
            texture: gl.getUniformLocation(this._program, 'u_texture'),
            resolution: gl.getUniformLocation(this._program, 'u_resolution'),
            pixelationFactor: gl.getUniformLocation(this._program, 'u_pixelationFactor'),
            colorSteps: gl.getUniformLocation(this._program, 'u_colorSteps'),
            bayerMatrix: gl.getUniformLocation(this._program, 'u_bayerMatrix'),
            shaderScaleFactor: gl.getUniformLocation(this._program, 'u_shaderScaleFactor'),
            
            time: gl.getUniformLocation(this._program, 'u_time'),
            vhsEffectStrength: gl.getUniformLocation(this._program, 'u_vhsEffectStrength'),
            blurFlicker: gl.getUniformLocation(this._program, 'u_vhsBlurFlicker'),
            highlightWobble: gl.getUniformLocation(this._program, 'u_vhsHighlightWobble'),
            mixOscillation: gl.getUniformLocation(this._program, 'u_vhsMixOscillation'),

            saturation: gl.getUniformLocation(this._program, 'u_saturation'),
            gamma: gl.getUniformLocation(this._program, 'u_gamma'),

            scanlinesOn: gl.getUniformLocation(this._program, 'u_scanlinesOn'),
            ditheringOn: gl.getUniformLocation(this._program, 'u_ditheringOn'),
            // ---> DODAJ TĘ LINIĘ <---
            fisheyeStrength: gl.getUniformLocation(this._program, 'u_fisheyeStrength'),
        };

        this._vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);
        const positions = [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        this._texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    },

    apply(mainCtx, glCtx) {
        if (!this._gl) { this._init(glCtx); }
        
        const gl = this._gl;
        const gameCanvas = mainCtx.canvas;
        const w = gameCanvas.width;
        const h = gameCanvas.height;
        
        gl.useProgram(this._program);

        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gameCanvas);
        
        gl.uniform1i(this._locations.texture, 0);
        gl.uniform2f(this._locations.resolution, w, h);
        gl.uniform1f(this._locations.pixelationFactor, this.pixelationFactor);
        gl.uniform1f(this._locations.colorSteps, 255.0 / this.colorStep);
        
        const flattenedMatrix = this._bayerMatrix.flat();
        gl.uniformMatrix4fv(this._locations.bayerMatrix, false, flattenedMatrix);
        
        gl.uniform1f(this._locations.shaderScaleFactor, shaderScaleFactor);
        
        gl.uniform1f(this._locations.time, this.time);
        gl.uniform1f(this._locations.vhsEffectStrength, this.vhsEffectStrength);
        
        gl.uniform1f(this._locations.blurFlicker, this.vhsBlurFlicker);
        gl.uniform1f(this._locations.highlightWobble, this.vhsHighlightWobble);
        gl.uniform1f(this._locations.mixOscillation, this.vhsMixOscillation);
        
        // ---> DODAJ TĘ LINIĘ <---
        gl.uniform1f(this._locations.fisheyeStrength, this.fisheyeStrength);

        gl.uniform1i(this._locations.scanlinesOn, vhsMenuState.areScanlinesOn);
        gl.uniform1i(this._locations.ditheringOn, vhsMenuState.isDitheringOn);

        const saturationLevel = vhsMenuState.saturationLevel;
        const gammaLevel = vhsMenuState.gammaLevel;
        const shaderSaturation = (saturationLevel - 1) * (2.0 / 5.0); 
        const shaderGamma = 1.0 + (gammaLevel - 3) * 0.15;

        gl.uniform1f(this._locations.saturation, shaderSaturation);
        gl.uniform1f(this._locations.gamma, shaderGamma);

        gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);
        gl.enableVertexAttribArray(this._locations.position);
        gl.vertexAttribPointer(this._locations.position, 2, gl.FLOAT, false, 0, 0);
        
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
};

const vhsDynamics = {
    // Timer dla losowej zmiany rozmycia (blur)
    blurFlickerTimer: 0.0,
    blurFlickerInterval: 0.02, // Zmiana co 0.1 sekundy

    // Aktualne wartości, które będziemy wysyłać do shadera
    blurFlickerValue: 1.0,      // Mnożnik dla siły rozmycia
    highlightWobbleValue: 0.0,  // Wartość do "bujania" podświetlenia
    mixOscillationValue: 0.0    // Wartość do oscylacji mieszania kolorów
};

/**
 * NOWA FUNKCJA: Aktualizuje wartości dla dynamicznych efektów VHS.
 * Należy ją wywoływać w głównej pętli gry (np. w updateGameState).
 * @param {number} deltaTime - Czas, jaki upłynął od ostatniej klatki.
 * @param {number} totalTime - Całkowity czas działania aplikacji (używany do płynnych animacji).
 */

// =======================================================================
// === OSTATECZNA, POPRAWIONA WERSJA: Funkcja aktualizująca efekty wizualne ===
// =======================================================================
/**
 * Aktualizuje stan wizualnych efektów upojenia (zoom i bujanie) w każdej klatce.
 */

function updateBlinkEffect(deltaTime) {
    // Jeśli animacja jest aktywna, aktualizujemy jej postęp
    if (blinkState.isActive) {
        blinkState.progress += deltaTime / blinkState.duration;
        
        // Jeśli animacja się zakończyła
        if (blinkState.progress >= 1.0) {
            blinkState.isActive = false;
            blinkState.progress = 0.0;
        }
    } 
    // W przeciwnym razie odliczamy czas do następnego mrugnięcia
    else {
        blinkState.timer += deltaTime;
        if (blinkState.timer >= blinkState.interval) {
            blinkState.timer = 0;          // Resetujemy główny timer
            blinkState.isActive = true;    // Uruchamiamy animację
            blinkState.progress = 0.0;     // Resetujemy postęp animacji
        }
    }
}

/**
 * Rysuje na ekranie efekt mrugania ("powieki").
 * Należy ją wywołać na samym końcu pętli renderującej, aby znalazła się na wierzchu.
 */
function drawBlinkEffect() {
    // Rysujemy tylko, gdy animacja jest aktywna
    if (!blinkState.isActive) {
        return;
    }

    // Obliczamy postęp animacji z efektem "ease-in-out" (dzięki funkcji sinus)
    const easedProgress = Math.sin(blinkState.progress * Math.PI);

    // --- NOWE ZMIENNE DO KONFIGURACJI EFEKTU ---
    // Mnożnik > 1.0 sprawi, że powieki na siebie najdą w środku animacji.
    // Wartość 1.1 oznacza, że każda powieka pokryje 10% więcej niż połowę ekranu.
    const overlapFactor = 1.1; 
    
    // Jak bardzo maksymalnie mają być wygięte powieki (w pikselach).
    // Większa wartość = głębsza krzywa.
    const maxCurvature = canvas.height * 0.2; 
    
    // Obliczamy aktualne "pokrycie" ekranu przez powieki
    const eyelidCoverage = (canvas.height / 2) * overlapFactor;
    const eyelidHeight = eyelidCoverage * easedProgress;

    // Obliczamy aktualną krzywiznę. Im bliżej zamknięcia (easedProgress -> 1.0),
    // tym mniejsza krzywizna (płaska linia).
    const currentCurvature = maxCurvature * (1 - easedProgress);

    // Margines bezpieczeństwa (bez zmian)
    const zoomFactor = MIN_PIXELATION; 
    const overdrawWidth = canvas.width / zoomFactor;
    const overdrawX = (canvas.width - overdrawWidth) / 2;

    ctx.save();
    ctx.fillStyle = 'black';
    ctx.filter = `blur(${blinkState.blurAmount}px)`;

    // --- NOWA LOGIKA RYSUJĄCA KSZTAŁT POWIEK ---

    // Rysowanie górnej powieki
    ctx.beginPath();
    ctx.moveTo(overdrawX, 0); // Zaczynamy w lewym górnym rogu
    ctx.lineTo(overdrawX + overdrawWidth, 0); // Linia do prawego górnego rogu
    ctx.lineTo(overdrawX + overdrawWidth, eyelidHeight); // Linia w dół do krawędzi powieki
    // Rysujemy krzywą z powrotem do lewej strony.
    // Punkt kontrolny jest "nad" krawędzią powieki, co powoduje jej wygięcie do wewnątrz.
    ctx.quadraticCurveTo(canvas.width / 2, eyelidHeight - currentCurvature, overdrawX, eyelidHeight);
    ctx.closePath(); // Zamykamy kształt
    ctx.fill();

    // Rysowanie dolnej powieki
    ctx.beginPath();
    ctx.moveTo(overdrawX, canvas.height); // Zaczynamy w lewym dolnym rogu
    ctx.lineTo(overdrawX + overdrawWidth, canvas.height); // Linia do prawego dolnego rogu
    ctx.lineTo(overdrawX + overdrawWidth, canvas.height - eyelidHeight); // Linia w górę do krawędzi powieki
    // Rysujemy krzywą z powrotem do lewej strony.
    // Punkt kontrolny jest "pod" krawędzią powieki, co powoduje jej wygięcie do wewnątrz.
    ctx.quadraticCurveTo(canvas.width / 2, canvas.height - eyelidHeight + currentCurvature, overdrawX, canvas.height - eyelidHeight);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
}

function updateStanUpojenia(deltaTime) {
    // === SEKCJA ZOOMU (płynna animacja przybliżenia) ===
    const docelowyZoom = stanUpojenia.docelowyZoom;
    const aktualnyZoom = stanUpojenia.aktualnyZoom;
    const progZatrzymania = 0.0001;

    if (Math.abs(docelowyZoom - aktualnyZoom) > progZatrzymania) {
        stanUpojenia.aktualnyZoom += (docelowyZoom - aktualnyZoom) * stanUpojenia.wspolczynnikWygładzania;
    } else if (aktualnyZoom !== docelowyZoom) {
        stanUpojenia.aktualnyZoom = docelowyZoom;
    }

    // === SEKCJA BUJANIA I "PODWÓJNEGO WIDZENIA" ===
    const maxPiwDlaEfektu = 10.0; // Po 10 piwach efekt osiąga maksimum
    const postep = Math.min(1.0, stanUpojenia.liczbaWypitychPiw / maxPiwDlaEfektu);

    // Bujanie obrazu (lewo-prawo)
    const maxAmplitudaBujania = 0.034;
    const maxCzestotliwoscBujania = 1.94

    stanUpojenia.amplitudaBujania = postep * maxAmplitudaBujania;
    stanUpojenia.czestotliwoscBujania = 1.0 + postep * (maxCzestotliwoscBujania - 1.0);

    stanUpojenia.czasBujania += deltaTime;
    stanUpojenia.aktualnyKatBujania = Math.sin(stanUpojenia.czasBujania * stanUpojenia.czestotliwoscBujania) * stanUpojenia.amplitudaBujania;
    
    // --- ZMIANA: Aktualizacja parametrów dla efektu "podwójnego widzenia" ---
    // Definiujemy maksymalne wartości dla efektu.
    const maxBlurAlpha = 0.48;        // Zmniejszona maksymalna przezroczystość "ducha" (było 0.6)
    const maxBlurRotationSpeed = 2.2; // Prędkość obrotu w radianach na sekundę
    const maxBlurOffsetRadius = 35;   // Zmniejszona maksymalna odległość od środka w pikselach (było 25)

    // Skalujemy wszystkie parametry na podstawie tego samego postępu picia.
    stanUpojenia.blurAlpha = postep * maxBlurAlpha;
    stanUpojenia.blurRotationSpeed = postep * maxBlurRotationSpeed;
    stanUpojenia.blurOffsetRadius = postep * maxBlurOffsetRadius;

    // Inkrementujemy kąt obrotu w każdej klatce, co tworzy ciągły, płynny ruch po okręgu.
    stanUpojenia.blurRotationAngle += stanUpojenia.blurRotationSpeed * deltaTime;
}
function updateVhsDynamics(deltaTime, totalTime) {
    // 1. Aktualizacja losowego migotania rozmycia (blur)
    vhsDynamics.blurFlickerTimer += deltaTime;
    if (vhsDynamics.blurFlickerTimer >= vhsDynamics.blurFlickerInterval) {
        vhsDynamics.blurFlickerTimer -= vhsDynamics.blurFlickerInterval;
        // Ustawiamy nową, lekko losową wartość (np. w zakresie od 0.9 do 1.1)
        vhsDynamics.blurFlickerValue = 1.0 + (Math.random() - 0.5) * 0.45;
    }

    // 2. Aktualizacja stałej, delikatnej zmiany podświetlenia (highlight)
    // Używamy funkcji sinus dla gładkiego, stałego ruchu
    vhsDynamics.highlightWobbleValue = Math.sin(totalTime * 0.1) *0.7; // Mała amplituda dla subtelnego efektu (TO MOŻE BYĆ EFEKT CIENIA)

    // 3. Aktualizacja stałej oscylacji mieszania (mix)
    // Sinus zwraca wartości od -1 do 1. Przekształcamy to na zakres od 0 do 1.
    const sinValue = Math.sin(totalTime * 3.0); // Używamy innej prędkości dla urozmaicenia
    vhsDynamics.mixOscillationValue = (sinValue + 1.0) / 3.0; // Teraz wartość jest w zakresie [0, 1]

    // Przekazanie zaktualizowanych wartości do obiektu shadera
    RetroShaderWebGL.vhsBlurFlicker = vhsDynamics.blurFlickerValue;
    RetroShaderWebGL.vhsHighlightWobble = vhsDynamics.highlightWobbleValue;
    RetroShaderWebGL.vhsMixOscillation = vhsDynamics.mixOscillationValue;
}

// ---> KONIEC KODU DO WKLEJENIA <---


let pixelationTimer = 0;
let pixelationDirection = 1; // 1 = powiększanie (wartość rośnie), -1 = zmniejszanie (wartość maleje)
const PIXELATION_INTERVAL = 0.4; // Co ile sekund ma następować zmiana (0.3s)
const PIXELATION_STEP = 0.01;     // O ile ma się zmieniać wartość
const MIN_PIXELATION = 0.91;      // Minimalna wartość
const MAX_PIXELATION = 1.0      // Maksymalna wartość

// Pomocnicze płótno (canvas) do tworzenia efektu motion blur.
const motionBlurCanvas = document.createElement('canvas');
const motionBlurCtx = motionBlurCanvas.getContext('2d');

// --- POPRAWIONY OBIEKT LUSTERKA WSTECZNEGO ---
// 1. Stworzenie niewidocznego płótna (bufora) dla widoku w lusterku.
const detailCanvas = document.createElement('canvas');
const detailCtx = detailCanvas.getContext('2d');


const STARTING_DISTANCE_METERS = 0;


const introAnimationState = {
    isActive: true, 
    duration: 4,  // Całkowity czas intro (możesz go wydłużyć, jeśli chcesz)
    timer: 0.0,
    fadeInDelay: 4, // <-- TUTAJ WPISZ 2.0. To jest czas trwania czarnego ekranu.
    
    targetDistanceMeters: 0,
    targetSpeedKmH: 30,

    simulatedSpeed: 0,
    speedMultiplier: 0
};


// KONFIGURACJA DROGOWSKAZÓW
const signsToSpawn = [
  { distance: 10, imageSrc: 'sign1.png', side: 'right' },
  { distance: 40, imageSrc: 'sign90.png', side: 'right' },
  { distance: 2970, imageSrc: 'sign2.png', side: 'right' },
  { distance: 3360, imageSrc: 'sign3.png', side: 'left' },
  { distance: 3395, imageSrc: 'sign90.png', side: 'right' },
];

// KONFIGURACJA STREF MIEJSKICH
const cityZones = [
    { startDistance: 3000, endDistance: 3250 },
    { startDistance: 25000, endDistance: 33000 },
];

const GEARS = ['N', '1', '2', '3', '4'];

// Inicjalizacja canvas
function initCanvas() {
  // Stała, wysoka rozdzielczość wewnętrzna dla jakości gry (źródło dla shadera)
  const renderWidth = 1920;
  const renderHeight = 1080;

  // 1. Canvas gry (2D) ZAWSZE renderuje w pełnej rozdzielczości.
  // To jest nasze wysokiej jakości źródło.
  gameCanvas.width = renderWidth;
  gameCanvas.height = renderHeight;

  // 2. Canvas shadera (WebGL) ma OBNIŻONĄ rozdzielczość wewnętrzną.
  // To tutaj dzieje się magia optymalizacji!
shaderCanvas.width = renderWidth * shaderScaleFactor;
shaderCanvas.height = renderHeight * shaderScaleFactor;

  // 3. Ustaw styl CSS canvasu shadera, aby WYPEŁNIAŁ całe dostępne miejsce.
  // Przeglądarka automatycznie go przeskaluje (rozciągnie) w górę.
  // To kluczowe, aby efekt był widoczny na całym ekranie.
  shaderCanvas.style.width = "100%";
  shaderCanvas.style.height = "100%";
  // Upewnij się, że w HTML/CSS shaderCanvas ma position: absolute i zajmuje cały ekran.

  // 4. Ustaw viewport dla WebGL na NOWĄ, mniejszą rozdzielczość.
  // Twój kod już to robi dobrze, bo bazuje na gl.canvas.width/height.
  if (gl) {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  }
  
  // Reszta twojej logiki pozostaje bez zmian
  if (window.updateButtonPositions) {
    window.updateButtonPositions();
  }

}

// Zmieniamy listenery na końcu pliku:
// Stary listener (usuń go):
// window.addEventListener('resize', initCanvas);

// Listener dla przycisków pozostaje bez zmian:
window.addEventListener('resize', updateButtonPositions);

// Wywołaj initCanvas tylko raz na starcie
window.addEventListener('load', () => {
    // 1. Inicjalizacja gry (bez tworzenia ekranu ładowania)
    initCanvas();
    createMapButton();
    createPhotoButton();
    createCarSignButton();
    updateButtonPositions();
    
    // UWAGA: Ta funkcja MUSI być wywołana PRZED pętlą sprawdzającą,
    // jeśli tworzy obiekty, których zasoby są śledzone.
    if (typeof initializeWorldState === 'function') {
        initializeWorldState(STARTING_DISTANCE_METERS);
    } else {
        console.warn("Funkcja initializeWorldState nie została znaleziona.");
    }
    
    // 2. Rozpocznij sprawdzanie, czy można już uruchomić grę
    const czasStartu = Date.now();
    const minimalnyCzasLadowania = 2000; // 2 sekundy

    function sprawdzStanLadowania() {
        const uplyneloWystarczajacoCzasu = (Date.now() - czasStartu) >= minimalnyCzasLadowania;
        
        if (menedzerZasobow.wszystkoZaladowane && uplyneloWystarczajacoCzasu) {
            rozpocznijGre();
        } else {
            requestAnimationFrame(sprawdzStanLadowania);
        }
    }
    
    requestAnimationFrame(sprawdzStanLadowania);
});

// --- ZMIANA: Przebudowany stan zegara na ramieniu z obsługą animacji ---
const armClockState = {
    isShownTarget: false,       // Czy ma być pokazany (sterowane przez klawisz 'u')
    animationProgress: 0.0,     // Postęp animacji (0.0 - schowany, 1.0 - pokazany)
    animationSpeed: 3.5,        // Szybkość animacji (większa wartość = szybsza animacja)

     scale: 1,
    // Parametry animacji
    startPosition: { x: -40, y: 1500 }, // Pozycja startowa (za ekranem na dole)
    endPosition: { x: -50, y: 700 },    // Pozycja końcowa (na ekranie)
    startAngle: 0.6,                    // Kąt startowy (w radianach, lekko w prawo)
    endAngle: -0.2,                    // Kąt końcowy (w radianach, lekko w lewo)
    pivot: { x: 140, y: 380 },          // Punkt obrotu względem lewego górnego rogu obrazka `arm.png`

    // --- NOWA LOGIKA: Stan dla naturalnego drgania ramienia ---
    swayTime: 0.0,                      // Wewnętrzny timer do generowania płynnego ruchu
    swayAngleOffset: 0.0,               // Aktualne chwilowe przesunięcie kąta
    swayPositionOffsetX: 0.0,           // Aktualne chwilowe przesunięcie pozycji X
    swayPositionOffsetY: 0.0,           // Aktualne chwilowe przesunięcie pozycji Y

    // Konfiguracja drgania (możesz dostosować te wartości)
    swayConfig: {
        angleAmplitude: 0.008,          // Jak bardzo ma się obracać (w radianach)
        angleFrequency: 2.5,            // Jak szybko ma się obracać
        positionAmplitude: 1.5,         // Jak bardzo ma się przesuwać (w pikselach)
        positionFrequency: 1.8          // Jak szybko ma się przesuwać
    },
    // --- KONIEC NOWEJ LOGIKI ---

    // Aktualne, obliczane co klatkę wartości
    currentPosition: { x: 350, y: 1100 },
    currentAngle: 0.4,

    // Wewnętrzny stan zegara
    mainClock: {
        hours: 6,
        minutes: 30
    },
    secondCounter: 0,
    distanceAccumulator: 0.0,

    // Pozycje względne tekstu zegara do obrazka arm.png
    relativeMainClockPos: { x: 734, y: 275 },
    relativeSecondsPos: { x: 781, y: 282 },

    // Czcionki i kolor
    mainClockFont: "31px 'DSDigi'",
    secondCounterFont: "12px 'DSDigi'",
    fontColor: "rgba(16, 49, 49, 0.7)"
};


// --- NOWY KOD: STAN LUSTERKA ---
const mirrorState = {
    isFlipped: false, // Czy lusterko jest w stanie "klikniętym"
    angle: 0,
    targetAngle: 0,
    velocity: 0,
    stiffness: 0.08,   // Sztywność "sprężyny" (jak szybko wraca)
    damping: 0.78,     // Tłumienie (jak szybko przestaje się bujać)

    opacity1: 1, // Krycie obrazu mirror.png
    opacity2: 0, // Krycie obrazu mirror2.png

    // Pozycja i wymiary lusterka na canvasie
    position: { x: 930, y: 126, width: 306, height: 120 },
};

// --- NOWY KOD: STAN NOWEJ KLAMKI LUSTERKA ---
const handleMirrorState = {
    position: { x: 384, y: 640, width: 65, height: 54 },
    angle: 0,
    sourceOffsetX: 0,
    sourceOffsetY: 0,
};

// --- NOWY KOD: STAN DLA PRZYCISKÓW button1.png i button2.png ---
const buttonState = {
    // Przycisk 1 (powiązany z 'z' - hazard)
    b1: {
        x: 590, y: 655, width: 71, height: 33, // Domyślna pozycja i wymiary
        offsetX: 0, targetOffsetX: 0,
        scale: 1, targetScale: 1,
        angle: 0, targetAngle: 0
    },
    // Przycisk 2 (powiązany z 'j')
    b2: {
        x: 590, y: 621, width: 71, height: 33, // Domyślna pozycja i wymiary
        offsetX: 0, targetOffsetX: 0,
        scale: 1, targetScale: 1,
        angle: 0, targetAngle: 0,
        isPressed: false // Wewnętrzny stan dla przycisku 'j'
    },
    // Wartości "wciśnięcia"
    pressedValues: {
        offsetX: 2,      // Przesunięcie w prawo
        angle: 0.04      // Obrót w prawo (w radianach)
    },
    easeFactor: 0.2 // Szybkość animacji
};


const odometerState = {
    targetValue: Math.floor(STARTING_DISTANCE_METERS / 100), 
    currentValue: Math.floor(STARTING_DISTANCE_METERS / 100), 
    displayDigits: String(Math.floor(STARTING_DISTANCE_METERS / 100)).padStart(5, '0').split(''),
    rollProgress: [0.0,0.0, 0.0, 0.0, 0.0],
    isRolling: [false, false, false, false, false],
    rollSpeed: 2.8, 
    rollHeight: 2.7, 
    position: { x: 1075, y: 735 }
};

const hangerState = {
  angle: 0,
  velocity: 0,
  anchorX: canvas.width / 2 + 953,
  anchorY: 220,
  length: 120,
  stiffness: 0.0074,
  damping: 0.973,
  isDragging: false,
  lastMouseX: 0
};

const shifterState = {
    x: canvas.width / 2 + 270,
    y: canvas.height - 250,    
    offsetX: 0,
    offsetY: 0,
    angle: 0,
    targetOffsetX: 0,
    targetOffsetY: 0,
    targetAngle: 0,
    shakeX: 0,
    shakeY: 0,
    shakeIntensity: 2.5
};

const windowState = {
    glassYOffset: 0, 
    glassTargetYOffset: 0, 
    isMoving: false, 
    buttonPosition: { x: 262, y: 880, width: 200, height: 200 }, 
    glassMaxDownOffset: 700, 
    glassMaxRotation: -0.43,
    handleIsFlipped: false,
    handleScrollAccumulator: 0,
    handleFlipThreshold: 40,
    handleScaleX: 1,
    handleTargetScaleX: 1,
    handleAnimationSpeed: 0.75
};

const radioState = {
    volume: 3, 
    isRewinding: false,
    rewindIntervalId: null,
    volumeButton: { x: 983, y: 937, width: 60, height: 60, color: "rgba(121, 121, 121, 0)"},
    rewindButton: { x: 1123, y: 937, width: 60, height: 60, color: "rgba(121, 121, 121, 0)"},
    imagePosition: { x: 983, y: 937, width: 195, height: 66 }, 
    opacity: 0,                   
    transitionDuration: 0.5,      
    transitionProgress: 0         
};

const lightsIndicatorState = {
    opacity: 0,
    transitionDuration: 0.4,
    transitionProgress: 0,
    imagePosition: { x: 767, y: 656, width: 190, height: 87 }
};

// --- NOWY KOD: STAN OŚWIETLENIA WNĘTRZA ---
const interiorLightState = {
    opacity: 0,
    transitionDuration: 0.3, // Szybkość animacji
    transitionProgress: 0,
};

// --- ZMODYFIKOWANY STAN OBIEKTU DOKUMENTU ---
const docState = {
    // Pozycja bazowa na desce rozdzielczej
    baseX: 1180,
    baseY: 645,
    width: 184,
    height: 89,

    // Dynamiczne wartości
    offsetX: 0,      
    offsetY: 0,      
    angle: 0,
    velocityX: 0,
    scale: 1, // Aktualny współczynnik skali

    // Parametry fizyki (dla ślizgania się)
    turnForce: 0.054,
    stiffness: 0.002,
    damping: 0.92,
    angleFactor: 0.11,
    minOffsetX: -116,
    maxOffsetX: 190,

    // WŁAŚCIWOŚCI DO OBSŁUGI INTERAKCJI I SKALOWANIA
    isDragging: false,        
    dragStartMouseX: 0,       
    dragStartMouseY: 0,       
    dragStartOffsetX: 0,      
    dragStartOffsetY: 0,      
    returnDamping: 0.9,       
    
    // Parametry skalowania
    baseScale: 1.0,           // Skala bazowa, gdy obiekt jest w spoczynku
    scaleFactorX: 0.0006,     // Jak bardzo pozycja X wpływa na skalę
    scaleFactorY: 0.001,      // Jak bardzo pozycja Y (przeciąganie) wpływa na skalę
    maxScale: 1.15,           // Maksymalna skala, aby nie przesadzić
    scaleEase: 0.1,           // Płynność animacji skalowania
    
    // FIZYKA BUJANIA I INTERAKCJI
    angleVelocity: 0,       // Prędkość kątowa bujania
    swayStiffness: 0.03,    // Sztywność "sprężyny" wracającej do pozycji
    swayDamping: 0.95,      // Tłumienie, jak szybko przestaje się bujać
    dragLastMouseX: 0,      // Ostatnia pozycja X myszy do obliczenia "pchnięcia"
    dragAngleFactor: 0.01,  // Mnożnik przechyłu podczas przeciągania
    flickFactor: 0.002,     // Siła "pchnięcia" po puszczeniu myszki
    
    // --- NOWY KOD: Flaga do jednorazowego odtwarzania dźwięku uderzenia ---
    justHitBoundary: false,
};

// --- NOWY KOD: STAN DLA NAKŁADKI DOKUMENTU ---
let docOverlayVisible = false;
let docOverlayScale = 0;
let docOverlayOffsetX = 0;
let docOverlayOffsetY = 0;

// Obrazy dla nakładki, na wzór mapy
const docOverlayImages = {
    current: 0,
    images: [new Image(), new Image()]
};


const wipersState = {
    active: false,
    speed: 3.56, // To teraz będzie prędkość kątowa, a nie mnożnik czasu
    angle: 0.32, // Zaczynamy od pozycji spoczynkowej
    restAngle: 0.32, 
    maxAngle: -1.38, 
    direction: 1, // 1 = ruch w stronę maxAngle, -1 = ruch w stronę restAngle
    positions: [
        { x: 540, y: 700 }, 
        { x: 1070, y: 690 } 
    ]
};

const pedalState = {
    pressedYOffset: -11,
    pressedScale: 0.9,
    easeFactor: 0.12,
    clutchPressTimer: 0,
    clutchPressDuration: 0.35,
    clutch: { baseX: 710, baseY: 860, width: 100, height: 100, yOffset: 0, targetYOffset: 0, scale: 1, targetScale: 1, },
    brake: { baseX: 780, baseY: 860, width: 100, height: 100, yOffset: 0, targetYOffset: 0, scale: 1, targetScale: 1, },
    gas: { baseX: 850, baseY: 860, width: 100, height: 100, yOffset: 0, targetYOffset: 0, scale: 1, targetScale: 1, }
};

// --- NOWY KOD: STAN I KONFIGURACJA DLA PTAKÓW ---
const birdSpawner = {
    nextSpawnTime: 5000 + Math.random() * 15000, // Pierwsze stado pojawi się po 5-20 sekundach
    timeSinceLastSpawn: 0,
    minInterval: 5000,  // Minimalny odstęp 5 sekund
    maxInterval: 20000, // Maksymalny odstęp 20 sekund
};
const activeBirds = []; // Tablica, w której będziemy przechowywać wszystkie aktywne ptaki

for (let i = 0; i < 5; i++) {
    if (odometerState.isRolling[i]) {
        odometerState.rollProgress[i] -= odometerState.rollSpeed * deltaTime;
        if (odometerState.rollProgress[i] <= 0) {
            odometerState.rollProgress[i] = 0; 
            odometerState.isRolling[i] = false;
        }
    }
}

function toggleVhsMenu() {
    // Ignoruj, jeśli animacja menu jest w toku
    if (vhsMenuState.isOpening && vhsMenuState.transitionProgress > 0 && vhsMenuState.transitionProgress < 1) {
        return;
    }

    const isNowOpening = !vhsMenuState.isOpen;

    if (isNowOpening) {
        // --- AKCJA PRZY OTWIERANIU MENU ---
        isGamePaused = true; // Ustaw flagę pauzy dla całej gry

        if (audio.unlocked && audio.menuopen) {
            audio.menuopen.currentTime = 0;
            audio.menuopen.volume = 0.7;
            audio.menuopen.play().catch(e => console.warn("Nie udało się odtworzyć menuopen.mp3", e));
        }

        // Pauzujemy i wyciszamy wszystkie możliwe dźwięki
        Object.values(audio).forEach(sound => {
            // --- POPRAWKA TUTAJ ---
            // Pauzuj wszystkie dźwięki Z WYJĄTKIEM tego, który właśnie uruchomiliśmy
            if (sound instanceof HTMLAudioElement && sound !== audio.menuopen) {
                sound.pause();
            }
            // --- KONIEC POPRAWKI ---
        });
    } else {
        // --- AKCJA PRZY ZAMYKANIU MENU ---
        isGamePaused = false; // Zdejmij flagę pauzy

        // Dźwięki zostaną wznowione przez główną pętlę gry,
        // z uwzględnieniem ustawienia vhsMenuState.isSoundOn
        const soundShouldBeOn = vhsMenuState.isSoundOn;
        Object.values(audio).forEach(sound => {
            if (sound instanceof HTMLAudioElement) {
                sound.muted = !soundShouldBeOn;
            }
        });
    }

    // Rozpocznij animację otwierania/zamykania menu
    vhsMenuState.isOpening = !vhsMenuState.isOpening;
}

function playMenuNavigateSound() {
    if (audio.unlocked && audio.menu) {
        audio.menu.currentTime = 0;
        audio.menu.volume = 0.6; // Możesz dostosować głośność
        audio.menu.play().catch(e => console.warn("Nie udało się odtworzyć menu.mp3", e));
    }
}

/**
 * Aktualizuje stan animacji i efektu pixelizacji.
 */
// ---> ZASTĄP STARĄ FUNKCJĘ TĄ NOWĄ <---

/**
 * Aktualizuje stan animacji i efektu pixelizacji.
 */

function startRotaryMenuRotation(direction) {
    if (rotaryMenuState.isRotating) return;

    rotaryMenuState.isRotating = true;
    rotaryMenuState.rotationProgress = 0;
    rotaryMenuState.rotationDirection = direction;
    
    // Odtwarzamy ten sam dźwięk co w menu VHS dla spójności
    playMenuNavigateSound();
}

/**
 * Aktualizuje logikę animacji obrotowego menu.
 * @param {number} deltaTime - Czas od ostatniej klatki.
 */
function updateRotaryMenu(deltaTime) {
    if (!rotaryMenuState.isRotating) return;

    // Zwiększamy postęp animacji
    rotaryMenuState.rotationProgress += rotaryMenuState.rotationSpeed * deltaTime;

    // Gdy animacja się zakończy
    if (rotaryMenuState.rotationProgress >= 1.0) {
        const numItems = rotaryMenuState.items.length;
        
        // Aktualizujemy faktyczny `selectedIndex` na podstawie kierunku
        // Używamy modulo (%) do zapętlenia indeksów (np. z 2 na 0, lub z 0 na 2)
        rotaryMenuState.selectedIndex = (rotaryMenuState.selectedIndex - rotaryMenuState.rotationDirection + numItems) % numItems;

        // Resetujemy stan animacji, gotowi na następny ruch
        rotaryMenuState.isRotating = false;
        rotaryMenuState.rotationProgress = 0;
    }
}

/**
 * Rysuje obrotowe menu na ekranie.
 */
function drawRotaryMenu() {
    if (!rotaryMenuState.isActive) return;

    const { items, selectedIndex, positions, isRotating, rotationProgress, rotationDirection } = rotaryMenuState;
    const numItems = items.length;

    // Funkcja pomocnicza do płynnej animacji (interpolacja liniowa)
    const lerp = (a, b, t) => a + (b - a) * t;
    // Funkcja "easing" dla ładniejszego, płynniejszego ruchu
    const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
    const easedProgress = easeOutCubic(isRotating ? rotationProgress : 0);

    // Określamy, które indeksy są na lewo, w centrum i na prawo
    const centerIdx = selectedIndex;
    const leftIdx = (selectedIndex - 1 + numItems) % numItems;
    const rightIdx = (selectedIndex + 1) % numItems;

    const slotMapping = [
        { index: leftIdx,   startSlot: positions.left },
        { index: centerIdx, startSlot: positions.center },
        { index: rightIdx,  startSlot: positions.right },
    ];

    // Rysujemy każdy z trzech widocznych elementów
    for (const slot of slotMapping) {
        const item = items[slot.index];
        if (!item || !item.image || !item.image.complete) continue;

        let startPos = slot.startSlot;
        let endPos = slot.startSlot;

        // Jeśli trwa rotacja, określamy pozycję docelową
        if (isRotating) {
            if (slot.startSlot === positions.left) {
                endPos = (rotationDirection === 1) ? positions.center : positions.right; // Z lewej na środek (prawo) lub na prawo (lewo)
            } else if (slot.startSlot === positions.center) {
                endPos = (rotationDirection === 1) ? positions.right : positions.left;  // Ze środka w prawo (prawo) lub w lewo (lewo)
            } else if (slot.startSlot === positions.right) {
                endPos = (rotationDirection === 1) ? positions.left : positions.center;  // Z prawej w lewo (prawo) lub na środek (lewo)
            }
        }
        
        // Obliczamy bieżące wartości (pozycja, skala, alpha) na podstawie postępu animacji
        const currentX = lerp(startPos.x, endPos.x, easedProgress);
        const currentY = lerp(startPos.y, endPos.y, easedProgress);
        const currentScale = lerp(startPos.scale, endPos.scale, easedProgress);
        const currentAlpha = lerp(startPos.alpha, endPos.alpha, easedProgress);

        const imgWidth = item.image.naturalWidth * currentScale;
        const imgHeight = item.image.naturalHeight * currentScale;

        ctx.save();
        ctx.globalAlpha = currentAlpha;
        ctx.drawImage(item.image, currentX - imgWidth / 2, currentY - imgHeight / 2, imgWidth, imgHeight);
        ctx.restore();
    }
}

function updateVhsMenu(deltaTime) {
    const targetProgress = vhsMenuState.isOpening ? 1.0 : 0.0;

    if (vhsMenuState.transitionProgress !== targetProgress) {
        const direction = targetProgress > vhsMenuState.transitionProgress ? 1 : -1;
        vhsMenuState.transitionProgress += direction * vhsMenuState.transitionSpeed * deltaTime;
        vhsMenuState.transitionProgress = Math.max(0.0, Math.min(1.0, vhsMenuState.transitionProgress));
    }
    
    // Zawsze aktualizuj stan `isOpen` na podstawie `transitionProgress`
    vhsMenuState.isOpen = vhsMenuState.transitionProgress === 1.0;

    // =======================================================================
    // === POPRAWIONY FRAGMENT ZACZYNA SIĘ TUTAJ ===
    // =======================================================================

    // Aktualizuj siłę efektu VHS, uzależniając ją od stanu opcji "CRT SCANLINES"
    const baseVhsStrength = 0.009;
    let finalVhsStrength = 0.0; // Domyślnie efekt jest wyłączony (siła 0.0)

    // Jeśli opcja "CRT SCANLINES" jest włączona, oblicz normalną siłę efektu.
    // W przeciwnym razie pozostanie 0.0.
    if (vhsMenuState.areScanlinesOn) {
        finalVhsStrength = baseVhsStrength + (vhsMenuState.transitionProgress * (0.01 - baseVhsStrength));
    }

    // Przekaż finalną wartość (0.0 lub obliczoną) do shadera
    RetroShaderWebGL.vhsEffectStrength = finalVhsStrength;
    
    // =======================================================================
    // === POPRAWIONY FRAGMENT KOŃCZY SIĘ TUTAJ ===
    // =======================================================================
    
    // Sterowanie siłą efektu "rybiego oka"
    const MAX_FISHEYE_STRENGTH = 0.07;
    let targetStrength = 0.0;

    if (vhsMenuState.isVcrEffectOn) {
        targetStrength = MAX_FISHEYE_STRENGTH * (1.0 - vhsMenuState.transitionProgress);
    }
    
    const easeFactor = 0.03;
    RetroShaderWebGL.fisheyeStrength += (targetStrength - RetroShaderWebGL.fisheyeStrength) * easeFactor;

    // Zmiana skalowania (rozdzielczości)
    let newShaderScaleFactor = shaderScaleFactor;
    if (vhsMenuState.isVcrEffectOn) {
        const targetResolutionFactor = vhsMenuState.options[4].factors[vhsMenuState.currentResolutionIndex];
        const menuResolutionFactor = 0.5;
        newShaderScaleFactor = targetResolutionFactor + (menuResolutionFactor - targetResolutionFactor) * vhsMenuState.transitionProgress;
    } else {
        newShaderScaleFactor = 1.0;
    }

    if (shaderScaleFactor !== newShaderScaleFactor) {
        shaderScaleFactor = newShaderScaleFactor;
        initCanvas();
    }
}

function showGameUIButtons() {
    const mapButton = document.getElementById('mapButton');
    const photoButton = document.getElementById('photoButton');
    const carSignButton = document.getElementById('carSignButton');
    if (mapButton) mapButton.style.display = 'block';
    if (photoButton) photoButton.style.display = 'block';
    if (carSignButton) carSignButton.style.display = 'block';
}

/**
 * Ukrywa przyciski interfejsu gry, gdy gracz opuszcza kokpit.
 */
function hideGameUIButtons() {
    const mapButton = document.getElementById('mapButton');
    const photoButton = document.getElementById('photoButton');
    const carSignButton = document.getElementById('carSignButton');
    if (mapButton) mapButton.style.display = 'none';
    if (photoButton) photoButton.style.display = 'none';
    if (carSignButton) carSignButton.style.display = 'none';
}

/**
 * Rysuje interfejs menu na ekranie.
 */
// --- ZMIANA: Zaktualizowana funkcja rysowania menu, aby obsługiwać paski ---
function drawVhsMenu() {
    if (vhsMenuState.transitionProgress <= 0) return;

    const backgroundColor = `rgba(0, 7, 224, ${vhsMenuState.transitionProgress})`;
    const fontColor = "white";
    const disabledFontColor = "rgba(255, 255, 255, 0.45)";
    const highlightBackgroundColor = "white";
    const highlightFontColor = "rgba(0, 7, 224, 1)";
    const disabledHighlightFontColor = "rgba(0, 7, 224, 0.85)";

    ctx.save();
    
    // Tło menu
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Rysuj treść menu tylko, gdy jest w pełni otwarte
    if (vhsMenuState.isOpen) {
        // Tytuł
        ctx.font = "80px 'VCR OSD Mono'";
        ctx.fillStyle = fontColor;
        ctx.textAlign = 'center';
        ctx.fillText("------ MENU ------", canvas.width / 2, 200);

        // Opcje
        ctx.font = "50px 'VCR OSD Mono'";
        const startY = 320; 
        const lineHeight = 90;
        
        vhsMenuState.options.forEach((option, index) => {
            const currentY = startY + (index * lineHeight);
            const isSelected = (index === vhsMenuState.selectedOptionIndex);
            // Zmieniona logika: wyłączone są opcje inne niż główny przełącznik (indeks 0) i dźwięk (indeks 3)
            const isOptionDisabled = !vhsMenuState.isVcrEffectOn && index !== 0 && index !== 3;
            // Rysowanie nazwy opcji (lewa strona)
            const nameText = option.name;
            ctx.textAlign = 'left';
            if (isSelected) {
                const nameMetrics = ctx.measureText(nameText);
                ctx.fillStyle = highlightBackgroundColor;
                ctx.fillRect(400, currentY - 30, nameMetrics.width + 40, 60);
                ctx.fillStyle = isOptionDisabled ? disabledHighlightFontColor : highlightFontColor;
                ctx.fillText(nameText, 420, currentY);
            } else {
                ctx.fillStyle = isOptionDisabled ? disabledFontColor : fontColor;
                ctx.fillText(nameText, 420, currentY);
            }

            // Rysowanie wartości opcji (prawa strona)
            ctx.save();
            if (isOptionDisabled) ctx.globalAlpha = 0.7;

            if (option.type === "toggle") {
                const valueIndex = option.getValue(vhsMenuState);
                const optionText = `< ${option.values[valueIndex]} >`;
                ctx.textAlign = 'right';
                 if (isSelected) {
                    const textMetrics = ctx.measureText(optionText);
                    ctx.fillStyle = highlightBackgroundColor;
                    ctx.fillRect(canvas.width - 400 - textMetrics.width - 40, currentY - 30, textMetrics.width + 40, 60);
                    ctx.fillStyle = highlightFontColor;
                    ctx.fillText(optionText, canvas.width - 420, currentY);
                } else {
                    ctx.fillStyle = fontColor;
                    ctx.fillText(optionText, canvas.width - 420, currentY);
                }
            } else if (option.type === "bars") {
                const barWidth = 40; const barHeight = 40; const barSpacing = 15;
                const totalBarsWidth = (option.maxBars * barWidth) + ((option.maxBars - 1) * barSpacing);
                let startX = canvas.width - 420 - totalBarsWidth;
                const currentValue = option.getValue(vhsMenuState);
                for (let i = 1; i <= option.maxBars; i++) {
                    const barX = startX + (i - 1) * (barWidth + barSpacing);
                    if (isSelected) {
                        if (i <= currentValue) { ctx.fillStyle = highlightBackgroundColor; ctx.fillRect(barX, currentY - barHeight / 2, barWidth, barHeight); }
                        else { ctx.strokeStyle = highlightBackgroundColor; ctx.lineWidth = 4; ctx.strokeRect(barX, currentY - barHeight / 2, barWidth, barHeight); }
                    } else {
                         if (i <= currentValue) { ctx.fillStyle = fontColor; ctx.fillRect(barX, currentY - barHeight / 2, barWidth, barHeight); }
                         else { ctx.strokeStyle = fontColor; ctx.lineWidth = 4; ctx.strokeRect(barX, currentY - barHeight / 2, barWidth, barHeight); }
                    }
                }
            }
            ctx.restore();
        });
    }
    ctx.restore();
}

function updatePixelationEffect(deltaTime) {
    // Zwiększamy nasz wewnętrzny zegar o czas, jaki upłynął od ostatniej klatki
    pixelationTimer += deltaTime;

    // Sprawdzamy, czy minął już nasz interwał (0.3 sekundy)
    if (pixelationTimer >= PIXELATION_INTERVAL) {
        // Resetujemy zegar. Odejmujemy interwał, a nie zerujemy,
        // aby animacja była płynna nawet przy wahaniach klatek na sekundę.
        pixelationTimer -= PIXELATION_INTERVAL;

        // Pobieramy aktualną wartość z obiektu shadera
        let currentFactor = RetroShaderWebGL.pixelationFactor;

        // Obliczamy nową wartość na podstawie kroku i kierunku
        let newFactor = currentFactor + (PIXELATION_STEP * pixelationDirection);

        // Sprawdzamy, czy nie przekroczyliśmy granic i ewentualnie odwracamy kierunek
        if (newFactor >= MAX_PIXELATION) {
            newFactor = MAX_PIXELATION; // Ustawiamy na sztywno max, by nie przekroczyć
            pixelationDirection = -1;   // Zmieniamy kierunek na zmniejszanie
        } else if (newFactor <= MIN_PIXELATION) {
            newFactor = MIN_PIXELATION; // Ustawiamy na sztywno min
            pixelationDirection = 1;    // Zmieniamy kierunek na zwiększanie
        }

        // Ustawiamy nową, obliczoną wartość w obiekcie shadera
        RetroShaderWebGL.pixelationFactor = newFactor ;
    }
}



function drawOdometer() {
    const { position, displayDigits, rollProgress, isRolling } = odometerState;
    const odometerBaseX = position.x-232;
    const odometerBaseY = position.y-6;
    const digitWidth = 3;
    const digitSpacing = 3;
    const rollHeight = odometerState.rollHeight;

    ctx.font = `bold 7px 'Press Start 2P', monospace`; 
    ctx.fillStyle = "rgba(161, 184, 201, 0.55)"; 
    ctx.textAlign = "right"; 
    
    for (let i = 4; i >= 0; i--) { 
        const newDigitChar = displayDigits[i];
        const newDigitValue = parseInt(newDigitChar, 10);
        const oldDigitValue = (newDigitValue - 1 + 10) % 10; 
        const oldDigitChar = oldDigitValue.toString();
        
        const drawIndexFromRight = 4 - i;
        const drawX = odometerBaseX - drawIndexFromRight * (digitWidth + digitSpacing);

        if (isRolling[i]) {
            const animationProgress = 1.0 - rollProgress[i];
            const oldDigitYOffset = animationProgress * -rollHeight;
            const newDigitYOffset = (1.0 - animationProgress) * rollHeight;
            ctx.fillText(oldDigitChar, drawX, odometerBaseY + oldDigitYOffset);
            ctx.fillText(newDigitChar, drawX, odometerBaseY + newDigitYOffset);
        } else {
             ctx.fillText(newDigitChar, drawX, odometerBaseY);
        }
    }
    ctx.textAlign = "left";
}

// --- ZMODYFIKOWANA FUNKCJA AKTUALIZACJI OBIEKTU DOC.PNG ---
function updateDocObject(deltaTime) {
    // Jeśli obiekt jest przeciągany myszką, cała fizyka jest pauzowana.
    if (docState.isDragging) {
        docState.velocityX = 0;
    } else {
        // --- LOGIKA POWROTU I FIZYKI (gdy obiekt NIE jest przeciągany) ---
        
        // Płynny powrót do pierwotnej pozycji pionowej (offsetY do zera).
        docState.offsetY *= docState.returnDamping;
        if (Math.abs(docState.offsetY) < 0.1) {
            docState.offsetY = 0;
        }

        // Fizyka ślizgania się po desce (oś X)
        const forceFromCar = gameState.tilt * docState.turnForce;
        const restoringForce = -docState.offsetX * docState.stiffness;
        const acceleration = forceFromCar + restoringForce;
        docState.velocityX += acceleration * deltaTime * 60;
        docState.velocityX *= docState.damping;
        docState.offsetX += docState.velocityX;
        
        // Ograniczenie ruchu po desce rozdzielczej (gdy nie jest przeciągany)
        let minOffset = docState.minOffsetX;
        
        // --- NOWA LOGIKA: Sprawdzenie stanu okna ---
        // Jeśli okno jest otwarte co najmniej w połowie, nie ma ograniczenia z lewej strony
        const isWindowOpenEnough = windowState.glassYOffset >= windowState.glassMaxDownOffset / 2;
        if (isWindowOpenEnough) {
            // Ustawiamy bardzo dużą wartość ujemną, aby de facto nie było ograniczenia
            minOffset = -Infinity; 
        }

        docState.offsetX = Math.max(minOffset, Math.min(docState.maxOffsetX, docState.offsetX));

        if (docState.offsetX === docState.minOffsetX || docState.offsetX === docState.maxOffsetX) {
            docState.velocityX = 0;
        }
        
        // Kąt obrotu jest proporcjonalny do aktualnej prędkości ślizgania się
        docState.angle = docState.velocityX * docState.angleFactor;
    }

    // --- NOWA LOGIKA: OBLICZANIE SKALI (ZAWSZE, NIEZALEŻNIE OD PRZECIĄGANIA) ---
    // Skalowanie zależy od absolutnej odległości od punktu startowego na obu osiach.
    const scaleFromX = Math.abs(docState.offsetX) * docState.scaleFactorX;
    const scaleFromY = Math.abs(docState.offsetY) * docState.scaleFactorY;

    // Obliczamy docelową skalę, dodając efekty z obu osi do skali bazowej.
    let targetScale = docState.baseScale + scaleFromX + scaleFromY*2;

    // Ograniczamy skalę do maksymalnej wartości, aby uniknąć przesady.
    targetScale = Math.min(targetScale, docState.maxScale*2);

    // Płynnie animujemy przejście do nowej skali (easing).
    docState.scale += (targetScale - docState.scale) * docState.scaleEase;
}

// --- ZMODYFIKOWANA FUNKCJA RYSOWANIA OBIEKTU DOC.PNG ---
function drawDocObject() {
    if (!assets.docObject || !assets.docObject.complete) return;

    // Pobieramy teraz również `scale` ze stanu
    const { baseX, baseY, width, height, offsetX, offsetY, angle, scale } = docState;

    // Obliczamy finalne wymiary na podstawie bazowych i aktualnej skali
    const finalWidth = width * scale;
    const finalHeight = height * scale;

    ctx.save();
    // Przesuwamy się do punktu centralnego obiektu
    ctx.translate(baseX + offsetX + width / 2, baseY + offsetY + height / 2);
    // Obracamy
    ctx.rotate(angle);
    // Rysujemy obrazek ze SKALOWANYMI wymiarami, centrując go na (0,0).
    // Dzięki temu obiekt będzie rósł "od środka".
    ctx.drawImage(assets.docObject, -finalWidth / 2, -finalHeight / 2, finalWidth, finalHeight);
    ctx.restore();
}

function updateOilDrops(deltaTime) {
    const gravity = 0.25; 

    // Definiujemy obszar "wlewu oleju", gdzie kropelki będą znikać
    const fillHole = {
        x: oilCapState.x,
        y: oilCapState.y+20,
        width: oilCapState.width,
        height: 20 // Wystarczy mała wysokość, to tylko "dziura"
    };

    for (let i = oilDrops.length - 1; i >= 0; i--) {
        const drop = oilDrops[i];

        // --- NOWA LOGIKA: Wlewanie oleju ---
        // Sprawdzamy, czy warunki do wlania oleju są spełnione
        if (
            currentView === 'engine' &&      // 1. Jesteśmy w widoku silnika
            !oilCapState.isVisible &&        // 2. Korek jest odkręcony i zdjęty
            // 3. Kropelka jest w obszarze wlewu
            (drop.x > fillHole.x && drop.x < fillHole.x + fillHole.width &&
             drop.y > fillHole.y && drop.y < fillHole.y + fillHole.height)
        ) {
            // Zwiększamy ilość oleju, ale nie więcej niż 100
            gameState.oilAmount = Math.min(100, gameState.oilAmount + 0.03); // Możesz dostosować tę wartość

            // Usuwamy kropelkę z tablicy, symulując jej "wlanie"
            oilDrops.splice(i, 1);
            continue; // Przechodzimy do następnej kropelki, pomijając resztę logiki
        }
        // --- KONIEC NOWEJ LOGIKI ---

        drop.lifetime += deltaTime;

        if (drop.lifetime >= drop.maxLifetime) {
            oilDrops.splice(i, 1);
            continue; 
        }

        drop.vy += gravity;
        drop.x += drop.vx;
        drop.y += drop.vy;
        
        const lifeProgress = drop.lifetime / drop.maxLifetime;
        drop.currentSize = drop.initialSize * (1 - lifeProgress);
        drop.alpha = 1 - lifeProgress;
    }
}



/**
 * Rysuje wszystkie aktywne kropelki oleju na ekranie.
 */
function drawOilDrops() {
    // Nie rób nic, jeśli nie ma kropelek lub grafika nie jest załadowana
    if (oilDrops.length === 0 || !assets.oildrop || !assets.oildrop.complete) {
        return;
    }

    ctx.save();
    for (const drop of oilDrops) {
        // Ustaw przezroczystość
        ctx.globalAlpha = drop.alpha;
        
        // Narysuj obrazek kropelki, centrując go na jego pozycji
        ctx.drawImage(
            assets.oildrop,
            drop.x - drop.currentSize / 2,
            drop.y - drop.currentSize / 2,
            drop.currentSize,
            drop.currentSize
        );
    }
    ctx.restore();
}

function updateHeldOil(deltaTime) {
    if (!heldOilState.isHeld) return;

    // 1. Oblicz siłę przywracającą (jak sprężyna)
    // Siła jest tym większa, im bardziej butelka jest wychylona od pionu (kąt 0).
    // Działa w przeciwnym kierunku do wychylenia, stąd znak minus.
    const restoringForce = -heldOilState.angle * heldOilState.stiffness;

    // 2. Zastosuj siłę, aby zmienić prędkość kątową
    heldOilState.angleVelocity += restoringForce;
    
    // 3. Zastosuj tłumienie (damping), aby spowolnić ruch i go wygasić
    // Mnożymy prędkość przez wartość < 1, co ją stopniowo zmniejsza.
    heldOilState.angleVelocity *= heldOilState.damping;

    // 4. Zastosuj prędkość kątową, aby zmienić faktyczny kąt butelki
    heldOilState.angle += heldOilState.angleVelocity;
}

function drawHeldOil() {
    // Nie rysuj, jeśli nie trzymamy oleju lub jego grafika nie jest załadowana
    if (!heldOilState.isHeld || !assets.oilBottle || !assets.oilBottle.complete) {
        return;
    }
    
    ctx.save();
    // Przesuń punkt odniesienia (0,0) do aktualnej pozycji butelki (pozycji myszki)
    ctx.translate(heldOilState.x, heldOilState.y);
    // Obróć cały układ współrzędnych o obliczony kąt
    ctx.rotate(heldOilState.angle);
    // Narysuj obrazek, centrując go na nowym punkcie (0,0).
    // Dzięki temu butelka będzie się obracać wokół swojego środka.
    ctx.drawImage(
        assets.oilBottle,
        -heldOilState.width / 2, 
        -heldOilState.height / 2, 
        heldOilState.width, 
        heldOilState.height
    );
    ctx.restore();
}

function updateOilCap(deltaTime) {
    const state = oilCapState;

    // 1. Obliczamy wizualny postęp (ograniczony do 0-1) do obliczeń graficznych
    const visualProgress = Math.max(0, Math.min(1, state.unscrewProgress));

    // 2. Obliczamy pozycję pionową (Y)
    // Korek przesuwa się z pozycji bazowej w górę
    state.currentY = state.y + (state.maxOffsetY * visualProgress);
    
    // 3. Obliczamy kąt chybotania (wobble)
    if (state.unscrewProgress > 0) {
        // Chybotanie zależy od czasu i od tego, jak bardzo odkręcony jest korek
        const wobble = Math.sin(RetroShaderWebGL.time * state.wobbleFrequency) * state.wobbleAmplitude;
        state.currentAngle = wobble * visualProgress;
    } else {
        state.currentAngle = 0; // Brak chybotania, gdy jest w pełni wkręcony
    }

    // 4. Określamy widoczność
    // Korek staje się niewidoczny, gdy jego postęp przekroczy 1.0
    state.isVisible = state.unscrewProgress <= 1.0;
}

// --- NOWA FUNKCJA: Rysuje korek oleju na ekranie ---
function drawOilCap() {
    const state = oilCapState;
    
    // Nie rysuj, jeśli jest niewidoczny lub grafika nie jest załadowana
    if (!state.isVisible || !assets.oilCap || !assets.oilCap.complete) {
        return;
    }

    ctx.save();
    // Przesuwamy punkt obrotu do środka aktualnej pozycji korka
    ctx.translate(state.x + state.width / 2, state.currentY + state.height / 2);
    // Obracamy korek
    ctx.rotate(state.currentAngle);
    // Rysujemy obrazek, centrując go na punkcie obrotu
    ctx.drawImage(assets.oilCap, -state.width / 2, -state.height / 2, state.width, state.height);
    ctx.restore();
}

function updateOverlaySway(deltaTime) {
  // --- ZMIANA: Dodajemy docOverlayVisible do warunku ---
  if (!mapVisible && !photoVisible && !carSignVisible && !docOverlayVisible) return;
  if (mapShake.active) {
    const shakeAmount = mapShake.intensity * 0.4;
    mapSwayAngle += (Math.sin(mapShake.time * 20) * 0.05 - mapSwayAngle) * shakeAmount;
    mapSwayVelocity += (Math.cos(mapShake.time * 15) * 0.03 - mapSwayVelocity) * shakeAmount;
  }
  
  const acceleration = -mapSwayAngle * mapSwayStiffness - mapSwayVelocity * mapSwayDamping;
  mapSwayVelocity += acceleration * deltaTime;
  mapSwayAngle += mapSwayVelocity * deltaTime;
  
  mapSwayAngle = Math.max(-maxSwayAngle, Math.min(maxSwayAngle, mapSwayAngle));
  
  if (!isOverlayDragging) {
    mapSwayVelocity *= 0.95;
    mapSwayAngle *= 0.95;
    
    if (Math.abs(mapSwayAngle) < 0.001 && Math.abs(mapSwayVelocity) < 0.001) {
      mapSwayAngle = 0; mapSwayVelocity = 0;
    }
  }
}

window.addEventListener('load', initCanvas);
window.addEventListener('resize', initCanvas);

const assets = {
  // --- NOWY KOD: ASSETY DLA WIDOKU SILNIKA ---
  trunk: new Image(),
  oilBase: new Image(),
  oilBottle: new Image(), // <-- DODAJ TĘ LINIĘ
  beerBase: new Image(),
  beer: new Image(),
  oildrop: new Image(), // <-- DODAJ TĘ LINIĘ
  engineBack: new Image(),
  engineBody: new Image(),
  oilCap: new Image(),
  blinker: new Image(), // <--- DODAJ TĘ LINIĘ
  arm: new Image(),
  windowGlass: new Image(),
  windowButtonHandle1: new Image(),
  windowButtonHandle2: new Image(),
  windowButton: null,
  handleMirror: new Image(),
  button1: new Image(),
  button2: new Image(),
  interiorLight: new Image(),
  bird1: new Image(),
  bird2: new Image(),
  controls: {},
  road: new Image(), cockpit: new Image(), steeringWheel: new Image(), shifter: new Image(),
  treeImages: [], backgroundTreeImages: [], buildingImages: [], specialBuildingImages: [],
  fieldImages: [], signs: [], field: new Image(), forest: new Image(), backforest: new Image(),
  blades: new Image(), sky: new Image(), dust: new Image(), dust_blue: new Image(), hang: new Image(),
  photo: new Image(), carSign: new Image(), cockpitBroken: new Image(), cars: [],
  picket: new Image(), pedalClutchBrake: new Image(), pedalGas: new Image(), pole: new Image(),
  radio: new Image(),
  wiper: new Image(),
  counterl: new Image(),
  counterHud: new Image(),
  mirror: new Image(),
  counterNeedle: new Image(),
  mirror2: new Image(),
  docObject: new Image(),
  c_cockpit: new Image(),
  c_engine: new Image(),
  c_trunk: new Image(),
  opponentBottom: new Image(),
  opponentTop: new Image(),
  lantern: new Image(),
  wheelBase: new Image(),
  wheel: new Image(),
};

assets.trunk.src = "trunk.png"; menedzerZasobow.sledz(assets.trunk);
assets.lantern.src = "lantern.png"; menedzerZasobow.sledz(assets.lantern);
assets.oilBase.src = "oilbase.png"; menedzerZasobow.sledz(assets.oilBase);
assets.beerBase.src = "beerbase.png"; menedzerZasobow.sledz(assets.beerBase);
assets.beer.src = "beer.png"; menedzerZasobow.sledz(assets.beer);
assets.engineBack.src = "engineback.png"; menedzerZasobow.sledz(assets.engineBack);
assets.engineBody.src = "engine.png"; menedzerZasobow.sledz(assets.engineBody);
assets.oilCap.src = "oilcap.png"; menedzerZasobow.sledz(assets.oilCap);
assets.oilBottle.src = "oilbottle.png"; menedzerZasobow.sledz(assets.oilBottle);
assets.oildrop.src = "oildrop.png"; menedzerZasobow.sledz(assets.oildrop);
assets.arm.src = "arm.png"; menedzerZasobow.sledz(assets.arm);
assets.road.src = "road.png"; menedzerZasobow.sledz(assets.road);
assets.cockpit.src = "interior.png"; menedzerZasobow.sledz(assets.cockpit);
assets.cockpitBroken.src = "interiorbroken.png"; menedzerZasobow.sledz(assets.cockpitBroken);
assets.steeringWheel.src = "steering_wheel.png"; menedzerZasobow.sledz(assets.steeringWheel);
assets.shifter.src = "shiffter.png"; menedzerZasobow.sledz(assets.shifter);
assets.field.src = "field.webp"; menedzerZasobow.sledz(assets.field);
assets.forest.src = "forest.png"; menedzerZasobow.sledz(assets.forest);
assets.backforest.src = "backforest.png"; menedzerZasobow.sledz(assets.backforest);
assets.grassLeft = new Image();
assets.grassRight = new Image();
assets.grassLeft.src = "grass.webp"; menedzerZasobow.sledz(assets.grassLeft);
assets.grassRight.src = "grass.webp"; menedzerZasobow.sledz(assets.grassRight);
assets.secondGrassLeft = new Image();
assets.secondGrassRight = new Image();
assets.secondGrassLeft.src = "secondgrass.webp"; menedzerZasobow.sledz(assets.secondGrassLeft);
assets.secondGrassRight.src = "secondgrass.webp"; menedzerZasobow.sledz(assets.secondGrassRight);
assets.blades.src = "blades.png"; menedzerZasobow.sledz(assets.blades);
assets.dust.src = "dust.png"; menedzerZasobow.sledz(assets.dust);
assets.dust_blue.src = "dust_blue.png"; menedzerZasobow.sledz(assets.dust_blue);
assets.hang.src = "hang.png"; menedzerZasobow.sledz(assets.hang);
assets.photo.src = "photo.png"; menedzerZasobow.sledz(assets.photo);
assets.carSign.src = "car_sign.png"; menedzerZasobow.sledz(assets.carSign);
assets.sky.src = "sky.png"; menedzerZasobow.sledz(assets.sky);
assets.ground = new Image();
assets.ground.src = "ground.png"; menedzerZasobow.sledz(assets.ground);
assets.picket.src = "picket.png"; menedzerZasobow.sledz(assets.picket);
assets.pedalClutchBrake.src = "pedal1.png"; menedzerZasobow.sledz(assets.pedalClutchBrake);
assets.pedalGas.src = "pedal2.png"; menedzerZasobow.sledz(assets.pedalGas);
assets.pole.src = "pole.png"; menedzerZasobow.sledz(assets.pole);
assets.windowGlass.src = "window.png"; menedzerZasobow.sledz(assets.windowGlass);
assets.windowButtonHandle1.src = "handle.png"; menedzerZasobow.sledz(assets.windowButtonHandle1);
assets.windowButtonHandle2.src = "handle2.png"; menedzerZasobow.sledz(assets.windowButtonHandle2);
assets.windowButton = assets.windowButtonHandle1;
assets.handleMirror.src = "handlemirror.png"; menedzerZasobow.sledz(assets.handleMirror);
assets.button1.src = "button1.png"; menedzerZasobow.sledz(assets.button1);
assets.button2.src = "button2.png"; menedzerZasobow.sledz(assets.button2);
assets.interiorLight.src = "interiorlighten.png"; menedzerZasobow.sledz(assets.interiorLight);
assets.bird1.src = "bird.png"; menedzerZasobow.sledz(assets.bird1);
assets.bird2.src = "bird2.png"; menedzerZasobow.sledz(assets.bird2);
assets.radio.src = "radio.png"; menedzerZasobow.sledz(assets.radio);
assets.wiper.src = "wiper.png"; menedzerZasobow.sledz(assets.wiper);
assets.counterl.src = "counterl.png"; menedzerZasobow.sledz(assets.counterl);
assets.counterHud.src = "counterhud.png"; menedzerZasobow.sledz(assets.counterHud);
assets.counterNeedle.src = "counter_needle.png"; menedzerZasobow.sledz(assets.counterNeedle);
assets.mirror.src = "mirror1.png"; menedzerZasobow.sledz(assets.mirror);
assets.mirror2.src = "mirror2.png"; menedzerZasobow.sledz(assets.mirror2);
assets.docObject.src = "doc.png"; menedzerZasobow.sledz(assets.docObject);
assets.opponentBottom.src = "opponent_bottom.png"; menedzerZasobow.sledz(assets.opponentBottom);
assets.opponentTop.src = "opponent_top.png"; menedzerZasobow.sledz(assets.opponentTop);
assets.c_cockpit.src = "c_cockpit.png"; menedzerZasobow.sledz(assets.c_cockpit);
assets.c_engine.src = "c_engine.png"; menedzerZasobow.sledz(assets.c_engine);
assets.c_trunk.src = "c_trunk.png"; menedzerZasobow.sledz(assets.c_trunk);
assets.blinker.src = "blinker.png"; menedzerZasobow.sledz(assets.blinker);
assets.wheelBase.src = "wheelbase.png"; menedzerZasobow.sledz(assets.wheelBase);
assets.wheel.src = "wheel.png"; menedzerZasobow.sledz(assets.wheel);

assets.c_trunk.onload = () => { 
    rotaryMenuState.items[0].image = assets.c_cockpit;
    rotaryMenuState.items[1].image = assets.c_engine;
    rotaryMenuState.items[2].image = assets.c_trunk;
};

docOverlayImages.images[0].src = "document1.png"; menedzerZasobow.sledz(docOverlayImages.images[0]);
docOverlayImages.images[1].src = "document2.png"; menedzerZasobow.sledz(docOverlayImages.images[1]);

const oilDrops = []; 

const controlImageFiles = ['acu.png', 'oil.png', 'lights.png', 'stop.png', 'long.png', 'hazard.png', 'blink.png', 'lever1.png', 'lever2.png', 'lever3.png'];
controlImageFiles.forEach(file => {
    const name = file.split('.')[0];
    const img = new Image();
    img.src = `${file}`;
    assets.controls[name] = img;
    menedzerZasobow.sledz(img); // Śledzimy każdy obrazek z tej pętli
});

for (let i = 1; i <= 7; i++) { const img = new Image(); img.src = `tree${i}.webp`; assets.treeImages.push(img); menedzerZasobow.sledz(img); }
for (let i = 1; i <= 7; i++) { const img = new Image(); img.src = `tree${i}.webp`; assets.backgroundTreeImages.push(img); menedzerZasobow.sledz(img); }
for (let i = 1; i <= 5; i++) { const img = new Image(); img.src = `building${i}.webp`; assets.buildingImages.push(img); menedzerZasobow.sledz(img); }
const specialBuildingNames = ['a', 'b', 'c', 'd', 'e', 'f'];
for (const name of specialBuildingNames) { const img = new Image(); img.src = `building${name}.webp`; assets.specialBuildingImages.push(img); menedzerZasobow.sledz(img); }
for (let i = 1; i <= 3; i++) { const img = new Image(); img.src = `field${i}.webp`; assets.fieldImages.push(img); menedzerZasobow.sledz(img); }

signsToSpawn.forEach(signData => {
    const img = new Image();
    img.src = signData.imageSrc;
    assets.signs.push({ image: img, originalData: signData });
    menedzerZasobow.sledz(img); // Śledzimy każdy obrazek znaku
});

function startCrashProcedure() {
    if (gameState.crashState.active) return; 
    console.log("WYPADEK!");
    gameState.crashState.active = true;
    gameState.crashState.effectTimer = 0; 
    gameState.temperature = 150;
    gameState.isOverheating = true; 

    if (audio.unlocked) {
        audio.carbackground.pause();
        Object.values(audio).forEach(sound => {
            if (sound instanceof HTMLAudioElement && sound !== audio.boom2) {
                sound.pause(); sound.muted = true;
            }
        });
        audio.boom2.currentTime = 0;
        audio.boom2.play().catch(() => {});
    }
    assets.cockpit = assets.cockpitBroken;
}

const carSpawnInterval = 14800;
let timeSinceLastCarSpawn = 0;
const activeCars = [];
const carImageFiles = ['car1.png', 'car2.png'];

carImageFiles.forEach(file => { const img = new Image(); img.src = `${file}`; assets.cars.push(img); menedzerZasobow.sledz(img); });

function spawnEnemyCar() {
    if (assets.cars.length === 0 || assets.cars.some(img => !img.complete)) return;
    const randomImageIndex = Math.floor(Math.random() * assets.cars.length);
    const carImage = assets.cars[randomImageIndex];
    activeCars.push({ image: carImage, t: 0, xOffsetVariation: 450, hasDust: Math.random() < 0.5 });
    gameState.canPlayPassingSound = true; 
}

function updateTrunkWheel(deltaTime) {
    const state = trunkWheelState;

    if (state.isHovered) {
        state.targetScale = 1.1;
        state.swayTime += deltaTime;
        state.targetAngle = Math.sin(state.swayTime * state.swayFrequency) * state.swayAmplitude;
    } else {
        state.targetScale = 1.0;
        state.targetAngle = 0.0;
        state.swayTime = 0;
    }

    state.currentScale += (state.targetScale - state.currentScale) * state.easeFactor;
    state.currentAngle += (state.targetAngle - state.currentAngle) * state.easeFactor;
}

/**
 * Rysuje koło w bagażniku.
 */
function drawTrunkWheel() {
    if (!trunkWheelState.isVisible || !assets.wheelBase || !assets.wheelBase.complete) {
        return;
    }

    const state = trunkWheelState;
    const finalWidth = state.width * state.currentScale;
    const finalHeight = state.height * state.currentScale;

    ctx.save();
    ctx.translate(state.x + state.width / 2, state.y + state.height / 2);
    ctx.rotate(state.currentAngle);
    ctx.drawImage(assets.wheelBase, -finalWidth / 2, -finalHeight / 2, finalWidth, finalHeight);
    ctx.restore();
}


function updateTrunkBeer(deltaTime) {
    const state = trunkBeerState;

    if (state.isHovered) {
        state.targetScale = 1.1;
        state.swayTime += deltaTime;
        state.targetAngle = -0.2 + (Math.sin(state.swayTime * state.swayFrequency) * state.swayAmplitude);
    } else {
        state.targetScale = 1.0;
        state.targetAngle = -0.2; // Wracamy do bazowego przechylenia
        state.swayTime = 0;
    }

    state.currentScale += (state.targetScale - state.currentScale) * state.easeFactor;
    state.currentAngle += (state.targetAngle - state.currentAngle) * state.easeFactor;
}

/**
 * Rysuje piwo w bagażniku.
 */
function drawTrunkBeer() {
    if (!trunkBeerState.isVisible || !assets.beerBase || !assets.beerBase.complete) {
        return;
    }

    const state = trunkBeerState;
    const finalWidth = state.width * state.currentScale;
    const finalHeight = state.height * state.currentScale;

    ctx.save();
    ctx.translate(state.x + state.width / 2, state.y + state.height / 2);
    ctx.rotate(state.currentAngle);
    ctx.drawImage(assets.beerBase, -finalWidth / 2, -finalHeight / 2, finalWidth, finalHeight);
    ctx.restore();
}


/**
 * Aktualizuje fizykę trzymanego piwa.
 */
function updateHeldBeer(deltaTime) {
    if (!heldBeerState.isHeld) return;

    // --- NOWA LOGIKA: Animacja picia ---
    if (heldBeerState.isDrinking) {
        // Zwiększamy postęp animacji
        heldBeerState.fadeProgress += deltaTime / heldBeerState.fadeDuration;
        
        // Kiedy animacja się zakończy (butelka znika)
        if (heldBeerState.fadeProgress >= 1.0) {
            heldBeerState.isHeld = false;       // Upuszczamy butelkę
            heldBeerState.isDrinking = false;   // Kończymy picie
            heldBeerState.fadeProgress = 0.0;   // Resetujemy postęp
            heldBeerState.angle = 0;            // Resetujemy kąt
            heldBeerState.angleVelocity = 0;    // Resetujemy prędkość kątową
            return; // Kończymy funkcję, bo butelka zniknęła
        }
    }
    // --- KONIEC NOWEJ LOGIKI ---

    // Logika fizyki bujania (pozostaje bez zmian)
    const restoringForce = -heldBeerState.angle * heldBeerState.stiffness;
    heldBeerState.angleVelocity += restoringForce;
    heldBeerState.angleVelocity *= heldBeerState.damping;
    heldBeerState.angle += heldBeerState.angleVelocity;

    // Dynamiczne skalowanie w zależności od pozycji Y w kokpicie
    if (currentView === 'cockpit') {
        const progressY = Math.max(0, Math.min(1, heldBeerState.y / canvas.height));
        const targetScale = heldBeerState.baseScale + (heldBeerState.maxScale - heldBeerState.baseScale) * progressY;
        const easeFactor = 0.1; 
        heldBeerState.scale += (targetScale - heldBeerState.scale) * easeFactor;
    } else {
        const easeFactor = 0.1;
        heldBeerState.scale += (1.0 - heldBeerState.scale) * easeFactor;
    }
    
    // --- NOWA LOGIKA: Zastosowanie efektu zanikania do skali ---
    // Mnożymy obliczoną skalę przez współczynnik zanikania
    if (heldBeerState.isDrinking) {
        // (1.0 - progress) da nam wartość od 1.0 (początek) do 0.0 (koniec)
        const fadeFactor = Math.max(0, 1.0 - heldBeerState.fadeProgress);
        heldBeerState.scale *= fadeFactor;
    }
}

/**
 * Rysuje trzymane piwo przy kursorze.
 */
function drawHeldBeer() {
    if (!heldBeerState.isHeld || !assets.beer || !assets.beer.complete) {
        return;
    }
    
    ctx.save();
    ctx.translate(heldBeerState.x, heldBeerState.y);
    
    // --- ZMIANA: Dodajemy skalowanie przed obrotem i rysowaniem ---
    // Dzięki temu obiekt będzie się skalował względem swojego środka.
    ctx.scale(heldBeerState.scale, heldBeerState.scale);
    // --- KONIEC ZMIANY ---

    ctx.rotate(heldBeerState.angle);

    ctx.drawImage(
        assets.beer,
        -heldBeerState.width / 2, 
        -heldBeerState.height / 2, 
        heldBeerState.width, 
        heldBeerState.height
    );
    ctx.restore();
}
// NOWY KOD: Funkcje do obsługi trzymanego koła

/**
 * Aktualizuje fizykę trzymanego koła.
 */
function updateHeldWheel(deltaTime) {
    if (!heldWheelState.isHeld) return;

    const restoringForce = -heldWheelState.angle * heldWheelState.stiffness;
    heldWheelState.angleVelocity += restoringForce;
    heldWheelState.angleVelocity *= heldWheelState.damping;
    heldWheelState.angle += heldWheelState.angleVelocity;
}

/**
 * Rysuje trzymane koło przy kursorze.
 */
function drawHeldWheel() {
    if (!heldWheelState.isHeld || !assets.wheel || !assets.wheel.complete) {
        return;
    }
    
    ctx.save();
    ctx.translate(heldWheelState.x, heldWheelState.y);
    ctx.rotate(heldWheelState.angle);
    ctx.drawImage(
        assets.wheel,
        -heldWheelState.width / 2, 
        -heldWheelState.height / 2, 
        heldWheelState.width, 
        heldWheelState.height
    );
    ctx.restore();
}


function updateTrunkOil(deltaTime) {
    const state = trunkOilState;

    // 1. Ustaw wartości docelowe na podstawie stanu najechania myszą
    if (state.isHovered) {
        state.targetScale = 1.1; // Powiększ do 110%
        state.swayTime += deltaTime;
        // Oblicz docelowy kąt kołysania za pomocą funkcji sinus
        state.targetAngle = Math.sin(state.swayTime * state.swayFrequency) * state.swayAmplitude;
    } else {
        state.targetScale = 1.0; // Wróć do normalnego rozmiaru
        state.targetAngle = 0.0; // Zatrzymaj kołysanie
        state.swayTime = 0;      // Zresetuj timer kołysania
    }

    // 2. Płynnie animuj aktualne wartości w kierunku wartości docelowych (easing)
    state.currentScale += (state.targetScale - state.currentScale) * state.easeFactor;
    state.currentAngle += (state.targetAngle - state.currentAngle) * state.easeFactor;
}

/**
 * Rysuje butelkę z olejem na ekranie.
 */
function drawTrunkOil() {
    // --- ZMIANA: Dodano warunek isVisible ---
    if (!trunkOilState.isVisible || !assets.oilBase || !assets.oilBase.complete) {
        return;
    }
    if (!assets.oilBase || !assets.oilBase.complete) {
        return;
    }

    const state = trunkOilState;
    const finalWidth = state.width * state.currentScale;
    const finalHeight = state.height * state.currentScale;

    ctx.save();
    // Przesuń punkt odniesienia do środka obiektu
    ctx.translate(state.x + state.width / 2, state.y + state.height / 2);
    // Obróć
    ctx.rotate(state.currentAngle);
    // Narysuj obrazek, centrując go w nowym punkcie (0,0)
    ctx.drawImage(assets.oilBase, -finalWidth / 2, -finalHeight / 2, finalWidth, finalHeight);
    ctx.restore();
}

function updateEngineView(deltaTime) {
    // Sprawdzamy, czy silnik jest przegrzany
    if (gameState.isOverheating) {
        // --- LOGIKA DLA PRZEGRZANEGO SILNIKA ---

        // 1. Resetujemy stan drgania (NOWY KOD - SILNIK PRZESTAJE SIĘ TRZĄŚĆ)
        engineViewState.shakeOffsetX = 0;
        engineViewState.shakeTime = 0;

        // 2. Animacja powiększania i znikania
        if (engineViewState.fadeTimer < engineViewState.fadeDuration) {
            engineViewState.fadeTimer += deltaTime;
        }
        const progress = Math.min(1.0, engineViewState.fadeTimer / engineViewState.fadeDuration);
        
        // Płynne przejście (ease-out) dla ładniejszego efektu
        const easedProgress = 1 - Math.pow(1 - progress, 3); 

        engineViewState.engineAlpha = 1.0 - easedProgress;      // Znikanie do zera

        // 3. Generowanie dymu
        engineViewState.lastSmokeSpawn += deltaTime;
              if (engineViewState.lastSmokeSpawn > engineViewState.smokeSpawnInterval*3) {
    engineViewState.lastSmokeSpawn = 0;
    // Dodajemy nową cząsteczkę dymu do tablicy
    engineViewState.smokeParticles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 300, // Losowa pozycja X w CENTRUM
        y: canvas.height / 2 + Math.random() * 350,         // Pozycja Y na silniku
                size: 130 + Math.random() * 280,
                alpha: 0.01 + Math.random() * 0.05,
                vy: 1.2 - Math.random() * 3.5, // Prędkość w górę
                growth: 3.2 + Math.random() * 6.5, // Tempo rośnięcia
                lifetime: 0,
                maxLifetime: 3.0 + Math.random() * 5.0 // Czas życia
            });
        }
    } else {
        // --- LOGIKA DLA PRACUJĄCEGO SILNIKA ---

        // 1. Resetujemy stan przegrzania
        engineViewState.fadeTimer = 0;
        engineViewState.engineScale = 1.0;
        engineViewState.engineAlpha = 1.0;

        // 2. Animacja delikatnego drgania
        engineViewState.shakeTime += deltaTime;
        // Używamy sinusa do płynnego ruchu w zakresie -0.5px do +0.5px
        engineViewState.shakeOffsetX = Math.sin(engineViewState.shakeTime * 58) * 0.8;
    }

    // 4. Aktualizacja wszystkich cząsteczek dymu (zawsze, nawet gdy przestaje się spawnować)
    for (let i = engineViewState.smokeParticles.length - 1; i >= 0; i--) {
        const p = engineViewState.smokeParticles[i];
        p.lifetime += deltaTime;
        if (p.lifetime >= p.maxLifetime) {
            // Usuwamy cząstkę, jeśli jej czas życia minął
            engineViewState.smokeParticles.splice(i, 1);
        } else {
            // Aktualizujemy jej pozycję, rozmiar i przezroczystość
            p.y += p.vy;
            p.size += p.growth;
            const lifeProgress = p.lifetime / p.maxLifetime;
            // Dym staje się bardziej przezroczysty pod koniec życia
            p.alpha = (0.1 + Math.random() * 0.2) * (1 - lifeProgress);
        }
    }
}

function updateEnemyCars(deltaTime) {
    for (let i = activeCars.length - 1; i >= 0; i--) {
        const car = activeCars[i];
        if (!gameState.crashState.active) {
            const collisionDepth = 0.95; const carHitboxWidth = 360; const carLaneOffset = -240;  
            if (car.t > collisionDepth && Math.abs(gameState.playerX - carLaneOffset) < carHitboxWidth / 2) startCrashProcedure(); 
        }

        const minVisualSpeed = 0.0001 * ((gameState.speedKmH/(gameState.speedKmH+1))/100); 
        const maxVisualSpeed = 2.5; const accelerationExponent = 0.94 ; 
        const speedIncrease = (maxVisualSpeed - minVisualSpeed) * Math.pow(car.t, accelerationExponent);
        let currentVisualSpeed = minVisualSpeed + speedIncrease;
        const playerSpeedContribution = (gameState.speedKmH / gameState.maxSpeedKmH) * 0.25;
        car.t += (currentVisualSpeed + playerSpeedContribution) * deltaTime;
        
        if (car.hasDust && car.t < 0.95 && Math.random() < 0.35) {
            gameState.carDustParticles.push({
                t: car.t, xOffsetVariation: car.xOffsetVariation, initialSize: 0.05 + Math.random() * 0.08, 
                alpha: 0.2 + Math.random() * 0.4, lifetime: 0, maxLifetime: 1.8 + Math.random() * 4.7, growthRate: 0.9 + Math.random() * 0.7, 
            });
        }
        if (car.t >= 0.05 && gameState.canPlayPassingSound && audio.unlocked) {
            audio.passing.currentTime = 0; audio.passing.play().catch(() => {});
            gameState.canPlayPassingSound = false; 
        }
        if (car.t >= 1.1) activeCars.splice(i, 1);
    }
}

// ZMIANA: Zmieniono nazwę funkcji na 'drawLevers' (liczba mnoga) i dodano rysowanie drugiej manetki
function drawLevers() {
    // Wspólne transformacje dla obu manetek
    ctx.save();
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    ctx.translate(centerX + gameState.shakeX, centerY + gameState.shakeY + gameState.cockpitVerticalOffset);
    ctx.rotate((gameState.tilt * Math.PI) / 560);
    ctx.scale(1.06, 1.06);
    ctx.translate(-centerX, -centerY);

    if (assets.controls.lever2 && assets.controls.lever2.complete) {
        ctx.save();
        const lever2Width = assets.controls.lever2.naturalWidth;
        const lever2Height = assets.controls.lever2.naturalHeight;
        const drawWidth = lever2Width * 1;
        const drawHeight = lever2Height * 1;

        // Używamy nowych zmiennych stanu dla pozycji i kąta manetki 2
        ctx.translate(controlsState.lever2X, controlsState.lever2Y);
        ctx.rotate(controlsState.lever2Angle);
        
        const drawOffsetX = -drawWidth / 2;
        const drawOffsetY = -drawHeight * 0.1;
        ctx.drawImage(assets.controls.lever2, drawOffsetX, drawOffsetY, drawWidth, drawHeight);
        ctx.restore();
    }

    // --- Rysowanie manetki 1 (kierunkowskazy) ---
    if (assets.controls.lever1 && assets.controls.lever1.complete) {
        ctx.save();
        const lever1Width = assets.controls.lever1.naturalWidth;
        const lever1Height = assets.controls.lever1.naturalHeight;
        const drawWidth = lever1Width * 1;
        const drawHeight = lever1Height * 1;

        ctx.translate(controlsState.leverX, controlsState.leverY);
        ctx.rotate(controlsState.leverAngle);
        
        const drawOffsetX = -drawWidth / 2;
        const drawOffsetY = -drawHeight * 0.1;
        ctx.drawImage(assets.controls.lever1, drawOffsetX, drawOffsetY, drawWidth, drawHeight);
        ctx.restore();
    }

    if (assets.controls.lever3 && assets.controls.lever3.complete) {
        ctx.save();
        const leverWidth = assets.controls.lever3.naturalWidth;
        const leverHeight = assets.controls.lever3.naturalHeight;
        // Używamy nowych zmiennych stanu dla pozycji i kąta
        ctx.translate(controlsState.lever3X, controlsState.lever3Y);
        ctx.rotate(controlsState.lever3Angle);
        ctx.drawImage(assets.controls.lever3, -leverWidth / 2, -leverHeight * 0.1, leverWidth, leverHeight);
        ctx.restore();
    }

    // --- Rysowanie manetki 2 (światła) ---

    
    // Końcowe przywrócenie kontekstu
    ctx.restore();
}


function updateAndDrawCarDust(deltaTime) {
    if (!assets.dust_blue.complete) return;
    const roadWidthTop = canvas.width * 0.001; const roadWidthBottom = canvas.width * 2.2;
    ctx.save();
    for (let i = gameState.carDustParticles.length - 1; i >= 0; i--) {
        const dust = gameState.carDustParticles[i];
        dust.lifetime += deltaTime;
        if (dust.lifetime >= dust.maxLifetime) { gameState.carDustParticles.splice(i, 1); continue; }
        const playerSpeedContribution = (gameState.speedKmH / gameState.maxSpeedKmH) * 0.12;
        dust.t += playerSpeedContribution * deltaTime;
        if (dust.t >= 1.1) { gameState.carDustParticles.splice(i, 1); continue; }
        
        const t = dust.t;
        const y = canvas.height * 0.35 + t * (canvas.height * 1.44);
        const perspectiveWidth = roadWidthTop + (roadWidthBottom - roadWidthTop) * t;
        const lateralOffset = -(gameState.playerX / gameState.maxOffset) * 1350 * t;
        const roadCenterX = canvas.width / 2 + lateralOffset;
        const x = roadCenterX - (perspectiveWidth * 0.23) + dust.xOffsetVariation * t;
        const progress = dust.lifetime / dust.maxLifetime;
        const sizeGrowth = dust.initialSize + progress * dust.growthRate;
        const currentSize = perspectiveWidth * sizeGrowth;
        const currentAlpha = dust.alpha * (1 - progress); 

        ctx.globalAlpha = currentAlpha;
        ctx.drawImage(assets.dust_blue, x - currentSize / 2, y - currentSize / 2 - (perspectiveWidth * 0.31), currentSize, currentSize);
    }
    ctx.restore();
}

function updateViewTransition(deltaTime) {
    // Jeśli przejście nie jest aktywne, nic nie rób
    if (!viewTransitionState.isActive) return;

    const state = viewTransitionState;
    const change = state.speed * deltaTime;

    // Faza 1: Ściemnianie ekranu (fade-out)
    if (state.phase === 'out') {
        state.progress += change;
        // Gdy ekran jest już całkowicie czarny...
        if (state.progress >= 1.0) {
            state.progress = 1.0;
            state.phase = 'in'; // Przełącz na fazę rozjaśniania

            // --- KLUCZOWY MOMENT I NOWA LOGIKA DŹWIĘKU ---
            // Właśnie teraz, w połowie przejścia, zmieniamy widok i dźwięk.
            currentView = state.targetView;
            console.log(`Widok zmieniony na: ${currentView}`);

            // 1. Zawsze wyłączamy wszystkie dźwięki silnika z kokpitu, żeby uniknąć konfliktów.
            stopAllEngineSounds();
            
            // 2. Włączamy lub wyłączamy dźwięk c_engineidle w zależności od nowego widoku.
            if (currentView === 'engine' || currentView === 'trunk') {
                // Jesteśmy w widoku silnika LUB bagażnika - włączamy dźwięk idle.
                if (audio.unlocked && audio.c_engineidle && audio.c_engineidle.paused) {
                    audio.c_engineidle.currentTime = 0;
                    audio.c_engineidle.volume = 0.6;
                    audio.c_engineidle.play().catch(e => console.warn("Nie udało się odtworzyć c_engineidle.mp3", e));
                }
            } else {
                // Jesteśmy w innym widoku (np. wracamy do kokpitu) - wyłączamy dźwięk idle.
                if (audio.c_engineidle && !audio.c_engineidle.paused) {
                    audio.c_engineidle.pause();
                }
                // Dźwięki jazdy dla kokpitu zostaną automatycznie wznowione przez główną pętlę gry.
            }

            // Pokaż lub ukryj przyciski interfejsu w zależności od nowego widoku
            if (currentView === 'cockpit') {
                showGameUIButtons();
            } else {
                hideGameUIButtons();
            }
        }
    } 
    // Faza 2: Rozjaśnianie ekranu (fade-in)
    else { // phase === 'in'
        state.progress -= change;
        // Gdy ekran jest już w pełni widoczny...
        if (state.progress <= 0) {
            state.progress = 0;
            state.isActive = false; // Zakończ i zresetuj przejście
        }
    }
}

/**
 * Rysuje na ekranie efekt ściemniania/rozjaśniania.
 * Należy ją wywołać na końcu pętli renderującej, aby znalazła się na wierzchu.
 */
function drawViewTransition() {
    // --- KLUCZOWA ZMIANA TUTAJ ---
    // Rysuj, jeśli efekt nie jest w pełni przezroczysty (progress > 0),
    // a nie tylko wtedy, gdy animacja jest aktywna.
    if (viewTransitionState.progress <= 0) {
        return;
    }

    // Używamy funkcji "ease-in-out" dla płynniejszego, nieliniowego efektu
    // Dzięki temu animacja będzie zwalniać na początku i na końcu.
    const easedProgress = 0.5 - 0.5 * Math.cos(viewTransitionState.progress * Math.PI);

    // Rysujemy czarny prostokąt z przezroczystością zależną od postępu animacji
    ctx.fillStyle = `rgba(0, 0, 0, ${easedProgress})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawEnemyCars() {
    const roadWidthTop = canvas.width * 0.001; const roadWidthBottom = canvas.width * 2.2;
    activeCars.sort((a, b) => a.t - b.t);

    for (const car of activeCars) {
        if (!car.image.complete || car.image.naturalWidth === 0) continue;
        const t = car.t; if (t < 0 || t >= 5) continue; 
        const y = canvas.height * 0.35 + t * (canvas.height * 1.44);
        const width = roadWidthTop + (roadWidthBottom - roadWidthTop) * t;
        const lateralOffset = -(gameState.playerX / gameState.maxOffset) * 1350 * t;
        const roadCenterX = canvas.width / 2 + lateralOffset;
        const x = roadCenterX - (width * 0.25) + car.xOffsetVariation * t;
        const objSize = width * 0.59; 
        const baseDrawWidth = Math.round(objSize);
        const baseDrawHeight = Math.round(objSize * (car.image.naturalHeight / car.image.naturalWidth));
        const baseDrawX = Math.round(x - baseDrawWidth / 2);
        const baseDrawY = Math.round(y - baseDrawHeight);
        
        const flipZoneStart = -600; const flipZoneEnd = 20; const flipAxis = (flipZoneStart + flipZoneEnd) / 2;
        const minHorizontalScale = 0.8; const mirrorScale = 1; const minAlpha = 0.7;

        let horizontalScale = 1.0, verticalScale = 1, alpha = 1.0, needsMirror = false;
        if (gameState.playerX > flipZoneStart) {
            let progress = (gameState.playerX - flipZoneStart) / (flipZoneEnd - flipZoneStart);
            progress = Math.max(0, Math.min(1, progress));
            let scaleProgress = Math.abs(Math.cos(progress * Math.PI));
            horizontalScale = minHorizontalScale + (1 - minHorizontalScale) * scaleProgress;
            alpha = minAlpha + (1 - minAlpha) * scaleProgress;
            verticalScale = 1.01 + (mirrorScale - 1.0) * progress;
            if (gameState.playerX > flipAxis) needsMirror = true;
        }
        
        const finalDrawWidth = baseDrawWidth * horizontalScale * verticalScale;
        const finalDrawHeight = baseDrawHeight * verticalScale;
        const finalDrawX = baseDrawX + (baseDrawWidth - finalDrawWidth) / 2;
        const finalDrawY = baseDrawY + (baseDrawHeight - finalDrawHeight);
        
        ctx.save();
        ctx.globalAlpha = alpha;
        if (needsMirror) {
            ctx.scale(-1, 1);
            ctx.drawImage(car.image, -finalDrawX - finalDrawWidth, finalDrawY, finalDrawWidth, finalDrawHeight);
        } else {
            ctx.drawImage(car.image, finalDrawX, finalDrawY, finalDrawWidth, finalDrawHeight);
        }
        ctx.restore();
    }
}
const groundObjects = { left: [], right: [] };

let windTime = 0;
let totalDistanceTraveled = STARTING_DISTANCE_METERS;
const activeSigns = []; 

const indicatorPositions = {
    acu:    { x: 701, y: 704, width: 46, height: 46 },
    oil:    { x: 698, y: 714, width: 47, height: 46 },
    lights: { x: 709, y: 657, width: 40, height: 44 },
    stop:   { x: 734, y: 658, width: 42, height: 44 },
    long:   { x: 705, y: 672, width: 40, height: 40 },
    hazard: { x: 704, y: 689, width: 40, height: 40 },
    blink:  { x: 730, y: 686, width: 44, height: 44 },
};

// ZMIANA: Dodano nowe stany dla drugiej manetki
const controlsState = {
    blinkerTimer: 0, blinkerVisible: false, acuTimer: 5 + Math.random() * 3, isAcuProblemActive: false,
    lightsOn: false, longLightsOn: false, hazardOn: false, leftBlinkerOn: false, rightBlinkerOn: false,
    
    // Stan dla manetki 1 (kierunkowskazy)
    leverX: 710, leverY: 766, leverAngle: 0, leverTargetAngle: 0,
    leverBaseAngle: 0.01, leverLeftAngle: -0.06, leverRightAngle: 0.12,
    
    // NOWY KOD: Stan dla manetki 2 (światła)
    lever2X: 810, lever2Y: 756, // Pozycja obok lever1
    lever2BaseX: 730, // Podstawowa pozycja X
    lever2TargetX: 730, // Docelowa pozycja X (do animacji)
    lever2Angle: 0, lever2TargetAngle: 0,
    lever2BaseAngle: 0.1,
    lever2LightsOnAngle: 0.15, // Kąt dla świateł 'L'
    lever2LongLightsOnAngle: 0.30, // Kąt dla świateł 'K'
    lever2LongLightsOnXOffset: 15, // Przesunięcie w prawo dla 'K'
    
    // Wspólny współczynnik animacji
    leverEaseFactor: 0.25,

        lever3X: 890, lever3Y: 761, // Pozycja obok lever2
    lever3BaseX: 890,          // Pozycja X w spoczynku
    lever3ActiveX: 875,        // Pozycja X, gdy włączone (przesunięcie w lewo)
    lever3TargetX: 890,        // Docelowa pozycja X (do animacji)
    lever3Angle: 0,            // Aktualny kąt
    lever3BaseAngle: -0.15,        // Kąt w spoczynku
    lever3ActiveAngle: -0.25,  // Kąt, gdy włączone (odbicie w lewo)
    lever3TargetAngle: 0,      // Docelowy kąt (do animacji)
    // --- KONIEC NOWEGO KODU ---
    
    // Wspólny współczynnik animacji

};


const gameState = {
  // --- NOWE WŁAŚCIWOŚCI ---
  oilAmount: 60,           // Poziom oleju w procentach (0-100)
  engineSeized: false,        // Czy silnik jest zatarty (trwałe uszkodzenie)
  // --- KONIEC NOWYCH WŁAŚCIWOŚCI ---

  // === POCZĄTEK TWOJEJ POPRAWKI ===
  // Akumulator dystansu (w metrach), który będzie zerowany co kilometr.
  distanceForSoberingUp: 0,
  // === KONIEC TWOJEJ POPRAWKI ===

  speedKmH: 0, maxSpeedKmH: 116, accelerationKmH: 0.067, decelerationKmH: 0.65, decelerationIdleKmH: 0.04,
  overheatSoundPlayed: false, // Usunięto stąd engineSeized, bo jest teraz na górze
  dustEffect: [], carDustParticles: [], 
  temperature: 100, minTemperature: 100, maxTemperature: 150, temperatureIncreaseRate: 0.01, 
  temperatureDecreaseRate: 0.003, isOverheating: false, playerX: 0, maxOffset: 600,
  tilt: 0, tiltTarget: 0, steeringAngle: 0, maxSteeringAngle: 3600, carDirection: 0,
  carDirectionSpeed: 0, roadOffsetY: 0, roadsideMaxSlices: 2000,
  shakeX: 0, shakeY: 0, shakeTime: 0, cockpitVerticalOffset: 0, cockpitVerticalTarget: 0,
  autoTurnTarget: 0, autoTurnAngle: 0, autoTurnTimer: 0,
  isInGrass: false, grassEffectTimer: 0, activeBlades: [],
  grassSlowdownFactor: 0, wasInGrass: false, grassSoundPlayed: false, 
  mouseX: 0, mouseY: 0, isInCity: false, gear: 'N',
  rpm: 800, maxRpm: 10000,
  crashState: {
    active: false, effectTimer: 0, initialEffectDuration: 10, fadeToBlackDuration: 6,
    showTextDelay: 1.5, textFadeInDuration: 4, crashShakeIntensity: 38, crashShakeDuration: 4.5,
  },
  passingShake: { currentIntensity: 0, smoothingFactor: 0.05 },
  overheatShake: { active: false, timer: 0, duration: 0.7, intensity: 8.5 },
  gearShiftShake: { active: false, timer: 0, duration: 0.19, intensity: 3.4 },
  collisionShake: { active: false, timer: 0, duration: 0.4, intensity: 22 },
  opponentTargetVolume: 0.0,
};



const controls = { w: false, s: false, a: false, d: false };
const grassObjects = { left: [], right: [] };
const secondGrassObjects = { left: [], right: [] };

let mapVisible = false, mapScale = 0, mapOffsetX = 0, mapOffsetY = 0;
let photoVisible = false, photoScale = 0, photoOffsetX = 0, photoOffsetY = 0;
let carSignVisible = false, carSignScale = 0, carSignOffsetX = 0, carSignOffsetY = 0;
const maxOverlayScale = 1.4, minOverlayScale = 0.65;
let isOverlayDragging = false, lastOverlayDragX = 0, lastOverlayDragY = 0;

// --- ZMIANA: Przebudowa na mapę-harmonijkę ---

const NUM_MAP_STRIPS = 6; // Liczba pasków na mapę

// 1. NOWY STAN DLA MAPY-HARMONIJKI
const mapAccordionState = {
    isHeld: false,
    strips: [],
    velocities: [],
    
    // --- NOWA WŁAŚCIWOŚĆ ---
    stiffProgress: 0.9, // Przechowuje "sztywny" postęp animacji, bez sprężynowania

    restAngle: 0.09,
    heldAngle: 0.02,
    stiffness: 0.08,
    damping: 0.57,
};

// Inicjalizacja stanów dla każdego paska
for (let i = 0; i < NUM_MAP_STRIPS; i++) {
    mapAccordionState.strips.push({ angle: 0 });
    mapAccordionState.velocities.push(0);
}

// 2. NOWY OBIEKT NA OBRAZY MAPY I ICH ŁADOWANIE
const mapImages = {
    current: 0, // 0 dla 'map1', 1 dla 'map2'
    versions: {
        map1: [], // Tablica na 6 obrazów dla mapy 1
        map2: []  // Tablica na 6 obrazów dla mapy 2
    }
};

// Ładowanie obrazów dla pierwszej mapy (map_1.png, map_2.png, ...)
for (let i = 1; i <= NUM_MAP_STRIPS; i++) {
    const img = new Image();
    // Upewnij się, że pliki znajdują się w folderze ``
    img.src = `map_${i}.png`; 
    mapImages.versions.map1.push(img);
}

// Ładowanie obrazów dla drugiej mapy (map2_1.png, map2_2.png, ...)
for (let i = 1; i <= NUM_MAP_STRIPS; i++) {
    const img = new Image();
    // Upewnij się, że pliki znajdują się w folderze ``
    img.src = `map2_${i}.png`; 
    mapImages.versions.map2.push(img);
}

// --- NOWY KOD: Funkcje pomocnicze do zarządzania widocznością przycisków UI ---
function showGameUIButtons() {
    const mapButton = document.getElementById('mapButton');
    const photoButton = document.getElementById('photoButton');
    const carSignButton = document.getElementById('carSignButton');
    if (mapButton) mapButton.style.display = 'block';
    if (photoButton) photoButton.style.display = 'block';
    if (carSignButton) carSignButton.style.display = 'block';
}

function hideGameUIButtons() {
    const mapButton = document.getElementById('mapButton');
    const photoButton = document.getElementById('photoButton');
    const carSignButton = document.getElementById('carSignButton');
    if (mapButton) mapButton.style.display = 'none';
    if (photoButton) photoButton.style.display = 'none';
    if (carSignButton) carSignButton.style.display = 'none';
}
// --- KONIEC NOWEGO KODU ---

function updateButtonPositions() {
  const rect = canvas.getBoundingClientRect(); const scaleX = rect.width / canvas.width; const scaleY = rect.height / canvas.height;
  const mapButton = document.getElementById('mapButton');
  if (mapButton) { const mapCanvasX = canvas.width - 660, mapCanvasY = 970; mapButton.style.left = `${rect.left + mapCanvasX * scaleX}px`; mapButton.style.top = `${rect.top + mapCanvasY * scaleY}px`; mapButton.style.width = `${150 * scaleX}px`; mapButton.style.height = `${80 * scaleY}px`; }
  const photoButton = document.getElementById('photoButton');
  if (photoButton) { const photoCanvasX = 5, photoCanvasY = 730; photoButton.style.left = `${rect.left + photoCanvasX * scaleX}px`; photoButton.style.top = `${rect.top + photoCanvasY * scaleY}px`; photoButton.style.width = `${110 * scaleX}px`; photoButton.style.height = `${120 * scaleY}px`; }
  const carSignButton = document.getElementById('carSignButton');
  if (carSignButton) { const carSignCanvasX = canvas.width - 840, carSignCanvasY = 840; carSignButton.style.left = `${rect.left + carSignCanvasX * scaleX}px`; carSignButton.style.top = `${rect.top + carSignCanvasY * scaleY}px`; carSignButton.style.width = `${70 * scaleX}px`; carSignButton.style.height = `${70 * scaleY}px`; }
}
window.updateButtonPositions = updateButtonPositions;
function createMapButton() { const button = document.createElement('button'); button.id = 'mapButton'; button.style.position = 'absolute'; button.style.zIndex = '1000'; button.style.backgroundColor = "rgba(65, 65, 65, 0)"; button.style.border = 'none'; button.style.cursor = 'pointer'; button.addEventListener('click', toggleMap); document.body.appendChild(button); }
function createPhotoButton() { const button = document.createElement('button'); button.id = 'photoButton'; button.style.position = 'absolute'; button.style.zIndex = '1000'; button.style.backgroundColor = "rgba(65, 65, 65, 0)"; button.style.border = 'none'; button.style.cursor = 'pointer'; button.addEventListener('click', togglePhoto); document.body.appendChild(button); }
function createCarSignButton() { const button = document.createElement('button'); button.id = 'carSignButton'; button.style.position = 'absolute'; button.style.zIndex = '1000'; button.style.backgroundColor = "rgba(65, 65, 65, 0)"; button.style.border = 'none'; button.style.cursor = 'pointer'; button.addEventListener('click', toggleCarSign); document.body.appendChild(button); }
function toggleMap() { photoVisible = false; carSignVisible = false; docOverlayVisible = false; mapVisible = !mapVisible; if (mapVisible) { mapScale = 0.65; mapOffsetX = 0; mapOffsetY = 0; if (audio.unlocked) { audio.map.currentTime = 0; audio.map.volume = 0.5; audio.map.play().catch(() => {}); } } }
function togglePhoto() { mapVisible = false; carSignVisible = false; docOverlayVisible = false; photoVisible = !photoVisible; if (photoVisible) { photoScale = 1.1; photoOffsetX = 0; mapOffsetY = 0; if (audio.unlocked) { audio.map.currentTime = 0; audio.map.volume = 0.5; audio.map.play().catch(() => {}); } } }
function toggleCarSign() { mapVisible = false; photoVisible = false; docOverlayVisible = false; carSignVisible = !carSignVisible; if (carSignVisible) { carSignScale = 1.0; carSignOffsetX = 0; carSignOffsetY = 0; if (audio.unlocked) { audio.map.currentTime = 0; audio.map.volume = 0.5; audio.map.play().catch(() => {}); } } }

// --- NOWA FUNKCJA DO OBSŁUGI NAKŁADKI DOKUMENTU ---
function toggleDocOverlay() {
    // Ukrywamy inne nakładki
    mapVisible = false;
    photoVisible = false;
    carSignVisible = false;
    // Przełączamy widoczność nakładki dokumentu
    docOverlayVisible = !docOverlayVisible;
    // Jeśli staje się widoczna, resetujemy jej stan
    if (docOverlayVisible) {
        docOverlayScale = 1.0; // Domyślna skala
        docOverlayOffsetX = 0;
        docOverlayOffsetY = 0;
        // Odtwarzamy dźwięk, tak jak przy mapie
        if (audio.unlocked) {
            audio.map.currentTime = 0;
            audio.map.volume = 0.5;
            audio.map.play().catch(() => {});
        }
    }
}

function handleOverheatedSounds() {
  if (gameState.isOverheating && !gameState.crashState.active) {
    audio.idle.pause(); 
    audio.ac.pause(); 
    audio.reduction.pause(); 
    audio.breaking.pause();
    
    // --- POPRAWKA: Ustawiamy .muted na true, ale nigdy na false ---
    // W ten sposób szanujemy globalne wyciszenie z menu.
    audio.idle.muted = true; 
    audio.ac.muted = true; 
    audio.reduction.muted = true; 
    audio.breaking.muted = true;

    audio.carbackground.pause();
    if (!gameState.overheatSoundPlayed && audio.unlocked) {
      audio.boom.currentTime = 0; 
      audio.boom.volume = 0.7; 
      audio.boom.play().catch(() => {});
      gameState.overheatSoundPlayed = true;
    }
  } else if (!gameState.crashState.active) {
    // --- POPRAWKA: Usunięto wszystkie linie "audio.sound.muted = false;" ---
    // Dzięki temu ustawienie z menu nie jest już nadpisywane w każdej klatce.
    gameState.overheatSoundPlayed = false;
    if (audio.unlocked && audio.carbackground.paused) {
        audio.carbackground.play().catch(() => {});
    }
  }
}


function handleOverlayZoom(e) { 
    // --- ZMIANA: Dodajemy docOverlayVisible do warunku ---
    if (!mapVisible && !photoVisible && !carSignVisible && !docOverlayVisible) return;
    
    e.preventDefault(); 
    const delta = Math.sign(e.deltaY); 
    
    if (mapVisible) { 
        if (delta < 0) { mapScale = Math.min(maxOverlayScale, mapScale + 0.03); } 
        else { mapScale = Math.max(minOverlayScale, mapScale - 0.065); } 
    } else if (photoVisible) { 
        if (delta < 0) { photoScale = Math.min(maxOverlayScale, photoScale + 0.03); } 
        else { photoScale = Math.max(minOverlayScale, photoScale - 0.065); } 
    } else if (carSignVisible) { 
        if (delta < 0) { carSignScale = Math.min(maxOverlayScale, carSignScale + 0.03); } 
        else { carSignScale = Math.max(minOverlayScale, carSignScale - 0.065); } 
    // --- NOWY KOD: Obsługa zoomu dla nakładki dokumentu ---
    } else if (docOverlayVisible) {
        if (delta < 0) { docOverlayScale = Math.min(maxOverlayScale, docOverlayScale + 0.03); } 
        else { docOverlayScale = Math.max(minOverlayScale, docOverlayScale - 0.065); }
    }
}

function handleRadioVolumeScroll(e) {
    e.preventDefault();
    const delta = Math.sign(e.deltaY);
    const oldVolume = radioState.volume;

    if (delta < 0) { // Scroll up
        radioState.volume = Math.min(10, radioState.volume + 0.5);
    } else { // Scroll down
        radioState.volume = Math.max(0, radioState.volume - 1);
    }

    // --- NA TĘ LINIĘ (z dodatkowym warunkiem) ---
    if (oldVolume !== radioState.volume && audio.unlocked && audio.scroll && currentView === 'cockpit') {
        audio.scroll.currentTime = 0;
        audio.scroll.play().catch(e => console.warn("Failed to play scroll sound:", e));
    }
}

function applyBlurEffect() {
    if (motionBlurCanvas.width !== canvas.width || motionBlurCanvas.height !== canvas.height) {
         motionBlurCanvas.width = canvas.width;
         motionBlurCanvas.height = canvas.height;
    }
    motionBlurCtx.clearRect(0, 0, motionBlurCanvas.width, motionBlurCanvas.height);
    motionBlurCtx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.filter = 'blur(4px) brightness(1)';
    ctx.drawImage(motionBlurCanvas, 0, 0);
    ctx.restore();
}

function drawMap() {
    if (!mapVisible) return;

    // 1. Wybierz odpowiedni zestaw pasków
    const currentMapKey = mapImages.current === 0 ? 'map1' : 'map2';
    const currentStrips = mapImages.versions[currentMapKey];

    // Sprawdź, czy grafiki są gotowe
    if (currentStrips.length !== NUM_MAP_STRIPS || currentStrips.some(img => !img.complete || img.naturalWidth === 0)) {
        return;
    }

    ctx.save(); // Zapis 1: Globalne transformacje

    // 2. Zastosuj globalne transformacje (przesunięcie, skala, kołysanie)
    const totalMapWidth = canvas.width * 0.723 * mapScale;
    const totalMapHeight = canvas.height * 1.515 * mapScale;
    const mapX = (canvas.width - totalMapWidth) / 2 + mapOffsetX;
    const mapY = (canvas.height - totalMapHeight) / 2 + mapOffsetY;
    
    // Globalne kołysanie całej mapy
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(mapSwayAngle);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    // Przesunięcie do lewego-górnego rogu całej mapy
    ctx.translate(mapX, mapY);

    // 3. Rysuj każdy pasek z osobna, korygując pozycję
    const stripWidth = totalMapWidth / NUM_MAP_STRIPS;
    let currentX = 0;

    for (let i = 0; i < NUM_MAP_STRIPS; i++) {
        const stripImage = currentStrips[i];
        const stripState = mapAccordionState.strips[i];
        // Pochylenie nadal jest sterowane przez sprężystą wartość `angle`
        const skewAngle = stripState.angle * 3;
        
        ctx.save(); // Zapis 2: Indywidualne transformacje paska

        if (i % 2 !== 0) { // Logika dla pasków 2, 4, 6
            // --- ZMIANA: Używamy teraz "sztywnego" postępu ---
            const foldProgress = mapAccordionState.stiffProgress;
            
            // Logika przesunięcia i jasności pozostaje taka sama, ale jest teraz sterowana
            // przez `foldProgress`, które nie ma w sobie efektu "sprężynowania".
            const foldedOffset = 65;
            const heldOffset = 15;
            const interpolatedOffset = heldOffset + (foldedOffset - heldOffset) * foldProgress;
            const verticalOffset = interpolatedOffset * mapScale;
            
            const normalBrightness = 0.92;
            const darkBrightness = 0.7;
            const interpolatedBrightness = normalBrightness + (darkBrightness - normalBrightness) * foldProgress;
            
            // Przesuń i przyciemnij za jednym razem
            ctx.filter = `brightness(${interpolatedBrightness})`;
            ctx.translate(0, verticalOffset); // Zastosuj sztywne przesunięcie pionowe
        }

        const skewFactor = Math.tan(skewAngle);
        const topEdgeOffset = skewFactor ;

        // Używamy transformacji już tylko do pochylenia i pozycjonowania w X
        ctx.transform(
            1,           
            skewFactor,  
            0,           
            1,           
            currentX - topEdgeOffset,
            0 // Przesunięcie pionowe jest już obsłużone przez `ctx.translate`
        );

        ctx.drawImage(stripImage, 0, 0, stripWidth, totalMapHeight);
        ctx.restore(); 
        
        currentX += stripWidth;
    }

    ctx.restore();
}

function drawPhoto() { if (!photoVisible || !assets.photo.complete) return; ctx.save(); const photoAspectRatio = assets.photo.naturalWidth / assets.photo.naturalHeight; let photoHeight = canvas.height * 0.8 * photoScale; let photoWidth = photoHeight * photoAspectRatio; let photoX = (canvas.width - photoWidth) / 2 + photoOffsetX; let photoY = (canvas.height - photoHeight) / 2 + photoOffsetY; ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(mapSwayAngle); ctx.translate(-canvas.width / 2, -canvas.height / 2); ctx.drawImage(assets.photo, photoX, photoY, photoWidth, photoHeight); ctx.fillStyle = 'white'; ctx.font = '24px Arial'; ctx.textAlign = 'center'; ctx.restore(); ctx.restore(); }
function drawCarSign() { if (!carSignVisible || !assets.carSign.complete) return; ctx.save(); const signAspectRatio = assets.carSign.naturalWidth / assets.carSign.naturalHeight; let signHeight = canvas.height * 0.7 * carSignScale; let signWidth = signHeight * signAspectRatio; let signX = (canvas.width - signWidth) / 2 + signOffsetX; let signY = (canvas.height - signHeight) / 2 + carSignOffsetY; ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(mapSwayAngle); ctx.translate(-canvas.width / 2, -canvas.height / 2); ctx.drawImage(assets.carSign, signX, signY, signWidth, signHeight); ctx.restore(); ctx.restore(); }

// --- NOWA FUNKCJA DO RYSOWANIA NAKŁADKI DOKUMENTU ---
function drawDocOverlay() {
    const currentImage = docOverlayImages.images[docOverlayImages.current];
    if (!docOverlayVisible || !currentImage.complete || currentImage.naturalWidth === 0) return;

    ctx.save();
    
    // Obliczenia wymiarów i pozycji, analogicznie do drawPhoto
    const aspectRatio = currentImage.naturalWidth / currentImage.naturalHeight;
    let docHeight = canvas.height * 0.9 * docOverlayScale; // Nieco większa niż zdjęcie
    let docWidth = docHeight * aspectRatio;
    let docX = (canvas.width - docWidth) / 2 + docOverlayOffsetX;
    let docY = (canvas.height - docHeight) / 2 + docOverlayOffsetY;

    // Aplikowanie kołysania
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(mapSwayAngle);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    
    // Rysowanie obrazu
    ctx.drawImage(currentImage, docX, docY, docWidth, docHeight);
    
    ctx.restore(); // Przywrócenie po kołysaniu
    ctx.restore(); // Główne przywrócenie
}

function checkIfInGrass() { return Math.abs(gameState.playerX) > 450; }
function createGrassEffect() { if (!assets.blades.complete || !assets.dust.complete) return; const x = Math.random() * canvas.width; const y = canvas.height * 0.4 + Math.random() * canvas.height * 0.45; const size = 40 + Math.random() * 270; const rotation = Math.random() * Math.PI * 2; const rotationSpeed = (Math.random() - 0.5) * 0.2; gameState.activeBlades.push({ x: x, y: y, size: size, rotation: rotation, rotationSpeed: rotationSpeed, lifetime: 0, maxLifetime: 0.8, type: 'blades' }); if (Math.random() > 0.5) { const dustX = Math.random() * canvas.width; const dustY = canvas.height * 0.6 + Math.random() * canvas.height * 0.3; const dustSize = 200 + Math.random() * 450; gameState.activeBlades.push({ x: dustX, y: dustY, size: dustSize, rotation: 0, rotationSpeed: 0, lifetime: 0, maxLifetime: 1.0, type: 'dust' }); } }

function updateGrassEffects(deltaTime) {
    gameState.isInGrass = checkIfInGrass();
    if (gameState.isInGrass && gameState.speedKmH > 2) {
        if (audio.unlocked && audio.gravel.paused) { audio.gravel.currentTime = 0; audio.gravel.volume = 0.6; audio.gravel.play().catch(() => {}); }
        gameState.grassSlowdownFactor = 0.1;
        gameState.grassEffectTimer += deltaTime;
        if (gameState.grassEffectTimer >= 0.04) {
            gameState.grassEffectTimer = 0;
            createGrassEffect(); if (Math.random() > 0.3) createGrassEffect(); if (Math.random() > 0.5) createGrassEffect(); if (Math.random() > 0.7) createGrassEffect();
        }
    } else {
        if (!audio.gravel.paused) audio.gravel.pause();
        gameState.grassSlowdownFactor = 1;
        gameState.grassEffectTimer = 0;
    }
    for (let i = gameState.activeBlades.length - 1; i >= 0; i--) {
        const blade = gameState.activeBlades[i];
        blade.lifetime += deltaTime; blade.rotation += blade.rotationSpeed;
        if (blade.lifetime >= blade.maxLifetime) gameState.activeBlades.splice(i, 1);
    }
}

// --- NOWY KOD: FUNKCJE DO OBSŁUGI PTAKÓW ---

/**
 * Tworzy nowe stado ptaków i dodaje je do tablicy `activeBirds`.
 */
function spawnBirdFlock() {
    if (!assets.bird1.complete || !assets.bird2.complete) return;

    // Losowa liczba ptaków w stadzie, od 2 do 20
    const flockSize = 2 + Math.floor(Math.random() * 9);

    // Pozycja startowa lidera klucza. Zaczynają za lewą krawędzią ekranu.
    const leaderStartX = -100 - Math.random() * 200;
    // Pozycja "w miarę u góry" na niebie.
    const leaderStartY = 80 + Math.random() * 250;

    // Bazowa prędkość w osi X dla całego stada (w pikselach na sekundę)
    const baseSpeedX = 120 + Math.random() * 50;

    for (let i = 0; i < flockSize; i++) {
        // Obliczanie pozycji w formacji "V"
        const wingIndex = Math.ceil(i / 2); // Jak daleko od lidera na skrzydle klucza
        const side = (i % 2 === 0) ? 1 : -1; // Strona klucza (lewa/prawa)

        const newBird = {
            // Pozycja startowa z uwzględnieniem formacji "V" i losowości
            x: leaderStartX - wingIndex * (20 + Math.random() * 20),
            baseY: leaderStartY + wingIndex * (10 + Math.random() * 10) * side,
            y: 0, // y będzie obliczane na bieżąco z baseY i sway
            
            // Prędkość z lekką losowością dla każdego ptaka
            vx: baseSpeedX + (Math.random() - 0.5) * 50,
            
            // Lekka rotacja i dryfowanie
            angle: 0,
            rotationSpeed: (Math.random() - 0.5) * 0.1, // Prędkość obrotu
            
            // Rozmiar (malutkie, bo daleko)
            size: 5 + Math.random() * 7,
            
            // Aktualny obrazek do animacji machania skrzydłami
            image: assets.bird1,
            animationTimer: 0,
            animationSpeed: 5 + Math.random() * 10, // Różna prędkość machania (klatek na sekundę)
            
            // Parametry do nieregularnego lotu (góra/dół)
            swayTimer: Math.random() * 100, // Losowa faza startowa, żeby nie ruszały się identycznie
            swayAmplitude: 5 + Math.random() * 15, // Jak bardzo odchyla się od bazowej trasy Y
            swayFrequency: 0.5 + Math.random() * 1.5, // Jak często zmienia kierunek góra/dół
        };
        newBird.y = newBird.baseY; // Ustawienie początkowej pozycji Y
        activeBirds.push(newBird);
    }
}

/**
 * Aktualizuje stan wszystkich ptaków (pozycja, animacja, usuwanie).
 */
function updateBirds(deltaTime) {
    // 1. Logika spawnera: Czy nadszedł czas, by stworzyć nowe stado?
    birdSpawner.timeSinceLastSpawn += deltaTime * 400; // Konwersja na milisekundy
    if (birdSpawner.timeSinceLastSpawn >= birdSpawner.nextSpawnTime) {
        spawnBirdFlock();
        // Reset timera i ustawienie nowego losowego czasu oczekiwania
        birdSpawner.timeSinceLastSpawn = 0;
        birdSpawner.nextSpawnTime = birdSpawner.minInterval + Math.random() * (birdSpawner.maxInterval - birdSpawner.minInterval);
    }

    // 2. Aktualizacja każdego ptaka w tablicy `activeBirds`
    // Pętla od tyłu jest bezpieczniejsza, gdy usuwamy elementy z tablicy w trakcie iteracji.
    for (let i = activeBirds.length - 1; i >= 0; i--) {
        const bird = activeBirds[i];

        // Aktualizacja pozycji X
        bird.x += bird.vx * deltaTime;

        // Aktualizacja nieregularnego ruchu w osi Y (efekt "pływania" w powietrzu)
        bird.swayTimer += deltaTime;
        bird.y = bird.baseY + Math.sin(bird.swayTimer * bird.swayFrequency) * bird.swayAmplitude;

        // Aktualizacja lekkiej rotacji
        bird.angle += bird.rotationSpeed * deltaTime;
        
        // Aktualizacja animacji machania skrzydłami
        bird.animationTimer += deltaTime;
        if (bird.animationTimer > 1 / bird.animationSpeed) {
            bird.image = (bird.image === assets.bird1) ? assets.bird2 : assets.bird1;
            bird.animationTimer = 0;
        }

        // Sprawdzenie, czy ptak wyleciał za prawą krawędź ekranu
        if (bird.x > canvas.width + 50) {
            activeBirds.splice(i, 1); // Usunięcie ptaka z tablicy
        }
    }
}

/**
 * Rysuje wszystkie aktywne ptaki na canvasie.
 */
function drawBirds() {
    for (const bird of activeBirds) {
        ctx.save();
        ctx.translate(bird.x, bird.y);
        ctx.rotate(bird.angle);
        // Rysujemy obrazek, centrując go na jego koordynatach (x,y)
        ctx.drawImage(bird.image, -bird.size / 2, -bird.size / 2, bird.size, bird.size);
        ctx.restore();
    }
}
// --- KONIEC NOWEGO KODU ---

function drawDustEffect() { if (!assets.dust_blue.complete) return; if (Math.random() < 0.3) { gameState.dustEffect.push({ x: canvas.width / 22.0 + (Math.random() - 0.5) * 200, y: canvas.height * 1.15 + (Math.random() - 0.5) * 100, size: 450 + Math.random() * 980, alpha: 0.4 + Math.random() * 0.9, lifetime: 0, maxLifetime: 2 + Math.random() * 3, velocityX: 1.0 + Math.random() * 0.4, velocityY: 1.8 + Math.random() * 0.4 }); } ctx.save(); for (let i = gameState.dustEffect.length - 1; i >= 0; i--) { const dust = gameState.dustEffect[i]; dust.lifetime += 1 / 60; dust.x += dust.velocityX; dust.y -= dust.velocityY; if (dust.lifetime >= dust.maxLifetime) { gameState.dustEffect.splice(i, 1); continue; } const progress = dust.lifetime / dust.maxLifetime; const currentAlpha = dust.alpha * (1 - progress); ctx.globalAlpha = currentAlpha; ctx.drawImage(assets.dust_blue, dust.x - dust.size / 2, dust.y - dust.size / 2, dust.size, dust.size); } ctx.restore(); }
function drawGrassEffects() { if (!assets.blades.complete || !assets.dust.complete) return; ctx.save(); for (const blade of gameState.activeBlades) { const alpha = 1 - (blade.lifetime / blade.maxLifetime); ctx.globalAlpha = alpha; ctx.save(); ctx.translate(blade.x, blade.y); if (blade.type === 'blades') { ctx.rotate(blade.rotation); } const img = blade.type === 'blades' ? assets.blades : assets.dust; ctx.drawImage(img, -blade.size / 1.2, -blade.size / 1.4, blade.size, blade.size); ctx.restore(); } ctx.restore(); }
function initGroundObjects() { const screenSpacing = 50; const minSliceGap = 0.6; const maxSliceGap = 250; let currentSlice = 0; while (currentSlice < gameState.roadsideMaxSlices) { const t = 1 - currentSlice / gameState.roadsideMaxSlices; const sliceGap = minSliceGap + (maxSliceGap - minSliceGap) * t; const sizeVariation = 0.4; const posVariationX = Math.random() * 1 - 5; const posVariationY = 1; groundObjects.left.push({ sliceIndex: currentSlice, side: "left", sizeVariation: sizeVariation, posVariationX: posVariationX, posVariationY: posVariationY }); groundObjects.right.push({ sliceIndex: currentSlice, side: "right", sizeVariation: sizeVariation, posVariationX: posVariationX, posVariationY: posVariationY }); currentSlice += sliceGap; } }
initGroundObjects();
function drawGround() { if (!assets.ground.complete) return; const roadWidthTop = canvas.width * 0.001; const roadWidthBottom = canvas.width * 2.2; const allGround = [...groundObjects.left, ...groundObjects.right]; allGround.sort((a, b) => b.sliceIndex - a.sliceIndex); for (let ground of allGround) { const t = 1 - ground.sliceIndex / gameState.roadsideMaxSlices; const y = canvas.height * 0.35 + t * (canvas.height * 1.27); const width = roadWidthTop + (roadWidthBottom - roadWidthTop) * t; const lateralOffset = -(gameState.playerX / gameState.maxOffset) * 2440 * t; const roadLeftX = (canvas.width - width) / 2 + lateralOffset+ 4; const roadRightX = roadLeftX + width; const baseSize = width * 0.02; const objSize = baseSize * ground.sizeVariation * 50; let x; const img = assets.ground; if (ground.side === "left") { x = roadLeftX - objSize * 0.5 + ground.posVariationX; } else { x = roadRightX + objSize * 0.5 + ground.posVariationX; } if (y < canvas.height && y > canvas.height * 0.35 - objSize) { ctx.drawImage(img, x - objSize / 2, y - objSize + ground.posVariationY, objSize, objSize); } } }
function updateGround(speedKmH) { const allGround = [...groundObjects.left, ...groundObjects.right]; for (let ground of allGround) { const t = 1 - ground.sliceIndex / gameState.roadsideMaxSlices; const speedMultiplier = 0.10 + 85.4 * t; ground.sliceIndex -= (speedKmH / gameState.maxSpeedKmH) * speedMultiplier; if (ground.sliceIndex < 0) ground.sliceIndex = gameState.roadsideMaxSlices; } }
function initSecondGrassObjects() { const minSliceGap = 0.38; const maxSliceGap = 130; let currentSlice = 0; while (currentSlice < gameState.roadsideMaxSlices) { const t = 1 - currentSlice / gameState.roadsideMaxSlices; const sliceGap = minSliceGap + (maxSliceGap - minSliceGap) * t; const sizeVariation = 0.6 + Math.random() * 0.347; const posVariationX = Math.random() * 25 - 5; const posVariationY = Math.random() * 6 - 1; const swayProps = { swayFrequency: 0.4 + Math.random() * 3.4, swayAmplitude: 0.06 + Math.random() * 0.3, swayPhase: Math.random() * Math.PI * 3 }; secondGrassObjects.left.push({ sliceIndex: currentSlice, side: "left", sizeVariation, posVariationX, posVariationY, ...swayProps }); secondGrassObjects.right.push({ sliceIndex: currentSlice, side: "right", sizeVariation, posVariationX, posVariationY, ...swayProps }); currentSlice += sliceGap; } }
initSecondGrassObjects();
function drawSecondGrass() { if (!assets.secondGrassLeft.complete || !assets.secondGrassRight.complete) return; const roadWidthTop = canvas.width * 0.004; const roadWidthBottom = canvas.width * 2.5; const allGrass = [...secondGrassObjects.left, ...secondGrassObjects.right]; allGrass.sort((a, b) => b.sliceIndex - a.sliceIndex); for (let grass of allGrass) { const t = 1 - grass.sliceIndex / gameState.roadsideMaxSlices; const y = canvas.height * 0.35 + t * (canvas.height * 1.01); const width = roadWidthTop + (roadWidthBottom - roadWidthTop) * t; const lateralOffset = -(gameState.playerX / gameState.maxOffset) * 3030 * t; const roadLeftX = (canvas.width - width) / 2 + lateralOffset; const roadRightX = roadLeftX + width; const baseSize = width * 0.32; const objSize = baseSize * grass.sizeVariation; const swayAngle = Math.sin(windTime * grass.swayFrequency + grass.swayPhase) * grass.swayAmplitude * t; let x; const img = grass.side === "left" ? assets.secondGrassLeft : assets.secondGrassRight; if (grass.side === "left") { x = roadLeftX - objSize * 1.25 + grass.posVariationX; } else { x = roadRightX + objSize * 1.5 + grass.posVariationX; } if (y < canvas.height && y > canvas.height * 0.37 - objSize) { ctx.save(); ctx.translate(x, y); ctx.rotate(swayAngle); ctx.drawImage(img, -objSize / 2, -objSize + grass.posVariationY, objSize, objSize); ctx.restore(); } } }
function updateSecondGrass(speedKmH) { const allGrass = [...secondGrassObjects.left, ...secondGrassObjects.right]; for (let grass of allGrass) { const t = 1 - grass.sliceIndex / gameState.roadsideMaxSlices; const speedMultiplier = 0.10 + 80.4 * t; grass.sliceIndex -= (speedKmH / gameState.maxSpeedKmH) * speedMultiplier; if (grass.sliceIndex < 0) grass.sliceIndex = gameState.roadsideMaxSlices; } }
function drawSigns() { if (assets.signs.length === 0) return; const roadWidthTop = canvas.width * 0.001; const roadWidthBottom = canvas.width * 2.2; activeSigns.sort((a, b) => a.sliceIndex - b.sliceIndex); for (let i = activeSigns.length - 1; i >= 0; i--) { const sign = activeSigns[i]; if (!sign.image.complete || sign.image.naturalWidth === 0) continue; const t = 1 - sign.sliceIndex / gameState.roadsideMaxSlices; const y = canvas.height * 0.35 + t * (canvas.height * 0.39); const width = roadWidthTop + (roadWidthBottom - roadWidthTop) * t; const lateralOffset = -(gameState.playerX / gameState.maxOffset) * 890 * t; const roadLeftX = (canvas.width - width) / 2 + lateralOffset; const roadRightX = roadLeftX + width; const baseSize = width * 0.21; const objSize = baseSize * sign.sizeVariation; let x; if (sign.side === "left") { x = roadLeftX - objSize * -2. - (sign.xOffset * t); } else { x = roadRightX + objSize * -2.061 + (sign.xOffset * t); } const drawWidth = Math.round(objSize * 2); const drawHeight = Math.round(objSize * 2 * (sign.image.naturalHeight / sign.image.naturalWidth)); const drawX = Math.round(x - drawWidth / 2); const drawY = Math.round(y - drawHeight); ctx.drawImage(sign.image, drawX, drawY, drawWidth, drawHeight); } }
function drawPickets() { if (!assets.picket.complete || assets.picket.naturalWidth === 0) return; const roadWidthTop = canvas.width * 0.001; const roadWidthBottom = canvas.width * 2.2; roadsideObjects.pickets.sort((a, b) => a.sliceIndex - b.sliceIndex); for (let i = roadsideObjects.pickets.length - 1; i >= 0; i--) { const picket = roadsideObjects.pickets[i]; const t = 1 - picket.sliceIndex / gameState.roadsideMaxSlices; const y = canvas.height * 0.35 + t * (canvas.height * 0.25); const width = roadWidthTop + (roadWidthBottom - roadWidthTop) * t; const lateralOffset = -(gameState.playerX / gameState.maxOffset) * 870 * t; const roadLeftX = (canvas.width - width) / 2 + lateralOffset; const roadRightX = roadLeftX + width; const baseSize = width * 0.076; const objSize = baseSize * picket.sizeVariation; let x; if (picket.side === "left") { x = roadLeftX - objSize * -7.5 - (picket.xOffset * t); } else { x = roadRightX + objSize * -9.23 + (picket.xOffset * t); } const drawWidth = Math.round(objSize * 2); const drawHeight = Math.round(objSize * 2 * (assets.picket.naturalHeight / assets.picket.naturalWidth)); const drawX = Math.round(x - drawWidth / 2); const drawY = Math.round(y - drawHeight); ctx.drawImage(assets.picket, drawX, drawY, drawWidth, drawHeight); } }
function updatePickets(speedKmH) { const spawnInterval = 100; if (totalDistanceTraveled >= picketSpawner.lastSpawnDistance + spawnInterval) { roadsideObjects.pickets.push({ sliceIndex: gameState.roadsideMaxSlices, side: 'left', image: assets.picket, sizeVariation: 0.4, xOffset: -20 }); roadsideObjects.pickets.push({ sliceIndex: gameState.roadsideMaxSlices, side: 'right', image: assets.picket, sizeVariation: 0.4, xOffset: -20 }); picketSpawner.lastSpawnDistance += spawnInterval; } const speedFactor = speedKmH / gameState.maxSpeedKmH; for (let i = roadsideObjects.pickets.length - 1; i >= 0; i--) { const picket = roadsideObjects.pickets[i]; const t = 1 - picket.sliceIndex / gameState.roadsideMaxSlices; const speedMultiplier = 0.10 + 79.4 * t; picket.sliceIndex -= speedFactor * speedMultiplier; if (picket.sliceIndex < -700) roadsideObjects.pickets.splice(i, 1); } }
function updateSigns(speedKmH) { const speedFactor = speedKmH / gameState.maxSpeedKmH; for (let i = activeSigns.length - 1; i >= 0; i--) { const sign = activeSigns[i]; const t = 1 - sign.sliceIndex / gameState.roadsideMaxSlices; const speedMultiplier = 0.10 + 79.4 * t; sign.sliceIndex -= speedFactor * speedMultiplier; if (sign.sliceIndex < -700) activeSigns.splice(i, 1); } }
function initGrassObjects() { const minSliceGap = 0.5; const maxSliceGap = 100; let currentSlice = 0; while (currentSlice < gameState.roadsideMaxSlices) { const t = 1 - currentSlice / gameState.roadsideMaxSlices; const sliceGap = minSliceGap + (maxSliceGap - minSliceGap) * t; const sizeVariation = 0.7 + Math.random() * 0.5; const posVariationX = 1; const posVariationY = Math.random() * 6 - 1; const swayProps = { swayFrequency: 0.5 + Math.random() * 2.5, swayAmplitude: 0.05 + Math.random() * 0.25, phase: Math.random() * Math.PI * 2 }; grassObjects.left.push({ sliceIndex: currentSlice, side: "left", sizeVariation, posVariationX, posVariationY, ...swayProps }); grassObjects.right.push({ sliceIndex: currentSlice, side: "right", sizeVariation, posVariationX, posVariationY, ...swayProps }); currentSlice += sliceGap; } }
initGrassObjects();
function drawGrass() { if (!assets.grassLeft.complete || !assets.grassRight.complete) return; const roadWidthTop = canvas.width * 0.008; const roadWidthBottom = canvas.width * 2.5; const allGrass = [...grassObjects.left, ...grassObjects.right]; allGrass.sort((a, b) => b.sliceIndex - a.sliceIndex); for (let grass of allGrass) { const t = 1 - grass.sliceIndex / gameState.roadsideMaxSlices; const y = canvas.height * 0.35 + t * (canvas.height * 1.05);const width = roadWidthTop + (roadWidthBottom - roadWidthTop) * t; const lateralOffset = -(gameState.playerX / gameState.maxOffset) * 2930 * t; const roadLeftX = (canvas.width - width) / 2 + lateralOffset - 7; const roadRightX = roadLeftX + width; const baseSize = width * 0.01; const objSize = baseSize * grass.sizeVariation * 30; const swayAngle = Math.sin(windTime * grass.swayFrequency + grass.swayPhase) * grass.swayAmplitude * t; let x; const img = grass.side === "left" ? assets.grassLeft : assets.grassRight; if (grass.side === "left") { x = roadLeftX - objSize * 0.56 + grass.posVariationX; } else { x = roadRightX + objSize * 0.5 + grass.posVariationY; } if (y < canvas.height && y > canvas.height * 0.37 - objSize) { ctx.save(); ctx.translate(x, y); ctx.rotate(swayAngle); ctx.drawImage(img, -objSize / 2, -objSize + grass.posVariationY, objSize, objSize); ctx.restore(); } } }
function updateGrass(speedKmH) { const allGrass = [...grassObjects.left, ...grassObjects.right]; for (let grass of allGrass) { const t = 1 - grass.sliceIndex / gameState.roadsideMaxSlices; const speedMultiplier = 0.10 + 85.4 * t; grass.sliceIndex -= (speedKmH / gameState.maxSpeedKmH) * speedMultiplier; if (grass.sliceIndex < 0) grass.sliceIndex = gameState.roadsideMaxSlices; } }

// --- NOWY PRZECIWNIK: Rozbudowa `roadsideObjects` o nową kategorię ---
const roadsideObjects = { 
    trees: [], 
    backgroundTrees: [], 
    buildings: [], 
    forests: [], 
    fields: [], 
    backforests: [], 
    backgroundBuildings: [], 
    pickets: [], 
    poles: [],
    lanterns: [], // <--- DODAJ TĘ LINIĘ
    slowOpponents: [] // Nowa tablica na naszych przeciwników
};
const treeSpawner = { nextSpawnDistance: -2200, inCluster: false, clusterTreesRemaining: 0 };
const backgroundTreeSpawner = { nextSpawnDistance: 500, inCluster: false, clusterTreesRemaining: 0 };
const buildingSpawner = { nextSpawnDistance: 5000 + Math.random() * 10000 };
const forestSpawner = { nextSpawnDistance: 8000 + Math.random() * 10000, inCluster: false, clusterForestsRemaining: 0 };
const fieldSpawner = { nextSpawnDistance: -2000, stripLengthRemaining: 0, currentImageIndex: 0 };
const backforestSpawner = { nextSpawnDistance: 0 };
const picketSpawner = { lastSpawnDistance: 0 };
const poleSpawner = { nextSpawnDistance: 150, stripLengthRemaining: 0 };

// --- NOWY PRZECIWNIK: Stan i konfiguracja spawnera ---
const slowOpponentSpawner = {
    // Losowy interwał spawnowania od 35 do 50 sekund
    nextSpawnTime: 3500 + Math.random() * 1500, 
    timeSinceLastSpawn: 0,
    speedKmh: 15, // Stała prędkość obiektu
};

const lanternSpawner = {
    nextSpawnDistance: 0,       // Dystans, przy którym ma pojawić się następna latarnia
    spawnInterval: 25,          // Odstęp między latarniami w metrach (dostosuj wg uznania)
    nextIsLeft: true,           // Flaga do śledzenia, po której stronie ma być następna latarnia
    lastSpawnCityStatus: false  // Pomocnicza flaga, by zresetować logikę po wyjeździe z miasta
};

function updateLanternSpawner() {
    // Jeśli nie jesteśmy w mieście, resetujemy stan i kończymy.
    if (!gameState.isInCity) {
        lanternSpawner.lastSpawnCityStatus = false;
        return;
    }

    // Jeśli właśnie wjechaliśmy do miasta, ustawiamy dystans dla pierwszej latarni.
    if (!lanternSpawner.lastSpawnCityStatus) {
        lanternSpawner.nextSpawnDistance = totalDistanceTraveled + lanternSpawner.spawnInterval;
        lanternSpawner.lastSpawnCityStatus = true;
    }

    // Sprawdzamy, czy gracz przejechał wymagany dystans.
    if (totalDistanceTraveled >= lanternSpawner.nextSpawnDistance) {
        // Wybieramy stronę na podstawie flagi.
        const side = lanternSpawner.nextIsLeft ? "left" : "right";

        // Tworzymy nowy obiekt latarni (wzorowany na słupkach `picket`).
        const newLantern = {
            sliceIndex: gameState.roadsideMaxSlices,
            side: side,
            image: assets.lantern,
            sizeVariation: 0.5, // Możesz dostosować rozmiar
            xOffset: -20,       // Możesz dostosować odsunięcie od drogi
        };

        // Dodajemy latarnię do tablicy aktywnych obiektów.
        roadsideObjects.lanterns.push(newLantern);

        // Aktualizujemy dystans dla następnej latarni.
        lanternSpawner.nextSpawnDistance += lanternSpawner.spawnInterval;
        
        // Zmieniamy stronę dla następnej latarni.
        lanternSpawner.nextIsLeft = !lanternSpawner.nextIsLeft;
    }
}

/**
 * Aktualizuje pozycję wszystkich aktywnych latarni na drodze.
 * (To jest niemal kopia funkcji updatePickets).
 */
function updateLanterns(speedKmH) {
    const speedFactor = speedKmH / gameState.maxSpeedKmH;
    for (let i = roadsideObjects.lanterns.length - 1; i >= 0; i--) {
        const lantern = roadsideObjects.lanterns[i];
        const t = 1 - lantern.sliceIndex / gameState.roadsideMaxSlices;
        const speedMultiplier = 0.10 + 79.4 * t; // Ta sama prędkość co słupki/znaki
        lantern.sliceIndex -= speedFactor * speedMultiplier;

        // Usuwamy latarnię, gdy minie gracza
        if (lantern.sliceIndex < -10) {
            roadsideObjects.lanterns.splice(i, 1);
        }
    }
}

function drawLanterns() {
    // Sprawdzamy, czy asset jest załadowany i czy są jakieś latarnie do narysowania.
    if (!assets.lantern.complete || assets.lantern.naturalWidth === 0 || roadsideObjects.lanterns.length === 0) {
        return;
    }

    // Kopiujemy logikę perspektywy z innych obiektów, np. drawPickets.
    const roadWidthTop = canvas.width * 0.001;
    const roadWidthBottom = canvas.width * 1.4;

    // Sortujemy, by obiekty w oddali rysowały się jako pierwsze.
    roadsideObjects.lanterns.sort((a, b) => b.sliceIndex - a.sliceIndex);

    for (const lantern of roadsideObjects.lanterns) {
        const t = 1 - lantern.sliceIndex / gameState.roadsideMaxSlices;
        if (t < 0) continue; // Nie rysuj obiektów za kamerą

        // Obliczenia perspektywy (skopiowane z drawPickets)
        const y = canvas.height * 0.35 + t * (canvas.height * 0.30); // Pozycjonowanie za trawą
        const width = roadWidthTop + (roadWidthBottom - roadWidthTop) * t;
        const lateralOffset = -(gameState.playerX / gameState.maxOffset) * 870 * t;
        const roadLeftX = (canvas.width - width) / 2 + lateralOffset;
        const roadRightX = roadLeftX + width;
        const baseSize = width * 0.036; // Latarnie są większe od słupków
        const objSize = baseSize * lantern.sizeVariation;

        let x;
        // Ustawiamy pozycję X w zależności od strony, tak jak dla słupków
        if (lantern.side === "left") {
            x = roadLeftX - objSize * -7.5 - (lantern.xOffset * t);
        } else {
            x = roadRightX + objSize * -9.23 + (lantern.xOffset * t);
        }

        const drawWidth = Math.round(objSize * 2);
        const drawHeight = Math.round(objSize * 2 * (assets.lantern.naturalHeight / assets.lantern.naturalWidth));
        const drawX = Math.round(x - drawWidth / 2);
        const drawY = Math.round(y - drawHeight);

        // --- KLUCZOWA LOGIKA LUSTRZANEGO ODBICIA ---
        if (lantern.side === 'left') {
            ctx.save();
            ctx.scale(-1, 1); // Odwracamy kontekst horyzontalnie
            // Rysujemy obrazek na odwróconym X, aby pojawił się we właściwym miejscu
            ctx.drawImage(assets.lantern, -drawX - drawWidth, drawY, drawWidth, drawHeight);
            ctx.restore(); // Przywracamy normalny kontekst
        } else {
            // Dla prawej strony rysujemy normalnie
            ctx.drawImage(assets.lantern, drawX, drawY, drawWidth, drawHeight);
        }
    }
}


// --- NOWY PRZECIWNIK: Funkcja do spawnowania nowego obiektu ---
function spawnSlowOpponent() {
    // Sprawdzamy, czy grafiki są załadowane
    if (!assets.opponentBottom.complete || !assets.opponentTop.complete) {
        return;
    }
    
    // Tworzymy nowy obiekt przeciwnika z jego stanem
    const newOpponent = {
        sliceIndex: gameState.roadsideMaxSlices, // Startuje na horyzoncie
        imageBottom: assets.opponentBottom,
        imageTop: assets.opponentTop,
        sizeVariation: 0.6, 
        
        // Przesunięcie obiektu w lewo, aby znalazł się na prawym pasie ruchu
        xOffset: -1680,
        
        // Parametry animacji i fizyki
        driftSpeed: 0, // Zmienimy to po kolizji
        swayTime: 0,
        swayFrequency: 2.5,
        swayAmplitude: 0.04,
        shakeIntensity: 1.02,
        
        // Flaga do obsługi jednorazowej kolizji
        collided: false,

        // --- NOWA LOGIKA: Stan dla płynnego znikania ---
        alpha: 1.0,          // Aktualna przezroczystość (od 1 do 0)
        isFadingOut: false,  // Czy obiekt jest w trakcie znikania
        
        passSoundPlayed: false,

        // --- NOWA LOGIKA: Indywidualna prędkość i stan dymu ---
        speedKmh: slowOpponentSpawner.speedKmh, // Kopia prędkości początkowej
        generatesSmoke: false, // Domyślnie nie generuje dymu
    };
    
    roadsideObjects.slowOpponents.push(newOpponent);
    
    // Resetujemy timer spawnera
    slowOpponentSpawner.timeSinceLastSpawn = 0;
    slowOpponentSpawner.nextSpawnTime = 16500 + Math.random() * 38500;
    console.log("Spawnowano nowego wolnego przeciwnika!");
}

// --- POPRAWKA ---
// Funkcja `updateSlowOpponents` teraz oblicza i zwraca docelową głośność.
// Samo sterowanie dźwiękiem zostało przeniesione do pętli `updateGameState` dla większej niezawodności.
function updateSlowOpponents(deltaTime, playerSpeedKmH) {
    if (gameState.crashState.active) {
        return 0.0; // Zwracamy 0, aby dźwięk się wyciszył w razie kraksy
    }
    
    let overallLoudestVolume = 0.0; 

    if (roadsideObjects.slowOpponents.length > 0) {
        const playerSpeedFactor = playerSpeedKmH / gameState.maxSpeedKmH;

        for (let i = roadsideObjects.slowOpponents.length - 1; i >= 0; i--) {
            const opponent = roadsideObjects.slowOpponents[i];
            const opponentSpeedFactor = opponent.speedKmh / gameState.maxSpeedKmH;

            const t = 1 - opponent.sliceIndex / gameState.roadsideMaxSlices;
            const speedMultiplier = 0.10 + 79.4 * t;
            
            opponent.sliceIndex -= ((playerSpeedFactor * speedMultiplier) - (opponentSpeedFactor * speedMultiplier));
            opponent.swayTime += deltaTime;

            // Obliczanie głośności na podstawie odległości
            if (t >= 0 && t <= 1) { 
                const maxVolume = 0.9;
                const minVolume = 0.1;
                const distanceBasedVolume = minVolume + (maxVolume - minVolume) * Math.pow(t, 2);
                const finalVolumeForThisOpponent = distanceBasedVolume * opponent.alpha;
                if (finalVolumeForThisOpponent > overallLoudestVolume) {
                    overallLoudestVolume = finalVolumeForThisOpponent;
                }
            }

            // Logika kolizji
            if (!opponent.collided && t > 0.92) { 
                const OPPONENT_LANE_X = 150;
                const PLAYER_HITBOX_WIDTH = 150; 
                const OPPONENT_HITBOX_WIDTH = 200;
                
                const distanceX = Math.abs(gameState.playerX - OPPONENT_LANE_X);
                const collisionDistance = (PLAYER_HITBOX_WIDTH + OPPONENT_HITBOX_WIDTH) / 2;

                if (distanceX < collisionDistance) {
                    opponent.collided = true;
                    if (gameState.speedKmH > 42) {
                        startCrashProcedure();
                    } else {
                        gameState.speedKmH *= 0.8;
                        if (audio.unlocked && audio.hitmetal) {
                            audio.hitmetal.currentTime = 0;
                            audio.hitmetal.volume = 0.6;
                            audio.hitmetal.play().catch(e => console.warn("Nie udało się odtworzyć hitmetal.mp3", e));
                        }
                        gameState.collisionShake.active = true;
                        gameState.collisionShake.timer = 0;
                        opponent.driftSpeed = (gameState.playerX > OPPONENT_LANE_X) ? -90 : 90;
                        opponent.speedKmh = Math.max(0, opponent.speedKmh - 20);
                    }
                }
            }
            
            if (opponent.driftSpeed !== 0) {
                 opponent.xOffset += opponent.driftSpeed * t * deltaTime;
                 opponent.driftSpeed *= 0.98; 
                 if(Math.abs(opponent.driftSpeed) < 1) opponent.driftSpeed = 0;
            }

            // Logika dymu
            if (!opponent.generatesSmoke) {
                const opponentT = 1 - opponent.sliceIndex / gameState.roadsideMaxSlices;
                for (const car of activeCars) {
                    if (car.t > opponentT) {
                        opponent.generatesSmoke = true;
                        for (let k = 0; k < 15; k++) {
                            gameState.carDustParticles.push({
                                t: t, 
                                xOffsetVariation: -950 + (Math.random() - 0.5) * 50,
                                initialSize: 0.02 + Math.random() * 0.04, 
                                alpha: 0.3 + Math.random() * 0.3, 
                                lifetime: 0,
                                maxLifetime: 1.0 + Math.random() * 1.5,
                                growthRate: 0.5 + Math.random() * 0.5,
                            });
                        }
                        break; 
                    }
                }
            }
            
            // --- ZMIANA: Szybsze odpalanie dźwięku mijania `opponentpass.mp3` ---
            // Zmieniamy warunek z -1500 na -250, aby dźwięk uruchomił się zaraz po minięciu.
            if (opponent.sliceIndex < -250 && !opponent.isFadingOut) {
                opponent.isFadingOut = true;
                
                if (!opponent.passSoundPlayed && audio.unlocked && audio.opponentpass) {
                    audio.opponentpass.currentTime = 0;
                    audio.opponentpass.volume = 0.8; 
                    audio.opponentpass.play().catch(e => console.warn("Failed to play opponentpass.mp3", e));
                    opponent.passSoundPlayed = true; 
                }
            }

            // Logika znikania
            if (opponent.isFadingOut) {
                opponent.alpha -= 4.0 * deltaTime; 
                opponent.alpha = Math.max(0, opponent.alpha); 
            }

            if (opponent.alpha <= 0 || opponent.sliceIndex < -2500) {
                roadsideObjects.slowOpponents.splice(i, 1);
            }
        }
    }
    
    return overallLoudestVolume; // Zwracamy obliczoną głośność
}


function drawSlowOpponents() {
    if (roadsideObjects.slowOpponents.length === 0) return;

    const roadWidthTop = canvas.width * 0.001;
    const roadWidthBottom = canvas.width * 2.2;
    
    roadsideObjects.slowOpponents.sort((a, b) => b.sliceIndex - a.sliceIndex);
    
    for (const opponent of roadsideObjects.slowOpponents) {
        ctx.save();
        ctx.globalAlpha = opponent.alpha;

        const t = 1 - opponent.sliceIndex / gameState.roadsideMaxSlices;
        
        if (t < 0) {
            ctx.restore();
            continue;
        }

        const y = canvas.height * 0.35 + t * (canvas.height * 0.52);
        const width = roadWidthTop + (roadWidthBottom - roadWidthTop) * t;
        const lateralOffset = -(gameState.playerX / gameState.maxOffset) * 1060 * t;
        const roadRightX = (canvas.width / 2 + lateralOffset) + width / 2;

        const baseSize = width * 0.35;
        const objSize = baseSize * opponent.sizeVariation;
        
        let x = roadRightX + (opponent.xOffset * t);
        
        const shakeX = (Math.random() - 0.5) * opponent.shakeIntensity;
        const shakeY = (Math.random() - 0.5) * opponent.shakeIntensity;

        let horizontalScale = 1.0;
        const scaleStartPlayerX = 0;
        const scaleEndPlayerX = -gameState.maxOffset;
        const minScale = 0.85;

        if (gameState.playerX < scaleStartPlayerX) {
            const progress = Math.min(1.0, gameState.playerX / scaleEndPlayerX);
            horizontalScale = 1.0 - (1.0 - minScale) * progress;
        }

        const imgBottom = opponent.imageBottom;
        if (imgBottom && imgBottom.complete && imgBottom.naturalWidth !== 0) {
            const drawWidth = Math.round(objSize * horizontalScale);
            const drawHeight = Math.round(objSize * (imgBottom.naturalHeight / imgBottom.naturalWidth));
            const drawX = Math.round(x - drawWidth / 2 + shakeX);
            const drawY = Math.round(y - drawHeight + shakeY);
            ctx.drawImage(imgBottom, drawX, drawY, drawWidth, drawHeight);
        }
        
        const imgTop = opponent.imageTop;
        if (imgTop && imgTop.complete && imgTop.naturalWidth !== 0) {
            ctx.save();
            const drawWidth = Math.round(objSize * horizontalScale);
            const drawHeight = Math.round(objSize * (imgTop.naturalHeight / imgTop.naturalWidth));
            const drawX = Math.round(x - drawWidth / 2 + shakeX);
            const drawY = Math.round(y - drawHeight + shakeY);
            
            ctx.translate(drawX + drawWidth / 2, drawY + drawHeight);
            
            const swayAngle = Math.sin(opponent.swayTime * opponent.swayFrequency) * opponent.swayAmplitude * t;
            ctx.rotate(swayAngle);

            ctx.drawImage(imgTop, -drawWidth / 2, -drawHeight, drawWidth, drawHeight);
            ctx.restore();
        }
        ctx.restore();
    }
}

// --- ZMIANA: Dodanie dźwięku opponentpass.mp3 ---
// --- ZMIANA: Dodanie dźwięków c_engineidle.mp3 i screw.mp3 ---
const audio = { 
  menuopen: new Audio("menuopen.mp3"),
  menu: new Audio("menu.mp3"),
  background: new Audio("background.mp3"),
  carbackground: new Audio("carbackground.mp3"),
  horn: new Audio("horn.mp3"), 
  idle: new Audio("idle.mp3"), 
  ac: new Audio("ac.mp3"), 
  ac1: new Audio("1ac.mp3"),
  gearbox: new Audio("gearbox.mp3"),
  gearbox2: new Audio("gearbox2.mp3"),
  reduction: new Audio("reduction.mp3"), 
  breaking: new Audio("breaking.mp3"), 
  gravel: new Audio("gravel.mp3"), 
  map: new Audio("map.mp3"), 
  mapMove: new Audio("map2.mp3"), 
  passing: new Audio("passing.mp3"),
  boom2: new Audio("boom2.mp3"), 
  blinker: new Audio("blinker.mp3"),
  press: new Audio("press.mp3"),
  windowrolling: new Audio("windowrolling.mp3"),
  boom: new Audio("boom.mp3"),
  hitboom: new Audio("hitboom.mp3"),
  hitmetal: new Audio("hitmetal.mp3"), 
  opponent: new Audio("opponent.mp3"), 
  opponentpass: new Audio("opponentpass.mp3"),
  radio: new Audio("radio.mp3"),
  rewind: new Audio("rewind.mp3"),
  scroll: new Audio("scroll.mp3"),
  wiper: new Audio("wiper.mp3"),
  glassboom: new Audio("glassboom.mp3"), 
  viewIn: new Audio("in.mp3"),      // Dźwięk powrotu do kokpitu
  viewOut: new Audio("out.mp3"),    // Dźwięk przejścia do silnika/bagażnika
  c_engineidle: new Audio("c_engineidle.mp3"), // Dźwięk pracy silnika w tle
  screw: new Audio("screw.mp3"),             // Dźwięk odkręcania korka
  pouring: new Audio("pouring.mp3"),         // Dźwięk lania oleju
  // --- NOWY KOD ---
  openingbeer: new Audio("openingbeer.mp3"), // Dźwięk otwierania piwa
  drinking: new Audio("drinking.mp3"),       // Dźwięk picia piwa
  // --- KONIEC NOWEGO KODU ---
  unlocked: false 
};

if (audio.opponent) audio.opponent.loop = true;
if (audio.blinker) audio.blinker.loop = true; 
if (audio.windowrolling) audio.windowrolling.loop = true;
if (audio.radio) audio.radio.loop = true;
if (audio.rewind) audio.rewind.loop = true;
if (audio.wiper) audio.wiper.loop = true;
audio.viewIn.loop = false;
audio.viewOut.loop = false;
if (audio.c_engineidle) audio.c_engineidle.loop = true; // Ustawienie pętli
audio.screw.loop = false; // Upewnienie się, że nie jest w pętli
if (audio.pouring) audio.pouring.loop = true; // Dźwięk lania musi być w pętli
// --- NOWY KOD ---
audio.openingbeer.loop = false; // Dźwięk jednorazowy
audio.drinking.loop = false;    // Dźwięk jednorazowy
// --- KONIEC NOWEGO KODU ---

audio.background.loop = true; audio.carbackground.loop = true; audio.horn.loop = false;
audio.idle.loop = true; audio.ac.loop = false; audio.ac1.loop = false;
audio.gearbox.loop = false; audio.gearbox2.loop = false;
audio.reduction.loop = false;
audio.breaking.loop = true; audio.gravel.loop = true; audio.passing.loop = false;
audio.opponentpass.loop = false;

function unlockAudio() {
  const soundsToUnlock = [
    audio.background, audio.carbackground, audio.idle, audio.ac, audio.ac1, 
    audio.gearbox, audio.gearbox2, audio.reduction, audio.breaking, 
    audio.gravel, audio.map, audio.mapMove, audio.boom2, audio.blinker, 
    audio.menuopen, audio.menu,
    audio.press, audio.windowrolling,
    audio.radio, audio.rewind, audio.scroll,
    audio.wiper, audio.glassboom, audio.hitboom,
    audio.hitmetal, audio.opponent, audio.opponentpass,  audio.viewIn, audio.viewOut,
    audio.c_engineidle, audio.screw, audio.pouring,
    // --- NOWY KOD ---
    audio.openingbeer, audio.drinking // <-- DODAJ TUTAJ
    // --- KONIEC NOWEGO KODU ---
  ];
  
  soundsToUnlock.forEach(sound => {
      if (sound && typeof sound.play === 'function') { 
           sound.play().then(() => sound.pause()).catch(e => console.warn("Failed to play test sound:", e));
      } else {
          console.warn("Audio object not valid:", sound);
      }
  });
  
  if (audio.unlocked) return; 
  audio.unlocked = true;
  console.log("Audio unlocked:", audio.unlocked);

  audio.background.volume = 0.4;
  audio.background.play().catch(e => console.error("Nie udało się odtworzyć muzyki w tle:", e));

  audio.carbackground.volume = 0.7;
  audio.carbackground.play().catch(e => console.error("Nie udało się odtworzyć dźwięku tła samochodu:", e));
  
  window.removeEventListener('keydown', unlockAudio);
  window.removeEventListener('click', unlockAudio);
}

function managePouringSound() {
    // Sprawdzamy, czy dźwięk jest odblokowany i załadowany
    if (!audio.unlocked || !audio.pouring) return;

    // Definiujemy progi wylewania dla obu butelek
    const OIL_STREAM_ANGLE_THRESHOLD = 55 * (Math.PI / 180);
    const BEER_STREAM_ANGLE_THRESHOLD = 25 * (Math.PI / 180); // Używamy wartości z logiki tworzenia cząsteczek piwa

    // Sprawdzamy, czy olej się leje
    const isOilPouring = heldOilState.isHeld && Math.abs(heldOilState.angle) > OIL_STREAM_ANGLE_THRESHOLD;

    // Sprawdzamy, czy piwo się leje
    const isBeerPouring = heldBeerState.isHeld && Math.abs(heldBeerState.angle) > BEER_STREAM_ANGLE_THRESHOLD;

    // Warunek końcowy: czy cokolwiek się leje?
    const isPouring = isOilPouring || isBeerPouring;

    if (isPouring) {
        // Jeśli warunki są spełnione, a dźwięk nie gra, włącz go.
        // Dzięki pętli będzie grał ciągle.
        if (audio.pouring.paused) {
            audio.pouring.play().catch(e => console.warn("Nie udało się odtworzyć pouring.mp3", e));
        }
    } else {
        // Jeśli warunki nie są spełnione (żadna butelka się nie wylewa),
        // a dźwięk wciąż gra, zatrzymaj go i zresetuj.
        if (!audio.pouring.paused) {
            audio.pouring.pause();
            audio.pouring.currentTime = 0; // Resetowanie dźwięku
        }
    }
}

window.addEventListener('keydown', unlockAudio, { once: true });
window.addEventListener('click', unlockAudio, { once: true });



function drawBackForests() { if (!assets.backforest.complete) return; const roadWidthTop = canvas.width * 0.001; const roadWidthBottom = canvas.width * 2.2; roadsideObjects.backforests.sort((a, b) => a.sliceIndex - b.sliceIndex); for (let i = roadsideObjects.backforests.length - 1; i >= 0; i--) { const backforest = roadsideObjects.backforests[i]; const t = 1 - backforest.sliceIndex / gameState.roadsideMaxSlices; const y = canvas.height * 0.35 + t * (canvas.height * 0.24); const width = roadWidthTop + (roadWidthBottom - roadWidthTop) * t; const lateralOffset = -(gameState.playerX / gameState.maxOffset) * 800 * t; const roadLeftX = (canvas.width - width) / 2 + lateralOffset; const roadRightX = roadLeftX + width; const baseSize = width * 0.8; const objSize = baseSize * backforest.sizeVariation; let x; if (backforest.side === "left") { x = roadLeftX - objSize * 0.2 - (backforest.xOffset * t); } else { x = roadRightX + objSize * 0.2 + (backforest.xOffset * t); } const img = backforest.image; if (img.complete && img.naturalWidth !== 0) { const drawWidth = Math.round(objSize * 2); const drawHeight = Math.round(objSize * 2 * (img.naturalHeight / img.naturalWidth)); const drawX = Math.round(x - drawWidth / 2); const drawY = Math.round(y - drawHeight); ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight); } } }
function updateBackForests(speedKmH) { const speedFactor = speedKmH / gameState.maxSpeedKmH; backforestSpawner.nextSpawnDistance -= speedFactor * 8440; if (backforestSpawner.nextSpawnDistance <= 1850) { roadsideObjects.backforests.push({ sliceIndex: gameState.roadsideMaxSlices, side: "left", image: assets.backforest, sizeVariation: 0.84, xOffset: 12000 }); roadsideObjects.backforests.push({ sliceIndex: gameState.roadsideMaxSlices, side: "right", image: assets.backforest, sizeVariation: 0.84, xOffset: 12000 }); backforestSpawner.nextSpawnDistance = 200500; } for (let i = roadsideObjects.backforests.length - 1; i >= 0; i--) { const backforest = roadsideObjects.backforests[i]; const t = 1 - backforest.sliceIndex / gameState.roadsideMaxSlices; const speedMultiplier = 0.10 + 14.0 * t; backforest.sliceIndex -= speedFactor * speedMultiplier; if (backforest.sliceIndex < -50) roadsideObjects.backforests.splice(i, 1); } }
function drawBackgroundTrees() { if (assets.backgroundTreeImages.length === 0 || !assets.backgroundTreeImages.every(img => img.complete)) return; const roadWidthTop = canvas.width * 0.001; const roadWidthBottom = canvas.width * 2.2; roadsideObjects.backgroundTrees.sort((a, b) => a.sliceIndex - b.sliceIndex); for (let i = roadsideObjects.backgroundTrees.length - 1; i >= 0; i--) { const tree = roadsideObjects.backgroundTrees[i]; const t = 1 - tree.sliceIndex / gameState.roadsideMaxSlices; const y = canvas.height * 0.35 + t * (canvas.height * 0.38); const width = roadWidthTop + (roadWidthBottom - roadWidthTop) * t; const lateralOffset = -(gameState.playerX / gameState.maxOffset) * 820 * t; const roadLeftX = (canvas.width - width) / 2 + lateralOffset; const roadRightX = roadLeftX + width; const baseSize = width * 0.25; const objSize = baseSize * tree.sizeVariation; let x; if (tree.side === "left") { x = roadLeftX - objSize * 0.5 - (tree.xOffset * t); } else { x = roadRightX + objSize * 0.5 + (tree.xOffset * t); } const img = tree.image; if (img.complete && img.naturalWidth !== 0) { const drawWidth = Math.round(objSize * 2); const drawHeight = Math.round(objSize * 2 * (img.naturalHeight / img.naturalWidth)); const drawX = Math.round(x - drawWidth / 2); const drawY = Math.round(y - drawHeight); ctx.save(); ctx.globalAlpha = tree.alpha; ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight); ctx.restore(); } } }
function updateBackgroundTrees(speedKmH) { if (assets.backgroundTreeImages.length === 0) return; const speedFactor = speedKmH / gameState.maxSpeedKmH; backgroundTreeSpawner.nextSpawnDistance -= speedFactor * 80; if (backgroundTreeSpawner.nextSpawnDistance <= 0) { const newTree = { sliceIndex: gameState.roadsideMaxSlices, side: Math.random() < 0.5 ? "left" : "right", image: assets.backgroundTreeImages[Math.floor(Math.random() * assets.backgroundTreeImages.length)], sizeVariation: 0.45 + Math.random() * 0.62, xOffset: 25000 + Math.random() * 10000, alpha: Math.random() * (0.84 - 0.72) + 0.76 }; roadsideObjects.backgroundTrees.push(newTree); if (backgroundTreeSpawner.inCluster) { backgroundTreeSpawner.nextSpawnDistance = 400 + Math.random() * 800; backgroundTreeSpawner.clusterTreesRemaining--; if (backgroundTreeSpawner.clusterTreesRemaining <= 0) backgroundTreeSpawner.inCluster = false; } else { if (Math.random() < 0.7) { backgroundTreeSpawner.inCluster = true; backgroundTreeSpawner.clusterTreesRemaining = 10 + Math.floor(Math.random() * 20); backgroundTreeSpawner.nextSpawnDistance = 300 + Math.random() * 500; } else { backgroundTreeSpawner.nextSpawnDistance = 400 + Math.random() * 2000; } } } for (let i = roadsideObjects.backgroundTrees.length - 1; i >= 0; i--) { const tree = roadsideObjects.backgroundTrees[i]; const t = 1 - tree.sliceIndex / gameState.roadsideMaxSlices; const speedMultiplier = 0.10 + 40.0 * t; tree.sliceIndex -= speedFactor * speedMultiplier; if (tree.sliceIndex < -10) roadsideObjects.backgroundTrees.splice(i, 1); } }
function drawPoles() { if (!assets.pole.complete) return; const roadWidthTop = canvas.width * 0.001; const roadWidthBottom = canvas.width * 2.2; roadsideObjects.poles.sort((a, b) => a.sliceIndex - b.sliceIndex); for (let i = roadsideObjects.poles.length - 1; i >= 0; i--) { const pole = roadsideObjects.poles[i]; const t = 1 - pole.sliceIndex / gameState.roadsideMaxSlices; const y = canvas.height * 0.35 + t * (canvas.height * 0.40); const width = roadWidthTop + (roadWidthBottom - roadWidthTop) * t; const lateralOffset = -(gameState.playerX / gameState.maxOffset) * 750 * t; const roadLeftX = (canvas.width - width) / 2 + lateralOffset; const roadRightX = roadLeftX + width; const baseSize = width * 0.3; const objSize = baseSize * 3; const x = roadRightX + objSize * 0.8 + (pole.xOffset * t); const img = pole.image; if (img.complete && img.naturalWidth !== 0) { const drawWidth = Math.round(objSize * 2); const drawHeight = Math.round(objSize * 2 * (img.naturalHeight / img.naturalWidth)); const drawX = Math.round(x - drawWidth / 2); const drawY = Math.round(y - drawHeight); ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight); } } }
function updatePoles(speedKmH) { if (!assets.pole.complete) return; const speedFactor = speedKmH / gameState.maxSpeedKmH; poleSpawner.nextSpawnDistance -= speedFactor * 80; if (poleSpawner.nextSpawnDistance <= 0) { if (poleSpawner.stripLengthRemaining <= 0) { poleSpawner.stripLengthRemaining = 10 + Math.floor(Math.random() * 20); poleSpawner.nextSpawnDistance = 3000 + Math.random() * 6000; } else { const newPole = { sliceIndex: gameState.roadsideMaxSlices, side: "right", image: assets.pole, xOffset: 32000 }; roadsideObjects.poles.push(newPole); poleSpawner.stripLengthRemaining--; poleSpawner.nextSpawnDistance = 2150; } } for (let i = roadsideObjects.poles.length - 1; i >= 0; i--) { const pole = roadsideObjects.poles[i]; const t = 1 - pole.sliceIndex / gameState.roadsideMaxSlices; const speedMultiplier = 0.10 + 32.4 * t; pole.sliceIndex -= speedFactor * speedMultiplier; if (pole.sliceIndex < -10) roadsideObjects.poles.splice(i, 1); } }
function applyMotionBlur(targetCtx, speedKmH, maxSpeedKmH) { if (speedKmH < 10) return; const BLUR_SAMPLES = 2; const BLUR_STRENGTH = 0.0104; const intensity = (speedKmH / maxSpeedKmH) * BLUR_STRENGTH * speedKmH /48; if (motionBlurCanvas.width !== targetCtx.canvas.width || motionBlurCanvas.height !== targetCtx.canvas.height) { motionBlurCanvas.width = targetCtx.canvas.width; motionBlurCanvas.height = targetCtx.canvas.height; } motionBlurCtx.drawImage(targetCtx.canvas, 0, 0); targetCtx.globalAlpha = 0.22; for (let i = 1; i <= BLUR_SAMPLES; i++) { const scale = 1.0 + (intensity * i); const x = (targetCtx.canvas.width - targetCtx.canvas.width * scale) / 2; const y = (targetCtx.canvas.height - targetCtx.canvas.height * scale) / 2; const width = targetCtx.canvas.width * scale; const height = targetCtx.canvas.height * scale; targetCtx.drawImage(motionBlurCanvas, x, y, width, height); } targetCtx.globalAlpha = 1.0; }
function drawBuildings() { if (assets.buildingImages.length === 0 || !assets.buildingImages.every(img => img.complete)) return; const roadWidthTop = canvas.width * 0.001; const roadWidthBottom = canvas.width * 2.2; roadsideObjects.buildings.sort((a, b) => a.sliceIndex - b.sliceIndex); for (let i = roadsideObjects.buildings.length - 1; i >= 0; i--) { const building = roadsideObjects.buildings[i]; const t = 1 - building.sliceIndex / gameState.roadsideMaxSlices; const y = canvas.height * 0.35 + t * (canvas.height * 0.57); const width = roadWidthTop + (roadWidthBottom - roadWidthTop) * t; const lateralOffset = -(gameState.playerX / gameState.maxOffset) * 800 * t; const roadLeftX = (canvas.width - width) / 2 + lateralOffset; const roadRightX = roadLeftX + width; const baseSize = width * 0.51; const objSize = baseSize * building.sizeVariation; let x; if (building.side === "left") { x = roadLeftX - objSize * 0.1 - (building.xOffset * t); } else { x = roadRightX + objSize * 0.1 + (building.xOffset * t); } const img = building.image; if (img.complete && img.naturalWidth !== 0) { const drawX = Math.round(x - objSize); const drawY = Math.round(y - objSize * 2); const drawWidth = Math.round(objSize * 2); const drawHeight = Math.round(objSize * 2 * (img.naturalHeight / img.naturalWidth)); ctx.save(); if (building.side === 'left' && assets.specialBuildingImages.includes(building.image)) { ctx.scale(-1, 1); ctx.drawImage(img, -drawX - drawWidth, drawY, drawWidth, drawHeight); } else { ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight); } ctx.restore(); } } }
function updateBuildings(speedKmH) { if (assets.buildingImages.length === 0 && assets.specialBuildingImages.length === 0) return; const speedFactor = speedKmH / gameState.maxSpeedKmH; buildingSpawner.nextSpawnDistance -= speedFactor * 80; if (buildingSpawner.nextSpawnDistance <= 0) { let imagePool; if (gameState.isInCity && assets.specialBuildingImages.length > 0) { imagePool = [ ...assets.specialBuildingImages, ...assets.specialBuildingImages, ...assets.specialBuildingImages, ...assets.specialBuildingImages, ...assets.specialBuildingImages, ...assets.buildingImages, ]; } else { imagePool = assets.buildingImages; } if (imagePool.length === 0) return; const randomImage = imagePool[Math.floor(Math.random() * imagePool.length)]; const newBuilding = { sliceIndex: gameState.roadsideMaxSlices, side: Math.random() < 0.5 ? "left" : "right", image: randomImage, sizeVariation: 0.68 + Math.random() * 0.1, xOffset: 200 + Math.random() * 600 }; roadsideObjects.buildings.push(newBuilding); if (gameState.isInCity) { buildingSpawner.nextSpawnDistance = 800 + Math.random() * 1500; } else { buildingSpawner.nextSpawnDistance = 8000 + Math.random() * 15000; } } for (let i = roadsideObjects.buildings.length - 1; i >= 0; i--) { const building = roadsideObjects.buildings[i]; const t = 1 - building.sliceIndex / gameState.roadsideMaxSlices; const speedMultiplier = 0.10 + 75.4 * t; building.sliceIndex -= speedFactor * speedMultiplier; if (building.sliceIndex < -10) roadsideObjects.buildings.splice(i, 1); } }
function drawForests() { if (!assets.forest.complete) return; const roadWidthTop = canvas.width * 0.001; const roadWidthBottom = canvas.width * 2.2; roadsideObjects.forests.sort((a, b) => a.sliceIndex - b.sliceIndex); for (let i = roadsideObjects.forests.length - 1; i >= 0; i--) { const forest = roadsideObjects.forests[i]; const t = 1 - forest.sliceIndex / gameState.roadsideMaxSlices; const y = canvas.height * 0.35 + t * (canvas.height * 1.343); const width = roadWidthTop + (roadWidthBottom - roadWidthTop) * t; const lateralOffset = -(gameState.playerX / gameState.maxOffset) * 800 * t; const roadLeftX = (canvas.width - width) / 2 + lateralOffset; const roadRightX = roadLeftX + width; const baseSize = width * 1.33; const objSize = baseSize * forest.sizeVariation; let x; if (forest.side === "left") { x = roadLeftX - objSize * 0.5 - (forest.xOffset * t); } else { x = roadRightX + objSize * 0.5 + (forest.xOffset * t); } const img = forest.image; if (img.complete && img.naturalWidth !== 0) { const drawWidth = Math.round(objSize * 2); const drawHeight = Math.round(objSize * 2 * (img.naturalHeight / img.naturalWidth)); const drawX = Math.round(x - drawWidth / 2); const drawY = Math.round(y - drawHeight); ctx.save(); if (forest.mirrored) { ctx.scale(-1, 1); ctx.drawImage(img, -drawX - drawWidth, drawY, drawWidth, drawHeight); } else { ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight); } ctx.restore(); } } }
function updateForests(speedKmH) { if (!assets.forest.complete) return; const speedFactor = speedKmH / gameState.maxSpeedKmH; forestSpawner.nextSpawnDistance -= speedFactor * 80; if (forestSpawner.nextSpawnDistance <= 0) { const newForest = { sliceIndex: gameState.roadsideMaxSlices, side: Math.random() < 0.5 ? "left" : "right", image: assets.forest, sizeVariation: 0.8 + Math.random() * 0.5, xOffset: 4500 + Math.random() * 1200, mirrored: Math.random() < 0.5 }; roadsideObjects.forests.push(newForest); if (forestSpawner.inCluster) { forestSpawner.nextSpawnDistance = 800 + Math.random() * 1200; forestSpawner.clusterForestsRemaining--; if (forestSpawner.clusterForestsRemaining <= 0) forestSpawner.inCluster = false; } else { if (Math.random() < 0.4) { forestSpawner.inCluster = true; forestSpawner.clusterForestsRemaining = 5 + Math.floor(Math.random() * 60); forestSpawner.nextSpawnDistance = 300 + Math.random() * 600; } else { forestSpawner.nextSpawnDistance = 1000 + Math.random() * 8500; } } } for (let i = roadsideObjects.forests.length - 1; i >= 0; i--) { const forest = roadsideObjects.forests[i]; const t = 1 - forest.sliceIndex / gameState.roadsideMaxSlices; const speedMultiplier = 0.10 + 71.4 * t; forest.sliceIndex -= speedFactor * speedMultiplier; if (forest.sliceIndex < -10) roadsideObjects.forests.splice(i, 1); } }
function drawFields() { if (assets.fieldImages.length === 0 || !assets.fieldImages.every(img => img.complete)) return; const roadWidthTop = canvas.width * 0.001; const roadWidthBottom = canvas.width * 2.2; roadsideObjects.fields.sort((a, b) => a.sliceIndex - b.sliceIndex); for (let i = roadsideObjects.fields.length - 1; i >= 0; i--) { const field = roadsideObjects.fields[i]; const t = 1 - field.sliceIndex / gameState.roadsideMaxSlices; const y = canvas.height * 0.35 + t * (canvas.height * 1.04); const width = roadWidthTop + (roadWidthBottom - roadWidthTop) * t; const lateralOffset = -(gameState.playerX / gameState.maxOffset) * 800 * t; const roadLeftX = (canvas.width - width) / 2 + lateralOffset; const roadRightX = roadLeftX + width; const baseSize = width * 0.89; const objSize = baseSize * field.sizeVariation; let x; if (field.side === "left") { x = roadLeftX - objSize * 0.4 - (field.xOffset * t); } else { x = roadRightX + objSize * 0.4 + (field.xOffset * t); } const img = field.image; if (img.complete && img.naturalWidth !== 0) { const drawWidth = Math.round(objSize * 2); const drawHeight = Math.round(objSize * 2 * (img.naturalHeight / img.naturalWidth)); const swayAngle = Math.sin(windTime * field.sway.frequency + field.sway.phase) * field.sway.amplitude * t; ctx.save(); ctx.translate(x, y); ctx.rotate(swayAngle); if (field.mirrored) { ctx.scale(-1, 1); } ctx.drawImage(img, -drawWidth / 2, -drawHeight, drawWidth, drawHeight); ctx.restore(); } } }
function updateFields(speedKmH) { if (assets.fieldImages.length === 0) return; const speedFactor = speedKmH / gameState.maxSpeedKmH; fieldSpawner.nextSpawnDistance -= speedFactor * 15; if (fieldSpawner.nextSpawnDistance <= 0) { if (fieldSpawner.stripLengthRemaining <= 0) { fieldSpawner.stripLengthRemaining = 15 + Math.floor(Math.random() * 25); fieldSpawner.currentImageIndex = Math.floor(Math.random() * assets.fieldImages.length); } const newField = { sliceIndex: gameState.roadsideMaxSlices, side: Math.random() < 0.5 ? "left" : "right", image: assets.fieldImages[fieldSpawner.currentImageIndex], sizeVariation: 0.89, xOffset: 3500 + Math.random() * 3300, mirrored: Math.random() < 0.5, sway: { frequency: 0.1 + Math.random() * 0.7, amplitude: 0.002 + Math.random() * 0.13, phase: Math.random() * Math.PI * 2 } }; roadsideObjects.fields.push(newField); fieldSpawner.stripLengthRemaining--; fieldSpawner.nextSpawnDistance = 38; } for (let i = roadsideObjects.fields.length - 1; i >= 0; i--) { const field = roadsideObjects.fields[i]; const t = 1 - field.sliceIndex / gameState.roadsideMaxSlices; const speedMultiplier = 0.10 + 73.4 * t; field.sliceIndex -= speedFactor * speedMultiplier; if (field.sliceIndex < 80) roadsideObjects.fields.splice(i, 1); } }
function drawTrees() { if (assets.treeImages.length === 0 || !assets.treeImages[0].complete) return; ctx.imageSmoothingEnabled = false; const roadWidthTop = canvas.width * 0.001; const roadWidthBottom = canvas.width * 2.2; roadsideObjects.trees.sort((a, b) => a.sliceIndex - b.sliceIndex); for (let i = roadsideObjects.trees.length - 1; i >= 0; i--) { const tree = roadsideObjects.trees[i]; const t = 1 - tree.sliceIndex / gameState.roadsideMaxSlices; const y = canvas.height * 0.35 + t * (canvas.height * 0.45); const width = roadWidthTop + (roadWidthBottom - roadWidthTop) * t; const lateralOffset = -(gameState.playerX / gameState.maxOffset) * 800 * t; const roadLeftX = (canvas.width - width) / 2 + lateralOffset; const roadRightX = roadLeftX + width; const baseSize = width * 0.27; const objSize = baseSize * tree.sizeVariation; let x; if (tree.side === "left") { x = roadLeftX - objSize * 0.1; } else { x = roadRightX + objSize * 0.1; } const img = tree.image; if (img.complete && img.naturalWidth !== 0) { const swayAngle = Math.sin(windTime * tree.sway.frequency + tree.sway.phase) * tree.sway.amplitude * t; const drawWidth = Math.round(objSize * 2); const drawHeight = Math.round(objSize * 2); ctx.save(); ctx.translate(x, y); ctx.rotate(swayAngle); ctx.drawImage(img, -drawWidth / 2, -drawHeight, drawWidth, drawHeight); ctx.restore(); } } ctx.imageSmoothingEnabled = true; }
function updateTrees(speedKmH) {
    if (assets.treeImages.length === 0) return;
    const speedFactor = speedKmH / gameState.maxSpeedKmH;
    
    // Logika spawnera (pozostaje bez zmian)
    treeSpawner.nextSpawnDistance -= speedFactor * 80;
    if (treeSpawner.nextSpawnDistance <= 0) {
        const doesSway = Math.random() < 0.85;
        
        // --- ZMIANA 1: Dodanie flagi 'isNew' do nowo tworzonego obiektu ---
        const newTree = {
            sliceIndex: gameState.roadsideMaxSlices,
            side: Math.random() < 0.5 ? "left" : "right",
            image: assets.treeImages[Math.floor(Math.random() * assets.treeImages.length)],
            sizeVariation: 0.3 + Math.random() * 1.2,
            sway: {
                frequency: doesSway ? 0.2 + Math.random() * 3.9 : 0,
                amplitude: doesSway ? 0.008 + Math.random() * 0.01 : 0,
                phase: Math.random() * Math.PI * 2
            },
            isNew: true // <-- DODANA FLAGA
        };
        roadsideObjects.trees.push(newTree);
        
        // Logika resetowania timera spawnera (pozostaje bez zmian)
        if (gameState.isInCity) {
            treeSpawner.nextSpawnDistance = 2500 + Math.random() * 4000;
            treeSpawner.inCluster = false;
        } else {
            if (treeSpawner.inCluster) {
                treeSpawner.nextSpawnDistance = 150 + Math.random() * 250;
                treeSpawner.clusterTreesRemaining--;
                if (treeSpawner.clusterTreesRemaining <= 0) treeSpawner.inCluster = false;
            } else {
                if (Math.random() < 0.45) {
                    treeSpawner.inCluster = true;
                    treeSpawner.clusterTreesRemaining = 3 + Math.floor(Math.random() * 10);
                    treeSpawner.nextSpawnDistance = 100 + Math.random() * 200;
                } else {
                    treeSpawner.nextSpawnDistance = 1500 + Math.random() * 2000;
                }
            }
        }
    }

    // Pętla aktualizująca pozycje wszystkich drzew
    for (let i = roadsideObjects.trees.length - 1; i >= 0; i--) {
        const tree = roadsideObjects.trees[i];

        // --- ZMIANA 2: Natychmiastowa korekta pozycji dla nowych obiektów ---
        // Ten blok wykona się tylko raz dla każdego nowo stworzonego drzewa.
        if (tree.isNew && STARTING_DISTANCE_METERS > 0) {
            // Obliczamy, o ile "slice'ów" trzeba przesunąć obiekt, aby zasymulować
            // przejechanie STARTING_DISTANCE_METERS.
            // Ten wzór MUSI być identyczny z tym używanym do normalnego przesuwania!
            const t_initial = 1 - tree.sliceIndex / gameState.roadsideMaxSlices;
            const speedMultiplier_initial = 0.10 + 79.4 * t_initial;
            
            // Przeliczamy metry na "jednostki dystansu" używane przez grę.
            // Ta wartość (80) jest dobrana eksperymentalnie. Jeśli obiekty są
            // za daleko lub za blisko, możesz ją dostosować.
            // Mniejsza wartość = obiekty bliżej, większa = dalej.
            const distanceCorrectionFactor = STARTING_DISTANCE_METERS / 80; 

            // Stosujemy korektę do pozycji startowej obiektu.
            tree.sliceIndex -= speedMultiplier_initial * distanceCorrectionFactor;

            // Usuwamy flagę, aby ta operacja nie powtórzyła się w kolejnych klatkach.
            delete tree.isNew;
        }
        
        // Normalna aktualizacja pozycji w każdej klatce (pozostaje bez zmian)
        const t = 1 - tree.sliceIndex / gameState.roadsideMaxSlices;
        const speedMultiplier = 0.10 + 79.4 * t;
        tree.sliceIndex -= speedFactor * speedMultiplier;
        
        // Usuwanie obiektów, które minęły gracza (pozostaje bez zmian)
        if (tree.sliceIndex < -10) {
            roadsideObjects.trees.splice(i, 1);
        }
    }
}function drawField3D() { if (!assets.field.complete) return; const roadStartY = canvas.height; const roadEndY = canvas.height * 0.35; const roadHeight = roadStartY - roadEndY; const slices = 1000; const sliceHeight = assets.field.height / slices; const maxLateralOffset = 1630; let lateralOffset = -(gameState.playerX / gameState.maxOffset) * maxLateralOffset; for (let i = 2; i < slices; i++) { const t = 1 - i / slices; const y = roadEndY + t * roadHeight; const roadWidthTop = canvas.width * 0.001; const roadWidthBottom = canvas.width * 1.7; const roadWidth = roadWidthTop + (roadWidthBottom - roadWidthTop) * t; const lateralOffsetAtSlice = lateralOffset * t; const roadLeftX = (canvas.width - roadWidth) / 2 + lateralOffsetAtSlice; const roadRightX = roadLeftX + roadWidth; const sideWidthTop = roadWidthTop * 400; const sideWidthBottom = sideWidthTop * 100; const sideWidth = sideWidthTop + (sideWidthBottom - sideWidthTop) * t; const texY = (gameState.roadOffsetY + i * sliceHeight) % assets.field.height; ctx.drawImage(assets.field, 0, texY, assets.field.width / 2, sliceHeight, roadLeftX - sideWidth, y - roadHeight / slices, sideWidth, roadHeight / slices); ctx.drawImage(assets.field, assets.field.width / 2, texY, assets.field.width / 2, sliceHeight, roadRightX, y - roadHeight / slices, sideWidth, roadHeight / slices); } }
function drawSky() { if (assets.sky.complete) { const skyOffsetX = -(gameState.playerX / gameState.maxOffset) * 25; ctx.save(); ctx.translate(skyOffsetX, 0); ctx.drawImage(assets.sky, 0, 0, assets.sky.width, assets.sky.height * 1.01, -Math.abs(skyOffsetX), 0, canvas.width * 1.02, canvas.height * 0.354); ctx.restore(); } else { ctx.fillStyle = "#87CEEB"; ctx.fillRect(0, 0, canvas.width, canvas.height * 0.35); } }
function drawRoad() { if (!assets.road.complete) return; const roadStartY = canvas.height; const roadEndY = canvas.height * 0.35; const roadHeight = roadStartY - roadEndY; const slices = 340; const sliceHeight = assets.road.height / slices; const maxLateralOffset = 1630; let lateralOffset = -(gameState.playerX / gameState.maxOffset) * maxLateralOffset; for (let i = 2; i < slices; i++) { const t = 1 - i / slices; const y = roadEndY + t * roadHeight; const roadWidthTop = canvas.width * 0.001; const roadWidthBottom = canvas.width * 1.7; const width = roadWidthTop + (roadWidthBottom - roadWidthTop) * t; const lateralOffsetAtSlice = lateralOffset * t; const x = (canvas.width - width) / 2 + lateralOffsetAtSlice; const texY = (gameState.roadOffsetY + i * sliceHeight) % assets.road.height; if (i % 4 === 0) { ctx.fillStyle = "rgb(65, 65, 65)"; ctx.fillRect(x, y - roadHeight / slices, width, roadHeight / slices); } ctx.drawImage(assets.road, 0, texY, assets.road.width, sliceHeight, x, y - roadHeight / slices, width, roadHeight / slices); } }
function drawPedals() { if (!assets.pedalClutchBrake.complete || !assets.pedalGas.complete) return; const clutch = pedalState.clutch; const clutchCurrentWidth = clutch.width * clutch.scale; const clutchCurrentHeight = clutch.height * clutch.scale; const clutchXOffset = (clutch.width - clutchCurrentWidth) / 2; const clutchYOffsetForScale = (clutch.height - clutchCurrentHeight) / 2; ctx.drawImage(assets.pedalClutchBrake, clutch.baseX + clutchXOffset, clutch.baseY + clutch.yOffset + clutchYOffsetForScale, clutchCurrentWidth, clutchCurrentHeight); const brake = pedalState.brake; const brakeCurrentWidth = brake.width * brake.scale; const brakeCurrentHeight = brake.height * brake.scale; const brakeXOffset = (brake.width - brakeCurrentWidth) / 2; const brakeYOffsetForScale = (brake.height - brakeCurrentHeight) / 2; ctx.drawImage(assets.pedalClutchBrake, brake.baseX + brakeXOffset, brake.baseY + brake.yOffset + brakeYOffsetForScale, brakeCurrentWidth, brakeCurrentHeight); const gas = pedalState.gas; const gasCurrentWidth = gas.width * gas.scale; const gasCurrentHeight = gas.height * gas.scale; const gasXOffset = (gas.width - gasCurrentWidth) / 2; const gasYOffsetForScale = (gas.height - gasCurrentHeight) / 2; ctx.drawImage(assets.pedalGas, gas.baseX + gasXOffset, gas.baseY + gas.yOffset + gasYOffsetForScale, gasCurrentWidth, gasCurrentHeight); }
function drawControls() {
    const drawIndicator = (name, condition) => {
        if (condition && assets.controls[name] && assets.controls[name].complete) {
            const pos = indicatorPositions[name];
            ctx.drawImage(assets.controls[name], pos.x, pos.y, pos.width, pos.height);
        }
    };

    // --- POPRAWKA TUTAJ ---
    // Brakowało tej linijki. To ona odpowiada za rysowanie lampki akumulatora.
    drawIndicator('acu', controlsState.acuWarningOn);
    // --- KONIEC POPRAWKI ---

    drawIndicator('lights', controlsState.lightsOn);
    drawIndicator('long', controlsState.longLightsOn);
    drawIndicator('oil', controlsState.oilWarningOn);
    drawIndicator('stop', controlsState.stopWarningOn);
    
    if (controlsState.hazardOn && controlsState.blinkerVisible) {
        drawIndicator('hazard', true);
    }
    if ((controlsState.leftBlinkerOn || controlsState.rightBlinkerOn) && controlsState.blinkerVisible) {
        drawIndicator('blink', true);
    }
}function drawWindowGlass() { if (!assets.windowGlass.complete) return; const centerX = canvas.width / 2; const centerY = canvas.height / 2; ctx.save(); ctx.translate(centerX + gameState.shakeX, centerY + gameState.shakeY + gameState.cockpitVerticalOffset); ctx.rotate((gameState.tilt * Math.PI) / 560); ctx.scale(1.06, 1.06); ctx.translate(-centerX, -centerY); const glassBaseX = 0; const glassBaseY = 140; const glassDrawWidth = 478; const glassDrawHeight = 805; const progress = windowState.glassMaxDownOffset > 0 ? Math.min(1, Math.max(0, windowState.glassYOffset / windowState.glassMaxDownOffset)) : 0; const currentRotation = progress * windowState.glassMaxRotation; const rotationCenterX = glassBaseX + glassDrawWidth / 2; const rotationCenterY = glassBaseY + windowState.glassYOffset + glassDrawHeight / 2; ctx.save(); ctx.translate(rotationCenterX, rotationCenterY); ctx.rotate(currentRotation); ctx.drawImage(assets.windowGlass, -glassDrawWidth / 2, -glassDrawHeight / 2, glassDrawWidth, glassDrawHeight); ctx.restore(); ctx.restore(); }


// --- NOWY KOD: FUNKCJA RYSUJĄCA NOWY, ANIMOWANY LICZNIK ---
// --- NOWY KOD: FUNKCJA RYSUJĄCA NOWY, ANIMOWANY LICZNIK ---
function drawNewCounter() {
    // Sprawdzamy, czy obie grafiki (tło i wskazówka) są załadowane
    if (!assets.counterHud.complete || !assets.counterNeedle.complete) {
        return;
    }

    // --- 1. RYSOWANIE TŁA LICZNIKA ---
    const hudWidth = 380;
    const hudHeight = 295;
    const padding = 50;
    const hudX = canvas.width - hudWidth - padding;
    const hudY = canvas.height - hudHeight - padding;
    ctx.drawImage(assets.counterHud, hudX, hudY, hudWidth, hudHeight);

    // --- 2. RYSOWANIE WSKAZÓWKI PRĘDKOŚCI ---
    ctx.save();

    // ### DOSTOSUJ TE WARTOŚCI ###
    // To są współrzędne punktu obrotu wskazówki względem lewego górnego rogu całego ekranu.
    // Musisz je dopasować, aby środek obrotu znalazł się w odpowiednim miejscu na Twojej grafice licznika.
    const needlePivotX = hudX + 185;
    const needlePivotY = hudY + 167;

    // Kąt startowy (dla 0 km/h) i pełny zakres ruchu wskazówki (w radianach).
    // Możesz je dostosować do tarczy na Twojej grafice.
    const startAngleRad = -0.72 * Math.PI; // Kąt dla 0 km/h (-135 stopni)
    const rangeAngleRad = 1.1 * Math.PI;   // Pełny zakres ruchu (270 stopni)

    // Obliczanie postępu prędkości (wartość od 0.0 do 1.0)
    const speedProgress = gameState.speedKmH / gameState.maxSpeedKmH;

    // Obliczanie aktualnego kąta obrotu wskazówki
    const currentAngleRad = startAngleRad + (speedProgress * rangeAngleRad);

    // Przesuwamy punkt (0,0) na środek obrotu wskazówki
    ctx.translate(needlePivotX, needlePivotY);
    // Obracamy cały układ współrzędnych
    ctx.rotate(currentAngleRad);

    // Wymiary obrazka wskazówki. Dostosuj do swojego pliku.
    const needleWidth = 12;
    const needleHeight = 135;

    // Rysujemy obrazek wskazówki.
    // Ważne: Rysujemy go przesuniętego w górę, aby jego podstawa znalazła się w punkcie obrotu (0,0).
    ctx.drawImage(
        assets.counterNeedle,
        -needleWidth / 2, // centrujemy w poziomie
        -needleHeight + 10, // przesuwamy w górę, +10 to mały margines, by pivot był lekko wewnątrz podstawy
        needleWidth,
        needleHeight
    );
    ctx.restore();


    // --- 3. RYSOWANIE LICZNIKA KILOMETRÓW (w stylu "bębenkowym") ---
    ctx.save();

    // Używamy tego samego stanu, co licznik na desce rozdzielczej
    const { displayDigits, rollProgress, isRolling } = odometerState;

    // ### DOSTOSUJ TE WARTOŚCI, aby pasowały do tła licznika (counterHud.png) ###
    ctx.font = "bold 22px 'DSDigi'"; // Używamy czcionki w stylu cyfrowego zegarka
    ctx.fillStyle = "rgba(197, 186, 151, 0.85)";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Pozycja startowa pierwszego bębenka od lewej
    const odometerBaseX = hudX + 132;
    const odometerBaseY = hudY + 228;
    const digitWidth = 22;
    const digitSpacing = 0.2;
    const rollHeight = 40; // Jak "wysoko" cyfry się przewijają

    // Pętla rysująca 5 cyfr
    for (let i = 0; i < 5; i++) {
        const newDigitChar = displayDigits[i];
        const newDigitValue = parseInt(newDigitChar, 10);
        const oldDigitValue = (newDigitValue - 1 + 10) % 10;
        const oldDigitChar = String(oldDigitValue);

        // Obliczamy pozycję X dla środka bieżącej cyfry
        const drawX = odometerBaseX + i * (digitWidth + digitSpacing) + (digitWidth / 2);

        if (isRolling[i]) {
            // Postęp animacji od 0.0 (początek) do 1.0 (koniec)
            const animationProgress = 1.0 - rollProgress[i];

            // Stara cyfra przesuwa się w górę
            const oldDigitYOffset = animationProgress * -rollHeight;
            // Nowa cyfra wjeżdża z dołu
            const newDigitYOffset = (1.0 - animationProgress) * rollHeight;

            // Rysujemy starą cyfrę (zanikającą)
            ctx.save();
            ctx.globalAlpha = (1.0 - animationProgress) * 0.7; // Zanika do 0
            ctx.fillText(oldDigitChar, drawX, odometerBaseY + oldDigitYOffset);
            ctx.restore();

            // Rysujemy nową cyfrę (pojawiającą się)
            ctx.save();
            ctx.globalAlpha = animationProgress * 0.85; // Pojawia się do pełnej jasności
            ctx.fillText(newDigitChar, drawX, odometerBaseY + newDigitYOffset);
            ctx.restore();

        } else {
            // Jeśli bębenek się nie kręci, po prostu rysujemy cyfrę
            ctx.fillText(newDigitChar, drawX, odometerBaseY);
        }
    }
    ctx.restore(); // Przywracamy stan ctx po rysowaniu licznika
}

function handleViewSpecificAudio() {
    if (!audio.unlocked) return;

    const engineIdleSound = audio.c_engineidle;

    // Zmieniony warunek, który teraz obejmuje również bagażnik ('trunk')
    if ((currentView === 'engine' || currentView === 'trunk') && !gameState.crashState.active) {
        // Jesteśmy w widoku silnika LUB bagażnika, więc dźwięk idle powinien grać
        if (engineIdleSound && engineIdleSound.paused) {
            // Wyłączamy wszystkie inne dźwięki silnika/jazdy
            stopAllEngineSounds(); 
            engineIdleSound.volume = 0.6;
            engineIdleSound.play().catch(e => console.warn("Nie udało się odtworzyć c_engineidle.mp3", e));
        }
    } else {
        // Jesteśmy w innym widoku (np. kokpit) lub trwa wypadek, więc dźwięk idle ma być wyłączony
        if (engineIdleSound && !engineIdleSound.paused) {
            engineIdleSound.pause();
        }
    }
}

function drawWindowButton() {
    if (!assets.windowButton || !assets.windowButton.complete) return;
    
    const btn = windowState.buttonPosition;
    const scaleX = windowState.handleScaleX;

    if (Math.abs(scaleX) < 0.01) return;

    ctx.save();
    ctx.translate(btn.x + btn.width / 2, btn.y + btn.height / 2);
    ctx.scale(scaleX, 1);
    ctx.drawImage(assets.windowButton, -btn.width / 2, -btn.height / 2, btn.width, btn.height);
    ctx.restore();
}

// --- NOWY KOD: FUNKCJA RYSUJĄCA NOWĄ KLAMKĘ ---
function drawHandleMirror() {
    if (!assets.handleMirror.complete) return;

    const { position, angle } = handleMirrorState;
    const { x, y, width, height } = position;

    ctx.save();
    // Przesuń punkt odniesienia do środka klamki
    ctx.translate(x + width / 2, y + height / 2);
    // Obróć
    ctx.rotate(angle);
    // Narysuj obrazek, centrując go
    ctx.drawImage(assets.handleMirror, -width / 2, -height / 2, width, height);
    ctx.restore();
}

// --- NOWY KOD: FUNKCJA RYSUJĄCA NOWE PRZYCISKI ---
function drawCustomButtons() {
    // Rysuj przycisk 1 (b1)
    if (assets.button1 && assets.button1.complete) {
        const btn = buttonState.b1;
        ctx.save();
        // Przesuń punkt odniesienia do środka przycisku, uwzględniając offset
        ctx.translate(btn.x + btn.width / 2 + btn.offsetX, btn.y + btn.height / 2);
        // Obróć i skaluj
        ctx.rotate(btn.angle);
        const finalWidth = btn.width * btn.scale;
        const finalHeight = btn.height * btn.scale;
        // Narysuj obrazek wyśrodkowany na nowym punkcie (0,0)
        ctx.drawImage(assets.button1, -finalWidth / 2, -finalHeight / 2, finalWidth, finalHeight);
        ctx.restore();
    }

    // Rysuj przycisk 2 (b2)
    if (assets.button2 && assets.button2.complete) {
        const btn = buttonState.b2;
        ctx.save();
        ctx.translate(btn.x + btn.width / 2 + btn.offsetX, btn.y + btn.height / 2);
        ctx.rotate(btn.angle);
        const finalWidth = btn.width * btn.scale;
        const finalHeight = btn.height * btn.scale;
        ctx.drawImage(assets.button2, -finalWidth / 2, -finalHeight / 2, finalWidth, finalHeight);
        ctx.restore();
    }
}

function drawRadioControls() {
    const volBtn = radioState.volumeButton;
    const rewBtn = radioState.rewindButton;
    
    ctx.fillStyle = volBtn.color;
    ctx.fillRect(volBtn.x, volBtn.y, volBtn.width, volBtn.height);
    
    ctx.fillStyle = rewBtn.color;
    ctx.fillRect(rewBtn.x, rewBtn.y, rewBtn.width, rewBtn.height);

    if (radioState.opacity > 0 && assets.radio.complete) {
        ctx.save();
        ctx.globalAlpha = radioState.opacity; 
        const imgPos = radioState.imagePosition;
        ctx.drawImage(assets.radio, imgPos.x, imgPos.y, imgPos.width, imgPos.height);
        ctx.restore();
    }
}

function drawLightsIndicator() {
    if (lightsIndicatorState.opacity > 0 && assets.counterl && assets.counterl.complete) {
        ctx.save();
        ctx.globalAlpha = lightsIndicatorState.opacity;
        const pos = lightsIndicatorState.imagePosition;
        ctx.drawImage(assets.counterl, pos.x, pos.y, pos.width, pos.height);
        ctx.restore();
    }
}

// --- NOWY KOD: FUNKCJA RYSUJĄCA OŚWIETLENIE WNĘTRZA ---
function drawInteriorLight() {
    if (interiorLightState.opacity > 0 && assets.interiorLight && assets.interiorLight.complete) {
        ctx.save();
        ctx.globalAlpha = interiorLightState.opacity;
        // Rysujemy obraz na całym canvasie, bo to nakładka na całe wnętrze
        ctx.drawImage(assets.interiorLight, 0, 0, canvas.width, canvas.height);
        ctx.restore();
    }
}


function drawWipers() {
    if (!assets.wiper.complete || assets.wiper.naturalWidth === 0) return;
    const wiperWidth = 691; 
    const wiperHeight = 361;  
    for (const pos of wipersState.positions) {
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(wipersState.angle);
        ctx.drawImage(assets.wiper, 0, -wiperHeight, wiperWidth, wiperHeight);
        ctx.restore();
    }
}

function drawMirror() {
    if (!assets.mirror.complete || !assets.mirror2.complete) return;

    // Pobieramy cały obiekt pozycji oraz pozostałe właściwości
    const { position, angle, opacity1, opacity2 } = mirrorState;
    // Teraz z obiektu pozycji pobieramy jego właściwości
    const { x, y, width, height } = position;

    ctx.save();
    // Używamy poprawnych zmiennych x, y, width, height
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate(angle);

    if (opacity1 > 0.01) {
        ctx.globalAlpha = opacity1;
        ctx.drawImage(assets.mirror, -width / 2, -height / 2, width, height);
    }

    if (opacity2 > 0.01) {
        ctx.globalAlpha = opacity2;
        ctx.drawImage(assets.mirror2, -width / 2, -height / 2, width, height);
    }

    ctx.restore();
}

// --- ZMIANA: Przebudowana funkcja rysująca ramię z zegarem, aby obsługiwać animację ---
function drawArmClock() {
    // Nie rysuj nic, jeśli obiekt jest całkowicie schowany lub grafika nie jest załadowana
    if (armClockState.animationProgress <= 0 || !assets.arm.complete) {
        return;
    }

    const state = armClockState;
    ctx.save();

    ctx.globalAlpha = state.animationProgress;

    // --- ZMIANA: Uwzględniamy chwilowe przesunięcia (sway) w pozycji i obrocie ---
    // 1. Przesuń punkt (0,0) canvasu do punktu obrotu obiektu, DODAJĄC drganie
    ctx.translate(
        state.currentPosition.x + state.swayPositionOffsetX + state.pivot.x * state.scale,
        state.currentPosition.y + state.swayPositionOffsetY + state.pivot.y * state.scale
    );
    // 2. Obróć canvas wokół tego nowego punktu (0,0), DODAJĄC drganie
    ctx.rotate(state.currentAngle + state.swayAngleOffset);
    // --- KONIEC ZMIAN ---
    
    ctx.scale(state.scale, state.scale);

    // 3. Rysuj grafikę ramienia
    ctx.drawImage(assets.arm, -state.pivot.x, -state.pivot.y);
    
    // 4. Rysuj tekst zegara
    ctx.fillStyle = state.fontColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.font = state.mainClockFont;
    const hoursPadded = String(state.mainClock.hours).padStart(2, '0');
    const minutesPadded = String(state.mainClock.minutes).padStart(2, '0');
    const mainClockString = `${hoursPadded}:${minutesPadded}`;
    ctx.fillText(
        mainClockString,
        state.relativeMainClockPos.x - state.pivot.x,
        state.relativeMainClockPos.y - state.pivot.y
    );

    ctx.font = state.secondCounterFont;
    const secondsPadded = String(state.secondCounter).padStart(2, '0');
    ctx.fillText(
        secondsPadded,
        state.relativeSecondsPos.x - state.pivot.x,
        state.relativeSecondsPos.y - state.pivot.y
    );

    ctx.restore();
}


// --- ZMODYFIKOWANA FUNKCJA `drawCockpit` ---
function drawCockpit() {
  if (!assets.cockpit.complete) return;
  ctx.save();
  const centerX = canvas.width / 2; const centerY = canvas.height / 2;
  ctx.translate(centerX + gameState.shakeX, centerY + gameState.shakeY + gameState.cockpitVerticalOffset);
  ctx.rotate((gameState.tilt * Math.PI) / 560);
  const scaleFactor = 1.06; ctx.scale(scaleFactor, scaleFactor);
  ctx.translate(-centerX, -centerY);

  const mirrorViewTargetX = 171;
  const mirrorViewTargetY = 548;
  const mirrorViewTargetWidth = 164;
  const mirrorViewTargetHeight = 128;
  ctx.drawImage(detailCanvas, mirrorViewTargetX, mirrorViewTargetY, mirrorViewTargetWidth, mirrorViewTargetHeight);

  // Rysujemy wycieraczki w tym samym kontekście transformacji co kokpit,
  // ale przed ramą kokpitu, aby znalazły się "na zewnątrz".
  drawWipers();

  // Rysowanie bazowego kokpitu
  ctx.drawImage(assets.cockpit, 0, 0, canvas.width, canvas.height);
  
  // --- NOWY KOD: Rysowanie nakładki świetlnej ---
  // Rysujemy ją na kokpicie, ale pod innymi elementami interfejsu
  drawInteriorLight();
  // --- KONIEC NOWEGO KODU ---

  drawMirror();
  drawPedals();
  drawWindowButton();
  drawHandleMirror();
  drawCustomButtons();

  drawOdometer();
  drawControls();
  drawRadioControls();
  drawLightsIndicator();
    drawDocObject();
  
  ctx.save();
  const wskX = centerX - 130.5; const wskY = centerY + 170;
  ctx.translate(wskX, wskY);
  const angle = -Math.PI / 1.5 + (gameState.speedKmH / gameState.maxSpeedKmH) * Math.PI;
  ctx.rotate(angle);
  ctx.strokeStyle = "rgba(198, 221, 250, 0.25)"; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -33); ctx.stroke();
  ctx.restore();
  ctx.restore();
  ctx.restore();
}



function drawShifter() { if (!assets.shifter.complete) return; ctx.save(); const centerX = canvas.width / 2; const centerY = canvas.height / 2; ctx.translate(centerX + gameState.shakeX, centerY + gameState.shakeY + gameState.cockpitVerticalOffset); ctx.rotate((gameState.tilt * Math.PI) / 560); const scaleFactor = 1.06; ctx.scale(scaleFactor, scaleFactor); ctx.translate(-centerX, -centerY); ctx.translate( shifterState.x + shifterState.offsetX + shifterState.shakeX, shifterState.y + shifterState.offsetY + shifterState.shakeY ); ctx.rotate(shifterState.angle); const shifterWidth = 200; const shifterHeight = 290; ctx.drawImage(assets.shifter, -shifterWidth / 2, -shifterHeight, shifterWidth, shifterHeight); ctx.restore(); }
function drawHanger() { if (!assets.hang.complete) return; ctx.save(); const centerX = canvas.width / 2; const centerY = canvas.height / 2; ctx.translate(centerX + gameState.shakeX, centerY + gameState.shakeY + gameState.cockpitVerticalOffset); ctx.rotate((gameState.tilt * Math.PI) / 360); ctx.translate(-centerX, -centerY); ctx.translate(hangerState.anchorX, hangerState.anchorY); ctx.rotate(hangerState.angle); const hangWidth = 144; const hangHeight = 242; ctx.drawImage(assets.hang, -hangWidth / 2, 0, hangWidth, hangHeight); ctx.restore(); }
function drawSteeringWheel() { if (!assets.steeringWheel.complete) return; const wheelSize = 360; const wheelX = canvas.width / 2 - 140; const wheelY = canvas.height / 2 + 260; const steeringShakeIntensity = gameState.isInGrass ? 6 : 1; const steeringShake = Math.sin(gameState.shakeTime * 20) * (gameState.speedKmH / gameState.maxSpeedKmH) * steeringShakeIntensity; ctx.save(); ctx.translate(wheelX + gameState.shakeX * 0.7, wheelY + gameState.shakeY * 0.8 + gameState.cockpitVerticalOffset); ctx.rotate(((gameState.steeringAngle + steeringShake) * Math.PI) / 180); ctx.drawImage(assets.steeringWheel, -wheelSize / 2, -wheelSize / 2, wheelSize, wheelSize); ctx.restore(); }
function isMouseOverSpeedIndicator(clientX, clientY) { const mousePos = getCanvasMousePos(clientX, clientY); const centerX = canvas.width / 2; const centerY = canvas.height / 2; const wskX = centerX - 134; const wskY = centerY + 170; const indicatorWidth = 60; const indicatorHeight = 60; return mousePos.x >= wskX - indicatorWidth/2 && mousePos.x <= wskX + indicatorWidth/2 && mousePos.y >= wskY - indicatorHeight/2 && mousePos.y <= wskY + indicatorHeight/2; }
function isMouseOverTempIndicator(clientX, clientY) { const mousePos = getCanvasMousePos(clientX, clientY); const centerX = canvas.width / 2; const centerY = canvas.height / 2; const tempWskX = centerX + 79; const tempWskY = centerY + 299; const indicatorWidth = 60; const indicatorHeight = 60; return mousePos.x >= tempWskX - indicatorWidth/2 && mousePos.x <= tempWskX + indicatorWidth/2 && mousePos.y >= tempWskY - indicatorHeight/2 && mousePos.y <= tempWskY + indicatorHeight/2; }
const mapShake = { intensity: 0, time: 0, active: false };
function updateHanger(deltaTime) { if (hangerState.isDragging) return; const turnForce = -gameState.tilt * 0.0008; const shakeForce = -gameState.shakeX * 0.002; const restoringForce = -hangerState.angle * hangerState.stiffness; const acceleration = restoringForce + turnForce + shakeForce; hangerState.velocity += acceleration; hangerState.velocity *= hangerState.damping; if (gameState.isInGrass && Math.abs(gameState.shakeX) > 1) { if (Math.random() > 0.95) hangerState.velocity += (Math.random() - 0.5) * 0.03; } hangerState.angle += hangerState.velocity; }
function updateShifter() { switch (gameState.gear) { case 'N': shifterState.targetOffsetX = 700; shifterState.targetOffsetY = 1200; shifterState.targetAngle = 0; break; case '1': shifterState.targetOffsetX = 700; shifterState.targetOffsetY = 1170; shifterState.targetAngle = -0.15; break; case '2': shifterState.targetOffsetX = 700; shifterState.targetOffsetY = 1240; shifterState.targetAngle = -0.17; break; case '3': shifterState.targetOffsetX = 700; shifterState.targetOffsetY = 1240; shifterState.targetAngle = 0.15; break; case '4': shifterState.targetOffsetX = 700; shifterState.targetOffsetY = 1170; shifterState.targetAngle = 0.1; break; } const easeFactor = 0.18; shifterState.offsetX += (shifterState.targetOffsetX - shifterState.offsetX) * easeFactor; shifterState.offsetY += (shifterState.targetOffsetY - shifterState.offsetY) * easeFactor; shifterState.angle += (shifterState.targetAngle - shifterState.angle) * easeFactor; const rpmFactor = (gameState.rpm - 800) / (gameState.maxRpm - 800); const currentShakeIntensity = shifterState.shakeIntensity + (rpmFactor * 4.5); shifterState.shakeX = (Math.random() - 0.5) * currentShakeIntensity; shifterState.shakeY = (Math.random() - 0.5) * currentShakeIntensity; }
function updatePedals(deltaTime) { 
    if (controls.w && gameState.speedKmH > 0) { 
        pedalState.gas.targetYOffset = pedalState.pressedYOffset; 
        pedalState.gas.targetScale = pedalState.pressedScale; 
    } else { 
        pedalState.gas.targetYOffset = 0; 
        pedalState.gas.targetScale = 1; 
    } 
    
    if (controls.s) { 
        pedalState.brake.targetYOffset = pedalState.pressedYOffset; 
        pedalState.brake.targetScale = pedalState.pressedScale; 
    } else { 
        pedalState.brake.targetYOffset = 0; 
        pedalState.brake.targetScale = 1; 
    } 
    
    if (pedalState.clutchPressTimer > 0) pedalState.clutchPressTimer -= deltaTime; 
    
    if (gameState.gear === 'N' || pedalState.clutchPressTimer > 0) { 
        pedalState.clutch.targetYOffset = pedalState.pressedYOffset; 
        pedalState.clutch.targetScale = pedalState.pressedScale; 
    } else { 
        pedalState.clutch.targetYOffset = 0; 
        pedalState.clutch.targetScale = 1; 
    } 
    
    const pedals = [pedalState.gas, pedalState.brake, pedalState.clutch]; 
    for (const pedal of pedals) { 
        pedal.yOffset += (pedal.targetYOffset - pedal.yOffset) * pedalState.easeFactor; 
        pedal.scale += (pedal.targetScale - pedal.scale) * pedalState.easeFactor; 
    } 
}
function updateWindow(deltaTime) { 
    const canPlaySound = audio.unlocked && audio.windowrolling && typeof audio.windowrolling.play === 'function'; 
    const shouldBeMoving = Math.abs(windowState.glassTargetYOffset - windowState.glassYOffset) > 7.0;

    if (shouldBeMoving) { 
        const easeFactor = 0.112; 
        windowState.glassYOffset += (windowState.glassTargetYOffset - windowState.glassYOffset) * easeFactor;

        windowState.isMoving = true; 
        if (canPlaySound && audio.windowrolling.paused) { 
            audio.windowrolling.currentTime = 0; 
            audio.windowrolling.play().catch(e => console.warn("Failed to play window rolling sound:", e)); 
        } 
    } else { 
        if(windowState.glassYOffset !== windowState.glassTargetYOffset) {
            windowState.glassYOffset = windowState.glassTargetYOffset;
        }
        windowState.isMoving = false; 
        if (canPlaySound && !audio.windowrolling.paused) { 
            audio.windowrolling.pause(); 
        } 
    } 

    const { handleAnimationSpeed } = windowState;
    windowState.handleScaleX += (windowState.handleTargetScaleX - windowState.handleScaleX) * handleAnimationSpeed;

    if (Math.abs(windowState.handleScaleX) < 0.1) {
        if (windowState.handleTargetScaleX === 0) {
            windowState.handleIsFlipped = !windowState.handleIsFlipped;
            assets.windowButton = windowState.handleIsFlipped ? assets.windowButtonHandle2 : assets.windowButtonHandle1;
            windowState.handleTargetScaleX = 1;
        }
    }

    if (Math.abs(windowState.handleScaleX - 1) < 0.01 && windowState.handleTargetScaleX === 1) {
        windowState.handleScaleX = 1;
    }
}

function updateMapAccordion(deltaTime) {
    if (!mapVisible) {
        mapAccordionState.isHeld = false;
        return;
    }
    
    // --- NOWA LOGIKA: Aktualizacja "sztywnego" postępu ---
    // Określ docelowy postęp: 1.0 dla złożonej, 0.0 dla prostej (trzymanej)
    const targetProgress = mapAccordionState.isHeld ? 0.0 : 1.0;
    // Płynnie zmień `stiffProgress` w kierunku wartości docelowej.
    // Współczynnik 0.1 kontroluje prędkość tej animacji.
    mapAccordionState.stiffProgress += (targetProgress - mapAccordionState.stiffProgress) * 0.1;
    // --- KONIEC NOWEJ LOGIKI ---

    const targetAngleBase = mapAccordionState.isHeld 
        ? mapAccordionState.heldAngle 
        : mapAccordionState.restAngle;

    for (let i = 0; i < NUM_MAP_STRIPS; i++) {
        const targetAngle = (i % 2 === 0) ? targetAngleBase : -targetAngleBase;
        const strip = mapAccordionState.strips[i];
        const force = (targetAngle - strip.angle) * mapAccordionState.stiffness;
        mapAccordionState.velocities[i] += force;
        mapAccordionState.velocities[i] *= mapAccordionState.damping;
        strip.angle += mapAccordionState.velocities[i];
    }
}
function updateMirror(deltaTime) {
    // DODAJ TĘ LINIĘ NA SAMEJ GÓRZE FUNKCJI
    console.log("UpdateMirror - isFlipped:", mirrorState.isFlipped, "opacity1:", mirrorState.opacity1.toFixed(2));

    // Fizyka bujania się lusterka (bez zmian)
    const force = (mirrorState.targetAngle - mirrorState.angle) * mirrorState.stiffness;
    // Fizyka bujania się lusterka
    mirrorState.velocity += force;
    mirrorState.velocity *= mirrorState.damping;
    mirrorState.angle += mirrorState.velocity;

    if (Math.abs(mirrorState.velocity) < 0.001) {
        mirrorState.targetAngle *= 0.95;
    }
    
    // Określamy docelową przezroczystość dla obu obrazków
    const targetOpacity1 = mirrorState.isFlipped ? 0 : 1;
    const targetOpacity2 = mirrorState.isFlipped ? 1 : 0;
    
    const easeFactor = 0.15; 
    mirrorState.opacity1 += (targetOpacity1 - mirrorState.opacity1) * easeFactor;
    mirrorState.opacity2 += (targetOpacity2 - mirrorState.opacity2) * easeFactor;

    // --- NOWY KOD: Dopnij wartości, gdy są blisko celu ---
    if (Math.abs(mirrorState.opacity1 - targetOpacity1) < 0.01) {
        mirrorState.opacity1 = targetOpacity1;
    }
    if (Math.abs(mirrorState.opacity2 - targetOpacity2) < 0.01) {
        mirrorState.opacity2 = targetOpacity2;
    }
}


// --- NOWY KOD: FUNKCJA AKTUALIZUJĄCA NOWĄ KLAMKĘ ---
function updateHandleMirror(deltaTime) {
    // Płynny powrót do pozycji wyjściowej (kąt 0)
    if (Math.abs(handleMirrorState.angle) > 0.01) {
        handleMirrorState.angle *= 0.92; // Współczynnik tłumienia
    } else {
        handleMirrorState.angle = 0;
    }
}

// --- NOWY KOD: FUNKCJA AKTUALIZUJĄCA NOWE PRZYCISKI ---
function updateCustomButtons(deltaTime) {
    const { b1, b2, pressedValues, easeFactor } = buttonState;
    const sizeReduction = 4; // Zmniejszenie wielkości w pikselach

    // --- Aktualizacja Przycisku 1 (związany z 'z' - hazard) ---
    const isB1Pressed = controlsState.hazardOn;
    b1.targetOffsetX = isB1Pressed ? pressedValues.offsetX : 0;
    b1.targetAngle = isB1Pressed ? pressedValues.angle : 0;
    // Skala jest obliczana na podstawie redukcji w pikselach
    b1.targetScale = isB1Pressed ? (b1.width - sizeReduction) / b1.width : 1;
    
    // Płynna animacja do wartości docelowych
    b1.offsetX += (b1.targetOffsetX - b1.offsetX) * easeFactor;
    b1.angle += (b1.targetAngle - b1.angle) * easeFactor;
    b1.scale += (b1.targetScale - b1.scale) * easeFactor;

    // --- Aktualizacja Przycisku 2 (związany z 'j') ---
    const isB2Pressed = b2.isPressed;
    b2.targetOffsetX = isB2Pressed ? pressedValues.offsetX : 0;
    b2.targetAngle = isB2Pressed ? pressedValues.angle : 0;
    b2.targetScale = isB2Pressed ? (b2.width - sizeReduction) / b2.width : 1;
    
    // Płynna animacja do wartości docelowych
    b2.offsetX += (b2.targetOffsetX - b2.offsetX) * easeFactor;
    b2.angle += (b2.targetAngle - b2.angle) * easeFactor;
    b2.scale += (b2.targetScale - b2.scale) * easeFactor;
}

function updateArmSway(deltaTime) {
    const state = armClockState;
    
    // Uruchamiamy drganie tylko wtedy, gdy ramię jest w pełni wysunięte (animacja zakończona)
    if (state.animationProgress >= 1.0) {
        state.swayTime += deltaTime;
        const { angleAmplitude, angleFrequency, positionAmplitude, positionFrequency } = state.swayConfig;

        // Używamy funkcji sinus i cosinus do uzyskania gładkiego, naturalnego ruchu
        state.swayAngleOffset = Math.sin(state.swayTime * angleFrequency) * angleAmplitude;
        state.swayPositionOffsetX = Math.sin(state.swayTime * positionFrequency) * positionAmplitude;
        // Użycie cosinusa dla osi Y stworzy bardziej eliptyczny/okrężny ruch, co wygląda naturalniej
        state.swayPositionOffsetY = Math.cos(state.swayTime * positionFrequency) * positionAmplitude;
    } else {
        // Jeśli ramię nie jest wysunięte, resetujemy przesunięcia, aby uniknąć błędów
        state.swayAngleOffset = 0.0;
        state.swayPositionOffsetX = 0.0;
        state.swayPositionOffsetY = 0.0;
    }
}

// --- NOWY KOD: Funkcja do aktualizacji animacji ramienia z zegarem ---
function updateArmClockAnimation(deltaTime) {
    const state = armClockState;
    const targetProgress = state.isShownTarget ? 1.0 : 0.0;
    let progressChanged = false;

    // Płynne dążenie do wartości docelowej (1.0 lub 0.0)
    if (Math.abs(state.animationProgress - targetProgress) > 0.001) {
        const direction = targetProgress > state.animationProgress ? 1 : -1;
        state.animationProgress += direction * state.animationSpeed * deltaTime;
        progressChanged = true;
    }

    // Ograniczenie wartości postępu do przedziału [0, 1]
    state.animationProgress = Math.max(0.0, Math.min(1.0, state.animationProgress));

    // Obliczanie aktualnej pozycji i kąta tylko jeśli animacja jest w toku
    if (progressChanged || state.animationProgress > 0) {
        // Funkcja "ease-in-out" dla płynniejszego startu i końca
        const easedProgress = (1 - Math.cos(state.animationProgress * Math.PI)) / 2;

        // Interpolacja (obliczanie wartości pośrednich) dla pozycji
        state.currentPosition.x = state.startPosition.x + (state.endPosition.x - state.startPosition.x) * easedProgress;
        state.currentPosition.y = state.startPosition.y + (state.endPosition.y - state.startPosition.y) * easedProgress;

        // Interpolacja dla kąta
        state.currentAngle = state.startAngle + (state.endAngle - state.startAngle) * easedProgress;
    }
}


function toggleWindow() { if (windowState.glassYOffset === 0) { windowState.glassTargetYOffset = windowState.glassMaxDownOffset; } else { windowState.glassTargetYOffset = 0; } windowState.isMoving = true; }
canvas.addEventListener("click", (e) => {
    // Globalny strażnik: Działaj tylko gdy gra nie jest w menu
    if (vhsMenuState.isOpen || rotaryMenuState.isActive) {
        return;
    }

    // --- GŁÓWNY STRAŻNIK: Działaj tylko dla widoku kokpitu ---
    if (currentView !== 'cockpit') {
        return;
    }

    const mousePos = getCanvasMousePos(e.clientX, e.clientY);
    const mirrorArea = mirrorState.position;

    // Logika dla lusterka
    if (isMouseOver(mousePos, mirrorArea)) {
        console.log("JEDEN KLIK! Zmieniam isFlipped na:", !mirrorState.isFlipped); // Zostawmy to do testów
        mirrorState.isFlipped = !mirrorState.isFlipped;
        hangerState.velocity += 0.11;

        if (mirrorState.isFlipped) {
            mirrorState.targetAngle = 0.04;
            mirrorState.velocity = 0.22;
        } else {
            mirrorState.targetAngle = -0.04;
            mirrorState.velocity = -0.22;
        }

        if (audio.unlocked && audio.press) {
            audio.press.currentTime = 0;
            audio.press.volume = 0.6;
            audio.press.play().catch(() => {});
        }
        return; // Zakończ, aby nie aktywować logiki klaksonu
    }

    // Logika dla klaksonu
    const wheelX = canvas.width / 2 - 140;
    const wheelY = canvas.height / 2 + 260;
    const wheelSize = 150;
    const distX = mousePos.x - wheelX;
    const distY = mousePos.y - wheelY;
    const distance = Math.sqrt(distX * distX + distY * distY);
    if (distance <= wheelSize / 2 && audio.unlocked) {
        audio.horn.currentTime = 0;
        audio.horn.play().catch(() => {});
    }
});


function handleWindowScroll(e) {
    e.preventDefault();
    const delta = Math.sign(e.deltaY);
    const scrollStep = 50; 

    let newTargetY = windowState.glassTargetYOffset;

    if (delta > 0) {
        newTargetY += scrollStep;
    } else {
        newTargetY -= scrollStep;
    }

    windowState.glassTargetYOffset = Math.max(0, Math.min(windowState.glassMaxDownOffset, newTargetY));
}

// --- ZMODYFIKOWANY KOD: OBSŁUGA SCROLLA DLA NOWEJ KLAMKI ---
// --- ZASTĄP CAŁY ISTNIEJĄCY LISTENER TYM NOWYM ---
window.addEventListener('wheel', (e) => {
    const mousePos = getCanvasMousePos(e.clientX, e.clientY);

    // --- NOWY BLOK: OBSŁUGA SCROLLOWANIA TRZYMANEJ BUTELKI OLEJU ---
    // Ta logika jest nadrzędna, ponieważ butelkę można trzymać w różnych widokach.
    if (heldOilState.isHeld) {
        e.preventDefault(); // Zapobiegamy standardowemu przewijaniu strony

        // Określamy kierunek scrollowania: -1 dla góra, 1 dla dół
        const direction = Math.sign(e.deltaY); 

        // Dodajemy "pchnięcie" do prędkości kątowej.
        // Istniejąca fizyka w `updateHeldOil` zajmie się resztą (obrotem i tłumieniem).
        // Dzięki temu obrót będzie płynny i spójny z ruchem myszki.
        heldOilState.angleVelocity += direction * heldOilState.scrollTiltAmount;

        // Opcjonalnie: odtwórz dźwięk scrollowania, jeśli chcesz
        if (audio.unlocked && audio.scroll) {
            audio.scroll.currentTime = 0;
            audio.scroll.volume = 0.2; // Ciszej niż normalnie
            audio.scroll.play().catch(() => {});
        }

        return; // Kończymy obsługę zdarzenia, aby nie aktywować innych funkcji (np. zoomu mapy)
    }
    // --- KONIEC NOWEGO BLOKU ---

    // Zoom nakładek działa zawsze, więc jest na samej górze
    if (mapVisible || photoVisible || carSignVisible || docOverlayVisible) {
        handleOverlayZoom(e);
        return; // Zakończ, aby nie aktywować logiki specyficznej dla widoku
    }

    // --- POPRAWIONA STRUKTURA: Sprawdzamy, w którym widoku jesteśmy ---
    
    if (currentView === 'cockpit') {
        // Logika scrolla TYLKO dla widoku kokpitu
        if (isMouseOver(mousePos, windowState.buttonPosition)) {
            handleWindowScroll(e);
            windowState.handleScrollAccumulator += Math.abs(e.deltaY);
            if (windowState.handleScrollAccumulator >= windowState.handleFlipThreshold && Math.abs(windowState.handleScaleX - 1) < 0.1) {
                windowState.handleTargetScaleX = 0;
                windowState.handleScrollAccumulator = 0.0;
                if (audio.unlocked && audio.press) { audio.press.currentTime = 0; audio.press.volume = 0.8; audio.press.play().catch(() => {}); }
            }
            return; 
        } 
        else if (isMouseOver(mousePos, handleMirrorState.position)) {
            e.preventDefault();
            const delta = Math.sign(e.deltaY);
            const randomAngle = Math.random() * 0.15 + 0.05; 
            if (delta < 0) { handleMirrorState.angle = randomAngle; handleMirrorState.sourceOffsetX -= 2.59; handleMirrorState.sourceOffsetY += 0.28; } 
            else { handleMirrorState.angle = -randomAngle; handleMirrorState.sourceOffsetX += 2.52; handleMirrorState.sourceOffsetY -= 0.31; }
            
            if (audio.unlocked && audio.scroll) { 
                audio.scroll.currentTime = 0; 
                audio.scroll.volume = 0.4; 
                audio.scroll.play().catch(() => {}); 
            }
        }
        else if (isMouseOver(mousePos, radioState.volumeButton)) {
            handleRadioVolumeScroll(e);
        }

    } else if (currentView === 'engine') {
        if (isMouseOver(mousePos, oilCapState)) {
            e.preventDefault();
            const delta = Math.sign(e.deltaY); 
            let soundShouldPlay = false;

            if (delta > 0) { // Scroll w dół (wkręcanie)
                // --- NOWY WARUNEK ---
                // Odtwórz dźwięk tylko, jeśli korek NIE jest już wkręcony na maksa
                if (oilCapState.unscrewProgress > 0) {
                    soundShouldPlay = true;
                }
                oilCapState.unscrewProgress -= oilCapState.scrollSensitivity * Math.abs(e.deltaY);
            } 
            else { // Scroll w górę (odkręcanie)
                // --- NOWY WARUNEK ---
                // Odtwórz dźwięk tylko, jeśli korek NIE jest już odkręcony na maksa
                if (oilCapState.unscrewProgress < oilCapState.maxUnscrewProgress) {
                    soundShouldPlay = true;
                }
                oilCapState.unscrewProgress += oilCapState.scrollSensitivity * Math.abs(e.deltaY);
            }
            
            // Ograniczamy wartość postępu, aby nie wychodziła poza zakres
            oilCapState.unscrewProgress = Math.max(0, Math.min(oilCapState.maxUnscrewProgress, oilCapState.unscrewProgress));
            
            // Odtwarzamy dźwięk, jeśli warunek został spełniony
            if (soundShouldPlay && audio.unlocked && audio.screw) {
                audio.screw.currentTime = 0;
                audio.screw.volume = 0.8;
                audio.screw.play().catch(e => console.warn("Nie udało się odtworzyć screw.mp3", e));
            }
        }
    }

}, { passive: false });

function handleCrashState(deltaTime) {
    // Ta funkcja jest wywoływana w każdej klatce, gdy trwa wypadek.
    if (!gameState.crashState.active) return;

    // 1. Aktualizuj timer efektów wizualnych (blur, ciemnienie)
    gameState.crashState.effectTimer += deltaTime;

    // 2. Odbierz graczowi kontrolę nad pojazdem
    controls.w = false;
    controls.a = false;
    controls.s = false;
    controls.d = false;

    // 3. Aplikuj bezwładne wytracanie prędkości
    if (gameState.speedKmH > 0) {
        // Użyjmy "decelerationIdleKmH", aby symulować toczenie się.
        // Możemy to pomnożyć, aby zasymulować większe tarcie/uszkodzenia.
        const crashDeceleration = gameState.decelerationIdleKmH * 5.0; // Zwalnia 5x szybciej niż zwykłe toczenie się
        gameState.speedKmH -= crashDeceleration;
        
        // Upewnij się, że prędkość nie spadnie poniżej zera
        gameState.speedKmH = Math.max(0, gameState.speedKmH);
    }
}
function updateSignSpawner() { signsToSpawn.forEach(signData => { if (!signData.spawned && totalDistanceTraveled >= signData.distance) { const asset = assets.signs.find(s => s.originalData === signData); if (!asset) return; const newSign = { sliceIndex: gameState.roadsideMaxSlices, side: signData.side, image: asset.image, sizeVariation: 0.4, xOffset: -20 }; activeSigns.push(newSign); signData.spawned = true; } }); }
function updateCityStatus() { let inCity = false; for (const zone of cityZones) { if (totalDistanceTraveled >= zone.startDistance && totalDistanceTraveled <= zone.endDistance) { inCity = true; break; } } gameState.isInCity = inCity; }

function updateRadioAnimation(deltaTime) {
    const targetProgress = radioState.volume > 0 ? 1 : 0;
    const changeAmount = deltaTime / radioState.transitionDuration;

    if (radioState.transitionProgress < targetProgress) {
        radioState.transitionProgress = Math.min(targetProgress, radioState.transitionProgress + changeAmount);
    } else if (radioState.transitionProgress > targetProgress) {
        radioState.transitionProgress = Math.max(targetProgress, radioState.transitionProgress - changeAmount);
    }

    if (radioState.transitionProgress <= 0) {
        radioState.opacity = 0;
    } else if (radioState.transitionProgress >= 1) {
        radioState.opacity = 1;
    } else {
        radioState.opacity = 0.2 + Math.random() * 0.6; 
    }
}

function updateLightsIndicator(deltaTime) {
    const targetProgress = controlsState.lightsOn ? 1 : 0;
    const changeAmount = deltaTime / lightsIndicatorState.transitionDuration;

    if (lightsIndicatorState.transitionProgress < targetProgress) {
        lightsIndicatorState.transitionProgress = Math.min(targetProgress, lightsIndicatorState.transitionProgress + changeAmount);
    } else if (lightsIndicatorState.transitionProgress > targetProgress) {
        lightsIndicatorState.transitionProgress = Math.max(targetProgress, lightsIndicatorState.transitionProgress - changeAmount);
    }

    if (lightsIndicatorState.transitionProgress <= 0) {
        lightsIndicatorState.opacity = 0;
    } else if (lightsIndicatorState.transitionProgress >= 1) {
        lightsIndicatorState.opacity = 1;
    } else {
        lightsIndicatorState.opacity = 0.3 + Math.random() * 0.7;
    }
}

// --- NOWY KOD: FUNKCJA AKTUALIZUJĄCA ANIMACJĘ OŚWIETLENIA WNĘTRZA ---
function updateInteriorLight(deltaTime) {
    // Używamy stanu przycisku 'j' (b2) jako wyzwalacza
    const targetProgress = buttonState.b2.isPressed ? 1 : 0;
    const changeAmount = deltaTime / interiorLightState.transitionDuration;

    // Logika przejścia (fade-in/fade-out)
    if (interiorLightState.transitionProgress < targetProgress) {
        interiorLightState.transitionProgress = Math.min(targetProgress, interiorLightState.transitionProgress + changeAmount);
    } else if (interiorLightState.transitionProgress > targetProgress) {
        interiorLightState.transitionProgress = Math.max(targetProgress, interiorLightState.transitionProgress - changeAmount);
    }

    // Aplikowanie migotania, tak jak w radiu, ale tylko podczas przejścia
    if (interiorLightState.transitionProgress <= 0) {
        interiorLightState.opacity = 0;
    } else if (interiorLightState.transitionProgress >= 1) {
        interiorLightState.opacity = 1; // Przy pełnym włączeniu, stała jasność
    } else {
        // Efekt migotania podczas animacji włączania/wyłączania
        interiorLightState.opacity = 0.4 + Math.random() * 0.6;
    }
}

function updateRadio(deltaTime) {
    if (!audio.unlocked) return;

    if (audio.radio) {
        audio.radio.volume = radioState.volume / 10;
    }
    
    if (radioState.volume > 0 && !radioState.isRewinding) {
        if (audio.radio && audio.radio.paused) {
            audio.radio.play().catch(e => console.warn("Nie udało się odtworzyć radio.mp3:", e));
        }
    } else {
        if (audio.radio && !audio.radio.paused) {
            audio.radio.pause();
        }
    }

    if (radioState.isRewinding) {
        if (audio.rewind && audio.rewind.paused) {
            audio.rewind.play().catch(e => console.warn("Nie udało się odtworzyć rewind.mp3:", e));
        }
    } else {
        if (audio.rewind && !audio.rewind.paused) {
            audio.rewind.pause();
            audio.rewind.currentTime = 0;
        }
    }
}

function updateWipers(deltaTime) {
    if (wipersState.active) {
        // --- LOGIKA AKTYWNYCH WYCIERACZEK Z EFEKTEM "EASING" ---

        // 1. Obliczamy, jak daleko wycieraczka jest w swoim cyklu (wartość od 0 do 1)
        const range = wipersState.restAngle - wipersState.maxAngle;
        const progress = (wipersState.angle - wipersState.maxAngle) / range;

        // 2. Używamy funkcji sinus, aby na podstawie postępu (progress) stworzyć mnożnik prędkości.
        // Math.sin(progress * Math.PI) daje krzywą, która jest 0 na początku (progress=0),
        // 1 w środku (progress=0.5) i znowu 0 na końcu (progress=1).
        const easingFactor = Math.sin(progress * Math.PI);
        
        // 3. Dodajemy minimalną prędkość, aby wycieraczka nigdy się nie zatrzymała w punktach skrajnych.
        const minSpeedFactor = 0.1;
        const currentSpeed = wipersState.speed * (easingFactor + minSpeedFactor);
        
        // 4. Ustalamy kierunek ruchu (w stronę maxAngle lub restAngle)
        const movementDirection = wipersState.direction === 1 ? -1 : 1;

        // 5. Aktualizujemy kąt, używając obliczonej, dynamicznej prędkości
        wipersState.angle += currentSpeed * movementDirection * deltaTime;

        // 6. Sprawdzamy, czy dotarliśmy do granicy i zmieniamy kierunek
        if (wipersState.direction === 1 && wipersState.angle <= wipersState.maxAngle) {
            wipersState.angle = wipersState.maxAngle;
            wipersState.direction = -1; 
        } else if (wipersState.direction === -1 && wipersState.angle >= wipersState.restAngle) {
            wipersState.angle = wipersState.restAngle;
            wipersState.direction = 1;
        }

        // Odtwarzanie dźwięku
        if (audio.unlocked && audio.wiper && audio.wiper.paused) {
            audio.wiper.play().catch(e => console.warn("Nie udało się odtworzyć wiper.mp3:", e));
        }

    } else {
        // --- LOGIKA PŁYNNEGO POWROTU DO POZYCJI SPOCZYNKOWEJ ---
        
        // Ta część jest już poprawna - używa płynnego "ease out" do powrotu.
        const distanceToRest = Math.abs(wipersState.angle - wipersState.restAngle);
        
        if (distanceToRest > 0.04) {
            // Płynne spowolnienie przy zbliżaniu się do celu.
            wipersState.angle += (wipersState.restAngle - wipersState.angle) * 0.08;

            // Dźwięk powinien grać, dopóki ramię się rusza
            if (audio.unlocked && audio.wiper && audio.wiper.paused) {
                 audio.wiper.play().catch(e => console.warn("Nie udało się odtworzyć wiper.mp3:", e));
            }
        } else {
            // Ustawiamy finalną pozycję i zatrzymujemy dźwięk
            wipersState.angle = wipersState.restAngle;
            if (audio.unlocked && audio.wiper && !audio.wiper.paused) {
                audio.wiper.pause();
            }
            // Resetujemy kierunek na następny start
            wipersState.direction = 1;
        }
    }
}

function updateWorldObjects(deltaTime, speedKmH) {
    if (gameState.crashState.active) {
        // --- POPRAWKA: Upewnij się, że docelowa głośność jest 0 po kraksie ---
        gameState.opponentTargetVolume = 0.0;
        return;
    }
    const distanceThisFrame = (speedKmH / 3.6) * deltaTime;
    totalDistanceTraveled += distanceThisFrame;

    // === POCZĄTEK TWOJEJ POPRAWKI ===
    // Sprawdzamy, czy gracz jest w ogóle pijany. Jeśli nie, nie ma sensu liczyć.
    if (stanUpojenia.liczbaWypitychPiw > 0) {
        // Dodajemy przejechany dystans do naszego akumulatora.
        gameState.distanceForSoberingUp += distanceThisFrame;

        // Sprawdzamy, czy w akumulatorze uzbierał się co najmniej 1 kilometr (1000 metrów).
        if (gameState.distanceForSoberingUp >= 750) {
            // Obliczamy, ile PEŁNYCH kilometrów zostało przejechane.
            const kilometersTraveled = Math.floor(gameState.distanceForSoberingUp / 750);

            // Obliczamy, o ile zmniejszyć stan nietrzeźwości.
            const sobrietyGain = kilometersTraveled * 1.5;
            
            // Zmniejszamy liczbę "wypitych piw".
            stanUpojenia.liczbaWypitychPiw -= sobrietyGain;

            // Upewniamy się, że wartość nie spadnie poniżej zera.
            stanUpojenia.liczbaWypitychPiw = Math.max(0, stanUpojenia.liczbaWypitychPiw);

            // Odejmujemy "przetworzony" dystans z akumulatora, zostawiając resztę.
            // Np. jeśli było 2500m, odejmujemy 2000m, zostaje 500m na następne obliczenia.
            gameState.distanceForSoberingUp -= kilometersTraveled * 1000;
            
            console.log(`Przejechano ${kilometersTraveled} km. Stan piwa zmniejszony o ${sobrietyGain}. Nowa wartość: ${stanUpojenia.liczbaWypitychPiw.toFixed(2)}`);
        }
    }
    // === KONIEC TWOJEJ POPRAWKI ===

    if (speedKmH > 0) {
        armClockState.distanceAccumulator += distanceThisFrame;
        const METERS_PER_TICK = 19;

        if (armClockState.distanceAccumulator >= METERS_PER_TICK) {
            const ticks = Math.floor(armClockState.distanceAccumulator / METERS_PER_TICK);
            armClockState.secondCounter += ticks;
            if (armClockState.secondCounter >= 60) {
                const minutesToAdd = Math.floor(armClockState.secondCounter / 60);
                armClockState.mainClock.minutes += minutesToAdd;
                armClockState.secondCounter %= 60;
                if (armClockState.mainClock.minutes >= 60) {
                    const hoursToAdd = Math.floor(armClockState.mainClock.minutes / 60);
                    armClockState.mainClock.hours += hoursToAdd;
                    armClockState.mainClock.minutes %= 60;
                    armClockState.mainClock.hours %= 24;
                }
            }
            armClockState.distanceAccumulator -= ticks * METERS_PER_TICK;
        }
    }

    updateCityStatus(); updatePickets(speedKmH); updateSignSpawner();updateLanternSpawner();
    updateTrees(speedKmH); updateBackgroundTrees(speedKmH); updateBuildings(speedKmH);
    updateForests(speedKmH); updateFields(speedKmH); updatePoles(speedKmH);
    updateBackForests(speedKmH); updateSigns(speedKmH); updateGrass(speedKmH); updateLanterns(speedKmH); // <--- DODAJ TĘ LINIĘ
    updateSecondGrass(speedKmH); updateGround(speedKmH);
    
    // --- POPRAWKA: Przechwyć docelową głośność zwróconą przez funkcję ---
    gameState.opponentTargetVolume = updateSlowOpponents(deltaTime, speedKmH);
}

function stopAllEngineSounds() {
    const engineAndDriveSounds = [audio.ac, audio.ac1, audio.idle, audio.reduction, audio.breaking, audio.gravel];
    engineAndDriveSounds.forEach(s => {
        if (s && typeof s.pause === 'function' && !s.paused) { 
            s.pause();
        }
    });
}

function manageGameSounds() {
    if (!audio.unlocked) return;

    // Najpierw sprawdzamy stany, które wyłączają wszystkie dźwięki gry
    if (gameState.crashState.active) {
        stopAllEngineSounds();
        if (audio.opponent && !audio.opponent.paused) audio.opponent.pause();
        if (audio.c_engineidle && !audio.c_engineidle.paused) audio.c_engineidle.pause();
        return; // Zakończ, jeśli jest wypadek
    }

    // Sprawdzamy globalne ustawienie dźwięku z menu
    const soundShouldBeOn = vhsMenuState.isSoundOn;
    Object.values(audio).forEach(sound => {
        if (sound instanceof HTMLAudioElement) {
            sound.muted = !soundShouldBeOn;
        }
    });

    if (!soundShouldBeOn) {
        stopAllEngineSounds();
        if (audio.opponent && !audio.opponent.paused) audio.opponent.pause();
        if (audio.c_engineidle && !audio.c_engineidle.paused) audio.c_engineidle.pause();
        return; // Zakończ, jeśli dźwięk jest wyciszony w menu
    }


    // Teraz logika zależna od widoku
    if (currentView === 'cockpit') {
        // 1. Upewnij się, że dźwięk z innego widoku jest wyłączony
        if (audio.c_engineidle && !audio.c_engineidle.paused) {
            audio.c_engineidle.pause();
        }

        // 2. Uruchom logikę dźwięków dla kokpitu
        handleOverheatedSounds();
        updateRadio(window.deltaTime); // Przekazujemy deltaTime, jeśli funkcja tego wymaga
        
        // Logika dla dźwięku opponent.mp3
        if (audio.opponent) {
            const easeFactor = 0.05;
            audio.opponent.volume += (gameState.opponentTargetVolume - audio.opponent.volume) * easeFactor;
            if (gameState.opponentTargetVolume > 0 && audio.opponent.paused) {
                audio.opponent.play().catch(e => console.warn("Nie udało się odtworzyć opponent.mp3", e));
            } else if (audio.opponent.volume < 0.01 && !audio.opponent.paused) {
                audio.opponent.pause();
            }
        }
        
        // Logika dla dźwięków jazdy (przeniesiona z updateGameState)
        const wasBraking = !audio.breaking.paused;
        if (controls.s && gameState.speedKmH > 0) {
            if (audio.unlocked && audio.breaking.paused) {
        stopAllEngineSounds();
        audio.breaking.currentTime = 0; // <--- DODAJ TĘ LINIĘ
        audio.breaking.play().catch(console.warn); 
    }
        }
        if (wasBraking && !controls.s) {
            audio.breaking.pause();
            if (audio.unlocked && audio.idle.paused) { stopAllEngineSounds(); audio.idle.play().catch(console.warn); }
        }
        if (!controls.w && !controls.s && gameState.speedKmH <= 0) {
             if (audio.unlocked && audio.idle.paused && !wasBraking && !audio.reduction.paused) {
                stopAllEngineSounds();
                audio.idle.play().catch(console.warn);
            }
        }

    } else if (currentView === 'engine' || currentView === 'trunk') {
        // 1. Upewnij się, że dźwięki z kokpitu są wyłączone
        stopAllEngineSounds();
        if (audio.opponent && !audio.opponent.paused) {
            audio.opponent.pause();
        }

        // 2. Odtwarzaj dźwięk pracy silnika, jeśli nie jest przegrzany
        if (!gameState.isOverheating && audio.c_engineidle.paused) {
            audio.c_engineidle.currentTime = 0;
            audio.c_engineidle.volume = 0.6;
            audio.c_engineidle.play().catch(e => console.warn("Nie udało się odtworzyć c_engineidle.mp3", e));
        } else if (gameState.isOverheating && !audio.c_engineidle.paused) {
            audio.c_engineidle.pause();
        }

    } else {
        // Dla każdego innego, nieprzewidzianego widoku, wycisz wszystko
        stopAllEngineSounds();
        if (audio.opponent && !audio.opponent.paused) audio.opponent.pause();
        if (audio.c_engineidle && !audio.c_engineidle.paused) audio.c_engineidle.pause();
    }
}
function calculateRpmForSpeed(speed, gear) { let rpm = 0; const idleRpm = 800; switch (gear) { case '1': rpm = idleRpm + (speed / 30) * (gameState.maxRpm - idleRpm); break; case '2': if (speed >= 25) { rpm = 300 + ((speed - 25) / 35) * (gameState.maxRpm - 4000); } else { rpm = idleRpm + (speed / 25) * (1400 - idleRpm); } break; case '3': if (speed >= 55) { rpm = 2550 + ((speed - 55) / 35) * (gameState.maxRpm - 4500); } else { rpm = idleRpm + (speed / 55) * (2500 - idleRpm); } break; case '4': if (speed >= 80) { rpm = 500 + ((speed - 80) / (gameState.maxSpeedKmH - 80)) * (gameState.maxRpm - 5000); } else { rpm = idleRpm + (speed / 80) * (1400 - idleRpm); } break; default: rpm = idleRpm; } return Math.min(gameState.maxRpm, Math.max(idleRpm, rpm)); }
function updateAudioForGear() { stopAllEngineSounds(); if (!audio.unlocked || !controls.w) return; switch (gameState.gear) { case 'N': if(gameState.rpm > 1500) { audio.ac1.play().catch(console.warn); } break; case '1': audio.ac1.currentTime = (gameState.rpm / 10000) * 5.0; audio.ac1.play().catch(console.warn); break; case '2': case '3': audio.ac.currentTime = (gameState.rpm / 10000) * 10.0; audio.ac.play().catch(console.warn); break; case '4': audio.idle.play().catch(console.warn); break; } }
function shiftToNeutral() { if (gameState.gear === 'N' && gameState.speedKmH <= 0) return; gameState.gear = 'N'; stopAllEngineSounds(); if (audio.unlocked) { if (gameState.speedKmH > 1) { audio.reduction.currentTime = 0; audio.reduction.play().catch(console.warn); } else { audio.idle.play().catch(console.warn); } } }
function playRandomGearboxSound() { if (!audio.unlocked) return; const soundToPlay = Math.random() < 0.72 ? audio.gearbox : audio.gearbox2; soundToPlay.currentTime = 0; soundToPlay.play().catch(console.warn); }
function shiftToGear(targetGear) { if (gameState.gear === targetGear) return; playRandomGearboxSound(); gameState.gearShiftShake.active = true; gameState.gearShiftShake.timer = 0; pedalState.clutchPressTimer = pedalState.clutchPressDuration; gameState.gear = targetGear; if (targetGear === 'N') { shiftToNeutral(); } else { gameState.rpm = calculateRpmForSpeed(gameState.speedKmH, gameState.gear); if (controls.w) updateAudioForGear(); } }
function shiftUp() { const currentGearIndex = GEARS.indexOf(gameState.gear); if (currentGearIndex >= GEARS.length - 1) return; shiftToGear(GEARS[currentGearIndex + 1]); }
function shiftDown() { const currentGearIndex = GEARS.indexOf(gameState.gear); if (currentGearIndex <= 0) return; shiftToGear(GEARS[currentGearIndex - 1]); }

// ZMIANA: Dodano logikę aktualizacji dla drugiej manetki
function updateControls(deltaTime) {
    const anyBlinkerOn = controlsState.hazardOn || controlsState.leftBlinkerOn || controlsState.rightBlinkerOn;
    if (anyBlinkerOn && !gameState.crashState.active) {
        controlsState.blinkerTimer += deltaTime;
        if (controlsState.blinkerTimer > 0.32) {
            controlsState.blinkerTimer = 0;
            controlsState.blinkerVisible = !controlsState.blinkerVisible;
        }
    } else {
        controlsState.blinkerTimer = 0; controlsState.blinkerVisible = false;
    }
    if (audio.unlocked && audio.blinker) { if (anyBlinkerOn && !gameState.crashState.active) { if (audio.blinker.paused) { audio.blinker.currentTime = 0; audio.blinker.play().catch(e => console.warn("Failed to play blinker sound:", e)); } } else { if (!audio.blinker.paused) audio.blinker.pause(); } }
    controlsState.oilWarningOn = gameState.temperature > 110 || (gameState.isOverheating && gameState.speedKmH <= 0);
    controlsState.stopWarningOn = controls.s;
    if (!gameState.isOverheating || gameState.speedKmH > 0) {
        controlsState.acuTimer -= deltaTime;
        if (controlsState.acuTimer <= 0) {
            controlsState.isAcuProblemActive = !controlsState.isAcuProblemActive;
            if (controlsState.isAcuProblemActive) { controlsState.acuTimer = 3 + Math.random() * 7; } 
            else { controlsState.acuTimer = 30 + Math.random() * 150; }
        }
    }
    controlsState.acuWarningOn = controlsState.isAcuProblemActive || (gameState.isOverheating && gameState.speedKmH <= 0);
    let relativeSteeringAngleDegrees = (gameState.steeringAngle / gameState.maxSteeringAngle) * 180;
    const autoCancelThresholdDegrees = 10; const autoCancelMinSpeed = 5;
    if (controlsState.leftBlinkerOn && gameState.speedKmH > autoCancelMinSpeed && relativeSteeringAngleDegrees > autoCancelThresholdDegrees) { controlsState.leftBlinkerOn = false; }
    if (controlsState.rightBlinkerOn && gameState.speedKmH > autoCancelMinSpeed && relativeSteeringAngleDegrees < -autoCancelThresholdDegrees) { controlsState.rightBlinkerOn = false; }
    
    // Logika dla manetki 1 (kierunkowskazy)
    if (controlsState.leftBlinkerOn) { controlsState.leverTargetAngle = controlsState.leverLeftAngle; controlsState.leverY = 770; } 
    else if (controlsState.rightBlinkerOn) { controlsState.leverTargetAngle = controlsState.leverRightAngle; controlsState.leverY = 760; } 
    else { controlsState.leverTargetAngle = controlsState.leverBaseAngle; controlsState.leverY = 765; }
    controlsState.leverAngle += (controlsState.leverTargetAngle - controlsState.leverAngle) * controlsState.leverEaseFactor;

    // NOWY KOD: Logika dla manetki 2 (światła)
    if (controlsState.longLightsOn) {
        // Światła długie ('K')
        controlsState.lever2TargetAngle = controlsState.lever2LongLightsOnAngle;
        controlsState.lever2TargetX = controlsState.lever2BaseX + controlsState.lever2LongLightsOnXOffset;
    } else if (controlsState.lightsOn) {
        // Zwykłe światła ('L')
        controlsState.lever2TargetAngle = controlsState.lever2LightsOnAngle;
        controlsState.lever2TargetX = controlsState.lever2BaseX; // Powrót do bazowej pozycji X
    } else {
        // Światła wyłączone
        controlsState.lever2TargetAngle = controlsState.lever2BaseAngle;
        controlsState.lever2TargetX = controlsState.lever2BaseX; // Powrót do bazowej pozycji X
    }
    // Płynna animacja kąta i pozycji X dla manetki 2
    controlsState.lever2Angle += (controlsState.lever2TargetAngle - controlsState.lever2Angle) * controlsState.leverEaseFactor;
    controlsState.lever2X += (controlsState.lever2TargetX - controlsState.lever2X) * controlsState.leverEaseFactor;

if (wipersState.active) {
        // Ustaw docelowe wartości dla stanu "włączone"
        controlsState.lever3TargetX = controlsState.lever3ActiveX;
        controlsState.lever3TargetAngle = controlsState.lever3ActiveAngle;
    } else {
        // Ustaw docelowe wartości dla stanu "wyłączone" (pozycja spoczynkowa)
        controlsState.lever3TargetX = controlsState.lever3BaseX;
        controlsState.lever3TargetAngle = controlsState.lever3BaseAngle;
    }
    // Płynna animacja kąta i pozycji X dla manetki 3
    controlsState.lever3X += (controlsState.lever3TargetX - controlsState.lever3X) * controlsState.leverEaseFactor;
    controlsState.lever3Angle += (controlsState.lever3TargetAngle - controlsState.lever3Angle) * controlsState.leverEaseFactor;
}



function updateGameState(deltaTime) {
    // --- ZMIANA: Dodajemy nowy blok na samej górze funkcji ---
    if (introAnimationState.isActive) {
        updateIntroAnimation(deltaTime);
        // Blokujemy normalną aktualizację fizyki i sterowania gracza,
        // dopóki intro się nie zakończy.
        // Ale pozwalamy na aktualizację efektów wizualnych.
        updatePixelationEffect(deltaTime);
        updateHanger(deltaTime);
        updateShifter(); // Aby drążek biegów był na pozycji '2'
        updateControls(deltaTime);
        return; // WAŻNE: Wychodzimy z funkcji, aby nie wykonywać reszty logiki
    }

    // --- KONIEC NOWEJ LOGIKI ---

    if (currentView === 'cockpit') {
    
        if (gameState.crashState.active) {
            handleCrashState(deltaTime);
        }
    
        // ... (reszta funkcji updateGameState bez zmian aż do sekcji fizyki)
        updatePixelationEffect(deltaTime);
        windTime += deltaTime;
        updateWorldObjects(deltaTime, gameState.speedKmH);
        updateMapAccordion(deltaTime);
        updateArmClockAnimation(deltaTime);
        updateArmSway(deltaTime);
        updateBirds(deltaTime);
        updateWipers(deltaTime);
        updateLightsIndicator(deltaTime);
        updateInteriorLight(deltaTime);
        updateMirror(deltaTime);
        updateHandleMirror(deltaTime);
        updateCustomButtons(deltaTime);
        updateDocObject(deltaTime);
        updateHanger(deltaTime);
        updateShifter();
        updateWindow(deltaTime);
        updatePedals(deltaTime);
        updateControls(deltaTime);
        odometerState.targetValue = Math.floor(totalDistanceTraveled / 100);
        if (odometerState.currentValue < odometerState.targetValue) {
            const previousCurrentValue = odometerState.currentValue;
            odometerState.currentValue++;
            const oldDigits = String(previousCurrentValue).padStart(5, '0').split(''); 
            const newDigits = String(odometerState.currentValue).padStart(5, '0').split('');
            for (let i = 0; i < 5; i++) {
                if (oldDigits[i] !== newDigits[i]) {
                    odometerState.rollProgress[i] = 1.0;
                    odometerState.isRolling[i] = true;
                }
            }
            odometerState.displayDigits = newDigits;
        }
        for (let i = 0; i < 5; i++) {
            if (odometerState.isRolling[i]) {
                odometerState.rollProgress[i] -= odometerState.rollSpeed * deltaTime; 
                if (odometerState.rollProgress[i] <= 0) {
                    odometerState.rollProgress[i] = 0;
                    odometerState.isRolling[i] = false;
                }
            }
        }
        timeSinceLastCarSpawn += deltaTime * 1000;
        slowOpponentSpawner.timeSinceLastSpawn += deltaTime * 100;
        if (slowOpponentSpawner.timeSinceLastSpawn >= slowOpponentSpawner.nextSpawnTime) {
            spawnSlowOpponent();
        }
        if (timeSinceLastCarSpawn >= carSpawnInterval) { 
            spawnEnemyCar(); 
            timeSinceLastCarSpawn = 0; 
        }
        updateEnemyCars(deltaTime);
        if (audio.unlocked && audio.opponent) {
          const easeFactor = 0.05;
          audio.opponent.volume += (gameState.opponentTargetVolume - audio.opponent.volume) * easeFactor;
          if (gameState.opponentTargetVolume > 0 && audio.opponent.paused) {
              audio.opponent.play().catch(e => console.warn("Nie udało się odtworzyć opponent.mp3", e));
          } 
          else if (audio.opponent.volume < 0.01 && !audio.opponent.paused) {
              audio.opponent.pause();
          }
        }
        handleOverheatedSounds();
        updateRadio(deltaTime);
        updateRadioAnimation(deltaTime);
        if (gameState.isOverheating) controls.w = false;
        const wasBraking = !audio.breaking.paused;
        if (!controls.w) { let targetRpm = 100; if (gameState.gear !== 'N') targetRpm = calculateRpmForSpeed(gameState.speedKmH, gameState.gear); if (gameState.rpm > targetRpm) { gameState.rpm -= 4000 * deltaTime; gameState.rpm = Math.max(targetRpm, gameState.rpm); } else { gameState.rpm = targetRpm; } if (gameState.gear !== 'N' && gameState.speedKmH <= 1) shiftToNeutral(); } if (controls.w) { if (gameState.speedKmH < 3 && gameState.gear !== '1' && gameState.gear !== 'N') { shiftToNeutral(); } else { let rpmIncrease = 0; let accelFactor = 0; switch (gameState.gear) { case 'N': rpmIncrease = 0; if (gameState.speedKmH > 0) { gameState.speedKmH -= gameState.decelerationIdleKmH * 0.5; gameState.speedKmH = Math.max(0, gameState.speedKmH); } break; case '1': rpmIncrease = 2000; if (gameState.rpm < 9000) accelFactor = gameState.accelerationKmH * 2.14; break; case '2': rpmIncrease = 1000; if (gameState.rpm < 9000) accelFactor = gameState.accelerationKmH *1.53; break; case '3': rpmIncrease = 1000; if (gameState.rpm < 9000) accelFactor = gameState.accelerationKmH *0.91; break; case '4': if (gameState.rpm < 9000) accelFactor = gameState.accelerationKmH * 0.0956; break; } if (rpmIncrease > 0) gameState.rpm += rpmIncrease * deltaTime; if (accelFactor > 0) gameState.speedKmH += accelFactor * gameState.grassSlowdownFactor; if (gameState.gear === '1' && gameState.speedKmH > 45) gameState.speedKmH = 45; if (gameState.gear === '2' && gameState.speedKmH > 85) gameState.speedKmH = 65; if (gameState.gear === '3' && gameState.speedKmH > 100) gameState.speedKmH = 100; gameState.speedKmH = Math.min(gameState.speedKmH, gameState.maxSpeedKmH); if (gameState.rpm >= 10000) { gameState.rpm = 10000; if (gameState.gear === 'N' || gameState.gear === '1') { if (audio.ac1.currentTime > 4.9) audio.ac1.currentTime = 4.5; } if (gameState.gear === '2' || gameState.gear === '3') { if (audio.ac.currentTime > 9.9) audio.ac.currentTime = 9.0; } } } } if (controls.s && gameState.speedKmH > 0) { if (gameState.gear !== 'N') shiftToNeutral(); gameState.speedKmH -= gameState.decelerationKmH; gameState.speedKmH = Math.max(gameState.speedKmH, 0); if (audio.unlocked && audio.breaking.paused) { stopAllEngineSounds(); audio.breaking.play().catch(console.warn); } } if (wasBraking && !controls.s) { audio.breaking.pause(); if (audio.unlocked && audio.idle.paused) { stopAllEngineSounds(); audio.idle.play().catch(console.warn); } } if (!controls.w && !controls.s) { if (gameState.speedKmH > 0) { let deceleration = gameState.decelerationIdleKmH; if (gameState.gear !== 'N' && gameState.rpm > 9500) deceleration = gameState.decelerationKmH * 0.02; deceleration = gameState.isInGrass ? deceleration * 23 : deceleration; gameState.speedKmH -= deceleration; gameState.speedKmH = Math.max(gameState.speedKmH, 0); if (gameState.speedKmH < 1 && !audio.reduction.paused) { audio.reduction.pause(); if (audio.unlocked && audio.idle.paused) { stopAllEngineSounds(); audio.idle.play().catch(console.warn); } } } else { if (!audio.reduction.paused) audio.reduction.pause(); if (audio.unlocked && audio.idle.paused && !wasBraking) { stopAllEngineSounds(); audio.idle.play().catch(console.warn); } } }

        // --- ZUŻYCIE OLEJU I TEMPERATURA ---
        
        // Zużycie oleju zależne od obrotów silnika
        if (gameState.speedKmH > 1 && !gameState.isOverheating) {
            const oilConsumptionRate = 0.05; // Możesz dostosować tę wartość
            gameState.oilAmount -= (gameState.rpm / 10000) * oilConsumptionRate * deltaTime;
            gameState.oilAmount = Math.max(0, gameState.oilAmount); // Ogranicz do minimum 0
        }
        
        // Sprawdzenie, czy silnik się zatarł
        if (gameState.oilAmount <= 0 && !gameState.engineSeized) {
            console.log("SILNIK ZATARTY! Brak oleju.");
            gameState.isOverheating = true;
            gameState.engineSeized = true;
            gameState.overheatShake.active = true;
            gameState.overheatShake.timer = 0;
            gameState.temperature = 150;
        }

         if (gameState.speedKmH > 0 && !gameState.isOverheating) {
            // Obliczamy, ile oleju ma ubyć w ciągu jednej sekundy, aby
            // w 120 sekund ubyło dokładnie 1% (czyli 1.0 jednostki).
            const oilLossPerSecond = 1.0 / 120.0; 
            
            // Zmniejszamy ilość oleju, mnożąc ubytek na sekundę przez czas,
            // jaki upłynął od ostatniej klatki (deltaTime).
            gameState.oilAmount -= oilLossPerSecond * deltaTime;
            
            // Upewniamy się, że poziom oleju nie spadnie poniżej zera.
            gameState.oilAmount = Math.max(0, gameState.oilAmount);
        }
        
        // Sprawdzenie, czy silnik się zatarł z powodu braku oleju
        if (gameState.oilAmount <= 0 && !gameState.engineSeized) {
            console.log("SILNIK ZATARTY! Brak oleju.");
            gameState.isOverheating = true; // Uruchamiamy wizualne efekty przegrzania
            gameState.engineSeized = true;  // Ustawiamy flagę trwałego uszkodzenia
            gameState.overheatShake.active = true;
            gameState.overheatShake.timer = 0;
            gameState.temperature = 150; // Ustawiamy temperaturę na max
        }


        gameState.autoTurnTimer += deltaTime; if (gameState.autoTurnTimer > 1) { gameState.autoTurnTimer = 0; gameState.autoTurnTarget = Math.random() * 3.1 - 1.5; if (Math.random() < 0.1) gameState.autoTurnTarget = 0; }
        gameState.autoTurnAngle += (gameState.autoTurnTarget - gameState.autoTurnAngle) * 0.45; updateGrassEffects(deltaTime);
        if (gameState.speedKmH > 84 || gameState.speedKmH < 30) { gameState.temperature += gameState.temperatureIncreaseRate; } else { gameState.temperature -= gameState.temperatureDecreaseRate ; } gameState.temperature = Math.max(gameState.minTemperature, Math.min(gameState.maxTemperature, gameState.temperature)); if (gameState.temperature >= gameState.maxTemperature && !gameState.isOverheating) { gameState.isOverheating = true; gameState.overheatShake.active = true; gameState.overheatShake.timer = 0; console.log("Silnik przegrzany od temperatury!"); } if (gameState.rpm > 9600 && !gameState.isOverheating) { console.log("Obroty przekroczyły 9600! Przegrzanie silnika."); gameState.isOverheating = true; gameState.overheatShake.active = true; gameState.overheatShake.timer = 0; gameState.temperature = 150; }
        if (gameState.speedKmH > 1) { const steeringSensitivity = 0.12 + (gameState.speedKmH / gameState.maxSpeedKmH) * 0.01 /2; if (controls.a) gameState.carDirectionSpeed = -steeringSensitivity * (gameState.speedKmH / 10); else if (controls.d) gameState.carDirectionSpeed = steeringSensitivity * (gameState.speedKmH / 10); else { gameState.carDirectionSpeed *= 0.9; if (Math.abs(gameState.carDirectionSpeed) < 0.01) gameState.carDirectionSpeed = 0; } gameState.carDirectionSpeed += gameState.autoTurnAngle * 0.01; gameState.carDirection += gameState.carDirectionSpeed / 2; const maxTurnAngle = 5 + (gameState.speedKmH / gameState.maxSpeedKmH) * 10; gameState.carDirection = Math.max(-maxTurnAngle, Math.min(maxTurnAngle, gameState.carDirection)); const moveFactor = gameState.speedKmH / 100 ; gameState.playerX += Math.sin(gameState.carDirection * Math.PI / 200) * moveFactor * 63; gameState.playerX = Math.max(-gameState.maxOffset, Math.min(gameState.maxOffset, gameState.playerX)); gameState.tiltTarget = gameState.carDirection * 1.2 * (gameState.speedKmH / gameState.maxSpeedKmH); } else { gameState.carDirectionSpeed *= 0.9; gameState.tiltTarget = 0; }
        const targetSteeringAngle = gameState.carDirection * 12; gameState.steeringAngle += (targetSteeringAngle - gameState.steeringAngle) * 0.1; gameState.steeringAngle = Math.max(-gameState.maxSteeringAngle, Math.min(gameState.maxSteeringAngle, gameState.steeringAngle)); gameState.tilt += (gameState.tiltTarget - gameState.tilt) * 0.05;
        if (controls.w) gameState.cockpitVerticalTarget = -7; else if (controls.s) gameState.cockpitVerticalTarget = 9; else gameState.cockpitVerticalTarget = 0; gameState.cockpitVerticalOffset += (gameState.cockpitVerticalTarget - gameState.cockpitVerticalOffset) * 0.25;
        gameState.roadOffsetY += 1.5 * gameState.speedKmH / 100; if (gameState.roadOffsetY >= assets.road.height) gameState.roadOffsetY -= assets.road.height;
        gameState.shakeX = 0; gameState.shakeY = 0;
        if (gameState.crashState.active && gameState.crashState.effectTimer < gameState.crashState.crashShakeDuration) { const progress = gameState.crashState.effectTimer / gameState.crashState.crashShakeDuration; const currentIntensity = gameState.crashState.crashShakeIntensity * (1 - progress); gameState.shakeX += (Math.random() - 0.5) * 2 * currentIntensity; gameState.shakeY += (Math.random() - 0.5) * 2 * currentIntensity; }
        else if (gameState.overheatShake.active) { gameState.overheatShake.timer += deltaTime; if (gameState.overheatShake.timer < gameState.overheatShake.duration) { const progress = gameState.overheatShake.timer / gameState.overheatShake.duration; const currentIntensity = gameState.overheatShake.intensity * (1 - progress); gameState.shakeX += (Math.random() - 0.5) * 2 * currentIntensity; gameState.shakeY += (Math.random() - 0.5) * 2 * currentIntensity; } else gameState.overheatShake.active = false; }
        else if (gameState.gearShiftShake.active) { gameState.gearShiftShake.timer += deltaTime; if (gameState.gearShiftShake.timer < gameState.gearShiftShake.duration) { const progress = gameState.gearShiftShake.timer / gameState.gearShiftShake.duration; const currentIntensity = gameState.gearShiftShake.intensity * (1 - progress); gameState.shakeX += (Math.random() - 0.5) * 2 * currentIntensity; gameState.shakeY += (Math.random() - 0.5) * 2 * currentIntensity; } else gameState.gearShiftShake.active = false; }
        else if (gameState.collisionShake.active) { gameState.collisionShake.timer += deltaTime; if (gameState.collisionShake.timer < gameState.collisionShake.duration) { const progress = gameState.collisionShake.timer / gameState.collisionShake.duration; const currentIntensity = gameState.collisionShake.intensity * (1 - progress); gameState.shakeX += (Math.random() - 0.5) * 2 * currentIntensity; gameState.shakeY += (Math.random() - 0.5) * 2 * currentIntensity; } else gameState.collisionShake.active = false; }
        else if (gameState.speedKmH > 3) { 
            gameState.shakeTime += 0.08; 
            let intensity = Math.min(gameState.speedKmH / gameState.maxSpeedKmH, 1) * gameState.speedKmH / (gameState.speedKmH / 1.1); 
            if (gameState.isInGrass) intensity *= 6; 
            
            let targetPassingShake = 0; 
            const carLaneOffset = -240; 
            const maxPassingShake = 12; 
            for (const car of activeCars) { 
                const verticalProximity = Math.abs(car.t - 0.95); 
                if (verticalProximity < 0.15) { 
                    const verticalFactor = 9.0 - (verticalProximity / 0.35); 
                    const horizontalProximity = Math.abs(gameState.playerX - carLaneOffset); 
                    const horizontalFactor = Math.max(0, 1.0 - (horizontalProximity / 400)); 
                    targetPassingShake += 13.7 + maxPassingShake * verticalFactor * horizontalFactor; 
                } 
            } 
            gameState.passingShake.currentIntensity += (targetPassingShake - gameState.passingShake.currentIntensity) * gameState.passingShake.smoothingFactor; 
            intensity += gameState.passingShake.currentIntensity; 
            
            if (gameState.isInGrass && gameState.speedKmH > 3) { 
                mapShake.active = true; 
                mapShake.intensity = Math.min(gameState.speedKmH / 10, 2.8); 
                mapShake.time += deltaTime; 
            } else { 
                mapShake.active = false; 
                mapShake.intensity *= 8; 
                if (mapShake.intensity < 0.01) mapShake.intensity = 0.01; 
            } 
            
            gameState.shakeX += Math.sin(gameState.shakeTime * 14) * intensity; 
            gameState.shakeY += Math.cos(gameState.shakeTime * 14) * intensity; 
        }

    } 
}

function drawOilLevelUI() {
    // Warunek, aby UI było widoczne: korek musi być przynajmniej częściowo odkręcony
    if (oilCapState.unscrewProgress > 0) {
        
        // Przygotowanie tekstu do wyświetlenia
        const oilPercentage = Math.round(gameState.oilAmount);
        const text = `POZIOM OLEJU: ${oilPercentage}%`;
        
        // Jeśli silnik jest zatarty, wyświetl dodatkowy komunikat
        const statusText = gameState.engineSeized ? "SILNIK ZATARTY" : "";

        ctx.save();
        
        // Ustawienia czcionki i koloru dla głównego tekstu
        ctx.font = "bold 42px 'VCR OSD Mono'";
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.lineWidth = 5;

        // Pozycja na dole ekranu
        const positionY = canvas.height - 60;

        // Rysowanie z obrysem dla lepszej czytelności
        ctx.strokeText(text, canvas.width / 2, positionY);
        ctx.fillText(text, canvas.width / 2, positionY);
        
        // Rysowanie statusu (jeśli silnik jest zatarty)
        if (statusText) {
            ctx.font = "bold 48px 'VCR OSD Mono'";
            ctx.fillStyle = 'rgba(255, 0, 0, 1)'; // Czerwony kolor dla ostrzeżenia
            ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
            ctx.lineWidth = 6;
            
            const statusY = positionY - 55; // Pozycja nad głównym tekstem
            ctx.strokeText(statusText, canvas.width / 2, statusY);
            ctx.fillText(statusText, canvas.width / 2, statusY);
        }

        ctx.restore();
    }
}

function getCanvasMousePos(clientX, clientY) { const rect = canvas.getBoundingClientRect(); const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height; return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }; }
function isMouseOver(mousePos, element) {
    if (!element) return false;
    return mousePos.x >= element.x && mousePos.x <= element.x + element.width &&
           mousePos.y >= element.y && mousePos.y <= element.y + element.height;
}

function applyCrashVisuals() { if (!gameState.crashState.active) return; const timer = gameState.crashState.effectTimer; const { initialEffectDuration, fadeToBlackDuration, showTextDelay, textFadeInDuration } = gameState.crashState; const totalFadeTime = initialEffectDuration + fadeToBlackDuration; const textStartTime = totalFadeTime + showTextDelay; const tempCanvas = document.createElement('canvas'); tempCanvas.width = canvas.width; tempCanvas.height = canvas.height; const tempCtx = tempCanvas.getContext('2d'); let blurAmount = 0, brightnessAmount = 4; if (timer < initialEffectDuration) { const progress = timer / initialEffectDuration; const effectStrength = 1 - progress; blurAmount = 10 * effectStrength; brightnessAmount = 1 + 5.8 * effectStrength; tempCtx.drawImage(canvas, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save(); ctx.filter = `blur(${blurAmount}px) brightness(${brightnessAmount})`; ctx.drawImage(tempCanvas, 0, 0); ctx.restore(); } else if (timer < totalFadeTime) { const progress = (timer - initialEffectDuration) / fadeToBlackDuration; blurAmount = 15 * progress; brightnessAmount = 1 - progress; tempCtx.drawImage(canvas, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save(); ctx.filter = `blur(${blurAmount}px) brightness(${brightnessAmount})`; ctx.drawImage(tempCanvas, 0, 0); ctx.restore(); } else { ctx.fillStyle = "black"; ctx.fillRect(0, 0, canvas.width, canvas.height); if (timer >= textStartTime) { const fadeInProgress = (timer - textStartTime) / textFadeInDuration; const textAlpha = Math.min(fadeInProgress, 1.0); ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`; ctx.font = "bold 20px 'Times New Roman'"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("You Failed.", canvas.width / 2, canvas.height / 2); } } }

// --- NOWA FUNKCJA DO RYSOWANIA WIDOKU SILNIKA ---
function drawEngineView() {
    // Tło jest zawsze statyczne
    if (assets.engineBack && assets.engineBack.complete) {
        ctx.drawImage(assets.engineBack, 0, 0, canvas.width, canvas.height);
    }

    // Rysowanie animowanego korpusu silnika
    if (assets.engineBody && assets.engineBody.complete) {
        ctx.save();
        // Używamy wartości z obiektu engineViewState
        ctx.globalAlpha = engineViewState.engineAlpha;

        // Przesuwamy punkt (0,0) na środek ekranu, aby skalowanie i obrót były wyśrodkowane
        ctx.translate(
            canvas.width / 2 + engineViewState.shakeOffsetX, // Dodajemy drganie do osi X
            canvas.height / 2
        );
        ctx.scale(engineViewState.engineScale, engineViewState.engineScale);

        // Rysujemy obrazek, centrując go na nowym punkcie (0,0)
        ctx.drawImage(assets.engineBody, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
        ctx.restore();
    }
    
    // Rysowanie dymu (jeśli istnieje)
    if (assets.dust_blue && assets.dust_blue.complete && engineViewState.smokeParticles.length > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter'; 
        for (const p of engineViewState.smokeParticles) {
            ctx.globalAlpha = p.alpha;
            ctx.drawImage(assets.dust_blue, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
        ctx.restore();
    }

    // Celowo usunęliśmy stąd rysowanie korka - teraz zajmuje się tym drawOilCap()
}

// --- GŁÓWNA PĘTLA RENDEROWANIA ---



function getCanvasMousePos(clientX, clientY) { const rect = canvas.getBoundingClientRect(); const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height; return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }; }
function isMouseOver(mousePos, element) {
    if (!element) return false;
    return mousePos.x >= element.x && mousePos.x <= element.x + element.width &&
           mousePos.y >= element.y && mousePos.y <= element.y + element.height;
}

function applyCrashVisuals() { if (!gameState.crashState.active) return; const timer = gameState.crashState.effectTimer; const { initialEffectDuration, fadeToBlackDuration, showTextDelay, textFadeInDuration } = gameState.crashState; const totalFadeTime = initialEffectDuration + fadeToBlackDuration; const textStartTime = totalFadeTime + showTextDelay; const tempCanvas = document.createElement('canvas'); tempCanvas.width = canvas.width; tempCanvas.height = canvas.height; const tempCtx = tempCanvas.getContext('2d'); let blurAmount = 0, brightnessAmount = 1; if (timer < initialEffectDuration) { const progress = timer / initialEffectDuration; const effectStrength = 1 - progress; blurAmount = 10 * effectStrength; brightnessAmount = 1 + 5.8 * effectStrength; tempCtx.drawImage(canvas, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save(); ctx.filter = `blur(${blurAmount}px) brightness(${brightnessAmount})`; ctx.drawImage(tempCanvas, 0, 0); ctx.restore(); } else if (timer < totalFadeTime) { const progress = (timer - initialEffectDuration) / fadeToBlackDuration; blurAmount = 15 * progress; brightnessAmount = 1 - progress; tempCtx.drawImage(canvas, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save(); ctx.filter = `blur(${blurAmount}px) brightness(${brightnessAmount})`; ctx.drawImage(tempCanvas, 0, 0); ctx.restore(); } else { ctx.fillStyle = "black"; ctx.fillRect(0, 0, canvas.width, canvas.height); if (timer >= textStartTime) { const fadeInProgress = (timer - textStartTime) / textFadeInDuration; const textAlpha = Math.min(fadeInProgress, 1.0); ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`; ctx.font = "bold 20px 'Times New Roman'"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("You Failed.", canvas.width / 2, canvas.height / 2); } } }

/**
 * GŁÓWNA, ZUNIFIKOWANA PĘTLA RENDEROWANIA
 * Ta funkcja zastępuje obie poprzednie wersje.
 * Zawiera logikę do przełączania widoków (cockpit/engine) oraz
 * poprawne zarządzanie pauzą i efektami.
 */
/**
 * GŁÓWNA, ZUNIFIKOWANA PĘTLA RENDEROWANIA - POPRAWIONA WERSJA
 */
/**
 * GŁÓWNA, ZUNIFIKOWANA PĘTLA RENDEROWANIA - POPRAWIONA WERSJA
 * Naprawiono problem z renderowaniem dymu na kokpicie poprzez zmianę kolejności rysowania.
 */
function render(timestamp) {
    // Ustawienie stałego deltaTime dla spójności animacji
    window.deltaTime = 1 / 60;

    // --- SEKCJA 1: AKTUALIZACJE STANÓW GRY ---

    // Aktualizacje globalne (zawsze, nawet przy pauzie)
    updateVhsMenu(deltaTime);
    updateRotaryMenu(deltaTime);
    updateViewTransition(deltaTime);
updateBlinkEffect(deltaTime); // <--- DODAJ TĘ LINIĘ TUTAJ
    RetroShaderWebGL.time += deltaTime;
    updateVhsDynamics(deltaTime, RetroShaderWebGL.time);
    manageGameSounds();

    // Główna logika gry (tylko, gdy nie ma pauzy)
    if (!isGamePaused) {
        updateStanUpojenia(deltaTime); 
        updateGameState(deltaTime);
        updateHeldOil(deltaTime);
        updateHeldWheel(deltaTime);
        updateHeldBeer(deltaTime);
        updateOilDrops(deltaTime);
        managePouringSound();

        // Logika specyficzna dla aktualnego widoku
        if (currentView === 'cockpit') {
            updateOverlaySway(deltaTime);
        }
        if (currentView === 'engine') {
            updateOilCap(deltaTime);
            updateEngineView(deltaTime);
            updateControls(deltaTime);
        }
        if (currentView === 'trunk') {
            updateTrunkOil(deltaTime);
            updateTrunkWheel(deltaTime);
            updateTrunkBeer(deltaTime);
            updateControls(deltaTime);
        }
    }

    // --- SEKCJA 2: RYSOWANIE GŁÓWNEJ SCENY ---

    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Rysowanie w zależności od widoku
    if (currentView === 'cockpit') {
        ctx.save();
        ctx.translate(gameState.shakeX, gameState.shakeY);
        
        // Rysowanie świata (elementy za szybą)
        drawSky();
        drawBirds();
        drawBackForests();
        drawField3D();
        drawRoad();
        drawPoles();
        drawBackgroundTrees();
        drawFields();
        drawForests();
        drawBuildings();
        drawTrees();
        drawGround();
        drawSecondGrass();
        drawPickets();
        drawLanterns();
        drawSigns();
        drawGrass();
        updateAndDrawCarDust(deltaTime); // Dym z innych aut

drawTurnSignals();
        if (gameState.playerX < 0) {
            drawSlowOpponents();
            drawEnemyCars();
        } else {
            drawEnemyCars();
            drawSlowOpponents();
        }
        
        drawGrassEffects();
        
        // ==========================================================
        // === PRZENIESIONO TUTAJ ===
        // Dym z przegrzanego silnika jest teraz rysowany jako część świata,
        // zanim zostanie nałożony na niego kokpit.
        if (gameState.isOverheating && gameState.speedKmH <= 0) {
            drawDustEffect();
        }
        // ==========================================================

        // Rysowanie kokpitu (elementy wewnątrz auta)
        drawWindowGlass();
        drawCockpit();
        drawHanger();
        drawShifter();
        drawLevers();
        drawSteeringWheel();
        
        ctx.restore();

        // Efekty post-processingu dla sceny w kokpicie
        applyMotionBlur(ctx, gameState.speedKmH, gameState.maxSpeedKmH);

        // Rysowanie widoku w lusterku (po motion blurze)
        {
            const sourceWidth = 128;
            const sourceHeight = 90;
            const sourceX = (canvas.width / 3 - sourceWidth / 1 - 320) + handleMirrorState.sourceOffsetX;
            const sourceY = (canvas.height * 0.324) + handleMirrorState.sourceOffsetY;
            if (detailCanvas.width !== sourceWidth) detailCanvas.width = sourceWidth;
            if (detailCanvas.height !== sourceHeight) detailCanvas.height = sourceHeight;
            detailCtx.drawImage(canvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
            detailCtx.save();
            detailCtx.scale(-1, 1);
            detailCtx.drawImage(detailCanvas, -detailCanvas.width, 0);
            detailCtx.restore();
        }
        
        // === USUNIĘTO STĄD ===
        // if (gameState.isOverheating && gameState.speedKmH <= 0) drawDustEffect();

        // Rysowanie UI na desce rozdzielczej i nakładek w kokpicie
        drawArmClock();
        drawNewCounter();
        if (mapVisible || photoVisible || carSignVisible || docOverlayVisible) {
            applyBlurEffect();
        }
        drawMap();
        drawPhoto();
        drawCarSign();
        drawDocOverlay();

    } else if (currentView === 'engine') {
        drawEngineView();
        drawOilCap();
        drawOilLevelUI();
        drawTurnSignals(); // <--- ZMIANA TUTAJ

    } else if (currentView === 'trunk') {
        if (assets.trunk && assets.trunk.complete) {
            ctx.drawImage(assets.trunk, 0, 0, canvas.width, canvas.height);
        }
        drawTrunkOil();
        drawTrunkWheel();
        drawTrunkBeer();
        drawTurnSignals(); // <--- ZMIANA TUTAJ
    }
    
    // Rysowanie trzymanych obiektów (są częścią sceny)
    drawHeldOil();
    drawHeldWheel();
    drawHeldBeer();
    drawOilDrops();

    // --- SEKCJA 3: APLIKOWANIE EFEKTU "PIJAŃSTWA" (POST-PROCESSING) ---
    if (stanUpojenia.liczbaWypitychPiw > 0) {
        // 3a. Skopiuj gotową, narysowaną scenę z gameCanvas do bufora
        if (drunkenBlurCanvas.width !== canvas.width) drunkenBlurCanvas.width = canvas.width;
        if (drunkenBlurCanvas.height !== canvas.height) drunkenBlurCanvas.height = canvas.height;
        drunkenBlurCtx.clearRect(0, 0, drunkenBlurCanvas.width, drunkenBlurCanvas.height);
        drunkenBlurCtx.drawImage(canvas, 0, 0);

        // 3b. Wyczyść główny canvas, aby narysować na nim scenę z efektem od nowa
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 3c. Zastosuj główną transformację (zoom i bujanie) do obrazu z bufora
        ctx.save();
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        ctx.translate(centerX, centerY);
        ctx.scale(stanUpojenia.aktualnyZoom, stanUpojenia.aktualnyZoom);
        ctx.rotate(stanUpojenia.aktualnyKatBujania);
        ctx.translate(-centerX, -centerY);
        
        // Narysuj scenę z bufora z powyższą transformacją - to jest główny, ostry obraz
        ctx.drawImage(drunkenBlurCanvas, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        // 3d. Narysuj dodatkową warstwę "ducha" (ghosting/podwójne widzenie)
        const ghostX = stanUpojenia.blurOffsetRadius * Math.cos(stanUpojenia.blurRotationAngle);
        const ghostY = stanUpojenia.blurOffsetRadius * Math.sin(stanUpojenia.blurRotationAngle);
        
        ctx.save();
        ctx.globalAlpha = stanUpojenia.blurAlpha;
        
        const scale = 1.02; 
        const newWidth = canvas.width * scale;
        const newHeight = canvas.height * scale;
        const newX = (canvas.width - newWidth) / 2 + ghostX;
        const newY = (canvas.height - newHeight) / 2 + ghostY;
        
        // Rysujemy "ducha" z bufora
        ctx.drawImage(drunkenBlurCanvas, newX, newY, newWidth, newHeight);
        ctx.restore();
    }

    // --- SEKCJA 4: RYSOWANIE GLOBALNYCH NAKŁADEK I MENU ---
    // (Te elementy są zawsze na wierzchu i nie podlegają efektom ze sceny)
    drawBlinkEffect();
    applyCrashVisuals();
    drawRotaryMenu();
    drawViewTransition();

    // Logika shadera i menu VHS (finalny post-processing)
    const isMenuOnScreen = vhsMenuState.transitionProgress > 0;
    if (vhsMenuState.isVcrEffectOn || isMenuOnScreen) {
        if (shaderCanvas.style.display !== 'block') {
            shaderCanvas.style.display = 'block';
        }
        drawVhsMenu();
        RetroShaderWebGL.apply(ctx, gl);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else {
        if (shaderCanvas.style.display !== 'none') {
            shaderCanvas.style.display = 'none';
        }
        if (isMenuOnScreen) {
            drawVhsMenu();
        }
    }

    // Poproś o następną klatkę animacji
    requestAnimationFrame(render);
}

function drawTurnSignals() {
    // 1. Warunek główny: nie rób nic, jeśli żaden kierunkowskaz nie jest aktywny,
    //    nie nadszedł czas na mignięcie (blinkerVisible), lub grafika nie jest załadowana.
    const anyBlinkerOn = controlsState.hazardOn || controlsState.leftBlinkerOn || controlsState.rightBlinkerOn;
    if (!anyBlinkerOn || !controlsState.blinkerVisible || !assets.blinker || !assets.blinker.complete) {
        return;
    }

    // 2. Pobieramy potrzebne stany, aby kod był czytelniejszy.
    const { hazardOn, leftBlinkerOn, rightBlinkerOn } = controlsState;
    const blinkerWidth = 400;
    const blinkerHeight = 400;

    ctx.save();
    ctx.globalAlpha = 0.85;

    // Definiujemy współrzędne dla obu stron w zależności od widoku
    let leftX, rightX, commonY;

    if (currentView === 'cockpit') {
        // Pozycje dla kokpitu pozostają bez zmian
        leftX = 450;
        rightX = 1270;
        commonY = 580;
    } else if (currentView === 'trunk' || currentView === 'engine') {
        // --- TUTAJ ZNAJDUJĄ SIĘ ZMIANY ---
        // Używamy wartości ujemnych i większych niż ekran, aby "wypchnąć" obrazki w rogi.
        // Dostosuj te wartości (-150, 250), jeśli chcesz je przesunąć jeszcze bardziej lub mniej.
        
        leftX = -120; // <--- ZMIANA: Mniejsza wartość X przesuwa obrazek w lewo (poza ekran)
        rightX = canvas.width - 190; // <--- ZMIANA: (Szerokość - widoczna część) przesuwa w prawo
        commonY = canvas.height - 190; // <--- ZMIANA: (Wysokość - widoczna część) przesuwa w dół
        
    } else {
        // Jeśli jest jakiś inny, nieobsługiwany widok, nic nie rysuj
        ctx.restore();
        return;
    }

    // 3. Sprawdzamy, czy lewy kierunkowskaz powinien migać.
    if (hazardOn || leftBlinkerOn) {
        ctx.drawImage(assets.blinker, leftX, commonY, blinkerWidth, blinkerHeight);
    }

    // 4. Sprawdzamy, czy prawy kierunkowskaz powinien migać.
    if (hazardOn || rightBlinkerOn) {
        ctx.drawImage(assets.blinker, rightX, commonY, blinkerWidth, blinkerHeight);
    }

    ctx.restore();
}

window.addEventListener('load', () => { initCanvas(); createMapButton(); createPhotoButton(); createCarSignButton(); updateButtonPositions(); });
window.addEventListener('resize', updateButtonPositions);

canvas.addEventListener('mousedown', (e) => {
    const mousePos = getCanvasMousePos(e.clientX, e.clientY);

    // --- LOGIKA DLA WIDOKU BAGAŻNIKA (trunk) ---
    if (currentView === 'trunk') {
        
        // 1. LOGIKA PODNIESIENIA PIWA
        if (isMouseOver(mousePos, trunkBeerState) && !heldOilState.isHeld && !heldWheelState.isHeld && !heldBeerState.isHeld) {
            
            if (audio.unlocked && audio.openingbeer) {
                audio.openingbeer.currentTime = 0;
                audio.openingbeer.volume = 0.8;
                audio.openingbeer.play().catch(e => console.warn("Nie udało się odtworzyć openingbeer.mp3", e));
            }

            heldBeerState.isHeld = true;
            heldBeerState.lastMouseX = mousePos.x;
            heldBeerState.x = mousePos.x;
            heldBeerState.y = mousePos.y;
            
            heldBeerState.isDrinking = false;
            heldBeerState.fadeProgress = 0.0;

            if (audio.unlocked && audio.press) {
                audio.press.currentTime = 0;
                audio.press.volume = 0.5;
                audio.press.play().catch(() => {});
            }
            return; 
        }

        // 2. LOGIKA PODNIESIENIA KOŁA
        if (isMouseOver(mousePos, trunkWheelState) && trunkWheelState.isVisible && !heldOilState.isHeld && !heldWheelState.isHeld && !heldBeerState.isHeld) {
            heldWheelState.isHeld = true;
            heldWheelState.lastMouseX = mousePos.x;
            heldWheelState.x = mousePos.x;
            heldWheelState.y = mousePos.y;
            trunkWheelState.isVisible = false;
            if (audio.unlocked && audio.press) {
                audio.press.currentTime = 0;
                audio.press.volume = 0.5;
                audio.press.play().catch(() => {});
            }
            return;
        }

        // 3. LOGIKA PODNIESIENIA OLEJU
        if (isMouseOver(mousePos, trunkOilState) && trunkOilState.isVisible && !heldOilState.isHeld && !heldWheelState.isHeld && !heldBeerState.isHeld) {
            heldOilState.isHeld = true;
            heldOilState.lastMouseX = mousePos.x;
            heldOilState.x = mousePos.x;
            heldOilState.y = mousePos.y;
            trunkOilState.isVisible = false;
            if (audio.unlocked && audio.press) {
                audio.press.currentTime = 0;
                audio.press.volume = 0.5;
                audio.press.play().catch(() => {});
            }
            return;
        }
    }

    // --- Reszta logiki dla mousedown pozostaje bez zmian ---

    if (mapVisible) {
        const mapWidth = canvas.width * 0.723 * mapScale;
        const mapHeight = canvas.height * 1.515 * mapScale;
        const mapX = (canvas.width - mapWidth) / 2 + mapOffsetX;
        const mapY = (canvas.height - mapHeight) / 2 + mapOffsetY;
        if (mousePos.x >= mapX && mousePos.x <= mapX + mapWidth && mousePos.y >= mapY && mousePos.y <= mapY + mapHeight) {
            isOverlayDragging = true;
            mapAccordionState.isHeld = true;
            lastOverlayDragX = mousePos.x;
            lastOverlayDragY = mousePos.y;
            canvas.style.cursor = 'grabbing';
            return;
        }
    }

    if (isMouseOver(mousePos, radioState.rewindButton)) {
        if (!radioState.isRewinding) {
            radioState.isRewinding = true;
            radioState.rewindIntervalId = setInterval(() => {
                if (audio.radio) {
                    audio.radio.currentTime += 16;
                }
            }, 250);
        }
        return;
    }

    const docRect = {
        x: docState.baseX + docState.offsetX,
        y: docState.baseY + docState.offsetY,
        width: docState.width * docState.scale,
        height: docState.height * docState.scale
    };
    if (isMouseOver(mousePos, docRect) && !mapVisible && !photoVisible && !carSignVisible && !docOverlayVisible) {
        docState.isDragging = true;
        docState.dragStartMouseX = mousePos.x;
        docState.dragStartMouseY = mousePos.y;
        docState.dragStartOffsetX = docState.offsetX;
        docState.dragStartOffsetY = docState.offsetY;
        docState.angleVelocity = 0;
        docState.dragLastMouseX = mousePos.x;
        canvas.style.cursor = 'grabbing';
        return;
    }

    if (photoVisible) {
        const photoAspectRatio = assets.photo.naturalWidth / assets.photo.naturalHeight;
        let photoHeight = canvas.height * 0.8 * photoScale;
        let photoWidth = photoHeight * photoAspectRatio;
        const photoX = (canvas.width - photoWidth) / 2 + photoOffsetX;
        const photoY = (canvas.height - photoHeight) / 2 + photoOffsetY;
        if (mousePos.x >= photoX && mousePos.x <= photoX + photoWidth && mousePos.y >= photoY && mousePos.y <= photoY + photoHeight) {
            isOverlayDragging = true;
            lastOverlayDragX = mousePos.x;
            lastOverlayDragY = mousePos.y;
            canvas.style.cursor = 'grabbing';
            return;
        }
    } else if (carSignVisible) {
        const signAspectRatio = assets.carSign.naturalWidth / assets.carSign.naturalHeight;
        let signHeight = canvas.height * 0.7 * carSignScale;
        let signWidth = signHeight * signAspectRatio;
        const signX = (canvas.width - signWidth) / 2 + carSignOffsetX;
        const signY = (canvas.height - signHeight) / 2 + carSignOffsetY;
        if (mousePos.x >= signX && mousePos.x <= signX + signWidth && mousePos.y >= signY && mousePos.y <= signHeight) {
            isOverlayDragging = true;
            lastOverlayDragX = mousePos.x;
            lastOverlayDragY = mousePos.y;
            canvas.style.cursor = 'grabbing';
            return;
        }
    } else if (docOverlayVisible) {
        const currentImage = docOverlayImages.images[docOverlayImages.current];
        if (currentImage && currentImage.complete) {
            const aspectRatio = currentImage.naturalWidth / currentImage.naturalHeight;
            let docHeight = canvas.height * 0.9 * docOverlayScale;
            let docWidth = docHeight * aspectRatio;
            const docX = (canvas.width - docWidth) / 2 + docOverlayOffsetX;
            const docY = (canvas.height - docHeight) / 2 + docOffsetY;
            if (mousePos.x >= docX && mousePos.x <= docX + docWidth && mousePos.y >= docY && mousePos.y <= docY + docHeight) {
                isOverlayDragging = true;
                lastOverlayDragX = mousePos.x;
                lastOverlayDragY = mousePos.y;
                canvas.style.cursor = 'grabbing';
                return;
            }
        }
    }
    
    const hangScreenX = hangerState.anchorX + Math.sin(hangerState.angle)*-1 * hangerState.length ; const hangScreenY = hangerState.anchorY + Math.cos(hangerState.angle) * hangerState.length; const dist = Math.sqrt(Math.pow(mousePos.x - hangScreenX, 2) + Math.pow(mousePos.y - hangScreenY, 2)); if (dist < 60) { hangerState.isDragging = true; hangerState.velocity = 0; hangerState.lastMouseX = mousePos.x; canvas.style.cursor = 'grabbing'; }
});

let mapSwayAngle = 0.1; let mapSwayVelocity = 0.1; const mapSwayStiffness = 0.05; const mapSwayDamping = 0.45; const maxSwayAngle = 2.5;     

canvas.addEventListener('mousemove', (e) => {
    const mousePos = getCanvasMousePos(e.clientX, e.clientY);
    
    // --- Logika dla trzymanej butelki oleju ---
    if (heldOilState.isHeld) {
        const deltaX = mousePos.x - heldOilState.lastMouseX;
        heldOilState.x = mousePos.x;
        heldOilState.y = mousePos.y;
        const flick = deltaX * heldOilState.flickFactor;
        heldOilState.angleVelocity += flick;
        heldOilState.lastMouseX = mousePos.x;

        const TILT_THRESHOLD = 0.8;
        if (Math.abs(heldOilState.angle) > TILT_THRESHOLD) {
             const movementStrength = Math.abs(deltaX);
             const dropsToSpawn = Math.floor(movementStrength / 6);
             for (let i = 0; i < dropsToSpawn; i++) {
                 const spoutOffsetX = (heldOilState.width / 2) - 80;
                 const spoutOffsetY = (-heldOilState.height / 2) + 20;
                 const rotatedSpoutX = heldOilState.x + (spoutOffsetX * Math.cos(heldOilState.angle) - spoutOffsetY * Math.sin(heldOilState.angle));
                 const rotatedSpoutY = heldOilState.y + (spoutOffsetX * Math.sin(heldOilState.angle) + spoutOffsetY * Math.cos(heldOilState.angle));
                 oilDrops.push({ x: rotatedSpoutX, y: rotatedSpoutY, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 14, initialSize: 8 + Math.random() * 16, currentSize: 0, alpha: 1.0, lifetime: 0, maxLifetime: 0.8 + Math.random() * 4.0 });
             }
        }
        const STREAM_ANGLE_THRESHOLD = 45 * (Math.PI / 180);
        if (Math.abs(heldOilState.angle) > STREAM_ANGLE_THRESHOLD) {
             const dropsPerFrame = 4;
             for (let i = 0; i < dropsPerFrame; i++) {
                 const spoutOffsetX = (heldOilState.width / 2) - 80;
                 const spoutOffsetY = (-heldOilState.height / 2) + 18;
                 const rotatedSpoutX = heldOilState.x + (spoutOffsetX * Math.cos(heldOilState.angle) - spoutOffsetY * Math.sin(heldOilState.angle));
                 const rotatedSpoutY = heldOilState.y + (spoutOffsetX * Math.sin(heldOilState.angle) + spoutOffsetY * Math.cos(heldOilState.angle));
                 oilDrops.push({ x: rotatedSpoutX + (Math.random() - 0.5) * 4, y: rotatedSpoutY, vx: (Math.random() - 0.5) * 0.3, vy: 4 + Math.random() * 4, initialSize: 12 + Math.random() * 6, currentSize: 0, alpha: 1.0, lifetime: 0, maxLifetime: 1.5 + Math.random() * 3.0 });
             }
        }
    }

    // --- Logika dla trzymanego koła ---
    if (heldWheelState.isHeld) {
        const deltaX = mousePos.x - heldWheelState.lastMouseX;
        heldWheelState.x = mousePos.x;
        heldWheelState.y = mousePos.y;
        const flick = deltaX * heldWheelState.flickFactor;
        heldWheelState.angleVelocity += flick;
        heldWheelState.lastMouseX = mousePos.x;
    }

    if (heldBeerState.isHeld) {
        // Fizyka bujania przy ruchu myszką (identyczna jak dla oleju)
        const deltaX = mousePos.x - heldBeerState.lastMouseX;
        heldBeerState.x = mousePos.x;
        heldBeerState.y = mousePos.y;
        const flick = deltaX * heldBeerState.flickFactor;
        heldBeerState.angleVelocity += flick;
        heldBeerState.lastMouseX = mousePos.x;

        // Logika wylewania - skopiowana z oleju, ale używa stanu piwa i obrazka oildrop.png
        const STREAM_ANGLE_THRESHOLD = 40 * (Math.PI / 180); // Kąt wylewania (45 stopni)
        if (Math.abs(heldBeerState.angle) > STREAM_ANGLE_THRESHOLD) {
             const dropsPerFrame = 3; // Ile kropelek na klatkę
             for (let i = 0; i < dropsPerFrame; i++) {
                 // Obliczamy pozycję "wylotu" butelki
                 const spoutOffsetX = 0; // środek
                 const spoutOffsetY = (-heldBeerState.height / 2) - 5; // czubek butelki
                 const rotatedSpoutX = heldBeerState.x + (spoutOffsetX * Math.cos(heldBeerState.angle) - spoutOffsetY * Math.sin(heldBeerState.angle));
                 const rotatedSpoutY = heldBeerState.y + (spoutOffsetX * Math.sin(heldBeerState.angle) + spoutOffsetY * Math.cos(heldBeerState.angle));
                 
                 // Tworzymy nową kropelkę (używamy tej samej tablicy co olej)
                 oilDrops.push({ 
                     x: rotatedSpoutX + (Math.random() - 0.5) * 4, 
                     y: rotatedSpoutY + (Math.random() - 0.5) * 24,  
                     vx: (Math.random() - 0.5) * 6.3, 
                     vy: 4 + Math.random() * 4, 
                     initialSize: 12 + Math.random() * 6, 
                     currentSize: 0, 
                     alpha: 1.0, 
                     lifetime: 0, 
                     maxLifetime: 1.5 + Math.random() * 0.2 
                 });
             }
        }
    }
    
    // --- Logika dla przeciągania dokumentu (w kokpicie) ---
    if (docState.isDragging) {
        const deltaX = mousePos.x - docState.dragStartMouseX;
        const deltaY = mousePos.y - docState.dragStartMouseY;
        const potentialNewOffsetX = docState.dragStartOffsetX + deltaX;
        const isWindowBlocked = windowState.glassYOffset < windowState.glassMaxDownOffset / 2;
        const leftBoundary = -docState.baseX;
        if (isWindowBlocked && potentialNewOffsetX < leftBoundary) {
            docState.offsetX = leftBoundary;
            if (!docState.justHitBoundary && audio.unlocked && audio.glassboom) {
                audio.glassboom.currentTime = 0;
                audio.glassboom.volume = 0.7; 
                audio.glassboom.play().catch(err => console.warn("Nie udało się odtworzyć dźwięku glassboom:", err));
                docState.justHitBoundary = true; 
            }
        } else {
            docState.offsetX = potentialNewOffsetX;
            docState.justHitBoundary = false;
        }
        docState.offsetY = docState.dragStartOffsetY + deltaY;
        const mouseMoveDeltaX = mousePos.x - docState.dragLastMouseX;
        docState.angle = mouseMoveDeltaX * docState.dragAngleFactor;
        docState.dragLastMouseX = mousePos.x;
    }
    
    // --- Logika dla zmiany kursora i najechania (hover) ---
    if (!isOverlayDragging && !hangerState.isDragging && !docState.isDragging) {
        if (currentView === 'cockpit') {
            const wheelX = canvas.width / 2 - 140; const wheelY = canvas.height / 2 + 260; const wheelSize = 150; const distToHorn = Math.sqrt(Math.pow(mousePos.x - wheelX, 2) + Math.pow(mousePos.y - wheelY, 2));
            const hangScreenX = hangerState.anchorX + Math.sin(hangerState.angle) * -1 * hangerState.length; const hangScreenY = hangerState.anchorY + Math.cos(hangerState.angle) * hangerState.length; const distToHanger = Math.sqrt(Math.pow(mousePos.x - hangScreenX, 2) + Math.pow(mousePos.y - hangScreenY, 2));
            const docRect = { x: docState.baseX + docState.offsetX, y: docState.baseY + docState.offsetY, width: docState.width * docState.scale, height: docState.height * docState.scale };
            const isOverDoc = isMouseOver(mousePos, docRect) && !mapVisible && !photoVisible && !carSignVisible && !docOverlayVisible;
            if ( isMouseOver(mousePos, mirrorState.position) || isMouseOver(mousePos, handleMirrorState.position) || isMouseOver(mousePos, windowState.buttonPosition) || isOverDoc || distToHorn <= wheelSize / 2 || isMouseOver(mousePos, radioState.volumeButton) || isMouseOver(mousePos, radioState.rewindButton) || distToHanger < 60 ) {
                canvas.style.cursor = 'pointer';
            } else {
                canvas.style.cursor = ''; 
            }
        } 
        // =================================================================
        // === POPRAWIONY BLOK DO WKLEJENIA ZACZYNA SIĘ TUTAJ ===
        // =================================================================
        else if (currentView === 'trunk') {
            // Zdefiniuj prostokąty kolizji dla wszystkich obiektów
            const oilRect = { x: trunkOilState.x, y: trunkOilState.y, width: trunkOilState.width, height: trunkOilState.height };
            const wheelRect = { x: trunkWheelState.x, y: trunkWheelState.y, width: trunkWheelState.width, height: trunkWheelState.height };
            // NOWY KOD
            const beerRect = { x: trunkBeerState.x, y: trunkBeerState.y, width: trunkBeerState.width, height: trunkBeerState.height };
            // KONIEC NOWEGO KODU

            // Sprawdź, czy mysz jest nad którymkolwiek z obiektów
            const isOverOil = isMouseOver(mousePos, oilRect);
            const isOverWheel = isMouseOver(mousePos, wheelRect);
            // NOWY KOD
            const isOverBeer = isMouseOver(mousePos, beerRect);
            // KONIEC NOWEGO KODU

            // Ustaw flagi `isHovered` dla odpowiednich obiektów
            trunkOilState.isHovered = isOverOil;
            trunkWheelState.isHovered = isOverWheel;
            // NOWY KOD
            trunkBeerState.isHovered = isOverBeer;
            // KONIEC NOWEGO KODU

            // Zmień kursor, jeśli mysz jest nad którymkolwiek z interaktywnych obiektów
            // MODYFIKACJA
            if (isOverOil || isOverWheel || isOverBeer) {
                canvas.style.cursor = 'pointer';
            } else {
                canvas.style.cursor = '';
            }
        }
    }

    // --- Logika przeciągania nakładek (mapa itp.) ---
    if (isOverlayDragging) { const deltaX = mousePos.x - lastOverlayDragX ; const deltaY = mousePos.y - lastOverlayDragY; if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) { if (audio.unlocked && audio.mapMove.paused) { audio.mapMove.currentTime = 0; audio.mapMove.volume = 0.4; audio.mapMove.play().catch(() => {}); } } 
    if (mapVisible) { mapOffsetX += deltaX; mapOffsetY += deltaY; } 
    else if (photoVisible) { photoOffsetX += deltaX; photoOffsetY += deltaY; } 
    else if (carSignVisible) { carSignOffsetX += deltaX; carSignOffsetY += deltaY; } 
    else if (docOverlayVisible) { docOverlayOffsetX += deltaX; docOffsetY += deltaY; }
    
    const dragSpeed = Math.sqrt(deltaX * deltaX + deltaY * deltaY); mapSwayVelocity += deltaX * 0.5 * Math.min(dragSpeed / 30, 0.1); mapSwayVelocity = Math.max(-1.1, Math.min(1.1, mapSwayVelocity)); lastOverlayDragX = mousePos.x; lastOverlayDragY = mousePos.y; }
    
    // --- Logika przeciągania wieszaka ---
    if (hangerState.isDragging) { const dx = mousePos.x - hangerState.anchorX; const dy = mousePos.y - hangerState.anchorY; hangerState.angle = Math.atan2(dx, dy) *-1; const flickSpeed = (mousePos.x - hangerState.lastMouseX) * 0.0015; hangerState.velocity = flickSpeed ; hangerState.lastMouseX = mousePos.x; }
});

canvas.addEventListener('mouseup', () => { 
    mapAccordionState.isHeld = false; // Mapa została puszczona
    if (radioState.isRewinding) {
        radioState.isRewinding = false;
        clearInterval(radioState.rewindIntervalId);
        radioState.rewindIntervalId = null;
    }

    if (docState.isDragging) {
        docState.isDragging = false;
        canvas.style.cursor = '';

        const dragDistance = Math.sqrt(
            Math.pow(docState.offsetX - docState.dragStartOffsetX, 2) +
            Math.pow(docState.offsetY - docState.dragStartOffsetY, 2)
        );

        if (dragDistance < 5) {
            docState.offsetX = docState.dragStartOffsetX;
            docState.offsetY = docState.dragStartOffsetY;
            toggleDocOverlay();
        }
    }


    if (isOverlayDragging) { isOverlayDragging = false; canvas.style.cursor = ''; } 
    if (hangerState.isDragging) { hangerState.isDragging = false; canvas.style.cursor = ''; } 
});

canvas.addEventListener('mouseleave', () => { 
    
    if (radioState.isRewinding) {
        radioState.isRewinding = false;
        clearInterval(radioState.rewindIntervalId);
        radioState.rewindIntervalId = null;
    }
    
    if (docState.isDragging) {
        docState.isDragging = false;
        canvas.style.cursor = '';
    }

    if (isOverlayDragging) { isOverlayDragging = false; canvas.style.cursor = ''; } 
    if (hangerState.isDragging) { hangerState.isDragging = false; canvas.style.cursor = ''; } 
});

// Listener na NACIŚNIĘCIE klawisza (to jest jedyny poprawny)
// --- ZASTĄP STARE LISTENERY TYMI NOWYMI ---

// Listener na NACIŚNIĘCIE klawisza

// Listener na NACIŚNIĘCIE klawisza
// =======================================================================
// === SKOPIUJ I ZASTĄP CAŁY BLOK EVENT LISTENERÓW PONIŻEJ ===
// =======================================================================

// Listener na NACIŚNIĘCIE klawisza
window.addEventListener("keydown", (e) => {
    // --- NOWY KOD: Obsługa odłożenia oleju LUB KOŁA LUB PIWA klawiszem ESC ---
    if (e.key.toLowerCase() === 'escape') {
        if (heldOilState.isHeld) {
            e.preventDefault();
            heldOilState.isHeld = false;
            trunkOilState.isVisible = true;
            return;
        }
        if (heldWheelState.isHeld) {
            e.preventDefault();
            heldWheelState.isHeld = false;
            trunkWheelState.isVisible = true;
            return;
        }
        // NOWY KOD
        if (heldBeerState.isHeld) {
            e.preventDefault();
            heldBeerState.isHeld = false;
            // Nie musimy zmieniać widoczności trunkBeerState, bo jest zawsze widoczne.
            return;
        }
    }
    // --- Globalna obsługa menu (działa zawsze, niezależnie od widoku) ---
    if (vhsMenuState.isOpen) {
        e.preventDefault(); 
        if (e.repeat) return;
        const handleMenuAction = (direction) => {
            const selectedOption = vhsMenuState.options[vhsMenuState.selectedOptionIndex];
            const isOptionDisabled = !vhsMenuState.isVcrEffectOn && (vhsMenuState.selectedOptionIndex >= 2);
            if (selectedOption && typeof selectedOption.action === 'function' && !isOptionDisabled) {
                playMenuNavigateSound();
                selectedOption.action(vhsMenuState, direction);
            }
        };
        switch (e.key.toLowerCase()) {
            case 'w': case 'arrowup': playMenuNavigateSound(); vhsMenuState.selectedOptionIndex = (vhsMenuState.selectedOptionIndex - 1 + vhsMenuState.options.length) % vhsMenuState.options.length; break;
            case 's': case 'arrowdown': playMenuNavigateSound(); vhsMenuState.selectedOptionIndex = (vhsMenuState.selectedOptionIndex + 1) % vhsMenuState.options.length; break;
            case 'a': case 'arrowleft': handleMenuAction(-1); break;
            case 'd': case 'arrowright': handleMenuAction(1); break;
            case 'enter': const selectedOption = vhsMenuState.options[vhsMenuState.selectedOptionIndex]; if(selectedOption.type === "toggle") handleMenuAction(1); break;
            case '`': case 'escape': toggleVhsMenu(); break;
        }
        return; // Zakończ, bo jesteśmy w menu
    }
    
    // Obsługa menu obrotowego (też działa globalnie, gdy jest aktywne)
    if (rotaryMenuState.isActive) {
        if (e.key.toLowerCase() === 'arrowleft' || e.key.toLowerCase() === 'a') { e.preventDefault(); if (!rotaryMenuState.isRotating) startRotaryMenuRotation(1); }
        else if (e.key.toLowerCase() === 'arrowright' || e.key.toLowerCase() === 'd') { e.preventDefault(); if (!rotaryMenuState.isRotating) startRotaryMenuRotation(-1); }
        if (['arrowleft', 'a', 'arrowright', 'd', 'f'].includes(e.key.toLowerCase())) return;
    }

    if (e.key === '`') { e.preventDefault(); toggleVhsMenu(); return; }
    if (e.key.toLowerCase() === 'f' && !e.repeat) {
        if (!isGamePaused && gameState.speedKmH < 1) { e.preventDefault(); rotaryMenuState.isActive = true; return; }
    }

    // Obsługa nakładek (mapa, dokument)
    if (mapVisible || docOverlayVisible) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            if (e.repeat) return;
            e.preventDefault();
            
            // --- POPRAWKA: Dźwięk tylko w kokpicie ---
            if (currentView !== 'cockpit') return;
            
            if (mapVisible) mapImages.current = (mapImages.current + 1) % 2;
            if (docOverlayVisible) docOverlayImages.current = (docOverlayImages.current + 1) % docOverlayImages.images.length;
            mapSwayAngle = -0.06;
            if (audio.unlocked) { audio.map.currentTime = 0; audio.map.volume = 0.5; audio.map.play().catch(() => {}); }
            return;
        }
    }

    // --- GŁÓWNY STRAŻNIK: Odtąd wszystko dzieje się tylko w kokpicie! ---
    if (currentView !== 'cockpit') {
        return; // Jeśli nie jesteśmy w kokpicie, ignoruj poniższe klawisze
    }

    // Reszta logiki dla kokpitu...
    if (gameState.crashState.active) return;
    if (e.repeat && !['w', 's', 'a', 'd'].includes(e.key.toLowerCase())) return;
    const pressKeys = ['l', 'k', 'z', '[', ']'];
    if (pressKeys.includes(e.key.toLowerCase()) && !e.repeat) { 
        if (audio.unlocked && audio.press) { audio.press.currentTime = 0; audio.press.play().catch(() => {}); }
    }
    
    switch (e.key.toLowerCase()) {
        case 'q': shiftUp(); break;
        case 'e': shiftDown(); break;
        case '1': shiftToGear('1'); break;
        case '2': shiftToGear('2'); break;
        case '3': shiftToGear('3'); break;
        case '4': shiftToGear('4'); break;
        case 'n': shiftToGear('N'); break;
        case 'w': if (!controls.w) { controls.w = true; if (gameState.speedKmH < 2 && gameState.gear !== '1' && gameState.gear !== 'N') shiftToNeutral(); updateAudioForGear(); } break;
        case 's': if (!controls.s) { controls.s = true; if (gameState.gear !== 'N' && gameState.speedKmH > 0) shiftToNeutral(); } break;
        case 'a': controls.a = true; break;
        case 'd': controls.d = true; break;
        case 'l': controlsState.lightsOn = !controlsState.lightsOn; if (!controlsState.lightsOn) controlsState.longLightsOn = false; break;
        case 'k': if (controlsState.lightsOn) controlsState.longLightsOn = !controlsState.longLightsOn; break;
        case 'z': controlsState.hazardOn = !controlsState.hazardOn; if (controlsState.hazardOn) { controlsState.leftBlinkerOn = false; controlsState.rightBlinkerOn = false; } controlsState.blinkerVisible = true; controlsState.blinkerTimer = 0; break;
        case '[': controlsState.leftBlinkerOn = !controlsState.leftBlinkerOn; if (controlsState.leftBlinkerOn) { controlsState.rightBlinkerOn = false; controlsState.hazardOn = false; } controlsState.blinkerVisible = true; controlsState.blinkerTimer = 0; break;
        case ']': controlsState.rightBlinkerOn = !controlsState.rightBlinkerOn; if (controlsState.rightBlinkerOn) { controlsState.leftBlinkerOn = false; controlsState.hazardOn = false; } controlsState.blinkerVisible = true; controlsState.blinkerTimer = 0; break;
        case 'p': wipersState.active = !wipersState.active; if (audio.unlocked && audio.press) { audio.press.currentTime = 0; audio.press.volume = 0.8; audio.press.play().catch(() => {}); } break;
        case 'j': buttonState.b2.isPressed = !buttonState.b2.isPressed; if (audio.unlocked && audio.press) { audio.press.currentTime = 0; audio.press.volume = 0.7; audio.press.play().catch(() => {}); } break;
        case 'u': armClockState.isShownTarget = true; break;
    }
});

// Listener na PUSZCZENIE klawisza
window.addEventListener("keyup", (e) => {
    // Ta logika musi być globalna, bo to ona zmienia widok
    if (e.key.toLowerCase() === 'f') {
        if (rotaryMenuState.isActive) {
            const selectedItem = rotaryMenuState.items[rotaryMenuState.selectedIndex];
            if (selectedItem && selectedItem.name !== currentView) {
                if (audio.unlocked) {
                    if (selectedItem.name === 'engine' || selectedItem.name === 'trunk') { if (audio.viewOut) { audio.viewOut.currentTime = 0; audio.viewOut.volume = 0.7; audio.viewOut.play().catch(console.warn); } }
                    else if (selectedItem.name === 'cockpit') { if (audio.viewIn) { audio.viewIn.currentTime = 0; audio.viewIn.volume = 0.7; audio.viewIn.play().catch(console.warn); } }
                }
                viewTransitionState.isActive = true;
                viewTransitionState.phase = 'out';
                viewTransitionState.progress = 0;
                viewTransitionState.targetView = selectedItem.name;
            }
            rotaryMenuState.isActive = false;
            rotaryMenuState.isRotating = false;
            rotaryMenuState.rotationProgress = 0;
        }
    }

    // --- GŁÓWNY STRAŻNIK ---
    if (currentView !== 'cockpit') return;

    // Reszta logiki kokpitu
    switch (e.key.toLowerCase()) {
        case 'w': if (controls.w) { controls.w = false; stopAllEngineSounds(); } break;
        case 's': controls.s = false; break;
        case 'a': controls.a = false; break;
        case 'd': controls.d = false; break;
        case 'u': armClockState.isShownTarget = false; break;
    }
});

// Listener na KLIKNIĘCIE MYSZY


// Listener na KÓŁKO MYSZY
window.addEventListener('wheel', (e) => {
    const mousePos = getCanvasMousePos(e.clientX, e.clientY);

    // --- NOWY BLOK: OBSŁUGA SCROLLOWANIA TRZYMANEJ BUTELKI OLEJU ---
    // Ta logika jest nadrzędna, ponieważ butelkę można trzymać w różnych widokach.
    if (heldOilState.isHeld) {
        e.preventDefault(); // Zapobiegamy standardowemu przewijaniu strony

        // Określamy kierunek scrollowania: -1 dla góra, 1 dla dół
        const direction = Math.sign(e.deltaY); 

        // Dodajemy "pchnięcie" do prędkości kątowej.
        // Istniejąca fizyka w `updateHeldOil` zajmie się resztą (obrotem i tłumieniem).
        // Dzięki temu obrót będzie płynny i spójny z ruchem myszki.
        heldOilState.angleVelocity += direction * heldOilState.scrollTiltAmount;

        // Opcjonalnie: odtwórz dźwięk scrollowania, jeśli chcesz
        if (audio.unlocked && audio.scroll) {
            audio.scroll.currentTime = 0;
            audio.scroll.volume = 0.2; // Ciszej niż normalnie
            audio.scroll.play().catch(() => {});
        }

        return; // Kończymy obsługę zdarzenia, aby nie aktywować innych funkcji (np. zoomu mapy)
    }
    // --- KONIEC NOWEGO BLOKU ---

    // Zoom nakładek działa zawsze, więc jest poza głównym strażnikiem
    if (mapVisible || photoVisible || carSignVisible || docOverlayVisible) {
        handleOverlayZoom(e);
        return; // Zakończ, aby nie aktywować logiki specyficznej dla widoku
    }

    // --- GŁÓWNY STRAŻNIK: Sprawdzamy, w którym widoku jesteśmy ---
    if (currentView === 'cockpit') {
        // Reszta logiki dla kokpitu
        if (isMouseOver(mousePos, windowState.buttonPosition)) {
            handleWindowScroll(e);
            windowState.handleScrollAccumulator += Math.abs(e.deltaY);
            if (windowState.handleScrollAccumulator >= windowState.handleFlipThreshold && Math.abs(windowState.handleScaleX - 1) < 0.1) {
                windowState.handleTargetScaleX = 0;
                windowState.handleScrollAccumulator = 0.0;
                if (audio.unlocked && audio.press) { audio.press.currentTime = 0; audio.press.volume = 0.8; audio.press.play().catch(() => {}); }
            }
            return; 
        } 
        else if (isMouseOver(mousePos, handleMirrorState.position)) {
            e.preventDefault();
            const delta = Math.sign(e.deltaY);
            const randomAngle = Math.random() * 0.15 + 0.05; 
            if (delta < 0) { handleMirrorState.angle = randomAngle; handleMirrorState.sourceOffsetX -= 2.59; handleMirrorState.sourceOffsetY += 0.28; } 
            else { handleMirrorState.angle = -randomAngle; handleMirrorState.sourceOffsetX += 2.52; handleMirrorState.sourceOffsetY -= 0.31; }
            
            if (audio.unlocked && audio.scroll && currentView === 'cockpit') { 
                audio.scroll.currentTime = 0; 
                audio.scroll.volume = 0.4; 
                audio.scroll.play().catch(() => {}); 
            }
        }
        else if (isMouseOver(mousePos, radioState.volumeButton)) {
            handleRadioVolumeScroll(e);
        }

    } 
    // --- ZMIANA: Logika scrolla dla widoku silnika ---
    else if (currentView === 'engine') {
        if (isMouseOver(mousePos, oilCapState)) {
            e.preventDefault();
            const delta = Math.sign(e.deltaY); 
            let soundShouldPlay = false;

            if (delta > 0) { // Scroll w dół (wkręcanie)
                // --- NOWY WARUNEK ---
                // Odtwórz dźwięk tylko, jeśli korek NIE jest już wkręcony na maksa
                if (oilCapState.unscrewProgress > 0) {
                    soundShouldPlay = true;
                }
                oilCapState.unscrewProgress -= oilCapState.scrollSensitivity * Math.abs(e.deltaY);
            } 
            else { // Scroll w górę (odkręcanie)
                // --- NOWY WARUNEK ---
                // Odtwórz dźwięk tylko, jeśli korek NIE jest już odkręcony na maksa
                if (oilCapState.unscrewProgress < oilCapState.maxUnscrewProgress) {
                    soundShouldPlay = true;
                }
                oilCapState.unscrewProgress += oilCapState.scrollSensitivity * Math.abs(e.deltaY);
            }
            
            // Ograniczamy wartość postępu, aby nie wychodziła poza zakres
            oilCapState.unscrewProgress = Math.max(0, Math.min(oilCapState.maxUnscrewProgress, oilCapState.unscrewProgress));
            
            // Odtwarzamy dźwięk, jeśli warunek został spełniony
            if (soundShouldPlay && audio.unlocked && audio.screw) {
                audio.screw.currentTime = 0;
                audio.screw.volume = 0.8;
                audio.screw.play().catch(e => console.warn("Nie udało się odtworzyć screw.mp3", e));
            }
        }
    }
}, { passive: false });

// =======================================================================
// =======================================================================
// === POPRAWIONY KOD: Listener dblclick, który ustawia stały cel dla zoomu ===
// =======================================================================
canvas.addEventListener('dblclick', (e) => {
    // Sprawdzamy, czy gracz trzyma piwo i nie jest już w trakcie picia
    if (heldBeerState.isHeld && !heldBeerState.isDrinking) {
        // Sprawdzamy, czy doubleclick na pewno nastąpił na butelce
        const mousePos = getCanvasMousePos(e.clientX, e.clientY);
        const beerRect = {
            width: heldBeerState.width * heldBeerState.scale,
            height: heldBeerState.height * heldBeerState.scale,
        };
        beerRect.x = heldBeerState.x - beerRect.width / 2;
        beerRect.y = heldBeerState.y - beerRect.height / 2;

        if (isMouseOver(mousePos, beerRect)) {
            e.preventDefault();

            // 1. Zwiększamy licznik wypitych piw.
            stanUpojenia.liczbaWypitychPiw++;
            
            // =================================================================
            // === NOWY KOD (POPRAWIONA WERSJA): Inkrementalna zmiana mrugania ===
            // =================================================================
            
            // Sprawdzamy, czy jeszcze nie osiągnęliśmy limitu 10 piw, po którym efekt przestaje narastać.
            if (stanUpojenia.liczbaWypitychPiw <= 10) {
                const ZMIANA_INTERVALU = 0.65;      // Wartość do odjęcia od interwału
                const ZMIANA_CZASU_TRWANIA = 0.21; // Wartość do dodania do czasu trwania
                const MINIMALNY_INTERVAL = 0.2;      // Zabezpieczenie

                // Aktualizujemy obecne wartości, a nie obliczamy od nowa.
                blinkState.interval -= ZMIANA_INTERVALU;
                blinkState.duration += ZMIANA_CZASU_TRWANIA;

                // Upewniamy się, że interwał nie spadnie poniżej minimalnej wartości.
                blinkState.interval = Math.max(MINIMALNY_INTERVAL, blinkState.interval);

                console.log(`Piwo #${stanUpojenia.liczbaWypitychPiw}: Interwał mrugania: ${blinkState.interval.toFixed(2)}s, Czas trwania: ${blinkState.duration.toFixed(2)}s`);
            } else {
                // Opcjonalny log, gdy limit jest osiągnięty
                console.log(`Piwo #${stanUpojenia.liczbaWypitychPiw}: Efekt mrugania osiągnął maksimum.`);
            }

            // =================================================================
            // === KONIEC POPRAWIONEGO KODU =====================================
            // =================================================================


            // --- Logika obliczania zoomu (pozostaje bez zmian) ---
            const iloscPiw = stanUpojenia.liczbaWypitychPiw;
            const lacznePrzyblizeniePx = iloscPiw * 5;

            console.log(`Wypito piwo #${iloscPiw}. Docelowe przybliżenie: ${lacznePrzyblizeniePx}px.`);

            if (lacznePrzyblizeniePx * 2 >= canvas.width) {
                 console.error("Maksymalne przybliżenie osiągnięte!");
            } else {
                stanUpojenia.docelowyZoom = canvas.width / (canvas.width - (lacznePrzyblizeniePx * 2));
            }
            console.log(`Nowy docelowy zoom (współczynnik skali): ${stanUpojenia.docelowyZoom.toFixed(4)}`);
            // --- Koniec logiki zoomu ---


            // Rozpoczynamy animację picia (to pozostaje bez zmian)
            heldBeerState.isDrinking = true;

            // Odtwarzamy dźwięk picia (to pozostaje bez zmian)
            if (audio.unlocked && audio.drinking) {
                audio.drinking.currentTime = 0;
                audio.drinking.volume = 0.9;
                audio.drinking.play().catch(e => console.warn("Nie udało się odtworzyć drinking.mp3", e));
            }
        }
    }
});

// Listener na NACIŚNIĘCIE PRZYCISKU MYSZY
canvas.addEventListener('mousedown', (e) => {
    // --- GŁÓWNY STRAŻNIK ---
    if (currentView !== 'cockpit') return;
    
    // Reszta logiki kokpitu
    const mousePos = getCanvasMousePos(e.clientX, e.clientY);
    
    if (mapVisible) { 
        const mapWidth = canvas.width * 0.723 * mapScale; 
        const mapHeight = canvas.height * 1.515 * mapScale; 
        const mapX = (canvas.width - mapWidth) / 2 + mapOffsetX; 
        const mapY = (canvas.height - mapHeight)/2 + mapOffsetY; 
        if (mousePos.x >= mapX && mousePos.x <= mapX + mapWidth && mousePos.y >= mapY && mousePos.y <= mapY + mapHeight) { 
            isOverlayDragging = true; mapAccordionState.isHeld = true; lastOverlayDragX = mousePos.x; lastOverlayDragY = mousePos.y; canvas.style.cursor = 'grabbing'; 
            return; 
        } 
    }

    if (isMouseOver(mousePos, radioState.rewindButton)) {
        if (!radioState.isRewinding) {
            radioState.isRewinding = true;
            radioState.rewindIntervalId = setInterval(() => { if (audio.radio) { audio.radio.currentTime += 16; } }, 250);
        }
        return;
    }

    const docRect = { x: docState.baseX + docState.offsetX, y: docState.baseY + docState.offsetY, width: docState.width * docState.scale, height: docState.height * docState.scale };
    if (isMouseOver(mousePos, docRect) && !mapVisible && !photoVisible && !carSignVisible && !docOverlayVisible) {
        docState.isDragging = true; docState.dragStartMouseX = mousePos.x; docState.dragStartMouseY = mousePos.y; docState.dragStartOffsetX = docState.offsetX; docState.dragStartOffsetY = docState.offsetY; docState.angleVelocity = 0; docState.dragLastMouseX = mousePos.x; canvas.style.cursor = 'grabbing';
        return;
    }

    if (photoVisible) { 
        const photoAspectRatio = assets.photo.naturalWidth / assets.photo.naturalHeight; let photoHeight = canvas.height * 0.8 * photoScale; let photoWidth = photoHeight * photoAspectRatio; const photoX = (canvas.width - photoWidth) / 2 + photoOffsetX; const photoY = (canvas.height - photoHeight) / 2 + photoOffsetY;
        if (mousePos.x >= photoX && mousePos.x <= photoX + photoWidth && mousePos.y >= photoY && mousePos.y <= photoY + photoHeight) { isOverlayDragging = true; lastOverlayDragX = mousePos.x; lastOverlayDragY = mousePos.y; canvas.style.cursor = 'grabbing'; return; }
    } else if (carSignVisible) { 
        const signAspectRatio = assets.carSign.naturalWidth / assets.carSign.naturalHeight; let signHeight = canvas.height * 0.7 * carSignScale; let signWidth = signHeight * signAspectRatio; const signX = (canvas.width - signWidth) / 2 + carSignOffsetX; const signY = (canvas.height - signHeight) / 2 + carSignOffsetY;
        if (mousePos.x >= signX && mousePos.x <= signX + signWidth && mousePos.y >= signY && mousePos.y <= signHeight) { isOverlayDragging = true; lastOverlayDragX = mousePos.x; lastOverlayDragY = mousePos.y; canvas.style.cursor = 'grabbing'; return; }
    } else if (docOverlayVisible) { 
        const currentImage = docOverlayImages.images[docOverlayImages.current];
        if (currentImage && currentImage.complete) {
            const aspectRatio = currentImage.naturalWidth / currentImage.naturalHeight; let docHeight = canvas.height * 0.9 * docOverlayScale; let docWidth = docHeight * aspectRatio; const docX = (canvas.width - docWidth) / 2 + docOverlayOffsetX; const docY = (canvas.height - docHeight) / 2 + docOverlayOffsetY;
            if (mousePos.x >= docX && mousePos.x <= docX + docWidth && mousePos.y >= docY && mousePos.y <= docY + docHeight) { isOverlayDragging = true; lastOverlayDragX = mousePos.x; lastOverlayDragY = mousePos.y; canvas.style.cursor = 'grabbing'; return; }
        }
    }
    
    const hangScreenX = hangerState.anchorX + Math.sin(hangerState.angle) * -1 * hangerState.length; const hangScreenY = hangerState.anchorY + Math.cos(hangerState.angle) * hangerState.length; const dist = Math.sqrt(Math.pow(mousePos.x - hangScreenX, 2) + Math.pow(mousePos.y - hangScreenY, 2));
    if (dist < 60) { hangerState.isDragging = true; hangerState.velocity = 0; hangerState.lastMouseX = mousePos.x; canvas.style.cursor = 'grabbing'; }
});

// Listener na RUCH MYSZY
canvas.addEventListener('mousemove', (e) => {
    const mousePos = getCanvasMousePos(e.clientX, e.clientY);
    
    // --- GŁÓWNY STRAŻNIK ---
    // Logika kursora i przeciągania jest teraz specyficzna dla widoku
    if (currentView === 'cockpit') {
        if (docState.isDragging) {
            const deltaX = mousePos.x - docState.dragStartMouseX;
            const deltaY = mousePos.y - docState.dragStartMouseY;
            const potentialNewOffsetX = docState.dragStartOffsetX + deltaX;
            const isWindowBlocked = windowState.glassYOffset < windowState.glassMaxDownOffset / 2;
            const leftBoundary = -docState.baseX;
            if (isWindowBlocked && potentialNewOffsetX < leftBoundary) {
                docState.offsetX = leftBoundary;
                if (!docState.justHitBoundary && audio.unlocked && audio.glassboom) { audio.glassboom.currentTime = 0; audio.glassboom.volume = 0.7; audio.glassboom.play().catch(console.warn); docState.justHitBoundary = true; }
            } else {
                docState.offsetX = potentialNewOffsetX;
                docState.justHitBoundary = false;
            }
            docState.offsetY = docState.dragStartOffsetY + deltaY;
            const mouseMoveDeltaX = mousePos.x - docState.dragLastMouseX;
            docState.angle = mouseMoveDeltaX * docState.dragAngleFactor;
            docState.dragLastMouseX = mousePos.x;
        }
        
        if (!isOverlayDragging && !hangerState.isDragging && !docState.isDragging) {
            const wheelX = canvas.width / 2 - 140; const wheelY = canvas.height / 2 + 260; const wheelSize = 150; const distToHorn = Math.sqrt(Math.pow(mousePos.x - wheelX, 2) + Math.pow(mousePos.y - wheelY, 2));
            const hangScreenX = hangerState.anchorX + Math.sin(hangerState.angle) * -1 * hangerState.length; const hangScreenY = hangerState.anchorY + Math.cos(hangerState.angle) * hangerState.length; const distToHanger = Math.sqrt(Math.pow(mousePos.x - hangScreenX, 2) + Math.pow(mousePos.y - hangScreenY, 2));
            const docRect = { x: docState.baseX + docState.offsetX, y: docState.baseY + docState.offsetY, width: docState.width * docState.scale, height: docState.height * docState.scale };
            const isOverDoc = isMouseOver(mousePos, docRect) && !mapVisible && !photoVisible && !carSignVisible && !docOverlayVisible;
            if ( isMouseOver(mousePos, mirrorState.position) || isMouseOver(mousePos, handleMirrorState.position) || isMouseOver(mousePos, windowState.buttonPosition) || isOverDoc || distToHorn <= wheelSize / 2 || isMouseOver(mousePos, radioState.volumeButton) || isMouseOver(mousePos, radioState.rewindButton) || distToHanger < 60 ) {
                canvas.style.cursor = 'pointer';
            } else {
                canvas.style.cursor = ''; 
            }
        }

        if (isOverlayDragging) { 
            const deltaX = mousePos.x - lastOverlayDragX; const deltaY = mousePos.y - lastOverlayDragY;
            if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) { if (audio.unlocked && audio.mapMove.paused) { audio.mapMove.currentTime = 0; audio.mapMove.volume = 0.4; audio.mapMove.play().catch(() => {}); } } 
            if (mapVisible) { mapOffsetX += deltaX; mapOffsetY += deltaY; } 
            else if (photoVisible) { photoOffsetX += deltaX; photoOffsetY += deltaY; } 
            else if (carSignVisible) { carSignOffsetX += deltaX; carSignOffsetY += deltaY; } 
            else if (docOverlayVisible) { docOverlayOffsetX += deltaX; docOffsetY += deltaY; }
            const dragSpeed = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            mapSwayVelocity += deltaX * 0.5 * Math.min(dragSpeed / 30, 0.1); mapSwayVelocity = Math.max(-1.1, Math.min(1.1, mapSwayVelocity));
            lastOverlayDragX = mousePos.x; lastOverlayDragY = mousePos.y;
        }
        
        if (hangerState.isDragging) {
            const dx = mousePos.x - hangerState.anchorX; const dy = mousePos.y - hangerState.anchorY; hangerState.angle = Math.atan2(dx, dy) * -1;
            const flickSpeed = (mousePos.x - hangerState.lastMouseX) * 0.0015; hangerState.velocity = flickSpeed;
            hangerState.lastMouseX = mousePos.x;
        }
    } 
    // --- ZMIANA: Logika kursora dla widoku silnika ---
    else if (currentView === 'engine') {
        if (isMouseOver(mousePos, oilCapState)) {
            canvas.style.cursor = 'pointer'; // "łapka"
        } else {
            canvas.style.cursor = ''; // Domyślny kursor
        }
    } 
        else if (currentView === 'trunk') {
        // Stwórz prostokąt kolizji dla butelki
        const oilRect = {
            x: trunkOilState.x,
            y: trunkOilState.y,
            width: trunkOilState.width,
            height: trunkOilState.height
        };
        // Sprawdź, czy mysz jest nad butelką
        if (isMouseOver(mousePos, oilRect)) {
            trunkOilState.isHovered = true;
            canvas.style.cursor = 'pointer';
        } else {
            trunkOilState.isHovered = false;
            canvas.style.cursor = '';
        }
    }
    // Jeśli nie jesteśmy ani w kokpicie, ani w silniku, upewnij się, że kursor jest domyślny
    else {
        canvas.style.cursor = '';
    }
});

canvas.addEventListener('mouseup', () => { 
    // Te stany resetujemy niezależnie od widoku, bo mogły zostać ustawione w kokpicie
    mapAccordionState.isHeld = false;
    if (radioState.isRewinding) {
        radioState.isRewinding = false;
        clearInterval(radioState.rewindIntervalId);
        radioState.rewindIntervalId = null;
    }
    if (docState.isDragging) {
        docState.isDragging = false;
        canvas.style.cursor = '';
        const dragDistance = Math.sqrt(
            Math.pow(docState.offsetX - docState.dragStartOffsetX, 2) +
            Math.pow(docState.offsetY - docState.dragStartOffsetY, 2)
        );
        if (dragDistance < 5) {
            docState.offsetX = docState.dragStartOffsetX;
            docState.offsetY = docState.dragStartOffsetY;
            toggleDocOverlay();
        }
    }
    if (isOverlayDragging) { isOverlayDragging = false; canvas.style.cursor = ''; } 
    if (hangerState.isDragging) { hangerState.isDragging = false; canvas.style.cursor = ''; } 
});

canvas.addEventListener('mouseleave', () => { 
    // Podobnie jak w mouseup, resetujemy stany
    if (radioState.isRewinding) {
        radioState.isRewinding = false;
        clearInterval(radioState.rewindIntervalId);
        radioState.rewindIntervalId = null;
    }
    if (docState.isDragging) {
        docState.isDragging = false;
        canvas.style.cursor = '';
    }
    if (isOverlayDragging) { isOverlayDragging = false; canvas.style.cursor = ''; } 
    if (hangerState.isDragging) { hangerState.isDragging = false; canvas.style.cursor = ''; } 
});

