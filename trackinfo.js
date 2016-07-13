"use strict";


var gpxParse = require("gpx-parse-browser");
var trackHelpers = require("trackhelpers");
var trackModels = require("trackmodels");
var trackInfo = require("trackinfo");
var sprintf = require("sprintf")


var globalMap = null;
var pathPopup = null;
var mapLayersControl = null;
var distanceMarkerGroup = null;
var timeMarkerGroup = null;


exports.setupMap = function(mapid) {
    if (!mapid) throw "Missing mapid";

    var center = null;
    var zoomLevel = null;
    if (globalMap != null) {
        zoomLevel = globalMap.getZoom();
        center = globalMap.getCenter();
        globalMap.remove();
        mapLayersControl = null;
    }

    globalMap = loadMap(mapid);
    pathPopup = new L.Popup();

    if (center != null) {
        globalMap.setView(center, zoomLevel);
    }
}

exports.setTrackInfo = function(mapid, element, trackName) {
    if (!element) throw "Missing element in addTrackInfo";

    if (globalMap == null) {
        trackInfo.setupMap(mapid);
    }

    var url;
    if (trackName != undefined) {
        loadTrackFromUrl(element, "./trackdata/" + trackName, globalMap);
    }
}

exports.addTrackInfoFromLocalFile = function(filename, element, data) {
    if (!element) throw "Missing element in addTrackInfo";

    if (globalMap == null) {
        trackInfo.setupMap(element);
    }

    loadTrackFromFile(element, filename, globalMap, data);
}

function objectToString(o) {
    return JSON.stringify(o, null, 4)
}

function loadMap(mapid) {
    var map = L.map(mapid, {
        center: [20, 0],
        zoom: 3,
        minZoom: 3,
        zoomControl: false
    });
    L.control.zoom({ position: "topright" }).addTo(map);

    L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a> ' +
            'contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>'
    }).addTo(map);

    L.control.scale({ position: "bottomright" }).addTo(map);
    return map;
}

function loadTrackFromFile(element, file, map, data) {
    gpxParse.parseGpx(data, function(error, gpx) {
        trackLoadCompleted(error, gpx, file, element, map);
    });
}

function loadTrackFromUrl(element, url, map) {
    gpxParse.parseRemoteGpxFile(url, function(error, gpx) {
        trackLoadCompleted(error, gpx, url.substr(url.lastIndexOf('/') + 1), element, map);
    });
}

function trackLoadCompleted(error, gpx, filename, element, map) {
   if (error != null) {
        console.log("Error loading '%o': %o", filename, error);
    } else {
        var trackInfo = new trackModels.TrackInfo(filename, trackHelpers.trackSegments(gpx));
        map.fitBounds(trackInfo.bounds);
        updateDisplay(element, trackInfo);
        addTrackToMap(map, trackInfo, element);
    }
}

