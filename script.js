const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Elementos de la UI
const mainMenu = document.getElementById('main-menu');
const gameOverScreen = document.getElementById('game-over');
const hud = document.getElementById('hud');
const scoreDisplay = document.getElementById('current-score');
const menuHighscore = document.getElementById('menu-highscore');
const goScore = document.getElementById('go-score');
const goHighscore = document.getElementById('go-highscore');

// Botones
document.getElementById('btn-play').addEventListener('click', startGame);
document.getElementById('btn-restart').addEventListener('click', startGame);
document.getElementById('btn-menu').addEventListener('click', showMenu);
document.getElementById('btn-reset').addEventListener('click', () => {
    localStorage.removeItem('flappyChickenHighscore');
    updateHighscoreDisplay();
});

// Variables del juego
let frames = 0;
let gameState = 'MENU'; // MENU, PLAYING, GAMEOVER
let score = 0;
let highscore = localStorage.getItem('flappyChickenHighscore') || 0;
let pipes = [];
let particles = []; // Nubes en el fondo

// Audio Context (Generador de sonidos procedurales)
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'flap') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    }
}

// Entidad: Gallina
const chicken = {
    x: 50,
    y: 150,
    radius: 15,
    velocity: 0,
    gravity: 0.25,
    jump: -5.5,
    rotation: 0,
    wingY: 0,
    wingDirection: 1,

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Rotación basada en velocidad (caída = punta abajo, subida = punta arriba)
        this.rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (this.velocity * 0.1)));
        ctx.rotate(this.rotation);

        // Cuerpo (Blanco)
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#000';
        ctx.stroke();

        // Cresta (Roja)
        ctx.beginPath();
        ctx.arc(0, -this.radius, 5, 0, Math.PI * 2);
        ctx.arc(-5, -this.radius + 2, 4, 0, Math.PI * 2);
        ctx.arc(5, -this.radius + 2, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ff4757';
        ctx.fill();

        // Pico (Amarillo/Naranja)
        ctx.beginPath();
        ctx.moveTo(this.radius - 2, -2);
        ctx.lineTo(this.radius + 10, 2);
        ctx.lineTo(this.radius - 2, 6);
        ctx.fillStyle = '#ffa502';
        ctx.fill();
        ctx.stroke();

        // Ojo
        ctx.beginPath();
        ctx.arc(this.radius - 6, -4, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();

        // Ala (Animada)
        if (gameState === 'PLAYING') {
            this.wingY += this.wingDirection * 1.5;
            if (this.wingY > 5 || this.wingY < -5) this.wingDirection *= -1;
        }
        
        ctx.beginPath();
        ctx.ellipse(-5, 2 + this.wingY, 8, 4, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#f1f2f6';
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    },

    update() {
        this.velocity += this.gravity;
        this.y += this.velocity;

        // Colisión con suelo o techo
        if (this.y + this.radius >= canvas.height || this.y - this.radius <= 0) {
            triggerGameOver();
        }
    },

    flap() {
        this.velocity = this.jump;
        playSound('flap');
    }
};

// Generador de Nubes (Fondo)
function createClouds() {
    if (frames % 100 === 0) {
        particles.push({
            x: canvas.width,
            y: Math.random() * (canvas.height / 2),
            w: 40 + Math.random() * 40,
            speed: 0.5 + Math.random() * 0.5
        });
    }
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    particles.forEach((p, i) => {
        p.x -= p.speed;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.w/2, 0, Math.PI*2);
        ctx.arc(p.x + p.w/3, p.y - p.w/4, p.w/3, 0, Math.PI*2);
        ctx.arc(p.x + p.w/1.5, p.y, p.w/2.5, 0, Math.PI*2);
        ctx.fill();

        if (p.x + p.w < 0) particles.splice(i, 1);
    });
}

// Generador de Tubos
const pipeConfig = {
    width: 60,
    gap: 140, // Espacio entre tubo de arriba y abajo
    speed: 3
};

