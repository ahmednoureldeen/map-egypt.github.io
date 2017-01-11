'use strict';
import React from 'react';
import window from 'global/window';
import bbox from '@turf/bbox';
import { scaleQuantile } from 'd3-scale';
import { extend } from 'lodash';
import { get } from 'object-path';
import { byEgy, byName } from '../utils/governorates';
const L = window.L;

const tileLayer = 'https://api.mapbox.com/styles/v1/map-egypt/civld9uy0000n2kmnd7lqs3ne/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoibWFwLWVneXB0IiwiYSI6ImNpdmxkMjl6bTA3c2YyeXBvNDJnZDlqZGMifQ.KQSizb18ILr6wri0cBcd2Q';

const BOUNDS = [
  [22.278144, 25.127830],
  [31.118067, 33.719138]
];

const SEQUENTIAL = [
  '#f1eef6',
  '#bdc9e1',
  '#74a9cf',
  '#2b8cbe',
  '#045a8d'
];

const OVERLAY_STYLE = {
  weight: 1,
  opacity: 1,
  color: 'white',
  fillOpacity: 0.5
};

function getLatLngBounds (bounds) {
  let b = bbox(bounds);
  let result = [[b[1], b[0]], [b[3], b[2]]];
  return result;
}

const Map = React.createClass({
  displayName: 'Map',

  propTypes: {
    lang: React.PropTypes.string,
    location: React.PropTypes.object,
    markers: React.PropTypes.array,
    overlay: React.PropTypes.object
  },

  getInitialState: function () {
    return {
      activeProject: true,
      activeIndicator: false
    };
  },

  fitMap: function (props) {
    let bounds;
    if (props.location) {
      bounds = props.location.type
        ? getLatLngBounds(props.location)
        : props.location;
    } else {
      bounds = BOUNDS;
    }
    this.map.fitBounds(bounds);
  },

  addClusterMarkers: function (markers, lang) {
    lang = lang || 'en';
    const locationLang = lang === 'en' ? 'name' : 'nameAr';
    const markerLayer = this.markerLayer;
    markerLayer.clearLayers();
    markers.forEach(function (marker) {
      const leafletMarker = L.marker(marker.centroid, {
        icon: L.mapbox.marker.icon({'marker-symbol': 'circle', 'marker-color': '2B2342'})
      });

      leafletMarker.bindPopup(
        `<div class='marker__internal'>` +
          `<h5 class='marker__title'><a href='#/${lang}/projects/${marker.id}' class='link--deco'>${marker.name}</a></h5>` +
          `<dl class='card-meta'>` +
                `<dt class='card-meta__label'>Status</dt>` +
                `<dd class='card-meta__value card-meta__value--status'>Delayed</dd>` +
                `<dt class='card-meta__label'>Location</dt>` +
                `<dd class='card-meta__value card-meta__value--location'>${byName(marker.region)[locationLang]}</dd>` +
              `</dl>` +
        `</div>`
      );
      markerLayer.addLayer(leafletMarker);
    });
  },

  renderOverlay: function (overlay) {
    if (this.overlay) {
      this.overlay.remove();
    }
    if (!overlay) { return; }
    const { values, regions } = overlay;
    const domain = values.map((d) => +d.value);
    const scale = scaleQuantile().domain(domain).range(SEQUENTIAL);
    const style = (feature) => {
      if (!feature.properties._value) {
        return OVERLAY_STYLE;
      }
      return extend({
        fillColor: scale(feature.properties._value)
      }, OVERLAY_STYLE);
    };

    const idMap = {};
    values.forEach((value) => {
      idMap[value.id] = +value.value;
    });

    regions.features.forEach(function (feature) {
      feature.properties._value = get(idMap, feature.properties.admin_id);
    });

    this.overlay = L.geoJson(regions, { style }).bindPopup(function ({ feature }) {
      const id = feature.properties.admin_id;
      const meta = byEgy(id);
      return `
      <div class='marker__internal'>
        <h5 class='marker__title'>${meta.name}</h5>
        <p class='marker__description'>Value: <strong>${get(feature, 'properties._value', '--')}</strong></p>
      </div>
      `;
    }).addTo(this.overlayLayer);
  },

  componentWillUnmount: function () {
    this.map.remove();
  },

  componentWillReceiveProps: function (props) {
    if (props.location && (!this.props.location || JSON.stringify(props.location) !== JSON.stringify(this.props.location))) {
      this.fitMap(props);
    }

    if (props.markers && (!this.props.markers || props.markers.length !== this.props.markers.length ||
        JSON.stringify(props.markers) !== JSON.stringify(this.props.markers))) {
      this.addClusterMarkers(props.markers, props.lang);
    }

    if ((props.overlay && (!this.props.overlay || props.overlay.id !== this.props.overlay.id)) || (this.props.overlay && !props.overlay)) {
      this.renderOverlay(props.overlay);
    }

    if (props.lang !== this.props.lang) this.addClusterMarkers(props.markers, props.lang);
  },

  mountMap: function (el) {
    if (el) {
      this.map = L.mapbox.map(el, null, {
        scrollWheelZoom: false,
        maxZoom: 11
      });
      L.tileLayer(tileLayer).addTo(this.map);

      this.overlayLayer = L.featureGroup();
      this.map.addLayer(this.overlayLayer);

      this.markerLayer = L.markerClusterGroup();
      this.map.addLayer(this.markerLayer);

      this.fitMap(this.props);

      const { markers, overlay, lang } = this.props;
      if (markers) {
        this.addClusterMarkers(markers, lang);
      }
      if (overlay) {
        this.renderOverlay(overlay);
      }
    }
  },

  renderMarkerLegend: function () {
    return (
      <span className='legend__markers'>
        <span className='legend__item legend__marker--cluster'><span className='legend__image legend__image--cluster'>
            <span className='legend__image--cluster--bg'></span>
            <span className='legend__image--cluster--text'>8</span>
        </span> Group of Projects</span>
        <span className='legend__item legend__marker--project'><span className='legend__image legend__image--marker'><img src='assets/graphics/content/map-pin.png' alt='A marker indicates a single project'/></span> Project</span>
      </span>
    );
  },

  renderOverlayLegend: function () {


  },

  render: function () {
    return (
      <div>
        <div className='map__container' ref={this.mountMap}></div>
        <div className='legend__container'>
          {this.renderMarkerLegend()}
        </div>
      </div>
    );
  }
});

module.exports = Map;
