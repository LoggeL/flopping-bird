const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Chaos Constants
const GRAVITY = 0.25;
const FLAP_STRENGTH = -5.5;
let gameSpeed = 2.5;
const PIPE_SPAWN_RATE = 120;
const PIPE_WIDTH = 60;
const PIPE_GAP = 160; // Easier gap
const GROUND_BASE_HEIGHT = 40;

// Set canvas size
canvas.width = 360;
canvas.height = 640;

// Game state
let score = 0;
let highScore = localStorage.getItem('floppingHighScore') || 0;
let gameState = 'START';
let frames = 0;
let shakeIntensity = 0;
let hue = 0;

// Entities
let pipes = [];
let particles = [];
let floatingTexts = [];
let powerups = [];
let enemies = [];
let terrainPoints = [];

// Bird State extensions
let birdPowerups = {
    invincible: 0,
    tiny: 0,
    slow: 0
};

// UI Elements
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('highScore');
highScoreElement.textContent = `Best: ${highScore}`;

// --- CLASSES ---

class Particle {
    constructor(x, y, color, size = 0) {
        this.x = x;
        this.y = y;
        this.size = size || Math.random() * 5 + 2;
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
    constructor(text, x, y, color) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.life = 1.0;
        this.velocity = -2;
        this.color = color || `hsl(${Math.random() * 360}, 100%, 50%)`;
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
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 4;
        ctx.font = 'bold 24px Impact';
        ctx.textAlign = 'center';
        ctx.strokeText(this.text, 0, 0);
        ctx.fillText(this.text, 0, 0);
        ctx.restore();
    }
}

class Powerup {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'SHIELD', 'TINY', 'SLOW', 'BLAST'
        this.radius = 15;
        this.bobOffset = Math.random() * Math.PI * 2;
    }
    update() {
        this.x -= gameSpeed;
        this.y += Math.sin(frames * 0.1 + this.bobOffset) * 0.5;
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'white';
        
        ctx.beginPath();
        if (this.type === 'SHIELD') {
            ctx.fillStyle = 'cyan';
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fillText('🛡️', -8, 5);
        } else if (this.type === 'TINY') {
            ctx.fillStyle = 'magenta';
            ctx.rect(-10, -10, 20, 20);
            ctx.fillText('🦐', -8, 5);
        } else if (this.type === 'SLOW') {
            ctx.fillStyle = 'lime';
            ctx.moveTo(0, -10);
            ctx.lineTo(10, 10);
            ctx.lineTo(-10, 10);
            ctx.fillText('⏰', -8, 5);
        } else if (this.type === 'BLAST') {
            ctx.fillStyle = 'orange';
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fillText('💣', -8, 5);
        }
        ctx.fill();
        ctx.restore();
    }
}

class Enemy {
    constructor() {
        this.x = canvas.width + 50;
        this.y = Math.random() * (canvas.height - 200) + 50;
        this.type = Math.random() < 0.5 ? 'GHOST' : 'ROCKET';
        this.speed = (Math.random() * 2 + 3) + (gameSpeed * 0.5);
        this.size = 25;
        this.angle = 0;
    }
    update() {
        this.x -= this.speed;
        if (this.type === 'GHOST') {
            this.y += Math.sin(frames * 0.05 + this.x * 0.01) * 2;
            this.angle = 0;
        } else {
            // Rocket aims slightly at bird
            if (bird.y > this.y) this.y += 0.5;
            if (bird.y < this.y) this.y -= 0.5;
            this.angle = Math.atan2(bird.y - this.y, bird.x - this.x);
        }
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.type === 'GHOST') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'black';
            ctx.fillText('👻', -12, 5);
        } else {
            ctx.rotate(this.angle);
            ctx.fillStyle = 'red';
            ctx.fillRect(-15, -10, 30, 20);
            ctx.fillStyle = 'orange'; // engine flame
            ctx.beginPath();
            ctx.moveTo(-15, -5);
            ctx.lineTo(-25 - Math.random() * 10, 0);
            ctx.lineTo(-15, 5);
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.fillText('🚀', -12, 5);
        }
        ctx.restore();
    }
}

// --- BIRD ---

