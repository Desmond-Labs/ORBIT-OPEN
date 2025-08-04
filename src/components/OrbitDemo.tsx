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
            "photographic_elements": { "composition": "Horizontal", "focus": "Foreground", "style": "Candid" }
          };

          const CATEGORIES = [
            { key: 'scene_overview', title: 'Scene', color: ORBIT_TEAL },
            { key: 'human_elements', title: 'Human', color: ORBIT_CORAL },
            { key: 'environment', title: 'Environment', color: ORBIT_GREEN },
            { key: 'key_objects', title: 'Objects', color: ORBIT_GOLD },
            { key: 'atmospheric_elements', title: 'Atmospheric', color: ORBIT_PURPLE },
            { key: 'narrative_analysis', title: 'Narrative', color: ORBIT_BLUE },
            { key: 'photographic_elements', title: 'Photo', color: ORBIT_PURPLE }
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
          let embeddingRipples: any[] = [];
          let completionBurstParticles: any[] = [];
          let metadataTags: any[] = [];
          let embeddingStartFrame = 0;
          let completionInitiated = false;
          let imageGlow = 0;
          let stars: any[] = [];
          let userImage: any;
          let canvasWidth: number, canvasHeight: number;
          let imageArea: any, metadataArea: any;
          let reportStartFrame = 0;
          let reportProgress = 0;
          let reportSections: any[] = [];
          let showRawJson = false;
          let completionEndFrame = 0;
          let waitingForReport = false;

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

            // Use standard image height since we now have 7 evenly spaced categories
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
            embeddingRipples = [];
            completionBurstParticles = [];
            metadataTags = [];
            embeddingStartFrame = 0;
            completionInitiated = false;
            imageGlow = 0;
            reportStartFrame = 0;
            reportProgress = 0;
            reportSections = [];
            showRawJson = false;
            completionEndFrame = 0;
            waitingForReport = false;
          }

          function getSampleWords(categoryKey: string, count: number) {
            const categoryData = METADATA[categoryKey as keyof typeof METADATA];
            if (!categoryData) {
              console.warn(`No data found for category: ${categoryKey}`);
              return [];
            }
            
            let words: string[] = [];
            Object.values(categoryData).forEach((value: any) => {
              if (typeof value === 'string') {
                // Split compound phrases and take meaningful words
                const splitWords = value.split(/[\s,&]+/).filter(word => word.length > 2);
                words.push(...splitWords);
              }
            });
            
            // Remove duplicates and ensure we have words
            words = [...new Set(words)];
            
            // Add fallback words if category has no valid content
            if (words.length === 0) {
              const fallbacks: { [key: string]: string[] } = {
                'scene_overview': ['Indoor', 'Outdoor', 'Setting'],
                'human_elements': ['People', 'Activity', 'Emotion'],
                'environment': ['Location', 'Context', 'Atmosphere'],
                'key_objects': ['Items', 'Products', 'Elements'],
                'atmospheric_elements': ['Lighting', 'Mood', 'Ambiance'],
                'narrative_analysis': ['Story', 'Theme', 'Message'],
                'photographic_elements': ['Composition', 'Style', 'Quality']
              };
              words = fallbacks[categoryKey] || ['Analysis', 'Data', 'Content'];
            }
            
            return p.shuffle(words).slice(0, count);
          }

          function spawnConstellationWords(categoryIndex: number) {
            activeConstellationWords = [];
            const category = CATEGORIES[categoryIndex];
            const sampleWords = getSampleWords(category.key, WORDS_PER_CATEGORY);
            const categorySpacing = metadataArea.h * 0.125; // 12.5% of panel height per category
            const categoryTop = metadataArea.y + categoryIndex * categorySpacing;
            // Target the tag area (lower 60% of category space)
            const targetYBase = categoryTop + (categorySpacing * 0.6) + 10;

            console.log(`Spawning words for category ${categoryIndex} (${category.title}):`, sampleWords);

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
                
                // Reposition all tags after adding a new one
                MetadataTag.positionTagsInCategories(metadataTags);
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
            const currentCategory = CATEGORIES[activeCategoryIndex];
            const embeddingFramesSinceStart = p.frameCount - embeddingStartFrame;
            const categoryFrameCount = embeddingFramesSinceStart % EMBED_DURATION_PER_CATEGORY;
            
            // Create streaming particles
            if (categoryFrameCount < EMBED_DURATION_PER_CATEGORY - 30 && !completionInitiated) {
              const categoryYCenter = metadataArea.y + (metadataArea.h / CATEGORIES.length) * (activeCategoryIndex + 0.5);
              for (let i = 0; i < 3; i++) {
                const startPos = p.createVector(
                  metadataArea.x + metadataArea.w - 10 + p.random(-5, 5),
                  categoryYCenter + p.random(-15, 15)
                );
                embeddingParticles.push(new StreamingEmbeddingParticle(startPos, currentCategory.color, activeCategoryIndex));
              }
            }

            // Update particles and create ripples
            for (let i = embeddingParticles.length - 1; i >= 0; i--) {
              embeddingParticles[i].update();
              if (embeddingParticles[i].isDone()) {
                if (embeddingParticles[i].hasEmbedded) {
                  embeddingRipples.push(new EmbeddingRipple(embeddingParticles[i].pos, currentCategory.color));
                }
                embeddingParticles.splice(i, 1);
              }
            }

            // Update ripples
            for (let i = embeddingRipples.length - 1; i >= 0; i--) {
              embeddingRipples[i].update();
              if (embeddingRipples[i].isDone()) {
                embeddingRipples.splice(i, 1);
              }
            }

            const totalEmbeddingFrames = CATEGORIES.length * EMBED_DURATION_PER_CATEGORY;
            embeddingProgress = (embeddingFramesSinceStart / totalEmbeddingFrames) * 100;
            embeddingProgress = p.min(embeddingProgress, 100);

            const expectedCategoryIndex = p.floor(embeddingFramesSinceStart / EMBED_DURATION_PER_CATEGORY);
            if (expectedCategoryIndex !== activeCategoryIndex && expectedCategoryIndex < CATEGORIES.length) {
              activeCategoryIndex = expectedCategoryIndex;
            }

            if (embeddingFramesSinceStart >= totalEmbeddingFrames && !completionInitiated) {
              completionInitiated = true;
              embeddingProgress = 100;
            }

            if (completionInitiated && embeddingParticles.length === 0 && embeddingRipples.length === 0 && currentPhase !== 'report') {
              currentPhase = 'report';
              reportStartFrame = p.frameCount;
              initializeReport();
            }
          }

          function triggerCompletionBurst() {
            const centerPos = p.createVector(imageArea.x + imageArea.w / 2, imageArea.y + imageArea.h / 2);
            for (let i = 0; i < 200; i++) {
              completionBurstParticles.push(new CompletionBurstParticle(centerPos));
            }
            imageGlow = 1.0;
          }

          function updateComplete() {
            for (let i = completionBurstParticles.length - 1; i >= 0; i--) {
              completionBurstParticles[i].update();
              if (completionBurstParticles[i].isDone()) {
                completionBurstParticles.splice(i, 1);
              }
            }
            if (imageGlow > 0) {
              imageGlow = p.max(0, imageGlow - 0.02);
            }
          }

          function initializeReport() {
            reportSections = [
              { title: "ORBIT Metadata Report - Enhanced Simple MCP v2.1", type: "header" },
              { title: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", type: "separator" },
              { title: "Source Image: demo-image.jpg", type: "info" },
              { title: `Report Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, type: "info" },
              { title: "Analysis Type: Lifestyle", type: "info" },
              { title: "Processing Time: 2.4 seconds", type: "info" },
              { title: "", type: "spacer" },
              { title: "🏠 SCENE OVERVIEW", type: "section", data: METADATA.scene_overview },
              { title: "👥 HUMAN ELEMENTS", type: "section", data: METADATA.human_elements },
              { title: "🌍 ENVIRONMENT", type: "section", data: METADATA.environment },
              { title: "🔑 KEY OBJECTS", type: "section", data: METADATA.key_objects },
              { title: "🎨 ATMOSPHERIC ELEMENTS", type: "section", data: METADATA.atmospheric_elements },
              { title: "📖 NARRATIVE ANALYSIS", type: "section", data: METADATA.narrative_analysis },
              { title: "📷 PHOTOGRAPHIC ELEMENTS", type: "section", data: METADATA.photographic_elements },
              { title: "🎯 MARKETING POTENTIAL", type: "section", data: METADATA.marketing_potential },
              { title: "", type: "spacer" },
              { title: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", type: "separator" },
              { title: "RAW JSON DATA", type: "section-header" },
              { title: JSON.stringify(METADATA, null, 2), type: "json" }
            ];
          }

          function updateReport() {
            const framesSinceStart = p.frameCount - reportStartFrame;
            reportProgress = p.min(100, (framesSinceStart / 240) * 100); // 4 seconds to fully reveal
            
            // Keep the report as the final state - no transition to complete phase
            // This ensures the report remains visible as the final frame
          }

          p.draw = () => {
            p.background(ORBIT_NAVY);
            drawStars();

            if (currentPhase === 'analyzing') {
              updateAnalysis();
            } else if (currentPhase === 'embedding') {
              updateEmbedding();
            } else if (currentPhase === 'report') {
              updateReport();
            } else if (currentPhase === 'complete') {
              updateComplete();
            }

            drawImagePanel();
            if (currentPhase === 'report') {
              drawReportPanel();
            } else {
              drawMetadataPanel();
            }
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
            
            // Add completion glow effect
            if (imageGlow > 0) {
              p.noFill();
              p.strokeWeight(4 * imageGlow);
              let glowColor = p.color(ORBIT_TEAL);
              glowColor.setAlpha(150 * imageGlow);
              p.stroke(glowColor);
              p.rect(imageArea.x, imageArea.y, imageArea.w, imageArea.h, 8);
            }
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
            const categorySpacing = metadataArea.h * 0.125; // 12.5% of panel height per category
            
            for (let i = 0; i < CATEGORIES.length; i++) {
              const category = CATEGORIES[i];
              const categoryTop = metadataArea.y + i * categorySpacing;
              const titleYPos = categoryTop + (categorySpacing * 0.25); // Position title at 25% of category space
              
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
                p.rect(metadataArea.x + 2, categoryTop, metadataArea.w - 4, categorySpacing, 3);
              }
              
              p.fill(titleColor);
              p.text(category.title, metadataArea.x + 15, titleYPos);
            }

            // Draw metadata tags
            for (const tag of metadataTags) {
              tag.update();
              tag.draw();
            }

            p.pop();
          }

          function drawAnimations() {
            // Draw constellation lines with enhanced visibility
            if (currentPhase === 'analyzing' && activeConstellationWords.length > 1) {
              const firstWord = activeConstellationWords[0];
              let lineAlpha = 0;
              
              if (firstWord.state === 'appearing' || firstWord.state === 'stationary') {
                const stationaryEndTime = WORD_APPEAR_DURATION + WORD_STATIONARY_DURATION;
                if (firstWord.timer < WORD_APPEAR_DURATION) {
                  lineAlpha = p.map(firstWord.timer, 0, WORD_APPEAR_DURATION, 0, 255);
                } else if (firstWord.timer < stationaryEndTime - 15) {
                  lineAlpha = 255;
                } else {
                  lineAlpha = p.map(firstWord.timer, stationaryEndTime - 15, stationaryEndTime, 255, 0);
                }
              }

              if (lineAlpha > 0) {
                p.push();
                
                // Draw glow effect for constellation lines
                p.strokeWeight(6);
                p.stroke(255, lineAlpha * 0.2);
                for (let i = 0; i < activeConstellationWords.length - 1; i++) {
                  p.line(
                    activeConstellationWords[i].initialPos.x,
                    activeConstellationWords[i].initialPos.y,
                    activeConstellationWords[i + 1].initialPos.x,
                    activeConstellationWords[i + 1].initialPos.y
                  );
                }
                // Close the constellation
                if (activeConstellationWords.length > 2) {
                  p.line(
                    activeConstellationWords[activeConstellationWords.length - 1].initialPos.x,
                    activeConstellationWords[activeConstellationWords.length - 1].initialPos.y,
                    firstWord.initialPos.x,
                    firstWord.initialPos.y
                  );
                }
                
                // Draw main constellation lines with category color
                const category = CATEGORIES[activeCategoryIndex];
                const catColor = p.color(category?.color || ORBIT_TEAL);
                p.strokeWeight(2);
                p.stroke(p.red(catColor), p.green(catColor), p.blue(catColor), lineAlpha * 0.8);
                
                for (let i = 0; i < activeConstellationWords.length - 1; i++) {
                  p.line(
                    activeConstellationWords[i].initialPos.x,
                    activeConstellationWords[i].initialPos.y,
                    activeConstellationWords[i + 1].initialPos.x,
                    activeConstellationWords[i + 1].initialPos.y
                  );
                }
                // Close the constellation
                if (activeConstellationWords.length > 2) {
                  p.line(
                    activeConstellationWords[activeConstellationWords.length - 1].initialPos.x,
                    activeConstellationWords[activeConstellationWords.length - 1].initialPos.y,
                    firstWord.initialPos.x,
                    firstWord.initialPos.y
                  );
                }
                
                p.pop();
              }
            }

            // Draw constellation words
            for (const word of constellationWords) {
              word.draw();
            }

            // Draw embedding effects
            for (const ripple of embeddingRipples) {
              ripple.draw();
            }
            for (const particle of embeddingParticles) {
              particle.draw();
            }
            for (const particle of completionBurstParticles) {
              particle.draw();
            }
            
            // Draw streaming trail during embedding
            if (currentPhase === 'embedding' && activeCategoryIndex >= 0) {
              drawStreamingTrail();
            }
          }

          function drawStreamingTrail() {
            const currentCategory = CATEGORIES[activeCategoryIndex];
            const categorySpacing = metadataArea.h * 0.125; // 12.5% of panel height per category
            const categoryTop = metadataArea.y + activeCategoryIndex * categorySpacing;
            const categoryYCenter = categoryTop + (categorySpacing * 0.6) + 10;
            
            p.push();
            p.strokeWeight(2);
            p.noFill();
            
            for (let i = 0; i < 3; i++) {
              p.beginShape();
              for (let x = metadataArea.x + metadataArea.w; x > imageArea.x; x -= 5) {
                let y = categoryYCenter + p.sin((x + p.frameCount * 2 + i * 20) * 0.02) * (10 + i * 5);
                let alpha = p.map(x, metadataArea.x + metadataArea.w, imageArea.x, 80, 0);
                let lineColor = p.color(currentCategory.color);
                lineColor.setAlpha(alpha);
                p.stroke(lineColor);
                p.vertex(x, y);
              }
              p.endShape();
            }
            p.pop();
          }

          function drawReportPanel() {
            p.push();
            
            // Darker terminal-style background
            const reportBg = p.color(0, 0, 0, 250);
            p.fill(reportBg);
            p.noStroke();
            p.rect(metadataArea.x, metadataArea.y, metadataArea.w, metadataArea.h, 8);
            
            // Terminal border with glow effect
            p.noFill();
            p.stroke(0, 255, 100);
            p.strokeWeight(2);
            p.rect(metadataArea.x, metadataArea.y, metadataArea.w, metadataArea.h, 8);

            // Draw report content
            const visibleSections = Math.floor((reportProgress / 100) * reportSections.length);
            let yOffset = metadataArea.y + 12;
            const lineHeight = 16; // Increased line height for better readability
            
            p.textAlign(p.LEFT, p.TOP);
            // Use a lighter, more readable font setup
            p.textFont('Monaco, Consolas, monospace');
            
            for (let i = 0; i < Math.min(visibleSections, reportSections.length); i++) {
              const section = reportSections[i];
              
              if (yOffset > metadataArea.y + metadataArea.h - 20) break; // Stop if we run out of space
              
              if (section.type === 'header') {
                p.fill(100, 255, 255); // Softer cyan, more readable
                p.textSize(12);
                p.text(section.title, metadataArea.x + 10, yOffset);
                yOffset += lineHeight + 4;
              } else if (section.type === 'separator') {
                p.fill(80, 200, 80); // Softer green
                p.textSize(9);
                p.text(section.title, metadataArea.x + 10, yOffset);
                yOffset += lineHeight - 2;
              } else if (section.type === 'info') {
                p.fill(180, 180, 180); // Lighter gray for better contrast
                p.textSize(10);
                p.text(section.title, metadataArea.x + 10, yOffset);
                yOffset += lineHeight;
              } else if (section.type === 'spacer') {
                yOffset += lineHeight / 2;
              } else if (section.type === 'section') {
                p.fill(255, 200, 100); // Softer yellow-orange
                p.textSize(11);
                p.text(section.title, metadataArea.x + 10, yOffset);
                yOffset += lineHeight;
                
                if (section.data) {
                  p.fill(220, 220, 220); // Brighter gray for data
                  p.textSize(9);
                  Object.entries(section.data).forEach(([key, value]) => {
                    if (yOffset < metadataArea.y + metadataArea.h - 20) {
                      p.text(`    ${key}: ${value}`, metadataArea.x + 20, yOffset);
                      yOffset += lineHeight - 1;
                    }
                  });
                }
                yOffset += 3;
              } else if (section.type === 'section-header') {
                p.fill(255, 150, 255); // Softer magenta
                p.textSize(11);
                p.text(section.title, metadataArea.x + 10, yOffset);
                yOffset += lineHeight + 3;
              } else if (section.type === 'json') {
                p.fill(150, 220, 255); // Softer blue for JSON
                p.textSize(8);
                const jsonLines = section.title.split('\n');
                for (let line of jsonLines.slice(0, 8)) { // Show first 8 lines of JSON
                  if (yOffset < metadataArea.y + metadataArea.h - 20) {
                    p.text(line, metadataArea.x + 20, yOffset);
                    yOffset += lineHeight - 2;
                  }
                }
                if (jsonLines.length > 8) {
                  p.fill(180, 180, 180);
                  p.text('... [truncated]', metadataArea.x + 20, yOffset);
                }
              }
            }
            
            // Blinking terminal cursor - softer and less intrusive
            if (visibleSections < reportSections.length && p.frameCount % 60 < 30) {
              p.fill(120, 255, 120, 180); // Semi-transparent green
              p.noStroke();
              p.rect(metadataArea.x + 10, yOffset - 2, 6, 14);
            }
            
            p.pop();
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
            } else if (currentPhase === 'report') {
              progress = reportProgress;
              statusText = `Generating Report... ${Math.floor(progress)}%`;
              if (progress >= 100) {
                statusText = "Metadata Report Generated!";
              }
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
              if (currentPhase === 'report') {
                p.fill(ORBIT_GREEN);
              } else {
                p.fill(ORBIT_TEAL);
              }
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
              p.textSize(12);
              p.textAlign(p.CENTER, p.CENTER);
              
              // Add glow effect to words
              p.drawingContext.shadowBlur = 8;
              p.drawingContext.shadowColor = `rgba(${p.red(this.color)}, ${p.green(this.color)}, ${p.blue(this.color)}, 0.6)`;
              
              p.noStroke();
              p.fill(p.red(this.color), p.green(this.color), p.blue(this.color), this.alpha);
              p.text(this.text, this.pos.x, this.pos.y);
              
              // Reset shadow
              p.drawingContext.shadowBlur = 0;
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

              const categorySpacing = metadataArea.h * 0.125; // 12.5% of panel height per category
              const categoryTop = metadataArea.y + categoryIndex * categorySpacing;
              // Position tags in the lower 60% of category space, with 10px offset from title
              this.y = categoryTop + (categorySpacing * 0.6) + 10;

              // Initial position - will be recalculated after all tags are created
              this.x = metadataArea.x + 15;
            }

            // Method to position all tags in a category evenly
            static positionTagsInCategories(tags: MetadataTag[]) {
              const spacingBetweenTags = 6; // Reduced spacing for better fit
              const availableWidth = metadataArea.w - 40; // More margin

              // Group tags by category
              for (let categoryIndex = 0; categoryIndex < CATEGORIES.length; categoryIndex++) {
                const categoryTags = tags.filter(tag => tag.categoryIndex === categoryIndex);
                if (categoryTags.length === 0) continue;

                // Sort tags by wordIndex to maintain order
                categoryTags.sort((a, b) => a.wordIndex - b.wordIndex);

                // Calculate total width of all tags in this category
                const totalTagsWidth = categoryTags.reduce((sum, tag) => sum + tag.width, 0);
                const totalSpacingWidth = (categoryTags.length - 1) * spacingBetweenTags;
                
                // If tags don't fit, start from left edge; otherwise center them
                let startX;
                if (totalTagsWidth + totalSpacingWidth > availableWidth) {
                  startX = metadataArea.x + 15;
                } else {
                  startX = metadataArea.x + 15 + (availableWidth - totalTagsWidth - totalSpacingWidth) / 2;
                }
                
                // Position each tag
                let currentX = startX;
                for (const tag of categoryTags) {
                  tag.x = currentX;
                  currentX += tag.width + spacingBetweenTags;
                  
                  // Ensure tag doesn't overflow the panel horizontally
                  if (tag.x + tag.width > metadataArea.x + metadataArea.w - 10) {
                    tag.x = metadataArea.x + metadataArea.w - tag.width - 10;
                  }
                  
                  // Ensure tag doesn't overflow the panel vertically
                  if (tag.y + tag.height > metadataArea.y + metadataArea.h - 10) {
                    tag.y = metadataArea.y + metadataArea.h - tag.height - 10;
                  }
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

          class StreamingEmbeddingParticle {
            pos: any;
            startPos: any;
            color: any;
            lifespan: number;
            maxLifespan: number;
            categoryIndex: number;
            hasEmbedded: boolean;
            size: number;
            waveOffset: number;
            waveAmplitude: number;
            targetX: number;
            targetY: number;

            constructor(startPos: any, hexColor: string, categoryIndex: number) {
              this.pos = startPos.copy();
              this.startPos = startPos.copy();
              this.color = p.color(hexColor);
              this.lifespan = 120;
              this.maxLifespan = 120;
              this.categoryIndex = categoryIndex;
              this.hasEmbedded = false;
              this.size = p.random(2, 4);
              this.waveOffset = p.random(p.TWO_PI);
              this.waveAmplitude = p.random(20, 40);
              this.targetX = p.random(imageArea.x + 20, imageArea.x + imageArea.w - 20);
              this.targetY = p.random(imageArea.y + 20, imageArea.y + imageArea.h - 20);
            }

            update() {
              this.lifespan--;
              let progress = 1 - (this.lifespan / this.maxLifespan);
              this.pos.x = p.lerp(this.startPos.x, this.targetX, progress);
              let baseY = p.lerp(this.startPos.y, this.targetY, progress);
              this.pos.y = baseY + p.sin(progress * p.PI * 3 + this.waveOffset) * this.waveAmplitude * (1 - progress);
              
              if (this.pos.x <= imageArea.x + imageArea.w && !this.hasEmbedded) {
                if (this.pos.x >= imageArea.x && this.pos.y >= imageArea.y && this.pos.y <= imageArea.y + imageArea.h) {
                  this.hasEmbedded = true;
                  this.lifespan = p.min(this.lifespan, 20);
                }
              }
            }

            draw() {
              p.push();
              p.noStroke();
              let alpha = 255;
              let progress = 1 - (this.lifespan / this.maxLifespan);
              if (progress < 0.1) {
                alpha = p.map(progress, 0, 0.1, 0, 255);
              } else if (this.hasEmbedded) {
                alpha = p.map(this.lifespan, 0, 20, 0, 255);
              }
              
              if (!this.hasEmbedded) {
                let trailLength = 15;
                for (let i = 0; i < trailLength; i++) {
                  let trailAlpha = alpha * (1 - i / trailLength) * 0.3;
                  let trailX = this.pos.x + i * 2;
                  p.fill(p.red(this.color), p.green(this.color), p.blue(this.color), trailAlpha);
                  p.ellipse(trailX, this.pos.y, this.size * (1 - i / trailLength), this.size * (1 - i / trailLength));
                }
              }
              
              p.fill(p.red(this.color), p.green(this.color), p.blue(this.color), alpha);
              p.ellipse(this.pos.x, this.pos.y, this.size, this.size);
              
              let glowColor = p.color(this.color);
              glowColor.setAlpha(alpha * 0.3);
              p.fill(glowColor);
              p.ellipse(this.pos.x, this.pos.y, this.size * 2, this.size * 2);
              p.pop();
            }

            isDone() {
              return this.lifespan <= 0;
            }
          }

          class EmbeddingRipple {
            pos: any;
            color: any;
            radius: number;
            maxRadius: number;
            lifespan: number;
            maxLifespan: number;

            constructor(pos: any, hexColor: string) {
              this.pos = pos.copy();
              this.color = p.color(hexColor);
              this.radius = 0;
              this.maxRadius = 30;
              this.lifespan = 40;
              this.maxLifespan = 40;
            }

            update() {
              this.lifespan--;
              this.radius = p.map(this.lifespan, this.maxLifespan, 0, 0, this.maxRadius);
            }

            draw() {
              if (this.lifespan <= 0) return;
              p.push();
              p.noFill();
              let alpha = p.map(this.lifespan, 0, this.maxLifespan, 0, 150);
              p.strokeWeight(2);
              p.stroke(p.red(this.color), p.green(this.color), p.blue(this.color), alpha);
              p.ellipse(this.pos.x, this.pos.y, this.radius * 2, this.radius * 2);
              p.strokeWeight(1);
              let innerAlpha = alpha * 0.5;
              p.stroke(p.red(this.color), p.green(this.color), p.blue(this.color), innerAlpha);
              p.ellipse(this.pos.x, this.pos.y, this.radius, this.radius);
              p.pop();
            }

            isDone() {
              return this.lifespan <= 0;
            }
          }

          class CompletionBurstParticle {
            pos: any;
            vel: any;
            lifespan: number;
            color: any;

            constructor(centerPos: any) {
              this.pos = centerPos.copy();
              this.vel = (p as any).constructor.Vector.random2D().mult(p.random(2, 8));
              this.lifespan = 70;
              this.color = p.lerpColor(p.color(ORBIT_TEAL), p.color(SUCCESS_GREEN), p.random(1));
            }

            update() {
              this.vel.mult(0.95);
              this.pos.add(this.vel);
              this.lifespan--;
            }

            draw() {
              p.push();
              p.noStroke();
              let currentAlpha = p.map(this.lifespan, 0, 70, 0, 255);
              p.fill(p.red(this.color), p.green(this.color), p.blue(this.color), currentAlpha);
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
      
      {/* How ORBIT Works Section */}
      <div className="mt-8 bg-card/30 backdrop-blur-sm border border-accent/20 rounded-xl p-6">
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-center mb-2">
            <span className="gradient-text">How ORBIT Works</span>
          </h3>
          <p className="text-center text-muted-foreground">
            ORBIT's advanced AI doesn't just see images—it understands them across multiple dimensions, creating 
            rich metadata that powers better search, organization, and insights. The metadata is permanently 
            embedded into the image file using industry-standard XMP format that travels with your images across systems.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Analysis Phase */}
          <div className="bg-card/50 backdrop-blur-sm border border-accent/10 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-full flex items-center justify-center mr-3">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h4 className="text-lg font-semibold">Analysis Phase</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              ORBIT analyzes your image across 8 distinct categories to extract comprehensive metadata, 
              including scene overview, human elements, environment, key objects, atmospheric elements, 
              narrative analysis, photographic elements, and marketing potential.
            </p>
          </div>
          
          {/* Embedding Phase */}
          <div className="bg-card/50 backdrop-blur-sm border border-accent/10 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center mr-3">
                <div className="w-4 h-4 border-2 border-white rounded-sm opacity-80" />
              </div>
              <h4 className="text-lg font-semibold">Embedding Phase</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Each category of metadata is embedded sequentially into your image using XMP 
              (Extensible Metadata Platform) format. The process is visualized through colored particles 
              representing each metadata category flowing into the image.
            </p>
          </div>
          
          {/* Completion Phase */}
          <div className="bg-card/50 backdrop-blur-sm border border-accent/10 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mr-3">
                <div className="w-3 h-3 bg-white rounded-full" />
              </div>
              <h4 className="text-lg font-semibold">Completion Phase</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Once all metadata has been successfully embedded, you can download the enhanced 
              image with its rich embedded metadata. This metadata stays with your image as it moves 
              across different systems and applications, enabling better searchability and organization.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};