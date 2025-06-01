import pygame
import random
import sys
import os
from pygame import mixer

# Initialize Pygame
pygame.init()
mixer.init()

# Constants
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
GRID_SIZE = 30
GRID_WIDTH = 10
GRID_HEIGHT = 20
SIDEBAR_WIDTH = 200

# Calculate play area position to center it
PLAY_AREA_X = (SCREEN_WIDTH - SIDEBAR_WIDTH - GRID_WIDTH * GRID_SIZE) // 2
PLAY_AREA_Y = (SCREEN_HEIGHT - GRID_HEIGHT * GRID_SIZE) // 2

# Colors - Kid-friendly bright colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
GRAY = (128, 128, 128)
RED = (255, 60, 60)
GREEN = (60, 255, 60)
BLUE = (60, 60, 255)
YELLOW = (255, 255, 60)
PURPLE = (255, 60, 255)
CYAN = (60, 255, 255)
ORANGE = (255, 165, 0)

COLORS = [RED, GREEN, BLUE, YELLOW, PURPLE, CYAN, ORANGE]

# Tetromino shapes
SHAPES = [
    [[1, 1, 1, 1]],  # I
    [[1, 1], [1, 1]],  # O
    [[1, 1, 1], [0, 1, 0]],  # T
    [[1, 1, 1], [1, 0, 0]],  # L
    [[1, 1, 1], [0, 0, 1]],  # J
    [[1, 1, 0], [0, 1, 1]],  # Z
    [[0, 1, 1], [1, 1, 0]]   # S
]

# Set up the screen
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("Kid-Friendly Tetris")

# Set up fonts
title_font = pygame.font.Font(None, 48)
font = pygame.font.Font(None, 36)
small_font = pygame.font.Font(None, 24)

# Game variables
clock = pygame.time.Clock()
FPS = 60
fall_speed = 0.5  # Blocks fall every 0.5 seconds
fall_time = 0
score = 0
level = 1
lines_cleared = 0

# Create game grid (0 = empty, 1-7 = block colors)
grid = [[0 for _ in range(GRID_WIDTH)] for _ in range(GRID_HEIGHT)]

class Tetromino:
    def __init__(self):
        self.shape_index = random.randint(0, len(SHAPES) - 1)
        self.shape = SHAPES[self.shape_index]
        self.color = COLORS[self.shape_index]
        self.x = GRID_WIDTH // 2 - len(self.shape[0]) // 2
        self.y = 0
        
    def rotate(self):
        # Transpose the shape matrix to rotate it
        rotated_shape = [[self.shape[j][i] for j in range(len(self.shape))] 
                         for i in range(len(self.shape[0]) - 1, -1, -1)]
        
        # Check if rotation is valid
        if not self.collision(0, 0, rotated_shape):
            self.shape = rotated_shape
    
    def collision(self, dx=0, dy=0, shape=None):
        if shape is None:
            shape = self.shape
            
        for y, row in enumerate(shape):
            for x, cell in enumerate(row):
                if cell:
                    new_x, new_y = self.x + x + dx, self.y + y + dy
                    
                    # Check if out of bounds or colliding with placed blocks
                    if (new_x < 0 or new_x >= GRID_WIDTH or 
                        new_y >= GRID_HEIGHT or 
                        (new_y >= 0 and grid[new_y][new_x])):
                        return True
        return False
    
    def move(self, dx, dy):
        if not self.collision(dx, dy):
            self.x += dx
            self.y += dy
            return True
        return False
    
    def place(self):
        for y, row in enumerate(self.shape):
            for x, cell in enumerate(row):
                if cell and self.y + y >= 0:
                    grid[self.y + y][self.x + x] = self.shape_index + 1
    
    def draw(self):
        for y, row in enumerate(self.shape):
            for x, cell in enumerate(row):
                if cell:
                    pygame.draw.rect(
                        screen, 
                        self.color, 
                        (PLAY_AREA_X + (self.x + x) * GRID_SIZE, 
                         PLAY_AREA_Y + (self.y + y) * GRID_SIZE, 
                         GRID_SIZE - 1, 
                         GRID_SIZE - 1)
                    )

