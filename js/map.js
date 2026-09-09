// © Mahdi Amouzegar — All rights reserved | مهدی آموزگار — همه حقوق محفوظ است
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
        let markerTimer = null;
        let mapDomClickHandler = null;
        let mapLoadHandler = null;
        let mapInitTimers = [];
        let routeLayer = null;
        let routeController = null;

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
            document.querySelectorAll('.mobile-tab').forEach(b => {
                const on = b.dataset.tab === name;
                b.classList.toggle('active', on);
                b.setAttribute('aria-selected', on ? 'true' : 'false');
            });
            document.getElementById('panelTasks').classList.toggle('active', name === 'tasks');
            document.getElementById('panelMap').classList.toggle('active', name === 'map');
            if (name === 'map' && mapReady) setTimeout(() => map.invalidateSize(), 60);
        }

        const PREFS_KEY = 'spaceTodoPrefs';

        function loadPrefs() {
            try {
                const p = JSON.parse(localStorage.getItem(PREFS_KEY));
                if (!p) return;
                if (typeof p.mapVisible === 'boolean') prefs.mapVisible = p.mapVisible;
                if (typeof p.remindOn === 'boolean') prefs.remindOn = p.remindOn;
                if ([15, 30, 60, 180, 1440].includes(+p.remindMin)) prefs.remindMin = +p.remindMin;
                if (typeof p.digestOn === 'boolean') prefs.digestOn = p.digestOn;
                if (typeof p.lastDigest === 'string') prefs.lastDigest = p.lastDigest;
                if (typeof p.tourSeen === 'boolean') prefs.tourSeen = p.tourSeen;
                if (typeof p.proMode === 'boolean') prefs.proMode = p.proMode;
                if (typeof p.soundOn === 'boolean') prefs.soundOn = p.soundOn;
                if (['task', 'series', 'plan'].includes(p.pendingKind)) prefs.pendingKind = p.pendingKind;
            } catch { /* پیش‌فرض */ }
        }

        function savePrefs() {
            try {
                localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
            } catch { /* نادیده */ }
        }

        function destroyMap() {
            clearTimeout(mapHintTimer);
            clearTimeout(markerTimer);
            mapInitTimers.forEach(clearTimeout);
            mapInitTimers = [];
            if (routeController) routeController.abort();
            routeController = null;
            const mapEl = document.getElementById('map');
            if (mapEl && mapDomClickHandler) mapEl.removeEventListener('click', mapDomClickHandler);
            if (mapLoadHandler) window.removeEventListener('load', mapLoadHandler);
            mapDomClickHandler = null;
            mapLoadHandler = null;
            window.__initMapRetry = null;
            if (map) map.remove();
            map = null;
            markersLayer = null;
            pickMarker = null;
            youMarker = null;
            routeLayer = null;
            mapReady = false;
            if (mapEl) mapEl.replaceChildren();
            const wrap = document.querySelector('.map-wrap');
            if (wrap) wrap.classList.remove('fullscreen');
            const exit = document.getElementById('fsExit');
            if (exit) exit.style.display = 'none';
        }

        function applyMapVisibility() {
            document.body.classList.toggle('map-hidden', !prefs.mapVisible);
            const btn = document.getElementById('mapToggle');
            if (btn) btn.textContent = prefs.mapVisible ? '🗺 نقشه: روشن' : '🗺 نقشه: خاموش';
            if (!prefs.mapVisible) {
                destroyMap();
                return;
            }
            if (mapReady) setTimeout(() => map.invalidateSize(), 60);
        }

        // هر عملی که به نقشه نیاز دارد، اول آن را روشن می‌کند
        function ensureMapVisible() {
            if (prefs.mapVisible) return;
            prefs.mapVisible = true;
            savePrefs();
            applyMapVisibility();
            initMap();
        }

        function dotIcon(cls) {
            return L.divIcon({ className: '', html: `<span class="mk ${cls || ''}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -10] });
        }

        function showMapFallback() {
            document.getElementById('map').innerHTML = '<div class="map-fallback">برای نمایش نقشه به اینترنت نیاز است.<br>برنامه بدون نقشه هم کامل کار می‌کند.</div>';
        }

        function initMap() {
            if (!prefs.mapVisible || mapReady) return;
            const mapEl = document.getElementById('map');
            if (!mapEl) return;
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
            map.on('moveend zoomend', () => scheduleMarkerRefresh());
            mapDomClickHandler = e => {
                const r = e.target.closest('[data-pproute]');
                if (r) { showRouteTo(r.dataset.pproute); return; }
                const b = e.target.closest('[data-ppdetail]');
                if (!b) return;
                openDetail(b.dataset.ppdetail);
            };
            mapEl.addEventListener('click', mapDomClickHandler);
            locateUser(false);
            refreshMarkers();
            // اگر نقشه در لحظه ساخت صفر بوده، بعد از settle شدن چیدمان اصلاح شود
            mapInitTimers = [
                setTimeout(() => { if (mapReady && map) map.invalidateSize(); }, 350),
                setTimeout(() => { if (mapReady && map) map.invalidateSize(); }, 1500)
            ];
            mapLoadHandler = () => { if (mapReady && map) map.invalidateSize(); };
            window.addEventListener('load', mapLoadHandler);
        }

        // بازسازی مارکرها با تاخیر کوتاه تا تایپ سریع باعث چشمک‌زدن نقشه نشود
        function scheduleMarkerRefresh() {
            if (!mapReady) return;
            clearTimeout(markerTimer);
            markerTimer = setTimeout(refreshMarkers, 120);
        }

        function refreshMarkers() {
            if (!mapReady) return;
            markersLayer.clearLayers();
            const displayLoc = t => t.location || (t.sessions || []).map(s => s.location).find(Boolean) || null;
            const addMarker = (t, loc) => {
                const m = L.marker([loc.lat, loc.lng], { icon: dotIcon(t.completed ? 'done' : '') });
                m.on('click', () => { suppressMapClickUntil = Date.now() + 400; });
                const n = nearestUpcoming(t);
                const dateLine = n ? faShort(n.at) : ((t.sessions && t.sessions.length) ? 'همه جلسات گذشته' : 'بدون سررسید');
                m.bindPopup(
                    `<div class="pp pp-${t.priority}"><div class="pp-title">${escapeHtml(t.text)}</div>` +
                    `<div class="pp-date">📅 ${dateLine}</div>` +
                    `<div class="pp-row"><button class="pp-btn" data-ppdetail="${escapeHtml(String(t.id))}">نمایش جزئیات</button>` +
                    `<button class="pp-btn" data-pproute="${escapeHtml(String(t.id))}">🧭 مسیر</button></div>`
                );
                m._taskId = t.id;
                markersLayer.addLayer(m);
            };
            const pts = [];
            tasks.forEach(t => {
                if (t.kind === 'plan') (t.children || []).forEach(c => {
                    const l = displayLoc(c);
                    if (l) pts.push({ t: c, loc: l });
                });
                else {
                    const l = displayLoc(t);
                    if (l) pts.push({ t, loc: l });
                }
            });
            // خوشه‌بندی سبک شبکه‌ای (بدون پلاگین): خانه ۶۴ پیکسلی
            const CELL = 64;
            const cells = new Map();
            pts.forEach(it => {
                const p = map.latLngToContainerPoint([it.loc.lat, it.loc.lng]);
                const k = Math.floor(p.x / CELL) + ':' + Math.floor(p.y / CELL);
                if (!cells.has(k)) cells.set(k, []);
                cells.get(k).push(it);
            });
            cells.forEach(list => {
                if (list.length === 1) { addMarker(list[0].t, list[0].loc); return; }
                const lat = list.reduce((a, it) => a + it.loc.lat, 0) / list.length;
                const lng = list.reduce((a, it) => a + it.loc.lng, 0) / list.length;
                const m = L.marker([lat, lng], {
                    icon: L.divIcon({ className: '', html: `<span class="mk-cluster">${toFa(list.length)}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] })
                });
                m.on('click', () => {
                    suppressMapClickUntil = Date.now() + 400;
                    map.flyTo([lat, lng], Math.min(map.getZoom() + 2, 19), { duration: 0.6 });
                });
                markersLayer.addLayer(m);
            });
        }

        function flyToTask(id) {
            const found = findTask(id);
            const t = found ? found.task : null;
            if (!t || !mapReady) return;
            const loc = t.location || (nearestUpcoming(t) && nearestUpcoming(t).location) || (t.sessions || []).map(s => s.location).find(Boolean);
            if (!loc) return;
            switchToTab('map');
            document.getElementById('panelMap').scrollIntoView({ behavior: 'smooth', block: 'start' });
            map.flyTo([loc.lat, loc.lng], 14, { duration: 1 });
            markersLayer.eachLayer(m => {
                if (String(m._taskId) === String(id)) setTimeout(() => m.openPopup(), 1100);
            });
        }

        function clearRoute() {
            if (routeLayer && mapReady) { map.removeLayer(routeLayer); routeLayer = null; }
            const b = document.getElementById('routeClearBtn');
            if (b) b.style.display = 'none';
        }

        function fmtDist(m) {
            if (m < 1000) return `${toFa(Math.round(m))} متر`;
            return `${toFa((m / 1000).toFixed(1))} کیلومتر`;
        }

        function fmtDur(s) {
            const m = Math.round(s / 60);
            if (m < 60) return `${toFa(m)} دقیقه`;
            return `${toFa(Math.floor(m / 60))} ساعت و ${toFa(m % 60)} دقیقه`;
        }

        function getOrigin() {
            return new Promise(resolve => {
                if (youMarker) {
                    const ll = youMarker.getLatLng();
                    return resolve({ lat: ll.lat, lng: ll.lng });
                }
                if (!navigator.geolocation) return resolve(null);
                navigator.geolocation.getCurrentPosition(
                    p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
                    () => resolve(null),
                    { timeout: 8000 }
                );
            });
        }

        // مسیریابی OSRM (رایگان، بدون کلید) — فقط هنگام درخواست
        async function showRouteTo(taskId) {
            const found = findTask(taskId);
            const t = found ? found.task : null;
            if (!t || !t.location || !mapReady) return;
            ensureMapVisible();
            switchToTab('map');
            mapHint('در حال محاسبه مسیر...');
            const o = await getOrigin();
            if (!o) {
                mapHint('موقعیت شما مشخص نیست؛ اول «موقعیت من» را بزنید');
                return;
            }
            const d = t.location;
            routeController = new AbortController();
            const timer = setTimeout(() => routeController && routeController.abort(), 12000);
            try {
                const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${o.lng},${o.lat};${d.lng},${d.lat}?overview=full&geometries=geojson`, { signal: routeController.signal });
                clearTimeout(timer);
                if (!mapReady || !map) return;
                if (!r.ok) throw new Error('bad');
                const j = await r.json();
                const route = j.routes && j.routes[0];
                if (!route) throw new Error('empty');
                clearRoute();
                routeLayer = L.polyline(route.geometry.coordinates.map(c => [c[1], c[0]]), { color: '#00d4ff', weight: 5, opacity: 0.9 }).addTo(map);
                map.flyToBounds(routeLayer.getBounds().pad(0.2), { duration: 1 });
                document.getElementById('routeClearBtn').style.display = '';
                mapHint(`🧭 تا «${t.text}»: ${fmtDist(route.distance)}، حدود ${fmtDur(route.duration)}`, 6000);
            } catch {
                clearTimeout(timer);
                if (mapReady) mapHint('مسیریابی ناموفق بود (اینترنت؟)');
            } finally {
                routeController = null;
            }
        }

        function toggleFullscreen() {
            const w = document.querySelector('.map-wrap');
            if (!w) return;
            const on = w.classList.toggle('fullscreen');
            document.getElementById('fsBtn').textContent = on ? '✕' : '⛶';
            document.getElementById('fsExit').style.display = on ? '' : 'none';
            setTimeout(() => { if (mapReady) map.invalidateSize(); }, 80);
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
            if (relocateSess || relocateTaskId) {
                if (relocateSess) {
                    const found = findTask(relocateSess.taskId);
                    const s = found && (found.task.sessions || []).find(x => String(x.id) === String(relocateSess.sessId));
                    const ret = pendingReturnDetail;
                    relocateSess = null;
                    pendingReturnDetail = null;
                    if (s) {
                        s.location = loc;
                        saveTasks();
                        render();
                        refreshMarkers();
                        mapHint('محل جلسه ذخیره شد ✓');
                    }
                    if (ret) openDetail(ret);
                    else if (s && found) flyToTask(found.task.id);
                    return;
                }
                const found = findTask(relocateTaskId);
                relocateTaskId = null;
                if (found) {
                    found.task.location = loc;
                    saveTasks();
                    render();
                    refreshMarkers();
                    mapHint('محل جدید ذخیره شد ✓');
                    flyToTask(found.task.id);
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
                if (!mapReady || !map) return;
                const ll = [pos.coords.latitude, pos.coords.longitude];
                if (youMarker) youMarker.setLatLng(ll);
                else youMarker = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 2, fillColor: '#00d4ff', fillOpacity: 1 }).addTo(map).bindPopup('<div class="pp"><div class="pp-title">موقعیت شما</div></div>');
                if (fly) map.flyTo(ll, 14, { duration: 1.2 });
                else map.flyTo(ll, 13, { duration: 1.5 });
            }, () => {
                if (fly && mapReady) mapHint('دسترسی به موقعیت داده نشد');
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
