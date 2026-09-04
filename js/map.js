'use strict';
// map.js -- Leaflet map + markers + visibility prefs  |  React: <MapPanel/>
        /* ---------- نقشه (Leaflet) ---------- */

        let map = null;
        let markersLayer = null;
        let pickMarker = null;
        let youMarker = null;
        let mapReady = false;
        let suppressMapClickUntil = 0;
        let relocateTaskId = null;
        let mapHintTimer = null;

        const TILES = {
            normal: {
                name: 'نقشه معمولی',
                url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                sub: 'abc',
                max: 19,
                attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            },
            dark: {
                name: 'نقشه تاریک',
                url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                sub: 'abc',
                max: 19,
                cls: 'tiles-dark',
                attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            },
            sat: {
                name: 'ماهواره‌ای',
                url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                sub: 'abc',
                max: 19,
                attr: '&copy; Esri, Maxar, Earthstar Geographics'
            }
        };

        function mapHint(msg, ms) {
            const el = document.getElementById('mapHint');
            el.textContent = msg;
            el.classList.add('show');
            clearTimeout(mapHintTimer);
            mapHintTimer = setTimeout(() => el.classList.remove('show'), ms || 3000);
        }

        function switchToTab(name) {
            document.querySelectorAll('.mobile-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
            document.getElementById('panelTasks').classList.toggle('active', name === 'tasks');
            document.getElementById('panelMap').classList.toggle('active', name === 'map');
            if (name === 'map' && mapReady) setTimeout(() => map.invalidateSize(), 60);
        }

        const PREFS_KEY = 'spaceTodoPrefs';

        function loadPrefs() {
            try {
                const p = JSON.parse(localStorage.getItem(PREFS_KEY));
                if (p && typeof p.mapVisible === 'boolean') prefs.mapVisible = p.mapVisible;
            } catch { /* پیش‌فرض */ }
        }

        function savePrefs() {
            try {
                localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
            } catch { /* نادیده */ }
        }

        function applyMapVisibility() {
            document.body.classList.toggle('map-hidden', !prefs.mapVisible);
            const btn = document.getElementById('mapToggle');
            if (btn) btn.textContent = prefs.mapVisible ? '🗺 نقشه: روشن' : '🗺 نقشه: خاموش';
            if (prefs.mapVisible && mapReady) setTimeout(() => map.invalidateSize(), 60);
        }

        // هر عملی که به نقشه نیاز دارد، اول آن را روشن می‌کند
        function ensureMapVisible() {
            if (prefs.mapVisible) return;
            prefs.mapVisible = true;
            savePrefs();
            applyMapVisibility();
        }

        function dotIcon(cls) {
            return L.divIcon({ className: '', html: `<span class="mk ${cls || ''}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -10] });
        }

        function showMapFallback() {
            document.getElementById('map').innerHTML = '<div class="map-fallback">برای نمایش نقشه به اینترنت نیاز است.<br>برنامه بدون نقشه هم کامل کار می‌کند.</div>';
        }

        function initMap() {
            if (typeof L === 'undefined') {
                // اگر CDN جایگزین در حال لود است، بعداً دوباره تلاش می‌شود
                window.__initMapRetry = initMap;
                setTimeout(() => {
                    if (typeof L === 'undefined' && !mapReady) {
                        window.__initMapRetry = null;
                        showMapFallback();
                    }
                }, 9000);
                return;
            }
            window.__initMapRetry = null;
            map = L.map('map').setView([35.69, 51.39], 13);
            map.zoomControl.setPosition('topleft');
            const layers = {};
            ['normal', 'dark', 'sat'].forEach(k => {
                const c = TILES[k];
                layers[c.name] = L.tileLayer(c.url, { maxZoom: c.max, subdomains: c.sub, attribution: c.attr, className: c.cls || '' });
            });
            layers[TILES.normal.name].addTo(map);
            L.control.layers(layers, null, { position: 'topleft' }).addTo(map);
            markersLayer = L.layerGroup().addTo(map);
            mapReady = true;
            map.on('click', onMapClick);
            document.getElementById('map').addEventListener('click', e => {
                const b = e.target.closest('[data-ppdetail]');
                if (!b) return;
                openDetail(b.dataset.ppdetail);
            });
            locateUser(false);
            refreshMarkers();
            // اگر نقشه در لحظه ساخت صفر بوده، بعد از settle شدن چیدمان اصلاح شود
            setTimeout(() => { if (map) map.invalidateSize(); }, 350);
            setTimeout(() => { if (map) map.invalidateSize(); }, 1500);
            window.addEventListener('load', () => { if (map) map.invalidateSize(); });
        }

        function refreshMarkers() {
            if (!mapReady) return;
            markersLayer.clearLayers();
            const addMarker = t => {
                if (!t.location) return;
                const m = L.marker([t.location.lat, t.location.lng], { icon: dotIcon(t.completed ? 'done' : '') });
                m.on('click', () => { suppressMapClickUntil = Date.now() + 400; });
                const n = nearestUpcoming(t);
                const dateLine = n ? faShort(n.at) : ((t.sessions && t.sessions.length) ? 'همه جلسات گذشته' : 'بدون سررسید');
                m.bindPopup(
                    `<div class="pp pp-${t.priority}"><div class="pp-title">${escapeHtml(t.text)}</div>` +
                    `<div class="pp-date">📅 ${dateLine}</div>` +
                    `<button class="pp-btn" data-ppdetail="${escapeHtml(String(t.id))}">نمایش جزئیات</button></div>`
                );
                m._taskId = t.id;
                markersLayer.addLayer(m);
            };
            tasks.forEach(t => {
                if (t.kind === 'group') (t.children || []).forEach(addMarker);
                else addMarker(t);
            });
        }

        function flyToTask(id) {
            const found = findTask(id);
            const t = found ? found.task : null;
            if (!t || !t.location || !mapReady) return;
            switchToTab('map');
            document.getElementById('panelMap').scrollIntoView({ behavior: 'smooth', block: 'start' });
            map.flyTo([t.location.lat, t.location.lng], 14, { duration: 1 });
            markersLayer.eachLayer(m => {
                if (String(m._taskId) === String(id)) setTimeout(() => m.openPopup(), 1100);
            });
        }

        function showPickMarker() {
            if (!mapReady || !pendingLoc) return;
            if (pickMarker) {
                pickMarker.setLatLng([pendingLoc.lat, pendingLoc.lng]);
            } else {
                pickMarker = L.marker([pendingLoc.lat, pendingLoc.lng], {
                    icon: L.divIcon({ className: '', html: '<span class="mk-pick"></span>', iconSize: [20, 20], iconAnchor: [10, 10] }),
                    interactive: false
                }).addTo(map);
            }
        }

        function onMapClick(e) {
            if (Date.now() < suppressMapClickUntil) return;
            const loc = { lat: +e.latlng.lat.toFixed(5), lng: +e.latlng.lng.toFixed(5) };
            if (relocateTaskId) {
                const t = tasks.find(x => String(x.id) === String(relocateTaskId));
                relocateTaskId = null;
                if (t) {
                    t.location = loc;
                    saveTasks();
                    render();
                    refreshMarkers();
                    mapHint('محل جدید ذخیره شد ✓');
                    flyToTask(t.id);
                }
                return;
            }
            pendingLoc = loc;
            showPickMarker();
            updateLocChip();
            switchToTab('tasks');
            mapHint('📍 محل انتخاب شد — عنوان وظیفه را بنویسید');
            setTimeout(() => {
                const inp = document.getElementById('taskInput');
                inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
                inp.focus({ preventScroll: true });
            }, 60);
        }

        function locateUser(fly) {
            if (!mapReady || !navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition(pos => {
                const ll = [pos.coords.latitude, pos.coords.longitude];
                if (youMarker) youMarker.setLatLng(ll);
                else youMarker = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 2, fillColor: '#00d4ff', fillOpacity: 1 }).addTo(map).bindPopup('<div class="pp"><div class="pp-title">موقعیت شما</div></div>');
                if (fly) map.flyTo(ll, 14, { duration: 1.2 });
                else map.flyTo(ll, 13, { duration: 1.5 });
            }, () => {
                if (fly) mapHint('دسترسی به موقعیت داده نشد');
            }, { timeout: 8000 });
        }

        function updateLocChip() {
            const chip = document.getElementById('locChip');
            if (!pendingLoc) {
                chip.style.display = 'none';
                return;
            }
            chip.style.display = 'flex';
            document.getElementById('locChipText').textContent = `📍 ${toFa(pendingLoc.lat)} ، ${toFa(pendingLoc.lng)}`;
        }

        function renderDetailLoc() {
            const t = getDetailTask();
            if (!t) return;
            const line = document.getElementById('detailLocLine');
            const show = document.getElementById('detailLocShow');
            const change = document.getElementById('detailLocChange');
            const remove = document.getElementById('detailLocRemove');
            if (t.location) {
                line.textContent = `📍 ${toFa(t.location.lat)} ، ${toFa(t.location.lng)}`;
                show.style.display = '';
                change.textContent = 'تغییر محل';
                change.style.display = '';
                remove.style.display = '';
            } else {
                line.textContent = 'محلی ثبت نشده است.';
                show.style.display = 'none';
                change.textContent = '＋ ثبت محل';
                change.style.display = '';
                remove.style.display = 'none';
            }
        }

