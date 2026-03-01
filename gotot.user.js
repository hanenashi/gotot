// ==UserScript==
// @name         GoToT
// @namespace    http://tampermonkey.net/
// @version      2.5.0
// @description  Adds a "Go To Date" navigation to pagers on Okoun.cz with a JSON-backed Hyena news overlay
// @author       kokochan
// @match        https://www.okoun.cz/boards/*
// @grant        none
// @homepageURL  https://github.com/hanenashi/gotot
// @supportURL   https://github.com/hanenashi/gotot/issues
// @updateURL    https://github.com/hanenashi/gotot/raw/main/gotot.user.js
// @downloadURL  https://github.com/hanenashi/gotot/raw/main/gotot.user.js
// ==/UserScript==

(function() {
    'use strict';

    // 1. Spolehlivá hardwarová detekce dotykového zařízení
    const isTouchDevice = (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0));
    const isMobileUA = /Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isMobile = isTouchDevice || isMobileUA;

    // 2. Styles
    const styleEl = document.createElement('style');
    styleEl.textContent = `
        li.goto-nav-item {
            display: inline-flex; align-items: center; margin-right: 10px;
            vertical-align: middle; position: relative; top: -2px;
        }
        .goto-input {
            background: #ffffff; border: 1px solid #aaa; color: #000;
            font-family: Arial, sans-serif; font-size: 11px;
            padding: 2px 4px; border-radius: 3px; outline: none; width: 115px;
        }
        .goto-input:focus { border-color: #d35400; }
        
        .goto-btn {
            background: transparent; border: none; color: #777;
            cursor: pointer; font-size: 13px; padding: 2px 5px; margin-left: 2px;
        }
        .goto-btn:hover { color: #d35400; }

        /* --- Overlay Styles (DARK) --- */
        #gotot-overlay {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(8px);
            z-index: 999999; display: flex; align-items: center; justify-content: center;
            font-family: Arial, sans-serif;
        }
        #gotot-modal {
            background: #1a1a1a; border: 2px solid #d35400; border-radius: 6px;
            width: 90%; max-width: 550px; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.8);
            color: #ccc; transition: all 0.3s ease;
        }
        .gotot-modal-title { margin: 0 0 15px 0; color: #d35400; font-size: 18px; border-bottom: 1px solid #333; padding-bottom: 10px; }
        #gotot-hyena-date { color: #888; font-size: 13px; float: right; margin-top: 4px; }
        #gotot-hyena-content { min-height: 100px; font-size: 13px; line-height: 1.6; }
        .gotot-hyena-list { list-style-type: square; padding-left: 20px; margin: 0; color: #bbb; }
        .gotot-hyena-list li { margin-bottom: 6px; }
        #gotot-status-text { margin-top: 20px; font-weight: bold; text-align: center; color: #fff; }
        .gotot-buttons { display: flex; gap: 10px; margin-top: 15px; }
        .gotot-action-btn { flex: 1; padding: 10px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; }
        #gotot-cancel-btn { background: #444; color: #fff; }
        #gotot-cancel-btn:hover { background: #555; }
        #gotot-continue-btn { background: #d35400; color: #fff; display: none; }
        #gotot-continue-btn:hover { background: #e67e22; }

        /* --- Overlay Styles (LIGHT) --- */
        #gotot-modal.gotot-light {
            background: #fdfdfd; border-color: #d35400; color: #333;
        }
        #gotot-modal.gotot-light .gotot-modal-title { border-bottom-color: #ddd; }
        #gotot-modal.gotot-light #gotot-hyena-date { color: #666; }
        #gotot-modal.gotot-light .gotot-hyena-list { color: #444; }
        #gotot-modal.gotot-light #gotot-status-text { color: #111; }
        #gotot-modal.gotot-light #gotot-cancel-btn { background: #ccc; color: #222; }
        #gotot-modal.gotot-light #gotot-cancel-btn:hover { background: #bbb; }

        /* --- Custom Context Menu --- */
        #gotot-context-menu {
            position: absolute; z-index: 9999999; min-width: 190px;
            background: #222; border: 1px solid #444; border-radius: 6px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.5); padding: 5px 0;
            font-family: Arial, sans-serif; color: #ddd; font-size: 13px;
        }
        #gotot-context-menu.gotot-light-menu {
            background: #fdfdfd; border-color: #ccc; color: #333;
        }
        .gotot-menu-item {
            padding: 10px 15px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;
        }
        .gotot-menu-item:hover { background: #d35400; color: #fff; }
        .gotot-menu-version {
            padding: 6px 15px; font-size: 10px; color: #777; border-top: 1px solid #444; margin-top: 5px; text-align: right;
        }
        #gotot-context-menu.gotot-light-menu .gotot-menu-version {
            border-top-color: #eee; color: #888;
        }

        /* --- Toast Notification --- */
        #gotot-toast {
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
            background: rgba(211, 84, 0, 0.95); color: #fff; padding: 12px 24px;
            border-radius: 30px; z-index: 999999; font-family: Arial, sans-serif;
            font-size: 14px; font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            opacity: 0; transition: opacity 0.5s ease-in-out; pointer-events: none; text-align: center;
        }

        /* --- Mobile UX pro lištu --- */
        li.gotot-mobile {
            width: 32px; height: 32px; justify-content: center; margin-right: 5px;
            -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
        }
        li.gotot-mobile .goto-input { 
            position: absolute !important; top: 0 !important; left: 0 !important; 
            width: 100% !important; height: 100% !important; opacity: 0 !important; 
            margin: 0 !important; padding: 0 !important; border: none !important; 
            z-index: 10 !important; cursor: pointer !important; -webkit-appearance: none !important;
        } 
        li.gotot-mobile .goto-btn { 
            font-size: 18px; padding: 2px; margin: 0; z-index: 1; pointer-events: none; 
        }
    `;
    document.head.appendChild(styleEl);

    // --- Helpers ---
    function parseCzechDate(dateStr) {
        const regex = /(\d+)\.\s*([a-zA-ZáčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]+|\d+\.)\s+(\d{4})(?:\s*,?\s*(\d{1,2}:\d{2}(?::\d{2})?))?/;
        const match = dateStr.match(regex);
        if (!match) return 0;
        
        const day = parseInt(match[1], 10);
        let monthStr = match[2].toLowerCase().replace('.', '').trim();
        const year = parseInt(match[3], 10);
        const timeStr = match[4] || "00:00:00";
        
        const months = {'ledna':0,'února':1,'března':2,'dubna':3,'května':4,'června':5,'července':6,'srpna':7,'září':8,'října':9,'listopadu':10,'prosince':11};
        
        let mon;
        if (months[monthStr] !== undefined) {
            mon = months[monthStr];
        } else if (!isNaN(parseInt(monthStr, 10))) {
            mon = parseInt(monthStr, 10) - 1;
        } else {
            return 0;
        }

        const timeParts = timeStr.split(':');
        const h = parseInt(timeParts[0] || 0, 10);
        const m = parseInt(timeParts[1] || 0, 10);
        const s = parseInt(timeParts[2] || 0, 10);
        
        return new Date(year, mon, day, h, m, s).getTime();
    }

    function formatCzechDate(dateObj) {
        const days = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
        const months = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
        return `${days[dateObj.getDay()]} ${dateObj.getDate()}. ${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
    }

    function getOkounDateParam(dateObj) {
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        return `${yyyy}${mm}${dd}-000000`;
    }

    function showToast(msg) {
        const toast = document.createElement('div');
        toast.id = 'gotot-toast';
        toast.innerText = msg;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '1'; }, 50);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 5000);
    }

    function updateStatus(textHtml) {
        const statusEl = document.getElementById('gotot-status-text');
        if (statusEl) statusEl.innerHTML = textHtml;
    }

    // --- Boundary Checking Logic (Po načtení stránky) ---
    function checkBoundaries() {
        const targetDateStr = sessionStorage.getItem('gotot_jump_target');
        if (!targetDateStr) return;
        sessionStorage.removeItem('gotot_jump_target');
        
        const targetTs = new Date(targetDateStr).getTime();
        if (isNaN(targetTs)) return;

        let newest = 0;
        let oldest = Infinity;
        
        document.querySelectorAll('.listing .item .permalink a.date').forEach(dEl => {
            const text = dEl.innerText || dEl.textContent;
            const ts = parseCzechDate(text.trim());
            if (ts > 0) {
                if (ts > newest) newest = ts;
                if (ts < oldest) oldest = ts;
            }
        });

        if (oldest !== Infinity && newest !== 0) {
            const pager = document.querySelector('.pager');
            if (!pager) return; 
            
            const hasOlder = !!pager.querySelector('.older a, .oldest a') || Array.from(pager.querySelectorAll('a')).some(a => a.innerText.includes('Starší'));
            const hasNewer = !!pager.querySelector('.newer a, .newest a') || Array.from(pager.querySelectorAll('a')).some(a => a.innerText.includes('Novější'));

            const margin = 86400000;

            if (targetTs < (oldest - margin) && !hasOlder) {
                showToast("⏳ Klub v této době ještě neexistoval. Zobrazuji nejstarší dostupný záznam.");
            } else if (targetTs > (newest + margin) && !hasNewer) {
                showToast("⏳ Hledáte příliš v budoucnosti. Zobrazuji nejnovější dostupný záznam.");
            }
        }
    }

    // --- UI Management (The News Overlay) ---
    let overlayEl = null;

    function createOverlay(targetDateStr) {
        if (overlayEl) return;
        
        const initDisplay = formatCzechDate(new Date(targetDateStr));
        
        overlayEl = document.createElement('div');
        overlayEl.id = 'gotot-overlay';
        overlayEl.innerHTML = `
            <div id="gotot-modal">
                <h3 class="gotot-modal-title">Stroj času <span id="gotot-hyena-date">${initDisplay}</span></h3>
                <div id="gotot-hyena-content"><i>Ověřuji časoprostor...</i></div>
                <div id="gotot-status-text">Ověřuji existenci klubu v zadaném datu...</div>
                <div class="gotot-buttons">
                    <button id="gotot-cancel-btn" class="gotot-action-btn">Zavřít zprávy</button>
                    <button id="gotot-continue-btn" class="gotot-action-btn" style="display: none;">Dokončit skok</button>
                </div>
            </div>`;
        document.body.appendChild(overlayEl);

        if (localStorage.getItem('gotot_light_theme') === 'true') {
            document.getElementById('gotot-modal').classList.add('gotot-light');
        }

        document.getElementById('gotot-cancel-btn').addEventListener('click', closeOverlay);
    }

    function closeOverlay() {
        if (overlayEl) {
            overlayEl.remove();
            overlayEl = null;
        }
    }

    // --- Data Fetching (Vanilla Fetch API) ---
    let hyenaDBCache = {}; 

    function fetchHyenaNews(targetDateStr) {
        const d = new Date(targetDateStr);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        
        const contentEl = document.getElementById('gotot-hyena-content');
        if (!contentEl) return;

        const renderNews = (yearDB) => {
            let searchKey = `${yyyy}-${mm}-${dd}`;
            let newsItems = yearDB[searchKey];
            let foundKey = searchKey;

            if (!newsItems) {
                const targetTime = d.getTime();
                let minDiff = Infinity;
                let bestKey = null;

                for (const key of Object.keys(yearDB)) {
                    const kTime = new Date(key).getTime();
                    const diff = Math.abs(kTime - targetTime);
                    
                    if (diff < minDiff) {
                        minDiff = diff;
                        bestKey = key;
                    } 
                }

                if (bestKey) {
                    newsItems = yearDB[bestKey];
                    foundKey = bestKey;
                }
            }

            const dateSpan = document.getElementById('gotot-hyena-date');
            if (foundKey !== searchKey && dateSpan) {
                let displayDate = formatCzechDate(new Date(foundKey));
                dateSpan.innerHTML = `${displayDate} <span style="font-size:12px; color:#f39c12; margin-left:5px;">(nejbližší vydání)</span>`;
            }

            if (newsItems && newsItems.length > 0) {
                let listHtml = '<ul class="gotot-hyena-list">';
                newsItems.forEach(item => { listHtml += `<li>${item}</li>`; });
                listHtml += '</ul>';
                contentEl.innerHTML = listHtml;
            } else {
                contentEl.innerHTML = `<i>Databáze zpráv pro tento rok je zatím prázdná.</i>`;
            }
        };

        if (hyenaDBCache[yyyy]) {
            renderNews(hyenaDBCache[yyyy]);
            return;
        }

        const archiveUrl = `https://raw.githubusercontent.com/hanenashi/gotot/main/db/hyena_${yyyy}.json`;

        fetch(archiveUrl)
            .then(response => {
                if (response.status === 404) throw new Error("404");
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then(data => {
                hyenaDBCache[yyyy] = data;
                renderNews(hyenaDBCache[yyyy]);
            })
            .catch(error => {
                if (error.message === "404") {
                    contentEl.innerHTML = `<i>Databáze zpráv pro rok ${yyyy} zatím nebyla nalezena.</i>`;
                } else {
                    contentEl.innerHTML = `<i>Nepodařilo se připojit k databázi zpráv.</i>`;
                    console.error("GoToT Fetch Error:", error);
                }
            });
    }

    // --- The Asynchronous "Native" Time Jump ---
    async function performScan(targetDateStr) {
        const targetDate = new Date(targetDateStr);
        if (isNaN(targetDate.getTime())) return;

        // Uložíme cíl pro zobrazení Toatsu na finální stránce
        sessionStorage.setItem('gotot_jump_target', targetDateStr);

        const okounParam = getOkounDateParam(targetDate);
        const cleanBaseUrl = window.location.href.split('?')[0].split('#')[0];
        const finalUrl = `${cleanBaseUrl}?f=${okounParam}`;

        let skipOverlay = localStorage.getItem('gotot_skip_overlay') === 'true';
        if (skipOverlay) {
            window.location.href = finalUrl;
            return;
        }

        createOverlay(targetDateStr);
        
        try {
            // Skryté ověření stránky na pozadí, abychom znali reálné hranice PŘED načtením zpráv
            const response = await fetch(finalUrl);
            const text = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');

            let newest = 0;
            let oldest = Infinity;
            
            doc.querySelectorAll('.listing .item .permalink a.date').forEach(dEl => {
                const textContent = dEl.innerText || dEl.textContent;
                const ts = parseCzechDate(textContent.trim());
                if (ts > 0) {
                    if (ts > newest) newest = ts;
                    if (ts < oldest) oldest = ts;
                }
            });

            const pager = doc.querySelector('.pager');
            let hasOlder = false;
            let hasNewer = false;
            if (pager) {
                hasOlder = !!pager.querySelector('.older a, .oldest a') || Array.from(pager.querySelectorAll('a')).some(a => a.innerText.includes('Starší'));
                hasNewer = !!pager.querySelector('.newer a, .newest a') || Array.from(pager.querySelectorAll('a')).some(a => a.innerText.includes('Novější'));
            }

            const targetTs = targetDate.getTime();
            const margin = 86400000;
            let adjustedTargetStr = targetDateStr;
            let boundaryMsg = "";

            if (oldest !== Infinity && newest !== 0) {
                if (targetTs < (oldest - margin) && !hasOlder) {
                    boundaryMsg = "<span style='color:#e74c3c;'>Klub v této době ještě neexistoval. Zobrazuji zprávy pro nejstarší dostupný záznam.</span><br><br>";
                    const d = new Date(oldest);
                    adjustedTargetStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                } else if (targetTs > (newest + margin) && !hasNewer) {
                    boundaryMsg = "<span style='color:#e74c3c;'>Hledáte příliš v budoucnosti. Zobrazuji zprávy pro nejnovější dostupný záznam.</span><br><br>";
                    const d = new Date(newest);
                    adjustedTargetStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                }
            }

            // Pokud jsme narazili na okraj času, upravíme i zobrazené datum v hlavičce
            if (adjustedTargetStr !== targetDateStr) {
                const initDisplay = formatCzechDate(new Date(adjustedTargetStr));
                const dateSpan = document.getElementById('gotot-hyena-date');
                if (dateSpan) dateSpan.innerHTML = initDisplay;
            }

            // Teprve TEĎ stahujeme zprávy z Hyeny na základě ověřeného (nebo původního) data
            fetchHyenaNews(adjustedTargetStr);
            updateStatus(boundaryMsg + "Přesun připraven!");

        } catch (err) {
            console.error("GoToT Verification Error", err);
            // Fallback v případě výpadku sítě - načteme zprávy bez ověření
            fetchHyenaNews(targetDateStr);
            updateStatus("Přesun připraven!");
        }

        const continueBtn = document.getElementById('gotot-continue-btn');
        if (continueBtn) {
            continueBtn.style.display = 'block';
            continueBtn.onclick = () => { window.location.href = finalUrl; };
        }
    }

    // --- Custom Context Menu ---
    function handleContextMenu(e, anchorLi) {
        e.preventDefault();
        
        const existing = document.getElementById('gotot-context-menu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.id = 'gotot-context-menu';
        
        let x = e.pageX;
        let y = e.pageY;
        if ((x === undefined || x === 0) && e.changedTouches && e.changedTouches.length > 0) {
            x = e.changedTouches[0].pageX;
            y = e.changedTouches[0].pageY;
        }
        if (x === undefined || x === 0) {
            const rect = anchorLi.getBoundingClientRect();
            x = rect.left + window.scrollX;
            y = rect.bottom + window.scrollY;
        }
        
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        function renderMenuContent() {
            const skip = localStorage.getItem('gotot_skip_overlay') === 'true';
            const light = localStorage.getItem('gotot_light_theme') === 'true';
            
            if (light) menu.classList.add('gotot-light-menu');
            else menu.classList.remove('gotot-light-menu');

            menu.innerHTML = `
                <div class="gotot-menu-item" id="gotot-menu-news">
                    <span>Retro zprávy:</span> <strong style="color: ${skip ? '#c0392b' : '#27ae60'}">${skip ? 'VYP' : 'ZAP'}</strong>
                </div>
                <div class="gotot-menu-item" id="gotot-menu-theme">
                    <span>Téma okna:</span> <strong style="color: #2980b9">${light ? 'SVĚTLÉ' : 'TMAVÉ'}</strong>
                </div>
                <div class="gotot-menu-version">GoToT v2.5.0</div>
            `;
            
            menu.querySelector('#gotot-menu-news').onclick = (ev) => {
                ev.stopPropagation();
                localStorage.setItem('gotot_skip_overlay', !skip);
                menu.remove(); 
            };
            menu.querySelector('#gotot-menu-theme').onclick = (ev) => {
                ev.stopPropagation();
                localStorage.setItem('gotot_light_theme', !light);
                menu.remove(); 
            };
        }
        
        renderMenuContent();
        document.body.appendChild(menu);

        setTimeout(() => {
            document.addEventListener('click', function clickOut(ev) {
                if (menu && !menu.contains(ev.target)) {
                    menu.remove();
                    document.removeEventListener('click', clickOut);
                }
            });
        }, 50);
    }

    // --- Init ---
    function init() {
        checkBoundaries();

        const pagerNavs = document.querySelectorAll('.pager > ul.nav:first-of-type');
        pagerNavs.forEach(nav => {
            const li = document.createElement('li');
            li.className = 'goto-nav-item';
            
            const input = document.createElement('input');
            input.type = 'date';
            input.className = 'goto-input';
            input.title = 'Vyber datum a leť!';
            
            const btn = document.createElement('button');
            btn.className = 'goto-btn';
            btn.innerHTML = '🔍';
            btn.title = 'Pravé tl. (nebo dlouhý stisk) pro nastavení skoků';

            const go = () => { if (input.value) performScan(input.value); };

            input.addEventListener('change', go);
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });

            if (isMobile) {
                li.classList.add('gotot-mobile');
                li.appendChild(input);
                li.appendChild(btn);
            } else {
                btn.addEventListener('click', (e) => { 
                    e.preventDefault(); 
                    go(); 
                });
                li.appendChild(input);
                li.appendChild(btn);
            }

            li.addEventListener('contextmenu', (e) => handleContextMenu(e, li));

            nav.insertBefore(li, nav.firstChild);
        });
    }

    init();
})();
