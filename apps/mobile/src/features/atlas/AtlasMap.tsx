import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { getLocales } from 'expo-localization'
import Supercluster from 'supercluster'
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapView,
  Marker,
  RasterSource,
  type CameraRef,
  type LngLatBounds,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native'
import { detectCountry, EUROPE_BOUNDS, homeBounds, homeCountry, type BoundsTuple, type Cottage, type LatLng } from '@chatynkowo/core'
import type { Position } from '../../lib/location'
import { mapPalette } from '../../ui'
import { ClusterBadge, CottagePin, UserDot } from './pins'

/* The expedition map, drawn after the site's: OpenStreetMap tiles washed
   into parchment that turn real as the seeker zooms in, teardrop pins that
   gather into clusters, a search area around the chosen cottage and the
   seeker's own dot. The screen around it owns the chrome (level, controls,
   panel). */

export type MapLevel = 'europa' | 'kraj' | 'region' | 'szlak'

export const LEVEL_KEYS: Record<MapLevel, string> = {
  europa: 'map.levelEuropa',
  kraj: 'map.levelKraj',
  region: 'map.levelRegion',
  szlak: 'map.levelSzlak',
}

export type AtlasMapHandle = {
  resetView: () => void
  showPosition: (position: LatLng) => void
  /* Frame the search area of a cottage, leaving room for the panel below. */
  frameCottage: (cottage: LatLng, bottomPadding: number) => void
  /* Give the map its full height back once the panel is gone. */
  releasePadding: () => void
}

export type MapPresentation = {
  level: MapLevel
  /* 0 at the parchment zooms, 1 once the tiles show the real land. */
  reality: number
}

type AtlasMapProps = {
  cottages: Cottage[]
  foundSlugs: Set<string>
  selectedSlug: string | null
  userPosition: Position | null
  onSelect: (cottage: Cottage) => void
  onPresentationChange: (presentation: MapPresentation) => void
}

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const EMPTY_STYLE = { version: 8 as const, sources: {}, layers: [] }
const FRAME_PADDING = { top: 48, right: 48, bottom: 48, left: 48 }
const SEARCH_AREA_RADIUS_M = 360
const COTTAGE_ZOOM = 14
const POSITION_ZOOM = 14
/* From this zoom the view is a neighbourhood rather than a country, and
   from TRAIL_ZOOM a single trail — the same rungs as the site. */
const REGION_ZOOM = 9.5
const TRAIL_ZOOM = 13.5
const CLUSTER_RADIUS = 60
const CLUSTERS_UNTIL_ZOOM = 14

function toLngLatBounds([[south, west], [north, east]]: BoundsTuple): LngLatBounds {
  return [west, south, east, north]
}

const EUROPE = toLngLatBounds(EUROPE_BOUNDS)

type View = { zoom: number; bounds: LngLatBounds; center: LatLng }

/* The zoom at which a box would just fill the viewport, measured from the
   current view's own spans (exact enough over these areas). */
function fitZoom(view: View, [[south, west], [north, east]]: BoundsTuple): number {
  const [viewWest, viewSouth, viewEast, viewNorth] = view.bounds
  const ratio = Math.min((viewNorth - viewSouth) / (north - south), (viewEast - viewWest) / (east - west))
  return view.zoom + Math.log2(ratio)
}

/* The zoom tiers of the site, derived from the viewport the same way: the
   map floor fits Europe and the kraj tier starts where the home country
   fills the view; above that the view is a neighbourhood, then a single
   trail. Without a home country there is no kraj rung and the ladder goes
   straight from europa. */
function levelForZoom(zoom: number, krajMin: number, hasHomeCountry: boolean): MapLevel {
  if (zoom < krajMin - 0.45) return 'europa'
  if (zoom < REGION_ZOOM) return hasHomeCountry ? 'kraj' : 'europa'
  return zoom < TRAIL_ZOOM ? 'region' : 'szlak'
}