def draw_grid():
    # Draw the grid background
    pygame.draw.rect(
        screen, 
        GRAY, 
        (PLAY_AREA_X - 2, PLAY_AREA_Y - 2, 
         GRID_WIDTH * GRID_SIZE + 4, 
         GRID_HEIGHT * GRID_SIZE + 4), 
        2
    )
    
    # Draw placed blocks
    for y in range(GRID_HEIGHT):
        for x in range(GRID_WIDTH):
            if grid[y][x]:
                color_index = grid[y][x] - 1
                pygame.draw.rect(
                    screen, 
                    COLORS[color_index], 
                    (PLAY_AREA_X + x * GRID_SIZE, 
                     PLAY_AREA_Y + y * GRID_SIZE, 
                     GRID_SIZE - 1, 
                     GRID_SIZE - 1)
                )

def draw_sidebar():
    # Draw sidebar background
    pygame.draw.rect(
        screen, 
        (240, 240, 240), 
        (SCREEN_WIDTH - SIDEBAR_WIDTH, 0, SIDEBAR_WIDTH, SCREEN_HEIGHT)
    )
    
    # Draw score and level
    score_text = font.render(f"Score: {score}", True, BLACK)
    level_text = font.render(f"Level: {level}", True, BLACK)
    lines_text = font.render(f"Lines: {lines_cleared}", True, BLACK)
    
    screen.blit(score_text, (SCREEN_WIDTH - SIDEBAR_WIDTH + 20, 100))
    screen.blit(level_text, (SCREEN_WIDTH - SIDEBAR_WIDTH + 20, 150))
    screen.blit(lines_text, (SCREEN_WIDTH - SIDEBAR_WIDTH + 20, 200))
    
    # Draw controls help
    controls = [
        "Controls:",
        "← → : Move",
        "↑ : Rotate",
        "↓ : Move Down",
        "Space : Drop",
        "P : Pause",
        "Q : Quit"
    ]
    
    for i, text in enumerate(controls):
        control_text = small_font.render(text, True, BLACK)
        screen.blit(control_text, (SCREEN_WIDTH - SIDEBAR_WIDTH + 20, 300 + i * 30))

def check_lines():
    global grid, score, level, lines_cleared, fall_speed
    
    lines_to_clear = []
    for y in range(GRID_HEIGHT):
        if all(grid[y]):
            lines_to_clear.append(y)
    
    if lines_to_clear:
        # Update score (more points for clearing multiple lines at once)
        line_count = len(lines_to_clear)
        score += line_count * line_count * 100 * level
        lines_cleared += line_count
        
        # Update level and speed
        level = lines_cleared // 10 + 1
        fall_speed = max(0.05, 0.5 - (level - 1) * 0.05)
        
        # Clear the lines
        for line in lines_to_clear:
            del grid[line]
            grid.insert(0, [0 for _ in range(GRID_WIDTH)])

