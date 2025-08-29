class HSBCTowerBlock {
  constructor() {
    this.canvas = document.getElementById("game");
    this.ctx = this.canvas.getContext("2d");
    
    // Canvas dimensions (logical, not device pixels)
    this.canvasWidth = 0;
    this.canvasHeight = 0;
    
    this.startButton = document.getElementById("start-button");
    this.restartButton = document.getElementById("restart-button");
    this.scoreElement = document.getElementById("score");
    this.levelElement = document.getElementById("level");
    this.highScoreElement = document.getElementById("high-score");
    this.gameOverElement = document.getElementById("game-over");
    this.finalScoreElement = document.getElementById("final-score");
    this.finalHighScoreElement = document.getElementById("final-high-score");

    // Game configuration
    this.blockWidth = 100;
    this.blockHeight = 40;
    this.blockSpeed = 3; // Slightly slower for easier gameplay
    this.snapThreshold = 10; // New property for snapping blocks within this pixel range
    this.towerHeight = 0;
    this.perfectBonus = 10;
    this.combo = 0;
    this.maxCombo = 0;
    this.currentLevel = 1;
    this.blocks = [];
    this.movingBlock = null;
    this.lastBlockTime = 0;
    this.animationId = null;
    this.gameOver = false;
    this.score = 0;
    this.highScore = localStorage.getItem("hsbcTowerHighScore") || 0;
    this.gravity = 0.5;
    this.fallingBlocks = [];
    this.particles = [];
    this.cameraY = 0;
    this.shakeMagnitude = 0;

    // HSBC Tower specific
    this.primaryColor = "#db0011"; // HSBC red
    this.secondaryColor = "#ffffff"; // White
    this.accentColor = "#000000"; // Black
    this.glassColor = "rgba(135, 206, 235, 0.6)"; // Light blue glass
    this.metallicColor = "#A0A0A0"; // Metallic silver

    // Special effects
    this.nightMode = true;
    this.stars = this.createStars(100);
    this.cityBuildings = []; // Remove city buildings
    this.lightFlickers = [];

    this.logoImage = new Image();
    this.logoImage.src = "HSBC-Logo.png";
    
    // For SVG support, uncomment these lines and comment out the PNG lines above:
    // this.logoSVG = null;
    // this.loadSVGLogo();

    this.bindEvents();
    this.resize();
    this.updateHighScore();
    window.addEventListener("resize", () => this.resize());
  }

  // Method to load SVG logo for sharp rendering
  async loadSVGLogo() {
    try {
      const response = await fetch('HSBC-Logo.svg');
      const svgText = await response.text();
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
      this.logoSVG = svgDoc.documentElement;
      
      // Create a high-resolution version for sharp rendering
      const dpr = window.devicePixelRatio || 1;
      const svgBlob = new Blob([svgText], {type: 'image/svg+xml'});
      const url = URL.createObjectURL(svgBlob);
      
      this.logoImage = new Image();
      this.logoImage.onload = () => URL.revokeObjectURL(url);
      // Set the image size explicitly for high DPI
      this.logoImage.width = 200 * dpr;
      this.logoImage.height = 200 * dpr;
      this.logoImage.src = url;
    } catch (error) {
      console.warn('Could not load SVG logo, falling back to PNG');
    }
  }

  // Alternative method to draw SVG as crisp vector graphics
  drawCrispLogo(block) {
    if (!block.hasLogo) return;
    
    const logoWidth = this.blockWidth * 0.8;
    const logoHeight = logoWidth * (this.logoImage.height / this.logoImage.width);
    const logoX = Math.round(block.x + (block.width - logoWidth) / 2);
    const logoY = Math.round(block.y + (block.height - logoHeight) / 2);
    
    // Save current context settings
    this.ctx.save();
    
    // For maximum sharpness, draw at exact pixel boundaries
    this.ctx.translate(0.5, 0.5); // Half-pixel offset for crisp lines
    
    // Configure for the sharpest possible rendering
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.imageSmoothingQuality = 'high';
    this.ctx.webkitImageSmoothingEnabled = false;
    this.ctx.mozImageSmoothingEnabled = false;
    this.ctx.msImageSmoothingEnabled = false;
    
    this.ctx.drawImage(
      this.logoImage,
      Math.floor(logoX),
      Math.floor(logoY),
      Math.ceil(logoWidth),
      Math.ceil(logoHeight)
    );
    
    // Restore context settings
    this.ctx.restore();
  }

  resize() {
    // Get device pixel ratio for sharp rendering on high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    
    // Store logical dimensions
    this.canvasWidth = rect.width;
    this.canvasHeight = rect.height;
    
    // Set the canvas size in device pixels
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    // Scale the canvas back down using CSS
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    
    // Scale the drawing context so everything draws at the correct size
    this.ctx.scale(dpr, dpr);
    
    // Configure context for sharp rendering
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.imageSmoothingQuality = 'high';
    
    this.blockWidth = Math.min(100, rect.width * 0.35);
    this.redraw();
  }

  bindEvents() {
    this.startButton.addEventListener("click", () => this.startGame());
    this.restartButton.addEventListener("click", () => this.startGame());
    this.canvas.addEventListener("click", () => this.dropBlock());

    // Touch events
    this.canvas.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        this.dropBlock();
      },
      { passive: false }
    );

    // Keyboard events
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        this.dropBlock();
      }
    });
  }

  createStars(count) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * this.canvasWidth,
        y: Math.random() * this.canvasHeight,
        size: Math.random() * 2,
        opacity: Math.random() * 0.8 + 0.2,
      });
    }
    return stars;
  }

  createCityBuildings() {
    return []; // Return an empty array to remove city buildings
  }

  startGame() {
    this.blocks = [];
    this.fallingBlocks = [];
    this.particles = [];
    this.lightFlickers = [];
    this.score = 0;
    this.towerHeight = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.currentLevel = 1;
    this.gameOver = false;
    this.cameraY = 0;
    this.shakeMagnitude = 0;

    this.scoreElement.textContent = "0";
    this.levelElement.textContent = "1";
    this.gameOverElement.classList.add("hidden");
    this.startButton.classList.add("hidden");

    // Add first block as base
    const baseBlock = {
      x: this.canvasWidth / 2 - this.blockWidth / 2,
      y: this.canvasHeight - this.blockHeight / 2,
      width: this.blockWidth,
      height: this.blockHeight,
      isGlass: false,
      hasLogo: true,
    };
    this.blocks.push(baseBlock);

    // Create first moving block
    this.createMovingBlock();

    // Start game loop
    this.lastBlockTime = performance.now();
    this.gameLoop();
  }

  createMovingBlock() {
    const lastBlock = this.blocks[this.blocks.length - 1];
    const direction = Math.random() > 0.5 ? 1 : -1;
    const startX = direction > 0 ? -this.blockWidth : this.canvasWidth;
    const isGlass = true; // 70% chance of glass blocks like HSBC Tower

    this.movingBlock = {
      x: startX,
      y: lastBlock.y - this.blockHeight - 1,
      width: lastBlock.width,
      height: this.blockHeight,
      direction: direction,
      speed: this.blockSpeed * (1 + this.currentLevel * 0.08), // Slower speed increase
      isGlass,
    };
  }

  dropBlock() {
    if (this.gameOver || !this.movingBlock) return;

    const lastBlock = this.blocks[this.blocks.length - 1];
    let newWidth = this.movingBlock.width;
    let newX = this.movingBlock.x;
    let perfectFit = false;
    let snapFit = false;

    // Check for snapping - if blocks are close enough (within snapThreshold pixels)
    const leftDifference = Math.abs(this.movingBlock.x - lastBlock.x);
    const rightDifference = Math.abs(
      this.movingBlock.x +
        this.movingBlock.width -
        (lastBlock.x + lastBlock.width)
    );
    const widthDifference = Math.abs(this.movingBlock.width - lastBlock.width);

    // If block is close enough to the previous one, snap it
    if (
      leftDifference < this.snapThreshold &&
      rightDifference < this.snapThreshold &&
      widthDifference < this.snapThreshold
    ) {
      newX = lastBlock.x;
      newWidth = lastBlock.width;
      snapFit = true;
      this.createSnapEffects(newX, this.movingBlock.y);
    } else {
      // Calculate overlap as before
      const overlap =
        Math.min(
          this.movingBlock.x + this.movingBlock.width,
          lastBlock.x + lastBlock.width
        ) - Math.max(this.movingBlock.x, lastBlock.x);

      // Check if block missed completely
      if (overlap <= 0) {
        this.endGame();
        return;
      }

      // Calculate new block size based on overlap
      newWidth = overlap;
      newX = Math.max(this.movingBlock.x, lastBlock.x);

      // Cut off portion calculations for falling piece
      const cutLeftWidth = newX - this.movingBlock.x;
      const cutRightWidth =
        this.movingBlock.x + this.movingBlock.width - (newX + newWidth);

      // Add falling block piece(s)
      if (cutLeftWidth > 0) {
        this.addFallingBlock(
          this.movingBlock.x,
          this.movingBlock.y,
          cutLeftWidth,
          this.blockHeight,
          this.movingBlock.isGlass
        );
      }

      if (cutRightWidth > 0) {
        this.addFallingBlock(
          newX + newWidth,
          this.movingBlock.y,
          cutRightWidth,
          this.blockHeight,
          this.movingBlock.isGlass
        );
      }
    }

    // Check if it's a perfect fit (exactly the same position)
    if (newX === lastBlock.x && newWidth === lastBlock.width) {
      perfectFit = true;

      // Award bonus points
      this.combo++;
      this.score += this.perfectBonus * this.combo;
      this.maxCombo = Math.max(this.maxCombo, this.combo);

      // Create perfect fit effects
      this.createPerfectFitEffects(newX, this.movingBlock.y);
    } else if (snapFit) {
      // For snap fits, give a smaller bonus
      this.combo = Math.max(1, this.combo);
      this.score += 2;
    } else {
      this.combo = 0;
    }

    // Add window lighting effects occasionally
    if (Math.random() > 0.7) {
      this.addLightFlicker(newX, this.movingBlock.y, newWidth);
    }

    // Add the new stable block
    const newBlock = {
      x: newX,
      y: this.movingBlock.y,
      width: newWidth,
      height: this.blockHeight,
      isGlass: this.movingBlock.isGlass,
    };

    this.blocks.push(newBlock);
    this.towerHeight += this.blockHeight;

    // Increase score
    this.score++;
    this.scoreElement.textContent = this.score;

    // Level up every 10 blocks
    if (this.score % 10 === 0) {
      this.currentLevel++;
      this.levelElement.textContent = this.currentLevel;
    }

    // Add camera shake effect
    this.shakeMagnitude = perfectFit ? 5 : snapFit ? 3 : 2;

    // Move the building down when the screen is nearly full
    if (this.movingBlock.y < this.canvasHeight * 0.2) {
      this.blocks.forEach((block) => (block.y += this.blockHeight));
      this.movingBlock.y += this.blockHeight;
      this.cameraY -= this.blockHeight;
    }

    // Create next moving block
    this.createMovingBlock();
  }

  addFallingBlock(x, y, width, height, isGlass) {
    this.fallingBlocks.push({
      x,
      y,
      width,
      height,
      isGlass,
      velocity: { x: (Math.random() - 0.5) * 2, y: -1 },
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      rotation: 0,
    });
  }

  createSnapEffects(x, y) {
    // Create fewer particles for snap effect
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2;
      this.particles.push({
        x: x + this.blockWidth / 2,
        y,
        radius: 1 + Math.random() * 2,
        color: "#ffffff",
        velocity: {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed,
        },
        life: 40,
      });
    }
  }

  createPerfectFitEffects(x, y) {
    // Create particles for perfect fit
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      this.particles.push({
        x: x + this.blockWidth / 2,
        y,
        radius: 2 + Math.random() * 3,
        color: Math.random() > 0.5 ? this.primaryColor : this.secondaryColor,
        velocity: {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed,
        },
        life: 60,
      });
    }

    // Add screen shake
    this.shakeMagnitude = 8;
  }

  addLightFlicker(x, y, width) {
    const windowCount = Math.floor(width / 15);
    if (windowCount < 1) return;

    for (let i = 0; i < windowCount; i++) {
      if (Math.random() > 0.7) {
        this.lightFlickers.push({
          x: x + i * 15 + Math.random() * 5,
          y: y + Math.random() * this.blockHeight,
          size: 3 + Math.random() * 4,
          life: 20 + Math.random() * 40,
          maxLife: 60,
          color: Math.random() > 0.8 ? "#ffff00" : "#ffffff",
        });
      }
    }
  }

  updateMovingBlock() {
    if (!this.movingBlock) return;

    this.movingBlock.x += this.movingBlock.direction * this.movingBlock.speed;

    // Reverse direction when reaching screen edges
    if (
      this.movingBlock.direction > 0 &&
      this.movingBlock.x + this.movingBlock.width > this.canvasWidth
    ) {
      this.movingBlock.direction = -1;
    } else if (this.movingBlock.direction < 0 && this.movingBlock.x < 0) {
      this.movingBlock.direction = 1;
    }
  }

  updateFallingBlocks() {
    for (let i = this.fallingBlocks.length - 1; i >= 0; i--) {
      const block = this.fallingBlocks[i];

      block.velocity.y += this.gravity;
      block.x += block.velocity.x;
      block.y += block.velocity.y;
      block.rotation += block.rotationSpeed;

      // Remove block if it's off screen
      if (block.y > this.canvasHeight + 100) {
        this.fallingBlocks.splice(i, 1);
      }
    }
  }

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];

      particle.x += particle.velocity.x;
      particle.y += particle.velocity.y;
      particle.life--;

      // Remove particle if it's off screen or expired
      if (
        particle.life <= 0 ||
        particle.y > this.canvasHeight ||
        particle.x < 0 ||
        particle.x > this.canvasWidth
      ) {
        this.particles.splice(i, 1);
      }
    }

    // Update light flickers
    for (let i = this.lightFlickers.length - 1; i >= 0; i--) {
      const light = this.lightFlickers[i];
      light.life--;

      if (light.life <= 0) {
        this.lightFlickers.splice(i, 1);
      }
    }
  }

  updateCamera() {
    // Move camera up as tower grows
    const targetY = Math.max(0, this.towerHeight - this.canvasHeight * 0.5);
    this.cameraY += (targetY - this.cameraY) * 0.1;

    // Camera shake effect
    if (this.shakeMagnitude > 0) {
      this.shakeMagnitude *= 0.9;
    }
  }

  gameLoop() {
    // Calculate delta time
    const now = performance.now();
    const deltaTime = now - this.lastBlockTime;
    this.lastBlockTime = now;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Update game elements
    this.updateMovingBlock();
    this.updateFallingBlocks();
    this.updateParticles();
    this.updateCamera();

    // Draw game
    this.draw();

    if (!this.gameOver) {
      this.animationId = requestAnimationFrame(() => this.gameLoop());
    }
  }

  draw() {
    this.ctx.save();

    // Apply camera shake
    if (this.shakeMagnitude > 0.1) {
      const shakeX = (Math.random() - 0.5) * this.shakeMagnitude;
      const shakeY = (Math.random() - 0.5) * this.shakeMagnitude;
      this.ctx.translate(shakeX, shakeY);
    }

    // Apply camera position (translate up to show tower growth)
    this.ctx.translate(0, -20);

    // Draw tower blocks
    this.blocks.forEach((block) => {
      this.drawHSBCBlock(block);
    });

    // Draw falling blocks
    this.fallingBlocks.forEach((block) => {
      this.ctx.save();
      this.ctx.translate(block.x + block.width / 2, block.y + block.height / 2);
      this.ctx.rotate(block.rotation);
      this.drawHSBCBlockRotated(block);
      this.ctx.restore();
    });

    // Draw moving block
    if (this.movingBlock) {
      this.drawHSBCBlock(this.movingBlock);
    }

    // Reset camera translation for fixed elements
    this.ctx.restore();

    // Draw light flickers (fixed relative to buildings)
    this.lightFlickers.forEach((light) => {
      this.ctx.globalAlpha = light.life / light.maxLife;
      this.ctx.fillStyle = light.color;
      this.ctx.beginPath();
      this.ctx.arc(light.x, light.y - this.cameraY, light.size, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // Draw particles
    this.particles.forEach((particle) => {
      this.ctx.globalAlpha = particle.life / 60;
      this.ctx.fillStyle = particle.color;
      this.ctx.beginPath();
      this.ctx.arc(
        particle.x,
        particle.y - this.cameraY,
        particle.radius,
        0,
        Math.PI * 2
      );
      this.ctx.fill();
    });

    this.ctx.globalAlpha = 1;
  }

  drawHSBCBlockRotated(block) {
    // Draw block with rotation applied
    const halfWidth = block.width / 2;
    const halfHeight = block.height / 2;

    // Block shadow
    // this.ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    this.ctx.fillRect(
      -halfWidth + 2,
      -halfHeight + 2,
      block.width,
      block.height
    );

    // Block base
    this.ctx.fillStyle = block.isGlass ? this.glassColor : this.metallicColor;
    this.ctx.fillRect(-halfWidth, -halfHeight, block.width, block.height);

    // Add HSBC tower details
    if (block.isGlass) {
      // Horizontal lines
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      this.ctx.lineWidth = 4;
      for (let y = 0; y < block.height; y += 15) {
        this.ctx.beginPath();
        this.ctx.moveTo(block.x, block.y + y);
        this.ctx.lineTo(block.x + block.width, block.y + y);
        this.ctx.stroke();
      }

      // Vertical lines
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      this.ctx.lineWidth = 2;
      for (let x = 0; x < block.width; x += 1) {
        this.ctx.beginPath();
        this.ctx.moveTo(block.x + x, block.y);
        this.ctx.lineTo(block.x + x, block.y + block.height);
        this.ctx.stroke();
      }
    } else {
      // Structural metallic frame with red accents
      this.ctx.fillStyle = this.primaryColor;
      this.ctx.fillRect(-halfWidth, -halfHeight, block.width, 5);
    }
  }

  drawHSBCBlock(block) {
    // Block shadow
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    this.ctx.fillRect(block.x, block.y, block.width, block.height);

    // Main block body
    this.ctx.fillStyle = block.isGlass ? this.glassColor : this.metallicColor;
    this.ctx.fillRect(block.x, block.y, block.width, block.height);

    // HSBC tower details
    if (block.isGlass) {
      // Glass panel grid
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";

      // Horizontal lines
      this.ctx.lineWidth = 6;
      for (let y = 0; y < block.height; y += 12) {
        this.ctx.beginPath();
        this.ctx.moveTo(block.x, block.y + y);
        this.ctx.lineTo(block.x + block.width, block.y + y);
        this.ctx.stroke();
      }

      // Vertical lines
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      this.ctx.lineWidth = 2;
      for (let x = 0; x < block.width; x += 10) {
        this.ctx.beginPath();
        this.ctx.moveTo(block.x + x, block.y);
        this.ctx.lineTo(block.x + x, block.y + block.height);
        this.ctx.stroke();
      }
    } else {
      // Structural metallic frame with red HSBC accents
      this.ctx.fillStyle = this.primaryColor;
      this.ctx.fillRect(block.x, block.y, block.width, 5);
    }

    // Add highlight to movingBlock to distinguish it
    if (block === this.movingBlock) {
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(block.x, block.y, block.width, block.height);
    }

    // Draw HSBC logo on the base block
    if (block.hasLogo) {
      this.drawCrispLogo(block);
    }
  }

  endGame() {
    this.gameOver = true;
    cancelAnimationFrame(this.animationId);

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem("hsbcTowerHighScore", this.highScore);
      this.updateHighScore();
    }

    this.finalScoreElement.textContent = this.score;
    this.finalHighScoreElement.textContent = this.highScore;
    this.gameOverElement.classList.remove("hidden");
  }

  updateHighScore() {
    this.highScoreElement.textContent = `Best: ${this.highScore}`;
  }

  redraw() {
    if (!this.gameOver) {
      this.draw();
    }
  }
}

// Initialize game when DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  const game = new HSBCTowerBlock();
});
