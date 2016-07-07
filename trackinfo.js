"use strict";


var gpxParse = require("gpx-parse-browser");
var trackHelpers = require("trackhelpers");
var trackModels = require("trackmodels");
var trackInfo = require("trackinfo");


var globalMap = null;
var mapLayersControl = null;


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
        console.log("Error loading '" + filename + "': " + error);
    } else {
        var trackInfo = new trackModels.TrackInfo(filename, trackHelpers.allTracks(gpx));
        map.fitBounds(trackInfo.bounds);
        updateDisplay(element, trackInfo);
        addTrackToMap(map, trackInfo);
    }
}

function addTrackToMap(map, trackInfo) {
    var trackLines = [];

    // Track line
    trackInfo.trackSegments.forEach(function(trackSegment) {
        var trackLatLng = [];
        trackSegment.forEach(function(track) {
            var _, ll = new L.LatLng(track.lat, track.lon);
            ll.meta = { time: track.time, elevation: track.elevation };
            trackLatLng.push(ll);
        })

        var line = new L.Polyline(trackLatLng, {color: 'red', weight: 6});
        trackLines.push(line);
    });

    var trackLayer = new L.FeatureGroup(trackLines);
    trackLayer.addTo(map);

    var trackLayerName = trackInfo.name + " track";
    if (mapLayersControl == null) {

        var overlayLayer = {};
        overlayLayer[trackLayerName] = trackLayer;
        mapLayersControl = L.control.layers(null, overlayLayer, { position: "topright", collapsed: false }).addTo(map);
    } else {
        mapLayersControl.addOverlay(trackLayer, trackLayerName);
    }

    // Distance markers
    var distanceLayer = null;
    var markers = trackHelpers.getDistances(trackInfo.tracks, trackHelpers.milesToMeters(1));
    if (markers.length > 0) {
        var distanceMarkers = [];
        markers.forEach(function(markerData) {
            var _, ll = new L.LatLng(markerData.track.lat, markerData.track.lon);
            ll.meta = { time: markerData.track.time, elevation: markerData.track.elevation };

            var icon = new L.divIcon({ className: 'distanceMarkerClass', html: markerData.distance});

            var marker = new L.Marker(ll, {
                clickable: true,
                name: markerData.distance,
                icon: icon
            });
            marker.bindPopup("<b> Mile " + markerData.distance + "</b>").openPopup();
            distanceMarkers.push(marker);
        })

        distanceLayer = new L.FeatureGroup(distanceMarkers);
        distanceLayer.addTo(map);

        mapLayersControl.addOverlay(distanceLayer, trackInfo.name + " mile markers");
    }
}

function updateDisplay(element, trackInfo) {
    function _class(c) {
        return element.getElementsByClassName(c)[0];
    }


    _class('trackName').textContent = trackInfo.name;
    _class('startDate').textContent = trackInfo.tracks[0].time.toDateString() + ', ' + trackInfo.tracks[0].time.toLocaleTimeString();
    _class('distance').textContent = trackHelpers.metersToMiles(trackInfo.totalDistance).toFixed(2);
    _class('elevation-gain').textContent = trackHelpers.metersToFeet(trackInfo.elevationGain).toFixed(0);
    _class('elevation-loss').textContent = trackHelpers.metersToFeet(trackInfo.elevationLoss).toFixed(0);
    _class('pointCount').textContent = trackInfo.tracks.length;
}

function calculateDistance(tracks, start, end) {
    var distance = 0;
    for (var i = start; i < end; ++i) {
        distance += trackHelpers.calculateDistance(tracks[i], tracks[i + 1]);
    }
    return distance;
}
