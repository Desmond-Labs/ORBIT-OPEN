import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

declare global {
  interface Window {
    p5: any;
  }
}

interface OrbitDemoProps {
  className?: string;
}

export const OrbitDemo: React.FC<OrbitDemoProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let p5Script: HTMLScriptElement | null = null;

    const loadP5 = () => {
      if (window.p5) {
        initializeSketch();
        return;
      }

      p5Script = document.createElement('script');
      p5Script.src = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js';
      p5Script.onload = () => {
        setTimeout(initializeSketch, 100);
      };
      p5Script.onerror = () => {
        setError('Failed to load p5.js library');
        setIsLoading(false);
      };
      document.head.appendChild(p5Script);
    };

    const initializeSketch = () => {
      if (!containerRef.current || !window.p5) return;

      try {
        const sketch = (p: any) => {
          // ORBIT Brand Colors
          const ORBIT_TEAL = '#00E5FF';
          const ORBIT_PURPLE = '#B388FF';
          const ORBIT_BLUE = '#8C9EFF';
          const ORBIT_NAVY = '#0F1121';
          const ORBIT_GOLD = '#FFFF00';
          const ORBIT_CORAL = '#FF9E80';
          const ORBIT_GREEN = '#69F0AE';
          const SUCCESS_GREEN = '#10B981';

          let PANEL_BG_COLOR: any, TEXT_COLOR_DIM: any, TEXT_COLOR_BRIGHT: any;

          // Demo metadata - simplified for demonstration
          const METADATA = {
            "scene_overview": { "setting": "Restaurant patio", "time": "Evening", "mood": "Casual dining" },
            "human_elements": { "people": "7 friends", "activity": "Socializing", "emotions": "Relaxed" },
            "environment": { "location": "Urban patio", "elements": "Brick walls", "context": "City street" },
            "key_objects": { "food": "Pretzel with sauce", "drinks": "Beer & cocktails", "furniture": "Tables & chairs" },
            "atmospheric_elements": { "lighting": "Natural daylight", "colors": "Earth tones", "mood": "Social" },
            "narrative_analysis": { "story": "Friends gathering", "values": "Social connection", "culture": "Casual dining" },
            "photographic_elements": { "composition": "Horizontal", "focus": "Foreground", "style": "Candid" },
            "marketing_potential": { "target": "Urban millennials", "appeal": "Social dining", "brands": "Craft beer" }
          };

          const CATEGORIES = [
            { key: 'scene_overview', title: 'Scene', color: ORBIT_TEAL },
            { key: 'human_elements', title: 'Human', color: ORBIT_CORAL },
            { key: 'environment', title: 'Environment', color: ORBIT_GREEN },
            { key: 'key_objects', title: 'Objects', color: ORBIT_GOLD },
            { key: 'atmospheric_elements', title: 'Atmospheric', color: ORBIT_PURPLE },
            { key: 'narrative_analysis', title: 'Narrative', color: ORBIT_BLUE },
            { key: 'photographic_elements', title: 'Photo', color: ORBIT_PURPLE },
            { key: 'marketing_potential', title: 'Marketing', color: ORBIT_TEAL }
          ];

          // Animation constants
          const ANALYSIS_DURATION_PER_CATEGORY = 120;
          const WORD_APPEAR_DURATION = 15;
          const WORD_STATIONARY_DURATION = 45;
          const WORD_MOVE_DURATION = ANALYSIS_DURATION_PER_CATEGORY - WORD_APPEAR_DURATION - WORD_STATIONARY_DURATION;
          const EMBED_DURATION_PER_CATEGORY = 150;
          const WORDS_PER_CATEGORY = 3;

          // State variables
          let currentPhase = 'idle';
          let analysisProgress = 0;
          let embeddingProgress = 0;
          let activeCategoryIndex = -1;
          let revealedCategories = new Set();
          let constellationWords: any[] = [];
          let activeConstellationWords: any[] = [];
          let embeddingParticles: any[] = [];
          let metadataTags: any[] = [];
          let embeddingStartFrame = 0;
          let stars: any[] = [];
          let userImage: any;
          let canvasWidth: number, canvasHeight: number;
          let imageArea: any, metadataArea: any;

          p.preload = () => {
            userImage = p.loadImage(
              '/lovable-uploads/b9339360-931e-4e06-8194-9c4b25301f7c.png',
              () => console.log('Demo image loaded'),
              () => console.log('Demo image failed to load')
            );
          };

          p.setup = () => {
            PANEL_BG_COLOR = p.color(15, 17, 33, 220);
            TEXT_COLOR_DIM = p.color(180, 180, 200);
            TEXT_COLOR_BRIGHT = p.color(230, 230, 240);

            calculateLayout();
            p.createCanvas(canvasWidth, canvasHeight);
            p.frameRate(60);
            p.textAlign(p.LEFT, p.TOP);
            p.ellipseMode(p.CENTER);

            // Create stars
            for (let i = 0; i < 100; i++) {
              stars.push(new Star());
            }

            startAnalysis();
          };

          function calculateLayout() {
            const containerWidth = containerRef.current?.clientWidth || 800;
            const containerHeight = Math.min(containerRef.current?.clientHeight || 500, 500);
            
            canvasWidth = Math.min(containerWidth, 900);
            canvasHeight = Math.min(containerHeight, 500);

            const imageWidth = canvasWidth * 0.45;
            const imageHeight = canvasHeight * 0.7;
            
            imageArea = {
              x: 30,
              y: 30,
              w: imageWidth,
              h: imageHeight
            };

            metadataArea = {
              x: imageArea.x + imageArea.w + 30,
              y: 30,
              w: canvasWidth - imageArea.x - imageArea.w - 60,
              h: imageHeight
            };
          }

          p.windowResized = () => {
            calculateLayout();
            p.resizeCanvas(canvasWidth, canvasHeight);
          };

          function startAnalysis() {
            currentPhase = 'analyzing';
            analysisProgress = 0;
            embeddingProgress = 0;
            activeCategoryIndex = -1;
            revealedCategories.clear();
            constellationWords = [];
            activeConstellationWords = [];
            embeddingParticles = [];
            metadataTags = [];
            embeddingStartFrame = 0;
          }

          function getSampleWords(categoryKey: string, count: number) {
            const categoryData = METADATA[categoryKey as keyof typeof METADATA];
            if (!categoryData) return [];
            
            let words: string[] = [];
            Object.values(categoryData).forEach((value: any) => {
              if (typeof value === 'string') {
                words.push(value);
              }
            });
            
            return p.shuffle(words).slice(0, count);
          }

          function spawnConstellationWords(categoryIndex: number) {
            activeConstellationWords = [];
            const category = CATEGORIES[categoryIndex];
            const sampleWords = getSampleWords(category.key, WORDS_PER_CATEGORY);
            const targetYBase = metadataArea.y + (metadataArea.h / CATEGORIES.length) * (categoryIndex + 0.5);

            sampleWords.forEach((word: string, i: number) => {
              const startPos = p.createVector(
                p.random(imageArea.x + 20, imageArea.x + imageArea.w - 20),
                p.random(imageArea.y + 20, imageArea.y + imageArea.h - 20)
              );
              const targetPos = p.createVector(
                metadataArea.x + 30 + p.random(-10, 10),
                targetYBase + p.random(-10, 10)
              );
              
              const newWord = new ConstellationWord(startPos, targetPos, category.color, word, categoryIndex, i);
              constellationWords.push(newWord);
              activeConstellationWords.push(newWord);
            });
          }

          function updateAnalysis() {
            const totalAnalysisFrames = CATEGORIES.length * ANALYSIS_DURATION_PER_CATEGORY;
            analysisProgress += (100 / totalAnalysisFrames);
            analysisProgress = p.min(100, analysisProgress);
            
            const currentCategoryIdx = p.floor((analysisProgress / 100) * CATEGORIES.length);

            if (currentCategoryIdx > activeCategoryIndex && currentCategoryIdx < CATEGORIES.length) {
              activeCategoryIndex = currentCategoryIdx;
              revealedCategories.add(CATEGORIES[activeCategoryIndex].key);
              spawnConstellationWords(activeCategoryIndex);
            }

            // Update constellation words
            for (let i = constellationWords.length - 1; i >= 0; i--) {
              constellationWords[i].update();
              if (constellationWords[i].isDone()) {
                const word = constellationWords[i];
                metadataTags.push(new MetadataTag(word.text, word.color, word.categoryIndex, word.wordIndex));
                constellationWords.splice(i, 1);
              }
            }

            activeConstellationWords = activeConstellationWords.filter((word: any) => !word.isDone());

            if (analysisProgress >= 100) {
              currentPhase = 'embedding';
              activeCategoryIndex = 0;
              embeddingStartFrame = p.frameCount;
            }
          }

          function updateEmbedding() {
            const embeddingFramesSinceStart = p.frameCount - embeddingStartFrame;
            const totalEmbeddingFrames = CATEGORIES.length * EMBED_DURATION_PER_CATEGORY;
            embeddingProgress = (embeddingFramesSinceStart / totalEmbeddingFrames) * 100;
            embeddingProgress = p.min(embeddingProgress, 100);

            const expectedCategoryIndex = p.floor(embeddingFramesSinceStart / EMBED_DURATION_PER_CATEGORY);
            if (expectedCategoryIndex !== activeCategoryIndex && expectedCategoryIndex < CATEGORIES.length) {
              activeCategoryIndex = expectedCategoryIndex;
            }

            // Create embedding particles
            if (embeddingFramesSinceStart < totalEmbeddingFrames && activeCategoryIndex < CATEGORIES.length) {
              const currentCategory = CATEGORIES[activeCategoryIndex];
              const categoryYCenter = metadataArea.y + (metadataArea.h / CATEGORIES.length) * (activeCategoryIndex + 0.5);
              
              if (p.frameCount % 4 === 0) {
                const startPos = p.createVector(
                  metadataArea.x + metadataArea.w - 10,
                  categoryYCenter + p.random(-15, 15)
                );
                embeddingParticles.push(new EmbeddingParticle(startPos, currentCategory.color));
              }
            }

            // Update particles
            for (let i = embeddingParticles.length - 1; i >= 0; i--) {
              embeddingParticles[i].update();
              if (embeddingParticles[i].isDone()) {
                embeddingParticles.splice(i, 1);
              }
            }

            if (embeddingProgress >= 100) {
              currentPhase = 'complete';
            }
          }

          p.draw = () => {
            p.background(ORBIT_NAVY);
            drawStars();

            if (currentPhase === 'analyzing') {
              updateAnalysis();
            } else if (currentPhase === 'embedding') {
              updateEmbedding();
            }

            drawImagePanel();
            drawMetadataPanel();
            drawAnimations();
            drawStatus();
          };

          function drawStars() {
            for (const star of stars) {
              star.update();
              star.draw();
            }
          }

          function drawImagePanel() {
            p.push();
            if (userImage && userImage.width > 1) {
              p.image(userImage, imageArea.x, imageArea.y, imageArea.w, imageArea.h);
            }
            p.noFill();
            p.stroke(ORBIT_TEAL);
            p.strokeWeight(2);
            p.rect(imageArea.x, imageArea.y, imageArea.w, imageArea.h, 8);
            p.pop();
          }

          function drawMetadataPanel() {
            p.push();
            p.fill(PANEL_BG_COLOR);
            p.noStroke();
            p.rect(metadataArea.x, metadataArea.y, metadataArea.w, metadataArea.h, 8);
            
            p.noFill();
            p.stroke(ORBIT_PURPLE);
            p.strokeWeight(2);
            p.rect(metadataArea.x, metadataArea.y, metadataArea.w, metadataArea.h, 8);

            // Draw category titles
            p.textSize(12);
            p.textAlign(p.LEFT, p.CENTER);
            const categorySpacing = metadataArea.h / CATEGORIES.length;
            
            for (let i = 0; i < CATEGORIES.length; i++) {
              const category = CATEGORIES[i];
              const yPos = metadataArea.y + i * categorySpacing;
              
              let titleColor = TEXT_COLOR_DIM;
              if (revealedCategories.has(category.key) || currentPhase !== 'analyzing') {
                titleColor = TEXT_COLOR_BRIGHT;
              }
              
              if (currentPhase === 'embedding' && i === activeCategoryIndex) {
                let pulseAlpha = p.sin(p.frameCount * 0.1) * 0.3 + 0.7;
                let pulseColor = p.color(category.color);
                pulseColor.setAlpha(pulseAlpha * 100);
                p.fill(pulseColor);
                p.noStroke();
                p.rect(metadataArea.x + 2, yPos, metadataArea.w - 4, categorySpacing, 3);
              }
              
              p.fill(titleColor);
              p.text(category.title, metadataArea.x + 15, yPos + (categorySpacing / 2) - 5);
            }

            // Draw metadata tags
            for (const tag of metadataTags) {
              tag.update();
              tag.draw();
            }

            p.pop();
          }

          function drawAnimations() {
            // Draw constellation lines
            if (currentPhase === 'analyzing' && activeConstellationWords.length > 1) {
              const firstWord = activeConstellationWords[0];
              let lineAlpha = 0;
              
              if (firstWord.state === 'appearing' || firstWord.state === 'stationary') {
                if (firstWord.timer < WORD_APPEAR_DURATION) {
                  lineAlpha = p.map(firstWord.timer, 0, WORD_APPEAR_DURATION, 0, 150);
                } else {
                  lineAlpha = 150;
                }
              }

              if (lineAlpha > 0) {
                p.push();
                p.strokeWeight(2);
                p.stroke(255, lineAlpha * 0.3);
                
                for (let i = 0; i < activeConstellationWords.length - 1; i++) {
                  p.line(
                    activeConstellationWords[i].initialPos.x,
                    activeConstellationWords[i].initialPos.y,
                    activeConstellationWords[i + 1].initialPos.x,
                    activeConstellationWords[i + 1].initialPos.y
                  );
                }
                p.pop();
              }
            }

            // Draw constellation words
            for (const word of constellationWords) {
              word.draw();
            }

            // Draw embedding particles
            for (const particle of embeddingParticles) {
              particle.draw();
            }
          }

          function drawStatus() {
            p.push();
            p.textAlign(p.CENTER, p.CENTER);
            
            let statusText = `Phase: ${currentPhase.toUpperCase()}`;
            let progress = 0;
            
            if (currentPhase === 'analyzing') {
              progress = analysisProgress;
              statusText = `Analyzing Image... ${Math.floor(progress)}%`;
            } else if (currentPhase === 'embedding') {
              progress = embeddingProgress;
              statusText = `Embedding Metadata... ${Math.floor(progress)}%`;
            } else if (currentPhase === 'complete') {
              progress = 100;
              statusText = "Analysis Complete!";
            }

            const statusY = Math.max(imageArea.y + imageArea.h, metadataArea.y + metadataArea.h) + 25;
            
            p.fill(TEXT_COLOR_BRIGHT);
            p.textSize(14);
            p.text(statusText, canvasWidth / 2, statusY);

            // Progress bar
            const barWidth = canvasWidth * 0.6;
            const barX = (canvasWidth - barWidth) / 2;
            const barY = statusY + 20;
            const barHeight = 4;

            p.noStroke();
            p.fill(40, 40, 60);
            p.rect(barX, barY, barWidth, barHeight, 2);

            if (progress > 0) {
              const progressW = barWidth * (progress / 100);
              p.fill(ORBIT_TEAL);
              p.rect(barX, barY, progressW, barHeight, 2);
            }

            p.pop();
          }

          // Classes
          class Star {
            x: number;
            y: number;
            size: number;
            alpha: number;
            twinkleSpeed: number;

            constructor() {
              this.x = p.random(canvasWidth);
              this.y = p.random(canvasHeight);
              this.size = p.random(0.5, 1.5);
              this.alpha = p.random(50, 150);
              this.twinkleSpeed = p.random(0.5, 2);
            }

            update() {
              this.alpha += p.sin(p.frameCount * 0.05 * this.twinkleSpeed) * 2;
              this.alpha = p.constrain(this.alpha, 50, 150);
            }

            draw() {
              p.noStroke();
              p.fill(255, this.alpha);
              p.ellipse(this.x, this.y, this.size, this.size);
            }
          }

          class ConstellationWord {
            initialPos: any;
            pos: any;
            targetPos: any;
            color: any;
            text: string;
            timer: number;
            state: string;
            alpha: number;
            categoryIndex: number;
            wordIndex: number;

            constructor(startPos: any, targetPos: any, hexColor: string, text: string, categoryIndex: number, wordIndex: number) {
              this.initialPos = startPos.copy();
              this.pos = startPos.copy();
              this.targetPos = targetPos.copy();
              this.color = p.color(hexColor);
              this.text = text;
              this.timer = 0;
              this.state = 'appearing';
              this.alpha = 0;
              this.categoryIndex = categoryIndex;
              this.wordIndex = wordIndex;
            }

            update() {
              this.timer++;
              
              if (this.state === 'appearing') {
                this.alpha = p.map(this.timer, 0, WORD_APPEAR_DURATION, 0, 255);
                if (this.timer > WORD_APPEAR_DURATION) {
                  this.state = 'stationary';
                  this.timer = 0;
                }
              } else if (this.state === 'stationary') {
                if (this.timer > WORD_STATIONARY_DURATION) {
                  this.state = 'moving';
                  this.timer = 0;
                }
              } else if (this.state === 'moving') {
                const t = this.timer / WORD_MOVE_DURATION;
            const easeT = 0.5 - 0.5 * p.cos(t * p.PI);
            this.pos = (p as any).constructor.Vector.lerp(this.initialPos, this.targetPos, easeT);
                this.alpha = p.map(easeT, 0.8, 1, 255, 0);
                if (t >= 1) {
                  this.state = 'done';
                }
              }
            }

            draw() {
              if (this.state === 'done') return;
              
              p.push();
              p.textSize(10);
              p.textAlign(p.CENTER, p.CENTER);
              p.noStroke();
              p.fill(p.red(this.color), p.green(this.color), p.blue(this.color), this.alpha);
              p.text(this.text, this.pos.x, this.pos.y);
              p.pop();
            }

            isDone() {
              return this.state === 'done';
            }
          }

          class MetadataTag {
            text: string;
            color: any;
            categoryIndex: number;
            wordIndex: number;
            alpha: number;
            x: number;
            y: number;
            width: number;
            height: number;

            constructor(text: string, hexColor: string, categoryIndex: number, wordIndex: number) {
              this.text = text;
              this.color = p.color(hexColor);
              this.categoryIndex = categoryIndex;
              this.wordIndex = wordIndex;
              this.alpha = 0;

              p.textSize(9);
              const textW = p.textWidth(this.text);
              this.width = textW + 12;
              this.height = 16;

              const categorySpacing = metadataArea.h / CATEGORIES.length;
              const categoryY = metadataArea.y + categoryIndex * categorySpacing;
              this.y = categoryY + (categorySpacing / 2) + 5;

              // Calculate total available width for tags in this category
              const availableWidth = metadataArea.w - 30; // Leave some margin
              const tagsInCategory = WORDS_PER_CATEGORY;
              const spacingBetweenTags = 8;
              const totalSpacingWidth = (tagsInCategory - 1) * spacingBetweenTags;
              
              // Calculate total width of all tags in this category
              let totalTagsWidth = 0;
              p.textSize(9);
              const currentCategoryData = METADATA[CATEGORIES[categoryIndex].key];
              const sampleWords = getSampleWords(CATEGORIES[categoryIndex].key, WORDS_PER_CATEGORY);
              for (const word of sampleWords) {
                totalTagsWidth += p.textWidth(word) + 12; // 12 is padding
              }
              
              // Calculate starting position to center all tags
              const startX = metadataArea.x + 15 + (availableWidth - totalTagsWidth - totalSpacingWidth) / 2;
              
              // Position this specific tag
              this.x = startX;
              for (const otherTag of metadataTags) {
                if (otherTag.categoryIndex === this.categoryIndex && otherTag.wordIndex < this.wordIndex) {
                  this.x += otherTag.width + spacingBetweenTags;
                }
              }
            }

            update() {
              if (this.alpha < 255) {
                this.alpha += 10;
                this.alpha = p.min(this.alpha, 255);
              }
            }

            draw() {
              p.push();
              p.noStroke();
              this.color.setAlpha(this.alpha * 0.3);
              p.fill(this.color);
              p.rect(this.x, this.y, this.width, this.height, 8);

              p.noFill();
              p.strokeWeight(1);
              this.color.setAlpha(this.alpha);
              p.stroke(this.color);
              p.rect(this.x, this.y, this.width, this.height, 8);

              p.noStroke();
              p.fill(240, this.alpha);
              p.textSize(9);
              p.textAlign(p.CENTER, p.CENTER);
              p.text(this.text, this.x + this.width / 2, this.y + this.height / 2);
              p.pop();
            }
          }

          class EmbeddingParticle {
            pos: any;
            startPos: any;
            color: any;
            lifespan: number;
            maxLifespan: number;
            targetX: number;
            targetY: number;

            constructor(startPos: any, hexColor: string) {
              this.pos = startPos.copy();
              this.startPos = startPos.copy();
              this.color = p.color(hexColor);
              this.lifespan = 80;
              this.maxLifespan = 80;
              this.targetX = p.random(imageArea.x + 20, imageArea.x + imageArea.w - 20);
              this.targetY = p.random(imageArea.y + 20, imageArea.y + imageArea.h - 20);
            }

            update() {
              this.lifespan--;
              const progress = 1 - (this.lifespan / this.maxLifespan);
              this.pos.x = p.lerp(this.startPos.x, this.targetX, progress);
              this.pos.y = p.lerp(this.startPos.y, this.targetY, progress);
            }

            draw() {
              p.push();
              p.noStroke();
              const alpha = p.map(this.lifespan, 0, this.maxLifespan, 0, 255);
              p.fill(p.red(this.color), p.green(this.color), p.blue(this.color), alpha);
              p.ellipse(this.pos.x, this.pos.y, 3, 3);
              p.pop();
            }

            isDone() {
              return this.lifespan <= 0;
            }
          }

          // Expose restart function
          (window as any).restartOrbitDemo = startAnalysis;
        };

        p5InstanceRef.current = new window.p5(sketch, containerRef.current);
        setIsLoading(false);
      } catch (err) {
        console.error('Error initializing p5 sketch:', err);
        setError('Failed to initialize demo');
        setIsLoading(false);
      }
    };

    loadP5();

    return () => {
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove();
      }
      if (p5Script && p5Script.parentNode) {
        p5Script.parentNode.removeChild(p5Script);
      }
    };
  }, []);

  const handleRestart = () => {
    if ((window as any).restartOrbitDemo) {
      (window as any).restartOrbitDemo();
    }
  };

  if (error) {
    return (
      <div className={`relative ${className}`}>
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Reload Demo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-cosmic-background z-10">
          <div className="text-center">
            <Sparkles className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground">Loading ORBIT Demo...</p>
          </div>
        </div>
      )}
      
      <div 
        ref={containerRef} 
        className="w-full h-[500px] relative rounded-xl overflow-hidden border border-accent/20"
        style={{ minHeight: '500px' }}
      />
      
      <div className="absolute top-4 right-4 z-20">
        <Button
          onClick={handleRestart}
          variant="cosmic"
          size="sm"
          className="font-medium"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Restart Demo
        </Button>
      </div>
    </div>
  );
};