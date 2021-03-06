// ****************************************
// Zoom to polygons
// ****************************************
function d3ZoomPolys(msg, d) {
    var features = _.filter(d3Layer.toGeoJSON().features, function(data) { return _.contains(d.ids, data.id.toString()); });
    var bounds = L.latLngBounds(L.geoJson(features[0]).getBounds());
    _.each(features, function(feature) {
        bounds.extend(L.geoJson(feature).getBounds());
    });
    map.fitBounds(bounds);
}


// ****************************************
// Geocode a location or a neighborhood
// ****************************************
function geocode(d) {
    // add a marker if a point location is passed
    if (d.lat) {
        try { map.removeLayer(marker); }
        catch (err) {}
        marker = L.marker([d.lat, d.lng]).addTo(map);
    }

    // zoom to neighborhood
    var feature = _.filter(d3Layer.toGeoJSON().features, function(data) { return data.id === d.id; });
    var bounds = L.latLngBounds(L.geoJson(feature[0]).getBounds());
    map.fitBounds(bounds);
}


// ****************************************
// Create the map
// ****************************************
function mapCreate() {
    L.Icon.Default.imagePath = './images';
    map = L.map("map", {
            attributionControl: false,
            touchZoom: true,
            minZoom: mapGeography.minZoom,
            maxZoom: mapGeography.maxZoom
        }).setView(mapGeography.center, mapGeography.defaultZoom);
    window.baseTiles = L.tileLayer(baseTilesURL);

    // full screen display button
    L.easyButton('glyphicon glyphicon-fullscreen', function (){
            map.setView(mapGeography.center, mapGeography.defaultZoom);
        },
        'Zoom to full extent'
    );

    // Add geolocation api control
    L.control.locate({
        icon: 'glyphicon glyphicon-map-marker locate-icon'
    }).addTo(map);

    // Year display
    var yearControl = L.control({position: 'bottomleft'});
    yearControl.onAdd = function(map) {
        this._div = L.DomUtil.create('div');
        this._div.innerHTML = '<h3 class="time-year"></h3>';
        return this._div;
    };
    yearControl.addTo(map);

    // make it so if scrolling on the page it disabled map zoom for a second
    $(window).on('scroll', function() {
        map.scrollWheelZoom.disable();
        setTimeout(function() { map.scrollWheelZoom.enable(); }, 1000);
    });

}


// ****************************************
// Initialize the D3 map layer
// ****************************************
function initMap() {
    // Eyes wide open for this gnarly hack.
    // There are lots of different ways to put a D3 layer on Leaflet, and I found
    // them all to be annoying and/or weird. So, here I'm adding the topojson as a
    // regular leaflet layer so Leaflet can manage zooming/redrawing/events/etc. However,
    // I want D3 to manage symbolization et al, so I rely on the fact that Leaflet
    // adds the polys in the topojson order to add a data-id and geom class to the
    // layer so I can handle it D3-ish rather than through the Leaflet API.
    d3Layer = L.geoJson(topojson.feature(model.geom, model.geom.objects[neighborhoods]), {
        style: {
            "fillColor": "rgba(0,0,0,0)",
            "color": "none",
            "fillOpacity": 1
        }
    }).addTo(map);

    d3.selectAll(".leaflet-overlay-pane svg path").attr("class", "geom metric-hover").attr("data-id", function(d, i) {
        return model.geom.objects[neighborhoods].geometries[i].id;
    });

    d3Layer.on("click", function(d) {
        var sel = d3.select(".geom[data-id='" + d.layer.feature.id + "']");
        if (sel.classed("d3-select")) {
            model.selected = _.difference(model.selected, [d.layer.feature.id]);
        }
        else {
            model.selected = _.union(model.selected, [d.layer.feature.id]);
        }
    });

    $(".geom").on({
        mouseenter: function(){
            addHighlight($(this));
        },
        mouseleave: function(){
            removeHighlight($(this));
        }
    });

    // Using D3 tooltips because I like them better. YMMV.
    $(".geom").tooltip({
        html: true,
        title: function() {
            var sel = $(this),
                num = "<br>N/A";
            if ($.isNumeric(sel.attr("data-value"))) {
                num = "<br>" + dataPretty(sel.attr("data-value"), $("#metric").val());
            }
            if (metricConfig[model.metricId].label) {
                num += "<br>" + metricConfig[model.metricId].label;
            }
            return "<p class='tip'><strong><span>" + neighborhoodDescriptor + " " + sel.attr("data-id") + "</strong>" + num + "</span></p>";
        },
        container: '#map'
    });

    // Here's where you would load other crap in your topojson for display purposes.
    // Change the styling here as desired.
    if (typeof overlay !== 'undefined') {
        geojson = L.geoJson(topojson.feature(model.geom, model.geom.objects[overlay]), {
            style: {
                "fillColor": "rgba(0,0,0,0)",
                "color": "white",
                "fillOpacity": 1,
                "opacity": 0.8,
                "weight": 3
            }
        }).addTo(map);
    }

    //  initialize neighborhood id's in typeahead
    polyid = _.map(model.geom.objects[neighborhoods].geometries, function(d){ return d.id.toString(); });

    // if neihborhoods are being passed from page load
    if (getURLParameter("n") !== "null") {
        var arr = [];
        _.each(getURLParameter("n").split(","), function(d) {
            arr.push(d);
        });
        model.selected = arr;
        d3ZoomPolys("", {"ids": arr});
    }
}


// ****************************************
// Color the map
// ****************************************
function drawMap() {

    var theGeom = d3.selectAll(".geom"),
        classlist = [],
        keys = Object.keys(model.metric[0]);

    // clear out quantile classes
    for (i = 0; i < colorbreaks; i++) {
        classlist.push("q" + i);
    }
    theGeom.classed(classlist.join(" "), false);

    theGeom.each(function() {
        var item = d3.select(this),
            theData = _.filter(model.metric, function(el) { return el.id == item.attr('data-id'); }),
            theValue = theData[0][keys[model.year + 1]],
            styleClass = "";

        if ($.isNumeric(theValue)) {
            styleClass = quantize(theValue);
        }

        item.classed(styleClass, true)
            .attr("data-value", theValue)
            .attr("data-quantile", styleClass)
            .attr("data-toggle", "tooltip");
    });

    var xScale = d3.scale.linear().domain(x_extent).range([0, $("#barChart").parent().width() - 60]);

    var y = d3.scale.linear().range([260, 0]).domain([0, 260]);

    // make sure our stuff is highlighted
    d3.selectAll(".geom").classed("d3-select", function(d) { return _.contains(model.selected, $(this).attr("data-id")); });
}
