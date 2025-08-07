// DOM Elements
const connectButton = document.getElementById('connectBleButton');
const disconnectButton = document.getElementById('disconnectBleButton');
const onButton = document.getElementById('onButton');
const offButton = document.getElementById('offButton');
const retrievedValue = document.getElementById('valueContainer');
const bleStateContainer = document.getElementById('bleState');
const timestampContainer = document.getElementById('timestamp');
const batteryFillOverlay = document.getElementById('batteryFillOverlay');
const estadoNRF = document.getElementById('estadoNRF');
const bleStatusIndicator = document.getElementById('bleStatusIndicator');
const nrfStatusIndicator = document.getElementById('nrfStatusIndicator');
const headingValue = document.getElementById('headingValue');
const velocidadValue = document.getElementById('velocidadValue');
const satelitesValue = document.getElementById('satelitesValue');
const compassNeedle = document.getElementById('compassNeedle');
const corrienteValue = document.getElementById('corrienteValue');
const rollValue = document.getElementById('rollValue');
const pitchValue = document.getElementById('pitchValue');
const lowBatteryWarning = document.getElementById('lowBatteryWarning');
const batteryLevel = document.getElementById('batteryLevel');
const throttleValue = document.getElementById('throttleValue');
const directionValue = document.getElementById('directionValue');
const throttleSlider = document.getElementById('throttleSlider');
const directionSlider = document.getElementById('directionSlider');

// BLE Config
var deviceName = 'ESP32';
var bleService = '19b10000-e8f2-537e-4f6c-d104768a1214';
var ledCharacteristic = '19b10002-e8f2-537e-4f6c-d104768a1214';
var sensorCharacteristic = '19b10001-e8f2-537e-4f6c-d104768a1214';

var bleServer, bleServiceFound, sensorCharacteristicFound;

// Map variables
let map, bleMarker, pcMarker;
let PC_lat = null;
let PC_lng = null;

// Initialize when page loads
window.onload = () => {
    initMap();
    getUserLocation();
};

// Event Listeners
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

function connectToDevice() {
    navigator.bluetooth.requestDevice({
        filters: [{ name: deviceName }],
        optionalServices: [bleService]
    })
    .then(device => {
        bleStateContainer.innerHTML = "Conectando...";
        device.addEventListener('gattserverdisconnected', onDisconnected);
        return device.gatt.connect();
    })
    .then(server => {
        bleServer = server;
        return server.getPrimaryService(bleService);
    })
    .then(service => {
        bleServiceFound = service;
        return service.getCharacteristic(sensorCharacteristic);
    })
    .then(characteristic => {
        sensorCharacteristicFound = characteristic;
        return characteristic.startNotifications();
    })
    .then(() => {
        sensorCharacteristicFound.addEventListener('characteristicvaluechanged', handleCharacteristicChange);
        bleStateContainer.innerHTML = "Conectado";
        bleStatusIndicator.classList.add('activo');
    })
    .catch(error => {
        bleStateContainer.innerHTML = "Error al conectar";
        console.error(error);
    });
}

function handleCharacteristicChange(event) {
    const value = event.target.value;
    const data = new Uint8Array(value.buffer);

    const distancia = data[0];
    const porcentaje_bat = data[1];
    const bat_current = data[2];
    const heading = data[3];
    const velocidad = data[4];
    const sat_in_view = data[5];
    const roll = data[6];
    const pitch = data[7];
    const nrf_OK = data[8];
    const nrf_quality = data[9];
    const throttle = data[10];
    const direction = data[11];

    updateUI(distancia, porcentaje_bat, bat_current, heading, velocidad, sat_in_view, roll, pitch, nrf_OK, nrf_quality, throttle, direction);
}

function updateUI(distancia, porcentaje_bat, bat_current, heading, velocidad, sat_in_view, roll, pitch, nrf_OK, nrf_quality, throttle_control, direction_control) {
    timestampContainer.innerText = getDateTime();
    batteryLevel.innerText = `${porcentaje_bat}%`;
    headingValue.innerText = `${heading}°`;
    velocidadValue.innerText = `${velocidad} km/h`;
    satelitesValue.innerText = `${sat_in_view}`;
    corrienteValue.innerText = `${bat_current} mA`;
    rollValue.innerText = `${roll}°`;
    pitchValue.innerText = `${pitch}°`;
    throttleValue.innerText = throttle_control;
    directionValue.innerText = direction_control;
    compassNeedle.style.transform = `rotate(${heading}deg)`;
    bleStatusIndicator.classList.toggle('activo', true);
    nrfStatusIndicator.classList.toggle('activo', nrf_OK);
    updateBatteryVisual(porcentaje_bat);
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
    function toRad(x) { return x * Math.PI / 180; }
    var R = 6371;
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c * 1000;
}

function calcularTensionBateria(bat_level) {
    return 6 + (bat_level / 100) * 2.4;
}

function estimarPorcentajeBateria(tension) {
    return Math.round((tension - 6) / 2.4 * 100);
}

function writeOnCharacteristic(value) {
    if (!bleServiceFound) return;
    bleServiceFound.getCharacteristic(ledCharacteristic)
        .then(characteristic => characteristic.writeValue(Uint8Array.of(value)))
        .catch(err => console.error("Error escribiendo en characteristic", err));
}

function disconnectDevice() {
    if (bleServer?.connected) {
        bleServer.disconnect();
        bleStateContainer.innerHTML = "Desconectado";
        bleStatusIndicator.classList.remove('activo');
    }
}

function onDisconnected(event) {
    bleStateContainer.innerHTML = "Desconectado";
    bleStatusIndicator.classList.remove('activo');
    console.log("BLE device disconnected");
}

function initMap() {
    map = L.map('map').setView([-34.6, -58.4], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
    }).addTo(map);
}

function updateBleMarker(lat, lng) {
    if (!bleMarker) {
        bleMarker = L.marker([lat, lng], { icon: usvIcon() }).addTo(map);
    } else {
        bleMarker.setLatLng([lat, lng]);
    }
    map.panTo([lat, lng]);
}

function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(pos => {
            PC_lat = pos.coords.latitude;
            PC_lng = pos.coords.longitude;
            if (!pcMarker) {
                pcMarker = L.marker([PC_lat, PC_lng], { icon: userIcon() }).addTo(map);
            } else {
                pcMarker.setLatLng([PC_lat, PC_lng]);
            }
        });
    }
}

function getDateTime() {
    return new Date().toLocaleString();
}

function usvIcon() {
    return L.icon({
        iconUrl: 'usv_icon.png',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
    });
}

function userIcon() {
    return L.icon({
        iconUrl: 'user_icon.png',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
    });
}

function updateBatteryVisual(level) {
    batteryFillOverlay.style.width = `${level}%`;
    if (level < 20) {
        lowBatteryWarning.style.display = 'block';
    } else {
        lowBatteryWarning.style.display = 'none';
    }
}