function addTrackToMap(map, trackInfo, infoElement) {

    // Distance markers
    var distancePoints = trackHelpers.getDistancePoints(trackInfo.trackSegments, trackHelpers.milesToMeters(1));
    if (distancePoints.length > 0) {
        var distanceMarkers = [];
        distancePoints.forEach(function(markerData) {
            var _, ll = new L.LatLng(markerData.point.lat, markerData.point.lon);
            ll.meta = { time: markerData.point.time, elevation: markerData.point.elevation };

            var imageName = markerData.distance > 9 ? 'graphics/distancemarker-double.png' : 'graphics/distancemarker-single.png';
            var icon = new L.divIcon({ 
                className: 'distanceMarkerClass', 
                html: '<div class="distanceMarkerClass">' +
                        '<img src="' + imageName + '"/>' +
                        '<h2 class="distance">' + markerData.distance + '</h2>' +
                        '</div>' });

            var marker = new L.Marker(ll, {
                clickable: true,
                name: markerData.distance,
                icon: icon
            });
            marker.bindPopup("<b>" + markerData.distance + " miles</b>").openPopup();
            distanceMarkers.push(marker);
        })

        if (!distanceMarkerGroup) {
            distanceMarkerGroup = new L.FeatureGroup(distanceMarkers);
            distanceMarkerGroup.addTo(map);
            addToMapLayersControl(map, distanceMarkerGroup, '<img src="graphics/distancemarker-overlay.png"> Mile markers');
        } else {
            distanceMarkerGroup.addLayer(new L.layerGroup(distanceMarkers));
        }
    }

    // Time markers
    var timePoints = trackHelpers.getTimePoints(trackInfo.trackSegments, 15 * 60);
    if (timePoints.length > 0) {
        var timeMarkers = [];
        timePoints.forEach(function(timeData) {
            var _, ll = new L.LatLng(timeData.point.lat, timeData.point.lon);

            var approxMinutes = Math.floor(timeData.time / 60);
            var time = approxMinutes;
            var hours = Math.floor(approxMinutes / 60);
            var minutes = approxMinutes - (hours * 60);
            if (minutes < 10) {
                minutes = "0" + minutes;
            }
            time = hours + ":" + minutes;

            var timeWithMinutes = time;
            ll.meta = { time: timeWithMinutes };
            var icon = new L.divIcon({ 
                className: 'timeMarkerClass', 
                html: '<div class="timeMarkerClass">' +
                        '<img src="graphics/time.png"/>' +
                        '<h2 class="time">' + time + '</h2>' +
                        '</div>' });

            var marker = new L.Marker(ll, {
                clickable: true,
                name: time + " mins",
                icon: icon
            });
            marker.bindPopup("<b>" + time + " minutes</b>").openPopup();
            timeMarkers.push(marker);
        });

        if (!timeMarkerGroup) {
            timeMarkerGroup = new L.FeatureGroup(timeMarkers);
            timeMarkerGroup.addTo(map);
            addToMapLayersControl(map, timeMarkerGroup, '<img src="graphics/time-overlay.png"> Time markers');
        } else {
            timeMarkerGroup.addLayer(new L.layerGroup(timeMarkers));
        }
    }


    // Add a layer for each segment, and a line for each run
    var segmentLayers = [];
    var index = 1;
    var startIcon = new L.icon({
        iconUrl: 'graphics/run-start.png',
        iconSize: [33, 50],
        iconAnchor: [16, 44]
    });
    var endIcon = new L.icon({
        iconUrl: 'graphics/run-end.png',
        iconSize: [33, 50],
        iconAnchor: [16, 44]
    });

    trackInfo.trackSegments.forEach(function(trackSegment) {
        var trackLines = [];
        trackSegment.trackRuns.forEach(function(trackRun) {
            if (trackRun.points.length > 1) {
                var firstPoint = trackRun.points[0];
                L.marker([firstPoint.lat, firstPoint.lon], {icon: startIcon}).addTo(map)
                    .on('click', function (e) {
                        firstPointPopup(map, firstPoint);
                    });

                var lastPoint = trackRun.points.slice(-1)[0];
                L.marker([lastPoint.lat, lastPoint.lon], {icon: endIcon}).addTo(map)
                    .on('click', function(e) {
                        lastPointPopup(map, lastPoint, trackSegment, trackRun);
                    });
            }

            var trackLatLng = [];
            trackRun.points.forEach(function(point) {
                var _, ll = new L.LatLng(point.lat, point.lon);
                ll.meta = { time: point.time, elevation: point.elevation };
                trackLatLng.push(ll);
            })

            var trackName = trackInfo.name + " - " + index;
            var line = new L.Polyline(trackLatLng, { color: 'red', weight: 6, clickable: true });
            line.on('click', function (e) {
                    updateSegmentDisplay(infoElement, trackSegment, trackName);
                    midPointPopup(map, trackSegment, e.latlng);
                });
            trackLines.push(line);
            ++index;
        });

        var trackLayer = new L.FeatureGroup(trackLines);
        trackLayer.addTo(map);
        segmentLayers.push(trackLayer);
    });

    for (var i = 0; i < segmentLayers.length; ++i) {
        var layer = segmentLayers[i];
        var name = trackInfo.name + " - " + (i + 1);
        addToMapLayersControl(map, layer, name);
    }
}

function firstPointPopup(map, point) {
    pathPopup.setLatLng(new L.LatLng(point.lat, point.lon));
    pathPopup.setContent(
        sprintf.sprintf(
            "Start time: %s, %s<br>Elevation: %i feet", 
            point.time.toDateString(),
            point.time.toLocaleTimeString(),
            trackHelpers.metersToFeet(point.elevation)));
    map.openPopup(pathPopup);
}

function lastPointPopup(map, point, trackSegment, trackRun) {
    var runFirstPoint = trackRun.points[0];
    var runLastPoint = trackRun.points.slice(-1)[0];

    pathPopup.setLatLng(new L.LatLng(point.lat, point.lon));
    pathPopup.setContent(
        sprintf.sprintf(
            "Track duration: %s <br>Track distance: %f miles <br>Elevation: %i feet <br>End time: %s, %s",
            displayableTime(runLastPoint.time - runFirstPoint.time),
            trackHelpers.metersToMiles(trackHelpers.distanceFromArray(trackRun.points)).toFixed(3),
            trackHelpers.metersToFeet(point.elevation),
            point.time.toDateString(),
            point.time.toLocaleTimeString()));
    map.openPopup(pathPopup);
}

