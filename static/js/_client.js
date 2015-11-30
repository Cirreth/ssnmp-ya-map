/**
 *	Client
**/
var app = angular.module('NwJsYandexMap', ['ymaps']);

app.controller('MapController', ['$rootScope', '$scope', '$http',  'ymapsConfig',  function($rootScope, $scope, $http, ymapsConfig) {
	
	expressApplication.initRoutes($scope);
	
	ymapsConfig.mapControls = [];
	ymapsConfig.demo = true;
	ymapsConfig.fitMarkers = false;
	ymapsConfig.displayTrafficJamsButton = true;
    ymapsConfig.customLayouts = [
        {
            name: 'my#ambulanceFree',
            template: '<div class="ambulance-layout-container"><div class="ambulance-layout">{{ properties.iconContent }}</div></div>'
        },{
            name: 'my#ambulanceBusy',
            template: '<div class="ambulance-layout-container"><div class="ambulance-layout ambulance-layout-busy">{{ properties.iconContent }}</div></div>'
        }
    ];
    ymapsConfig.clustererOptions = {
        preset: 'islands#darkGreenClusterIcons',
        groupByCoordinates: false,
        maxZoom: 16,
        minClusterSize: 5
    };

	$scope.map = {};

	$scope.map.center = [55.77204, 37.63544];
	$scope.map.zoom =  17;

	$scope.map.markers = [];

    $scope.map.circle = undefined;

    // позиция вызова
	$scope.map.callPosition = [];

	// балуны
	$scope.map.balloons = [];

    // маркеры с бригадами и со стационарами
	$scope.map.ambulanceMarkers = [
        {"id":0,"position":[55.77602745652055,37.64036509549717],"type":"busy"},
        {"id":1,"position":[55.77775455751778,37.636445860881416],"type":"free"},
        {"id":2,"position":[55.77841318037683,37.64511128117569],"type":"busy"},
        {"id":3,"position":[55.77953222116545,37.64095728896797],"type":"free"}
    ];

	$scope.map.ambulanceBusyMarkers = [];
	$scope.map.hospitalMarkers = [];

    $scope.callMarkerOptions = {
        preset: 'islands#darkGreenDotIcon',
        text: '12312',
        zIndex: 1000
    };

	$scope.ambulanceMarkerOptions = {
        iconLayout: 'my#ambulanceFree',
        zIndex: 100
	};

	$scope.ambulanceBusyMarkerOptions = {
        iconLayout: 'my#ambulanceBusy',
        zIndex: 99
	};

	$scope.hospitalMarkerOptions = {
        iconLayout: 'default#image',
        iconImageHref: 'hospital.png',
        zIndex: 1000
	};

    window.$scope = $scope;

    $scope.getAmbulanceOptions = function(ambulance) {
        switch (ambulance.type) {
            case 'busy':
                return $scope.ambulanceBusyMarkerOptions;
            default:
                return $scope.ambulanceMarkerOptions;
        }
    }

    //
    ///**
     //* Преобразует кординату в строковое представление, используемое для функции отслеживания.
     //* Если кординаты уже есть в массиве, к второй составляющей добавляется случайная составляющая, которая позволяет избежать дублирования
     //* e.g.: [55.77204, 37.63544] -> "55.77204,37.63544"
     //* @param coords Координата новой точки
     //* @param markers Набор координат существующих точек
     //* @returns {string} Имя для отслеживания точки
     //*/
	//$scope.coordTrackingFunction = function(coords, markers) {
     //   if (markers.filter(function(a) { return a[0] === coords[0] && a[1] === coords[1] }).length>0) {
     //       return coords[0]+','+coords[1]+Math.ceil(Math.random()*10E5);
     //   } else {
     //       return coords[0]+','+coords[1];
     //   }
	//}

	/**
	 * Устанавливает центр карты в указанную позицию
	 * @param center Координаты нового центра. e.g.: [55.77204, 37.63544]
	 */
	$scope.setCenter = function(center) {
		if (!center || center.length !== 2) { throw new Error('Invalid value of center'); }
		$scope.map.center = center;
	}

	/**
	 * Устанавливает значение масштаба
	 * @param zoom Масштаб. e.g.: 10
	 */
	$scope.setZoom = function(zoom) {
		if (!zoom) { throw new Error('Invalid value of zoom'); }
		$scope.map.zoom = zoom;
	}

	/**
	 * Устанавливает маркер вызова в указанную позицию
	 * @param center Координаты новой позиции маркера. e.g.: [55.77204, 37.63544]
	 */
	$scope.setCallPosition = function(position) {
		if (!position || position.length !== 2) { throw new Error('Invalid value of position'); }
		$scope.map.callPosition = position;
	}

    /**
     * Рисует круг заданного радиуса в указанной позиции
     * @param position Координаты центра
     * @param radius Радиус круга в метрах
     */
    $scope.showCircle = function(position, radius) {
        if (!position || !radius) return;
        $scope.map.circle = {
            position: position,
            radius: radius
        };
    }

    /**
     * Удаляет круг с карты
     */
    $scope.hideCircle = function() {
        $scope.map.circle = undefined;
    }

	/**
	 * Отрисовывает маркер "Бригада" на карте в указанной позиции
	 * @param position Координаты бригады. e.g.: [55.77204, 37.63544]
	 * @param ambulancesType Тип бригады ( busy - занятая )
	 * @returns {number} Номер точки в массиве на момент создания
     */
	$scope.addAmbulance = function(ambulance) {
        if (!ambulance || !ambulance.id || !ambulance.position) {
            throw new Error('Ambulance is not defined or corrupted');
        }
        $scope.map.ambulanceMarkers.push(ambulance);
    }

    /**
     * Отрисовывает маркер с текстом в указанной позиции
     * @param position Координаты точки
     * @param text Текст в маркере
     */
    $scope.addBalloon = function(text, position) {
        if (!text || !position) { throw new Error('Position or text is not defined'); }
        $scope.map.balloons.push({
            text: text,
            position: position
        });
    }

    /**
     * Удалить все маркеры с текстом (баллуны)
     */
    $scope.removeAllBalloons = function() {
        $scope.map.balloons = [];
    }

    /**
     * Добавляет маркеры "Бригада" из массива на карту
     * @param ambulances Описание бригад. e.g.: [{id: "21-201", position: [55.77204, 37.63544], ambulanceType: "busy"}, {id: "21-201", coo...}]
     */
    $scope.addAmbulances = function(ambulances) {
        if (!ambulances || !ambulances.length) { throw new Error('Ambulances is not defined'); }
        if (ambulances.map(function(ambulance) { return ambulance.id; }))
        ambulances.map(function(ambulance) { return $scope.addAmbulance(ambulance); });
    }

    /**
     * Удаляет все точки типа "Бригада" с карты
     */
	$scope.removeAllAmbulances = function() {
		$scope.map.ambulanceMarkers = [];
	}

    /**
     * Удаляет точки типа "Бригада" с id из массива с карты
     * @param ambulanceIds Список id бригад, которые необходимо удалить
     */
    $scope.removeAmbulances = function(ambulancesIds) {
        $scope.map.ambulanceMarkers = $scope.map.ambulanceMarkers.filter(function(ambulance) { return ambulancesIds.indexOf(ambulance.id) === -1; } );
    }

    /**
    * Отрисовывает маркер "Стационар" на карте в указанной позиции
    * @returns {number} Номер точки в массиве на момент создания
    */
	$scope.addHospital = function(hospital) {
		if (!hospital) { throw new Error('Hospital is not defined'); }
		$scope.map.hospitalMarkers.push([hospital.position[0], hospital.position[1]]);
	}

    /**
     * Удаляет все точки типа "Стационар" с карты
     */
	$scope.removeAllHospitals = function() {
		$scope.map.hospitalMarkers = [];
	}

    /**
     * Прокладывает маршрут из позиции routeFrom до позиции routeTo
     * @param routeFrom - координата начальной точки маршрута
     * @param routeTo - координаты конечной точки маршрута
     * @param avoidTrafficJams - учитывать пробки при построении маршрута
     */
	$scope.route = function(routeFrom, routeTo, avoidTrafficJams) {
		$scope.map.route = {
			routeFrom: routeFrom,
			routeTo: routeTo,
			avoidTrafficJams: avoidTrafficJams
		};
	}

    /**
     * Строит маршрут, где точка начала - координата нулевого элемента массива бригад,
     * а точка окончания - координата нулевого элемента массива стационаров
     * @param avoidTrafficJams - учитывать пробки при построении маршрута
     */
	$scope.routeDefault = function(avoidTrafficJams) {
		var ambulanceMarkers = $scope.map.ambulanceMarkers;
		var hospitalMarkers = $scope.map.hospitalMarkers;
		if (ambulanceMarkers.length == 0 || hospitalMarkers.length == 0) {
			$scope.clearRoute();
		}
		$scope.map.route = {
			routeFrom: ambulanceMarkers[0].position,
			routeTo: hospitalMarkers[0].position,
			avoidTrafficJams: avoidTrafficJams
		};
	}

    /**
     * Удаляет маршрут с карты
     */
	$scope.clearRoute = function() {
		$scope.map.route = {
			routeFrom: undefined,
			routeTo: undefined
		};
	}
		
}]);