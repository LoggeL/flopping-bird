
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game constants
const GRAVITY = 0.25;
const FLAP_STRENGTH = -5.5; // Slightly adjusted for "flop" feel
const PIPE_SPEED = 2.5; // Smooth 60fps scrolling
const PIPE_SPAWN_RATE = 120; // Frames between pipes
const PIPE_WIDTH = 60;
const PIPE_GAP = 140; // Fair gap size
const GROUND_HEIGHT = 20;

// Set canvas size (mobile friendly portrait-ish aspect ratio)
canvas.width = 360;
canvas.height = 640;

// Game state
let score = 0;
let highScore = localStorage.getItem('floppingHighScore') || 0;
let gameState = 'START'; // START, PLAYING, GAMEOVER
let frames = 0;

// UI Elements
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('highScore');
highScoreElement.textContent = `Best: ${highScore}`;

// Colors
const COLORS = {
    sky: ['#4ecdc4', '#556270'], // Gradient handled in draw
    bird: '#ff6b6b',
    birdBorder: '#c44d4d',
    pipe: '#2ecc71',
    pipeBorder: '#27ae60',
    ground: '#f1c40f',
    groundBorder: '#f39c12'
};

// Bird Object
const bird = {
    x: 50,
    y: canvas.height / 2,
    radius: 15,
    velocity: 0,
    rotation: 0,
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Body
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.bird;
        ctx.fill();
        ctx.strokeStyle = COLORS.birdBorder;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Eye
        ctx.beginPath();
        ctx.fillStyle = 'white';
        ctx.arc(6, -6, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = 'black';
        ctx.arc(8, -6, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Wing (simple animation)
        ctx.beginPath();
        ctx.fillStyle = '#ff8787';
        ctx.ellipse(-2, 2, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Beak
        ctx.beginPath();
        ctx.fillStyle = '#f1c40f';
        ctx.moveTo(8, 2);
        ctx.lineTo(16, 6);
        ctx.lineTo(8, 10);
        ctx.fill();
        
        ctx.restore();
    },
    
    update() {
        this.velocity += GRAVITY;
        this.y += this.velocity;
        
        // Rotation based on velocity
        if (this.velocity < 0) {
            this.rotation = Math.max(-0.4, this.rotation - 0.1);
        } else {
            this.rotation = Math.min(Math.PI / 2, this.rotation + 0.05);
        }
        
        // Floor collision
        if (this.y + this.radius >= canvas.height - GROUND_HEIGHT) {
            this.y = canvas.height - GROUND_HEIGHT - this.radius;
            gameOver();
        }
        
        // Ceiling collision (optional, but good for gameplay)
        if (this.y - this.radius <= 0) {
            this.y = this.radius;
            this.velocity = 0;
        }
    },
    
    flap() {
        this.velocity = FLAP_STRENGTH;
        this.rotation = -0.4;
    }
};

// Pipes Array
let pipes = [];

function createPipe() {
    // Determine random height for the gap
    // Min height for top/bottom pipes is 50px
    const minPipeHeight = 50;
    const maxPipeHeight = canvas.height - GROUND_HEIGHT - PIPE_GAP - minPipeHeight;
    const topHeight = Math.floor(Math.random() * (maxPipeHeight - minPipeHeight + 1)) + minPipeHeight;
    
    pipes.push({
        x: canvas.width,
        topHeight: topHeight,
        passed: false
    });
}

function drawPipes() {
    pipes.forEach(pipe => {
        // Top Pipe
        ctx.fillStyle = COLORS.pipe;
        ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
        
        // Pipe Cap (Top)
        ctx.fillStyle = COLORS.pipeBorder;
        ctx.fillRect(pipe.x - 2, pipe.topHeight - 20, PIPE_WIDTH + 4, 20);
        
        // Bottom Pipe
        const bottomPipeY = pipe.topHeight + PIPE_GAP;
        const bottomPipeHeight = canvas.height - GROUND_HEIGHT - bottomPipeY;
        
        ctx.fillStyle = COLORS.pipe;
        ctx.fillRect(pipe.x, bottomPipeY, PIPE_WIDTH, bottomPipeHeight);
        
        // Pipe Cap (Bottom)
        ctx.fillStyle = COLORS.pipeBorder;
        ctx.fillRect(pipe.x - 2, bottomPipeY, PIPE_WIDTH + 4, 20);
        
        // Main pipe borders (for style)
        ctx.strokeStyle = '#1e8449'; // Darker green
        ctx.lineWidth = 2;
        ctx.strokeRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
        ctx.strokeRect(pipe.x, bottomPipeY, PIPE_WIDTH, bottomPipeHeight);
    });
}

function updatePipes() {
    pipes.forEach(pipe => {
        pipe.x -= PIPE_SPEED;
        
        // Collision Detection
        // Horizontal check
        if (bird.x + bird.radius > pipe.x && bird.x - bird.radius < pipe.x + PIPE_WIDTH) {
            // Vertical check
            if (bird.y - bird.radius < pipe.topHeight || bird.y + bird.radius > pipe.topHeight + PIPE_GAP) {
                gameOver();
            }
        }
        
        // Score update
        if (pipe.x + PIPE_WIDTH < bird.x && !pipe.passed) {
            score++;
            scoreElement.textContent = score;
            pipe.passed = true;
        }
    });
    
    // Remove off-screen pipes
    pipes = pipes.filter(pipe => pipe.x + PIPE_WIDTH > 0);
}

function drawBackground() {
    // Sky Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, COLORS.sky[0]);
    gradient.addColorStop(1, COLORS.sky[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Clouds (Simple)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(50, 100, 30, 0, Math.PI * 2);
    ctx.arc(90, 110, 40, 0, Math.PI * 2);
    ctx.arc(140, 100, 30, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(250, 200, 30, 0, Math.PI * 2);
    ctx.arc(290, 210, 40, 0, Math.PI * 2);
    ctx.arc(340, 200, 30, 0, Math.PI * 2);
    ctx.fill();
}

function drawGround() {
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, canvas.height - GROUND_HEIGHT, canvas.width, GROUND_HEIGHT);
    
    // Ground Border/Grass
    ctx.fillStyle = COLORS.groundBorder;
    ctx.fillRect(0, canvas.height - GROUND_HEIGHT, canvas.width, 4);
    
    // Simple ground pattern (scrolling)
    const offset = (frames * PIPE_SPEED) % 20;
    ctx.strokeStyle = '#d35400';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = -20; i < canvas.width; i += 20) {
        ctx.moveTo(i - offset, canvas.height - GROUND_HEIGHT);
        ctx.lineTo(i - offset + 10, canvas.height);
    }
    ctx.stroke();
}

function resetGame() {
    bird.y = canvas.height / 2;
    bird.velocity = 0;
    bird.rotation = 0;
    pipes = [];
    score = 0;
    scoreElement.textContent = score;
    frames = 0;
}

function gameOver() {
    gameState = 'GAMEOVER';
    
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('floppingHighScore', highScore);
        highScoreElement.textContent = `Best: ${highScore}`;
    }
}

function gameLoop() {
    // Update
    frames++;
    
    if (gameState === 'PLAYING') {
        bird.update();
        if (frames % PIPE_SPAWN_RATE === 0) {
            createPipe();
        }
        updatePipes();
    }
    
    // Draw
    drawBackground();
    drawPipes();
    drawGround();
    bird.draw();
    
    // UI Overlay
    if (gameState === 'START') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 30px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText('Get Ready!', canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = '20px Segoe UI';
        ctx.fillText('Tap or Space to start', canvas.width / 2, canvas.height / 2 + 20);
    } else if (gameState === 'GAMEOVER') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 40px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = '24px Segoe UI';
        ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
        ctx.font = '20px Segoe UI';
        ctx.fillText('Tap to restart', canvas.width / 2, canvas.height / 2 + 60);
    }
    
    requestAnimationFrame(gameLoop);
}

// Input Handling
function handleInput(e) {
    if (e.type === 'keydown' && e.code !== 'Space') return;
    if (e.type === 'keydown') e.preventDefault(); // Prevent scrolling
    
    switch (gameState) {
        case 'START':
            gameState = 'PLAYING';
            bird.flap();
            break;
        case 'PLAYING':
            bird.flap();
            break;
        case 'GAMEOVER':
            // Small delay to prevent accidental restarts
            resetGame();
            gameState = 'START'; // Go back to start screen or straight to playing?
            // Let's go to START to give them a breather
            break;
    }
}

window.addEventListener('keydown', handleInput);
window.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent standard touch actions
    handleInput(e);
}, { passive: false });
window.addEventListener('mousedown', handleInput);

// Start
gameLoop();
