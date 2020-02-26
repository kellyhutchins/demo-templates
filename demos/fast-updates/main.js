require([
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/FeatureLayer",
  "esri/renderers/smartMapping/statistics/histogram",
  "esri/renderers/smartMapping/statistics/summaryStatistics",
  "esri/widgets/Histogram",
  "esri/widgets/Slider",
  "esri/widgets/Legend",
  "esri/widgets/Expand",
  "esri/core/watchUtils",
  "esri/Color"
], function(
  Map,
  MapView,
  FeatureLayer,
  histogram,
  summaryStatistics,
  Histogram,
  Slider,
  Legend,
  Expand,
  watchUtils,
  Color
) {
  // Project base layer (world countries) to Equal Earth projection
  const baseLayer = new FeatureLayer({
    portalItem: {
      id: "2b93b06dc0dc4e809d3c8db5cb96ba69"
    },
    legendEnabled: false,
    popupEnabled: false,
    renderer: {
      type: "simple",
      symbol: {
        type: "simple-fill",
        color: [200, 200, 200, 0.75],
        outline: null
      }
    },
    spatialReference: {
      wkid: 54035
    }
  });

  //  Set initial temperature anomaly renderer on layer based
  // on data recorded for the year 1880

  const layer = new FeatureLayer({
    url:
      "https://services.arcgis.com/jIL9msH9OI208GCb/arcgis/rest/services/Global_Temperatures_1880_to_2018/FeatureServer/0",
    outFields: ["*"],
    title: "Temperatures by location (1880 - 2018)",
    renderer: {
      type: "simple",
      label: "Observation point",
      symbol: {
        type: "simple-marker",
        style: "diamond",
        size: "6px",
        color: [226, 226, 226, 0.75],
        outline: {
          color: [255, 255, 255, 0.25],
          width: "0.75px"
        }
      },
      visualVariables: [
        {
          type: "size",
          valueExpression: document.getElementById("size-arcade")
            .innerText,
          valueExpressionTitle: "Absolute Value",
          legendOptions: {
            showLegend: false
          },
          maxDataValue: 35,
          maxSize: "24px",
          minDataValue: 10,
          minSize: "4px"
        },
        {
          type: "color",
          valueExpression: "$feature.F1880",
          valueExpressionTitle: "Temperature Anomaly",
          stops: [
            {
              value: -2.5,
              color: [5, 112, 176, 0.75],
              label: "Less than -2.5 deg C"
            },
            { value: -1, color: [208, 209, 230, 0.75] },
            { value: -0.5, color: [236, 231, 242, 0.75] },
            {
              value: 0,
              color: [226, 226, 226, 0.75],
              label: "No difference/No Data"
            },
            { value: 0.5, color: [254, 232, 200, 0.75] },
            { value: 1, color: [253, 212, 158, 0.75] },
            {
              value: 2.5,
              color: [215, 48, 31, 0.75],
              label: "More than 2.5 deg C"
            }
          ]
        }
      ]
    },
    popupTemplate: {
      expressionInfos: [
        {
          name: "max",
          title: "Warmest anomaly",
          expression: document.getElementById("highest-temp-arcade")
            .innerText
        },
        {
          name: "min",
          title: "Coldest anomaly",
          expression: document.getElementById("lowest-temp-arcade")
            .innerText
        }
      ],
      content: [
        {
          type: "fields",
          fieldInfos: [
            {
              fieldName: "expression/max",
              format: {
                places: 2
              }
            },
            {
              fieldName: "expression/min",
              format: {
                places: 2
              }
            }
          ]
        }
      ]
    }
  });

  const map = new Map({
    layers: [baseLayer, layer]
  });

  const view = new MapView({
    container: "viewDiv",
    map: map,
    scale: 150000000,
    popup: {
      dockOptions: {
        position: "top-left"
      }
    }
  });

  view.ui.add(
    new Expand({
      view: view,
      content: document.getElementById("containerDiv"),
      expanded: true,
      expandIconClass: "esri-icon-chart"
    }),
    "bottom-left"
  );

  view.ui.add("toggle-snippet", "top-left");

  // This slider will allow the user to update the renderer based on a
  // provided year between 1880 and 2018

  const slider = new Slider({
    min: 1880,
    max: 2018,
    values: [1880],
    rangeLabelsVisible: true,
    labelsVisible: true,
    labelInputsEnabled: true,
    precision: 0,
    steps: 1,
    container: "sliderDiv"
  });

  // When the user changes the slider's value,
  // change the renderer and histogram to reflect
  // data corresponding to the year indicated on the slider

  slider.on(["thumb-change", "thumb-drag"], function(event) {
    updateRenderer(event.value);
    updateHistogram(event.value);
    updateYearDisplay(event.value);
  });

  let points = null;
  let lv = null;

  // Query all the features in the layer. These will by used
  // for client-side queries as the user slides the thumb of the slider

  view
    .whenLayerView(layer)
    .then(function(layerView) {
      lv = layerView;
      watchUtils.whenFalseOnce(layerView, "updating", function() {
        return layerView
          .queryFeatures()
          .then(function(response) {
            points = response.features;
            const year = slider.values[0];
            updateRenderer(year, layerView);
            updateHistogram(year);
          })
          .catch(function(e) {
            console.error(e);
          });
      });
    })
    .catch(function(e) {
      console.error(e);
    });

  // Updates the underlying data value driving the expression
  // based on the given year provided by the slider

  function updateRenderer(value) {
    renderer = layer.renderer.clone();
    const sizeVariable = renderer.visualVariables[0];
    const colorVariable = renderer.visualVariables[1];
    sizeVariable.valueExpression = getSizeValueExpression(value);
    colorVariable.valueExpression = getColorValueExpression(value);
    renderer.visualVariables = [sizeVariable, colorVariable];
    layer.renderer = renderer;
  }

  // Generate color visual variable based on the given year

  function getColorValueExpression(value) {
    return "$feature.F" + value;
  }

  // Generate size visual variable based on the given year
  // This is the same expression as "size-arcade" above, but
  // modifiable for any given year

  function getSizeValueExpression(value) {
    return (
      "var AbsTEMP = Abs($feature.F" +
      value +
      ")\r\nvar vs = $view.scale\r\n\r\nvar TempSize = when(\r\n\tAbsTEMP > 5, 35, \r\n\tAbsTEMP > 4, 30,\r\n\tAbsTEMP > 2.5, 25, \r\n\tAbsTEMP > 1, 20, \r\n\tAbsTEMP > 0.5, 15, \r\n\tAbsTEMP > 0.01, 12, \r\n\tAbsTEMP < 0.01, 10,\r\n\t8\r\n\t) \r\n\r\nwhen(\r\n\tvs >=37000000, TempSize,\r\n\tvs >=18500000, 2 + TempSize,\r\n\tvs >=9300000, 4 + TempSize,\r\n\tvs >=4700000, 6 + TempSize,\r\n\tvs >=2000000, 8 + TempSize, 10 + TempSize)"
    );
  }

  let histograms = {};
  let histogramChart = null;
  const histMin = -5;
  const histMax = 5;

  let highlight;

  function getAverage(params) {
    return summaryStatistics(params).then(function(statistics) {
      return statistics.avg;
    });
  }

  function updateHistogram(year) {
    if (histograms[year]) {
      histogramChart.bins = histograms[year];
    }

    // params for generating a histogram using the
    // points available on the client

    const params = {
      layer: layer,
      field: "F" + year,
      view: view,
      features: points,
      numBins: 100,
      minValue: histMin,
      maxValue: histMax
    };

    let average = null;

    getAverage(params)
      .then(function(avg) {
        average = avg;
        return histogram(params);
      })
      .then(function(histogramResult) {
        // cache previously used histograms to improve performance
        histograms[year] = histogramResult.bins;

        if (!histogramChart) {
          histogramChart = new Histogram({
            container: "histogram",
            min: histMin,
            max: histMax,
            bins: histogramResult.bins,
            average: average,
            dataLines: [
              {
                value: 0
              }
            ],
            dataLineCreatedFunction: function(element, label, index) {
              if (index === 0) {
                element.setAttribute("y2", "75%");
              }
            },
            labelFormatFunction: function(value, type) {
              return type === "average" ? value.toFixed(2) + "°" : value;
            },
            barCreatedFunction: function(index, element) {
              const bin = histogramChart.bins[index];
              const midValue =
                (bin.maxValue - bin.minValue) / 2 + bin.minValue;
              const color = getColorFromValue(midValue);
              element.setAttribute("fill", color.toHex());
              element.addEventListener("focus", function() {
                const { minValue, maxValue, count } = bin;
                const query = lv.layer.createQuery();
                const field = "F" + slider.values[0];
                query.where =
                  field +
                  " >= " +
                  minValue +
                  " AND " +
                  field +
                  " <= " +
                  maxValue;
                lv.queryObjectIds(query).then(function(ids) {
                  if (highlight) {
                    highlight.remove();
                    highlight = null;
                  }
                  highlight = lv.highlight(ids);
                });
              });

              element.addEventListener("blur", function() {
                if (highlight) {
                  highlight.remove();
                  highlight = null;
                }
              });
            }
          });
        } else {
          histogramChart.bins = histogramResult.bins;
          histogramChart.average = average;
        }
      })
      .catch(function(e) {
        console.error(e);
      });
  }

  // Infers the color of the visual variable based on a given value
  // This is used to render and update histogram bars with colors
  // matching the features in the map
  function getColorFromValue(value) {
    const visualVariable = layer.renderer.visualVariables.filter(function(
      vv
    ) {
      return vv.type === "color";
    })[0];
    const stops = visualVariable.stops;
    let minStop = stops[0];
    let maxStop = stops[stops.length - 1];

    let minStopValue = minStop.value;
    let maxStopValue = maxStop.value;

    if (value < minStopValue) {
      return minStop.color;
    }

    if (value > maxStopValue) {
      return maxStop.color;
    }

    const exactMatches = stops.filter(function(stop) {
      return stop.value === value;
    });

    if (exactMatches.length > 0) {
      return exactMatches[0].color;
    }

    minStop = null;
    maxStop = null;
    stops.forEach(function(stop, i) {
      if (!minStop && !maxStop && stop.value >= value) {
        minStop = stops[i - 1];
        maxStop = stop;
      }
    });

    const weightedPosition =
      (value - minStop.value) / (maxStop.value - minStop.value);

    return Color.blendColors(
      minStop.color,
      maxStop.color,
      weightedPosition
    );
  }

  function updateYearDisplay(year) {
    const yearElement = document.getElementById("yearDiv");
    yearElement.innerText = year;
  }
});