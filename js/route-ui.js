// © Mahdi Amouzegar — All rights reserved | مهدی آموزگار — همه حقوق محفوظ است
'use strict';

/* Route UI: three transport profiles with selectable route geometry. */
(() => {
    const PROFILES = [
        { key: 'car', label: 'خودرو', icon: '🚗', color: '#00d4ff', base: 'https://routing.openstreetmap.de/routed-car/route/v1/driving/' },
        { key: 'bike', label: 'دوچرخه', icon: '🚲', color: '#58d68d', base: 'https://routing.openstreetmap.de/routed-bike/route/v1/driving/' },
        { key: 'foot', label: 'پیاده', icon: '🚶', color: '#f5b041', base: 'https://routing.openstreetmap.de/routed-foot/route/v1/driving/' }
    ];

    const AUTO_CLEAR_MS = 5 * 60 * 1000;
    let activeRoutes = null;
    let activeTask = null;
    let activeKey = 'car';
    let activeLayer = null;
    let controller = null;
    let clearTimer = null;
    let mapClickBoundTo = null;
    let clearButtonBound = false;
    let mapCaptureBound = false;

    function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

    function waitForMapReady(timeoutMs=8000){
        if(typeof map!=='undefined'&&map&&typeof mapReady!=='undefined'&&mapReady)return Promise.resolve(true);
        return new Promise(resolve=>{
            const started=Date.now();
            const timer=setInterval(()=>{
                if(typeof map!=='undefined'&&map&&typeof mapReady!=='undefined'&&mapReady){clearInterval(timer);resolve(true);return;}
                if(Date.now()-started>=timeoutMs){clearInterval(timer);resolve(false);}
            },100);
        });
    }

    function getFreshOrigin(){
        return new Promise(resolve=>{
            if(!navigator.geolocation){resolve(null);return;}
            navigator.geolocation.getCurrentPosition(
                position=>{
                    const origin={lat:position.coords.latitude,lng:position.coords.longitude};
                    if(typeof setYouMarker==='function')setYouMarker([origin.lat,origin.lng]);
                    resolve(origin);
                },
                ()=>resolve(null),
                {enableHighAccuracy:true,maximumAge:0,timeout:10000}
            );
        });
    }

    function ensureSummary(){
        const wrap=document.querySelector('.map-wrap');
        if(!wrap)return null;
        let el=document.getElementById('routeSummary');
        if(el)return el;
        el=document.createElement('div');el.id='routeSummary';el.className='route-summary';
        el.setAttribute('role','group');el.setAttribute('aria-label','انتخاب مسیر');
        wrap.appendChild(el);bindRouteSummary();return el;
    }

    function removeSummary(){const el=document.getElementById('routeSummary');if(el)el.remove();}

    function hideActiveLayer(){if(activeLayer&&typeof map!=='undefined'&&map)map.removeLayer(activeLayer);activeLayer=null;}

    function clearOwnRoute(){
        clearTimeout(clearTimer);clearTimer=null;
        if(controller){controller.abort();controller=null;}
        hideActiveLayer();activeRoutes=null;activeTask=null;activeKey='car';removeSummary();
        const btn=document.getElementById('routeClearBtn');if(btn)btn.style.display='none';
    }

    window.clearMapRoute=clearOwnRoute;

    function drawRoute(key,fit=true){
        if(!activeRoutes||!activeRoutes[key]||typeof map==='undefined'||!map)return;
        const route=activeRoutes[key];const profile=PROFILES.find(p=>p.key===key)||PROFILES[0];
        hideActiveLayer();activeKey=key;
        activeLayer=L.polyline(route.geometry.coordinates.map(c=>[c[1],c[0]]),{color:profile.color,weight:5,opacity:.95,lineCap:'round',lineJoin:'round'}).addTo(map);
        if(fit)map.flyToBounds(activeLayer.getBounds().pad(.2),{duration:.8});
        renderSummary();
    }

    function renderSummary(){
        const el=ensureSummary();if(!el||!activeRoutes)return;
        const title=activeTask?`🧭 مسیر تا «${escapeHtml(activeTask.text)}»`:'🧭 مسیر';
        const rows=PROFILES.map(profile=>{
            const route=activeRoutes[profile.key];const available=!!route;const active=activeKey===profile.key&&available;
            const distance=available&&typeof fmtDist==='function'?fmtDist(route.distance):'محاسبه نشد';
            const duration=available&&typeof fmtDur==='function'?fmtDur(route.duration):'';
            return `<button type="button" class="route-option${active?' is-active':''}${available?'':' is-disabled'}" data-route-mode="${profile.key}" ${available?'':'disabled'} style="--route-color:${profile.color}" aria-pressed="${active?'true':'false'}"><span class="route-option-main"><span class="route-option-icon">${profile.icon}</span><span class="route-option-name">${profile.label}</span></span><span class="route-option-info"><span>${distance}</span>${duration?`<span>•</span><span>${duration}</span>`:''}</span></button>`;
        }).join('');
        el.innerHTML=`<div class="route-summary-title"><button type="button" class="route-summary-close" data-route-close aria-label="بستن" title="بستن">×</button><span class="route-summary-title-text">${title}</span></div><div class="route-options">${rows}</div>`;bindRouteSummary();
    }

    async function fetchRoute(profile,origin,destination,signal){
        const coords=`${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
        const response=await fetch(`${profile.base}${coords}?overview=full&geometries=geojson`,{signal});
        if(!response.ok)throw new Error('route-request-failed');
        const data=await response.json();const route=data.routes&&data.routes[0];
        if(!route||!route.geometry||!route.geometry.coordinates)throw new Error('route-empty');
        return route;
    }

    async function calculateRoutes(taskId){
        const found=findTask(taskId);const task=found?found.task:null;
        if(!task||!task.location)return;
        if(typeof ensureMapVisible==='function')ensureMapVisible();
        if(typeof switchToTab==='function')switchToTab('map');
        const ready=await waitForMapReady();
        if(!ready){if(typeof mapHint==='function')mapHint('نقشه هنوز آماده نشده است؛ دوباره تلاش کنید');return;}

        clearOwnRoute();
        if(typeof mapHint==='function')mapHint('در حال دریافت موقعیت فعلی و محاسبه مسیر برای خودرو، دوچرخه و پیاده...');
        const origin=await getFreshOrigin();
        if(!origin){if(typeof mapHint==='function')mapHint('دسترسی به موقعیت فعلی ممکن نیست؛ مجوز موقعیت مکانی را بررسی کنید');return;}

        controller=new AbortController();const localController=controller;
        const timeout=setTimeout(()=>localController.abort(),20000);const results={};
        try{
            for(let i=0;i<PROFILES.length;i++){
                if(localController.signal.aborted)throw new DOMException('Aborted','AbortError');
                const profile=PROFILES[i];
                try{results[profile.key]=await fetchRoute(profile,origin,task.location,localController.signal);}
                catch(err){if(err&&err.name==='AbortError')throw err;results[profile.key]=null;}
                if(i<PROFILES.length-1)await wait(1100);
            }
            if(localController.signal.aborted||typeof map==='undefined'||!mapReady)return;
            activeRoutes=results;activeTask=task;activeKey=results.car?'car':(results.bike?'bike':'foot');
            if(!activeRoutes[activeKey])throw new Error('no-route');
            drawRoute(activeKey);
            const btn=document.getElementById('routeClearBtn');if(btn)btn.style.display='';
            clearTimer=setTimeout(clearOwnRoute,AUTO_CLEAR_MS);
            if(typeof mapHint==='function')mapHint('یک شیوه را انتخاب کنید تا مسیر همان شیوه روی نقشه نمایش داده شود.',5000);
        }catch(err){
            if(err&&err.name==='AbortError'){if(typeof mapHint==='function'&&mapReady)mapHint('محاسبه مسیر متوقف شد');}
            else if(typeof mapHint==='function'&&mapReady)mapHint('مسیریابی ناموفق بود (اینترنت؟)');
        }finally{clearTimeout(timeout);if(controller===localController)controller=null;}
    }

    window.showRouteTo=calculateRoutes;

    function bindRouteSummary(){
        const el=document.getElementById('routeSummary');if(!el||el.dataset.bound==='true')return;
        el.dataset.bound='true';
        el.addEventListener('click',event=>{
            const closeButton=event.target.closest('[data-route-close]');
            if(closeButton){event.preventDefault();event.stopPropagation();clearOwnRoute();return;}
            const button=event.target.closest('[data-route-mode]');
            if(!button||button.disabled||!activeRoutes)return;
            const key=button.dataset.routeMode;if(activeRoutes[key])drawRoute(key);
        });
    }

    function bindClearButton(){
        if(clearButtonBound)return;
        const btn=document.getElementById('routeClearBtn');if(!btn)return;
        clearButtonBound=true;
        btn.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();clearOwnRoute();});
    }

    function bindMapLifecycle(){
        const mapEl=document.getElementById('map');if(!mapEl||mapCaptureBound)return;
        mapCaptureBound=true;
        mapEl.addEventListener('click',event=>{
            const routeButton=event.target.closest('[data-pproute]');
            if(routeButton){event.preventDefault();event.stopImmediatePropagation();calculateRoutes(routeButton.dataset.pproute);return;}
            const summary=document.getElementById('routeSummary');
            if(summary&&!event.target.closest('#routeSummary')){
                event.preventDefault();event.stopImmediatePropagation();clearOwnRoute();
            }
        },true);
    }

    function bindMapInstance(){
        if(typeof map!=='undefined'&&map&&map!==mapClickBoundTo){
            mapClickBoundTo=map;
            map.on('click',()=>{if(document.getElementById('routeSummary'))clearOwnRoute();});
        }
    }

    function init(){
        bindMapLifecycle();
        bindClearButton();
        bindMapInstance();
        window.addEventListener('rahe-map-ready',bindMapInstance);
        window.addEventListener('rahe-map-destroy',clearOwnRoute);
    }

    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
