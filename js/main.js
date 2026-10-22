var myMap;
var multiRoute;
var routeMapPlacemarks = {};
var routePoints = [];
var selectedObject = null;
var activeCategory = 'azs';
var previewLine = null;

document.addEventListener('DOMContentLoaded', function() {
    if (typeof ymaps === 'undefined') {
        document.getElementById('map').innerHTML =
            '<p style="padding:40px;color:#c00;text-align:center;">Ошибка загрузки Яндекс Карт.</p>';
        return;
    }
    ymaps.ready(init);
});

function init() {
    myMap = new ymaps.Map('map', {
        center: [55.0, 73.4],
        zoom: 7,
        controls: ['zoomControl', 'fullscreenControl'],
        type: 'yandex#map'
    });

    addStartPlacemark();
    renderCategoryObjects();
    setupCategoryButtons();
    setupNavigatorLink();
    setupGpxLink();
}

function addStartPlacemark() {
    var sp = routeData.startPoint;

    var pm = new ymaps.Placemark(sp.coordinates, {
        balloonContentHeader: 'Точка старта',
        balloonContentBody: '<b>' + sp.name + '</b>',
        hintContent: 'Старт: ' + sp.name
    }, {
        preset: 'islands#yellowDotIcon',
        iconColor: '#FFD54F',
        zIndex: 100
    });

    myMap.geoObjects.add(pm);
}

function getObjectsByCategory(category) {
    switch(category) {
        case 'azs': return routeData.gasStations;
        case 'motel': return routeData.hotels;
        case 'cafe': return routeData.cafes;
        case 'interesting_places': return routeData.attractions;
        default: return [];
    }
}

function renderCategoryObjects() {
    var container = document.getElementById('categoryObjects');
    if (!container) return;
    container.innerHTML = '';

    var objects = getObjectsByCategory(activeCategory);
    objects.forEach(function(obj) {
        var inRoute = routePoints.some(function(p) { return p.id === obj.id; });
        var el = document.createElement('div');
        el.className = 'category_item' + (inRoute ? ' in-route' : '');

        var emoji = getCategoryEmoji(obj.type);

        var thumbSrc = getObjectPlaceholder(obj.type);
        el.innerHTML =
            '<div class="category_item_inner">' +
                '<div class="category_item_photo">' +
                    '<img src="' + thumbSrc + '" alt="' + obj.name + '">' +
                '</div>' +
                '<div class="category_item_info">' +
                    '<div class="category_item_name">' + emoji + ' ' + obj.name + '</div>' +
                    '<div class="category_item_address">' + (obj.address || obj.description || '') + '</div>' +
                    (obj.rating ? '<div class="category_item_rating">★ ' + obj.rating + '</div>' : '') +
                    (obj.distance ? '<div class="category_item_distance">' + obj.distance + '</div>' : '') +
                '</div>' +
            '</div>' +
            '<div class="category_item_actions">' +
                (inRoute ?
                    '<button class="btn_in_route" data-id="' + obj.id + '">В маршруте ✓</button>' :
                    '<button class="btn_add_to_route" data-id="' + obj.id + '">Добавить</button>'
                ) +
            '</div>';

        el.querySelector('.category_item_inner').addEventListener('click', function() {
            showObjectInfo(obj);
        });

        var btn = el.querySelector('.btn_add_to_route, .btn_in_route');
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (inRoute) {
                removeFromRoute(obj.id);
            } else {
                addToRoute(obj.id);
            }
        });

        container.appendChild(el);
    });
}

function getObjectPlaceholder(type) {
    switch (type) {
        case 'azs': return 'img/azx.PNG';
        case 'motel': return 'img/hotel-placeholder.svg';
        case 'cafe': return 'img/cafe-placeholder.svg';
        default: return 'img/place-placeholder.svg';
    }
}

function getCategoryEmoji(type) {
    switch(type) {
        case 'azs': return '⛽';
        case 'motel': return '🏨';
        case 'cafe': return '☕';
        case 'interesting_places': return '📍';
        default: return '📌';
    }
}

