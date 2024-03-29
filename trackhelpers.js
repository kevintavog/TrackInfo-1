"use strict";


var gpxParse = require("gpx-parse-browser");
var trackHelpers = require("trackhelpers");
var trackModels = require("trackmodels");



// Return the distance between these two points in meters
exports.calculateDistance = function(point1, point2) {
    // gpx-parse returns the distance in kilometers, but elevation is in meters - convert for consistency
    return gpxParse.utils.calculateDistance(point1.lat, point1.lon, point2.lat, point2.lon) * 1000;
}

// Return the distance between these two points in meters
exports.calculateDistanceToLatLng = function(point, lat, lng) {
    // gpx-parse returns the distance in kilometers, but elevation is in meters - convert for consistency
    return gpxParse.utils.calculateDistance(point.lat, point.lon, lat, lng) * 1000;
}

exports.metersToFeet = function(v) {
    return v * 3.28084;
}

exports.metersToKm = function(v) {
    return v / 1000;
}

exports.metersToMiles = function(v) {
    return v / 1609.34;
}

exports.milesToMeters = function(v) {
    return v * 1609.34;
}

exports.metersPerSecondToMilesPerHour = function(v) {
    return v * 2.2369362921;
}

// Returns an array of TrackSegments, as defined/provided by the GPX file.
exports.trackSegments = function(gpx) {
    var trackSegments = [];

    if (gpx.tracks && gpx.tracks.length > 0) {
        gpx.tracks.forEach(function(track) {
            track.segments.forEach(function(segment) {
                trackSegments.push(new trackModels.TrackSegment(segment));
            })
        })
    }

    return trackSegments;
}

// Accepts an array of points
// Returns an array of TrackRuns
exports.getGaps = function(points) {
    var runs = [];

    var runStart = 0;
    for (var i = 1; i < points.length; ++i) {
        var timeDiff = points[i].time - points[i - 1].time;
        var distance = trackHelpers.calculateDistance(points[i - 1], points[i]);
        if (timeDiff > 1 && distance > 100) {
            runs.push(new trackModels.TrackRun(points.slice(runStart, i)));
            runStart = i;
        }
    }

    runs.push(new trackModels.TrackRun(points.slice(runStart, points.length + 1)));
    return runs;
}

exports.getElevationChanges = function(tracks) {
    var segments = [];
    if (tracks.length == 0) {
        return segments;
    }

    var changeType = trackModels.ElevationChangeType.Flat;
    var segmentStart = 0;

    if (tracks.length > 1) {
        var anchorElevation = tracks[0].elevation;
        changeType = getElevationChangeType(tracks[0].elevation, tracks[1].elevation, anchorElevation);

        for (var i = 1; i < tracks.length; ++i) {
            if (changeType != trackModels.ElevationChangeType.Flat) {
                anchorElevation = null;
            }

            var prevTrack = tracks[i - 1];
            var curTrack = tracks[i];

            var newType = getElevationChangeType(prevTrack.elevation, curTrack.elevation, anchorElevation);
            if (newType != changeType) {
                segments.push(new trackModels.TrackSegment(changeType, tracks.slice(segmentStart, i - 1)));
                segmentStart = i;

                changeType = newType;
                anchorElevation = curTrack.elevation;
            }
        }
    }

    segments.push(new trackModels.TrackSegment(changeType, tracks.slice(segmentStart, tracks.length + 1)));
    return segments;
}

function getElevationChangeType(ele1, ele2, anchorElevation) {
    if (anchorElevation != null && Math.abs(ele2 - anchorElevation) < 2) {
        return trackModels.ElevationChangeType.Flat;
    }

    var diff = ele2 - ele1;
    if (Math.abs(diff) <= 0) {
        return trackModels.ElevationChangeType.Flat;
    }
    return diff > 0 ? trackModels.ElevationChangeType.Rising : trackModels.ElevationChangeType.Falling;
}

exports.getAverageSpeed = function(points) {
    if (points.length < 2) {
        return 0;
    }

    var distance = trackHelpers.distanceFromArray(points);
    var timeSeconds = (points.slice(-1)[0].time - points[0].time) / 1000;
    return distance / timeSeconds;
}

exports.distanceFromArray = function(tracks) {
    var distance = 0;
    for (var i = 1; i < tracks.length; ++i) {
        distance += trackHelpers.calculateDistance(tracks[i - 1], tracks[i]);
    }
    return distance;
}

exports.getDistancePoints = function(trackSegments, metersApart) {
    var distancePoints = [];

    trackSegments.forEach(function(segment) {
        var distance = 0;

        if (segment.trackRuns.length > 0 && segment.trackRuns[0].points.length > 0) {
            var previousPoint = segment.trackRuns[0].points[0];
            var lastPoint = null;
            segment.trackRuns.forEach(function(trackRun) {
                trackRun.points.forEach(function(currentPoint) {
                    var before = Math.trunc(distance / metersApart);
                    distance += trackHelpers.calculateDistance(previousPoint, currentPoint);
                    var after = Math.trunc(distance / metersApart);
                    previousPoint = currentPoint;

                    if (before < after) {
                        if ((distance / metersApart) - after <= 0.1) {
                            distancePoints.push({ point: currentPoint, distance: after });
                            lastPoint = currentPoint;
                        }
                    }
                });
            });
        }
    });

    return distancePoints;
}

exports.getTimePoints = function(trackSegments, secondsApart) {
    var timePoints = [];

    trackSegments.forEach(function(segment) {
        var seconds = 0.0;

        if (segment.trackRuns.length > 0 && segment.trackRuns[0].points.length > 0) {
            var previousPoint = segment.trackRuns[0].points[0];
            var lastPoint = null;
            segment.trackRuns.forEach(function(trackRun) {
                trackRun.points.forEach(function(currentPoint) {

                    var before = Math.trunc(seconds / secondsApart);
                    seconds += (currentPoint.time - previousPoint.time) / 1000;
                    var after = Math.trunc(seconds / secondsApart);
                    previousPoint = currentPoint;

                    if (before < after) {
                        timePoints.push({ point: currentPoint, time: seconds });
                        lastPoint = currentPoint;
                    }
                });
            });
        }
    });

    return timePoints;
}

exports.findNearestPoint = function(trackSegment, lat, lng) {
    var bestDistance;
    var nearestPoint;
    var distanceFromStart;
    var durationFromStart;

    var currentDistance = 0;

    var firstPoint = trackSegment.trackRuns[0].points[0];

    trackSegment.trackRuns.forEach(function(trackRun) {
        for (var i = 0; i < trackRun.points.length; ++i) {
            var point = trackRun.points[i];
            if (i > 0) {
                currentDistance += trackHelpers.calculateDistance(point, trackRun.points[i - 1]);
            }

            var d = trackHelpers.calculateDistanceToLatLng(point, lat, lng);
            if (!bestDistance || d < bestDistance) {
                bestDistance = d;
                nearestPoint = point;
                distanceFromStart = currentDistance;
            }
        }
    });

    var durationFromStart = nearestPoint.time - firstPoint.time;
    return { point: nearestPoint, distance: distanceFromStart, duration: durationFromStart };
}