function midPointPopup(map, trackSegment, latlng) {
    var nearest = trackHelpers.findNearestPoint(trackSegment, latlng.lat, latlng.lng);
    if (nearest.point) {
        pathPopup.setLatLng(new L.LatLng(nearest.point.lat, nearest.point.lon));
        pathPopup.setContent(
            sprintf.sprintf(
                "Distance: %f miles <br>Duration: %s <br>Speed: %f mph <br>Elevation: %i feet <br>Time: %s, %s", 
                trackHelpers.metersToMiles(nearest.distance).toFixed(2),
                displayableTime(nearest.duration),
                trackHelpers.metersPerSecondToMilesPerHour(nearest.point.speed).toFixed(2),
                trackHelpers.metersToFeet(nearest.point.elevation),
                nearest.point.time.toDateString(),
                nearest.point.time.toLocaleTimeString()));
        map.openPopup(pathPopup);
    }
}

function addToMapLayersControl(map, layer, name) {
    if (mapLayersControl == null) {
        var overlayLayer = {};
        overlayLayer[name] = layer;
        mapLayersControl = L.control.layers(null, overlayLayer, { position: "topright", collapsed: false }).addTo(map);
    } else {
        mapLayersControl.addOverlay(layer, name);
    }
}

function updateDisplay(element, trackInfo) {
    function _class(c) {
        return element.getElementsByClassName(c)[0];
    }

    _class('info-track-name').textContent = trackInfo.name;
    var firstPoint = trackInfo.trackSegments[0].trackRuns[0].points[0];
    var lastPoint = trackInfo.trackSegments.slice(-1)[0].trackRuns.slice(-1)[0].points.slice(-1)[0];
    _class('info-start-date').textContent = firstPoint.time.toDateString() + ', ' + firstPoint.time.toLocaleTimeString();
    _class('info-distance').textContent = trackHelpers.metersToMiles(trackInfo.totalDistance).toFixed(2);
    _class('info-elevation-gain').textContent = trackHelpers.metersToFeet(trackInfo.elevationGain).toFixed(0);
    _class('info-elevation-loss').textContent = trackHelpers.metersToFeet(trackInfo.elevationLoss).toFixed(0);
    _class('info-duration').textContent = displayableTime(lastPoint.time - firstPoint.time);
    _class('info-point-count').textContent = trackInfo.numberOfPoints;
}

function updateSegmentDisplay(element, trackSegment, name) {
    function _class(c) {
        return element.getElementsByClassName(c)[0];
    }

    _class('info-track-name').textContent = name;
    var firstPoint = trackSegment.trackRuns[0].points[0];
    var lastPoint = trackSegment.trackRuns.slice(-1)[0].points.slice(-1)[0];
    _class('info-start-date').textContent = firstPoint.time.toDateString() + ', ' + firstPoint.time.toLocaleTimeString();
    _class('info-distance').textContent = trackHelpers.metersToMiles(trackSegment.totalDistance).toFixed(2);
    _class('info-elevation-gain').textContent = trackHelpers.metersToFeet(trackSegment.elevationGain).toFixed(0);
    _class('info-elevation-loss').textContent = trackHelpers.metersToFeet(trackSegment.elevationLoss).toFixed(0);
    _class('info-duration').textContent = displayableTime(lastPoint.time - firstPoint.time);
    _class('info-point-count').textContent = trackSegment.numberOfPoints;
}

function displayableTime(milliseconds) {
    var totalSeconds = Math.trunc(milliseconds / 1000);
    var totalMinutes = Math.trunc(totalSeconds / 60);
    var totalHours = Math.trunc(totalMinutes / 60);

    var display = "";
    if (totalHours > 0) {
        display = totalHours + ':';
    }

    totalMinutes -= Math.trunc(totalHours * 60);
    if (totalHours == 0 || totalMinutes >= 10) {
        display += totalMinutes + ':';
    } else {
        display += '0' + totalMinutes + ':';
    }

    totalSeconds -= (totalHours * 60 * 60) + (totalMinutes * 60);
    if (totalSeconds >= 10) {
        display += totalSeconds;
    } else {
        display += '0' + totalSeconds
    }

    return display;
}