function getCategoryColor(type) {
    switch(type) {
        case 'azs': return '#1565c0';
        case 'motel': return '#2e7d32';
        case 'cafe': return '#e65100';
        case 'interesting_places': return '#c62828';
        default: return '#555';
    }
}

function showObjectInfo(obj) {
    selectedObject = obj;
    var panel = document.getElementById('infoPanel');
    var inRoute = routePoints.some(function(p) { return p.id === obj.id; });

    showPreviewLine(obj);

    var html = '<div class="msp_item_info active">';

    if (obj.type === 'motel' && obj.img_outside && obj.img_inside) {
        html += '<div class="msp_photo_gallery">';
        html += '<div class="msp_photo_main">';
        html += '<img id="hotelPhotoMain" src="' + obj.img_outside + '" alt="' + obj.name + '" onerror="this.parentElement.style.display=\'none\'">';
        html += '</div>';
        html += '<div class="msp_photo_thumbs">';
        html += '<div class="msp_photo_thumb active" data-src="' + obj.img_outside + '" onclick="switchHotelPhoto(this, \'' + obj.img_outside + '\')">';
        html += '<img src="' + obj.img_outside + '" alt="Снаружи">';
        html += '<span>Снаружи</span>';
        html += '</div>';
        html += '<div class="msp_photo_thumb" data-src="' + obj.img_inside + '" onclick="switchHotelPhoto(this, \'' + obj.img_inside + '\')">';
        html += '<img src="' + obj.img_inside + '" alt="Внутри">';
        html += '<span>Внутри</span>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
    } else {
        var imgSrc = getObjectPlaceholder(obj.type);
        if (imgSrc) {
            html += '<div class="msp_info_photo">';
            html += '<img src="' + imgSrc + '" alt="' + obj.name + '">';
            html += '</div>';
        } else {
            var emoji = getCategoryEmoji(obj.type);
            html += '<div class="msp_info_photo_placeholder">';
            html += '<div class="placeholder_icon">' + emoji + '</div>';
            html += '<div class="placeholder_text">' + (obj.category || 'Фото скоро') + '</div>';
            html += '</div>';
        }
    }

    html += '<div class="msp_title">' + obj.name + '</div>';

    if (obj.category) {
        html += '<div class="msp_type">' + obj.category + '</div>';
    }

    if (obj.address) {
        html += '<div class="msp_address_km"><div class="msp_address">📍 ' + obj.address + '</div></div>';
    }

    if (obj.workTime) {
        html += '<div class="msp_worktime">🕐 ' + obj.workTime + '</div>';
    }

    if (obj.rating) {
        html += '<div class="msp_rating">⭐ ' + obj.rating + ' <span class="msp_reviews">(' + (obj.reviews || 0) + ' оценок)</span></div>';
    }

    if (obj.distance) {
        html += '<div class="msp_distance">📏 ' + obj.distance + '</div>';
    }

    if (obj.prices) {
        html += '<div class="msp-prices">';
        for (var fuel in obj.prices) {
            html += '<div class="price-row"><span>' + fuel + '</span><span class="price-value">' + obj.prices[fuel] + ' ₽</span></div>';
        }
        html += '</div>';
    }

    if (obj.features) {
        html += '<div class="msp-features">' + obj.features.join(' · ') + '</div>';
    }

    if (obj.description) {
        html += '<div class="msp_description">' + obj.description + '</div>';
    }

    if (inRoute) {
        html += '<button class="msp_remove_button" onclick="removeFromRoute(\'' + obj.id + '\')">Убрать из маршрута</button>';
    } else {
        html += '<button class="msp_add_button" onclick="addToRoute(\'' + obj.id + '\')">Добавить в маршрут</button>';
    }

    html += '</div>';
    panel.innerHTML = html;
}

function switchHotelPhoto(thumbEl, src) {
    var mainImg = document.getElementById('hotelPhotoMain');
    if (mainImg) mainImg.src = src;
    var thumbs = thumbEl.parentElement.querySelectorAll('.msp_photo_thumb');
    thumbs.forEach(function(t) { t.classList.remove('active'); });
    thumbEl.classList.add('active');
}

