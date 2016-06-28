"use strict";


var gpxParse = require("gpx-parse-browser");
var trackHelpers = require("trackhelpers");
var trackModels = require("trackmodels");



// Return the distance between these two points in meters
exports.calculateDistance = function(point1, point2) {
    // gpx-parse returns the distance in kilometers, but elevation is in meters - convert for consistency
    return gpxParse.utils.calculateDistance(point1.lat, point1.lon, point2.lat, point2.lon) * 1000;
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

exports.allTracks = function(gpx) {
    var allTracks = [];

    if (gpx.tracks && gpx.tracks.length > 0) {
        gpx.tracks.forEach(function(track) {
            track.segments.forEach(function(segment) {
                segment.forEach(function(point) {
                    allTracks.push(point);
                })
            })
        })
    }

    return allTracks;
}

// Returns an array of track arrays
exports.getGaps = function(tracks) {
    var gaps = [];

    var gapStart = 0;
    for (var i = 1; i < tracks.length; ++i) {
        var timeDiff = tracks[i].time - tracks[i - 1].time;
        var distance = trackHelpers.calculateDistance(tracks[i - 1], tracks[i]);
        if (timeDiff > 1 && distance > 100) {
            gaps.push(tracks.slice(gapStart, i));
            gapStart = i;
        }
    }

    gaps.push(tracks.slice(gapStart, tracks.length + 1))

    return gaps;
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

exports.getSpeeds = function(tracks, smoothCount) {
    var segments = [];

    if (tracks.length <= smoothCount) {
        var distance = trackHelpers.distanceFromArray(tracks);
        console.log("small array; distance - " + distance);
    } else {
        var distance = trackHelpers.distanceFromArray(tracks);
//        console.log("distance - " + distance + "; " + tracks.length);
    }

    return segments;
}

exports.distanceFromArray = function(tracks) {
    var distance = 0;
    for (var i = 1; i < tracks.length; ++i) {
        distance += trackHelpers.calculateDistance(tracks[0], tracks[1]);
    }
    return distance;
}

exports.getDistances = function(tracks, metersApart) {
    var markers = [];
    var distance = 0;
    for (var i = 1; i < tracks.length; ++i) {
        var before = Math.trunc(distance / metersApart);

        distance += trackHelpers.calculateDistance(tracks[i - 1], tracks[i]);
        var after = Math.trunc(distance / metersApart);
        if (before < after) {
            if ((distance / metersApart) - after <= 0.1) {
                markers.push({ track: tracks[i], distance: after });
            }
        }
    }
    return markers;
}
