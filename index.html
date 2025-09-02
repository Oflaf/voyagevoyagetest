<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8" />
    <title>Desert Bus - Prosta wersja</title>
    <style>
        /* --- USTAWIENIA PODSTAWOWE --- */
        
        /* Resetowanie domyślnych stylów przeglądarki */
        body, html {
            margin: 0;
            padding: 0;
            overflow: hidden; /* Zapobiega paskom przewijania */
            width: 100%;
            height: 100%;
            background-color: black; /* Czarne tło jako domyślne */
        }

        /* Definicje czcionek */
        @font-face {
            font-family: 'DSDigi';
            src: url('fonts/DS-DIGI.TTF');
        }
        @font-face {
            font-family: 'VCR OSD Mono';
            src: url('fonts/VCR_OSD_MONO.ttf');
        }

        /* --- EKRAN ŁADOWANIA --- */

        #ekran-ladowania {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: #000000;
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 100; /* Najwyższy z-index, aby być na wierzchu */
            opacity: 1;
            transition: opacity 0.5s ease-out;
        }

        /* Klasa dodawana przez JS do ukrycia ekranu */
        #ekran-ladowania.ukryty {
            opacity: 0;
            pointer-events: none; /* Wyłącza interakcje po ukryciu */
        }

        #ekran-ladowania .ladowarka {
            border: 4px solid rgba(0, 0, 0, 0.2);
            border-top: 4px solid #ffffff;
            border-radius: 50%;
            width: 45px;
            height: 45px;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* --- KONTENER I PŁÓTNA GRY --- */

        /* Usunąłem niepotrzebny #canvasContainer, upraszając strukturę */
        
        /* Wspólne style dla obu płócien */
        canvas {
            position: fixed; /* lub 'absolute', jeśli body jest kontenerem */
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            image-rendering: pixelated; /* Dla stylu retro */
        }

        /* Płótno gry (2D) - zawsze na wierzchu */
        #gameCanvas {
            z-index: 2;
            background-color: transparent; /* Kluczowe: musi być przezroczyste */
        }
        
        /* Płótno shadera (WebGL) - pod spodem */
        #shaderCanvas {
            z-index: 1;
            display: none; /* WAŻNE: Ukryte na starcie, JS je pokaże */
            pointer-events: none; /* Zapobiega przechwytywaniu kliknięć */
        }

    </style>
</head>
<body>

    <!-- Ekran ładowania - jest pierwszy, więc renderuje się natychmiast -->
    <div id="ekran-ladowania">
        <div class="ladowarka"></div>
    </div>
    
    <!-- Płótna gry -->
    <canvas id="gameCanvas"></canvas>
    <canvas id="shaderCanvas"></canvas> 
  
    <!-- Skrypty na samym końcu, przed zamknięciem body -->
    <script src="script.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/soundtouchjs@0.1.2/dist/soundtouch.min.js"></script>
  
</body>
</html>
