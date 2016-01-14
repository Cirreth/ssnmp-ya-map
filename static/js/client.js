"use strict";

var ssnmp = {
    Map: Map,
    MapAPI: MapAPI
}

function Map(containerId, mapOptions) {

    var self = this;

    self.map = null;

    self.config = {
        apiUrl: 'https://api-maps.yandex.ru/2.1/?load=package.standard,package.clusters&mode=release&lang=ru-RU&ns=ymaps',
        containerId: containerId
    }

    self.markerPresets = {
        callMarker: {
            preset: 'islands#darkGreenDotIcon',
            zIndex: 1000
        },
		routeBalloonMarker: {
			iconLayout: 'my#routeBalloon',
			zIndex: 900
		},
        primaryMarker: {
            iconLayout: 'my#ambulancePrimary',
            zIndex: 100
        },
        primaryBusyMarker: {
            iconLayout: 'my#ambulancePrimaryBusy',
            zIndex: 99
        },
		secondaryMarker: {
            iconLayout: 'my#ambulanceSecondary',
            zIndex: 50
        },
        secondaryBusyMarker: {
            iconLayout: 'my#ambulanceSecondaryBusy',
            zIndex: 49
        },
		ambulanceDefaultMarker: {
            iconLayout: 'my#ambulanceDefault',
            zIndex: 49
        },
        hospitalMarker: {
            iconLayout: 'default#image',
            iconImageHref: 'hospital.png',
            zIndex: 1000
        },
        balloonMarker: {
			iconLayout: 'my#balloon',
            zIndex: 500
        }
    };

    self.objects = {
        callMarker: null,
        circle: null,
        route: null,
        ambulances: [],
        balloons: []
    };

    self.layers = {
        ambulancesContainer: null,
        balloonsContainer: null,
        hospitalsContainer: null,
        routeContainer: null
    }

    /* Шаблоны для элментов, отображаемых на карте */
    self.layouts = [
        {
            name: 'my#ambulancePrimary',
            template: '<div class="ambulance-layout-container"><div class="ambulance-layout">{{ properties.iconContent }}</div></div>'
        }, {
            name: 'my#ambulancePrimaryBusy',
            template: '<div class="ambulance-layout-container"><div class="ambulance-layout ambulance-layout-busy">{{ properties.iconContent }}</div></div>'
        }, {
            name: 'my#ambulanceSecondary',
            template: '<div class="ambulance-layout-container"><div class="ambulance-layout ambulance-layout-secondary"></div></div>'
        }, {
            name: 'my#ambulanceSecondaryBusy',
            template: '<div class="ambulance-layout-container"><div class="ambulance-layout ambulance-layout-secondary-busy"></div></div>'
        }, {
            name: 'my#ambulanceDefault',
            template: '<div class="ambulance-layout-container"><div class="ambulance-layout ambulance-layout-default"></div></div>'
        }, {
            name: 'my#balloon',
            template: '<div class="ssnmp-map-balloon">{{ properties.iconContent }}</div>'
        }, {
            name: 'my#routeBalloon',
            template: '<div class="ssnmp-map-balloon ssnmp-map-balloon-route">{{ properties.iconContent }}</div>'
        }
    ];

    self.config.mapOptions = {
        center: mapOptions.center || [55.751574, 37.573856],
        zoom: mapOptions.zoom === undefined ? 9 : mapOptions.zoom,
        behaviors: mapOptions.behaviors ? ['default'] : mapOptions.behaviors,
        controls: mapOptions.controls ? [] : mapOptions.controls,
        ambulancesClustererOptions: mapOptions.ambulancesClustererOptions,
        displayJams: mapOptions.displayJams || false,
		routeBoundsAutoApply: mapOptions.routeBoundsAutoApply || false
    }

    loadScript(self.config.apiUrl, onScriptLoad);

    function loadScript(path, callback) {
        var el = document.createElement("script");
        el.onload = el.onreadystatechange = function () {
            if (el.readyState && el.readyState !== "complete" && el.readyState !== "loaded") {
                return;
            }
            // если все загрузилось, то снимаем обработчик и выбрасываем callback
            el.onload = el.onreadystatechange = null;
            if (callback) {
                callback();
            }
        };
        el.async = true;
        el.src = path;
        document.getElementsByTagName('body')[0].appendChild(el);
    }

    function onScriptLoad() {
        ymaps.ready(onMapReady);
    }

    function onMapReady() {
        self.map = new ymaps.Map(self.config.containerId, self.config.mapOptions);
        /* подготовим кастомные лэйауты */
        var layouts = self.layouts;
        if (layouts) {
            for (var i=0; i<layouts.length; i++) {
                var layout = ymaps.templateLayoutFactory.createClass(layouts[i].template);
                ymaps.layout.storage.add(layouts[i].name, layout);
            }
        }
        if (self.config.mapOptions.displayJams) {
            var trafficControl = new ymaps.control.TrafficControl({ state: {
                // Отображаются пробки "Сейчас".
                providerKey: 'traffic#actual',
                // Начинаем сразу показывать пробки на карте.
                trafficShown: true
            }});
            // Добавим контрол на карту.
            self.map.controls.add(trafficControl);
            // Получим ссылку на провайдер пробок "Сейчас" и включим показ инфоточек.
            trafficControl.getProvider('traffic#actual').state.set('infoLayerShown', true);
        }
        /* создаем кластеризатор или коллекцию, в зависимости от того, включен ли кластеризатор */
        if (self.config.mapOptions.ambulancesClustererOptions) {
            self.layers.ambulancesContainer = new ymaps.Clusterer(self.config.mapOptions.ambulancesClustererOptions);
        } else {
            self.layers.ambulancesContainer = new ymaps.GeoObjectCollection();
        }
        self.layers.balloonsContainer = new ymaps.GeoObjectCollection();
        self.layers.hospitalsContainer = new ymaps.GeoObjectCollection();
        self.layers.routeContainer = new ymaps.GeoObjectCollection();
        /* добавляем все коллекции на карту */
        for (var l in self.layers) {
            self.map.geoObjects.add(self.layers[l]);
        }
        if (self.ready) self.ready();
    }
	
    this.ambulanceById = function(id) {
		var ambulances = this.objects.ambulances;
		for (var idx=0, lastIdx=ambulances.length; idx<lastIdx; idx++) {
			if (ambulances[idx].id == id) {
				return ambulances[idx];
			}
		}
		return null;
    }

    this.addLayout = function (name, template) {
		var layout = {
            name: name,
            template: template
        };
        this.layouts.push(layout);
		return layout;
    }

    this.deleteLayout = function (name) {
        this.layouts = self.layouts.filter(function (l) {
            return l.name !== name;
        });
    }

    this.getMarkerPreset = function(name) {
        return this.markerPresets[name];
    }

    /**
     * Устанавливает центр карты в указанную позицию
     * @param center Координаты нового центра. e.g.: [55.77204, 37.63544]
     */
    this.setCenter = function (center) {
        if (!center || center.length !== 2) {
            throw new Error('Invalid value of center');
        }
        this.map.setCenter(center);
    }

    /**
     * Устанавливает значение масштаба
     * @param zoom Масштаб. e.g.: 10
     */
    this.setZoom = function (zoom) {
        if (!zoom) {
            throw new Error('Invalid value of zoom');
        }
        this.map.setZoom(zoom);
    }

    /**
     * Устанавливает маркер вызова в указанную позицию
     * @param center Координаты новой позиции маркера. e.g.: [55.77204, 37.63544]
     */
    this.setCallPosition = function (position) {
        if (!position || position.length !== 2) {
            throw new Error('Invalid value of position');
        }
        if (this.objects.callMarker) {
            this.map.geoObjects.remove(this.objects.callMarker);
			this.objects.callMarker.geometry.setCoordinates(position);
        } else {
			this.objects.callMarker = new ymaps.Placemark(position, {}, this.getMarkerPreset('callMarker'));
		}
        this.map.geoObjects.add(this.objects.callMarker);
    }

    /**
     * Рисует круг заданного радиуса в указанной позиции
     * @param position Координаты центра
     * @param radius Радиус круга в метрах
     */
    this.showCircle = function (position, radius) {
        if (!position || !radius) return;
        var circle = this.objects.circle;
        if (circle) {
            this.map.geoObjects.remove(circle);
			this.objects.circle.geometry.setCoordinates(position);
			this.objects.circle.geometry.setRadius(radius);
        } else {
			circle = new ymaps.Circle([
				position,
				radius
			], {}, {
				fillColor: "#FFFFFF88",
				strokeColor: "#0099DD",
				strokeOpacity: 0.8,
				strokeWidth: 2
			});
		}
        this.map.geoObjects.add(circle);
		this.objects.circle = circle;
    }

    /**
     * Удаляет круг с карты
     */
    this.hideCircle = function () {
        this.map.geoObjects.remove(this.objects.circle);
    }

    function hasAmbulancesDiff(amb1, amb2) {
        return amb1.position[0] !== amb2.position[0]
            || amb1.position[1] !== amb2.position[1]
            || amb1.type !== amb2.type;
    }
	
	/* extra */
	
	var getPresetByType = function(ambulance) {
		switch (ambulance.type) {
			case 'primary-busy':
				return 'primaryBusyMarker';
			case 'primary':
				return 'primaryMarker';
			case 'secondary':
				return 'secondaryMarker';
			case 'secondary-busy':
				return 'secondaryBusyMarker';
			default:
				return 'ambulanceDefaultMarker';
		}
	}

	var pickNewAmbulanceMarker = function(ambulance) {
		return new ymaps.Placemark(
			ambulance.position,
			{iconContent: ambulance.id},
			self.getMarkerPreset(getPresetByType(ambulance))
		);
	}
	
	
	/* =========== */

    /**
     * Отрисовывает маркер "Бригада" на карте в указанной позиции
     * @param position Координаты бригады. e.g.: [55.77204, 37.63544]
     * @param ambulancesType Тип бригады ( busy - занятая )
     */
    this.addAmbulance = function (ambulance) {

        if (!ambulance || !ambulance.id || !ambulance.position) {
            throw new Error('Ambulance is not defined or corrupted');
        }
		var existingAmbulance = this.ambulanceById(ambulance.id);
		if (existingAmbulance !== null) {
			existingAmbulance.marker.geometry.setCoordinates(ambulance.position);
			existingAmbulance.marker.options.set('iconLayout', self.getMarkerPreset(getPresetByType(ambulance)).iconLayout);
		} else {
			ambulance.marker = pickNewAmbulanceMarker(ambulance);
			this.layers.ambulancesContainer.add(ambulance.marker);
			this.objects.ambulances.push(ambulance);
		}
    }

    /**
     * Отрисовывает маркер с текстом в указанной позиции
     * @param position Координаты точки
     * @param text Текст в маркере
     */
    this.addBalloon = function (text, position) {
        if (!text || !position) {
            throw new Error('Position or text is not defined');
        }
        this.layers.balloonsContainer.add(new ymaps.Placemark(position, {iconContent: text}, this.getMarkerPreset('balloonMarker')));
    }

    /**
     * Удалить все маркеры с текстом (баллуны)
     */
    this.removeAllBalloons = function () {
        this.layers.balloonsContainer.removeAll();
    }

    /**
     * Добавляет маркеры "Бригада" из массива на карту
     * @param ambulances Описание бригад. e.g.: [{id: "21-201", position: [55.77204, 37.63544], type: "busy"}, {id: "21-201", coo...}]
     */
    this.addAmbulances = function (ambulances) {
        if (!ambulances || !ambulances.length) {
            throw new Error('Ambulances is not defined');
        }
		for (var i=ambulances.length-1; i>=0; i--) {
			this.addAmbulance(ambulances[i]);
		};
    }

    /**
     * Удаляет все точки типа "Бригада" с карты
     */
    this.removeAllAmbulances = function () {
        this.objects.ambulances = [];
        this.layers.ambulancesContainer.removeAll();
    }
	
	this.removeAmbulancesNotInList = function(ambulances) {
		var idsToRemove = this.objects.ambulances.filter(function(ambulance) {
			for (var idx=0, maxIdx=ambulances.length; idx<maxIdx; idx++) {
				if (ambulances[idx].id === ambulance.id) return false;
			}
			return true;
		});
		this.removeAmbulances(idsToRemove);
	}

    /**
     * Удаляет точки типа "Бригада" с id из массива с карты
     * @param ambulanceIds Список id бригад, которые необходимо удалить
     */
    this.removeAmbulances = function (ambulancesIds) {
        var self = this;
        self.objects.ambulances = self.objects.ambulances.filter(function (ambulance) {
            var recordInDeleteList = ambulancesIds.indexOf(ambulance.id) !== -1;
            if (recordInDeleteList) {
                self.layers.ambulancesContainer.remove(ambulance.marker);
            }
            return !recordInDeleteList;
        });
    }

    /**
     * Отрисовывает маркер "Стационар" на карте в указанной позиции
     */
    this.addHospital = function (hospital) {
        if (!hospital) {
            throw new Error('Hospital is not defined');
        }
        this.layers.hospitalsContainer.add(new ymaps.Placemark(hospital, {}, this.getMarkerPreset('hospitalMarker')));
    }

    /**
     * Удаляет все точки типа "Стационар" с карты
     */
    this.removeAllHospitals = function () {
        this.layers.hospitalsContainer.removeAll();
    }

    /**
     * Прокладывает маршрут из позиции routeFrom до позиции routeTo
     * @param routeFrom - координата начальной точки маршрута
     * @param routeTo - координаты конечной точки маршрута
     * @param avoidTrafficJams - учитывать пробки при построении маршрута
     */
    this.route = function (routeFrom, routeTo, avoidTrafficJams) {
		
        this.objects.route = new ymaps.multiRouter.MultiRoute({
            referencePoints: [
                routeFrom,
                routeTo
            ],
            params: {
                results: 1,
                avoidTrafficJams: avoidTrafficJams || false
            }
        }, {
			routeActiveStrokeWidth: 6,
			routeActiveStrokeColor: "#E63E92",
            boundsAutoApply: this.config.mapOptions.routeBoundsAutoApply,
            wayPointVisible:false
        });
		
		this.objects.route.getOverlay().then(function() {
			alert('event');
		});
		
		var self = this;
		
		this.objects.route.model.events.once("requestsuccess", function () {
            var activeRoute = self.objects.route.getActiveRoute();
			var segments = activeRoute.getPaths().get(0).getSegments();
			var midSegmentNumber = segments.getLength()/2 - 1;
			var centerPosition = activeRoute.getPaths().get(0).getSegments().get(midSegmentNumber < 0 ? 0 : midSegmentNumber).model.geometry.get(0);
			var durationText = activeRoute.getPaths().get(0).properties.get('durationInTraffic.text');
			self.layers.routeContainer.add(new ymaps.Placemark(centerPosition, {iconContent: durationText}, self.getMarkerPreset('routeBalloonMarker')));
        });
		
		this.layers.routeContainer.add(this.objects.route);
		
    }

    /**
     * Строит маршрут, где точка начала - координата нулевого элемента массива бригад,
     * а точка окончания - координата нулевого элемента массива стационаров
     * @param avoidTrafficJams - учитывать пробки при построении маршрута
     */
    this.routeDefault = function (avoidTrafficJams) {
        console.log('Не реализовано');
    }

    /**
     * Удаляет маршрут с карты
     */
    this.clearRoute = function () {
        this.layers.routeContainer.removeAll();
    }

}

