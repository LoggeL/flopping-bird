
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Chaos Constants
const GRAVITY = 0.25;
const FLAP_STRENGTH = -5.5;
let gameSpeed = 2.5;
const PIPE_SPAWN_RATE = 120;
const PIPE_WIDTH = 60;
const PIPE_GAP = 140;
const GROUND_HEIGHT = 20;

// Set canvas size
canvas.width = 360;
canvas.height = 640;

// Game state
let score = 0;
let highScore = localStorage.getItem('floppingHighScore') || 0;
let gameState = 'START';
let frames = 0;
let shakeIntensity = 0;
let hue = 0; // Global hue for rainbow effects

// UI Elements
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('highScore');
highScoreElement.textContent = `Best: ${highScore}`;

// Particles System
let particles = [];
let floatingTexts = [];

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 5 + 2;
        this.speedX = Math.random() * 4 - 2;
        this.speedY = Math.random() * 4 - 2;
        this.color = color;
        this.life = 1.0;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= 0.02;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.restore();
    }
}

class FloatingText {
    constructor(text, x, y) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.life = 1.0;
        this.velocity = -2;
        this.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
        this.scale = 1;
    }
    update() {
        this.y += this.velocity;
        this.life -= 0.015;
        this.scale += 0.05;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.translate(this.x, this.y);
        ctx.scale(this.scale, this.scale);
        ctx.fillStyle = this.color;
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.font = 'bold 24px Impact';
        ctx.textAlign = 'center';
        ctx.strokeText(this.text, 0, 0);
        ctx.fillText(this.text, 0, 0);
        ctx.restore();
    }
}

// Bird Object
const bird = {
    x: 50,
    y: canvas.height / 2,
    radius: 15,
    velocity: 0,
    rotation: 0,
    eyeOffset: 0,
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Rainbow Body
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Crazy Eye
        const eyeX = 6 + Math.cos(frames * 0.5) * 2;
        const eyeY = -6 + Math.sin(frames * 0.5) * 2;
        
        ctx.beginPath();
        ctx.fillStyle = 'white';
        ctx.arc(eyeX, eyeY, 8, 0, Math.PI * 2); // Bigger crazy eye
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = 'black';
        ctx.arc(eyeX + this.eyeOffset, eyeY, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Wing (flapping furiously)
        ctx.beginPath();
        ctx.fillStyle = `hsl(${hue + 180}, 70%, 70%)`;
        const wingY = Math.sin(frames * 0.5) * 5;
        ctx.ellipse(-2, 2 + wingY, 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Beak
        ctx.beginPath();
        ctx.fillStyle = '#f1c40f';
        ctx.moveTo(8, 2);
        ctx.lineTo(20, 6); // Longer beak
        ctx.lineTo(8, 10);
        ctx.fill();
        
        ctx.restore();
    },
    
    update() {
        this.velocity += GRAVITY;
        this.y += this.velocity;
        
        // Spin logic
        if (this.velocity < 0) {
            this.rotation = Math.max(-0.6, this.rotation - 0.2);
        } else {
            this.rotation += 0.1; // Continuous slow spin when falling
        }
        
        // Floor collision
        if (this.y + this.radius >= canvas.height - GROUND_HEIGHT) {
            this.y = canvas.height - GROUND_HEIGHT - this.radius;
            addParticles(this.x, this.y, 20, '#f1c40f');
            gameOver();
        }
        
        // Ceiling bounce
        if (this.y - this.radius <= 0) {
            this.y = this.radius;
            this.velocity = 2; // Bounce down
            shakeIntensity = 5;
            addFloatingText("BONK!", this.x, this.y + 40);
        }
    },
    
    flap() {
        this.velocity = FLAP_STRENGTH;
        this.rotation = -0.5;
        shakeIntensity = 2;
        addParticles(this.x, this.y, 5, 'white');
        
        // Random chance for "Double Jump" physics glitch
        if (Math.random() < 0.1) {
            this.velocity *= 1.5;
            addFloatingText("ZOOM!", this.x, this.y - 30);
        }
    }
};

function addParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color || `hsl(${Math.random() * 360}, 100%, 50%)`));
    }
}

