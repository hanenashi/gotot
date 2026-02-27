// ==UserScript==
// @name         GoToT
// @namespace    http://tampermonkey.net/
// @version      1.7.1
// @description  Adds a "Go To Date" navigation to pagers on Okoun.cz with a JSON-backed Hyena news overlay
// @author       kokochan
// @match        https://www.okoun.cz/boards/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @homepageURL  https://github.com/hanenashi/gotot
// @supportURL   https://github.com/hanenashi/gotot/issues
// @updateURL    https://github.com/hanenashi/gotot/raw/main/gotot.user.js
// @downloadURL  https://github.com/hanenashi/gotot/raw/main/gotot.user.js
// ==/UserScript==

(function() {
    'use strict';

    // 1. Styles
    GM_addStyle(`
        li.goto-nav-item {
            display: inline-flex; align-items: center; margin-right: 10px;
            vertical-align: middle; position: relative; top: -2px;
        }
        .goto-input {
            background: #222; border: 1px solid #444; color: #ddd;
            font-family: Arial, sans-serif; font-size: 11px;
            padding: 2px 4px; border-radius: 3px; outline: none; width: 115px;
        }
        .goto-input:focus { border-color: #d35400; color: #fff; }
        .goto-input.scanning { background: #331a00; border-color: #d35400; cursor: wait; }
        
        .goto-btn {
            background: transparent; border: none; color: #777;
            cursor: pointer; font-size: 12px; padding: 2px 5px; margin-left: 2px;
        }
        .goto-btn:hover { color: #d35400; }

        /* --- Overlay Styles --- */
        #gotot-overlay {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(8px);
            z-index: 999999; display: flex; align-items: center; justify-content: center;
            font-family: Arial, sans-serif;
        }
        #gotot-modal {
            background: #1a1a1a; border: 2px solid #d35400; border-radius: 6px;
            width: 90%; max-width: 550px; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.8);
            color: #ccc;
        }
        .gotot-modal-title { margin: 0 0 15px 0; color: #d35400; font-size: 18px; border-bottom: 1px solid #333; padding-bottom: 10px; }
        #gotot-hyena-date { color: #888; font-size: 12px; float: right; margin-top: 4px; }
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

        @media (max-width: 600px) { .goto-input { width: 90px; } }
    `);

    // --- Helpers ---
    function parseCzechDate(dateStr) {
        const regex = /(\d+)\.\s*([a-zA-ZáčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]+)\s+(\d{4})(?:\s*,?\s*(\d{1,2}:\d{2}(?::\d{2})?))?/;
        const match = dateStr.match(regex);
        if (!match) return 0;
        const day = parseInt(match[1], 10);
        const monthStr = match[2].toLowerCase();
        const year = parseInt(match[3], 10);
        const timeStr = match[4] || "00:00:00";
        const months = {'ledna':0,'února':1,'března':2,'dubna':3,'května':4,'června':5,'července':6,'srpna':7,'září':8,'října':9,'listopadu':10,'prosince':11};
        const mon = months[monthStr];
        if (mon === undefined) return 0;
        const [h, m, s] = timeStr.split(':').map(x => parseInt(x, 10));
        return new Date(year, mon, day, h||0, m||0, s||0).getTime();
    }

    function parseUrlDate(url) {
        const match = url.match(/[?&]f=(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/);
        if (match) return new Date(match[1], match[2]-1, match[3], match[4], match[5], match[6]).getTime();
        return null;
    }

    function formatCzechDate(dateObj) {
        let str = dateObj.toLocaleDateString('cs-CZ', { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' });
        // Capitalize the first letter (e.g. "pondělí" -> "Pondělí")
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // --- UI Management ---
    let overlayEl = null;
    let cancelRequested = false;

    function createOverlay(targetDateStr) {
        if (overlayEl) return;
        cancelRequested = false;
        
        // Format the initial target date for the header
        const initDisplay = formatCzechDate(new Date(targetDateStr));
        
        overlayEl = document.createElement('div');
        overlayEl.id = 'gotot-overlay';
        overlayEl.innerHTML = '<div id="gotot-modal"><h3 class="gotot-modal-title">Stroj času GoToT <span id="gotot-hyena-date">' + initDisplay + '</span></h3><div id="gotot-hyena-content"><i>Načítám databázi zpráv...</i></div><div id="gotot-status-text">Připravuji skok v čase...</div><div class="gotot-buttons"><button id="gotot-cancel-btn" class="gotot-action-btn">Zrušit skok</button><button id="gotot-continue-btn" class="gotot-action-btn">Přejít na datum</button></div></div>';
        document.body.appendChild(overlayEl);
    }

    function closeOverlay() {
        if (overlayEl) {
            overlayEl.remove();
            overlayEl = null;
        }
        document.querySelectorAll('.goto-input').forEach(input => {
            input.classList.remove('scanning');
            input.disabled = false;
        });
    }

    function updateStatus(textHtml) {
        const statusEl = document.getElementById('gotot-status-text');
        if (statusEl) statusEl.innerHTML = textHtml;
    }

    // --- Data Fetching (JSON Database) ---
    let hyenaDBCache = {}; 

    function fetchHyenaNews(targetDateStr, startTs) {
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

            // If the exact date is missing, find the nearest available one
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
                    } else if (diff === minDiff && bestKey) {
                        // TIE BREAKER: If distance is equal (e.g. Sat vs Mon), pick the one closer to the date we initiated the search from
                        const diffStartK = Math.abs(kTime - startTs);
                        const diffStartBest = Math.abs(new Date(bestKey).getTime() - startTs);
                        if (diffStartK < diffStartBest) {
                            bestKey = key;
                        }
                    }
                }

                if (bestKey) {
                    newsItems = yearDB[bestKey];
                    foundKey = bestKey;
                }
            }

            // Update the UI header if we fell back to a different date
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

        // Pulling from the newly created 'db' folder!
        const archiveUrl = `https://raw.githubusercontent.com/hanenashi/gotot/main/db/hyena_${yyyy}.json`;

        GM_xmlhttpRequest({
            method: "GET",
            url: archiveUrl,
            responseType: "json",
            onload: function(response) {
                if (response.status === 200 && response.response) {
                    hyenaDBCache[yyyy] = response.response; 
                    renderNews(hyenaDBCache[yyyy]);
                } else if (response.status === 404) {
                    contentEl.innerHTML = `<i>Databáze zpráv pro rok ${yyyy} zatím nebyla nalezena.</i>`;
                } else {
                    contentEl.innerHTML = `<i>Chyba při čtení databáze: Status ${response.status}</i>`;
                }
            },
            onerror: function() {
                if (contentEl) contentEl.innerHTML = "<i>Nepodařilo se připojit k GitHubu pro stažení zpráv.</i>";
            }
        });
    }

    // --- Bidirectional Scanning Logic ---
    async function performScan(targetDateStr) {
        let targetTs = new Date(targetDateStr).getTime();
        if (isNaN(targetTs)) return;

        const now = Date.now();
        if (targetTs > now) targetTs = now;

        document.querySelectorAll('.goto-input').forEach(input => {
            input.classList.add('scanning');
            input.disabled = true;
        });

        let currentUrl = window.location.href;
        
        // Capture the timestamp of the page where the user initiated the search
        let startTs = parseUrlDate(currentUrl) || now;

        createOverlay(targetDateStr);
        
        // Pass startTs to the fetcher so it knows which direction to break ties
        fetchHyenaNews(targetDateStr, startTs);
        
        const cancelBtn = document.getElementById('gotot-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                cancelRequested = true;
                cancelBtn.innerText = "Zastavuji...";
                updateStatus('<span style="color: #f39c12;">Skok přerušen. Načítám aktuální pozici...</span>');
                window.location.href = currentUrl; 
            });
        }

        const visitCounts = new Map();
        visitCounts.set(currentUrl.split('#')[0], 1);

        let finalUrl = null;
        let hops = 0;
        
        let finalOldest = 0;
        let finalNewest = 0;
        let hitDeadEnd = false; 
        let lastPassingDateStr = ""; 

        const czDateFormatter = new Intl.DateTimeFormat('cs-CZ', { year: 'numeric', month: 'long', day: 'numeric' });

        try {
            while (!finalUrl && !cancelRequested) {
                hops++;
                
                if (lastPassingDateStr) {
                    updateStatus(`Skenuji okoun.cz... (Krok ${hops})<br><span style='color: #d35400; font-size: 14px;'>Míjím: ${lastPassingDateStr}</span>`);
                } else {
                    updateStatus(`Skenuji okoun.cz... (Krok ${hops})`);
                }
                
                const response = await fetch(currentUrl);
                const text = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/html');

                let newest = 0;
                let oldest = 0;
                const items = doc.querySelectorAll('.listing .item');
                
                items.forEach(item => {
                    const dEl = item.querySelector('.permalink a.date');
                    if (dEl) {
                        const ts = parseCzechDate(dEl.innerText.trim());
                        if (ts > 0) {
                            if (newest === 0 || ts > newest) newest = ts;
                            if (oldest === 0 || ts < oldest) oldest = ts;
                        }
                    }
                });
                
                finalOldest = oldest;
                finalNewest = newest;

                if (newest > 0) {
                    lastPassingDateStr = czDateFormatter.format(new Date(newest));
                    updateStatus(`Skenuji okoun.cz... (Krok ${hops})<br><span style='color: #d35400; font-size: 14px;'>Míjím: ${lastPassingDateStr}</span>`);
                }

                if (items.length === 0 || (targetTs <= newest && targetTs >= oldest)) {
                    finalUrl = currentUrl;
                    break;
                }

                let direction = ''; 
                if (oldest > targetTs) direction = 'older'; 
                else if (newest < targetTs) direction = 'newer'; 

                const pagerLinks = Array.from(doc.querySelectorAll('.pager a'));
                let bestLink = null;
                let bestDiff = Infinity;

                pagerLinks.forEach(link => {
                    let linkTs = parseUrlDate(link.href);
                    if (!linkTs && (link.classList.contains('newest') || link.innerText.includes('Nejnovější'))) {
                        linkTs = Date.now(); 
                    }
                    if (linkTs) {
                        let isValidCandidate = false;
                        if (direction === 'older' && linkTs < oldest) isValidCandidate = true;
                        if (direction === 'newer' && linkTs > newest) isValidCandidate = true;

                        if (isValidCandidate) {
                            const diff = Math.abs(linkTs - targetTs);
                            if (diff < bestDiff) {
                                bestDiff = diff;
                                bestLink = link.href;
                            }
                        }
                    }
                });

                if (!bestLink) {
                    if (direction === 'older') {
                        const olderBtn = doc.querySelector('.pager .older a') || pagerLinks.find(l => l.innerText.includes('Starší') || l.innerText.trim() === '>');
                        if (olderBtn) bestLink = olderBtn.href;
                    } else if (direction === 'newer') {
                        const newerBtn = doc.querySelector('.pager .newer a') || pagerLinks.find(l => l.innerText.includes('Novější') || l.innerText.trim() === '<');
                        if (newerBtn) bestLink = newerBtn.href;
                    }
                }

                if (bestLink) {
                    const cleanLink = bestLink.split('#')[0];
                    let visits = visitCounts.get(cleanLink) || 0;
                    
                    if (visits >= 3 || bestLink === currentUrl) {
                        hitDeadEnd = true;
                        finalUrl = currentUrl;
                        break;
                    }
                    
                    visitCounts.set(cleanLink, visits + 1);
                    currentUrl = bestLink;
                } else {
                    hitDeadEnd = true; 
                    finalUrl = currentUrl;
                    break;
                }
            }
        } catch (e) {
            console.error("GoToT Error", e);
            if (!cancelRequested) {
                updateStatus('<span style="color: #f39c12;">Chyba sítě při hledání data.</span>');
                finalUrl = currentUrl; 
            }
        }

        if (!cancelRequested) {
            if (hitDeadEnd && targetTs < finalOldest && finalOldest > 0) {
                updateStatus('<span style="color: #f39c12;">Klub v této době ještě neexistoval. Nastavuji nejstarší dostupnou stránku.</span>');
            } else if (hitDeadEnd && targetTs > finalNewest && finalNewest > 0 && hops > 1) {
                updateStatus('<span style="color: #f39c12;">Novější zprávy nebyly nalezeny. Nastavuji nejnovější dostupnou stránku.</span>');
            } else {
                updateStatus("Časový skok připraven!");
            }
            
            const continueBtn = document.getElementById('gotot-continue-btn');
            
            if (continueBtn) {
                continueBtn.style.display = 'block';
                continueBtn.onclick = () => { window.location.href = finalUrl || currentUrl; };
            }
            if (cancelBtn) {
                cancelBtn.innerText = "Zavřít a zůstat zde";
                cancelBtn.replaceWith(cancelBtn.cloneNode(true));
                document.getElementById('gotot-cancel-btn').addEventListener('click', closeOverlay);
            }
        }
    }

    // --- Init ---
    function init() {
        const pagerNavs = document.querySelectorAll('.pager > ul.nav:first-of-type');
        pagerNavs.forEach(nav => {
            const li = document.createElement('li');
            li.className = 'goto-nav-item';
            
            const input = document.createElement('input');
            input.type = 'date';
            input.className = 'goto-input';
            input.title = 'Jít na datum (Enter)';
            
            const btn = document.createElement('button');
            btn.className = 'goto-btn';
            btn.innerHTML = '🔍';
            btn.title = 'Hledat';

            const go = () => { if (input.value) performScan(input.value); };

            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
            btn.addEventListener('click', (e) => { e.preventDefault(); go(); });

            li.appendChild(input);
            li.appendChild(btn);
            nav.insertBefore(li, nav.firstChild);
        });
    }

    init();
})();