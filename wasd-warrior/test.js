
  document.addEventListener('DOMContentLoaded', function() {
      if (typeof AOS !== 'undefined') AOS.init({ duration: 800, easing: 'ease-out-cubic', once: true, offset: 40 });
      if (typeof VanillaTilt !== 'undefined') VanillaTilt.init(document.querySelectorAll('[data-tilt]'), { max: 6, speed: 400, glare: true, "max-glare": 0.12, scale: 1.01 });

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      let audioCtx;
      
      function initAudio() {
          if (!audioCtx) audioCtx = new AudioContext();
          if (audioCtx.state === 'suspended') audioCtx.resume();
      }

      function playSound(type) {
          if (!audioCtx) return;
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          
          const now = audioCtx.currentTime;
          
          if (type === 'correct') {
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(1200, now);
              osc.frequency.exponentialRampToValueAtTime(800, now + 0.03);
              gain.gain.setValueAtTime(0.3, now);
              gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
              osc.start(now);
              osc.stop(now + 0.03);
          } else if (type === 'wrong') {
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(180, now);
              gain.gain.setValueAtTime(0.3, now);
              gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
              osc.start(now);
              osc.stop(now + 0.1);
          } else if (type === 'combo') {
              osc.type = 'sine';
              osc.frequency.setValueAtTime(440, now);
              osc.frequency.setValueAtTime(554.37, now + 0.1);
              osc.frequency.setValueAtTime(659.25, now + 0.2);
              osc.frequency.setValueAtTime(880, now + 0.3);
              gain.gain.setValueAtTime(0.2, now);
              gain.gain.linearRampToValueAtTime(0, now + 0.5);
              osc.start(now);
              osc.stop(now + 0.5);
          } else if (type === 'gameover') {
              osc.type = 'square';
              osc.frequency.setValueAtTime(300, now);
              osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
              gain.gain.setValueAtTime(0.3, now);
              gain.gain.linearRampToValueAtTime(0, now + 0.5);
              osc.start(now);
              osc.stop(now + 0.5);
          }
      }

      const validCodes = [
          'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5',
          'Tab', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT',
          'CapsLock', 'KeyA', 'KeyS', 'KeyD', 'KeyF',
          'ShiftLeft', 'KeyZ', 'KeyX', 'KeyC', 'KeyV',
          'ControlLeft', 'Space'
      ];
      
      const keyMap = {};
      document.querySelectorAll('.stitch-key').forEach(el => {
          keyMap[el.dataset.code] = el;
      });

      let currentMode = 'single';
      let isPlaying = false;
      let round = 0;
      let maxRounds = 20;
      
      let totalReactionTime = 0;
      let hits = 0;
      let misses = 0;
      let streak = 0;
      let bestStreak = 0;
      let startTime = 0;
      
      let targetCode = null;
      let currentCombo = [];
      let comboIndex = 0;
      let survivalTimer = null;
      let survivalWindow = 1500;
      let perKeyStats = {};

      const btnStart = document.getElementById('btn-start');
      const btnReset = document.getElementById('btn-reset');
      const modePills = document.querySelectorAll('.mode-selector:not(.layout-selector):not(.size-selector) .mode-pill');
      const layoutPills = document.querySelectorAll('.layout-selector .mode-pill');
      const sizePills = document.querySelectorAll('.size-selector .mode-pill');
      
      const valReaction = document.getElementById('val-reaction');
      const valAccuracy = document.getElementById('val-accuracy');
      const valProgress = document.getElementById('val-progress');
      const valStreak = document.getElementById('val-streak');
      const cardProgress = document.getElementById('card-progress');
      
      const kbContainer = document.getElementById('kb-container');
      const comboDisplay = document.getElementById('combo-display');
      const chartArea = document.getElementById('key-chart-area');
      const chartContainer = document.getElementById('chart-bars-container');
      const kbInstruction = document.getElementById('kb-instruction');
      const instTitle = document.getElementById('inst-title');
      const instDesc = document.getElementById('inst-desc');
      
      const resultModal = document.getElementById('result-modal');
      const resRank = document.getElementById('res-rank');
      const resReaction = document.getElementById('res-reaction');
      const resAcc = document.getElementById('res-acc');
      const btnPlayAgain = document.getElementById('btn-play-again');
      const btnCloseModal = document.getElementById('btn-close-modal');

      let currentLayout = 'cluster';
      let activeCodes = [];

      const layoutDefinitions = {
          minimal: ['KeyW', 'KeyA', 'KeyS', 'KeyD'],
          cluster: ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyR', 'KeyF', 'ShiftLeft', 'Space', 'ControlLeft', 'Tab', 'Digit1', 'Digit2', 'Digit3', 'Digit4'],
          extended: validCodes
      };

      function updateLayout() {
          activeCodes = layoutDefinitions[currentLayout] || layoutDefinitions.extended;
          Object.values(keyMap).forEach(el => {
              if (activeCodes.includes(el.dataset.code)) {
                  el.classList.remove('hidden-key');
              } else {
                  el.classList.add('hidden-key');
              }
          });
      }
      
      layoutPills.forEach(pill => {
          pill.addEventListener('click', () => {
              if (isPlaying) return;
              layoutPills.forEach(p => p.classList.remove('active'));
              pill.classList.add('active');
              currentLayout = pill.dataset.layout;
              updateLayout();
          });
      });
      updateLayout();

      sizePills.forEach(pill => {
          pill.addEventListener('click', () => {
              if (isPlaying) return;
              sizePills.forEach(p => p.classList.remove('active'));
              pill.classList.add('active');
              kbContainer.classList.remove('kb-scale-compact', 'kb-scale-standard', 'kb-scale-large');
              kbContainer.classList.add(`kb-scale-${pill.dataset.size}`);
          });
      });

      modePills.forEach(pill => {
          pill.addEventListener('click', () => {
              if (isPlaying) return;
              modePills.forEach(p => p.classList.remove('active'));
              pill.classList.add('active');
              currentMode = pill.dataset.mode;
              updateUIMode();
          });
      });

      function updateUIMode() {
          if (currentMode === 'combo') {
              maxRounds = 10;
              cardProgress.querySelector('.label').textContent = 'COMBO';
              valProgress.textContent = `0/${maxRounds}`;
              instTitle.textContent = 'COMBO CHAIN';
              instDesc.textContent = 'Press keys in the shown sequence. 10 combos.';
          } else if (currentMode === 'survival') {
              cardProgress.querySelector('.label').textContent = 'SURVIVED';
              valProgress.textContent = '0';
              instTitle.textContent = 'SURVIVAL';
              instDesc.textContent = 'React faster each round. Miss = game over.';
          } else {
              maxRounds = 20;
              cardProgress.querySelector('.label').textContent = 'ROUND';
              valProgress.textContent = `0/${maxRounds}`;
              instTitle.textContent = 'SINGLE KEY';
              instDesc.textContent = 'Press the highlighted key as fast as you can. 20 rounds.';
          }
          resetStats();
      }

      function resetStats() {
          totalReactionTime = 0;
          hits = 0;
          misses = 0;
          streak = 0;
          bestStreak = 0;
          round = 0;
          perKeyStats = {};
          
          valReaction.textContent = '---';
          valAccuracy.textContent = '---';
          valStreak.textContent = '0';
          if (currentMode === 'survival') valProgress.textContent = '0';
          else valProgress.textContent = `0/${maxRounds}`;
          
          clearHighlight();
          comboDisplay.style.display = 'none';
          comboDisplay.innerHTML = '';
          chartArea.style.display = 'none';
          kbContainer.classList.remove('shake-animation');
          kbInstruction.style.opacity = '1';
      }

      function startGame() {
          initAudio();
          if (isPlaying) return;
          isPlaying = true;
          resetStats();
          kbInstruction.style.opacity = '0';
          btnStart.textContent = 'IN PROGRESS...';
          btnStart.disabled = true;
          
          if (currentMode === 'single') {
              nextSingleTarget();
          } else if (currentMode === 'combo') {
              comboDisplay.style.display = 'flex';
              nextComboTarget();
          } else if (currentMode === 'survival') {
              survivalWindow = 1500;
              nextSurvivalTarget();
          }
      }

      function stopGame() {
          isPlaying = false;
          btnStart.textContent = 'START TRAINING';
          btnStart.disabled = false;
          kbInstruction.style.opacity = '1';
          clearHighlight();
          if (survivalTimer) clearTimeout(survivalTimer);
          showResults();
      }

      btnStart.addEventListener('click', startGame);
      btnReset.addEventListener('click', () => {
          if (isPlaying) {
              isPlaying = false;
              btnStart.textContent = 'START TRAINING';
              btnStart.disabled = false;
              if (survivalTimer) clearTimeout(survivalTimer);
          }
          resetStats();
      });

      function clearHighlight() {
          Object.values(keyMap).forEach(el => {
              el.classList.remove('active-glow', 'pressed-correct', 'pressed-wrong');
          });
      }

      function updateMetricsDisplay(rt) {
          if (rt) {
              valReaction.textContent = Math.round(totalReactionTime / hits);
          }
          const total = hits + misses;
          const acc = total > 0 ? Math.round((hits / total) * 100) : 0;
          valAccuracy.textContent = `${acc}`;
          valStreak.textContent = streak;
          
          if (currentMode === 'survival') {
              valProgress.textContent = round;
          } else {
              valProgress.textContent = `${round}/${maxRounds}`;
          }
      }

      function nextSingleTarget() {
          if (round >= maxRounds) {
              stopGame();
              return;
          }
          round++;
          clearHighlight();
          targetCode = activeCodes[Math.floor(Math.random() * activeCodes.length)];
          keyMap[targetCode].classList.add('active-glow');
          startTime = performance.now();
      }

      function nextComboTarget() {
          if (round >= maxRounds) {
              stopGame();
              return;
          }
          round++;
          clearHighlight();
          
          let len = 3;
          if (round > 3) len = 4;
          if (round > 7) len = 5;
          
          currentCombo = [];
          comboDisplay.innerHTML = '';
          
          for (let i=0; i<len; i++) {
              let code = activeCodes[Math.floor(Math.random() * activeCodes.length)];
              currentCombo.push(code);
              
              let span = document.createElement('span');
              span.className = 'combo-key';
              let keyName = keyMap[code].textContent.trim();
              span.textContent = keyName;
              comboDisplay.appendChild(span);
              
              if (i < len - 1) {
                  let arr = document.createElement('span');
                  arr.className = 'combo-arrow';
                  arr.textContent = '→';
                  comboDisplay.appendChild(arr);
              }
          }
          comboIndex = 0;
          startTime = performance.now();
      }

      function nextSurvivalTarget() {
          round++;
          clearHighlight();
          
          if (round >= 6) survivalWindow = 1000;
          if (round >= 11) survivalWindow = 700;
          if (round >= 16) survivalWindow = 500;
          
          targetCode = activeCodes[Math.floor(Math.random() * activeCodes.length)];
          keyMap[targetCode].classList.add('active-glow');
          startTime = performance.now();
          
          updateMetricsDisplay();
          
          survivalTimer = setTimeout(() => {
              misses++;
              streak = 0;
              playSound('gameover');
              keyMap[targetCode].classList.remove('active-glow');
              keyMap[targetCode].classList.add('pressed-wrong');
              triggerShake();
              setTimeout(() => stopGame(), 500);
          }, survivalWindow);
      }

      function triggerShake() {
          kbContainer.classList.remove('shake-animation');
          void kbContainer.offsetWidth;
          kbContainer.classList.add('shake-animation');
      }

      document.addEventListener('keydown', (e) => {
          if (!isPlaying) {
              if (activeCodes.includes(e.code) && !e.repeat && currentMode !== 'combo') {
                  const el = keyMap[e.code];
                  if(el) {
                      el.classList.add('active-glow');
                      setTimeout(() => el.classList.remove('active-glow'), 150);
                  }
              }
              return;
          }
          
          if (activeCodes.includes(e.code)) {
              e.preventDefault();
          }
          
          if (e.repeat) return;
          
          const code = e.code;
          if (!activeCodes.includes(code)) return;
          
          const rt = performance.now() - startTime;
          const el = keyMap[code];

          if (currentMode === 'single') {
              if (code === targetCode) {
                  hits++;
                  streak++;
                  if(streak > bestStreak) bestStreak = streak;
                  totalReactionTime += rt;
                  
                  if (!perKeyStats[code]) perKeyStats[code] = { hits: 0, time: 0 };
                  perKeyStats[code].hits++;
                  perKeyStats[code].time += rt;
                  
                  playSound('correct');
                  el.classList.remove('active-glow');
                  el.classList.add('pressed-correct');
                  updateMetricsDisplay(rt);
                  setTimeout(nextSingleTarget, 200);
              } else {
                  misses++;
                  streak = 0;
                  playSound('wrong');
                  el.classList.add('pressed-wrong');
                  triggerShake();
                  updateMetricsDisplay();
                  setTimeout(() => el.classList.remove('pressed-wrong'), 200);
              }
          } 
          else if (currentMode === 'combo') {
              if (code === currentCombo[comboIndex]) {
                  el.classList.add('pressed-correct');
                  setTimeout(() => el.classList.remove('pressed-correct'), 150);
                  
                  const keyDivs = comboDisplay.querySelectorAll('.combo-key');
                  keyDivs[comboIndex].classList.add('completed');
                  
                  comboIndex++;
                  if (comboIndex >= currentCombo.length) {
                      hits++;
                      streak++;
                      if(streak > bestStreak) bestStreak = streak;
                      totalReactionTime += rt; 
                      playSound('combo');
                      updateMetricsDisplay(rt);
                      setTimeout(nextComboTarget, 300);
                  } else {
                      playSound('correct');
                  }
              } else {
                  misses++;
                  streak = 0;
                  playSound('wrong');
                  el.classList.add('pressed-wrong');
                  triggerShake();
                  updateMetricsDisplay();
                  setTimeout(() => el.classList.remove('pressed-wrong'), 200);
                  
                  comboIndex = 0;
                  const keyDivs = comboDisplay.querySelectorAll('.combo-key');
                  keyDivs.forEach(k => k.classList.remove('completed'));
              }
          }
          else if (currentMode === 'survival') {
              if (code === targetCode) {
                  clearTimeout(survivalTimer);
                  hits++;
                  streak++;
                  if(streak > bestStreak) bestStreak = streak;
                  totalReactionTime += rt;
                  
                  playSound('correct');
                  el.classList.remove('active-glow');
                  el.classList.add('pressed-correct');
                  updateMetricsDisplay(rt);
                  setTimeout(nextSurvivalTarget, 200);
              } else {
                  clearTimeout(survivalTimer);
                  misses++;
                  streak = 0;
                  playSound('gameover');
                  el.classList.add('pressed-wrong');
                  triggerShake();
                  updateMetricsDisplay();
                  setTimeout(() => stopGame(), 500);
              }
          }
      });

      function getRank(avgRt) {
          if (avgRt === 0 || isNaN(avgRt)) return { name: "NO SCORE", color: "#888" };
          
          if (currentMode === 'survival') {
               if (round >= 20) return { name: "GODLIKE", color: "#c084fc" };
               if (round >= 15) return { name: "MASTER", color: "#ff4444" };
               if (round >= 10) return { name: "PRO", color: "#00ffa3" };
               if (round >= 5) return { name: "GAMER", color: "#00e5ff" };
               return { name: "ROOKIE", color: "#ff9900" };
          }
          
          let thresholdMult = (currentMode === 'combo') ? 3 : 1;
          
          if (avgRt < 180 * thresholdMult) return { name: "GODLIKE", color: "#c084fc" };
          if (avgRt < 250 * thresholdMult) return { name: "MASTER", color: "#ff4444" };
          if (avgRt < 350 * thresholdMult) return { name: "PRO", color: "#00ffa3" };
          if (avgRt < 500 * thresholdMult) return { name: "GAMER", color: "#00e5ff" };
          if (avgRt < 700 * thresholdMult) return { name: "ROOKIE", color: "#ff9900" };
          return { name: "TURTLE", color: "#888" };
      }

      function showResults() {
          const avg = hits > 0 ? Math.round(totalReactionTime / hits) : 0;
          const total = hits + misses;
          const acc = total > 0 ? Math.round((hits / total) * 100) : 0;
          
          const rank = getRank(avg);
          
          resRank.textContent = rank.name;
          resRank.style.color = rank.color;
          
          if (currentMode === 'survival') {
              resReaction.textContent = `${round} RNDS`;
          } else {
              resReaction.textContent = `${avg}ms`;
          }
          resAcc.textContent = `${acc}%`;
          
          if (hits > 0) {
              const history = JSON.parse(localStorage.getItem('csl_wasd_history') || '[]');
              history.push({
                  date: new Date().toISOString(),
                  mode: currentMode,
                  avgRt: avg,
                  acc: acc,
                  score: currentMode === 'survival' ? round : avg
              });
              localStorage.setItem('csl_wasd_history', JSON.stringify(history.slice(-20))); 
          }

          if (currentMode === 'single' && hits > 0) {
              chartArea.style.display = 'block';
              chartContainer.innerHTML = '';
              
              let maxRt = 0;
              const statsArr = [];
              for (const [code, stat] of Object.entries(perKeyStats)) {
                  let avgT = stat.time / stat.hits;
                  if (avgT > maxRt) maxRt = avgT;
                  statsArr.push({ code, avgT });
              }
              
              statsArr.sort((a,b) => b.avgT - a.avgT); 
              
              statsArr.forEach(item => {
                  const keyName = keyMap[item.code].textContent.trim() || item.code;
                  const pct = Math.min((item.avgT / (maxRt * 1.1)) * 100, 100);
                  
                  const row = document.createElement('div');
                  row.className = 'chart-bar-row';
                  row.innerHTML = `
                      <div class="chart-label">${keyName}</div>
                      <div class="chart-bar-wrap">
                          <div class="chart-bar-fill" style="width: ${pct}%;"></div>
                      </div>
                      <div class="chart-value">${Math.round(item.avgT)}ms</div>
                  `;
                  chartContainer.appendChild(row);
              });
          }

          resultModal.classList.add('show');
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: [rank.color, '#ffffff'] });
      }

      btnPlayAgain.addEventListener('click', () => {
          resultModal.classList.remove('show');
          startGame();
      });
      btnCloseModal.addEventListener('click', () => {
          resultModal.classList.remove('show');
      });
  });
  