function showPreviewLine(obj) {
    if (previewLine) {
        try { myMap.geoObjects.remove(previewLine); } catch(e) {}
        previewLine = null;
    }

    if (!obj || obj.type === 'start') return;

    var startCoords;
    if (routePoints.length > 0) {
        var lastPoint = routePoints[routePoints.length - 1];
        startCoords = lastPoint.coordinates;
    } else {
        startCoords = routeData.startPoint.coordinates;
    }
    var objCoords = [obj.lat, obj.lng];

    try {
        previewLine = new ymaps.Polyline(
            [startCoords, objCoords],
            {},
            {
                strokeColor: '#FFD54F',
                strokeWidth: 3,
                strokeOpacity: 0.6,
                zIndex: 50
            }
        );
        myMap.geoObjects.add(previewLine);
    } catch(e) {
        previewLine = null;
    }
}

function clearPreviewLine() {
    if (previewLine) {
        try { myMap.geoObjects.remove(previewLine); } catch(e) {}
        previewLine = null;
    }
}

function findObjectById(id) {
    var all = routeData.gasStations.concat(routeData.hotels).concat(routeData.cafes).concat(routeData.attractions);
    for (var i = 0; i < all.length; i++) {
        if (all[i].id === id) return all[i];
    }
    return null;
}

function addToRoute(objId) {
    var obj = findObjectById(objId);
    if (!obj) return;

    var exists = routePoints.some(function(p) { return p.id === objId; });
    if (exists) return;

    routePoints.push({
        id: obj.id,
        name: obj.name,
        type: obj.type,
        coordinates: [obj.lat, obj.lng]
    });

    addPlacemarkForRoute(obj);
    renderRoutePoints();
    renderCategoryObjects();
    buildRoute();
    clearPreviewLine();
    saveRouteForGpx();

    if (selectedObject && selectedObject.id === objId) {
        showObjectInfo(obj);
    }
}

function removeFromRoute(objId) {
    routePoints = routePoints.filter(function(p) { return p.id !== objId; });

    removePlacemarkFromMap(objId);
    renderRoutePoints();
    renderCategoryObjects();
    buildRoute();
    saveRouteForGpx();

    var obj = findObjectById(objId);
    if (obj && selectedObject && selectedObject.id === objId) {
        showObjectInfo(obj);
    }
}

function getCategoryPreset(type) {
    switch(type) {
        case 'azs': return 'islands#yellowCircleIcon';
        case 'motel': return 'islands#greenCircleIcon';
        case 'cafe': return 'islands#orangeCircleIcon';
        case 'interesting_places': return 'islands#redCircleIcon';
        default: return 'islands#grayCircleIcon';
    }
}

function addPlacemarkForRoute(obj) {
    if (routeMapPlacemarks[obj.id]) {
        myMap.geoObjects.remove(routeMapPlacemarks[obj.id]);
    }

    var index = routePoints.findIndex(function(p) { return p.id === obj.id; }) + 1;
    var preset = getCategoryPreset(obj.type);

    var pm = new ymaps.Placemark([obj.lat, obj.lng], {
        balloonContentHeader: obj.name,
        balloonContentBody: '<b>' + (obj.address || obj.description || '') + '</b><br>' +
            'Точка маршрута #' + index,
        hintContent: obj.name,
        iconContent: '' + index
    }, {
        preset: preset,
        iconContentLayout: ymaps.templateLayoutFactory.createClass(
            '<div style="color:#fff;font-weight:700;font-size:11px;text-align:center;line-height:20px;">$[properties.iconContent]</div>'
        ),
        zIndex: 50
    });

    pm.events.add('click', function() {
        showObjectInfo(obj);
    });

    myMap.geoObjects.add(pm);
    routeMapPlacemarks[obj.id] = pm;
}

function removePlacemarkFromMap(objId) {
    if (routeMapPlacemarks[objId]) {
        myMap.geoObjects.remove(routeMapPlacemarks[objId]);
        delete routeMapPlacemarks[objId];
    }

    routePoints.forEach(function(p) {
        if (routeMapPlacemarks[p.id]) {
            myMap.geoObjects.remove(routeMapPlacemarks[p.id]);
            delete routeMapPlacemarks[p.id];
        }
    });

    routePoints.forEach(function(p) {
        var obj = findObjectById(p.id);
        if (obj) addPlacemarkForRoute(obj);
    });
}

