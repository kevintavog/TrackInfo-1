"use strict";


var trackHelpers = require("trackhelpers");

var ElevationChangeType = {
    Flat: 'flat',
    Rising: 'rising',
    Falling: 'falling',
}


function TrackSegment(type, tracks) {
    this.trackType = type;
    this.tracks = tracks;
}


function TrackInfo(name, tracks) {
    this.name = name || "";
    this.tracks = tracks;


    var totalDistance = 0;
    var lowest = null;
    var highest = null;
    var bounds = [[null,null],[null,null]];
    var previousPoint = null;
    var elevationGain = 0;
    var elevationLoss = 0;

    tracks.forEach(function(t) {
        if (bounds[0][0] == null || t.lat < bounds[0][0]) {
            bounds[0][0] = t.lat;
        }
        if (bounds[0][1] == null || t.lon < bounds[0][1]) {
            bounds[0][1] = t.lon;
        }

        if (bounds[1][0] == null || t.lat > bounds[1][0]) {
            bounds[1][0] = t.lat;
        }
        if (bounds[1][1] == null || t.lon > bounds[1][1]) {
            bounds[1][1] = t.lon;
        }

        if (lowest == null || t.elevation < lowest) {
            lowest = t.elevation;
        }
        if (highest == null || t.elevation > highest) {
            highest = t.elevation;
        }

        if (previousPoint != null) {
            totalDistance += trackHelpers.calculateDistance(previousPoint, t);

            var elevationChange = t.elevation - previousPoint.elevation;
            if (elevationChange > 0) {
                elevationGain += elevationChange;
            } else {
                elevationLoss += Math.abs(elevationChange);
            }
        }

        previousPoint = t;
    })

    this.lowestElevation = lowest;
    this.highestElevation = highest;
    this.bounds = bounds;
    this.totalDistance = totalDistance;
    this.elevationGain = elevationGain;
    this.elevationLoss = elevationLoss;


    this.trackSegments = trackHelpers.getGaps(tracks);
}

exports.TrackSegment = TrackSegment;
exports.TrackInfo = TrackInfo;
exports.ElevationChangeType = ElevationChangeType;
