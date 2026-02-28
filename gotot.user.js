// ==UserScript==
// @name         GoToT
// @namespace    http://tampermonkey.net/
// @version      2.2.1
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

    // 1. Hardwarová detekce dotykového zařízení (Mnohem spolehlivější než User-Agent)
    const isTouchDevice = (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0));
    
    // Fallback na UA, kdyby náhodou
    const isMobileUA = /Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const isMobile = isTouchDevice || isMobileUA;

    // --- DEBUG VÝPIS DO KONZOLE ---
    console.log("=== GoToT Debug ===");
    console.log("User-Agent:", navigator.userAgent);
    console.log("Touch device detected:", isTouchDevice);
    console.log("Final isMobile status:", isMobile);
    console.log("=====================");

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

        /* --- Overlay Styles --- */
        #gotot-overlay, #gotot-mobile-prompt-overlay {
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

        /* --- Mobile Input Prompt Styles --- */
        #gotot-big-date-input {
            width: 100%; padding: 12px; font-size: 16px; border-radius: 4px; 
            border: 1px solid #d35400; background: #333; color: #fff; 
            box-sizing: border-box; outline: none; margin-bottom: 20px;
        }

        /* --- Mobile UX pro lištu --- */
        li.gotot-mobile {
            width: 32px; height: 32px; justify-content: center; margin-right: 5px;
        }
        li.gotot-mobile .goto-btn { 
            font-size: 18px; padding: 2px; margin: 0; 
        }
    `;
    document.head.appendChild(styleEl);

    // --- Helpers ---
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

    // --- Mobile Pre-Jump Modal ---
    function openMobileDatePicker() {
        if (document.getElementById('gotot-mobile-prompt-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'gotot-mobile-prompt-overlay';
        overlay.innerHTML = `
            <div id="gotot-modal" style="text-align: center;">
                <h3 class="gotot-modal-title">Zadejte cílové datum</h3>
                <input type="date" id="gotot-big-date-input">
                <div class="gotot-buttons">
                    <button id="gotot-mobile-cancel-btn" class="gotot-action-btn" style="background: #444; color: #fff;">Zrušit</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const dateInput = document.getElementById('gotot-big-date-input');
        
        document.getElementById('gotot-mobile-cancel-btn').addEventListener('click', () => {
            overlay.remove();
        });

        dateInput.addEventListener('change', () => {
            if (dateInput.value) {
                const selectedDate = dateInput.value;
                overlay.remove();
                performScan(selectedDate);
            }
        });

        try { dateInput.showPicker(); } catch (e) { dateInput.focus(); }
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
                <div id="gotot-hyena-content"><i>Načítám databázi zpráv...</i></div>
                <div id="gotot-status-text">Přesun připraven...</div>
                <div class="gotot-buttons">
                    <button id="gotot-cancel-btn" class="gotot-action-btn">Zavřít zprávy</button>
                    <button id="gotot-continue-btn" class="gotot-action-btn" style="display: block;">Dokončit skok</button>
                </div>
            </div>`;
        document.body.appendChild(overlayEl);

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
                contentEl.innerHTML =
                    
