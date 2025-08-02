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

function handleCharacteristicChange(event) {
  const decodedText = new TextDecoder().decode(event.target.value).trim();
  const parts = decodedText.split(',');
  if (parts.length === 2) {
    const lat = (parseFloat(parts[0]) - 2560)/29;
    const lng = (parseFloat(parts[1]) - 2560)/29;

    retrievedValue.innerHTML = `Lat: ${lat} | Lng: ${lng}`;
    timestampContainer.innerHTML = getDateTime();

    updateBleMarker(lat, lng);
  } else {
    retrievedValue.innerHTML = "Formato inválido";
  }
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
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    pcMarker.setLatLng([lat, lng]);
    pcMarker.setPopupContent(`Home: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
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