function addFloatingText(text, x, y) {
    floatingTexts.push(new FloatingText(text, x, y));
}

// Pipes Array
let pipes = [];

function createPipe() {
    const minPipeHeight = 50;
    const maxPipeHeight = canvas.height - GROUND_HEIGHT - PIPE_GAP - minPipeHeight;
    const topHeight = Math.floor(Math.random() * (maxPipeHeight - minPipeHeight + 1)) + minPipeHeight;
    
    // Random pipe color per pipe
    const pipeHue = Math.random() * 360;
    
    pipes.push({
        x: canvas.width,
        topHeight: topHeight,
        passed: false,
        hue: pipeHue,
        moving: Math.random() < 0.3, // 30% chance for moving pipe
        moveSpeed: (Math.random() * 2) + 1,
        moveDir: 1
    });
}

function drawPipes() {
    pipes.forEach(pipe => {
        const pipeColor = `hsl(${pipe.hue}, 60%, 50%)`;
        const borderColor = `hsl(${pipe.hue}, 60%, 30%)`;
        
        // Top Pipe
        ctx.fillStyle = pipeColor;
        ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
        
        // Bottom Pipe
        const bottomPipeY = pipe.topHeight + PIPE_GAP;
        const bottomPipeHeight = canvas.height - GROUND_HEIGHT - bottomPipeY;
        
        ctx.fillStyle = pipeColor;
        ctx.fillRect(pipe.x, bottomPipeY, PIPE_WIDTH, bottomPipeHeight);
        ctx.strokeRect(pipe.x, bottomPipeY, PIPE_WIDTH, bottomPipeHeight);
        
        // Warning sign on moving pipes
        if (pipe.moving) {
            ctx.fillStyle = 'yellow';
            ctx.font = '20px Arial';
            ctx.fillText('⚠️', pipe.x + 15, pipe.topHeight + PIPE_GAP / 2 + 5);
        }
    });
}

function updatePipes() {
    pipes.forEach(pipe => {
        pipe.x -= gameSpeed;
        
        // Moving pipe logic (vertical)
        if (pipe.moving) {
            pipe.topHeight += pipe.moveSpeed * pipe.moveDir;
            if (pipe.topHeight < 50 || pipe.topHeight > canvas.height - GROUND_HEIGHT - PIPE_GAP - 50) {
                pipe.moveDir *= -1;
            }
        }
        
        // Collision
        if (bird.x + bird.radius > pipe.x && bird.x - bird.radius < pipe.x + PIPE_WIDTH) {
            if (bird.y - bird.radius < pipe.topHeight || bird.y + bird.radius > pipe.topHeight + PIPE_GAP) {
                shakeIntensity = 20;
                addParticles(bird.x, bird.y, 50, 'red');
                gameOver();
            }
        }
        
        // Score
        if (pipe.x + PIPE_WIDTH < bird.x && !pipe.passed) {
            score++;
            scoreElement.textContent = score;
            pipe.passed = true;
            
            // Random rewards
            const phrases = ["NICE!", "WOW!", "EPIC!", "SICK!", "LUCKY!", "FLOP!"];
            addFloatingText(phrases[Math.floor(Math.random() * phrases.length)], bird.x, bird.y - 50);
            shakeIntensity = 5;
            addParticles(bird.x, 0, 30, 'gold'); // Confetti from top?
            
            // Speed up slightly every 5 points
            if (score % 5 === 0) gameSpeed += 0.2;
        }
    });
    
    pipes = pipes.filter(pipe => pipe.x + PIPE_WIDTH > 0);
}

