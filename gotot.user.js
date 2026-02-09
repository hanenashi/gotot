// ==UserScript==
// @name         GoToT
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Adds a "Go To Date" navigation to the top pager on Okoun.cz (Bidirectional)
// @author       kokochan
// @match        https://www.okoun.cz/boards/*
// @grant        GM_addStyle
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
            display: inline-flex;
            align-items: center;
            margin-right: 10px;
            vertical-align: middle;
        }
        .goto-input {
            background: #222;
            border: 1px solid #444;
            color: #ddd;
            font-family: Arial, sans-serif;
            font-size: 11px;
            padding: 2px 4px;
            border-radius: 3px;
            outline: none;
            width: 115px;
        }
        .goto-input:focus { border-color: #d35400; color: #fff; }
        .goto-input.scanning { background: #331a00; border-color: #d35400; cursor: wait; }
        
        .goto-btn {
            background: transparent;
            border: none;
            color: #777;
            cursor: pointer;
            font-size: 12px;
            padding: 2px 5px;
            margin-left: 2px;
        }
        .goto-btn:hover { color: #d35400; }

        @media (max-width: 600px) {
            .goto-input { width: 90px; }
        }
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
        if (match) {
            return new Date(match[1], match[2]-1, match[3], match[4], match[5], match[6]).getTime();
        }
        return null;
    }

    // --- Bidirectional Scanning Logic ---
    async function performScan(targetDateStr) {
        const targetTs = new Date(targetDateStr).getTime();
        if (isNaN(targetTs)) return;

        const input = document.querySelector('.goto-input');
        input.classList.add('scanning');
        input.disabled = true;

        let currentUrl = window.location.href;
        let found = false;
        let hops = 0;
        const MAX_HOPS = 40; 

        try {
            while (hops < MAX_HOPS && !found) {
                hops++;
                const response = await fetch(currentUrl);
                const text = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/html');

                // 1. Analyze Current Page Range
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

                if (items.length === 0) {
                    found = true;
                    break;
                }

                // 2. CHECK: Are we there?
                if (targetTs <= newest && targetTs >= oldest) {
                    window.location.href = currentUrl;
                    found = true;
                    break;
                }

                // 3. Determine Direction
                let direction = ''; 
                if (oldest > targetTs) {
                    direction = 'older'; 
                } else if (newest < targetTs) {
                    direction = 'newer'; 
                }

                // 4. Find Best Link
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

                // Fallback buttons
                if (!bestLink) {
                    if (direction === 'older') {
                        const olderBtn = doc.querySelector('.pager .older a') || 
                                         pagerLinks.find(l => l.innerText.includes('Starší') || l.innerText.trim() === '>');
                        if (olderBtn) bestLink = olderBtn.href;
                    } else if (direction === 'newer') {
                        const newerBtn = doc.querySelector('.pager .newer a') || 
                                         pagerLinks.find(l => l.innerText.includes('Novější') || l.innerText.trim() === '<');
                        if (newerBtn) bestLink = newerBtn.href;
                    }
                }

                if (bestLink) {
                    currentUrl = bestLink;
                } else {
                    window.location.href = currentUrl;
                    found = true;
                    break;
                }
            }
        } catch (e) {
            console.error("GoToT Error", e);
            alert("Chyba při hledání data.");
        } finally {
            if (!found) {
                input.classList.remove('scanning');
                input.disabled = false;
                if (hops >= MAX_HOPS) alert("Nenalezeno (příliš daleko).");
            }
        }
    }

    // --- Init ---
    function init() {
        const topPagerNav = document.querySelector('.pager-top .pager .nav');
        if (topPagerNav) {
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

            const go = () => {
                if (input.value) performScan(input.value);
            };

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') go();
            });
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                go();
            });

            li.appendChild(input);
            li.appendChild(btn);
            topPagerNav.insertBefore(li, topPagerNav.firstChild);
        }
    }

    init();
})();