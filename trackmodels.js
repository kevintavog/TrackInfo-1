"use strict";


var trackHelpers = require("trackhelpers");

var ElevationChangeType = {
    Flat: 'flat',
    Rising: 'rising',
    Falling: 'falling',
}


/// A continuous run of points
function TrackRun(points) {
    this.points = points;
}


/// A segment of a track, as provided by the GPX file. Each segment contains one or more track runs.
function TrackSegment(trackPoints) {
    this.trackRuns = trackHelpers.getGaps(trackPoints);

    var totalDistance = 0;
    var lowest = null;
    var highest = null;
    var bounds = [[null,null],[null,null]];
    var previousPoint = null;
    var elevationGain = 0;
    var elevationLoss = 0;

    trackPoints.forEach(function(t) {
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
    });

    this.lowestElevation = lowest;
    this.highestElevation = highest;
    this.bounds = bounds;
    this.totalDistance = totalDistance;
    this.elevationGain = elevationGain;
    this.elevationLoss = elevationLoss;
    this.numberOfPoints = trackPoints.length;
}


function TrackInfo(name, trackSegments) {
    this.name = name || "";
    this.trackSegments = trackSegments;

    var numberOfPoints = 0;
    var totalDistance = 0;
    var lowest = null;
    var highest = null;
    var bounds = [[null,null],[null,null]];
    var elevationGain = 0;
    var elevationLoss = 0;

    trackSegments.forEach(function(segment) {
        if (bounds[0][0] == null || segment.bounds[0][0] < bounds[0][0]) {
            bounds[0][0] = segment.bounds[0][0];
        }
        if (bounds[0][1] == null || segment.bounds[0][1] < bounds[0][1]) {
            bounds[0][1] = segment.bounds[0][1];
        }

        if (bounds[1][0] == null || segment.bounds[1][0] > bounds[1][0]) {
            bounds[1][0] = segment.bounds[1][0];
        }
        if (bounds[1][1] == null || segment.bounds[1][1] > bounds[1][1]) {
            bounds[1][1] = segment.bounds[1][1];
        }

        if (lowest == null || segment.lowestElevation < lowest) {
            lowest = segment.lowestElevation;
        }
        if (highest == null || segment.highestElevation > highest) {
            highest = segment.highestElevation;
        }

        totalDistance += segment.totalDistance;
        elevationGain += segment.elevationGain;
        elevationLoss += segment.elevationLoss;
        numberOfPoints += segment.numberOfPoints;
    });

    this.numberOfPoints = numberOfPoints;
    this.lowestElevation = lowest;
    this.highestElevation = highest;
    this.bounds = bounds;
    this.totalDistance = totalDistance;
    this.elevationGain = elevationGain;
    this.elevationLoss = elevationLoss;
}

exports.TrackRun = TrackRun;
exports.TrackSegment = TrackSegment;
exports.TrackInfo = TrackInfo;
exports.ElevationChangeType = ElevationChangeType;