function drawBackground() {
    // Disco Background
    const bgHue = (frames * 0.2) % 360;
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, `hsl(${bgHue}, 30%, 20%)`);
    gradient.addColorStop(1, `hsl(${bgHue + 40}, 30%, 10%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Grid lines for "Cyber" feel
    ctx.strokeStyle = `hsla(${bgHue}, 100%, 50%, 0.1)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const gridSize = 40;
    const offset = (frames * gameSpeed) % gridSize;
    
    // Vertical moving lines
    for (let x = -offset; x < canvas.width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
    }
    // Horizontal lines
    for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();
}

function resetGame() {
    bird.y = canvas.height / 2;
    bird.velocity = 0;
    bird.rotation = 0;
    pipes = [];
    particles = [];
    floatingTexts = [];
    score = 0;
    gameSpeed = 2.5;
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
    // Screen Shake Apply
    ctx.save();
    if (shakeIntensity > 0) {
        const dx = Math.random() * shakeIntensity - shakeIntensity / 2;
        const dy = Math.random() * shakeIntensity - shakeIntensity / 2;
        ctx.translate(dx, dy);
        shakeIntensity *= 0.9;
        if (shakeIntensity < 0.5) shakeIntensity = 0;
    }

    frames++;
    hue = (hue + 1) % 360;
    
    if (gameState === 'PLAYING') {
        bird.update();
        if (frames % Math.floor(PIPE_SPAWN_RATE * (2.5/gameSpeed)) === 0) {
            createPipe();
        }
        updatePipes();
        
        // Update particles/texts
        particles.forEach((p, i) => {
            p.update();
            if (p.life <= 0) particles.splice(i, 1);
        });
        floatingTexts.forEach((t, i) => {
            t.update();
            if (t.life <= 0) floatingTexts.splice(i, 1);
        });
    }
    
    drawBackground();
    
    // Draw particles behind pipes? No, in front usually looks chaotic good
    particles.forEach(p => p.draw());
    
    drawPipes();
    
    // Ground
    ctx.fillStyle = `hsl(${hue}, 50%, 50%)`; // Rainbow ground
    ctx.fillRect(0, canvas.height - GROUND_HEIGHT, canvas.width, GROUND_HEIGHT);
    
    bird.draw();
    
    floatingTexts.forEach(t => t.draw());
    
    // Restore shake
    ctx.restore();
    
    // UI Overlay
    if (gameState === 'START') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = `hsl(${hue}, 100%, 70%)`;
        ctx.font = 'bold 40px Impact';
        ctx.textAlign = 'center';
        ctx.fillText('FLOPPING BIRD', canvas.width / 2, canvas.height / 2 - 40);
        ctx.fillStyle = 'white';
        ctx.font = '20px monospace';
        ctx.fillText('CHAOS EDITION', canvas.width / 2, canvas.height / 2);
        ctx.fillText('Tap / Space to Flop', canvas.width / 2, canvas.height / 2 + 40);
    } else if (gameState === 'GAMEOVER') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'red';
        ctx.font = 'bold 50px Impact';
        ctx.textAlign = 'center';
        ctx.fillText('WASTED', canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillStyle = 'white';
        ctx.font = '24px monospace';
        ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 30);
        ctx.font = '16px monospace';
        ctx.fillText('Tap to suffer again', canvas.width / 2, canvas.height / 2 + 70);
    }
    
    requestAnimationFrame(gameLoop);
}

// Input Handling
function handleInput(e) {
    if (e.type === 'keydown' && e.code !== 'Space') return;
    if (e.type === 'keydown') e.preventDefault();
    
    switch (gameState) {
        case 'START':
            gameState = 'PLAYING';
            bird.flap();
            break;
        case 'PLAYING':
            bird.flap();
            break;
        case 'GAMEOVER':
            if (shakeIntensity < 1) { // Prevent instant restart if shaking too hard
                resetGame();
                gameState = 'START';
            }
            break;
    }
}

window.addEventListener('keydown', handleInput);
window.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleInput(e);
}, { passive: false });
window.addEventListener('mousedown', handleInput);

gameLoop();