const bird = {
    x: 50,
    y: canvas.height / 2,
    baseRadius: 15,
    radius: 15,
    velocity: 0,
    rotation: 0,
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Shield Aura
        if (birdPowerups.invincible > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 255, 255, ${Math.sin(frames * 0.2) * 0.5 + 0.5})`;
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        // Rainbow Body
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Eye
        const eyeScale = birdPowerups.tiny > 0 ? 0.5 : 1;
        const eyeX = (6 * eyeScale) + Math.cos(frames * 0.5) * 2;
        const eyeY = (-6 * eyeScale) + Math.sin(frames * 0.5) * 2;
        
        ctx.beginPath();
        ctx.fillStyle = 'white';
        ctx.arc(eyeX, eyeY, 8 * eyeScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = 'black';
        ctx.arc(eyeX, eyeY, 3 * eyeScale, 0, Math.PI * 2);
        ctx.fill();
        
        // Wing
        ctx.beginPath();
        ctx.fillStyle = `hsl(${hue + 180}, 70%, 70%)`;
        const wingY = Math.sin(frames * 0.5) * 5;
        ctx.ellipse(-2 * eyeScale, (2 + wingY) * eyeScale, 10 * eyeScale, 6 * eyeScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Beak
        ctx.beginPath();
        ctx.fillStyle = '#f1c40f';
        ctx.moveTo(8 * eyeScale, 2 * eyeScale);
        ctx.lineTo(20 * eyeScale, 6 * eyeScale);
        ctx.lineTo(8 * eyeScale, 10 * eyeScale);
        ctx.fill();
        
        ctx.restore();
    },
    
    update() {
        this.velocity += GRAVITY;
        this.y += this.velocity;
        
        // Update powerup timers
        if (birdPowerups.invincible > 0) birdPowerups.invincible--;
        if (birdPowerups.tiny > 0) {
            birdPowerups.tiny--;
            this.radius = this.baseRadius / 2;
        } else {
            this.radius = this.baseRadius;
        }
        if (birdPowerups.slow > 0) {
            birdPowerups.slow--;
            gameSpeed = 1.5; // Slow mo
        } else {
            // Restore speed gradually or set to base
            // Logic handled in pipe update to allow natural speedup
            if (frames % 60 === 0 && gameSpeed < 5) {
                // Keep base speed logic separate
            }
        }
        
        // Spin
        if (this.velocity < 0) {
            this.rotation = Math.max(-0.6, this.rotation - 0.2);
        } else {
            this.rotation += 0.1;
        }
        
        // Terrain Collision
        const terrainHeight = getTerrainHeightAt(this.x);
        if (this.y + this.radius >= canvas.height - terrainHeight) {
            if (birdPowerups.invincible > 0) {
                this.velocity = -5; // Bounce
                addFloatingText("BOING!", this.x, this.y - 20, 'cyan');
            } else {
                this.y = canvas.height - terrainHeight - this.radius;
                addParticles(this.x, this.y, 20, '#f1c40f');
                gameOver();
            }
        }
        
        // Ceiling
        if (this.y - this.radius <= 0) {
            this.y = this.radius;
            this.velocity = 2;
            shakeIntensity = 5;
            addFloatingText("BONK!", this.x, this.y + 40);
        }
    },
    
    flap() {
        this.velocity = FLAP_STRENGTH;
        this.rotation = -0.5;
        shakeIntensity = 2;
        addParticles(this.x, this.y, 5, 'white');
        
        // Double Jump Glitch
        if (Math.random() < 0.15) {
            this.velocity *= 1.4;
            addFloatingText("ZOOM!", this.x, this.y - 30);
        }
    }
};

// --- SYSTEM FUNCTIONS ---

function getTerrainHeightAt(x) {
    // Find segments
    // terrainPoints are {x, y} relative to game world
    // Since points move left, we need to find points around bird.x
    // Actually terrainPoints contains [y1, y2, ...] mapped to screen X coordinates?
    // No, let's store world coordinates or screen coordinates.
    // Simplest: terrainPoints = [{x: 0, h: 40}, {x: 50, h: 60}...]
    
    for (let i = 0; i < terrainPoints.length - 1; i++) {
        const p1 = terrainPoints[i];
        const p2 = terrainPoints[i+1];
        if (x >= p1.x && x <= p2.x) {
            // Lerp
            const t = (x - p1.x) / (p2.x - p1.x);
            return p1.h + t * (p2.h - p1.h);
        }
    }
    return GROUND_BASE_HEIGHT;
}

function updateTerrain() {
    // Move points left
    terrainPoints.forEach(p => p.x -= gameSpeed);
    
    // Remove old
    if (terrainPoints.length > 0 && terrainPoints[0].x < -50) {
        terrainPoints.shift();
    }
    
    // Add new
    const lastPoint = terrainPoints[terrainPoints.length - 1];
    if (lastPoint.x < canvas.width + 50) {
        const newH = Math.max(20, Math.min(100, lastPoint.h + (Math.random() * 40 - 20)));
        terrainPoints.push({
            x: lastPoint.x + 40, // Segment width
            h: newH
        });
    }
}

function drawTerrain() {
    ctx.fillStyle = `hsl(${hue}, 50%, 50%)`;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    
    if (terrainPoints.length > 0) {
        ctx.lineTo(terrainPoints[0].x, canvas.height - terrainPoints[0].h);
        for (let i = 1; i < terrainPoints.length; i++) {
            ctx.lineTo(terrainPoints[i].x, canvas.height - terrainPoints[i].h);
        }
    }
    
    ctx.lineTo(canvas.width, canvas.height);
    ctx.fill();
    
    // Top border
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 4;
    ctx.stroke();
}

function createPipe() {
    const minPipeHeight = 50;
    const groundH = getTerrainHeightAt(canvas.width); // Approx
    const maxPipeHeight = canvas.height - groundH - PIPE_GAP - minPipeHeight;
    const topHeight = Math.floor(Math.random() * (maxPipeHeight - minPipeHeight + 1)) + minPipeHeight;
    
    const pipeHue = Math.random() * 360;
    
    pipes.push({
        x: canvas.width,
        topHeight: topHeight,
        passed: false,
        hue: pipeHue,
        moving: Math.random() < 0.4,
        moveSpeed: (Math.random() * 2) + 1,
        moveDir: 1
    });

    // Maybe spawn powerup? (25% chance)
    if (Math.random() < 0.25) {
        const types = ['SHIELD', 'TINY', 'SLOW', 'BLAST'];
        const type = types[Math.floor(Math.random() * types.length)];
        const py = topHeight + (PIPE_GAP / 2);
        powerups.push(new Powerup(canvas.width + PIPE_WIDTH/2, py, type));
    }
}

function drawPipes() {
    pipes.forEach(pipe => {
        const pipeColor = `hsl(${pipe.hue}, 60%, 50%)`;
        const borderColor = `hsl(${pipe.hue}, 60%, 30%)`;
        
        ctx.fillStyle = pipeColor;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 3;
        
        // Top
        ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
        ctx.strokeRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
        
        // Bottom
        const bottomPipeY = pipe.topHeight + PIPE_GAP;
        const bottomPipeHeight = canvas.height - bottomPipeY; // Draw past bottom
        
        ctx.fillRect(pipe.x, bottomPipeY, PIPE_WIDTH, bottomPipeHeight);
        ctx.strokeRect(pipe.x, bottomPipeY, PIPE_WIDTH, bottomPipeHeight);
        
        if (pipe.moving) {
            ctx.fillStyle = 'yellow';
            ctx.font = '20px Arial';
            ctx.fillText('⚠️', pipe.x + 15, pipe.topHeight + PIPE_GAP / 2 + 5);
        }
    });
}

function updatePipesAndEntities() {
    // PIPES
    pipes.forEach(pipe => {
        pipe.x -= gameSpeed;
        
        if (pipe.moving) {
            pipe.topHeight += pipe.moveSpeed * pipe.moveDir;
            if (pipe.topHeight < 50 || pipe.topHeight > canvas.height - 150 - PIPE_GAP) {
                pipe.moveDir *= -1;
            }
        }
        
        // Collision
        if (birdPowerups.invincible <= 0) {
            if (bird.x + bird.radius > pipe.x && bird.x - bird.radius < pipe.x + PIPE_WIDTH) {
                if (bird.y - bird.radius < pipe.topHeight || bird.y + bird.radius > pipe.topHeight + PIPE_GAP) {
                    shakeIntensity = 20;
                    addParticles(bird.x, bird.y, 50, 'red');
                    gameOver();
                }
            }
        }

        if (pipe.x + PIPE_WIDTH < bird.x && !pipe.passed) {
            score++;
            scoreElement.textContent = score;
            pipe.passed = true;
            
            const phrases = ["NICE!", "WOW!", "EPIC!", "SICK!", "LUCKY!", "FLOP!"];
            addFloatingText(phrases[Math.floor(Math.random() * phrases.length)], bird.x, bird.y - 50);
            shakeIntensity = 3;
            addParticles(bird.x, 0, 10, 'gold');
            
            if (score % 5 === 0 && birdPowerups.slow <= 0) gameSpeed += 0.2;
            
            // Spawn Enemy chance
            if (Math.random() < 0.3) {
                enemies.push(new Enemy());
            }
        }
    });
    pipes = pipes.filter(p => p.x + PIPE_WIDTH > 0);

    // POWERUPS
    powerups.forEach((p, i) => {
        p.update();
        // Collision
        const dx = bird.x - p.x;
        const dy = bird.y - p.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < bird.radius + p.radius) {
            // Collect
            activatePowerup(p.type);
            powerups.splice(i, 1);
            addParticles(p.x, p.y, 20, 'white');
            addFloatingText(p.type + "!", bird.x, bird.y - 50, 'white');
        }
    });
    powerups = powerups.filter(p => p.x > -50);

    // ENEMIES
    enemies.forEach((e, i) => {
        e.update();
        const dx = bird.x - e.x;
        const dy = bird.y - e.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < bird.radius + e.size) {
            if (birdPowerups.invincible > 0) {
                enemies.splice(i, 1);
                addParticles(e.x, e.y, 20, 'red');
                addFloatingText("SMASH!", bird.x, bird.y, 'red');
                score += 5;
            } else {
                gameOver();
            }
        }
    });
    enemies = enemies.filter(e => e.x > -100);
}

function activatePowerup(type) {
    if (type === 'SHIELD') birdPowerups.invincible = 300; // 5s
    if (type === 'TINY') birdPowerups.tiny = 600; // 10s
    if (type === 'SLOW') birdPowerups.slow = 300; // 5s
    if (type === 'BLAST') {
        pipes.forEach(p => {
            if (p.x < canvas.width) {
                addParticles(p.x + PIPE_WIDTH/2, p.topHeight, 30, 'green');
                // Move them off screen essentially
                p.topHeight = -100; // open gap?
                // Hacky way to clear obstacle: just make gap huge
                p.topHeight = 0;
            }
        });
        shakeIntensity = 30;
        addFloatingText("BOOM!", canvas.width/2, canvas.height/2, 'orange');
    }
}

function addParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color || `hsl(${Math.random() * 360}, 100%, 50%)`));
    }
}

function addFloatingText(text, x, y, color) {
    floatingTexts.push(new FloatingText(text, x, y, color));
}

function resetGame() {
    bird.y = canvas.height / 2;
    bird.velocity = 0;
    bird.rotation = 0;
    pipes = [];
    particles = [];
    floatingTexts = [];
    powerups = [];
    enemies = [];
    
    // Init Terrain
    terrainPoints = [];
    for(let i=0; i<canvas.width + 100; i+=40) {
        terrainPoints.push({x: i, h: GROUND_BASE_HEIGHT});
    }

    score = 0;
    gameSpeed = 2.5;
    scoreElement.textContent = score;
    frames = 0;
    birdPowerups = { invincible: 0, tiny: 0, slow: 0 };
}

function gameOver() {
    gameState = 'GAMEOVER';
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('floppingHighScore', highScore);
        highScoreElement.textContent = `Best: ${highScore}`;
    }
}

// MAIN LOOP
function gameLoop() {
    // Shake
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
    
    // Reset background clear
    // Dynamic BG
    const bgHue = (frames * 0.2) % 360;
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, `hsl(${bgHue}, 30%, 20%)`);
    gradient.addColorStop(1, `hsl(${bgHue + 40}, 30%, 10%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40); // Overdraw for shake

    if (gameState === 'PLAYING') {
        bird.update();
        updateTerrain();
        
        // Spawn Pipes
        // Adjusted rate for speed
        if (frames % Math.floor(PIPE_SPAWN_RATE * (2.5/Math.max(1, gameSpeed))) === 0) {
            createPipe();
        }
        
        updatePipesAndEntities();
        
        // Cleanup Particles
        particles.forEach((p, i) => {
            p.update();
            if (p.life <= 0) particles.splice(i, 1);
        });
        floatingTexts.forEach((t, i) => {
            t.update();
            if (t.life <= 0) floatingTexts.splice(i, 1);
        });
    } else if (gameState === 'START') {
        // Init terrain for visual
        if (terrainPoints.length === 0) resetGame(); 
        updateTerrain(); // Scroll background even in start
    }
    
    // Draw grid
    ctx.strokeStyle = `hsla(${bgHue}, 100%, 50%, 0.1)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const gridSize = 40;
    const offset = (frames * gameSpeed) % gridSize;
    for (let x = -offset; x < canvas.width; x += gridSize) {
        ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
    }
    ctx.stroke();

    // Draw Entities
    powerups.forEach(p => p.draw());
    enemies.forEach(e => e.draw());
    particles.forEach(p => p.draw());
    drawPipes();
    drawTerrain();
    bird.draw();
    floatingTexts.forEach(t => t.draw());
    
    ctx.restore();
    
    // UI
    if (gameState === 'START') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = `hsl(${hue}, 100%, 70%)`;
        ctx.font = 'bold 40px Impact';
        ctx.textAlign = 'center';
        ctx.fillText('FLOPPING BIRD', canvas.width / 2, canvas.height / 2 - 40);
        ctx.fillStyle = 'white';
        ctx.font = '20px monospace';
        ctx.fillText('ULTIMATE CHAOS', canvas.width / 2, canvas.height / 2);
        ctx.fillText('Tap / Space to Flop', canvas.width / 2, canvas.height / 2 + 40);
        ctx.font = '14px monospace';
        ctx.fillText('Collect 🛡️ 🦐 ⏰ 💣', canvas.width / 2, canvas.height / 2 + 70);
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
            if (shakeIntensity < 1) {
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