function MapAPI(map) {

    this.map = map;

    this.terminate = function () {
        window.close();
    }

    this.setCenter = function (requestParams) {
        this.map.setCenter(requestParams.position);
    }

    this.setZoom = function (requestParams) {
        this.map.setZoom(requestParams.zoom);
    }

    this.setCallPosition = function (requestParams) {
        this.map.setCallPosition(requestParams.position);
    }

    this.showCircle = function (requestParams) {
        this.map.showCircle(requestParams.position, requestParams.radius);
    }

    this.hideCircle = function (requestParams) {
        this.map.hideCircle();
    }

    this.addBalloon = function (requestParams) {
        this.map.addBalloon(requestParams.text, requestParams.position);
    }

    this.removeAllBalloons = function (requestParams) {
        this.map.removeAllBalloons();
    }

    this.addAmbulance = function (requestParams) {
        this.map.addAmbulance(requestParams.ambulance);
    }

    this.addAmbulances = function (requestParams) {
        this.map.addAmbulances(requestParams.ambulances);
    }

    this.updateAmbulance = function (requestParams) {
        var ambulance = requestParams.ambulance;
        this.map.removeAmbulances([ambulance.id]);
		this.map.addAmbulance(requestParams.ambulance);
    }

    this.updateAmbulances = function (requestParams) {
        this.map.removeAmbulancesNotInList(requestParams.ambulances);
        this.map.addAmbulances(requestParams.ambulances);
    }

    this.removeAllAmbulances = function (requestParams) {
        this.map.removeAllAmbulances();
    }

    this.addHospital = function (requestParams) {
        this.map.addHospital(requestParams.hospital.position);
    }

    this.removeAllHospitals = function (requestParams) {
        this.map.removeAllHospitals();
    }

    this.route = function (requestParams) {
        var routeFrom = requestParams.from;
        var routeTo = requestParams.to;
        var avoidTrafficJams = requestParams.avoidTrafficJams || false;
        this.map.route(routeFrom, routeTo, avoidTrafficJams);
    }

    this.clearRoute = function (requestParams) {
        this.map.clearRoute();
    }

    this.routeDefault = function (avoidTrafficJams) {
        this.map.routeDefault(avoidTrafficJams || false);
    }

}