function renderRoutePoints() {
    var section = document.getElementById('routePointsSection');
    var list = document.getElementById('routePointsList');
    if (!section || !list) return;

    if (routePoints.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    list.innerHTML = '';

    routePoints.forEach(function(point, index) {
        var el = document.createElement('div');
        el.className = 'route_point_item';
        var emoji = getCategoryEmoji(point.type);
        el.innerHTML =
            '<div class="route_point_number" style="background:' + getCategoryColor(point.type) + ';">' + (index + 1) + '</div>' +
            '<div class="route_point_emoji">' + emoji + '</div>' +
            '<div class="route_point_name">' + point.name + '</div>' +
            '<button class="route_point_remove" data-id="' + point.id + '">✕</button>';

        el.querySelector('.route_point_remove').addEventListener('click', function() {
            removeFromRoute(point.id);
        });

        list.appendChild(el);
    });
}

var routePolylines = [];
var routeGeometryCoords = [];
var YANDEX_ROUTER_API_KEY = '447c4c63-4f90-4cd6-9551-92daa2cf15cc';

function buildRoute() {
    if (multiRoute) {
        myMap.geoObjects.remove(multiRoute);
        multiRoute = null;
    }

    routePolylines.forEach(function(p) {
        try { myMap.geoObjects.remove(p); } catch(e) {}
    });
    routePolylines = [];
    routeGeometryCoords = [];

    clearPreviewLine();

    if (routePoints.length === 0) return;

    var referencePoints = [routeData.startPoint.coordinates];
    routePoints.forEach(function(p) {
        referencePoints.push(p.coordinates);
    });

    tryMultiRoute(referencePoints);
}

function tryMultiRoute(referencePoints) {
    if (typeof ymaps !== 'undefined' && ymaps.multiRouter && ymaps.multiRouter.MultiRoute) {
        multiRoute = new ymaps.multiRouter.MultiRoute({
            referencePoints: referencePoints,
            params: {
                routingMode: 'auto',
                reverse: false
            }
        }, {
            boundsAutoApply: true,
            routeStrokeColor: '#FFD54F',
            routeStrokeWidth: 6,
            routeStrokeOpacity: 1,
            routeActiveStrokeColor: '#FFC107',
            routeActiveStrokeWidth: 8,
            routeActiveStrokeOpacity: 1
        });

        myMap.geoObjects.add(multiRoute);

        multiRoute.model.events.add('requestsuccess', function() {
            try {
                myMap.setBounds(multiRoute.getBounds(), { checkZoomRange: true, zoomMargin: 30 });
            } catch(e) {}
        });

        multiRoute.model.events.add('requestfail', function() {
            tryOsrm(referencePoints);
        });
    } else {
        tryOsrm(referencePoints);
    }
}

function tryOsrm(referencePoints) {
    if (multiRoute) {
        myMap.geoObjects.remove(multiRoute);
        multiRoute = null;
    }

    var osrmCoords = referencePoints.map(function(c) {
        return c[1] + ',' + c[0];
    }).join(';');

    var url = 'https://router.project-osrm.org/route/v1/driving/' + osrmCoords + '?overview=full&geometries=polyline&steps=true';

    fetch(url)
        .then(function(resp) { return resp.json(); })
        .then(function(data) {
            if (data.routes && data.routes.length > 0) {
                var route = data.routes[0];
                if (route.geometry) {
                    var coords = decodePolyline(route.geometry);
                    routeGeometryCoords = coords;
                    var polyline = new ymaps.Polyline(coords, {}, {
                        strokeColor: '#FFD54F',
                        strokeWidth: 6,
                        strokeOpacity: 1,
                        zIndex: 100
                    });
                    myMap.geoObjects.add(polyline);
                    routePolylines.push(polyline);
                }

                updateRouteInfo(route.distance, route.duration);
                saveRouteForGpx();

                if (routePolylines.length > 0) {
                    try {
                        myMap.setBounds(routePolylines[0].geometry.getBounds(), { checkZoomRange: true, zoomMargin: 30 });
                    } catch(e) {}
                }
            } else {
                drawStraightRoute(referencePoints);
            }
        })
        .catch(function(err) {
            console.error('OSRM failed:', err);
            drawStraightRoute(referencePoints);
        });
}

function updateRouteInfo(distanceMeters, durationSeconds) {
    var section = document.getElementById('routePointsSection');
    if (!section) return;

    var existing = document.getElementById('routeSummary');
    if (existing) existing.remove();

    var km = (distanceMeters / 1000).toFixed(0);
    var hours = Math.floor(durationSeconds / 3600);
    var mins = Math.round((durationSeconds % 3600) / 60);
    var timeStr = hours > 0 ? hours + ' ч ' + mins + ' мин' : mins + ' мин';

    var el = document.createElement('div');
    el.id = 'routeSummary';
    el.className = 'route_summary';
    el.innerHTML = '<span class="route_summary_km">🛣 ' + km + ' км</span><span class="route_summary_time">⏱ ' + timeStr + '</span>';
    section.appendChild(el);
}

function drawStraightRoute(referencePoints) {
    var polyline = new ymaps.Polyline(referencePoints, {}, {
        strokeColor: '#FFD54F',
        strokeWidth: 4,
        strokeOpacity: 0.9,
        zIndex: 100
    });
    myMap.geoObjects.add(polyline);
    routePolylines.push(polyline);
    try {
        myMap.setBounds(polyline.geometry.getBounds(), { checkZoomRange: true, zoomMargin: 30 });
    } catch(e) {}
}

function decodePolyline(encoded) {
    var points = [];
    var index = 0;
    var lat = 0;
    var lng = 0;

    while (index < encoded.length) {
        var b;
        var shift = 0;
        var result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        var dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
        lat += dlat;

        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        var dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
        lng += dlng;

        points.push([lat / 1e5, lng / 1e5]);
    }

    return points;
}

function setupCategoryButtons() {
    var buttons = document.querySelectorAll('.category_btn');
    buttons.forEach(function(btn) {
        btn.addEventListener('click', function() {
            buttons.forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            activeCategory = this.getAttribute('data-category');
            renderCategoryObjects();
        });
    });
}

function setupNavigatorLink() {
    var btn = document.getElementById('openInNavigator');
    if (!btn) return;

    btn.addEventListener('click', function() {
        if (routePoints.length === 0) {
            alert('Добавьте хотя бы одну точку в маршрут');
            return;
        }

        saveRouteForGpx();

        var allPoints = ['Омск, Омская область'];
        routePoints.forEach(function(p) {
            var obj = findObjectById(p.id);
            if (obj) {
                var addr = obj.address || '';
                if (addr && addr.indexOf('Омская область') === -1) {
                    addr = addr + ', Омская область';
                }
                if (!addr) {
                    addr = p.coordinates[0].toFixed(6) + ',' + p.coordinates[1].toFixed(6);
                }
                allPoints.push(addr);
            } else {
                allPoints.push(p.coordinates[0].toFixed(6) + ',' + p.coordinates[1].toFixed(6));
            }
        });

        var rtext = allPoints.join('~');
        var url = 'https://yandex.ru/maps/?ll=73.4,55.0&mode=routes&rtext=' + encodeURIComponent(rtext) + '&rtt=auto&z=7';
        window.open(url, '_blank');
    });
}

function saveRouteForGpx() {
    var startObj = { name: routeData.startPoint.name, lat: routeData.startPoint.coordinates[0], lng: routeData.startPoint.coordinates[1] };
    var allPoints = [startObj];
    routePoints.forEach(function(p) {
        allPoints.push({ name: p.name, lat: p.coordinates[0], lng: p.coordinates[1] });
    });
    localStorage.setItem('omsk_route_points', JSON.stringify(allPoints));
    localStorage.setItem('omsk_route_geometry', JSON.stringify(routeGeometryCoords));
}

function setupGpxLink() {
    var gpxBtn = document.querySelector('.open_in_gpx');
    if (gpxBtn) {
        gpxBtn.addEventListener('click', function() {
            saveRouteForGpx();
        });
    }
}
