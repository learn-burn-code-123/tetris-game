// Kid-Friendly Tetris Game
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on a mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Adjust game parameters for mobile if needed
    if (isMobile) {
        // Prevent scrolling when touching the game area
        document.body.addEventListener('touchmove', function(e) {
            if (e.target.closest('#tetris-canvas') || e.target.closest('.mobile-controls')) {
                e.preventDefault();
            }
        }, { passive: false });
        
        // Prevent zooming on double tap
        let lastTouchEnd = 0;
        document.addEventListener('touchend', function(e) {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
    }
    // Canvas setup
    const canvas = document.getElementById('tetris-canvas');
    const ctx = canvas.getContext('2d');
    const nextPieceCanvas = document.getElementById('next-piece-canvas');
    const nextPieceCtx = nextPieceCanvas.getContext('2d');
    
    // Game constants
    const GRID_SIZE = 30;
    const GRID_WIDTH = 10;
    const GRID_HEIGHT = 20;
    const NEXT_GRID_SIZE = 30;
    
    // Kid-friendly colors - bright and vibrant
    const COLORS = [
        '#FF5252', // Red
        '#4CAF50', // Green
        '#2196F3', // Blue
        '#FFEB3B', // Yellow
        '#9C27B0', // Purple
        '#00BCD4', // Cyan
        '#FF9800'  // Orange
    ];
    
    // Tetromino shapes
    const SHAPES = [
        [[1, 1, 1, 1]],                  // I
        [[1, 1], [1, 1]],                // O
        [[1, 1, 1], [0, 1, 0]],          // T
        [[1, 1, 1], [1, 0, 0]],          // L
        [[1, 1, 1], [0, 0, 1]],          // J
        [[1, 1, 0], [0, 1, 1]],          // Z
        [[0, 1, 1], [1, 1, 0]]           // S
    ];
    
    // Game variables
    let grid = Array.from({ length: GRID_HEIGHT }, () => Array(GRID_WIDTH).fill(0));
    let score = 0;
    let level = 1;
    let lines = 0;
    let gameOver = false;
    let paused = false;
    let dropInterval = 1000; // Start with 1 second drop interval
    let lastDropTime = 0;
    let currentPiece = null;
    let nextPiece = null;
    let animationId = null;
    
    // DOM elements
    const scoreElement = document.getElementById('score');
    const levelElement = document.getElementById('level');
    const linesElement = document.getElementById('lines');
    const finalScoreElement = document.getElementById('final-score');
    const gameOverOverlay = document.getElementById('game-over-overlay');
    const pauseOverlay = document.getElementById('pause-overlay');
    const restartButton = document.getElementById('restart-button');
    
    // Sound effects (placeholder - would be implemented with actual audio files)
    const sounds = {
        move: () => playSound('move'),
        rotate: () => playSound('rotate'),
        drop: () => playSound('drop'),
        lineClear: () => playSound('clear'),
        gameOver: () => playSound('gameover')
    };
    
    function playSound(type) {
        // Placeholder for sound implementation
        console.log(`Playing sound: ${type}`);
        // In a real implementation, you would play actual sound files here
    }
    
    // Tetromino class
    class Tetromino {
        constructor(shape = null, color = null) {
            if (shape && color) {
                this.shape = shape;
                this.color = color;
            } else {
                const index = Math.floor(Math.random() * SHAPES.length);
                this.shape = JSON.parse(JSON.stringify(SHAPES[index])); // Deep copy
                this.color = COLORS[index];
            }
            
            // Start position (centered at top)
            this.x = Math.floor((GRID_WIDTH - this.shape[0].length) / 2);
            this.y = 0;
        }
        
        // Draw the tetromino on the main canvas
        draw() {
            ctx.fillStyle = this.color;
            
            for (let y = 0; y < this.shape.length; y++) {
                for (let x = 0; x < this.shape[y].length; x++) {
                    if (this.shape[y][x]) {
                        drawBlock(ctx, this.x + x, this.y + y, this.color);
                    }
                }
            }
        }
        
        // Draw the next piece preview
        drawNext() {
            nextPieceCtx.clearRect(0, 0, nextPieceCanvas.width, nextPieceCanvas.height);
            nextPieceCtx.fillStyle = this.color;
            
            // Center the piece in the next piece canvas
            const offsetX = (nextPieceCanvas.width / NEXT_GRID_SIZE - this.shape[0].length) / 2;
            const offsetY = (nextPieceCanvas.height / NEXT_GRID_SIZE - this.shape.length) / 2;
            
            for (let y = 0; y < this.shape.length; y++) {
                for (let x = 0; x < this.shape[y].length; x++) {
                    if (this.shape[y][x]) {
                        drawBlock(nextPieceCtx, offsetX + x, offsetY + y, this.color);
                    }
                }
            }
        }
        
        // Move the tetromino
        move(dx, dy) {
            if (!this.collision(dx, dy)) {
                this.x += dx;
                this.y += dy;
                return true;
            }
            return false;
        }
        
        // Rotate the tetromino
        rotate() {
            const originalShape = JSON.parse(JSON.stringify(this.shape)); // Deep copy
            
            // Transpose and reverse to rotate 90 degrees clockwise
            const rotated = [];
            for (let i = 0; i < originalShape[0].length; i++) {
                rotated.push([]);
                for (let j = originalShape.length - 1; j >= 0; j--) {
                    rotated[i].push(originalShape[j][i]);
                }
            }
            
            // Check if rotation is valid
            const originalX = this.x;
            const originalY = this.y;
            this.shape = rotated;
            
            // Wall kicks - try to adjust position if rotation causes collision
            const kicks = [0, 1, -1, 2, -2]; // Possible x-offsets to try
            
            let validRotation = false;
            for (const kick of kicks) {
                if (!this.collision(kick, 0)) {
                    this.x += kick;
                    validRotation = true;
                    sounds.rotate();
                    break;
                }
            }
            
            // If no valid position found, revert rotation
            if (!validRotation) {
                this.shape = originalShape;
                this.x = originalX;
                this.y = originalY;
            }
        }
        
        // Check for collisions
        collision(dx = 0, dy = 0) {
            for (let y = 0; y < this.shape.length; y++) {
                for (let x = 0; x < this.shape[y].length; x++) {
                    if (this.shape[y][x]) {
                        const newX = this.x + x + dx;
                        const newY = this.y + y + dy;
                        
                        // Check boundaries
                        if (newX < 0 || newX >= GRID_WIDTH || newY >= GRID_HEIGHT) {
                            return true;
                        }
                        
                        // Check collision with placed blocks (but ignore if above the grid)
                        if (newY >= 0 && grid[newY][newX]) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }
        
        // Lock the piece in place
        lock() {
            for (let y = 0; y < this.shape.length; y++) {
                for (let x = 0; x < this.shape[y].length; x++) {
                    if (this.shape[y][x]) {
                        const gridY = this.y + y;
                        // Only place blocks that are within the grid
                        if (gridY >= 0) {
                            grid[gridY][this.x + x] = this.color;
                        }
                    }
                }
            }
            sounds.drop();
        }
    }
    
    // Helper function to draw a single block
    function drawBlock(context, x, y, color) {
        const blockSize = context === ctx ? GRID_SIZE : NEXT_GRID_SIZE;
        
        // Main block
        context.fillStyle = color;
        context.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);
        
        // Highlight (lighter shade)
        context.fillStyle = lightenColor(color, 30);
        context.fillRect(x * blockSize, y * blockSize, blockSize, blockSize / 5);
        context.fillRect(x * blockSize, y * blockSize, blockSize / 5, blockSize);
        
        // Shadow (darker shade)
        context.fillStyle = darkenColor(color, 30);
        context.fillRect(x * blockSize + blockSize - blockSize / 5, y * blockSize, blockSize / 5, blockSize);
        context.fillRect(x * blockSize, y * blockSize + blockSize - blockSize / 5, blockSize, blockSize / 5);
        
        // Border
        context.strokeStyle = darkenColor(color, 50);
        context.strokeRect(x * blockSize, y * blockSize, blockSize, blockSize);
    }
    
    // Helper functions to lighten/darken colors
    function lightenColor(color, percent) {
        const num = parseInt(color.slice(1), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
    }
    
    function darkenColor(color, percent) {
        const num = parseInt(color.slice(1), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max(0, (num >> 16) - amt);
        const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
        const B = Math.max(0, (num & 0x0000FF) - amt);
        return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
    }
    
    // Draw the grid and placed blocks
    function drawGrid() {
        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid background
        ctx.fillStyle = '#f8f8f8';
        ctx.fillRect(0, 0, GRID_WIDTH * GRID_SIZE, GRID_HEIGHT * GRID_SIZE);
        
        // Draw grid lines
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5;
        
        // Vertical lines
        for (let x = 0; x <= GRID_WIDTH; x++) {
            ctx.beginPath();
            ctx.moveTo(x * GRID_SIZE, 0);
            ctx.lineTo(x * GRID_SIZE, GRID_HEIGHT * GRID_SIZE);
            ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y <= GRID_HEIGHT; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * GRID_SIZE);
            ctx.lineTo(GRID_WIDTH * GRID_SIZE, y * GRID_SIZE);
            ctx.stroke();
        }
        
        // Draw placed blocks
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                if (grid[y][x]) {
                    drawBlock(ctx, x, y, grid[y][x]);
                }
            }
        }
    }
    
    // Check for completed lines
    function checkLines() {
        let linesCleared = 0;
        
        for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
            // Check if line is full
            if (grid[y].every(cell => cell !== 0)) {
                // Remove the line
                grid.splice(y, 1);
                // Add empty line at the top
                grid.unshift(Array(GRID_WIDTH).fill(0));
                // Move the check position up since we removed a line
                y++;
                linesCleared++;
            }
        }
        
        if (linesCleared > 0) {
            // Update score and level
            updateScore(linesCleared);
            sounds.lineClear();
        }
    }
    
    // Update score based on lines cleared
    function updateScore(linesCleared) {
        // Score calculation - more points for clearing multiple lines at once
        const points = [0, 100, 300, 500, 800];
        score += points[linesCleared] * level;
        
        // Update lines and level
        lines += linesCleared;
        level = Math.floor(lines / 10) + 1;
        
        // Update drop speed based on level
        dropInterval = Math.max(100, 1000 - (level - 1) * 100);
        
        // Update display
        scoreElement.textContent = score;
        levelElement.textContent = level;
        linesElement.textContent = lines;
    }
    
    // Game loop
    function gameLoop(timestamp) {
        if (gameOver || paused) {
            return;
        }
        
        // Handle automatic dropping
        if (timestamp - lastDropTime > dropInterval) {
            dropPiece();
            lastDropTime = timestamp;
        }
        
        // Draw everything
        drawGrid();
        if (currentPiece) {
            currentPiece.draw();
        }
        
        animationId = requestAnimationFrame(gameLoop);
    }
    
    // Drop the current piece one row
    function dropPiece() {
        if (!currentPiece.move(0, 1)) {
            // If can't move down, lock the piece and generate a new one
            currentPiece.lock();
            checkLines();
            
            // Create new piece
            currentPiece = nextPiece;
            nextPiece = new Tetromino();
            nextPiece.drawNext();
            
            // Check for game over
            if (currentPiece.collision(0, 0)) {
                endGame();
            }
        }
    }
    
    // Hard drop - drop piece all the way down
    function hardDrop() {
        while (currentPiece.move(0, 1)) {
            // Keep moving down until collision
        }
        dropPiece(); // Lock the piece and generate new one
    }
    
    // End the game
    function endGame() {
        gameOver = true;
        cancelAnimationFrame(animationId);
        finalScoreElement.textContent = score;
        gameOverOverlay.style.display = 'flex';
        sounds.gameOver();
    }
    
    // Reset the game
    function resetGame() {
        // Reset game variables
        grid = Array.from({ length: GRID_HEIGHT }, () => Array(GRID_WIDTH).fill(0));
        score = 0;
        level = 1;
        lines = 0;
        dropInterval = 1000;
        gameOver = false;
        
        // Update display
        scoreElement.textContent = score;
        levelElement.textContent = level;
        linesElement.textContent = lines;
        
        // Hide overlays
        gameOverOverlay.style.display = 'none';
        pauseOverlay.style.display = 'none';
        
        // Create new pieces
        currentPiece = new Tetromino();
        nextPiece = new Tetromino();
        nextPiece.drawNext();
        
        // Start game loop
        lastDropTime = performance.now();
        animationId = requestAnimationFrame(gameLoop);
    }
    
    // Toggle pause
    function togglePause() {
        paused = !paused;
        
        if (paused) {
            cancelAnimationFrame(animationId);
            pauseOverlay.style.display = 'flex';
        } else {
            pauseOverlay.style.display = 'none';
            lastDropTime = performance.now();
            animationId = requestAnimationFrame(gameLoop);
        }
        
        // Update pause button text if it exists
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.textContent = paused ? 'Resume' : 'Pause';
        }
    }
    
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        if (gameOver) {
            if (e.key === 'r' || e.key === 'R') {
                resetGame();
            }
            return;
        }
        
        if (e.key === 'p' || e.key === 'P') {
            togglePause();
            return;
        }
        
        if (paused) {
            return;
        }
        
        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault(); // Prevent default browser scrolling
                if (currentPiece.move(-1, 0)) {
                    sounds.move();
                }
                break;
            case 'ArrowRight':
                e.preventDefault(); // Prevent default browser scrolling
                if (currentPiece.move(1, 0)) {
                    sounds.move();
                }
                break;
            case 'ArrowDown':
                e.preventDefault(); // Prevent default browser scrolling
                if (currentPiece.move(0, 1)) {
                    sounds.move();
                }
                lastDropTime = performance.now();
                break;
            case 'ArrowUp':
                e.preventDefault(); // Prevent default browser scrolling
                currentPiece.rotate();
                break;
            case ' ':
                e.preventDefault(); // Prevent default browser scrolling
                hardDrop();
                break;
            case 'r':
            case 'R':
                if (gameOver) {
                    resetGame();
                }
                break;
        }
    });
    
    // Button controls
    restartButton.addEventListener('click', resetGame);
    
    // Touch controls for mobile devices
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    
    // Improved touch controls with better sensitivity
    document.addEventListener('touchstart', (e) => {
        // Only track touches on the game canvas
        if (e.target.closest('#tetris-canvas')) {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
            e.preventDefault(); // Prevent default to avoid unwanted behaviors
        }
    }, { passive: false });
    
    document.addEventListener('touchend', (e) => {
        // Only process touches that started on the game canvas
        if (!e.target.closest('#tetris-canvas') || gameOver || paused) return;
        
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;
        const swipeThreshold = 30; // Lower threshold for more responsive controls
        
        // Only process if it's a significant movement (not just a tap)
        if (Math.abs(diffX) > swipeThreshold || Math.abs(diffY) > swipeThreshold) {
            // Detect swipe direction - prioritize the direction with larger movement
            if (Math.abs(diffX) > Math.abs(diffY)) {
                // Horizontal swipe
                if (diffX > 0) {
                    // Right swipe
                    if (currentPiece.move(1, 0)) {
                        sounds.move();
                    }
                } else {
                    // Left swipe
                    if (currentPiece.move(-1, 0)) {
                        sounds.move();
                    }
                }
            } else {
                // Vertical swipe
                if (diffY > 0) {
                    // Down swipe
                    if (currentPiece.move(0, 1)) {
                        sounds.move();
                    }
                    lastDropTime = performance.now();
                } else {
                    // Up swipe (rotate)
                    currentPiece.rotate();
                }
            }
        }
        
        // Prevent default behavior like scrolling
        e.preventDefault();
    }, { passive: false });
    
    // Handle orientation changes
    window.addEventListener('orientationchange', () => {
        // Give the browser time to update dimensions
        setTimeout(() => {
            // Adjust canvas size if needed
            if (window.innerWidth < 360) {
                canvas.width = 240;
                canvas.height = 480;
            } else if (window.innerWidth < 768) {
                canvas.width = 280;
                canvas.height = 560;
            } else {
                canvas.width = 300;
                canvas.height = 600;
            }
            
            // Redraw everything
            drawGrid();
            if (currentPiece) {
                currentPiece.draw();
            }
            if (nextPiece) {
                nextPiece.drawNext();
            }
        }, 300);
    }, false);
    
    // Double tap for hard drop
    let lastTap = 0;
    document.addEventListener('touchend', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        
        if (tapLength < 300 && tapLength > 0) {
            // Double tap detected
            if (!gameOver && !paused) {
                hardDrop();
                e.preventDefault();
            }
        }
        
        lastTap = currentTime;
    }, false);
    
    // On-screen button controls
    const leftBtn = document.getElementById('left-btn');
    const rightBtn = document.getElementById('right-btn');
    const downBtn = document.getElementById('down-btn');
    const rotateBtn = document.getElementById('rotate-btn');
    const dropBtn = document.getElementById('drop-btn');
    const pauseBtn = document.getElementById('pause-btn');
    
    // Prevent default button behavior to avoid unwanted actions
    const preventDefaultForButtons = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };
    
    if (leftBtn) {
        // Use touchstart for more responsive mobile controls
        leftBtn.addEventListener('touchstart', (e) => {
            preventDefaultForButtons(e);
            if (!gameOver && !paused && currentPiece.move(-1, 0)) {
                sounds.move();
            }
        }, { passive: false });
        
        // Keep click for desktop testing
        leftBtn.addEventListener('click', (e) => {
            preventDefaultForButtons(e);
            if (!gameOver && !paused && currentPiece.move(-1, 0)) {
                sounds.move();
            }
        });
    }
    
    if (rightBtn) {
        // Use touchstart for more responsive mobile controls
        rightBtn.addEventListener('touchstart', (e) => {
            preventDefaultForButtons(e);
            if (!gameOver && !paused && currentPiece.move(1, 0)) {
                sounds.move();
            }
        }, { passive: false });
        
        // Keep click for desktop testing
        rightBtn.addEventListener('click', (e) => {
            preventDefaultForButtons(e);
            if (!gameOver && !paused && currentPiece.move(1, 0)) {
                sounds.move();
            }
        });
    }
    
    if (downBtn) {
        // For down button, we'll accelerate the drop speed temporarily
        let downButtonPressed = false;
        let originalDropInterval = dropInterval;
        
        // Speed up when button is pressed
        downBtn.addEventListener('touchstart', (e) => {
            preventDefaultForButtons(e);
            if (!gameOver && !paused) {
                downButtonPressed = true;
                // Save original interval if not already saved
                originalDropInterval = dropInterval;
                // Make the piece fall much faster
                dropInterval = 50; // Very fast drop speed
                lastDropTime = performance.now();
            }
        }, { passive: false });
        
        // Return to normal speed when button is released
        downBtn.addEventListener('touchend', (e) => {
            preventDefaultForButtons(e);
            if (!gameOver && !paused) {
                downButtonPressed = false;
                // Restore original drop speed
                dropInterval = originalDropInterval;
            }
        }, { passive: false });
        
        // For click events (desktop testing)
        downBtn.addEventListener('mousedown', (e) => {
            preventDefaultForButtons(e);
            if (!gameOver && !paused) {
                downButtonPressed = true;
                originalDropInterval = dropInterval;
                dropInterval = 50;
                lastDropTime = performance.now();
            }
        });
        
        downBtn.addEventListener('mouseup', (e) => {
            preventDefaultForButtons(e);
            if (!gameOver && !paused) {
                downButtonPressed = false;
                dropInterval = originalDropInterval;
            }
        });
    }
    
    if (rotateBtn) {
        // Use touchstart for more responsive mobile controls
        rotateBtn.addEventListener('touchstart', (e) => {
            preventDefaultForButtons(e);
            if (!gameOver && !paused) {
                currentPiece.rotate();
                sounds.rotate();
            }
        }, { passive: false });
        
        // Keep click for desktop testing
        rotateBtn.addEventListener('click', (e) => {
            preventDefaultForButtons(e);
            if (!gameOver && !paused) {
                currentPiece.rotate();
                sounds.rotate();
            }
        });
    }
    
    if (dropBtn) {
        // Use touchstart for more responsive mobile controls
        dropBtn.addEventListener('touchstart', (e) => {
            preventDefaultForButtons(e);
            if (!gameOver && !paused) {
                hardDrop();
            }
        }, { passive: false });
        
        // Keep click for desktop testing
        dropBtn.addEventListener('click', (e) => {
            preventDefaultForButtons(e);
            if (!gameOver && !paused) {
                hardDrop();
            }
        });
    }
    
    if (pauseBtn) {
        // Use touchstart for more responsive mobile controls
        pauseBtn.addEventListener('touchstart', (e) => {
            preventDefaultForButtons(e);
            togglePause();
            // Update button text based on game state
            pauseBtn.textContent = paused ? 'Resume' : 'Pause';
        }, { passive: false });
        
        // Keep click for desktop testing
        pauseBtn.addEventListener('click', (e) => {
            preventDefaultForButtons(e);
            togglePause();
            // Update button text based on game state
            pauseBtn.textContent = paused ? 'Resume' : 'Pause';
        });
    }
    
    // Initialize game
    function init() {
        // Create initial pieces
        currentPiece = new Tetromino();
        nextPiece = new Tetromino();
        nextPiece.drawNext();
        
        // Start game loop
        lastDropTime = performance.now();
        animationId = requestAnimationFrame(gameLoop);
    }
    
    // Start the game
    init();
});