function handlePipes() {
    if (frames % 90 === 0) {
        let topHeight = Math.random() * (canvas.height - pipeConfig.gap - 100) + 50;
        pipes.push({
            x: canvas.width,
            topHeight: topHeight,
            bottomY: topHeight + pipeConfig.gap,
            passed: false
        });
    }

    for (let i = 0; i < pipes.length; i++) {
        let p = pipes[i];
        p.x -= pipeConfig.speed;

        // Dibujar Tubo Superior
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(p.x, 0, pipeConfig.width, p.topHeight);
        ctx.strokeRect(p.x, 0, pipeConfig.width, p.topHeight);
        
        // Dibujar borde del tubo superior
        ctx.fillRect(p.x - 5, p.topHeight - 20, pipeConfig.width + 10, 20);
        ctx.strokeRect(p.x - 5, p.topHeight - 20, pipeConfig.width + 10, 20);

        // Dibujar Tubo Inferior
        let bottomHeight = canvas.height - p.bottomY;
        ctx.fillRect(p.x, p.bottomY, pipeConfig.width, bottomHeight);
        ctx.strokeRect(p.x, p.bottomY, pipeConfig.width, bottomHeight);
        
        // Dibujar borde del tubo inferior
        ctx.fillRect(p.x - 5, p.bottomY, pipeConfig.width + 10, 20);
        ctx.strokeRect(p.x - 5, p.bottomY, pipeConfig.width + 10, 20);

        // Colisión (AABB - Bounding Box)
        let cx = chicken.x;
        let cy = chicken.y;
        let r = chicken.radius - 2; // Margen de error para que no sea tan punitivo

        if (cx + r > p.x && cx - r < p.x + pipeConfig.width) {
            if (cy - r < p.topHeight || cy + r > p.bottomY) {
                triggerGameOver();
            }
        }

        // Puntuación
        if (p.x + pipeConfig.width < chicken.x && !p.passed) {
            score++;
            scoreDisplay.innerText = score;
            p.passed = true;
        }

        // Eliminar tubos que salen de pantalla
        if (p.x + pipeConfig.width < 0) {
            pipes.splice(i, 1);
            i--;
        }
    }
}

// Controles (Toque y Click)
window.addEventListener('mousedown', handleInput);
window.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Evita comportamientos nativos de zoom
    handleInput();
}, { passive: false });

function handleInput() {
    if (gameState === 'PLAYING') {
        chicken.flap();
    }
}

// Lógica de Vistas
function updateHighscoreDisplay() {
    highscore = localStorage.getItem('flappyChickenHighscore') || 0;
    menuHighscore.innerText = highscore;
}

function showMenu() {
    gameState = 'MENU';
    mainMenu.classList.remove('hidden');
    gameOverScreen.classList.add('hidden');
    hud.classList.add('hidden');
    updateHighscoreDisplay();
    resizeCanvas();
    drawBackground();
    chicken.y = canvas.height / 2;
    chicken.velocity = 0;
    chicken.draw();
}

function startGame() {
    gameState = 'PLAYING';
    mainMenu.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    
    score = 0;
    scoreDisplay.innerText = score;
    frames = 0;
    pipes = [];
    particles = [];
    chicken.y = canvas.height / 2;
    chicken.velocity = 0;
    chicken.flap();

    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function triggerGameOver() {
    gameState = 'GAMEOVER';
    playSound('hit');
    
    // Vibración (solo en móviles que lo soporten)
    if (navigator.vibrate) {
        navigator.vibrate(200);
    }

    if (score > highscore) {
        highscore = score;
        localStorage.setItem('flappyChickenHighscore', highscore);
    }

    goScore.innerText = score;
    goHighscore.innerText = highscore;

    hud.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
}

// Renderizado y Bucle Principal
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}

window.addEventListener('resize', resizeCanvas);

function drawBackground() {
    // Cielo degradado
    let grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grd.addColorStop(0, "#70c5ce");
    grd.addColorStop(1, "#e0f6f5");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Suelo
    ctx.fillStyle = '#ded895';
    ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
    ctx.strokeStyle = '#c4b964';
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 30);
    ctx.lineTo(canvas.width, canvas.height - 30);
    ctx.stroke();
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    createClouds();

    if (gameState === 'PLAYING') {
        handlePipes();
        chicken.update();
        frames++;
    } else if (gameState === 'GAMEOVER') {
        // Dibuja los tubos estáticos si perdiste
        pipes.forEach(p => {
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(p.x, 0, pipeConfig.width, p.topHeight);
            let bottomHeight = canvas.height - p.bottomY;
            ctx.fillRect(p.x, p.bottomY, pipeConfig.width, bottomHeight);
        });
        
        // Caída dramática de la gallina
        if (chicken.y < canvas.height - chicken.radius) {
            chicken.y += 10;
        }
    }

    chicken.draw();
    requestAnimationFrame(gameLoop);
}

// Inicializar
resizeCanvas();
updateHighscoreDisplay();
requestAnimationFrame(gameLoop);
showMenu();