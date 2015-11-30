/*global angular*/
angular.module('ymaps', [])
.factory('$script', ['$q', '$rootScope', function ($q, $rootScope) {
    "use strict";
    //классический кроссбраузерный способ подключить внешний скрипт
    function loadScript(path, callback) {
            var el = document.createElement("script");
            el.onload = el.onreadystatechange = function () {
                if (el.readyState && el.readyState !== "complete" &&
                    el.readyState !== "loaded") {
                    return;
                }
                // если все загрузилось, то снимаем обработчик и выбрасываем callback
                el.onload = el.onreadystatechange = null;
                if(angular.isFunction(callback)) {
                    callback();
                }
            };
            el.async = true;
            el.src = path;
            document.getElementsByTagName('body')[0].appendChild(el);
        }
    var loadHistory = [], //кэш загруженных файлов
        pendingPromises = {}; //обещания на текущие загруки
    return function(url) {
        var deferred = $q.defer();
        if(loadHistory.indexOf(url) !== -1) {
            deferred.resolve();
        }
        else if(pendingPromises[url]) {
            return pendingPromises[url];
        } else {
            loadScript(url, function() {
                delete pendingPromises[url];
                loadHistory.push(url);
                //обязательно использовать `$apply`, чтобы сообщить
                //angular о том, что что-то произошло
                $rootScope.$apply(function() {
                    deferred.resolve();
                });
            });
            pendingPromises[url] = deferred.promise;
        }
        return deferred.promise;
    };
}])
.factory('ymapsLoader', ['$window', '$timeout', '$script', 'ymapsConfig', function($window, $timeout, $script, ymapsConfig) {
    "use strict";
    var scriptPromise;
    return {
        ready: function(callback) {
            if(!scriptPromise) {
                scriptPromise = $script(ymapsConfig.apiUrl).then(function() {
                    return $window.ymaps;
                });
            }
            scriptPromise.then(function(ymaps) {
                ymaps.ready(function() {
                    $timeout(function() {callback(ymaps);});
                });
            });
        }
    };
}])
.constant('ymapsConfig', {
    apiUrl: '//api-maps.yandex.ru/2.1/?load=package.standard,package.clusters&mode=release&lang=ru-RU&ns=ymaps',
    mapBehaviors: ['default'],
	mapControls: ['default'],
    markerOptions: {
        preset: 'islands#darkgreenIcon'
    },
    fitMarkers: true,
    forMarkersZoomMargin: 40,
})
//brought from underscore http://underscorejs.org/#debounce
.value('debounce', function (func, wait) {
    "use strict";
    var timeout = null;
    return function () {
        var context = this, args = arguments;
        var later = function () {
            timeout = null;
            func.apply(context, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
})
.controller('YmapController', ['$scope', '$element', 'ymapsLoader', 'ymapsConfig', 'debounce', function ($scope, $element, ymapsLoader, config, debounce) {
    "use strict";
    function initAutoFit(map, collection, ymaps) {
        collection.events.add('boundschange', debounce(function () {
            if(collection.getLength() > 0) {
                var maxZoomBefore = map.options.get('maxZoom');
                map.options.set('maxZoom', $scope.zoom);
                map.setBounds(collection.getBounds(), {
                    checkZoomRange: true,
                    zoomMargin: config.fitMarkersZoomMargin
                }).then(function () {
                  map.options.set('maxZoom', maxZoomBefore);
                  //we need to manually update zoom, because of http://clubs.ya.ru/mapsapi/replies.xml?item_no=59735
                  map.setZoom(map.getZoom());
                });
            }
        }, 100));
    }
    var self = this;
    ymapsLoader.ready(function(ymaps) {
        self.addMarker = function(coordinates, properties, options) {
            var placeMark = new ymaps.Placemark(coordinates, properties, options);
            if (config.clustererOptions) {
                self.clusterer.add(placeMark);
            } else {
                $scope.markers.add(placeMark);
            }
            return placeMark;
        };
        self.removeMarker = function (marker) {
            if (config.clustererOptions) {
                self.clusterer.remove(marker);
            } else {
                $scope.markers.remove(marker);
            }
        };
        self.map = new ymaps.Map($element[0], {
            center   : $scope.center || [0, 0],
            zoom     : $scope.zoom || 0,
            behaviors: config.mapBehaviors,
			controls: config.mapControls
        });
        $scope.markers = new ymaps.GeoObjectCollection({}, config.markerOptions);
        self.map.geoObjects.add($scope.markers);
        if(config.fitMarkers) {
            initAutoFit(self.map, $scope.markers, ymaps);
        }
        if (config.displayTrafficJamsButton) {
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
        if (config.customLayouts && config.customLayouts.constructor.name === "Array") {
            for (var i=0; i<config.customLayouts.length; i++) {
                var layout = ymaps.templateLayoutFactory.createClass(config.customLayouts[i].template);
                ymaps.layout.storage.add(config.customLayouts[i].name, layout);
            }
        }
		if (config.clustererOptions) {
            self.clusterer = new ymaps.Clusterer(
                config.clustererOptions
            );
            self.map.geoObjects.add(self.clusterer);
        }

       var updatingBounds, moving;

       $scope.$watch('route', function(newVal) {

           if (!newVal) return;

           if ($scope.routesObject) {
               $scope.routesObject.removeAll();
               if (!newVal.routeFrom || !newVal.routeTo) return;
           } else {
               $scope.routesObject = new ymaps.GeoObjectCollection();
               self.map.geoObjects.add($scope.routesObject);
           }

           $scope.multiRoute = new ymaps.multiRouter.MultiRoute({
               // Описание опорных точек мультимаршрута.
               referencePoints: [
                   newVal.routeFrom,
                   newVal.routeTo
               ],
               // Параметры маршрутизации.
               params: {
                   // Ограничение на максимальное количество маршрутов, возвращаемое маршрутизатором.
                   results: 2,
                   // Учитывать пробки
                   avoidTrafficJams: newVal.avoidTrafficJams || false
               }
           }, {
               // Автоматически устанавливать границы карты так, чтобы маршрут был виден целиком.
               boundsAutoApply: true,
               wayPointVisible:false
           });

           $scope.multiRoute.events.add('activeroutechange', function() {
               var m = $scope.multiRoute.getActiveRoute().getPaths().get(0).model.getJson().features.map(function(fn) { return fn.geometry.coordinates; }).reduce(function(a,b) { return a.concat(b); });
           });

           $scope.routesObject.add($scope.multiRoute);

       });

       $scope.$watch('center', function(newVal) {
            if(updatingBounds) {
                return;
            }
            moving = true;
            self.map.panTo(newVal).always(function() {
                moving = false;
            });
        }, true);
        $scope.$watch('zoom', function(zoom) {
            if(updatingBounds) {
               return;
            }
            self.map.setZoom(zoom, {checkZoomRange: true});
        });
        self.map.events.add('boundschange', function(event) {
            if(moving) {
                return;
            }
            //noinspection JSUnusedAssignment
            updatingBounds = true;
            $scope.$apply(function() {
                $scope.center = event.get('newCenter');
                $scope.zoom = event.get('newZoom');
            });
            updatingBounds = false;
        });

    });
}])
.directive('yandexMap', ['ymapsLoader', function (ymapsLoader) {
    "use strict";
    return {
        restrict: 'EA',
        terminal: true,
        transclude: true,
        scope: {
            center: '=',
            zoom: '=',
            route: '='
        },
        link: function($scope, element, attrs, ctrl, transcludeFn) {
            ymapsLoader.ready(function() {
                transcludeFn(function( copy ) {
                    element.append(copy);
                });
            });
        },
        controller: 'YmapController'
    };
}])
.directive('ymapCircle', ['ymapsLoader', function(ymapsLoader) {
    "use strict";
    return {
        restrict: 'EA',
        require : '^yandexMap',
        scope: {
            center: '=',
            radius: '='
        },
        link: function ($scope, elm, attr, mapCtrl) {

            var map = mapCtrl.map;
            var circleLayer = new ymaps.GeoObjectCollection();
            map.geoObjects.add(circleLayer);

            var createCircle = function(center, radius) {

                if (!center || !radius) {
                    return;
                }

                // Создаем круг.
                var circle = new ymaps.Circle([
                    center,
                    radius
                ], {}, {
                    fillColor: "#FFFFFF88",
                    strokeColor: "#0099DD",
                    strokeOpacity: 0.8,
                    strokeWidth: 2
                });

                circleLayer.removeAll();
                circleLayer.add(circle);

            }

            $scope.$watchGroup(["center", "radius"], function (newVal) {
                var center = newVal[0];
                var radius = newVal[1];
                if (newVal) {
                    createCircle(center, radius);
                }
            });

            $scope.$on('$destroy', function () {
                circleLayer.removeAll();
            });
        }
    }
}])
.directive('ymapBalloon', function () {
    "use strict";
    return {
        restrict: "EA",
        require : '^yandexMap',
        scope   : {
            coordinates: '=',
            text: '=',
            properties: '=',
            options: '='
        },
        link: function ($scope, elm, attr, mapCtrl) {
            var marker;
            function pickMarker() {
                var coord = [
                    parseFloat($scope.coordinates[0]),
                    parseFloat($scope.coordinates[1])
                ];
                if (marker) {
                    /* из-за кластеризатора объекты надо пересоздавать  - https://tech.yandex.ru/maps/doc/jsapi/2.1/ref/reference/Clusterer-docpage/ */
                    if (mapCtrl.isClustererEnabled) {
                        mapCtrl.removeMarker(marker);
                        marker = mapCtrl.addMarker(coord, angular.extend({iconContent: $scope.text}, $scope.properties), {preset: 'islands#nightStretchyIcon'});
                    } else {
                        marker.geometry.setCoordinates(coord);
                    }
                }
                else {
                    marker = mapCtrl.addMarker(coord, angular.extend({iconContent: $scope.text}, $scope.properties), {preset: 'islands#nightStretchyIcon'});
                }
            }

            $scope.$watch("index", function (newVal) {
                if (marker) {
                    marker.properties.set('iconContent', newVal);
                }
            });
            $scope.$watch("coordinates", function (newVal) {
                if (newVal) {
                    pickMarker();
                }
            }, true);
            $scope.$on('$destroy', function () {
                if (marker) {
                    mapCtrl.removeMarker(marker);
                }
            });
        }
    };
})
.directive('ymapMarker', function () {
    "use strict";
    return {
        restrict: "EA",
        require : '^yandexMap',
        scope   : {
            coordinates: '=',
            index: '=',
            properties: '=',
            options: '='
        },
        link: function ($scope, elm, attr, mapCtrl) {
            var marker;
            function pickMarker() {
                var coord = [
                    parseFloat($scope.coordinates[0]),
                    parseFloat($scope.coordinates[1])
                ];
                if (marker) {
                    marker.geometry.setCoordinates(coord);
                }
                else {
                    marker = mapCtrl.addMarker(coord, angular.extend({iconContent: $scope.index}, $scope.properties), $scope.options);
                }
            }

            $scope.$watch("index", function (newVal) {
                if (marker) {
                    marker.properties.set('iconContent', newVal);
                }
            });
            $scope.$watch("coordinates", function (newVal) {
                if (newVal) {
                    pickMarker();
                }
            }, true);
            $scope.$on('$destroy', function () {
                if (marker) {
                    mapCtrl.removeMarker(marker);
                }
            });
        }
    };
});
