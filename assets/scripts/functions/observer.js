var model = {
    "selected": [],
    "metricAccuracy": [],
    "metricRaw": [],
    "metricRawAccuracy": []
};

function modelChanges(changes) {

    var tasklist = _.pluck(changes, 'name');

    // Just got the geometry yo. Let's make a map.
    if (_.contains(tasklist, "geom")) {
        initMap();
        initTypeahead();
    }

    // the metric id changed, get some data
    if(_.contains(tasklist, "metricId")) {
        // Make sure a year has been set before
        var metricChange = _.filter(changes, function(el) { return el.name === "metricId"; });
        if (metricChange[0].hasOwnProperty('oldValue')) {
            // change chosen if not samsies
            if (model.metricId !== undefined && $(".chosen-select").chosen().val() !== model.metricId) {
                $('.chosen-select').val(model.metricId);
                $('.chosen-select').trigger("chosen:updated");
            }
            fetchMetricData(model.metricId);
        }
    }

    // Metrics in the house
    if (_.contains(tasklist, "metric")) {
        processMetric();
        drawMap();
        drawBarChart();
        lineChartCreate();
        updateMeta();
        drawTable();
        updateStats();
        if (recordHistory) { recordMetricHistory(); }
        recordHistory = true;
    }

    // Hopping in the DeLorean
    if (_.contains(tasklist, "year")) {
        // Make sure a year has been set before
        var yearChange = _.filter(changes, function(el) { return el.name === "year"; });
        if (yearChange[0].hasOwnProperty('oldValue')) {
            // change year slider if not samsies
            if ($('.slider').slider('value') !== model.year) {
                $('.slider').slider('value', model.year);
            }
            var keys = Object.keys(model.metric[0]);
            $('.time-year').text(keys[model.year + 1].replace("y_", ""));
            drawMap();
            drawBarChart();
            drawTable();
            updateStats();
        }
    }

    // Add stuff to selected set
    if (_.contains(tasklist, "select")) {
        model.selected = _.union(model.selected, model.select);
    }

    // Remove stuff from selected set
    if (_.contains(tasklist, "unselect")) {
        model.selected = _.difference(model.selected, model.unselect);
    }

    // the selected set changed
    if (_.contains(tasklist, "selected")) {
            // map selection
            d3.selectAll(".geom").classed("d3-false");
            d3.selectAll(".geom").classed("d3-select", function(d) { return _.contains(model.selected, $(this).attr("data-id")); });
            // enable report links
            $(".report-launch").removeClass("disabled");
            // bar chart
            valueChart.selectedPointer(".value-select");
            // line chart
            lineChartCreate();
            // table
            drawTable();
            // fancy metric blocks
            updateStats();

        if (model.selected.length === 0) {
            // disable report links and remove map marker
            $(".report-launch").addClass("disabled");
            try { map.removeLayer(marker); }
            catch (err) {}
        }
    }

}

Object.observe(model, function(changes) {
    modelChanges(changes);
});