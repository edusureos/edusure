import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  Building2, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle,
  PlusCircle,
  MinusCircle,
  Info,
  Maximize2
} from 'lucide-react';

// Controller component to smoothly pan/fit map bounds
function MapController({ center, bounds, selectedBin }) {
  const map = useMap();

  useEffect(() => {
    if (bounds && bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (selectedBin) {
      map.flyTo([selectedBin.latitude, selectedBin.longitude], 16, { duration: 0.8 });
    }
  }, [bounds, selectedBin, map]);

  return null;
}

export default function WasteMap({
  bins = [],
  depot,
  selectedBinIds = [],
  onToggleBinSelection,
  onSelectBinDetail,
  activeRoute = null,
  focusedBin = null
}) {
  const mapCenter = [28.7485, 77.1165]; // Center on Rohini / DTU Zone

  // Depot Marker Icon
  const depotIcon = L.divIcon({
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;">
        <div style="width: 32px; height: 32px; border-radius: 8px; background: #183D2B; border: 2px solid #FFFFFF; box-shadow: 0 4px 10px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; color: white;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M12 3l9 4H3l9-4z"/>
          </svg>
        </div>
      </div>
    `,
    className: 'custom-depot-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });

  // Bin Marker Icons based on Priority / Fill Level
  const createBinIcon = (bin, isSelected, isFocused, stopNumber = null) => {
    let color = '#16A34A'; // Low: Green
    let isPulse = false;

    if (bin.priority === 'Critical' || bin.fill_level >= 90) {
      color = '#DC2626'; // Critical: Red
      isPulse = true;
    } else if (bin.priority === 'High' || bin.fill_level >= 75) {
      color = '#EA580C'; // High: Orange
    } else if (bin.priority === 'Medium' || bin.fill_level >= 45) {
      color = '#CA8A04'; // Medium: Yellow/Sage
    }

    const ringStyle = isSelected 
      ? 'outline: 3px solid #234C36; outline-offset: 2px;' 
      : isFocused 
      ? 'outline: 3px solid #183D2B; outline-offset: 2px;' 
      : '';

    const labelHtml = stopNumber !== null
      ? `<span style="font-size: 10px; font-weight: 700; color: #FFFFFF; line-height: 1;">${stopNumber}</span>`
      : '';

    const size = stopNumber !== null ? 22 : 18;

    const html = `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 26px; height: 26px;">
        ${isPulse ? `<div style="position: absolute; inset: -3px; border-radius: 9999px; background: rgba(220, 38, 38, 0.45); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` : ''}
        <div style="width: ${size}px; height: ${size}px; border-radius: 9999px; background-color: ${color}; border: 2px solid #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; ${ringStyle}">
          ${labelHtml}
        </div>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'custom-bin-marker',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -13]
    });
  };

  // Build Polyline points if activeRoute exists
  const routeCoordinates = activeRoute?.stops?.map(s => [s.latitude, s.longitude]) || [];

  return (
    <div className="relative w-full h-[460px] sm:h-[540px] rounded-2xl overflow-hidden border border-[#E5E8DF] shadow-xs bg-[#F4F6F1]">
      <MapContainer
        center={mapCenter}
        zoom={14}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <MapController 
          bounds={routeCoordinates.length > 1 ? routeCoordinates : null} 
          selectedBin={focusedBin}
        />

        {/* Clean, light OpenStreetMap Carto tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />

        {/* Active Route Polyline (Prominent Forest Green) */}
        {routeCoordinates.length > 1 && (
          <Polyline
            positions={routeCoordinates}
            pathOptions={{
              color: '#234C36',
              weight: 4,
              opacity: 0.95,
              lineJoin: 'round',
              dashArray: '8, 6'
            }}
          />
        )}

        {/* Municipal Fleet Depot Marker */}
        {depot && (
          <Marker position={[depot.latitude, depot.longitude]} icon={depotIcon}>
            <Popup>
              <div className="p-2 max-w-[240px]">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="p-1 rounded bg-[#E6EFE5] text-[#234C36]">
                    <Building2 className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-[#183D2B]">{depot.name}</h4>
                    <p className="text-[10px] text-[#788278]">Central Municipal Fleet Depot</p>
                  </div>
                </div>
                <div className="text-[11px] bg-[#F8F7F1] p-1.5 rounded border border-[#E5E8DF] mt-1 space-y-0.5">
                  <p><span className="text-[#788278]">Coordinates:</span> {depot.latitude.toFixed(4)}, {depot.longitude.toFixed(4)}</p>
                  <p><span className="text-[#788278]">Role:</span> Start and return destination for collection fleet</p>
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Bins Markers */}
        {bins.map((bin) => {
          const isSelected = selectedBinIds.includes(bin.id);
          const isFocused = focusedBin?.id === bin.id;
          const stopIndex = activeRoute?.stops?.findIndex(s => s.bin_id === bin.id);
          const stopNumber = stopIndex !== undefined && stopIndex > 0 ? stopIndex : null;

          return (
            <Marker
              key={bin.id}
              position={[bin.latitude, bin.longitude]}
              icon={createBinIcon(bin, isSelected, isFocused, stopNumber)}
              eventHandlers={{
                click: () => onSelectBinDetail?.(bin)
              }}
            >
              <Popup>
                <div className="p-2.5 max-w-[260px] text-xs">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#E5E8DF]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[#183D2B]">{bin.id}</span>
                      {stopNumber !== null && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#234C36] text-white">
                          Stop #{stopNumber}
                        </span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-[#E6EFE5] text-[#234C36]">
                        {bin.waste_type}
                      </span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      bin.priority === 'Critical' ? 'bg-red-100 text-red-700' :
                      bin.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                      bin.priority === 'Medium' ? 'bg-amber-100 text-amber-800' :
                      'bg-emerald-100 text-emerald-800'
                    }`}>
                      {bin.priority}
                    </span>
                  </div>

                  {/* Location & Details */}
                  <div className="py-2 space-y-1 text-[#252B26]">
                    <p className="font-medium text-[11px] text-[#183D2B]">{bin.location_name}</p>
                    <div className="flex items-center justify-between text-[11px] text-[#788278]">
                      <span>Fill Capacity:</span>
                      <span className="font-semibold text-[#183D2B]">{bin.fill_level}% ({bin.capacity_liters}L)</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-[#E5E8DF] rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          bin.fill_level >= 90 ? 'bg-red-600' :
                          bin.fill_level >= 75 ? 'bg-orange-500' :
                          bin.fill_level >= 45 ? 'bg-amber-500' :
                          'bg-emerald-500'
                        }`}
                        style={{ width: `${bin.fill_level}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-[#788278] italic pt-1">
                      "{bin.recommended_action}"
                    </p>
                  </div>

                  {/* Quick Action Toggle */}
                  <div className="pt-2 border-t border-[#E5E8DF] flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleBinSelection?.(bin.id);
                      }}
                      className={`flex-1 py-1 px-2 rounded-md font-medium text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                        isSelected 
                          ? 'bg-[#E6EFE5] text-[#234C36] hover:bg-red-50 hover:text-red-700'
                          : 'bg-[#234C36] text-white hover:bg-[#183D2B]'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-[#234C36]" />
                          Selected (Click to Remove)
                        </>
                      ) : (
                        <>
                          <PlusCircle className="w-3 h-3" />
                          Add to Collection Route
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Floating Map Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-xs border border-[#E5E8DF] rounded-xl px-3 py-2 shadow-xs text-xs">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[#788278] mb-1.5">
          Map Legend
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 ring-1 ring-red-200" />
            <span className="text-[#252B26]">Critical (≥90%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <span className="text-[#252B26]">High (75-89%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-[#252B26]">Moderate (45-74%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            <span className="text-[#252B26]">Low (&lt;45%)</span>
          </div>
        </div>
        {routeCoordinates.length > 1 && (
          <div className="mt-2 pt-1.5 border-t border-[#E5E8DF] flex items-center gap-2 text-[10px] text-[#234C36] font-semibold">
            <span className="w-3.5 h-0.5 bg-[#234C36] border-b border-dashed border-[#234C36]" />
            <span>Active TSP Route ({routeCoordinates.length - 2} stops)</span>
          </div>
        )}
      </div>

      {/* Geodesic Prototype Disclaimer Pill */}
      <div className="absolute top-3 right-3 z-[1000] bg-white/90 backdrop-blur-xs border border-[#E5E8DF] rounded-lg px-2.5 py-1 shadow-xs text-[10px] text-[#788278] flex items-center gap-1.5">
        <Info className="w-3 h-3 text-[#8BA88E]" />
        <span>Geodesic route approximation (Prototype MVP)</span>
      </div>
    </div>
  );
}
