window.onload = function() {
    cargarDatosIniciales();
    
    // El mapa necesita un pequeño retraso para detectar el tamaño real del div en móviles
    setTimeout(() => { 
        map.invalidateSize(); 
    }, 400); 

    window.addEventListener('resize', () => {
        map.invalidateSize();
    });
};
// Sustituir la función original calcularYMostrarMedias por esta:
function calcularYMostrarMedias(estaciones) {
    const tipos = {
        'gas95': { nombre: 'Gasolina 95', campo: 'Precio Gasolina 95 E5', ieh: 0.472 },
        'dizel': { nombre: 'Diésel', campo: 'Precio Gasoleo A', ieh: 0.379 },
        'dizel_plus': { nombre: 'Diésel Premium', campo: 'Precio Gasoleo Premium', ieh: 0.379 }
    };

    // Esta función ahora guarda los datos para mostrarlos cuando se selecciona un combustible
    window.preciosMedios = {};

    Object.keys(tipos).forEach(t => {
        let ps = estaciones.map(e => e[tipos[t].campo]).filter(p => p).map(p => parseFloat(p.replace(',', '.')));
        if (ps.length) {
            const media = ps.reduce((a, b) => a + b, 0) / ps.length;
            const iva = media - (media / 1.21);
            const materia = media - iva - tipos[t].ieh;
            
            window.preciosMedios[t] = {
                media: media.toFixed(3),
                materia: materia.toFixed(3),
                hidro: tipos[t].ieh.toFixed(3),
                iva: iva.toFixed(3),
                nombre: tipos[t].nombre
            };
        }
    });
    
    // Actualizar vista inicial
    actualizarUIEstadisticas('gas95');
}

// Nueva función para actualizar la UI móvil al cambiar de pestaña
function actualizarUIEstadisticas(id) {
    const data = window.preciosMedios[id];
    if (!data) return;
    
    document.getElementById('active-label').innerText = "Media " + data.nombre;
    document.getElementById('active-price').innerText = data.media + " €/L";
    document.getElementById('val-materia').innerText = data.materia + "€";
    document.getElementById('val-hidro').innerText = data.hidro + "€";
    document.getElementById('val-iva').innerText = data.iva + "€";
}

// Modificar selectFuel para que llame a la actualización de UI
const originalSelectFuel = selectFuel;
selectFuel = function(btn, id) {
    originalSelectFuel(btn, id);
    actualizarUIEstadisticas(id);
};

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
}).addTo(map);