require([
  "esri/geometry",
  "esri/config",
  "esri/views/MapView",
  "esri/WebMap",
  "esri/widgets/Legend"
], function(geometry, esriConfig, MapView, WebMap, Legend) {
  const webmap = new WebMap({
    portalItem: {
      // autocasts as new PortalItem()
      // id: "2dfcda88017a42c1b3677bc2bfa1b9df"
      id: "45bb428b03d24cab9c6f5dbae21f20a7"
    }
  });

  const view = new MapView({
    map: webmap,
    container: "viewDiv"
  });

  const legend = new Legend({ view });
  view.ui.add(legend, "bottom-right");

  esriConfig.request.interceptors.push({
    url: /\/query/,
    before: (params) => {
      if (
        params.requestOptions.query &&
        params.requestOptions.query.geometry
      ) {
        const g = geometry.fromJSON(
          JSON.parse(params.requestOptions.query.geometry)
        );
        view.graphics.add({
          geometry: g,
          symbol: {
            type: "simple-fill",
            style: "none",
            outline: { color: "blue" }
          }
        });
      }
    }
  });

  view.when(() => {
    const layer = view.map.layers.getItemAt(0);
    const defaultRenderer = layer.renderer.clone();
    const renderer = layer.renderer.clone();
    renderer.uniqueValueInfos.forEach(info => {
      info.symbol.size = info.symbol.size * 2;
    });

    view.watch("scale", (scale) => {
      if (scale < 600000) {
        layer.renderer = renderer;
      }
      else {
        layer.renderer = defaultRenderer;
      }
      view.graphics.removeAll();
    });
  });

  view.ui.add("toggle-snippet", "top-left");
});