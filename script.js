var graphsrc = document.getElementById("graphsrc");
var namessrc = document.getElementById("namessrc");
var graphview = document.getElementById("graphview");
var timeslider = document.getElementById("timeslider");
var timedisplay = document.getElementById("timedisplay");
var prevev = document.getElementById("prevev");
var nextev = document.getElementById("nextev");

if (localStorage.data)
    graphsrc.value = localStorage.data;
if (localStorage.names)
    namessrc.value = localStorage.names;

var gEvents = [];
var gStart = 0;
var gEnd = 0;
var gTime = 0;
var gNames = {};

var w = graphview.clientWidth;
var h = graphview.clientHeight;

var d3vis = d3.select("#graphview")
        .append("svg:svg")
        .attr("width", w)
        .attr("height", h)
        .attr("id", "svg")
        .attr("pointer-events", "all")
        .attr("viewBox", "0 0 " + w + " " + h)
        .attr("perserveAspectRatio", "xMinYMid")
        .append('svg:g');
var d3force = d3.layout.force();
var d3nodes = d3force.nodes();
var d3links = d3force.links();

function nodeColor(node) {
    var r, g, b;
    if (node.type == "video") {
        r = 255, g = 0, b = 0;
    } else if (node.type == "user") {
        r = 0, g = 255, b = 0;
    } else if (node.type == "group") {
        r = 0, g = 0, b = 255;
    } else {
        r = 255, g = 0, b = 255;
    }

    var fadeDuration = 1000*60*60*24*30;

    var diff = gTime - node.active;
    var rel = diff / fadeDuration;
    var dim = 1.0 - Math.min(Math.max(rel, 0.0), 0.3);
    r *= dim; g *= dim; b *= dim;

    return 'rgb(' + (r|0) + ',' + (g|0) + ',' + (b|0) + ')';
}

function updateGraph() {
    var link = d3vis.selectAll("line")
            .data(d3links, function (d) {
                return d.source.id + "-" + d.target.id;
            });

    link.enter().append("line")
            .attr("id", function (d) {
                return d.source.id + "-" + d.target.id;
            })
            .attr("stroke-width", function (d) {
                return 5.0;
            })
            .attr("class", "link");
    link.append("title")
            .text(function (d) {
                if (gNames[d.value])
                return d.value;
            });
    link.exit().remove();

    var node = d3vis.selectAll("g.node")
            .data(d3nodes, function (d) {
                return d.id;
            });

    node.select("circle").attr("fill", nodeColor);

    var nodeEnter = node.enter().append("g")
            .attr("class", "node")
            .call(d3force.drag);

    nodeEnter.append("svg:circle")
            .attr("r", 12)
            .attr("id", function (d) {
                return "Node;" + d.id;
            })
            .attr("class", "nodeStrokeClass")
            .attr("fill", nodeColor);

    nodeEnter.filter(function (d) { return d.type == "user" || d.type == "group"; })
            .append("svg:text")
            .attr("class", "textClass")
            .attr("x", 14)
            .attr("y", ".31em")
            .text(function (d) {
                if (gNames[d.id])
                    return gNames[d.id];
                return d.id;
            });

    nodeEnter.filter(function (d) { return d.type == "video"; })
            .append("svg:title")
            .text(function (d) {
                if (gNames[d.id])
                    return gNames[d.id];
                return d.id;
            });

    node.exit().remove();

    d3force.on("tick", function () {

        node.attr("transform", function (d) {
            return "translate(" + d.x + "," + d.y + ")";
        });

        link.attr("x1", function (d) {
            return d.source.x;
        })
                .attr("y1", function (d) {
                    return d.source.y;
                })
                .attr("x2", function (d) {
                    return d.target.x;
                })
                .attr("y2", function (d) {
                    return d.target.y;
                });
    });

    d3force
        .size([w, h])
        .linkStrength(0.1)
        .friction(0.9)
        .linkDistance(40)
        .charge(-90)
        .gravity(0.07)
        .theta(0.8)
        .alpha(0.1)
        .start();

    [].forEach.call(document.querySelectorAll(".nodeStrokeClass"), function(element) {
            var gnode = element.parentNode;
            gnode.parentNode.appendChild(gnode);
        });
}

updateGraph();

function parseEvents() {
    var data = graphsrc.value;
    var lines = data.split("\n");
    var events = [];

    localStorage.data = data;

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        var cols = line.split(",");
        if (cols.length != 6)
            continue;

        events.push({
            time: Date.parse(cols[0]),
            type: cols[1],
            user: parseInt(cols[2]),
            target: parseInt(cols[3]),
            extra: parseInt(cols[4]),
            state: parseInt(cols[5]),
        });
    }

    var start = events[0].time;
    var end = events[events.length - 1].time;

    timeslider.min = start;
    timeslider.max = end;
    timeslider.value = start;
    userSeek();

    gEvents = events;
    gStart = start;
    gEnd = end;
}


var updateId = 0;

var processEvent = {
    "view_video": false,
    "upload_video": true,
    "share_video": true,
    "join_group": true,
    "leave_group": true,
};

var d3nodeMap = { };
var d3linkMap = { };