def draw_game_over():
    overlay = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)
    overlay.fill((0, 0, 0, 128))
    screen.blit(overlay, (0, 0))
    
    game_over_text = title_font.render("Game Over!", True, WHITE)
    score_text = font.render(f"Final Score: {score}", True, WHITE)
    restart_text = font.render("Press R to Restart", True, WHITE)
    
    screen.blit(game_over_text, (SCREEN_WIDTH // 2 - game_over_text.get_width() // 2, SCREEN_HEIGHT // 2 - 60))
    screen.blit(score_text, (SCREEN_WIDTH // 2 - score_text.get_width() // 2, SCREEN_HEIGHT // 2))
    screen.blit(restart_text, (SCREEN_WIDTH // 2 - restart_text.get_width() // 2, SCREEN_HEIGHT // 2 + 60))

def reset_game():
    global grid, score, level, lines_cleared, fall_speed, current_tetromino, next_tetromino, game_over
    
    grid = [[0 for _ in range(GRID_WIDTH)] for _ in range(GRID_HEIGHT)]
    score = 0
    level = 1
    lines_cleared = 0
    fall_speed = 0.5
    current_tetromino = Tetromino()
    next_tetromino = Tetromino()
    game_over = False

def draw_next_tetromino():
    # Draw "Next" label
    next_text = font.render("Next:", True, BLACK)
    screen.blit(next_text, (SCREEN_WIDTH - SIDEBAR_WIDTH + 20, 400))
    
    # Calculate position to center the next tetromino preview
    next_x = SCREEN_WIDTH - SIDEBAR_WIDTH + 60
    next_y = 450
    
    # Draw the next tetromino
    for y, row in enumerate(next_tetromino.shape):
        for x, cell in enumerate(row):
            if cell:
                pygame.draw.rect(
                    screen, 
                    next_tetromino.color, 
                    (next_x + x * GRID_SIZE, 
                     next_y + y * GRID_SIZE, 
                     GRID_SIZE - 1, 
                     GRID_SIZE - 1)
                )

# Initialize game
current_tetromino = Tetromino()
next_tetromino = Tetromino()
game_over = False
paused = False

# Main game loop
running = True
while running:
    # Handle events
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
            
        if not game_over and not paused:
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_LEFT:
                    current_tetromino.move(-1, 0)
                elif event.key == pygame.K_RIGHT:
                    current_tetromino.move(1, 0)
                elif event.key == pygame.K_DOWN:
                    current_tetromino.move(0, 1)
                elif event.key == pygame.K_UP:
                    current_tetromino.rotate()
                elif event.key == pygame.K_SPACE:
                    # Hard drop
                    while current_tetromino.move(0, 1):
                        pass
                    
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_p:
                paused = not paused
            elif event.key == pygame.K_q:
                running = False
            elif event.key == pygame.K_r and game_over:
                reset_game()
    
    # Fill background
    screen.fill((230, 230, 250))  # Light lavender background
    
    # Draw title
    title = title_font.render("Kid-Friendly Tetris", True, (70, 70, 180))
    screen.blit(title, (SCREEN_WIDTH // 2 - title.get_width() // 2, 20))
    
    # Draw grid and sidebar
    draw_grid()
    draw_sidebar()
    draw_next_tetromino()
    
    if not game_over and not paused:
        # Update fall time
        fall_time += clock.get_rawtime() / 1000
        
        # Move tetromino down if it's time
        if fall_time >= fall_speed:
            fall_time = 0
            if not current_tetromino.move(0, 1):
                # If can't move down, place the tetromino
                current_tetromino.place()
                check_lines()
                
                # Create new tetromino
                current_tetromino = next_tetromino
                next_tetromino = Tetromino()
                
                # Check for game over
                if current_tetromino.collision():
                    game_over = True
        
        # Draw current tetromino
        current_tetromino.draw()
    
    # Draw pause or game over overlay
    if paused:
        overlay = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 128))
        screen.blit(overlay, (0, 0))
        
        pause_text = title_font.render("PAUSED", True, WHITE)
        continue_text = font.render("Press P to Continue", True, WHITE)
        
        screen.blit(pause_text, (SCREEN_WIDTH // 2 - pause_text.get_width() // 2, SCREEN_HEIGHT // 2 - 30))
        screen.blit(continue_text, (SCREEN_WIDTH // 2 - continue_text.get_width() // 2, SCREEN_HEIGHT // 2 + 30))
    
    if game_over:
        draw_game_over()
    
    # Update display
    pygame.display.flip()
    
    # Cap the frame rate
    clock.tick(FPS)

# Quit pygame
pygame.quit()
sys.exit()
