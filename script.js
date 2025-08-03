// DOM Elements
const connectButton = document.getElementById('connectBleButton');
const disconnectButton = document.getElementById('disconnectBleButton');
const onButton = document.getElementById('onButton');
const offButton = document.getElementById('offButton');
const retrievedValue = document.getElementById('valueContainer');
const latestValueSent = document.getElementById('valueSent');
const bleStateContainer = document.getElementById('bleState');
const timestampContainer = document.getElementById('timestamp');

// BLE Config
var deviceName = 'ESP32';
var bleService = '19b10000-e8f2-537e-4f6c-d104768a1214';
var ledCharacteristic = '19b10002-e8f2-537e-4f6c-d104768a1214';
var sensorCharacteristic = '19b10001-e8f2-537e-4f6c-d104768a1214';

var bleServer, bleServiceFound, sensorCharacteristicFound;

// Mapa
let map, bleMarker, pcMarker;

let PC_lat = null;
let PC_lng = null;


// Al cargar la página
window.onload = () => {
  initMap();
  getUserLocation();
};

// BLE
connectButton.addEventListener('click', () => {
  if (navigator.bluetooth) connectToDevice();
  else {
    bleStateContainer.innerHTML = "Bluetooth no disponible";
    console.log("Bluetooth API no disponible");
  }
});

disconnectButton.addEventListener('click', disconnectDevice);
onButton.addEventListener('click', () => writeOnCharacteristic(1));
offButton.addEventListener('click', () => writeOnCharacteristic(0));

// BLE Logic
function connectToDevice() {
  navigator.bluetooth.requestDevice({
    filters: [{ name: deviceName }],
    optionalServices: [bleService]
  })
  .then(device => {
    bleStateContainer.innerHTML = `Conectado a ${device.name}`;
    bleStateContainer.style.color = "#24af37";
    device.addEventListener('gattservicedisconnected', onDisconnected);
    return device.gatt.connect();
  })
  .then(server => server.getPrimaryService(bleService))
  .then(service => {
    bleServiceFound = service;
    return service.getCharacteristic(sensorCharacteristic);
  })
  .then(characteristic => {
    sensorCharacteristicFound = characteristic;
    characteristic.addEventListener('characteristicvaluechanged', handleCharacteristicChange);
    return characteristic.startNotifications();
  })
  .catch(err => console.error("Error:", err));
}


// Recibir la struct por BLE compuesta por
// - 32B ACKpld
// - 1B nrf_ok 'Y' o 'N'
// - 1B nrf_quality

function handleCharacteristicChange(event) {
  const value = event.target.value;
  const buffer = event.target.value.buffer;
  
  if (value.byteLength !== 34) {
    retrievedValue.innerHTML = `Formato inválido (tamaño incorrecto de ${buffer.byteLength}B)`;
    return;
  }
  
  const dataView = new DataView(buffer);

  let offset = 0;

  const ACK_estado = dataView.getUint8(offset); offset += 1;

  const longitud = dataView.getFloat32(offset, true); offset += 4;
  const latitud = dataView.getFloat32(offset, true); offset += 4;

  const bat_level = dataView.getUint8(offset); offset += 1;
  const bat_current = dataView.getUint8(offset); offset += 1;

  const velocidad = dataView.getFloat32(offset, true); offset += 4;
  const heading = dataView.getUint16(offset, true); offset += 2;
  const sat_in_view = dataView.getUint8(offset); offset += 1;
  
  // --- extra[14] interpretado como datos binarios ---
  const roll  = dataView.getInt16(offset, true); offset += 2;
  const pitch = dataView.getInt16(offset, true); offset += 2;
  // Los restantes 10 bytes de extra, si querés, podés usarlos igual:
  const extra_bytes = [];
  for (let i = 0; i < 10; i++) {
    extra_bytes.push(dataView.getUint8(offset++));
  }
  
  const nrf_OK = String.fromCharCode(dataView.getUint8(offset)); offset += 1;
  const nrf_quality = dataView.getUint8(offset);


  
  // Coordenadas interpretadas (según tu conversión anterior)
  const distancia = calcularDistancia(latitud, longitud, PC_lat, PC_lng);

  // NRF state
  if (nrf_OK === 'Y') {
    estadoNRF.innerHTML = `NRF OK ✅ (${nrf_quality} reintentos)`;
    estadoNRF.style.color = "#24af37";
  } else if (nrf_OK === 'N') {
    estadoNRF.innerHTML = `Error NRF ❌`;
    estadoNRF.style.color = "#d13a30";
  } else {
    estadoNRF.innerHTML = `Estado NRF desconocido`;
    estadoNRF.style.color = "#bebebe";
  }

  retrievedValue.innerHTML = `${distancia.toFixed(1)} m`;
  timestampContainer.innerHTML = getDateTime();

  updateBleMarker(latitud, longitud);
  
  // Muestro todo en consola
  console.log(`Batería: ${bat_level}%`);
  console.log(`Corriente: ${bat_current} mA`);
  console.log(`Velocidad: ${velocidad.toFixed(2)} m/s`);
  console.log(`Heading: ${heading}°`);
  console.log(`Satélites: ${sat_in_view}`);
  console.log(`Extra: "${extra}"`);
  console.log(`NRF calidad: ${nrf_quality}`);
  console.log("Extra:", extraText);
}


function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371000; // radio de la Tierra en metros
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c); // distancia en metros (entero)
}

function writeOnCharacteristic(value) {
  if (bleServiceFound) {
    bleServiceFound.getCharacteristic(ledCharacteristic)
      .then(characteristic => characteristic.writeValue(new Uint8Array([value])))
      .then(() => {
        latestValueSent.innerHTML = value;
        console.log("Valor enviado:", value);
      })
      .catch(err => console.error("Error al escribir:", err));
  } else {
    alert("No hay conexión BLE");
  }
}

function disconnectDevice() {
  if (sensorCharacteristicFound) {
    sensorCharacteristicFound.stopNotifications().then(() => {
      bleServer.disconnect();
      bleStateContainer.innerHTML = "Desconectado";
      bleStateContainer.style.color = "#d13a30";
    });
  }
}

function onDisconnected(event) {
  bleStateContainer.innerHTML = "Desconectado";
  bleStateContainer.style.color = "#d13a30";
  console.log("BLE desconectado");
}

// Mapa y geolocalización
function initMap() {
  map = L.map('map').setView([0, 0], 2);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  bleMarker = L.marker([0, 0], { icon: redIcon() })
    .addTo(map)
    .bindPopup("USV")
    .openPopup();

  pcMarker = L.marker([0, 0], { icon: blueIcon() })
    .addTo(map)
    .bindPopup("Home")
    .openPopup();;
}

function updateBleMarker(lat, lng) {
  bleMarker.setLatLng([lat, lng]);
  bleMarker.setPopupContent(`USV: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
//  map.setView([lat, lng], 15);
}

function getUserLocation() {
  if (!navigator.geolocation) {
    console.log("Geolocalización no soportada");
    return;
  }

  navigator.geolocation.getCurrentPosition(pos => {
    PC_lat = pos.coords.latitude;
    PC_lng = pos.coords.longitude;
    pcMarker.setLatLng([PC_lat, PC_lng]);
    pcMarker.setPopupContent(`Home: ${PC_lat.toFixed(5)}, ${PC_lng.toFixed(5)}`);
  }, err => {
    console.warn("Error al obtener ubicación:", err.message);
  });
}

function getDateTime() {
  const now = new Date();
  return now.toLocaleString();
}

// Iconos personalizados (opcional)
function redIcon() {
  return new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  });
}

function blueIcon() {
  return new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  });
}