function updateState() {

    updateId++;

    var nodes = { };
    var links = { };

    function setNode(type, id, time) {
        var name = type + id;
        var node = nodes[name];
        if (node) {
            node.time = time;
        } else {
            node = {
                type: type,
                time: time,
            };
            nodes[name] = node;
        }
    }

    function setLink(st, s, dt, d, type, time) {
        var name = st + s + "-" + dt + d + "-" + type;
        var link = links[name];
        if (link) {
            link.time = time;
        } else {
            link = {
                type: type,
                time: time,
                srcId: st + s,
                dstId: dt + d,
            };
            links[name] = link;
        }
    }

    function deleteLink(st, s, dt, t, type) {
        var name = st + s + "-" + dt + t + "-" + type;
        delete links[name];
    };

    for (var i = 0; i < gEvents.length; i++) {
        var ev = gEvents[i];
        if (ev.time > gTime)
            break;

        if (!processEvent[ev.type])
            continue;

        if (ev.type == "view_video") {
            setNode("user", ev.user, ev.time);
            setNode("video", ev.target, ev.time);
            setLink("user", ev.user, "video", ev.target, "view", ev.time);
        } else if (ev.type == "upload_video") {
            setNode("user", ev.user, ev.time);
            setNode("video", ev.target, ev.time);
            setLink("user", ev.user, "video", ev.target, "upload", ev.time);
        } else if (ev.type == "share_video") {
            setNode("user", ev.user, ev.time);
            setNode("video", ev.target, ev.time);
            setNode("group", ev.extra, ev.time);

            if (ev.state) {
                setLink("group", ev.extra, "video", ev.target, "upload", ev.time);
            } else {
                deleteLink("group", ev.extra, "video", ev.target, "upload");
            }
        } else if (ev.type == "join_group") {
            setNode("user", ev.user, ev.time);
            setNode("group", ev.target, ev.time);
            setLink("group", ev.target, "user", ev.user, "join", ev.time);
        } else if (ev.type == "leave_group") {
            deleteLink("group", ev.target, "user", ev.user, "join");
        }
    }

    for (var nodeId in nodes) {
        var node = nodes[nodeId];
        var d3node = d3nodeMap[nodeId];
        if (d3node) {
            d3node.active = node.time;
            d3node.update = updateId;
        } else {
            d3node = {
                id: nodeId,
                type: node.type,
                active: node.time,
                update: updateId,
                x: (Math.random() * 0.5 + 0.25) * w,
                y: (Math.random() * 0.5 + 0.25) * h,
            };
            d3nodes.push(d3node);
            d3nodeMap[nodeId] = d3node;
        }
    }

    for (var linkId in links) {
        var link = links[linkId];
        var d3link = d3linkMap[linkId];
        if (d3link) {
            d3link.active = node.time;
            d3link.update = updateId;
        } else {
            d3link = {
                linkId: linkId,
                source: d3nodeMap[link.srcId],
                target: d3nodeMap[link.dstId],
                type: link.type,
                active: link.time,
                update: updateId,
            };
            d3links.push(d3link);
            d3linkMap[linkId] = d3link;
        }
    }

    for (var i = 0; i < d3nodes.length;) {
        if (d3nodes[i].update != updateId) {
            delete d3nodeMap[d3nodes[i].id];
            d3nodes.splice(i, 1);
        } else {
            i++;
        }
    }
    for (var i = 0; i < d3links.length;) {
        if (d3links[i].update != updateId) {
            delete d3linkMap[d3links[i].linkId];
            d3links.splice(i, 1);
        } else {
            i++;
        }
    }
}


function updateNames() {
    // Clear in case of failure
    gNames = { };
    localStorage.names = namessrc.value;

    json = JSON.parse(namessrc.value)
    names = { }
    for (var id in json["users"]) {
        names["user" + id] = json["users"][id]
    }
    for (var id in json["videos"]) {
        names["video" + id] = json["videos"][id]
    }
    for (var id in json["groups"]) {
        names["group" + id] = json["groups"][id]
    }
    gNames = names;
}

function userPrevEvent() {
    for (var i = gEvents.length - 1; i >= 0; i--) {
        if (!processEvent[gEvents[i].type])
            continue;
        if (gEvents[i].time < gTime) {
            gTime = gEvents[i].time;
            break;
        }
    }
    timeslider.value = gTime;
    timedisplay.innerHTML = new Date(gTime).toString();
    updateState();
    updateGraph();
}

function userNextEvent() {
    for (var i = 0; i < gEvents.length; i++) {
        if (!processEvent[gEvents[i].type])
            continue;
        if (gEvents[i].time > gTime) {
            gTime = gEvents[i].time;
            break;
        }
    }
    timeslider.value = gTime;
    timedisplay.innerHTML = new Date(gTime).toString();
    updateState();
    updateGraph();
}

function userSeek() {
    var time = parseInt(timeslider.value);
    timedisplay.innerHTML = new Date(gTime).toString();
    gTime = time;
    updateState();
    updateGraph();
}

graphsrc.addEventListener("input", parseEvents);
namessrc.addEventListener("input", updateNames);
timeslider.addEventListener("input", userSeek);
prevev.addEventListener("click", userPrevEvent);
nextev.addEventListener("click", userNextEvent);

parseEvents();
updateNames();