/* A circle of `radiusMetres` around a point as a polygon ring. */
function circleRing({ lat, lng }: LatLng, radiusMetres: number, steps = 64): GeoJSON.Position[] {
  const latDegrees = radiusMetres / 111_320
  const lngDegrees = radiusMetres / (111_320 * Math.cos((lat * Math.PI) / 180))
  const ring: GeoJSON.Position[] = []
  for (let step = 0; step <= steps; step++) {
    const angle = (step / steps) * 2 * Math.PI
    ring.push([lng + lngDegrees * Math.cos(angle), lat + latDegrees * Math.sin(angle)])
  }
  return ring
}

function circleFeature(center: LatLng, radiusMetres: number): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [circleRing(center, radiusMetres)] } }] }
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

/* One polygon over the whole map: the warm wash the site multiplies over
   its tiles. */
const TINT: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]] } }],
}

export const AtlasMap = forwardRef<AtlasMapHandle, AtlasMapProps>(function AtlasMap(
  { cottages, foundSlugs, selectedSlug, userPosition, onSelect, onPresentationChange },
  ref,
) {
  const { t } = useTranslation()
  const camera = useRef<CameraRef>(null)

  /* The device languages name the visitor's country (never geolocation),
     exactly as the browser languages do on the site. */
  const country = useMemo(() => homeCountry(cottages, detectCountry(getLocales().map((locale) => locale.languageTag))), [cottages])
  const homeBox = useMemo(() => homeBounds(cottages, country), [cottages, country])
  const home = useMemo(() => toLngLatBounds(homeBox), [homeBox])
  const [view, setView] = useState<View>(() => {
    const [[south, west], [north, east]] = homeBox
    return { zoom: 5, bounds: [west, south, east, north], center: { lat: (south + north) / 2, lng: (west + east) / 2 } }
  })
  const krajMin = useMemo(() => Math.max(3, fitZoom(view, homeBox) - 0.2), [view, homeBox])

  const bySlug = useMemo(() => new Map(cottages.map((cottage) => [cottage.slug, cottage])), [cottages])
  const selected = selectedSlug ? bySlug.get(selectedSlug) ?? null : null

  const index = useMemo(() => {
    const clusters = new Supercluster<{ slug: string }>({ radius: CLUSTER_RADIUS, maxZoom: CLUSTERS_UNTIL_ZOOM })
    clusters.load(cottages.map((cottage) => ({ type: 'Feature', properties: { slug: cottage.slug }, geometry: { type: 'Point', coordinates: [cottage.lng, cottage.lat] } })))
    return clusters
  }, [cottages])

  const level = selected ? 'szlak' : levelForZoom(view.zoom, krajMin, Boolean(country))
  const reality = Math.max(0, Math.min(1, (view.zoom - 9) / 4))

  useEffect(() => {
    onPresentationChange({ level, reality })
  }, [level, reality, onPresentationChange])

  /* Clusters for what is on screen (plus a margin so pins slide in rather
     than pop), recomputed as the view settles. */
  const clusters = useMemo(() => {
    const [west, south, east, north] = view.bounds
    const marginX = (east - west) * 0.2
    const marginY = (north - south) * 0.2
    return index.getClusters([west - marginX, south - marginY, east + marginX, north + marginY], Math.floor(view.zoom))
  }, [index, view])

  const searchArea = useMemo(() => (selected ? circleFeature(selected, SEARCH_AREA_RADIUS_M) : EMPTY), [selected])
  const userAccuracy = useMemo(
    () => (userPosition?.accuracy ? circleFeature(userPosition, Math.max(userPosition.accuracy, 25)) : EMPTY),
    [userPosition],
  )

  useImperativeHandle(
    ref,
    () => ({
      resetView: () => camera.current?.fitBounds(home, { padding: FRAME_PADDING, duration: 900 }),
      showPosition: (position) => camera.current?.easeTo({ center: [position.lng, position.lat], zoom: POSITION_ZOOM, duration: 900 }),
      frameCottage: (cottage, bottomPadding) =>
        camera.current?.easeTo({ center: [cottage.lng, cottage.lat], zoom: COTTAGE_ZOOM, padding: { top: 40, bottom: bottomPadding, left: 24, right: 24 }, duration: 1000 }),
      releasePadding: () => void camera.current?.setStop({ padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 300 }),
    }),
    [home],
  )

  const onViewChange = (event: { nativeEvent: ViewStateChangeEvent }) => {
    const { zoom, bounds, center } = event.nativeEvent
    setView({ zoom, bounds, center: { lng: center[0], lat: center[1] } })
  }

  return (
    <MapView
      style={styles.map}
      mapStyle={EMPTY_STYLE}
      logo={false}
      attribution
      attributionPosition={{ bottom: 70, left: 12 }}
      compassHiddenFacingNorth
      touchPitch={false}
      onRegionDidChange={onViewChange}
    >
      <Camera ref={camera} initialViewState={{ bounds: home, padding: FRAME_PADDING }} maxBounds={EUROPE} minZoom={3} maxZoom={18} />

      <Layer id="parchment" type="background" paint={{ 'background-color': mapPalette.parchment }} />
      <RasterSource id="osm" tiles={[OSM_TILES]} tileSize={256} maxzoom={19} attribution="OpenStreetMap contributors">
        <Layer
          id="osm-tiles"
          type="raster"
          paint={{
            'raster-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.5, 13, 1],
            'raster-saturation': ['interpolate', ['linear'], ['zoom'], 9, -0.45, 13, -0.05],
            'raster-contrast': ['interpolate', ['linear'], ['zoom'], 9, -0.09, 13, -0.01],
            'raster-brightness-max': ['interpolate', ['linear'], ['zoom'], 9, 0.83, 13, 0.98],
          }}
        />
      </RasterSource>
      <GeoJSONSource id="tint" data={TINT}>
        <Layer id="tint" type="fill" paint={{ 'fill-color': mapPalette.parchmentTint, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.16, 13, 0.06] }} />
      </GeoJSONSource>

      <GeoJSONSource id="search-area" data={searchArea}>
        <Layer id="search-area-fill" type="fill" paint={{ 'fill-color': mapPalette.searchArea, 'fill-opacity': 0.12 }} />
        <Layer id="search-area-line" type="line" paint={{ 'line-color': mapPalette.searchArea, 'line-width': 2, 'line-opacity': 0.95, 'line-dasharray': [3, 3] }} />
      </GeoJSONSource>

      <GeoJSONSource id="user-accuracy" data={userAccuracy}>
        <Layer id="user-accuracy-fill" type="fill" paint={{ 'fill-color': mapPalette.userAccuracy, 'fill-opacity': 0.12 }} />
        <Layer id="user-accuracy-line" type="line" paint={{ 'line-color': mapPalette.userAccuracy, 'line-width': 1, 'line-opacity': 0.6 }} />
      </GeoJSONSource>

      {clusters.map((feature) => {
            const [lng, lat] = feature.geometry.coordinates
            if ('cluster' in feature.properties && feature.properties.cluster) {
              const id = feature.properties.cluster_id
              const count = feature.properties.point_count
              return (
                <Marker
                  key={`cluster-${id}`}
                  id={`cluster-${id}`}
                  lngLat={[lng, lat]}
                  anchor="center"
                  onPress={() => camera.current?.easeTo({ center: [lng, lat], zoom: Math.min(index.getClusterExpansionZoom(id), CLUSTERS_UNTIL_ZOOM + 1), duration: 800 })}
                  accessibilityRole="button"
                  accessibilityLabel={t('map.clusterCottages', { count })}
                >
                  <ClusterBadge count={count} />
                </Marker>
              )
            }
            const cottage = bySlug.get((feature.properties as { slug: string }).slug)
            if (!cottage) return null
            return (
              <Marker
                key={cottage.slug}
                id={cottage.slug}
                lngLat={[cottage.lng, cottage.lat]}
                anchor="bottom"
                onPress={() => onSelect(cottage)}
                accessibilityRole="button"
                accessibilityLabel={t('map.openMarker', { title: cottage.title })}
              >
                <CottagePin found={foundSlugs.has(cottage.slug)} active={cottage.slug === selectedSlug} customImage={cottage.pin_custom_img} />
              </Marker>
            )
          })}

      {userPosition ? (
        <Marker id="you" lngLat={[userPosition.lng, userPosition.lat]} anchor="center" accessibilityLabel={t('map.youAreHere')}>
          <UserDot />
        </Marker>
      ) : null}
    </MapView>
  )
})

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
})
